import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/app-error.js';
import { getTicket } from './ticket.service.js';
import { getUser, userProfile } from './user.service.js';

const fields = { ticketId: true, userId: true, assignedAt: true, user: { select: userProfile } };
export async function listAssignees(ticketId) {
  await getTicket(ticketId);
  return prisma.ticketAssignee.findMany({ where: { ticketId }, select: fields, orderBy: [{ assignedAt: 'asc' }, { userId: 'asc' }] });
}
export async function addAssignee(ticketId, userId) {
  await getTicket(ticketId);
  await getUser(userId);
  try { return await prisma.ticketAssignee.create({ data: { ticketId, userId }, select: fields }); }
  catch (error) {
    if (error.code === 'P2002') throw new AppError(409, 'ALREADY_ASSIGNED', 'This user is already assigned to the ticket.');
    if (error.code === 'P2003') throw new AppError(404, 'REFERENCE_NOT_FOUND', 'The ticket or support user is no longer available.');
    throw error;
  }
}
export async function removeAssignee(ticketId, userId) {
  await getTicket(ticketId);
  await getUser(userId);
  try { await prisma.ticketAssignee.delete({ where: { ticketId_userId: { ticketId, userId } } }); }
  catch (error) {
    if (error.code === 'P2025') throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', 'This user is not assigned to the ticket.');
    throw error;
  }
}
