import { z } from 'zod';
import { MAX_DESCRIPTION_SIZE, MAX_DESCRIPTION_TEXT, normalizeDescription, descriptionText, hasDescriptionText } from '../utils/description.js';

const priority = z.enum(['LOW', 'MEDIUM', 'HIGH'], { error: 'Choose Low, Medium, or High.' });
const status = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED'], { error: 'Choose Open, In Progress, or Resolved.' });
const description = z.string().max(MAX_DESCRIPTION_SIZE, 'Description HTML must be 50,000 characters or fewer.')
  .transform(normalizeDescription)
  .refine(hasDescriptionText, 'Enter a description.')
  .refine((value) => descriptionText(value).length <= MAX_DESCRIPTION_TEXT, 'Description must be 10,000 text characters or fewer.');

export const createTicketSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(120, 'Title must be 120 characters or fewer.'),
  description,
  customerEmail: z.string().trim().max(255, 'Email must be 255 characters or fewer.').pipe(z.email({ error: 'Enter a valid customer email address.' })),
  priority,
}).strict();

export const updateTicketSchema = z.object({
  status: status.optional(),
  priority: priority.optional(),
  description: description.optional(),
}).strict().refine((data) => Object.keys(data).length > 0, { message: 'Provide a status, priority, or description to update.' });

const page = z.string().regex(/^[1-9]\d*$/, 'Page must be a positive integer.').transform(Number).pipe(z.number().int().max(214748365, 'Page is too large.'));

export const listTicketsSchema = z.object({
  search: z.string().trim().optional(),
  status: status.optional(),
  priority: priority.optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  page: page.default(1),
  limit: z.literal('10').optional(),
}).strict();

export const ticketIdSchema = z.uuid({ error: 'Ticket ID must be a valid UUID.' });
