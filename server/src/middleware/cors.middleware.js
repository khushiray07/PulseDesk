import { authConfig } from '../auth/config.js';

// Browser permissions only; authentication and CSRF still protect the routes.
export function apiCors(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.vary('Origin');
  if (req.get('Origin') !== authConfig.origin) return next();
  res.set({
    'Access-Control-Allow-Origin': authConfig.origin,
    'Access-Control-Allow-Credentials': 'true',
  });
  if (req.method === 'OPTIONS') {
    res.set({
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
    });
    return res.sendStatus(204);
  }
  next();
}
