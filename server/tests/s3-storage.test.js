import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createS3Storage } from '../src/services/attachment-storage.js';

const key = '30000000-0000-4000-8000-000000000001.txt';
const objects = new Map();
const requests = [];
let server, env;
beforeAll(async () => {
  server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    requests.push({ method: req.method, path, authorization: req.headers.authorization, condition: req.headers['if-none-match'] });
    if (req.method === 'PUT') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (objects.has(path) && req.headers['if-none-match'] === '*') {
        res.writeHead(412, { 'Content-Type': 'application/xml' });
        return res.end('<Error><Code>PreconditionFailed</Code><Message>Already exists</Message></Error>');
      }
      objects.set(path, Buffer.concat(chunks));
      res.writeHead(200, { ETag: '"test-etag"' }); return res.end();
    }
    if (req.method === 'DELETE') { objects.delete(path); res.writeHead(204); return res.end(); }
    if (objects.has(path)) { res.writeHead(200); return res.end(objects.get(path)); }
    res.writeHead(404, { 'Content-Type': 'application/xml' });
    res.end('<Error><Code>NoSuchKey</Code><Message>Not found</Message></Error>');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  env = { NODE_ENV: 'test', S3_ENDPOINT: `http://127.0.0.1:${server.address().port}`, S3_REGION: 'auto',
    S3_BUCKET: 'private-test-bucket', S3_ACCESS_KEY_ID: 'fake-test-key', S3_SECRET_ACCESS_KEY: 'fake-test-secret' };
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); });

describe('S3-compatible attachment storage', () => {
  it('signs private writes, preserves bytes across new adapter instances, and deletes idempotently', async () => {
    const first = createS3Storage(env);
    const bytes = Buffer.from([0, 1, 2, 128, 255]);
    await first.write(key, bytes);
    const restarted = createS3Storage(env);
    expect(await restarted.read(key)).toEqual(bytes);
    expect(requests[0]).toMatchObject({ method: 'PUT', path: `/private-test-bucket/${key}`, condition: '*' });
    expect(requests.every(req => req.authorization.startsWith('AWS4-HMAC-SHA256'))).toBe(true);
    await expect(first.write(key, Buffer.from('replacement'))).rejects.toMatchObject({ name: 'PreconditionFailed' });
    expect(await restarted.read(key)).toEqual(bytes);
    await first.remove(key); await restarted.remove(key);
    await expect(restarted.read(key)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it.each(['../private.txt', 'https://attacker.example/file', 'not-a-key.txt'])('rejects invalid keys before contacting storage: %j', async (invalid) => {
    const storage = createS3Storage(env);
    const count = requests.length;
    await expect(storage.write(invalid, Buffer.from('test'))).rejects.toThrow('Invalid internal storage key');
    await expect(storage.read(invalid)).rejects.toThrow('Invalid internal storage key');
    await expect(storage.remove(invalid)).rejects.toThrow('Invalid internal storage key');
    expect(requests).toHaveLength(count);
  });
  it.each(['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'])('fails early when required configuration is absent: %s', (name) => {
    expect(() => createS3Storage({ ...env, [name]: '' })).toThrow(name);
  });
  it('rejects HTTP endpoints in production and credentials embedded in endpoint URLs', () => {
    expect(() => createS3Storage({ ...env, NODE_ENV: 'production' })).toThrow('HTTPS');
    expect(() => createS3Storage({ ...env, S3_ENDPOINT: 'https://secret@storage.example.com' })).toThrow('credentials');
  });
});
