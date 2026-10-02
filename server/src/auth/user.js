import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/app-error.js';
import { userProfile } from '../services/user.service.js';

const identitySchema = z.object({
  sub: z.string().min(1).max(255), email: z.email().max(255), email_verified: z.literal(true),
  name: z.string().trim().min(1).max(120).optional(),
  picture: z.url().max(2048).refine((value) => new URL(value).protocol === 'https:').optional(),
});
export async function linkGoogleUser(claims) {
  const identity = identitySchema.parse(claims);
  const email = identity.email.trim().toLowerCase();
  // Serializable transactions prevent two simultaneous first logins from linking different subjects.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const bySubject = await tx.user.findUnique({ where: { googleSubject: identity.sub } });
        if (bySubject) return tx.user.update({ where: { id: bySubject.id }, data: { lastLoginAt: new Date() }, select: userProfile });
        const existing = await tx.user.findUnique({ where: { email } });
        if (existing?.googleSubject && existing.googleSubject !== identity.sub) {
          throw new AppError(409, 'IDENTITY_CONFLICT', 'This email is already linked to another Google identity.');
        }
        const data = { googleSubject: identity.sub, lastLoginAt: new Date() };
        if (existing) return tx.user.update({ where: { id: existing.id }, data: { ...data, avatarUrl: existing.avatarUrl || identity.picture || null }, select: userProfile });
        return tx.user.create({ data: { ...data, email, name: identity.name || email.split('@')[0], avatarUrl: identity.picture || null }, select: userProfile });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!['P2034', 'P2002'].includes(error.code) || attempt === 2) throw error;
    }
  }
}
