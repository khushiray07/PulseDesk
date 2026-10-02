import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from './helpers/request.js';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

const idFor = (number) => `40000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const fixtures = [
  ['Password reset issue', 'alex@orchid.example', 'OPEN', 'HIGH'],
  ['Password reset on mobile', 'mobile@mobile.example', 'OPEN', 'LOW'],
  ['Password reset closed', 'closed@finished.example', 'RESOLVED', 'HIGH'],
  ['Password reset processing', 'working@progress.example', 'IN_PROGRESS', 'MEDIUM'],
  ['Payment failed', 'billing@billing.example', 'OPEN', 'HIGH'],
  ['Payment failed yesterday', 'paid@orders.example', 'RESOLVED', 'LOW'],
  ['Invoice delivery missing', 'support@support.example', 'OPEN', 'MEDIUM'],
].map(([title, customerEmail, status, priority], i) => ({
  id: idFor(i + 1), title, customerEmail, status, priority,
  description: 'A customer needs assistance with this ticket.',
  createdAt: new Date(Date.UTC(2024, 0, i + 1)),
  updatedAt: new Date(Date.UTC(2024, 0, i + 1)),
}));

beforeAll(() => {
  if (process.env.PULSEDESK_TEST_DATABASE_VERIFIED !== 'true') throw new Error('Run tests with npm test to verify database isolation.');
});
beforeEach(async () => {
  await prisma.ticket.deleteMany();
  await prisma.ticket.createMany({ data: fixtures });
});
afterAll(async () => { await prisma.$disconnect(); });

describe('PostgreSQL fuzzy ticket search', () => {
  it.each([
    ['pasword', [1, 2, 3, 4]],
    ['paymnt', [5, 6]],
    ['  PASWORD  ', [1, 2, 3, 4]],
  ])('finds typo-tolerant title matches for %s', async (search, ids) => {
    const response = await request(app).get('/api/tickets').query({ search, sort: 'oldest' });
    expect(response.status).toBe(200);
    expect(response.body.data.tickets.map((ticket) => ticket.id)).toEqual(ids.map(idFor));
    expect(response.body.data.pagination.total).toBe(ids.length);
  });

  it('preserves exact title and substring matches and the ticket response shape', async () => {
    for (const search of ['Password reset issue', 'reset issue']) {
      const response = await request(app).get('/api/tickets').query({ search });
      expect(response.status).toBe(200);
      expect(response.body.data.tickets[0]).toMatchObject({ id: idFor(1), title: 'Password reset issue' });
      expect(Object.keys(response.body.data.tickets[0]).sort()).toEqual([
        'id', 'title', 'description', 'customerEmail', 'priority', 'status', 'createdAt', 'updatedAt',
      ].sort());
    }
  });

  it('keeps exact email lookup precise even when a neighboring address is similar', async () => {
    await prisma.ticket.create({ data: { ...fixtures[0], id: idFor(8), title: 'Another customer request', customerEmail: 'alexa@orchid.example' } });
    const response = await request(app).get('/api/tickets').query({ search: 'ALEX@ORCHID.EXAMPLE' });
    expect(response.body.data.tickets.map((ticket) => ticket.id)).toEqual([idFor(1)]);
    expect(response.body.data.pagination.total).toBe(1);
  });

  it('finds a misspelled full customer email when there is no literal match', async () => {
    const response = await request(app).get('/api/tickets').query({ search: 'alxe@orchid.example' });
    expect(response.status).toBe(200);
    expect(response.body.data.tickets[0].id).toBe(idFor(1));
  });

  it('finds misspelled customer email words', async () => {
    const response = await request(app).get('/api/tickets').query({ search: 'suport' });
    expect(response.status).toBe(200);
    expect(response.body.data.tickets.map((ticket) => ticket.id)).toEqual([idFor(7)]);
  });

  it('orders exact, substring and fuzzy matches ahead of their creation dates', async () => {
    await prisma.ticket.createMany({ data: [
      { ...fixtures[0], id: idFor(8), title: 'pasword', createdAt: new Date('2020-01-01') },
      { ...fixtures[0], id: idFor(9), title: 'A pasword report', createdAt: new Date('2021-01-01') },
    ] });
    const response = await request(app).get('/api/tickets').query({ search: 'pasword', sort: 'newest' });
    expect(response.body.data.tickets.slice(0, 2).map((ticket) => ticket.id)).toEqual([idFor(8), idFor(9)]);
    expect(response.body.data.tickets.slice(2).map((ticket) => ticket.id)).toEqual([4, 3, 2, 1].map(idFor));
  });

  it('combines fuzzy search with individual and combined status/priority filters', async () => {
    const cases = [
      [{ status: 'OPEN' }, [1, 2]],
      [{ priority: 'HIGH' }, [1, 3]],
      [{ status: 'OPEN', priority: 'HIGH' }, [1]],
      [{ status: 'RESOLVED', priority: 'LOW' }, []],
    ];
    for (const [filters, ids] of cases) {
      const response = await request(app).get('/api/tickets').query({ search: 'pasword', sort: 'oldest', ...filters });
      expect(response.status).toBe(200);
      expect(response.body.data.tickets.map((ticket) => ticket.id)).toEqual(ids.map(idFor));
      expect(response.body.data.pagination.total).toBe(ids.length);
    }
  });

  it('applies both date sort directions to equally similar fuzzy matches', async () => {
    for (const [sort, ids] of [['oldest', [1, 2, 3, 4]], ['newest', [4, 3, 2, 1]]]) {
      const response = await request(app).get('/api/tickets').query({ search: 'pasword', sort });
      expect(response.body.data.tickets.map((ticket) => ticket.id)).toEqual(ids.map(idFor));
    }
  });

  it('paginates the filtered fuzzy matches with consistent metadata and no duplicates', async () => {
    const extra = Array.from({ length: 25 }, (_, i) => ({
      ...fixtures[0], id: idFor(i + 10), title: `Password assistance request ${i}`,
      createdAt: new Date(Date.UTC(2025, 0, i + 1)),
    }));
    await prisma.ticket.createMany({ data: extra });
    const ids = [];
    for (let page = 1; page <= 4; page++) {
      const response = await request(app).get('/api/tickets').query({ search: 'pasword', status: 'OPEN', priority: 'HIGH', sort: 'oldest', page: String(page) });
      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toEqual({ page, limit: 10, total: 26, totalPages: 3 });
      expect(response.body.data.tickets).toHaveLength([10, 10, 6, 0][page - 1]);
      ids.push(...response.body.data.tickets.map((ticket) => ticket.id));
    }
    expect(ids).toEqual([idFor(1), ...extra.map((ticket) => ticket.id)]);
    expect(new Set(ids).size).toBe(26);
  });

  it('returns no fuzzy matches for unrelated, short or punctuation-only searches', async () => {
    for (const search of ['zzzzzzzz', 'pw', '%', '_']) {
      const response = await request(app).get('/api/tickets').query({ search });
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ tickets: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    }
    await prisma.ticket.create({ data: { ...fixtures[0], id: idFor(8), title: 'pw' } });
    const literal = await request(app).get('/api/tickets').query({ search: 'pw' });
    expect(literal.body.data.tickets.map((ticket) => ticket.id)).toEqual([idFor(8)]);
  });

  it('treats SQL-looking search input as data', async () => {
    const response = await request(app).get('/api/tickets').query({ search: "' OR TRUE; DROP TABLE tickets; --" });
    expect(response.status).toBe(200);
    expect(response.body.data.pagination.total).toBe(0);
    expect(await prisma.ticket.count()).toBe(7);
  });
});
