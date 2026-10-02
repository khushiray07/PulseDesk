import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { rm, readdir } from 'node:fs/promises';
import request from './helpers/request.js';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
let ticket, other;
const endpoint = () => `/api/tickets/${ticket.id}/attachments`;
const upload = (buffer = png, filename = 'screenshot.png', contentType = 'image/png') => request(app).post(endpoint()).attach('file', buffer, { filename, contentType });

beforeAll(() => {
  if (process.env.PULSEDESK_TEST_DATABASE_VERIFIED !== 'true' || !process.env.ATTACHMENT_STORAGE_DIR?.includes('/test-attachments/')) throw new Error('Use the isolated npm test runner.');
});
beforeEach(async () => {
  await prisma.ticket.deleteMany();
  await rm(process.env.ATTACHMENT_STORAGE_DIR, { recursive: true, force: true });
  const data = { title: 'Attachment request', description: 'Supporting files.', customerEmail: 'files@example.com', priority: 'HIGH' };
  ticket = await prisma.ticket.create({ data });
  other = await prisma.ticket.create({ data });
});
afterAll(async () => {
  await rm(process.env.ATTACHMENT_STORAGE_DIR, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('ticket attachment API', () => {
  it('uploads a detected image, persists metadata, and serves the original bytes without exposing storage paths', async () => {
    const response = await upload(png, 'screenshot.png', 'application/octet-stream');
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ ticketId: ticket.id, fileName: 'screenshot.png', mimeType: 'image/png', fileSize: png.length });
    expect(response.body.data).not.toHaveProperty('storageKey');
    const list = await request(app).get(endpoint());
    expect(list.body.data).toEqual([response.body.data]);
    const content = await request(app).get(`${endpoint()}/${response.body.data.id}/content`);
    expect(content.status).toBe(200);
    expect(content.body).toEqual(png);
    expect(content.headers['x-content-type-options']).toBe('nosniff');
    expect(content.headers['content-disposition']).toBe('inline');
    const download = await request(app).get(`${endpoint()}/${response.body.data.id}/content?download=1`);
    expect(download.headers['content-disposition']).toContain('attachment;');
  });

  it.each([[pdf, 'invoice.pdf', 'application/pdf'], [Buffer.from('Support notes\nStep 1: retry.'), 'notes.txt', 'text/plain']])('uploads a supporting %s document', async (buffer, name, mime) => {
    const response = await upload(buffer, name, mime);
    expect(response.status).toBe(201);
    const content = await request(app).get(`${endpoint()}/${response.body.data.id}/content`);
    expect(content.status).toBe(200);
    expect(content.headers['content-type']).toContain(mime);
    expect(content.headers['content-disposition']).toContain('attachment;');
  });

  it('keeps attachments linked to their own ticket', async () => {
    const uploaded = await upload();
    const foreign = `/api/tickets/${other.id}/attachments/${uploaded.body.data.id}`;
    expect((await request(app).get(`/api/tickets/${other.id}/attachments`)).body.data).toEqual([]);
    expect((await request(app).get(`${foreign}/content`)).status).toBe(404);
    expect((await request(app).delete(foreign)).status).toBe(404);
    expect((await request(app).get(endpoint())).body.data).toHaveLength(1);
  });

  it.each([
    [Buffer.from('<svg onload="alert(1)"></svg>'), 'fake.png', 'image/png'],
    [Buffer.from('MZ executable'), 'program.exe', 'application/octet-stream'],
    [Buffer.from([0xff, 0x00, 0x01]), 'binary.txt', 'text/plain'],
  ])('rejects unsupported or spoofed content: %s', async (buffer, name, mime) => {
    expect((await upload(buffer, name, mime)).status).toBe(415);
    expect(await prisma.attachment.count()).toBe(0);
  });

  it('rejects files over 5 MiB, empty uploads, and unexpected multipart fields', async () => {
    expect((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status).toBe(413);
    expect((await upload(Buffer.alloc(0))).status).toBe(400);
    expect((await request(app).post(endpoint())).status).toBe(400);
    expect((await request(app).post(endpoint()).attach('unexpected', png, 'a.png')).status).toBe(400);
    expect(await prisma.attachment.count()).toBe(0);
  });

  it('handles nonexistent tickets and malformed IDs without writing files', async () => {
    expect((await request(app).post('/api/tickets/30000000-0000-4000-8000-000000000001/attachments').attach('file', png, 'a.png')).status).toBe(404);
    expect((await request(app).get('/api/tickets/not-a-uuid/attachments')).status).toBe(400);
    expect((await request(app).get(`${endpoint()}/not-a-uuid/content`)).status).toBe(400);
    expect(await prisma.attachment.count()).toBe(0);
  });

  it('deletes both the metadata and file, and returns 404 for a repeated deletion', async () => {
    const response = await upload();
    const url = `${endpoint()}/${response.body.data.id}`;
    expect((await request(app).delete(url)).status).toBe(200);
    expect((await request(app).get(endpoint())).body.data).toEqual([]);
    expect(await readdir(process.env.ATTACHMENT_STORAGE_DIR)).toEqual([]);
    expect((await request(app).get(`${url}/content`)).status).toBe(404);
    expect((await request(app).delete(url)).status).toBe(404);
  });

  it('allows multiple files but enforces the per-ticket cap under concurrent uploads', async () => {
    const responses = await Promise.all(Array.from({ length: 11 }, (_, i) => upload(png, `${i}.png`)));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(10);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
    expect((await request(app).get(endpoint())).body.data).toHaveLength(10);
    expect(await readdir(process.env.ATTACHMENT_STORAGE_DIR)).toHaveLength(10);
  });

  it('uses generated storage keys and removes unsafe filename characters', async () => {
    const response = await upload(png, '../../screenshot.png');
    expect(response.status).toBe(201);
    expect(response.body.data.fileName).toBe('screenshot.png');
    const stored = await prisma.attachment.findUnique({ where: { id: response.body.data.id } });
    expect(stored.storageKey).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(stored.storageKey).not.toContain('screenshot');
  });

  it('preserves the ticket and existing attachment after another upload fails', async () => {
    expect((await upload()).status).toBe(201);
    expect((await upload(Buffer.from('invalid'), 'fake.png')).status).toBe(415);
    expect((await request(app).get(`/api/tickets/${ticket.id}`)).status).toBe(200);
    expect((await request(app).get(endpoint())).body.data).toHaveLength(1);
  });
});
