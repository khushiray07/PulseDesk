import * as service from '../services/ticket.service.js';
import { createTicketSchema, updateTicketSchema, listTicketsSchema, ticketIdSchema } from '../validators/ticket.validator.js';

export async function listTickets(req, res) {
  res.json({ success: true, data: await service.listTickets(listTicketsSchema.parse(req.query)) });
}

export async function getSummary(_req, res) {
  res.json({ success: true, data: await service.getSummary() });
}

export async function createTicket(req, res) {
  res.status(201).json({ success: true, data: await service.createTicket(createTicketSchema.parse(req.body)) });
}

export async function getTicket(req, res) {
  res.json({ success: true, data: await service.getTicket(ticketIdSchema.parse(req.params.id)) });
}

export async function updateTicket(req, res) {
  res.json({ success: true, data: await service.updateTicket(ticketIdSchema.parse(req.params.id), updateTicketSchema.parse(req.body)) });
}
