import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';

type LatestRun = Awaited<ReturnType<typeof queryLatestRun>>;

function queryLatestRun() {
  return prisma.predictionRun.findFirst({
    where: { status: 'done' },
    orderBy: { run_at: 'desc' },
    include: { analytics: true },
  });
}

// Every analytics endpoint needs the latest run, and a single dashboard render
// calls 11+ of them. Cache the row briefly so one page load is one query.
const CACHE_TTL_MS = 5_000;
let cached: { at: number; promise: Promise<LatestRun> } | null = null;

async function latestRun(): Promise<LatestRun> {
  const now = Date.now();
  if (!cached || now - cached.at > CACHE_TTL_MS) {
    const promise = queryLatestRun();
    cached = { at: now, promise };
    // Don't cache a rejection.
    promise.catch(() => { cached = null; });
  }
  return cached.promise;
}

/** Called after a new run is persisted so the next read is fresh. */
export function invalidateLatestRun() {
  cached = null;
}

export async function getDashboard() {
  const run = await latestRun();
  if (!run?.analytics) return null;
  const dash = run.analytics.dashboard as Record<string, unknown>;
  // Override pending_approvals with live count
  const pending = await prisma.registrationRequest.count({ where: { status: 'pending' } });
  return { ...dash, pending_approvals: pending };
}

export async function getHotspots() {
  const run = await latestRun();
  return run?.analytics?.hotspots ?? [];
}

export async function getStations() {
  const run = await latestRun();
  return run?.analytics?.stations ?? [];
}

