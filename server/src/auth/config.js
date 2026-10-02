import { randomBytes } from 'node:crypto';

const production = process.env.NODE_ENV === 'production';
const secret = process.env.SESSION_SECRET || (production ? '' : randomBytes(48).toString('base64url'));
if (secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
const origin = new URL(process.env.APP_ORIGIN || 'http://127.0.0.1:5173');
const callback = new URL(process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback', origin);
if (origin.origin !== callback.origin || callback.pathname !== '/api/auth/google/callback' || callback.search || callback.hash) {
  throw new Error('GOOGLE_CALLBACK_URL must be the app origin followed by /api/auth/google/callback.');
}
const loopback = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(origin.hostname) || origin.hostname.endsWith('.localhost');
if (production && (origin.protocol !== 'https:' || loopback || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)) {
  throw new Error('Production authentication requires HTTPS APP_ORIGIN and Google OAuth credentials.');
}
export const authConfig = Object.freeze({
  production, secret, origin: origin.origin, callback: callback.href,
  clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  cookieName: 'pulsedesk.sid', maxAge: 8 * 60 * 60 * 1000,
});
export const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' };
