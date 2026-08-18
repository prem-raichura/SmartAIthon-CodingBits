import { prisma } from '../../lib/prisma.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { signToken } from '../../utils/jwt.js';
import { AppError } from '../../middleware/error.js';
import type { z } from 'zod';
import type { RegisterSchema } from './schema.js';

export async function register(data: z.infer<typeof RegisterSchema>) {
  // An approved applicant already has an account — that check was missing.
  const account = await prisma.user.findFirst({ where: { email: data.email } });
  if (account) throw new AppError(409, 'Email already registered');

  const existing = await prisma.registrationRequest.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    if (existing.status === 'pending') {
      throw new AppError(409, 'A registration request for this email is already pending');
    }
    if (existing.status === 'approved') {
      throw new AppError(409, 'Email already registered');
    }
    // Rejected: reopen the existing row rather than 409-ing forever. The email
    // column is @unique, so a plain create would fail with a raw P2002 → 500.
    return prisma.registrationRequest.update({
      where: { email: data.email },
      data: { ...data, status: 'pending', reviewed_at: null, reviewed_by: null },
    });
  }

  return prisma.registrationRequest.create({ data });
}

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.is_active) throw new AppError(401, 'Invalid credentials');
  const valid = await comparePassword(password, user.password);
  if (!valid) throw new AppError(401, 'Invalid credentials');
  const token = signToken({ id: user.id, role: user.role });
  const { password: _, ...safe } = user;
  return { token, user: safe };
}

export async function getMe(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      police_station: true,
      avatar_url: true,
      number: true,
      push_token: true,
      is_active: true,
      must_change_password: true,
      availability: true,
      created_at: true,
    },
  });
  if (!user) throw new AppError(404, 'User not found');
  return user;
}

export async function changePassword(userId: string, newPassword: string, currentPassword?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  // First-login forced change skips current-password check; otherwise verify it.
  if (!user.must_change_password) {
    if (!currentPassword) throw new AppError(400, 'Current password required');
    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) throw new AppError(401, 'Current password is incorrect');
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, must_change_password: false },
  });
  return { ok: true };
}
