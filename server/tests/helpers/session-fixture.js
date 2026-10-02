import { randomBytes } from 'node:crypto';
import signature from 'cookie-signature';
import { prisma } from '../../src/utils/prisma.js';
import { authConfig, cookieOptions } from '../../src/auth/config.js';
import { supportUsers } from '../../prisma/users.seed.js';

export function assertTestDatabase() {
  if (process.env.NODE_ENV !== 'test' || process.env.PULSEDESK_TEST_DATABASE_VERIFIED !== 'true'
    || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Session fixtures require the isolated test database.');
}
// Database fixture, never an HTTP login endpoint; this module is not imported by production.
export async function sessionFixture(userId = supportUsers[0].id, overrides = {}) {
  assertTestDatabase();
  const sid = randomBytes(32).toString('base64url');
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + authConfig.maxAge);
  await prisma.session.create({ data: { sid, expire: expires, sess: {
    cookie: { ...cookieOptions, originalMaxAge: authConfig.maxAge, expires: expires.toISOString() },
    userId, authenticatedAt: Date.now(), csrfToken: token, ...overrides,
  } } });
  const value = `s:${signature.sign(sid, authConfig.secret)}`;
  return { sid, token, value, cookie: `${authConfig.cookieName}=${encodeURIComponent(value)}` };
}
