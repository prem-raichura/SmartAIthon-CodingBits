import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { sendPush } from '../../utils/push.js';
import type { AssignmentStatus } from '@prisma/client';

const cellInclude = {
  cell: {
    select: {
      cell_id: true,
      h3_index: true,
      latitude: true,
      longitude: true,
      risk_level: true,
      predicted_violations: true,
      prediction_window: true,
      h3_resolution: true,
    },
  },
  run: { select: { run_id: true, model_version: true, prediction_window: true } },
} as const;

export async function create(data: {
  user_id: string;
  cell_id: string;
  run_id: string;
  time_limit?: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: data.user_id } });
  if (!user) throw new AppError(404, 'User not found');
  if (!user.is_active) throw new AppError(400, 'User is inactive');

  const cell = await prisma.predictionCell.findUnique({ where: { cell_id: data.cell_id } });
  if (!cell) throw new AppError(404, 'Prediction cell not found');

  // An officer can only hold one live patrol, and a zone only needs one officer.
  const officerBusy = await prisma.assignment.findFirst({
    where: { user_id: data.user_id, status: 'active' },
    select: { id: true },
  });
  if (officerBusy) throw new AppError(409, 'Officer already has an active assignment');

  const cellTaken = await prisma.assignment.findFirst({
    where: { cell_id: data.cell_id, status: 'active' },
    select: { id: true },
  });
  if (cellTaken) throw new AppError(409, 'This zone already has an active assignment');

  const assignment = await prisma.$transaction(async (tx) => {
    const a = await tx.assignment.create({
      data: {
        user_id: data.user_id,
        cell_id: data.cell_id,
        run_id: data.run_id,
        status: 'active',
        opened_at: new Date(),
        time_limit: data.time_limit ? new Date(data.time_limit) : undefined,
        notified_at: new Date(),
      },
      include: cellInclude,
    });
    await tx.notification.create({
      data: {
        user_id: data.user_id,
        assignment_id: a.id,
        type: 'assignment',
        title: 'New patrol assignment',
        body: `You have been assigned to patrol zone ${cell.h3_index}. Risk level: ${cell.risk_level}.`,
      },
    });
    await tx.user.update({ where: { id: data.user_id }, data: { availability: 'on_task' } });
    return a;
  });

  await sendPush(
    user.push_token,
    'New patrol assignment',
    `Zone: ${cell.h3_index} | Risk: ${cell.risk_level}`,
    { assignment_id: assignment.id },
  );

  return assignment;
}

export async function listAll(filters: { user_id?: string; status?: string }) {
  return prisma.assignment.findMany({
    where: {
      ...(filters.user_id ? { user_id: filters.user_id } : {}),
      ...(filters.status ? { status: filters.status as AssignmentStatus } : {}),
    },
    include: { ...cellInclude, user: { select: { id: true, name: true, police_station: true } } },
    orderBy: { created_at: 'desc' },
  });
}

export async function listMine(userId: string, status?: string) {
  return prisma.assignment.findMany({
    where: {
      user_id: userId,
      ...(status ? { status: status as AssignmentStatus } : {}),
    },
    include: cellInclude,
    orderBy: { created_at: 'desc' },
  });
}

export async function getById(id: string, userId: string, role: string) {
  const a = await prisma.assignment.findUnique({
    where: { id },
    include: { ...cellInclude, validation: true },
  });
  if (!a) throw new AppError(404, 'Assignment not found');
  if (role === 'officer' && a.user_id !== userId) throw new AppError(403, 'Forbidden');
  return a;
}

export async function patch(id: string, action: 'open' | 'complete' | 'expire', userId: string, role: string) {
  const a = await prisma.assignment.findUnique({ where: { id } });
  if (!a) throw new AppError(404, 'Assignment not found');

  if (role === 'officer' && a.user_id !== userId) throw new AppError(403, 'Forbidden');

  if (action === 'expire' && role !== 'admin') throw new AppError(403, 'Only admin can expire');

  const updateMap: Record<string, { status: AssignmentStatus; opened_at?: Date }> = {
    open: { status: 'active', opened_at: new Date() },
    complete: { status: 'completed' },
    expire: { status: 'expired' },
  };

  return prisma.assignment.update({
    where: { id },
    data: updateMap[action],
    include: cellInclude,
  });
}

/** Admin (or unassign-request approval) cancels an assignment and frees the officer. */
export async function cancel(id: string, reason = 'Assignment cancelled by admin') {
  const a = await prisma.assignment.findUnique({ where: { id }, include: { user: true, cell: true } });
  if (!a) throw new AppError(404, 'Assignment not found');
  if (a.status === 'completed') throw new AppError(400, 'Assignment already completed');

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.assignment.update({
      where: { id },
      data: { status: 'cancelled' },
      include: cellInclude,
    });
    await tx.user.update({ where: { id: a.user_id }, data: { availability: 'available' } });
    await tx.notification.create({
      data: {
        user_id: a.user_id,
        assignment_id: id,
        type: 'system',
        title: 'Assignment cancelled',
        body: `Your patrol assignment for zone ${a.cell.h3_index} has been cancelled. ${reason}`,
      },
    });
    return u;
  });

  await sendPush(a.user.push_token, 'Assignment cancelled', `Zone ${a.cell.h3_index}: ${reason}`, { assignment_id: id });
  return updated;
}
