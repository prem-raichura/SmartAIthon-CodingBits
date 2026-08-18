import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { cancel as cancelAssignment } from '../assignments/service.js';
import type { UnassignStatus } from '@prisma/client';

/** Officer raises a "can't reach the zone" request for one of their active assignments. */
export async function createRequest(assignmentId: string, officerId: string, reason: string) {
  const a = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!a) throw new AppError(404, 'Assignment not found');
  if (a.user_id !== officerId) throw new AppError(403, 'Not your assignment');
  if (a.status !== 'active') throw new AppError(400, 'Assignment is not active');

  const existing = await prisma.unassignRequest.findFirst({
    where: { assignment_id: assignmentId, status: 'pending' },
  });
  if (existing) throw new AppError(409, 'A pending unassign request already exists');

  const req = await prisma.unassignRequest.create({
    data: { assignment_id: assignmentId, officer_id: officerId, reason },
  });

  // Notify every admin so the request is visible in officer management.
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
  if (admins.length) {
    await prisma.notification.createMany({
      data: admins.map((adm: { id: string }) => ({
        user_id: adm.id,
        assignment_id: assignmentId,
        type: 'alert' as const,
        title: 'Officer cannot reach zone',
        body: `An officer raised an unassign request: ${reason}`,
      })),
    });
  }
  return req;
}

export async function list(status?: string) {
  return prisma.unassignRequest.findMany({
    where: status ? { status: status as UnassignStatus } : undefined,
    orderBy: { created_at: 'desc' },
    include: {
      officer: { select: { id: true, name: true, police_station: true } },
      assignment: { include: { cell: { select: { h3_index: true, latitude: true, longitude: true, risk_level: true } } } },
    },
  });
}

export async function approve(id: string, adminId: string) {
  const req = await prisma.unassignRequest.findUnique({ where: { id } });
  if (!req) throw new AppError(404, 'Request not found');
  if (req.status !== 'pending') throw new AppError(400, 'Request already reviewed');

  await cancelAssignment(req.assignment_id, 'Unassign request approved by admin');
  return prisma.unassignRequest.update({
    where: { id },
    data: { status: 'approved', reviewed_by: adminId, reviewed_at: new Date() },
  });
}

export async function reject(id: string, adminId: string) {
  const req = await prisma.unassignRequest.findUnique({ where: { id }, include: { assignment: true } });
  if (!req) throw new AppError(404, 'Request not found');
  if (req.status !== 'pending') throw new AppError(400, 'Request already reviewed');

  await prisma.notification.create({
    data: {
      user_id: req.officer_id,
      assignment_id: req.assignment_id,
      type: 'system',
      title: 'Unassign request rejected',
      body: 'Your request to be unassigned was rejected. Please continue your patrol.',
    },
  });
  return prisma.unassignRequest.update({
    where: { id },
    data: { status: 'rejected', reviewed_by: adminId, reviewed_at: new Date() },
  });
}
