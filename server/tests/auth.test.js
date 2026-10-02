import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import * as oidc from 'openid-client';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';
import { supportUsers, seedSupportUsers } from '../prisma/users.seed.js';
import { closeSessionStore } from '../src/auth/session.js';
import { authConfig } from '../src/auth/config.js';
import { linkGoogleUser } from '../src/auth/user.js';
import { assertTestDatabase, sessionFixture } from './helpers/session-fixture.js';

vi.mock('openid-client', async (original) => {
  const actual = await original();
  return { ...actual,
    discovery: vi.fn(async () => new actual.Configuration({ issuer: 'https://accounts.google.com',
      authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth', token_endpoint: 'https://oauth2.googleapis.com/token',
      jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
    }, 'test-client', 'test-secret')),
    authorizationCodeGrant: vi.fn(),
  };
});
const user = supportUsers[0];
const claims = { sub: 'verified-google-subject', email: user.email, email_verified: true, name: user.name };
let ticket;
beforeEach(async () => {
  assertTestDatabase();
  await prisma.ticket.deleteMany(); await prisma.user.deleteMany(); await prisma.session.deleteMany();
  await seedSupportUsers(prisma);
  ticket = await prisma.ticket.create({ data: { title: 'Authenticated request', customerEmail: 'customer@example.com', description: 'Issue details.', priority: 'HIGH' } });
  oidc.authorizationCodeGrant.mockReset().mockResolvedValue({ claims: () => claims });
});
afterAll(async () => { await closeSessionStore(); await prisma.$disconnect(); });
async function start(agent) {
  const response = await agent.get('/api/auth/google');
  expect(response.status).toBe(302);
  return { response, url: new URL(response.headers.location) };
}
async function login(identity = claims) {
  oidc.authorizationCodeGrant.mockResolvedValue({ claims: () => identity });
  const agent = request.agent(app);
  const begin = await start(agent);
  const callback = await agent.get('/api/auth/google/callback').query({ state: begin.url.searchParams.get('state'), code: 'mock-code' });
  expect(callback.headers.location).toBe(`${authConfig.origin}/dashboard`);
  const csrf = await agent.get('/api/auth/csrf');
  return { agent, token: csrf.body.data.token, callback, begin };
}

describe('protected API and server-side sessions', () => {
  it.each([
    ['get', '/api/tickets'], ['get', '/api/tickets/summary'], ['get', '/api/users'],
    ['get', '/api/tickets/invalid'], ['get', '/api/tickets/invalid/comments'], ['get', '/api/tickets/invalid/assignees'],
    ['get', '/api/tickets/invalid/attachments'], ['get', '/api/tickets/invalid/attachments/invalid/content'],
    ['post', '/api/tickets'], ['patch', '/api/tickets/invalid'], ['post', '/api/tickets/invalid/comments'],
    ['post', '/api/tickets/invalid/assignees'], ['delete', '/api/tickets/invalid/assignees/invalid'],
    ['post', '/api/tickets/invalid/attachments'], ['delete', '/api/tickets/invalid/attachments/invalid'],
    ['get', '/api/auth/me'], ['get', '/api/auth/csrf'], ['post', '/api/auth/logout'],
  ])('rejects unauthenticated %s %s consistently', async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } });
  });
  it('returns only safe user fields and keeps the same session valid across subsequent requests', async () => {
    const { agent, callback } = await login();
    expect((await agent.get('/api/auth/me')).body).toEqual({ success: true, data: { ...user, avatarUrl: null } });
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await agent.get('/api/tickets')).status).toBe(200);
    expect(callback.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(callback.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);
    expect(callback.headers['set-cookie'][0]).toMatch(/Expires=/);
    const rows = await prisma.session.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].sess).toMatchObject({ userId: user.id });
    expect(JSON.stringify(rows)).not.toMatch(/access_token|refresh_token|id_token|client_secret/);
  });
  it('regenerates the session ID on login and invalidates the pre-login cookie', async () => {
    const { agent, begin, callback } = await login();
    const oldCookie = begin.response.headers['set-cookie'][0].split(';')[0];
    expect(callback.headers['set-cookie'][0].split(';')[0]).not.toBe(oldCookie);
    expect((await request(app).get('/api/auth/me').set('Cookie', oldCookie)).status).toBe(401);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
  });
  it('requires CSRF and rejects cross-origin mutations without changing records', async () => {
    const { agent, token } = await login();
    const path = `/api/tickets/${ticket.id}`;
    for (const response of [
      await agent.patch(path).send({ status: 'RESOLVED' }),
      await agent.patch(path).set('X-CSRF-Token', 'wrong').send({ status: 'RESOLVED' }),
      await agent.patch(path).set('X-CSRF-Token', 'é'.repeat(token.length)).send({ status: 'RESOLVED' }),
      await agent.patch(path).set('X-CSRF-Token', token).set('Origin', 'https://attacker.example').send({ status: 'RESOLVED' }),
    ]) { expect(response.status).toBe(403); expect(response.body.error.code).toBe('INVALID_CSRF_TOKEN'); }
    expect((await prisma.ticket.findUnique({ where: { id: ticket.id } })).status).toBe('OPEN');
    expect((await agent.patch(path).set('X-CSRF-Token', token).set('Origin', authConfig.origin).send({ status: 'RESOLVED' })).status).toBe(200);
  });
  it('invalidates the stored session and clears the cookie on logout', async () => {
    const { agent, token, callback } = await login();
    const cookie = callback.headers['set-cookie'][0].split(';')[0];
    expect((await agent.post('/api/auth/logout')).status).toBe(403);
    const response = await agent.post('/api/auth/logout').set('X-CSRF-Token', token);
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
    expect(await prisma.session.count()).toBe(0);
    expect((await agent.get('/api/tickets')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });
  it('rejects expired sessions and sessions belonging to deleted users', async () => {
    const expired = await sessionFixture(user.id, { authenticatedAt: Date.now() - authConfig.maxAge - 1 });
    expect((await request(app).get('/api/auth/me').set('Cookie', expired.cookie)).status).toBe(401);
    const valid = await sessionFixture();
    await prisma.user.delete({ where: { id: user.id } });
    expect((await request(app).get('/api/auth/me').set('Cookie', valid.cookie)).status).toBe(401);
  });
  it('has no production-style test login endpoint', async () => {
    expect((await request(app).post('/api/__test__/login')).status).toBe(404);
  });
});

