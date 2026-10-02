import * as service from '../services/assignee.service.js';
import { ticketParamsSchema, assigneeParamsSchema, addAssigneeSchema } from '../validators/collaboration.validator.js';

export async function listAssignees(req, res) {
  const { id } = ticketParamsSchema.parse(req.params);
  res.json({ success: true, data: await service.listAssignees(id) });
}
export async function addAssignee(req, res) {
  const { id } = ticketParamsSchema.parse(req.params);
  const { userId } = addAssigneeSchema.parse(req.body);
  res.status(201).json({ success: true, data: await service.addAssignee(id, userId) });
}
export async function removeAssignee(req, res) {
  const { id, userId } = assigneeParamsSchema.parse(req.params);
  await service.removeAssignee(id, userId);
  res.json({ success: true, data: { removed: true } });
}
