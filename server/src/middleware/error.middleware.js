import { ZodError } from 'zod';

export function errorMiddleware(error, _req, res, _next) {
  if (error instanceof ZodError) {
    const details = {};
    for (const issue of error.issues) {
      const field = issue.path.join('.') || '_form';
      details[field] ??= issue.message;
    }
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Please check the supplied values.', details } });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'The request body must be valid JSON.' } });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large. Please shorten the description.' } });
  }
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({ success: false, error: {
    code: status >= 500 ? 'INTERNAL_ERROR' : error.code,
    message: status >= 500 ? 'Something went wrong. Please try again.' : error.message,
  } });
}
