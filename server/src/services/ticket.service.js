import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/app-error.js';

export async function listTickets({ search, status, priority, sort, page }) {
  // Prisma maps contains to ILIKE; treat LIKE wildcards as literal search text.
  const pattern = search?.replace(/[\\%_]/g, '\\$&');
  const where = {
    ...(search && { OR: [
      { title: { contains: pattern, mode: 'insensitive' } },
      { customerEmail: { contains: pattern, mode: 'insensitive' } },
    ] }),
    ...(status && { status }),
    ...(priority && { priority }),
  };
  const direction = sort === 'oldest' ? 'asc' : 'desc';
  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({ where, orderBy: [{ createdAt: direction }, { id: direction }], skip: (page - 1) * 10, take: 10 }),
    prisma.ticket.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { tickets, pagination: { page, limit: 10, total, totalPages: Math.ceil(total / 10) } };
}

export async function getSummary() {
  const groups = await prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } });
  const counts = Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
  return {
    total: groups.reduce((sum, group) => sum + group._count._all, 0),
    open: counts.OPEN || 0,
    inProgress: counts.IN_PROGRESS || 0,
    resolved: counts.RESOLVED || 0,
  };
}

export function createTicket(data) {
  return prisma.ticket.create({ data });
}

export async function getTicket(id) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'This ticket could not be found.');
  return ticket;
}

export async function updateTicket(id, data) {
  try {
    return await prisma.ticket.update({ where: { id }, data });
  } catch (error) {
    if (error.code === 'P2025') throw new AppError(404, 'TICKET_NOT_FOUND', 'This ticket could not be found.');
    throw error;
  }
}
