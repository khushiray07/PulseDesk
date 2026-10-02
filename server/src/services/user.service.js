import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/app-error.js';

export const userProfile = { id: true, name: true, email: true, avatarUrl: true };
export function listUsers() {
  return prisma.user.findMany({ select: userProfile, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
}
export async function getUser(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: userProfile });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'This support user could not be found.');
  return user;
}