describe('Google OpenID Connect boundary', () => {
  it('uses the library for identity-only scopes, PKCE, state, nonce and validated ID tokens', async () => {
    const { begin } = await login();
    expect(begin.url.origin).toBe('https://accounts.google.com');
    expect(begin.url.searchParams.get('scope')).toBe('openid email profile');
    expect(begin.url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(begin.url.searchParams.get('code_challenge')).toBeTruthy();
    expect(begin.url.searchParams.get('redirect_uri')).toBe(authConfig.callback);
    const [config, url, checks] = oidc.authorizationCodeGrant.mock.calls[0];
    expect(config).toBeInstanceOf(oidc.Configuration);
    expect(url.origin).toBe(authConfig.origin);
    expect(checks).toMatchObject({ expectedState: begin.url.searchParams.get('state'), expectedNonce: begin.url.searchParams.get('nonce'), idTokenExpected: true });
    expect(checks.pkceCodeVerifier).toBeTruthy();
    expect(oidc.discovery).toHaveBeenCalledWith(new URL('https://accounts.google.com'), 'test-client', 'test-secret', undefined, { execute: [oidc.enableNonRepudiationChecks] });
  });
  it.each(['missing', 'wrong', 'duplicate', 'expired'])('rejects %s OAuth state before calling the provider', async (kind) => {
    const agent = request.agent(app);
    const { url } = await start(agent);
    const state = url.searchParams.get('state');
    if (kind === 'expired') {
      const row = await prisma.session.findFirst();
      await prisma.session.update({ where: { sid: row.sid }, data: { sess: { ...row.sess, oauth: { ...row.sess.oauth, createdAt: Date.now() - 11 * 60 * 1000 } } } });
    }
    const query = kind === 'missing' ? 'code=x' : kind === 'wrong' ? 'state=wrong&code=x' : `state=${state}&code=x${kind === 'duplicate' ? `&state=${state}` : ''}`;
    const response = await agent.get(`/api/auth/google/callback?${query}`);
    expect(response.headers.location).toBe(`${authConfig.origin}/login?error=failed`);
    expect(oidc.authorizationCodeGrant).not.toHaveBeenCalled();
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
  it('handles denied consent or token/nonce validation failure without authenticating and consumes the transaction', async () => {
    oidc.authorizationCodeGrant.mockRejectedValue(new Error('Provider rejected nonce/code'));
    const agent = request.agent(app);
    const { url } = await start(agent);
    const query = { state: url.searchParams.get('state'), error: 'access_denied' };
    expect((await agent.get('/api/auth/google/callback').query(query)).headers.location).toContain('/login?error=failed');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    await agent.get('/api/auth/google/callback').query(query);
    expect(oidc.authorizationCodeGrant).toHaveBeenCalledTimes(1);
    expect(await prisma.user.count()).toBe(6);
  });
  it('refuses identities without verified email', async () => {
    const agent = request.agent(app); const { url } = await start(agent);
    oidc.authorizationCodeGrant.mockResolvedValue({ claims: () => ({ ...claims, email_verified: false }) });
    expect((await agent.get('/api/auth/google/callback').query({ state: url.searchParams.get('state'), code: 'x' })).headers.location).toContain('/login?error=failed');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect(await prisma.user.count()).toBe(6);
  });
});

describe('identity linking and authenticated collaboration', () => {
  it('links verified canonical email to an existing ID, preserving assignments, authored comments and profile edits', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { name: 'Khushi R.' } });
    await prisma.ticketAssignee.create({ data: { ticketId: ticket.id, userId: user.id } });
    const oldComment = await prisma.comment.create({ data: { ticketId: ticket.id, userId: user.id, content: 'Existing authored comment' } });
    const { agent } = await login({ ...claims, email: user.email.toUpperCase() });
    expect((await agent.get('/api/auth/me')).body.data).toMatchObject({ id: user.id, name: 'Khushi R.' });
    expect(await prisma.user.count()).toBe(6);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ googleSubject: claims.sub, lastLoginAt: expect.any(Date) });
    expect(await prisma.comment.findUnique({ where: { id: oldComment.id } })).toEqual(oldComment);
    expect(await prisma.ticketAssignee.count()).toBe(1);
    await login();
    expect(await prisma.user.count()).toBe(6);
  });
  it('creates a new verified user once and uses the stable subject on later logins even when Google email changes', async () => {
    const identity = { ...claims, sub: 'new-agent', email: 'new.agent@example.com', name: 'New Agent', picture: 'https://example.com/avatar.png' };
    const first = await linkGoogleUser(identity);
    const second = await linkGoogleUser({ ...identity, email: 'changed@example.com' });
    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({ name: 'New Agent', avatarUrl: identity.picture });
    expect(await prisma.user.count()).toBe(7);
  });
  it('handles simultaneous first logins without duplicate users or overwriting a different linked subject', async () => {
    const linked = await Promise.all([linkGoogleUser(claims), linkGoogleUser(claims)]);
    expect(linked[0].id).toBe(linked[1].id);
    expect(await prisma.user.count()).toBe(6);
    await expect(linkGoogleUser({ ...claims, sub: 'other-google-subject' })).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT' });
    expect((await prisma.user.findUnique({ where: { id: user.id } })).googleSubject).toBe(claims.sub);
  });
  it('derives new comment authors from the session and rejects supplied userId while preserving old authors', async () => {
    const old = await prisma.comment.create({ data: { ticketId: ticket.id, userId: supportUsers[1].id, content: 'Earlier agent update' } });
    const { agent, token } = await login();
    const path = `/api/tickets/${ticket.id}/comments`;
    expect((await agent.post(path).set('X-CSRF-Token', token).send({ userId: supportUsers[1].id, content: 'Spoofed author' })).status).toBe(400);
    const response = await agent.post(path).set('X-CSRF-Token', token).send({ content: 'Signed-in agent update' });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ userId: user.id, user: { id: user.id, name: user.name } });
    const comments = (await agent.get(path)).body.data;
    expect(comments.map((entry) => entry.userId)).toEqual([old.userId, user.id]);
  });
  it('keeps any support user assignable for authenticated add/remove requests', async () => {
    const { agent, token } = await login();
    const path = `/api/tickets/${ticket.id}/assignees`;
    expect((await agent.post(path).set('X-CSRF-Token', token).send({ userId: supportUsers[1].id })).status).toBe(201);
    expect((await agent.delete(`${path}/${supportUsers[1].id}`).set('X-CSRF-Token', token)).status).toBe(200);
    expect((await agent.get(path)).body.data).toEqual([]);
  });
});
