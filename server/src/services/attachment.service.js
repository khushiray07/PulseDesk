import { randomUUID } from 'node:crypto';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/app-error.js';
import { getTicket } from './ticket.service.js';
import { attachmentStorage } from './attachment-storage.js';
import { MAX_ATTACHMENTS, validateAttachment } from '../validators/attachment.validator.js';

const publicFields = { id: true, ticketId: true, fileName: true, mimeType: true, fileSize: true, createdAt: true };
const notFound = () => new AppError(404, 'ATTACHMENT_NOT_FOUND', 'This attachment could not be found.');

export async function listAttachments(ticketId) {
  await getTicket(ticketId);
  return prisma.attachment.findMany({ where: { ticketId }, select: publicFields, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
}

export async function uploadAttachment(ticketId, file) {
  const { extension, ...metadata } = await validateAttachment(file);
  const storageKey = `${randomUUID()}.${extension}`;
  let written = false;
  try {
    return await prisma.$transaction(async (tx) => {
      // Serialize uploads per ticket so concurrent requests cannot exceed the cap.
      const rows = await tx.$queryRaw`SELECT id FROM tickets WHERE id = ${ticketId}::uuid FOR UPDATE`;
      if (!rows.length) throw new AppError(404, 'TICKET_NOT_FOUND', 'This ticket could not be found.');
      if (await tx.attachment.count({ where: { ticketId } }) >= MAX_ATTACHMENTS) {
        throw new AppError(409, 'ATTACHMENT_LIMIT', 'A ticket can have at most 10 attachments.');
      }
      await attachmentStorage.write(storageKey, file.buffer);
      written = true;
      return tx.attachment.create({ data: { ticketId, storageKey, ...metadata }, select: publicFields });
    }, { timeout: 30000 }); // Allow a bounded remote object-store write inside the existing transaction.
  } catch (error) {
    if (written) await attachmentStorage.remove(storageKey);
    throw error;
  }
}

export async function readAttachment(ticketId, id) {
  const attachment = await prisma.attachment.findFirst({ where: { ticketId, id } });
  if (!attachment) throw notFound();
  try { return { attachment, buffer: await attachmentStorage.read(attachment.storageKey) }; }
  catch (error) {
    if (error.code === 'ENOENT') throw new AppError(404, 'ATTACHMENT_FILE_MISSING', 'The stored file is unavailable.');
    throw error;
  }
}

export async function deleteAttachment(ticketId, id) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM tickets WHERE id = ${ticketId}::uuid FOR UPDATE`;
    const attachment = await tx.attachment.findFirst({ where: { ticketId, id } });
    if (!attachment) throw notFound();
    await attachmentStorage.remove(attachment.storageKey);
    await tx.attachment.delete({ where: { id } });
  });
}
