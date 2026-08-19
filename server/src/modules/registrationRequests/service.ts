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

  // Must be awaited. A serverless function is frozen the moment it responds, so
  // a fire-and-forget send is killed mid-handshake and the officer never gets
  // their credentials. Failure is still non-fatal — the account already exists
  // and temp_password is returned so an admin can relay it by hand.
  let email_sent = false;
  let email_error: string | undefined;
  try {
    await sendCredentials(req.email, username, tempPassword);
    email_sent = true;
  } catch (e) {
    email_error = e instanceof Error ? e.message : String(e);
    console.error(`[approve] credentials email failed for ${req.email}:`, e);
  }

  const { password: _, ...safe } = user;
  // temp_password is always returned so the admin can relay credentials even
  // when mail delivery fails; email_sent tells the UI which case it is.
  return { ...safe, temp_password: tempPassword, email_sent, email_error };
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
