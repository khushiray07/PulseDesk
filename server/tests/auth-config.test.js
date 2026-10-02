import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const run = (overrides = {}) => execFileSync(process.execPath, ['--input-type=module', '-e', "const {cookieOptions}=await import('./src/auth/config.js'); console.log(JSON.stringify(cookieOptions));"], {
  cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', SESSION_SECRET: 'test-only-secret-with-at-least-32-characters',
    APP_ORIGIN: 'https://support.example.com', GOOGLE_CALLBACK_URL: 'https://support.example.com/api/auth/google/callback',
    GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', ...overrides }, stdio: 'pipe',
}).toString();
describe('production auth configuration', () => {
  it('requires HttpOnly, Secure and SameSite=Lax cookies in production', () => {
    expect(JSON.parse(run())).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  });
  it.each([
    { SESSION_SECRET: '' }, { SESSION_SECRET: 'short' },
    { GOOGLE_CLIENT_ID: '' }, { GOOGLE_CLIENT_SECRET: '' },
    { APP_ORIGIN: 'http://support.example.com', GOOGLE_CALLBACK_URL: 'http://support.example.com/api/auth/google/callback' },
    { GOOGLE_CALLBACK_URL: 'https://attacker.example.com/api/auth/google/callback' },
    { GOOGLE_CALLBACK_URL: 'https://support.example.com/unexpected' },
  ])('fails closed with invalid production configuration: %j', (overrides) => { expect(() => run(overrides)).toThrow(); });
});
