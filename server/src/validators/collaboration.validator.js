import { z } from 'zod';

export const ticketParamsSchema = z.object({ id: z.uuid({ error: 'Ticket ID must be a valid UUID.' }) });
export const assigneeParamsSchema = ticketParamsSchema.extend({ userId: z.uuid({ error: 'User ID must be a valid UUID.' }) });
export const addAssigneeSchema = z.object({ userId: z.uuid({ error: 'Choose a valid support user.' }) }).strict();
export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Enter a comment.').max(5000, 'Comments must be 5,000 characters or fewer.')
    .refine((value) => value.replace(/[\s\u200b-\u200d\u2060\ufeff]/gu, '').length > 0, 'Enter a comment.'),
}).strict();
