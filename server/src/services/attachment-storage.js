import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const defaultDirectory = fileURLToPath(new URL('../../../.local/attachments/', import.meta.url));
const driver = process.env.ATTACHMENT_STORAGE_DRIVER || 'local';
if (!['local', 'temporary', 's3'].includes(driver)) throw new Error('ATTACHMENT_STORAGE_DRIVER must be local, temporary or s3.');
if (driver === 'local' && process.env.NODE_ENV === 'production' && !isAbsolute(process.env.ATTACHMENT_STORAGE_DIR || '')) {
  throw new Error('Production requires an absolute ATTACHMENT_STORAGE_DIR on persistent storage.');
}
const directory = resolve(process.env.ATTACHMENT_STORAGE_DIR || (driver === 'temporary' ? join(tmpdir(), 'pulsedesk-attachments') : defaultDirectory));
const validateKey = (key) => {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|pdf|txt)$/.test(key)) throw new Error('Invalid internal storage key.');
  return key;
};
const pathFor = (key) => resolve(directory, validateKey(key));

// Ticket/attachment services use the same generated keys with either adapter.
const localStorage = {
  async write(key, buffer) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(pathFor(key), buffer, { flag: 'wx', mode: 0o600 });
  },
  read(key) { return readFile(pathFor(key)); },
  async remove(key) {
    try { await unlink(pathFor(key)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  },
};

export function createS3Storage(env = process.env) {
  for (const name of ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
    if (!env[name]) throw new Error(`S3 attachment storage requires ${name}.`);
  }
  const endpoint = new URL(env.S3_ENDPOINT);
  if (!['http:', 'https:'].includes(endpoint.protocol) || (env.NODE_ENV === 'production' && endpoint.protocol !== 'https:')
    || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('S3_ENDPOINT must be an origin without a path or credentials, using HTTPS in production.');
  }
  const client = new S3Client({
    endpoint: endpoint.origin, region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 2, requestHandler: { connectionTimeout: 3000, requestTimeout: 10000 },
  });
  const objectFor = (key) => ({ Bucket: env.S3_BUCKET, Key: validateKey(key) });
  return {
    async write(key, buffer) {
      await client.send(new PutObjectCommand({ ...objectFor(key), Body: buffer, IfNoneMatch: '*', ContentType: 'application/octet-stream' }));
    },
    async read(key) {
      try {
        const { Body } = await client.send(new GetObjectCommand(objectFor(key)));
        return Buffer.from(await Body.transformToByteArray());
      } catch (error) {
        if (error.name === 'NoSuchKey') throw Object.assign(new Error('The stored file is unavailable.'), { code: 'ENOENT' });
        throw error;
      }
    },
    async remove(key) { await client.send(new DeleteObjectCommand(objectFor(key))); },
  };
}

export const attachmentStorage = driver === 's3' ? createS3Storage() : localStorage;
