import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { genUsername, genTempPassword, hashPassword } from '../../utils/password.js';
import { sendCredentials } from '../../utils/email.js';
import type { RegistrationStatus } from '@prisma/client';

export async function list(status?: string) {
  return prisma.registrationRequest.findMany({
    where: status ? { status: status as RegistrationStatus } : undefined,
    orderBy: { created_at: 'desc' },
  });
}

export async function getById(id: string) {
  const req = await prisma.registrationRequest.findUnique({ where: { request_id: id } });
  if (!req) throw new AppError(404, 'Request not found');
  return req;
}

export async function approve(id: string, adminId: string) {
  const req = await prisma.registrationRequest.findUnique({ where: { request_id: id } });
  if (!req) throw new AppError(404, 'Request not found');
  if (req.status !== 'pending') throw new AppError(400, 'Request already reviewed');

  const tempPassword = genTempPassword();
  let username = genUsername(req.name);
  let attempts = 0;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = genUsername(req.name);
    if (++attempts > 10) throw new AppError(500, 'Could not generate unique username');
  }
  const hashedPassword = await hashPassword(tempPassword);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        request_id: id,
        name: req.name,
        email: req.email,
        number: req.number,
        police_station: req.police_station,
        avatar_url: req.avatar_url,
        username,
        password: hashedPassword,
        role: 'officer',
        must_change_password: true,
      },
    });
    await tx.registrationRequest.update({
      where: { request_id: id },
      data: { status: 'approved', reviewed_by: adminId, reviewed_at: new Date() },
    });
    return created;
  });

  // Fire-and-forget: SMTP can take several seconds — don't block the approval
  // response on it (that made the UI feel unresponsive / "no toast"). Mail failure
  // is logged but never fails the approval (the officer is already created).
  void sendCredentials(req.email, username, tempPassword).catch((e) => {
    console.error(`[approve] credentials email failed for ${req.email}:`, e);
  });
  const { password: _, ...safe } = user;
  // temp_password returned so the admin can always relay creds (mail is async/best-effort).
  return { ...safe, temp_password: tempPassword };
}

export async function reject(id: string, adminId: string) {
  const req = await prisma.registrationRequest.findUnique({ where: { request_id: id } });
  if (!req) throw new AppError(404, 'Request not found');
  if (req.status !== 'pending') throw new AppError(400, 'Request already reviewed');
  return prisma.registrationRequest.update({
    where: { request_id: id },
    data: { status: 'rejected', reviewed_by: adminId, reviewed_at: new Date() },
  });
}
