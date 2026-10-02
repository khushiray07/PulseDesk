import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';
import { seedSupportUsers, supportUsers } from '../prisma/users.seed.js';

const missingId = '60000000-0000-4000-8000-000000000099';
const userId = supportUsers[0].id;
let ticket, other;
const path = (kind, id = ticket.id) => `/api/tickets/${id}/${kind}`;
const assign = (id = userId) => request(app).post(path('assignees')).send({ userId: id });
const comment = (content = 'Customer confirmed the issue still occurs.', author = userId) => request(app).post(path('comments')).send({ userId: author, content });

beforeAll(() => { if (process.env.PULSEDESK_TEST_DATABASE_VERIFIED !== 'true') throw new Error('Use the isolated npm test runner.'); });
beforeEach(async () => {
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();
  await seedSupportUsers(prisma);
  const data = { title: 'Collaboration request', customerEmail: 'customer@example.com', description: 'Existing issue details.', priority: 'MEDIUM' };
  ticket = await prisma.ticket.create({ data });
  other = await prisma.ticket.create({ data });
});
afterAll(async () => { await prisma.$disconnect(); });

describe('support users', () => {
  it('returns all six deterministic support users in stable name order', async () => {
    const response = await request(app).get('/api/users');
    expect(response.status).toBe(200);
    expect(response.body.data.map((user) => user.id).sort()).toEqual(supportUsers.map((user) => user.id).sort());
    expect(response.body.data.map((user) => user.name)).toEqual(['Aisha Sharma', 'Arjun Rao', 'Khushi Ray', 'Neha Kapoor', 'Rohan Mehta', 'Vikram Singh']);
    expect(response.body.data[0]).toMatchObject({ email: 'aisha.sharma@pulsedesk.example', avatarUrl: null });
  });

  it('rejects duplicate emails at the database boundary', async () => {
    await expect(prisma.user.create({ data: { name: 'Duplicate agent', email: supportUsers[0].email } })).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.user.count()).toBe(6);
  });

  it('rejects noncanonical email casing at the database boundary', async () => {
    await expect(prisma.user.create({ data: { name: 'Duplicate case', email: supportUsers[0].email.toUpperCase() } })).rejects.toThrow('users_email_normalized');
    expect(await prisma.user.count()).toBe(6);
  });

  it('reseeds idempotently without overwriting profile edits, ticket descriptions, or attachments', async () => {
    await prisma.user.update({ where: { id: userId }, data: { name: 'Khushi R.', avatarUrl: 'https://example.com/avatar.png' } });
    await prisma.attachment.create({ data: { ticketId: ticket.id, fileName: 'notes.txt', storageKey: `${missingId}.txt`, mimeType: 'text/plain', fileSize: 4 } });
    await seedSupportUsers(prisma);
    await seedSupportUsers(prisma);
    expect(await prisma.user.count()).toBe(6);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toMatchObject({ name: 'Khushi R.', avatarUrl: 'https://example.com/avatar.png' });
    expect(await prisma.ticket.findUnique({ where: { id: ticket.id } })).toMatchObject(ticket);
    expect(await prisma.attachment.count({ where: { ticketId: ticket.id } })).toBe(1);
  });
});

describe('multiple ticket assignees', () => {
  it('leaves existing tickets valid with no assignees', async () => {
    const response = await request(app).get(path('assignees'));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect((await request(app).get(`/api/tickets/${ticket.id}`)).body.data).toEqual(JSON.parse(JSON.stringify(ticket)));
  });

  it('assigns multiple users and persists their profiles and assignment timestamps', async () => {
    for (const user of supportUsers.slice(0, 2)) {
      const response = await assign(user.id);
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({ ticketId: ticket.id, userId: user.id, user: { id: user.id, name: user.name } });
      expect(response.body.data.assignedAt).toBeTruthy();
    }
    const response = await request(app).get(path('assignees'));
    expect(response.body.data.map((assignment) => assignment.userId).sort()).toEqual(supportUsers.slice(0, 2).map((user) => user.id).sort());
    expect((await request(app).get(path('assignees', other.id))).body.data).toEqual([]);
  });

  it('rejects duplicate assignments, including simultaneous requests', async () => {
    const responses = await Promise.all([assign(), assign()]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409).body.error.code).toBe('ALREADY_ASSIGNED');
    expect(await prisma.ticketAssignee.count()).toBe(1);
  });

  it('removes only the assignment, preserving the ticket and user', async () => {
    await assign();
    expect((await request(app).delete(`${path('assignees')}/${userId}`)).status).toBe(200);
    expect((await request(app).get(path('assignees'))).body.data).toEqual([]);
    expect(await prisma.ticket.count()).toBe(2);
    expect(await prisma.user.count()).toBe(6);
    expect((await request(app).delete(`${path('assignees')}/${userId}`)).body.error.code).toBe('ASSIGNMENT_NOT_FOUND');
  });

  it('does not remove an assignment from another ticket', async () => {
    await assign();
    expect((await request(app).delete(`${path('assignees', other.id)}/${userId}`)).status).toBe(404);
    expect((await request(app).get(path('assignees'))).body.data).toHaveLength(1);
  });

  it('handles missing ticket and user references with consistent 404s', async () => {
    expect((await assign(missingId)).body.error.code).toBe('USER_NOT_FOUND');
    expect((await request(app).get(path('assignees', missingId))).status).toBe(404);
    expect((await request(app).post(path('assignees', missingId)).send({ userId })).body.error.code).toBe('TICKET_NOT_FOUND');
    expect((await request(app).delete(`${path('assignees')}/${missingId}`)).body.error.code).toBe('USER_NOT_FOUND');
  });

  it('rejects malformed IDs and unsupported assignment fields', async () => {
    for (const body of [{}, { userId: 'invalid' }, { userId, ticketId: other.id }]) expect((await request(app).post(path('assignees')).send(body)).status).toBe(400);
    expect((await request(app).get('/api/tickets/invalid/assignees')).status).toBe(400);
    expect((await request(app).delete(`${path('assignees')}/invalid`)).status).toBe(400);
    expect(await prisma.ticketAssignee.count()).toBe(0);
  });
});

