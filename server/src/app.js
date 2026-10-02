import express from 'express';
import { ticketRouter } from './routes/ticket.routes.js';
import { userRouter } from './routes/user.routes.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { AppError } from './utils/app-error.js';
import { sessionMiddleware } from './auth/session.js';
import { authRouter } from './auth/routes.js';
import { requireAuth, requireCsrf } from './auth/middleware.js';

export function createApp({ provider } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
  app.use(sessionMiddleware());
  app.use('/api/auth', authRouter(provider));
  app.use('/api/tickets', requireAuth, requireCsrf, ticketRouter);
  app.use('/api/users', requireAuth, requireCsrf, userRouter);
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'This endpoint could not be found.')));
  app.use(errorMiddleware);
  return app;
}
export const app = createApp();
