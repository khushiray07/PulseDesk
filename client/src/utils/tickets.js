import { z } from 'zod';
import { MAX_DESCRIPTION_SIZE, MAX_DESCRIPTION_TEXT, descriptionText, hasDescriptionText } from './description.js';

export const STATUS_LABELS = { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };
export const PRIORITY_LABELS = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
export const shortId = (id) => `TKT-${id.slice(-6).toUpperCase()}`;
export const fullDate = (date) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
export function relativeDate(date) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

const createSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(120, 'Title must be 120 characters or fewer.'),
  description: z.string().trim().max(MAX_DESCRIPTION_SIZE, 'Description HTML must be 50,000 characters or fewer.')
    .refine(hasDescriptionText, 'Enter a description.')
    .refine((value) => descriptionText(value).length <= MAX_DESCRIPTION_TEXT, 'Description must be 10,000 text characters or fewer.'),
  customerEmail: z.string().trim().max(255, 'Email must be 255 characters or fewer.').pipe(z.email({ error: 'Enter a valid customer email address.' })),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});
export function validateTicket(values) {
  const result = createSchema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} };
  return { errors: Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message])) };
}
