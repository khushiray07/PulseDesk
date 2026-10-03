import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { attachmentSpecs, demoAssignments, demoComments, demoTickets, demoUsers, legacyTicketFields } from './demo-fixtures.js';
import { validateAttachment } from '../src/validators/attachment.validator.js';

export async function seedDemo(db, storage) {
  // Validate all bundled bytes before any database write. Never seed metadata for imaginary files.
  const files = await Promise.all(attachmentSpecs.map(async spec => {
    const buffer = await readFile(new URL(`./demo-assets/${spec.fileName}`, import.meta.url));
    const { extension, ...metadata } = await validateAttachment({ buffer, size: buffer.length, originalname: spec.fileName });
    return { ...spec, ...metadata, buffer, storageKey: `${spec.id}.${extension}` };
  }));
  const upgraded = [];
  const preserved = [];
  await db.$transaction(async tx => {
    // Serialize this optional seed with itself, without locking/resetting the application tables.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(706060)`;
    const users = [];
    for (const fixture of demoUsers) {
      const byId = await tx.user.findUnique({ where: { id: fixture.id } });
      const byEmail = await tx.user.findUnique({ where: { email: fixture.email } });
      const byLegacyEmail = fixture.legacyEmail ? await tx.user.findUnique({ where: { email: fixture.legacyEmail } }) : null;
      const existing = byId || byEmail || byLegacyEmail;
      if (byId && byId.email !== fixture.email) throw new Error('A demo user ID is occupied by another account. No account will be overwritten.');
      if (existing?.googleSubject || byEmail?.googleSubject || byLegacyEmail?.googleSubject) throw new Error('A demo user identifier belongs to a Google-linked account. No account will be modified or used as a demo author.');
      if (byId && byEmail && byId.id !== byEmail.id) throw new Error('Conflicting demo user identities require manual review.');
      const { legacyEmail: _legacy, ...data } = fixture;
      // Preserve every existing profile/identity; reuse the earlier local seed users where present.
      users.push(existing || await tx.user.upsert({ where: { email: data.email }, update: {}, create: data }));
    }
    for (const [index, data] of demoTickets.entries()) {
      const existing = await tx.ticket.findUnique({ where: { id: data.id } });
      const legacy = legacyTicketFields(index);
      if (existing && existing.customerEmail !== data.customerEmail && existing.customerEmail !== legacy?.customerEmail) {
        throw new Error('A demo ticket ID is occupied by an unrelated record. It will not be modified.');
      }
      const unchangedLegacy = existing && legacy && Object.entries(legacy).every(([key, value]) => existing[key] === value)
        && existing.updatedAt.getTime() - existing.createdAt.getTime() === (index % 3) * 20 * 60 * 1000;
      if (unchangedLegacy) {
        // A conditional write also preserves edits made after this row was read.
        const result = await tx.ticket.updateMany({ where: { id: data.id, ...legacy, createdAt: existing.createdAt, updatedAt: existing.updatedAt }, data });
        if (result.count) upgraded.push(data.id); else preserved.push(data.id);
      } else {
        await tx.ticket.upsert({ where: { id: data.id }, update: {}, create: data });
        if (existing && !isDeepStrictEqual(existing, data)) preserved.push(data.id);
      }
    }
    for (const { agentIndex, ...data } of demoAssignments) {
      const userId = users[agentIndex].id;
      await tx.ticketAssignee.upsert({ where: { ticketId_userId: { ticketId: data.ticketId, userId } }, update: {}, create: { ...data, userId } });
    }
    for (const { agentIndex, ...data } of demoComments) {
      const existing = await tx.comment.findUnique({ where: { id: data.id } });
      const userId = users[agentIndex].id;
      if (existing && (existing.ticketId !== data.ticketId || existing.userId !== userId)) throw new Error('A demo comment ID is occupied by a different record.');
      await tx.comment.upsert({ where: { id: data.id }, update: {}, create: { ...data, userId } });
    }
    for (const { buffer, ...file } of files) {
      const createdAt = new Date(demoTickets.find(ticket => ticket.id === file.ticketId).createdAt.getTime() + 15 * 60 * 1000);
      const existing = await tx.attachment.findUnique({ where: { id: file.id } });
      if (existing && !isDeepStrictEqual(existing, { ...file, createdAt })) throw new Error('A demo attachment identifier has different metadata. It will not be overwritten.');
      let stored;
      try { stored = await storage.read(file.storageKey); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        try { await storage.write(file.storageKey, buffer); }
        catch (writeError) {
          if (writeError.code !== 'EEXIST' && writeError.name !== 'PreconditionFailed') throw writeError;
        }
        stored = await storage.read(file.storageKey);
      }
      if (!buffer.equals(stored)) throw new Error('A demo storage key has different content. It will not be overwritten.');
      await tx.attachment.upsert({ where: { id: file.id }, update: {}, create: { ...file, createdAt } });
    }
  }, { timeout: 120000, maxWait: 10000 });
  // New bytes are safe to reuse after a failed DB transaction; never delete any existing objects.
  return { upgradedLegacyTickets: upgraded.length, preservedEditedTickets: preserved.length };
}
