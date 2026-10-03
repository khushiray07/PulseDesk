import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { prisma } from '../src/utils/prisma.js';
import { seedDemo } from '../prisma/demo-seed.js';
import { assertDemoTarget } from '../prisma/demo.seed.js';
import { attachmentSpecs, demoComments, demoTickets, demoUsers, legacyTicketFields } from '../prisma/demo-fixtures.js';
import { seedSupportUsers } from '../prisma/users.seed.js';
import { attachmentStorage } from '../src/services/attachment-storage.js';
import { readAttachment } from '../src/services/attachment.service.js';
import { getSummary, listTickets } from '../src/services/ticket.service.js';
import { createTicketSchema } from '../src/validators/ticket.validator.js';
import { normalizeDescription } from '../src/utils/description.js';

beforeAll(() => {
  if (process.env.PULSEDESK_TEST_DATABASE_VERIFIED !== 'true' || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Use the guarded test database.');
});
beforeEach(async () => { await prisma.session.deleteMany(); await prisma.ticket.deleteMany(); await prisma.user.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });
const snapshot = async () => ({
  tickets: await prisma.ticket.findMany({ orderBy: { id: 'asc' } }),
  users: await prisma.user.findMany({ orderBy: { id: 'asc' } }),
  comments: await prisma.comment.findMany({ orderBy: { id: 'asc' } }),
  assignments: await prisma.ticketAssignee.findMany({ orderBy: [{ ticketId: 'asc' }, { userId: 'asc' }] }),
  attachments: await prisma.attachment.findMany({ orderBy: { id: 'asc' } }),
  sessions: await prisma.session.findMany({ orderBy: { sid: 'asc' } }),
});

describe('optional production demo fixtures', () => {
  it('creates the complete, validated dataset with realistic content and stable dates', async () => {
    await seedDemo(prisma, attachmentStorage);
    expect(await getSummary()).toEqual({ total: 60, open: 22, inProgress: 20, resolved: 18 });
    const rows = await prisma.ticket.findMany({ include: { comments: true, assignees: true, attachments: true } });
    expect(Object.fromEntries((await prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } })).map(group => [group.priority, group._count._all]))).toEqual({ HIGH: 20, MEDIUM: 22, LOW: 18 });
    expect(await prisma.user.count()).toBe(8);
    expect(await prisma.user.count({ where: { googleSubject: { not: null } } })).toBe(0);
    expect(await prisma.comment.count()).toBe(48);
    expect(await prisma.ticketAssignee.count()).toBe(43);
    expect(rows.filter(ticket => ticket.comments.length)).toHaveLength(18);
    expect(rows.filter(ticket => ticket.assignees.length > 1)).toHaveLength(12);
    expect(rows.some(ticket => ticket.status === 'OPEN' && !ticket.assignees.length)).toBe(true);
    expect(rows.filter(ticket => ticket.description.startsWith('<p>'))).toHaveLength(24);
    expect(rows.filter(ticket => ticket.attachments.length)).toHaveLength(8);
    expect(new Set(rows.map(ticket => ticket.title)).size).toBe(60);
    expect(new Set(demoComments.map(comment => comment.content)).size).toBe(48);
    expect(new Set(rows.map(ticket => ticket.createdAt.toISOString().slice(0, 10))).size).toBe(30);
    for (const ticket of rows) {
      expect(ticket.customerEmail.endsWith('@example.com')).toBe(true);
      expect(normalizeDescription(ticket.description)).toBe(ticket.description);
      const { title, customerEmail, description, priority } = ticket;
      expect(createTicketSchema.safeParse({ title, customerEmail, description, priority }).success).toBe(true);
      expect(ticket.updatedAt >= ticket.createdAt).toBe(true);
      if (ticket.comments.length || ticket.assignees.length || ticket.status !== 'OPEN') expect(ticket.updatedAt > ticket.createdAt).toBe(true);
      if (ticket.comments.length) expect(ticket.comments.length).toBeLessThanOrEqual(4);
      if (ticket.attachments.length) expect(ticket.description).toContain('temporary-storage limitation');
    }
    for (const file of attachmentSpecs) {
      const result = await readAttachment(file.ticketId, file.id);
      expect(result.buffer.length).toBe(result.attachment.fileSize);
      expect(result.buffer.length).toBeGreaterThan(100);
    }
  });

  it('uses the actual backend queries for six complete pages, sorting and typo searches with filters', async () => {
    await seedDemo(prisma, attachmentStorage);
    const ids = [];
    for (let page = 1; page <= 6; page++) {
      const result = await listTickets({ page, sort: 'newest' });
      expect(result.pagination).toEqual({ page, limit: 10, total: 60, totalPages: 6 });
      expect(result.tickets).toHaveLength(10);
      ids.push(...result.tickets.map(ticket => ticket.id));
    }
    expect(new Set(ids).size).toBe(60);
    expect((await listTickets({ page: 7, sort: 'newest' })).tickets).toEqual([]);
    const oldest = await listTickets({ page: 1, sort: 'oldest' });
    expect(oldest.tickets.map(ticket => ticket.id)).toEqual(ids.slice(-10).reverse());
    for (const [search, word] of [['paymnt', 'payment'], ['pasword', 'password'], ['invocie', 'invoice'], ['notifiction', 'notification'], ['subscripton', 'subscription']]) {
      const result = await listTickets({ search, page: 1, sort: 'newest' });
      expect(result.tickets.some(ticket => ticket.title.toLowerCase().includes(word))).toBe(true);
      expect(result.pagination.total).toBeGreaterThan(0);
    }
    const filtered = await listTickets({ search: 'paymnt', status: 'OPEN', priority: 'HIGH', page: 1, sort: 'oldest' });
    expect(filtered.tickets.length).toBeGreaterThan(0);
    expect(filtered.tickets.every(ticket => ticket.status === 'OPEN' && ticket.priority === 'HIGH')).toBe(true);
    const exact = await listTickets({ search: demoTickets[0].customerEmail, page: 1, sort: 'newest' });
    expect(exact.tickets.map(ticket => ticket.id)).toEqual([demoTickets[0].id]);
  });

  it('repeats without duplicate rows or changes to dates, bytes or existing fixture edits', async () => {
    await seedDemo(prisma, attachmentStorage);
    await prisma.ticket.update({ where: { id: demoTickets[0].id }, data: { description: 'Agent edited the investigation notes.', priority: 'LOW' } });
    await prisma.user.update({ where: { id: demoUsers[0].id }, data: { name: 'Aisha S.', avatarUrl: 'https://example.com/avatar.png' } });
    await prisma.comment.update({ where: { id: demoComments[0].id }, data: { content: 'Agent revised this fixture comment.' } });
    const before = await snapshot();
    const result = await seedDemo(prisma, attachmentStorage);
    expect(result.preservedEditedTickets).toBe(1);
    expect(await snapshot()).toEqual(before);
    const bytes = await attachmentStorage.read(`${attachmentSpecs[0].id}.png`);
    await seedDemo(prisma, attachmentStorage);
    expect(await attachmentStorage.read(`${attachmentSpecs[0].id}.png`)).toEqual(bytes);
    expect(await snapshot()).toEqual(before);
  });

  it('upgrades unchanged legacy fields and preserves users, real accounts/sessions and existing relationships', async () => {
    await seedSupportUsers(prisma);
    const existingUsers = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    for (let index = 0; index < 30; index++) {
      const createdAt = new Date('2026-09-20T00:00:00Z');
      await prisma.ticket.create({ data: { id: demoTickets[index].id, ...legacyTicketFields(index), createdAt, updatedAt: new Date(createdAt.getTime() + (index % 3) * 20 * 60 * 1000) } });
    }
    await prisma.ticket.update({ where: { id: demoTickets[5].id }, data: { description: 'Keep these agent notes on the password reset.' } });
    const real = await prisma.user.create({ data: { name: 'Existing authenticated agent', email: 'existing.agent@example.com', googleSubject: 'existing-verified-subject' } });
    const realTicket = await prisma.ticket.create({ data: { title: 'Keep the existing customer request', description: 'Existing customer notes.', customerEmail: 'existing.customer@example.com', priority: 'HIGH' } });
    const session = await prisma.session.create({ data: { sid: 'preserved-demo-test-session', sess: { userId: real.id }, expire: new Date('2027-01-01T00:00:00Z') } });
    const comment = await prisma.comment.create({ data: { ticketId: demoTickets[0].id, userId: real.id, content: 'Existing authored support comment.' } });
    const assignment = await prisma.ticketAssignee.create({ data: { ticketId: demoTickets[0].id, userId: real.id } });
    const result = await seedDemo(prisma, attachmentStorage);
    expect(result).toEqual({ upgradedLegacyTickets: 29, preservedEditedTickets: 1 });
    expect(await prisma.ticket.count()).toBe(61);
    expect(await prisma.ticket.findUnique({ where: { id: realTicket.id } })).toEqual(realTicket);
    expect(await prisma.ticket.findUnique({ where: { id: demoTickets[5].id } })).toMatchObject({ description: 'Keep these agent notes on the password reset.' });
    expect(await prisma.user.findMany({ where: { id: { in: existingUsers.map(user => user.id) } }, orderBy: { id: 'asc' } })).toEqual(existingUsers);
    expect(await prisma.user.findUnique({ where: { id: real.id } })).toEqual(real);
    expect(await prisma.session.findUnique({ where: { sid: session.sid } })).toEqual(session);
    expect(await prisma.comment.findUnique({ where: { id: comment.id } })).toEqual(comment);
    expect(await prisma.ticketAssignee.findUnique({ where: { ticketId_userId: { ticketId: assignment.ticketId, userId: assignment.userId } } })).toEqual(assignment);
  });

  it.each([demoUsers[0].email, demoUsers[0].legacyEmail])('refuses to use a Google-linked demo email without changing the account: %s', async email => {
    const real = await prisma.user.create({ data: { email, name: 'Verified account', googleSubject: 'verified-account-subject' } });
    await expect(seedDemo(prisma, attachmentStorage)).rejects.toThrow('Google-linked');
    expect(await prisma.user.findMany()).toEqual([real]);
    expect(await prisma.ticket.count()).toBe(0);
  });

  it('refuses unrelated ID collisions without touching the existing customer ticket', async () => {
    const ticket = await prisma.ticket.create({ data: { id: demoTickets[0].id, title: 'Existing customer data', description: 'Do not modify this record.', customerEmail: 'unrelated@example.com', priority: 'LOW' } });
    await expect(seedDemo(prisma, attachmentStorage)).rejects.toThrow('unrelated record');
    expect(await prisma.ticket.findMany()).toEqual([ticket]);
    expect(await prisma.user.count()).toBe(0);
  });

  it('never creates attachment metadata when the storage write fails', async () => {
    const unavailable = { read: async () => { throw Object.assign(new Error('Missing'), { code: 'ENOENT' }); }, write: async () => { throw new Error('Storage unavailable'); } };
    await expect(seedDemo(prisma, unavailable)).rejects.toThrow('Storage unavailable');
    expect(await prisma.attachment.count()).toBe(0);
    expect(await prisma.ticket.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it('refuses different stored bytes and repairs only missing fixture bytes on rerun', async () => {
    await expect(seedDemo(prisma, { read: async () => Buffer.from('Different existing content') })).rejects.toThrow('different content');
    expect(await prisma.attachment.count()).toBe(0);
    await seedDemo(prisma, attachmentStorage);
    const key = `${attachmentSpecs[0].id}.png`;
    const bytes = await attachmentStorage.read(key);
    await attachmentStorage.remove(key);
    await seedDemo(prisma, attachmentStorage);
    expect(await attachmentStorage.read(key)).toEqual(bytes);
    expect(await prisma.attachment.count()).toBe(8);
  });

  it('guards remote seeding and prevents writing Render temporary files from a workstation', () => {
    const local = { DATABASE_URL: 'postgresql://127.0.0.1/demo_local' };
    const remote = { DATABASE_URL: 'postgresql://ep-example.neon.tech/demo', ATTACHMENT_STORAGE_DRIVER: 'temporary' };
    expect(() => assertDemoTarget(local, [])).not.toThrow();
    expect(() => assertDemoTarget(remote, [])).toThrow('--production');
    expect(() => assertDemoTarget(remote, ['--production'])).toThrow('inside the Render web service');
    expect(() => assertDemoTarget({ ...remote, RENDER_SERVICE_ID: 'test-service' }, ['--production'])).not.toThrow();
    expect(() => assertDemoTarget({ ...remote, ATTACHMENT_STORAGE_DRIVER: 's3' }, ['--production'])).not.toThrow();
  });
});
