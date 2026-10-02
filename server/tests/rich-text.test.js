import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from './helpers/request.js';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

const ticket = { title: 'Formatted issue', customerEmail: 'format@example.com', priority: 'MEDIUM' };
beforeAll(() => { if (process.env.PULSEDESK_TEST_DATABASE_VERIFIED !== 'true') throw new Error('Use npm test.'); });
beforeEach(async () => { await prisma.ticket.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('safe rich-text ticket descriptions', () => {
  it.each([undefined, '', '   ', '<p></p>', '<p><br></p>', '<p>&nbsp; &#8203;</p>', '<script>alert(1)</script>', '<img src="data:image/png;base64,AAA">'])('rejects empty description content: %s', async (description) => {
    const response = await request(app).post('/api/tickets').send({ ...ticket, description });
    expect(response.status).toBe(400);
    expect(response.body.error.details.description).toBeTruthy();
    expect(await prisma.ticket.count()).toBe(0);
  });

  it('persists supported formatting across create and reload', async () => {
    const description = '<p><strong>Error</strong> after <em>login</em>.</p><ol><li><p>Retry</p></li></ol><ul><li><p>Check <code>request_id</code></p></li></ul><pre><code>status = 500</code></pre>';
    const created = await request(app).post('/api/tickets').send({ ...ticket, description });
    expect(created.status).toBe(201);
    expect(created.body.data.description).toBe(description);
    const reloaded = await request(app).get(`/api/tickets/${created.body.data.id}`);
    expect(reloaded.body.data.description).toBe(description);
  });

  it('preserves legacy plain text including comparisons and line breaks', async () => {
    const description = 'Customer sees 2 < 3 & 5 > 4.\nPlease retry.';
    const created = await request(app).post('/api/tickets').send({ ...ticket, description });
    expect(created.status).toBe(201);
    expect(created.body.data.description).toBe(description);
    expect((await request(app).get(`/api/tickets/${created.body.data.id}`)).body.data.description).toBe(description);
  });

  it('removes scripts, event handlers, styles, embeds, and inline image data', async () => {
    const description = '<p onclick="alert(1)" style="color:red">Safe <strong>details</strong></p><script>alert(1)</script><style>body{display:none}</style><iframe src="https://example.com"></iframe><img src="data:image/png;base64,AAA" onerror="alert(1)"><svg onload="alert(1)"></svg>';
    const created = await request(app).post('/api/tickets').send({ ...ticket, description });
    expect(created.status).toBe(201);
    expect(created.body.data.description).toBe('<p>Safe <strong>details</strong></p>');
  });

  it('restricts links to safe schemes and adds safe new-tab attributes', async () => {
    const created = await request(app).post('/api/tickets').send({ ...ticket, description: '<p><a href="https://example.com/help">Help</a> <a href="javascript:alert(1)">Bad</a> <a href="//evil.example">Relative</a> <a href="data:text/html,bad">Data</a></p>' });
    expect(created.status).toBe(201);
    expect(created.body.data.description).toContain('href="https://example.com/help" target="_blank" rel="noopener noreferrer"');
    expect(created.body.data.description).not.toMatch(/javascript:|data:|evil\.example/);
  });

  it('rejects excessive HTML and excessive visible text', async () => {
    for (const description of ['a'.repeat(10001), `<p>${'a'.repeat(50001)}</p>`]) {
      expect((await request(app).post('/api/tickets').send({ ...ticket, description })).status).toBe(400);
    }
  });

  it('edits descriptions safely while preserving status, priority, and creation time', async () => {
    const created = await request(app).post('/api/tickets').send({ ...ticket, description: 'Original plain text' });
    const url = `/api/tickets/${created.body.data.id}`;
    const updated = await request(app).patch(url).send({ description: '<p><strong>Updated</strong> details.</p><script>bad()</script>' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ description: '<p><strong>Updated</strong> details.</p>', status: 'OPEN', priority: 'MEDIUM', createdAt: created.body.data.createdAt });
    expect((await request(app).get(url)).body.data.description).toBe(updated.body.data.description);
    expect((await request(app).patch(url).send({ description: '<p></p>' })).status).toBe(400);
    expect((await request(app).get(url)).body.data.description).toBe(updated.body.data.description);
  });
});
