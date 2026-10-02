import { randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '../utils/prisma.js';
import { userProfile } from '../services/user.service.js';
import { AppError } from '../utils/app-error.js';
import { authConfig } from './config.js';

export async function requireAuth(req, res, next) {
  if (!req.session?.userId || !req.session.authenticatedAt || Date.now() - req.session.authenticatedAt >= authConfig.maxAge) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.'));
  }
  const user = await prisma.user.findUnique({ where: { id: req.session.userId }, select: userProfile });
  if (!user) return next(new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.'));
  res.set('Cache-Control', 'no-store');
  req.user = user;
  next();
}
export function csrfToken(req) {
  req.session.csrfToken ??= randomBytes(32).toString('base64url');
  return req.session.csrfToken;
}
export function requireCsrf(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const supplied = req.get('X-CSRF-Token');
  const expected = req.session?.csrfToken;
  const origin = req.get('Origin');
  if ((origin && origin !== authConfig.origin) || typeof supplied !== 'string' || typeof expected !== 'string'
    || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return next(new AppError(403, 'INVALID_CSRF_TOKEN', 'Your session could not be verified. Refresh the page and try again.'));
  }
  next();
}
