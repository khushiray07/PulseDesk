import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from './helpers/request.js';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
const priorities = ['LOW', 'MEDIUM', 'HIGH'];
const fixtures = Array.from({ length: 32 }, (_, i) => ({
  id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  title: `${i % 2 ? 'Account access' : 'Payment request'} ${i}`,
  description: 'A customer needs help with this request.',
  customerEmail: `customer${i}@example.com`,
  status: statuses[i % 3], priority: priorities[Math.floor(i / 3) % 3],
  createdAt: new Date(Date.UTC(2020, 0, i + 1)),
  updatedAt: new Date(Date.UTC(2020, 0, i + 1)),
}));
const validTicket = { title: 'Checkout is unavailable', description: 'The payment screen does not respond.', customerEmail: 'customer@example.com', priority: 'HIGH' };

beforeAll(() => {
  if (process.env.PULSEDESK_TEST_DATABASE_VERIFIED !== 'true') throw new Error('Run tests with npm test to verify database isolation.');
});
beforeEach(async () => {
  await prisma.ticket.deleteMany();
  await prisma.ticket.createMany({ data: fixtures });
});
afterAll(async () => { await prisma.$disconnect(); });

describe('ticket API with PostgreSQL', () => {
  it('rejects invalid email and does not insert a ticket', async () => {
    const response = await request(app).post('/api/tickets').send({ ...validTicket, customerEmail: 'not-an-email' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.customerEmail).toContain('email');
    expect(await prisma.ticket.count()).toBe(32);
  });

  it('creates a trimmed ticket with generated ID, OPEN status and timestamps', async () => {
    const response = await request(app).post('/api/tickets').send({ ...validTicket, title: '  Checkout is unavailable  ' });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ title: validTicket.title, status: 'OPEN', priority: 'HIGH' });
    const saved = await request(app).get(`/api/tickets/${response.body.data.id}`);
    expect(saved.body.data).toEqual(response.body.data);
    expect(saved.body.data.createdAt).toBeTruthy();
    expect(saved.body.data.updatedAt).toBeTruthy();
  });

  it.each([
    { title: 'a'.repeat(121) }, { title: '   ' }, { description: ' \n ' }, { priority: 'URGENT' }, { priority: undefined }, { status: 'RESOLVED' },
  ])('rejects invalid or unsupported create fields: %j', async (override) => {
    const response = await request(app).post('/api/tickets').send({ ...validTicket, ...override });
    expect(response.status).toBe(400);
  });

  it('combines status, priority, title search, sorting and pagination in the database', async () => {
    const response = await request(app).get('/api/tickets').query({ status: 'OPEN', priority: 'HIGH', search: 'PAYMENT', sort: 'oldest', page: '1' });
    expect(response.status).toBe(200);
    const expected = fixtures.filter((ticket) => ticket.status === 'OPEN' && ticket.priority === 'HIGH' && ticket.title.startsWith('Payment'));
    expect(response.body.data.tickets.map((ticket) => ticket.id)).toEqual(expected.map((ticket) => ticket.id));
    expect(response.body.data.pagination.total).toBe(expected.length);
  });

  it('searches by customer email case-insensitively', async () => {
    const response = await request(app).get('/api/tickets').query({ search: '  CUSTOMER7@EXAMPLE.COM  ' });
    expect(response.body.data.tickets.map((ticket) => ticket.id)).toEqual([fixtures[7].id]);
  });

  it('treats percent, underscore and backslash as literal search characters', async () => {
    await prisma.ticket.create({ data: { ...validTicket, title: 'Save 50% on customer_plan\\test' } });
    for (const search of ['50%', 'customer_plan', '\\test']) {
      const response = await request(app).get('/api/tickets').query({ search });
      expect(response.body.data.pagination.total).toBe(1);
      expect(response.body.data.tickets[0].title).toBe('Save 50% on customer_plan\\test');
    }
    expect((await request(app).get('/api/tickets').query({ search: '%' })).body.data.pagination.total).toBe(1);
  });

  it('returns 10 tickets per page in stable newest order without duplicates', async () => {
    const first = await request(app).get('/api/tickets?page=1');
    const second = await request(app).get('/api/tickets?page=2');
    expect(first.body.data.pagination).toEqual({ page: 1, limit: 10, total: 32, totalPages: 4 });
    expect(first.body.data.tickets.map((ticket) => ticket.id)).toEqual(fixtures.slice(-10).reverse().map((ticket) => ticket.id));
    const ids = [...first.body.data.tickets, ...second.body.data.tickets].map((ticket) => ticket.id);
    expect(new Set(ids).size).toBe(20);
  });

  it('returns an empty result with accurate metadata for no matches and out-of-range pages', async () => {
    const empty = await request(app).get('/api/tickets?search=unfindable');
    expect(empty.body.data.pagination).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    expect(empty.body.data.tickets).toEqual([]);
    const distant = await request(app).get('/api/tickets?page=99');
    expect(distant.body.data.pagination.total).toBe(32);
    expect(distant.body.data.tickets).toEqual([]);
  });

  it('paginates deterministically when tickets have identical creation timestamps', async () => {
    await prisma.ticket.updateMany({ data: { createdAt: new Date('2020-01-01T00:00:00Z') } });
    const first = await request(app).get('/api/tickets?sort=oldest&page=1');
    const second = await request(app).get('/api/tickets?sort=oldest&page=2');
    expect(first.body.data.tickets.map((ticket) => ticket.id)).toEqual(fixtures.slice(0, 10).map((ticket) => ticket.id));
    expect(second.body.data.tickets.map((ticket) => ticket.id)).toEqual(fixtures.slice(10, 20).map((ticket) => ticket.id));
  });

  it('persists a status/priority update and changes updatedAt without altering createdAt', async () => {
    const id = fixtures[0].id;
    const update = await request(app).patch(`/api/tickets/${id}`).send({ status: 'RESOLVED', priority: 'HIGH' });
    expect(update.status).toBe(200);
    const saved = await request(app).get(`/api/tickets/${id}`);
    expect(saved.body.data).toMatchObject({ status: 'RESOLVED', priority: 'HIGH', createdAt: fixtures[0].createdAt.toISOString() });
    expect(new Date(saved.body.data.updatedAt).getTime()).toBeGreaterThan(fixtures[0].updatedAt.getTime());
  });

  it.each([{}, { title: 'Changed title' }, { status: 'CLOSED' }, { priority: 'URGENT' }])('rejects invalid update: %j', async (body) => {
    const response = await request(app).patch(`/api/tickets/${fixtures[0].id}`).send(body);
    expect(response.status).toBe(400);
  });

  it('keeps global summary independent of list filters', async () => {
    const before = await request(app).get('/api/tickets/summary');
    await request(app).get('/api/tickets?status=OPEN&priority=HIGH&search=Payment');
    const after = await request(app).get('/api/tickets/summary');
    expect(after.body).toEqual(before.body);
    expect(after.body.data).toEqual({ total: 32, open: 11, inProgress: 11, resolved: 10 });
  });

  it('reflects creation and updates in global counts', async () => {
    const created = await request(app).post('/api/tickets').send(validTicket);
    await request(app).patch(`/api/tickets/${created.body.data.id}`).send({ status: 'RESOLVED' });
    const summary = await request(app).get('/api/tickets/summary');
    expect(summary.body.data).toEqual({ total: 33, open: 11, inProgress: 11, resolved: 11 });
  });

  it.each(['page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=214748366', 'status=CLOSED', 'priority=URGENT', 'sort=invalid', 'limit=20', 'page=1&page=2'])('rejects invalid list query: %s', async (query) => {
    expect((await request(app).get(`/api/tickets?${query}`)).status).toBe(400);
  });

  it('returns consistent 404 and malformed-ID errors', async () => {
    const id = '30000000-0000-4000-8000-000000000001';
    expect((await request(app).get(`/api/tickets/${id}`)).status).toBe(404);
    expect((await request(app).patch(`/api/tickets/${id}`).send({ status: 'OPEN' })).status).toBe(404);
    expect((await request(app).get('/api/tickets/not-a-uuid')).status).toBe(400);
    const missing = await request(app).get('/api/no-such-route');
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('returns a JSON error for malformed JSON', async () => {
    const response = await request(app).post('/api/tickets').set('Content-Type', 'application/json').send('{broken');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });
});
