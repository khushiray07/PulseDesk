import * as service from '../services/comment.service.js';
import { ticketParamsSchema, createCommentSchema } from '../validators/collaboration.validator.js';

export async function listComments(req, res) {
  const { id } = ticketParamsSchema.parse(req.params);
  res.json({ success: true, data: await service.listComments(id) });
}
export async function createComment(req, res) {
  const { id } = ticketParamsSchema.parse(req.params);
  res.status(201).json({ success: true, data: await service.createComment(id, createCommentSchema.parse(req.body)) });
}
