import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/app-error.js';

export async function listTickets({ search, status, priority, sort, page }) {
  if (search) return searchTickets({ search, status, priority, sort, page });
  const where = {
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

async function searchTickets({ search, status, priority, sort, page }) {
  // Keep LIKE wildcards literal, matching the previous substring behavior.
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const emailQuery = search.includes('@');
  const fuzzyEnabled = search.length >= 4 && (
    /^[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+)*$/u.test(search) ||
    (emailQuery && /^[\p{L}\p{N}.@+_-]+$/u.test(search))
  );
  const threshold = emailQuery ? 0.6 : 0.5;
  const score = !fuzzyEnabled ? Prisma.sql`0::real` : emailQuery
    ? Prisma.sql`similarity(lower(${search}), lower("customer_email"))`
    : Prisma.sql`GREATEST(
        word_similarity(lower(${search}), lower("title")),
        word_similarity(lower(${search}), lower("customer_email"))
      )`;
  const filters = [
    ...(status ? [Prisma.sql`"status" = ${status}::"Status"`] : []),
    ...(priority ? [Prisma.sql`"priority" = ${priority}::"Priority"`] : []),
  ];
  const where = filters.length ? Prisma.join(filters, ' AND ') : Prisma.sql`TRUE`;
  const direction = sort === 'oldest' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  // Reuse precisely the same matches for both the page and its total count.
  const matches = Prisma.sql`
    WITH candidates AS (
      SELECT *,
        CASE
          WHEN lower("title") = lower(${search})
            OR lower("customer_email") = lower(${search}) THEN 0
          WHEN "title" ILIKE ${pattern}
            OR "customer_email" ILIKE ${pattern} THEN 1
          ELSE 2
        END AS match_rank,
        ${score} AS fuzzy_score
      FROM "tickets"
      WHERE ${where}
    ),
    matches AS (
      SELECT * FROM candidates
      WHERE match_rank < 2
        OR (
          ${fuzzyEnabled} AND fuzzy_score >= ${threshold}
          -- A known literal email must not expand to neighboring addresses.
          AND (${!emailQuery} OR NOT EXISTS (
            SELECT 1 FROM candidates WHERE match_rank < 2
          ))
        )
    )
  `;
  const [tickets, counts] = await prisma.$transaction([
    prisma.$queryRaw(Prisma.sql`${matches}
      SELECT "id", "title", "description", "customer_email" AS "customerEmail",
        "priority", "status", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
      FROM matches
      ORDER BY match_rank ASC,
        CASE WHEN match_rank = 2 THEN fuzzy_score END DESC,
        "created_at" ${direction}, "id" ${direction}
      LIMIT 10 OFFSET ${(page - 1) * 10}
    `),
    prisma.$queryRaw(Prisma.sql`${matches} SELECT COUNT(*) AS total FROM matches`),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const total = Number(counts[0].total);
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
