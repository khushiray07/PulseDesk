import { Router } from 'express';
import * as controller from '../controllers/ticket.controller.js';
import { attachmentRouter } from './attachment.routes.js';

export const ticketRouter = Router();
ticketRouter.get('/summary', controller.getSummary);
ticketRouter.get('/', controller.listTickets);
ticketRouter.post('/', controller.createTicket);
ticketRouter.use('/:id/attachments', attachmentRouter);
ticketRouter.get('/:id', controller.getTicket);
ticketRouter.patch('/:id', controller.updateTicket);
