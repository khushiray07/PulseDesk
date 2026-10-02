import express from 'express';
import { ticketRouter } from './routes/ticket.routes.js';
import { userRouter } from './routes/user.routes.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { AppError } from './utils/app-error.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/tickets', ticketRouter);
app.use('/api/users', userRouter);
app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'This endpoint could not be found.')));
app.use(errorMiddleware);
