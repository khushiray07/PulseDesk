import { execFileSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { authConfig } from '../src/auth/config.js';
import { closeSessionStore } from '../src/auth/session.js';
import { prisma } from '../src/utils/prisma.js';
import { assertTestDatabase } from './helpers/session-fixture.js';

afterAll(async () => { await closeSessionStore(); await prisma.$disconnect(); });
describe('deployment transport', () => {
  it('allows only the configured browser origin, varies responses, and never caches APIs', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', authConfig.origin);
    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(authConfig.origin);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(allowed.headers.vary).toContain('Origin');
    expect(allowed.headers['cache-control']).toBe('no-store');
    const foreign = await request(app).get('/api/health').set('Origin', 'https://attacker.example');
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
    expect(foreign.headers['access-control-allow-credentials']).toBeUndefined();
  });
  it('supports CSRF/upload preflights without making protected data public', async () => {
    const preflight = await request(app).options('/api/tickets').set('Origin', authConfig.origin)
      .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type,x-csrf-token');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-methods']).toContain('POST');
    expect(preflight.headers['access-control-allow-headers']).toBe('Content-Type, X-CSRF-Token');
    expect(preflight.headers['set-cookie']).toBeUndefined();
    const protectedRead = await request(app).get('/api/tickets').set('Origin', authConfig.origin);
    expect(protectedRead.status).toBe(401);
    expect(protectedRead.headers['cache-control']).toBe('no-store');
    const foreign = await request(app).options('/api/tickets').set('Origin', 'https://attacker.example');
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('sets Secure session cookies behind the trusted HTTPS proxy, never over plain HTTP', () => {
    assertTestDatabase();
    const source = `
      const { createApp } = await import('./src/app.js');
      const { closeSessionStore } = await import('./src/auth/session.js');
      const { prisma } = await import('./src/utils/prisma.js');
      const { default: request } = await import('supertest');
      const states = [];
      const provider = { async authorization(transaction) { states.push(transaction.state); return 'https://accounts.google.com/'; } };
      const app = createApp({ provider });
      try {
        const https = await request(app).get('/api/auth/google').set('X-Forwarded-Proto', 'https');
        const http = await request(app).get('/api/auth/google');
        console.log(JSON.stringify({ proxy: app.get('trust proxy'), httpsStatus: https.status,
          httpsCookie: !!https.headers['set-cookie']?.some(cookie => cookie.includes('Secure') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax')),
          httpCookie: !!http.headers['set-cookie'] }));
      } finally {
        for (const state of states) await prisma.session.deleteMany({ where: { sess: { path: ['oauth', 'state'], equals: state } } });
        await closeSessionStore(); await prisma.$disconnect();
      }
    `;
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
      cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', TRUST_PROXY: '1',
        APP_ORIGIN: 'https://support.example.com', GOOGLE_CALLBACK_URL: 'https://support.example.com/api/auth/google/callback',
        GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret' }, stdio: 'pipe',
    }).toString();
    expect(JSON.parse(result)).toEqual({ proxy: 1, httpsStatus: 302, httpsCookie: true, httpCookie: false });
  });
  it.each(['', 'relative/uploads'])('refuses unconfigured production attachment storage: %j', (directory) => {
    expect(() => execFileSync(process.execPath, ['--input-type=module', '-e', "await import('./src/services/attachment-storage.js');"], {
      cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', ATTACHMENT_STORAGE_DRIVER: 'local', ATTACHMENT_STORAGE_DIR: directory }, stdio: 'pipe',
    })).toThrow();
  });
  it('explicit temporary production storage works without S3 credentials and handles lost files', () => {
    const source = `
      const { randomUUID } = await import('node:crypto');
      const { readFile, unlink } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');
      const { default: assert } = await import('node:assert/strict');
      const { attachmentStorage } = await import('./src/services/attachment-storage.js');
      const key = randomUUID() + '.txt';
      const path = join(tmpdir(), 'pulsedesk-attachments', key);
      const bytes = Buffer.from('Temporary support attachment');
      try {
        await attachmentStorage.write(key, bytes);
        assert.deepEqual(await readFile(path), bytes);
        await assert.rejects(attachmentStorage.write(key, bytes), { code: 'EEXIST' });
        const { attachmentStorage: restarted } = await import('./src/services/attachment-storage.js?new-instance');
        assert.deepEqual(await restarted.read(key), bytes);
        await unlink(path); // Simulate Render losing its ephemeral files.
        await assert.rejects(restarted.read(key), { code: 'ENOENT' });
        await restarted.remove(key); // Missing bytes must not prevent metadata deletion.
        await attachmentStorage.write(key, bytes);
        await attachmentStorage.remove(key);
        await assert.rejects(attachmentStorage.read(key), { code: 'ENOENT' });
        console.log('temporary-storage-verified');
      } finally {
        await attachmentStorage.remove(key);
      }
    `;
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
      cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', ATTACHMENT_STORAGE_DRIVER: 'temporary',
        ATTACHMENT_STORAGE_DIR: '', S3_ENDPOINT: '', S3_REGION: '', S3_BUCKET: '', S3_ACCESS_KEY_ID: '', S3_SECRET_ACCESS_KEY: '' }, stdio: 'pipe',
    }).toString();
    expect(output.trim()).toBe('temporary-storage-verified');
  });
});
