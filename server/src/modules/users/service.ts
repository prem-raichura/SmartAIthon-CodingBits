import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { z } from 'zod';
import type { PatchUserSchema, UpdateMeSchema } from './schema.js';

const safeSelect = {
  id: true,
  name: true,
  email: true,
  username: true,
  role: true,
  police_station: true,
  number: true,
  avatar_url: true,
  push_token: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

export async function list() {
  return prisma.user.findMany({ select: safeSelect, orderBy: { created_at: 'desc' } });
}

export async function getById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: safeSelect });
  if (!user) throw new AppError(404, 'User not found');
  return user;
}

export async function patch(id: string, data: z.infer<typeof PatchUserSchema>) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'User not found');
  return prisma.user.update({ where: { id }, data, select: safeSelect });
}

export async function updateMe(id: string, data: z.infer<typeof UpdateMeSchema>) {
  // Reject an email already used by another account.
  if (data.email) {
    const clash = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id } },
      select: { id: true },
    });
    if (clash) throw new AppError(409, 'Email already in use');
  }
  // Reject a username already taken by another account.
  if (data.username) {
    const clash = await prisma.user.findFirst({
      where: { username: data.username, NOT: { id } },
      select: { id: true },
    });
    if (clash) throw new AppError(409, 'Username already taken');
  }
  return prisma.user.update({ where: { id }, data, select: safeSelect });
}

export async function savePushToken(id: string, push_token: string) {
  return prisma.user.update({ where: { id }, data: { push_token }, select: safeSelect });
}