export async function getOfficers() {
  // Real approved officers (NOT CSV-derived). Stats accrue from their field reports.
  const officers = await prisma.user.findMany({
    where: { role: 'officer' },
    select: {
      id: true,
      name: true,
      police_station: true,
      availability: true,
      is_active: true,
      last_lat: true,
      last_lon: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  });

  const ids = officers.map((o: typeof officers[number]) => o.id);
  const reportCounts = ids.length
    ? await prisma.fieldValidation.groupBy({ by: ['officer_id'], where: { officer_id: { in: ids } }, _count: true })
    : [];
  const activeCounts = ids.length
    ? await prisma.assignment.groupBy({ by: ['user_id'], where: { user_id: { in: ids }, status: 'active' }, _count: true })
    : [];
  const reportMap = new Map(reportCounts.map((r: { officer_id: string; _count: number }) => [r.officer_id, r._count]));
  const activeMap = new Map(activeCounts.map((r: { user_id: string; _count: number }) => [r.user_id, r._count]));

  return officers.map((o: typeof officers[number]) => {
    const reports = (reportMap.get(o.id) as number) ?? 0;
    const active = (activeMap.get(o.id) as number) ?? 0;
    return {
      id: o.id,
      name: o.name,
      badge_id: `BTP-${o.id.slice(-4).toUpperCase()}`,
      station: o.police_station,
      // keep status within the client's known set: active | on_patrol | available | off_duty
      status: !o.is_active
        ? 'off_duty'
        : active > 0
          ? 'on_patrol'
          : o.availability === 'available'
            ? 'available'
            : 'off_duty',
      last_lat: o.last_lat,
      last_lon: o.last_lon,
      total_tickets: reports,
      active_assignments: active,
      approval_rate: 1, // fraction (client renders approval_rate * 100)
      effectiveness_score: Math.min(100, 50 + reports * 5),
      joined_on: o.created_at.toISOString().split('T')[0],
    };
  });
}

export async function getPendingOfficers() {
  const reqs = await prisma.registrationRequest.findMany({
    where: { status: 'pending' },
    orderBy: { created_at: 'desc' },
  });
  return reqs.map((r: typeof reqs[number]) => ({
    id: r.request_id,
    name: r.name,
    badge_id: `BTP-${r.request_id.slice(-4).toUpperCase()}`,
    requested_station: r.police_station,
    phone: r.number,
    email: r.email,
    applied_on: r.created_at.toISOString().split('T')[0],
    experience_years: 0,
    status: r.status,
  }));
}

export async function getTimeseries() {
  const run = await latestRun();
  return run?.analytics?.timeseries ?? { monthly: [], daily: [], hourly: [], daily_trend: [] };
}

export async function getFunnel() {
  const run = await latestRun();
  return run?.analytics?.funnel ?? { total: 0, reviewed: 0, approved: 0, rejected: 0, processing: 0, duplicate: 0, never_reviewed: 0 };
}

export async function getViolations() {
  const run = await latestRun();
  return run?.analytics?.violations ?? [];
}

export async function getVehicles() {
  const run = await latestRun();
  return run?.analytics?.vehicles ?? [];
}

export async function getEdi() {
  const run = await latestRun();
  return run?.analytics?.edi ?? [];
}

export async function getActivity() {
  const run = await latestRun();
  return run?.analytics?.activity ?? [];
}

export async function approveOfficer(id: string, adminId: string) {
  const { approve } = await import('../registrationRequests/service.js');
  return approve(id, adminId);
}

export async function rejectOfficer(id: string, adminId: string) {
  const { reject } = await import('../registrationRequests/service.js');
  return reject(id, adminId);
}

export async function assignOfficer(data: {
  user_id: string;
  cell_id?: string;
  run_id?: string;
  h3_index?: string;
  time_limit?: string;
}) {
  const { AppError } = await import('../../middleware/error.js');
  let { cell_id, run_id } = data;

  // Hotspots served to the client carry h3_index, not the DB cell_id — resolve it
  // against the latest completed run so the map can assign straight from a hexagon.
  if ((!cell_id || !run_id) && data.h3_index) {
    const run = await latestRun();
    if (!run) throw new AppError(404, 'No completed prediction run to assign from');
    const cell = await prisma.predictionCell.findFirst({
      where: { run_id: run.run_id, h3_index: data.h3_index },
      orderBy: { created_at: 'desc' },
    });
    if (!cell) throw new AppError(404, `No prediction cell for zone ${data.h3_index}`);
    cell_id = cell.cell_id;
    run_id = cell.run_id;
  }
  if (!cell_id || !run_id) throw new AppError(400, 'cell_id+run_id or h3_index is required');

  const { create } = await import('../assignments/service.js');
  return create({ user_id: data.user_id, cell_id, run_id, time_limit: data.time_limit });
}

/**
 * Permanently remove an officer and everything that references them.
 *
 * Deletion order matters: every FK into `users` is RESTRICT, and assignments are
 * themselves referenced by notifications, validations, pings and unassign
 * requests. Doing this in one transaction means a partial failure leaves nothing
 * half-deleted.
 *
 * Field validations are ground-truth reports, so the caller is told how many
 * were destroyed and the UI warns before confirming.
 */
export async function deleteOfficer(officerId: string, actingAdminId: string) {
  if (officerId === actingAdminId) {
    throw new AppError(400, 'You cannot delete your own account');
  }

  const user = await prisma.user.findUnique({
    where: { id: officerId },
    select: { id: true, name: true, role: true, request_id: true },
  });
  if (!user) throw new AppError(404, 'Officer not found');
  if (user.role === 'admin') {
    throw new AppError(403, 'Admin accounts cannot be deleted from here');
  }

  return prisma.$transaction(async (tx) => {
    const assignmentIds = (
      await tx.assignment.findMany({ where: { user_id: officerId }, select: { id: true } })
    ).map((a) => a.id);

    // Children of assignments first, then anything else pointing at the user.
    const validations = await tx.fieldValidation.deleteMany({
      where: { OR: [{ officer_id: officerId }, { assignment_id: { in: assignmentIds } }] },
    });
    await tx.unassignRequest.deleteMany({
      where: { OR: [{ officer_id: officerId }, { assignment_id: { in: assignmentIds } }] },
    });
    await tx.locationPing.deleteMany({
      where: { OR: [{ user_id: officerId }, { assignment_id: { in: assignmentIds } }] },
    });
    await tx.notification.deleteMany({
      where: { OR: [{ user_id: officerId }, { assignment_id: { in: assignmentIds } }] },
    });
    const assignments = await tx.assignment.deleteMany({ where: { user_id: officerId } });

    // Requests this officer reviewed stay, but must lose the FK.
    await tx.registrationRequest.updateMany({
      where: { reviewed_by: officerId },
      data: { reviewed_by: null },
    });

    await tx.user.delete({ where: { id: officerId } });

    // Their own registration request goes too, so the same person can re-apply.
    if (user.request_id) {
      await tx.registrationRequest.deleteMany({ where: { request_id: user.request_id } });
    }

    return {
      deleted: true,
      officer: { id: user.id, name: user.name },
      removed: {
        assignments: assignments.count,
        field_reports: validations.count,
      },
    };
  });
}
