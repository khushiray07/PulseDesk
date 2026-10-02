import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
export function getTestEnvironment(source = process.env) {
  const target = source.TEST_DATABASE_URL;
  if (!target) throw new Error('Set TEST_DATABASE_URL to a dedicated database ending in _test.');
  const url = new URL(target);
  if (!decodeURIComponent(url.pathname).endsWith('_test')) throw new Error('The test database name must end in _test.');
  const identity = (value) => {
    const parsed = new URL(value);
    const host = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ? 'loopback' : parsed.hostname;
    return `${host}:${parsed.port || '5432'}${decodeURIComponent(parsed.pathname)}`;
  };
  if (source.DATABASE_URL && identity(target) === identity(source.DATABASE_URL)) {
    throw new Error('Refusing to run destructive tests against the development database.');
  }
  return { ...source, DATABASE_URL: target, NODE_ENV: 'test', PULSEDESK_TEST_DATABASE_VERIFIED: 'true',
    ATTACHMENT_STORAGE_DIR: fileURLToPath(new URL(`../../.local/test-attachments/${randomUUID()}/`, import.meta.url)),
  };
}
