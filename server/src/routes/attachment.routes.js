import { Router } from 'express';
import multer from 'multer';
import { ticketIdSchema } from '../validators/ticket.validator.js';
import { MAX_FILE_SIZE } from '../validators/attachment.validator.js';
import { getTicket } from '../services/ticket.service.js';
import * as service from '../services/attachment.service.js';

export const attachmentRouter = Router({ mergeParams: true });
attachmentRouter.use(async (req, _res, next) => {
  req.ticketId = ticketIdSchema.parse(req.params.id);
  await getTicket(req.ticketId);
  next();
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0, parts: 1 } });
attachmentRouter.post('/', upload.single('file'), async (req, res) => {
  res.status(201).json({ success: true, data: await service.uploadAttachment(req.ticketId, req.file) });
});
attachmentRouter.get('/', async (req, res) => {
  res.json({ success: true, data: await service.listAttachments(req.ticketId) });
});
attachmentRouter.get('/:attachmentId/content', async (req, res) => {
  const id = ticketIdSchema.parse(req.params.attachmentId);
  const { attachment, buffer } = await service.readAttachment(req.ticketId, id);
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" });
  res.attachment(attachment.fileName);
  if (attachment.mimeType.startsWith('image/') && req.query.download !== '1') res.set('Content-Disposition', 'inline');
  res.type(attachment.mimeType).send(buffer);
});
attachmentRouter.delete('/:attachmentId', async (req, res) => {
  await service.deleteAttachment(req.ticketId, ticketIdSchema.parse(req.params.attachmentId));
  res.json({ success: true, data: { deleted: true } });
});
