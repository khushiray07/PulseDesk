import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prisma } from '../server/src/utils/prisma.js';
import { attachmentStorage } from '../server/src/services/attachment-storage.js';
import { seedDemo } from '../server/prisma/demo-seed.js';
import { attachmentSpecs, demoAssignments, demoComments, demoTickets, demoUsers } from '../server/prisma/demo-fixtures.js';
import { listTickets } from '../server/src/services/ticket.service.js';

// This verifier intentionally cannot target Neon or any other remote database.
const target = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw new Error('Demo verification is local-only.');
if ((process.env.ATTACHMENT_STORAGE_DRIVER || 'local') !== 'local') throw new Error('Demo verification requires the existing local filesystem adapter.');
const hash = value => createHash('sha256').update(Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const state = async () => ({
  users: await prisma.user.findMany({ orderBy: { id: 'asc' } }), sessions: await prisma.session.findMany({ orderBy: { sid: 'asc' } }),
  tickets: await prisma.ticket.findMany({ orderBy: { id: 'asc' } }), comments: await prisma.comment.findMany({ orderBy: { id: 'asc' } }),
  assignments: await prisma.ticketAssignee.findMany({ orderBy: [{ ticketId: 'asc' }, { userId: 'asc' }] }),
  attachments: await prisma.attachment.findMany({ orderBy: { id: 'asc' } }),
});
const fixtureIds = demoTickets.map(ticket => ticket.id);
try {
  const before = await state();
  const originalFiles = new Map();
  for (const file of before.attachments) {
    try { originalFiles.set(file.storageKey, hash(await attachmentStorage.read(file.storageKey))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const first = await seedDemo(prisma, attachmentStorage);
  const after = await state();
  for (const kind of ['users', 'sessions', 'comments', 'assignments', 'attachments']) {
    const key = row => kind === 'sessions' ? row.sid : kind === 'assignments' ? `${row.ticketId}:${row.userId}` : row.id;
    const values = new Map(after[kind].map(row => [key(row), hash(row)]));
    for (const row of before[kind]) assert.equal(values.get(key(row)), hash(row), `An existing ${kind} record changed.`);
  }
  for (const ticket of before.tickets.filter(ticket => !fixtureIds.includes(ticket.id))) {
    assert.equal(hash(after.tickets.find(row => row.id === ticket.id)), hash(ticket), 'An existing non-demo ticket changed.');
  }
  for (const [key, fingerprint] of originalFiles) assert.equal(hash(await attachmentStorage.read(key)), fingerprint, 'An existing attachment file changed.');
  await seedDemo(prisma, attachmentStorage);
  assert.equal(hash(await state()), hash(after), 'The second seed changed or duplicated records.');
  const fixtures = after.tickets.filter(ticket => fixtureIds.includes(ticket.id));
  assert.equal(fixtures.length, 60);
  const counts = key => fixtures.reduce((result, ticket) => ({ ...result, [ticket[key]]: (result[ticket[key]] || 0) + 1 }), {});
  assert.deepEqual(counts('status'), { OPEN: 22, IN_PROGRESS: 20, RESOLVED: 18 });
  assert.deepEqual(counts('priority'), { HIGH: 20, MEDIUM: 22, LOW: 18 });
  const users = demoUsers.map(fixture => after.users.find(user => user.email === fixture.email) || after.users.find(user => user.email === fixture.legacyEmail));
  assert(users.every(user => user && !user.googleSubject));
  assert.equal(new Set(users.map(user => user.id)).size, 8);
  const comments = after.comments.filter(comment => demoComments.some(fixture => fixture.id === comment.id));
  assert.equal(comments.length, 48);
  assert.equal(new Set(comments.map(comment => comment.ticketId)).size, 18);
  const assignments = after.assignments.filter(assignment => demoAssignments.some(fixture => fixture.ticketId === assignment.ticketId && users[fixture.agentIndex].id === assignment.userId));
  assert.equal(assignments.length, 43);
  const multiple = fixtureIds.filter(id => assignments.filter(assignment => assignment.ticketId === id).length > 1).length;
  assert.equal(multiple, 12);
  const rich = fixtures.filter(ticket => ticket.description.startsWith('<p>')).length;
  assert.equal(rich, 24);
  const fixturePageIds = [];
  for (let page = 1; page <= 6; page++) {
    const rows = await prisma.ticket.findMany({ where: { id: { in: fixtureIds } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 10, take: 10 });
    assert.equal(rows.length, 10); fixturePageIds.push(...rows.map(row => row.id));
  }
  assert.equal(new Set(fixturePageIds).size, 60);
  const fuzzy = {};
  for (const [search, expected] of [['paymnt', 'payment'], ['pasword', 'password'], ['invocie', 'invoice'], ['notifiction', 'notification'], ['subscripton', 'subscription']]) {
    const result = await listTickets({ search, page: 1, sort: 'newest' });
    assert(result.tickets.some(ticket => fixtureIds.includes(ticket.id) && ticket.title.toLowerCase().includes(expected)), `No useful ${search} match.`);
    fuzzy[search] = result.pagination.total;
  }
  for (const file of attachmentSpecs) {
    const metadata = after.attachments.find(row => row.id === file.id);
    assert(metadata);
    const expected = await readFile(new URL(`../server/prisma/demo-assets/${file.fileName}`, import.meta.url));
    assert.equal(hash(await attachmentStorage.read(metadata.storageKey)), hash(expected));
    assert.equal(metadata.fileSize, expected.length);
  }
  const all = await listTickets({ page: 1, sort: 'newest' });
  console.log(JSON.stringify({ target: 'local development only', fixtureTickets: fixtures.length, statuses: counts('status'), priorities: counts('priority'),
    demoAgents: users.length, totalPreservedAndDemoUsers: after.users.length, preservedGoogleUsers: before.users.filter(user => user.googleSubject).length,
    preservedSessions: before.sessions.length, fixtureComments: comments.length, commentedFixtureTickets: 18, fixtureAssignmentPairs: assignments.length,
    multiAssigneeFixtureTickets: multiple, richTextTickets: rich, attachmentFixturesWithVerifiedBytes: attachmentSpecs.length,
    dateRange: [fixtures.map(ticket => ticket.createdAt.toISOString()).sort()[0], fixtures.map(ticket => ticket.createdAt.toISOString()).sort().at(-1)],
    fixturePagination: '6 pages, 10 tickets each, 60 distinct IDs', fullQueue: all.pagination,
    fuzzyMatchCounts: fuzzy, firstSeed: first, secondSeed: 'No changed or duplicate records', existingUserAndSessionRecords: 'Unchanged', existingNonDemoTicketsAndRelationships: 'Unchanged' }, null, 2));
} finally { await prisma.$disconnect(); }