describe('plain-text ticket comments', () => {
  it('creates a trimmed comment linked to its ticket and user and persists after GET', async () => {
    const response = await comment('  Customer confirmed the issue still occurs.  ');
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ ticketId: ticket.id, userId, content: 'Customer confirmed the issue still occurs.', user: { id: userId, name: 'Khushi Ray' } });
    expect(response.body.data.createdAt).toBeTruthy();
    expect(response.body.data.updatedAt).toBeTruthy();
    expect((await request(app).get(path('comments'))).body.data).toEqual([response.body.data]);
    expect((await request(app).get(path('comments', other.id))).body.data).toEqual([]);
  });

  it.each(['', '   \n\t ', '\u200b', 'x'.repeat(5001)])('rejects empty, invisible, or oversized comment content: %s', async (content) => {
    const response = await comment(content);
    expect(response.status).toBe(400);
    expect(response.body.error.details.content).toBeTruthy();
    expect(await prisma.comment.count()).toBe(0);
  });

  it('accepts the maximum size and stores HTML-looking comments as literal text', async () => {
    expect((await comment('x'.repeat(5000))).status).toBe(201);
    const response = await comment('<script>alert(1)</script>\nDo not run this snippet.');
    expect(response.status).toBe(201);
    expect(response.body.data.content).toBe('<script>alert(1)</script>\nDo not run this snippet.');
  });

  it('orders comments oldest first with an ID tie-breaker for equal timestamps', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const ids = [3, 1, 2].map((number) => `60000000-0000-4000-8000-${String(number).padStart(12, '0')}`);
    await prisma.comment.createMany({ data: ids.map((id) => ({ id, ticketId: ticket.id, userId, content: id, createdAt })) });
    const newer = await comment('Newest comment');
    expect((await request(app).get(path('comments'))).body.data.map((entry) => entry.id)).toEqual([...ids.sort(), newer.body.data.id]);
  });

  it('handles missing tickets, missing users, and malformed or unsupported inputs', async () => {
    expect((await comment('Details', missingId)).body.error.code).toBe('USER_NOT_FOUND');
    expect((await request(app).get(path('comments', missingId))).status).toBe(404);
    expect((await request(app).post(path('comments', missingId)).send({ userId, content: 'Details' })).body.error.code).toBe('TICKET_NOT_FOUND');
    for (const body of [{ userId }, { userId: 'invalid', content: 'Details' }, { userId, content: 'Details', author: 'spoofed' }]) expect((await request(app).post(path('comments')).send(body)).status).toBe(400);
    expect((await request(app).get('/api/tickets/invalid/comments')).status).toBe(400);
  });

  it('preserves authorship after removing an assignment and prevents deleting a referenced author', async () => {
    await assign();
    const response = await comment();
    await request(app).delete(`${path('assignees')}/${userId}`);
    expect((await request(app).get(path('comments'))).body.data).toEqual([response.body.data]);
    await expect(prisma.user.delete({ where: { id: userId } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('keeps global summary, ticket properties, and existing list pagination independent of collaboration', async () => {
    const before = (await request(app).get('/api/tickets/summary')).body;
    await assign();
    await comment();
    expect((await request(app).get('/api/tickets/summary')).body).toEqual(before);
    expect((await request(app).get(`/api/tickets/${ticket.id}`)).body.data).toEqual(JSON.parse(JSON.stringify(ticket)));
    expect((await request(app).get('/api/tickets?sort=oldest')).body.data.pagination).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
  });
});
