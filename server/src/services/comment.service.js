import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/app-error.js';
import { getTicket } from './ticket.service.js';
import { getUser, userProfile } from './user.service.js';

const fields = { id: true, ticketId: true, userId: true, content: true, createdAt: true, updatedAt: true, user: { select: userProfile } };
export async function listComments(ticketId) {
  await getTicket(ticketId);
  return prisma.comment.findMany({ where: { ticketId }, select: fields, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
}
export async function createComment(ticketId, data) {
  await getTicket(ticketId);
  await getUser(data.userId);
  try { return await prisma.comment.create({ data: { ticketId, ...data }, select: fields }); }
  catch (error) {
    if (error.code === 'P2003') throw new AppError(404, 'REFERENCE_NOT_FOUND', 'The ticket or support user is no longer available.');
    throw error;
  }
}
