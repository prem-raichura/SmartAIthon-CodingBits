import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { env } from '../../config/env.js';
import { haversineMeters } from '../../utils/geo.js';

/** Officer device posts its position; we geofence-check it against the assigned cell. */
export async function ping(
  userId: string,
  data: { latitude: number; longitude: number; assignment_id?: string },
) {
  let distance_m: number | null = null;
  let in_range = true;
  let assignmentId = data.assignment_id ?? null;
  let cellH3: string | null = null;

  if (assignmentId) {
    const a = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { cell: { select: { latitude: true, longitude: true, h3_index: true } } },
    });
    if (!a) throw new AppError(404, 'Assignment not found');
    if (a.user_id !== userId) throw new AppError(403, 'Not your assignment');
    if (a.status !== 'active') {
      assignmentId = null; // stop geofencing once the task is over
    } else if (a.cell.latitude != null && a.cell.longitude != null) {
      distance_m = Math.round(haversineMeters(data.latitude, data.longitude, a.cell.latitude, a.cell.longitude));
      in_range = distance_m <= env.GEOFENCE_RADIUS_M;
      cellH3 = a.cell.h3_index;
    }
  }

  // Was the officer in range on their previous ping for this assignment?
  const prev = assignmentId
    ? await prisma.locationPing.findFirst({
        where: { assignment_id: assignmentId },
        orderBy: { created_at: 'desc' },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.locationPing.create({
      data: {
        user_id: userId,
        assignment_id: assignmentId,
        latitude: data.latitude,
        longitude: data.longitude,
        distance_m,
        in_range,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { last_lat: data.latitude, last_lon: data.longitude, last_seen_at: new Date() },
    });
  });

  // Alert admins only on the transition into an out-of-range state (avoid spam).
  if (assignmentId && !in_range && (!prev || prev.in_range)) {
    const officer = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
    if (admins.length) {
      await prisma.notification.createMany({
        data: admins.map((adm: { id: string }) => ({
          user_id: adm.id,
          assignment_id: assignmentId!,
          type: 'alert' as const,
          title: 'Officer out of assigned zone',
          body: `${officer?.name ?? 'An officer'} is ${distance_m} m from zone ${cellH3 ?? ''} (limit ${env.GEOFENCE_RADIUS_M} m).`,
        })),
      });
    }
  }

  return { in_range, distance_m, geofence_radius_m: env.GEOFENCE_RADIUS_M };
}

/** Recent out-of-range pings for the admin alerts view. */
export async function breaches(limit = 100) {
  const pings = await prisma.locationPing.findMany({
    where: { in_range: false, assignment_id: { not: null } },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, name: true, police_station: true } },
      assignment: { include: { cell: { select: { h3_index: true, latitude: true, longitude: true, risk_level: true } } } },
    },
  });
  return pings.map((p: typeof pings[number]) => ({
    id: p.id,
    officer_id: p.user_id,
    officer_name: p.user.name,
    station: p.user.police_station,
    assignment_id: p.assignment_id,
    zone: p.assignment?.cell.h3_index ?? null,
    risk_level: p.assignment?.cell.risk_level ?? null,
    latitude: p.latitude,
    longitude: p.longitude,
    distance_m: p.distance_m,
    at: p.created_at,
  }));
}
