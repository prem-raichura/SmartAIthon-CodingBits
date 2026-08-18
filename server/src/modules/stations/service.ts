import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { haversineKm } from '../../utils/geo.js';
import type { OfficerAvailability } from '@prisma/client';

export async function listMaster() {
  return prisma.station.findMany({ orderBy: { name: 'asc' } });
}

export async function nearest(lat: number, lon: number, n = 2) {
  const stations = await prisma.station.findMany();
  return stations
    .map((s: typeof stations[number]) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      latitude: s.latitude,
      longitude: s.longitude,
      distance_km: Number(haversineKm(lat, lon, s.latitude, s.longitude).toFixed(2)),
    }))
    .sort((a: { distance_km: number }, b: { distance_km: number }) => a.distance_km - b.distance_km)
    .slice(0, n);
}

/** Officers physically posted at a station, with live-derived stats. */
export async function stationOfficers(stationId: string, availability?: string) {
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) throw new AppError(404, 'Station not found');

  const officers = await prisma.user.findMany({
    where: {
      role: 'officer',
      is_active: true,
      police_station: station.name,
      ...(availability ? { availability: availability as OfficerAvailability } : {}),
    },
    select: {
      id: true,
      name: true,
      police_station: true,
      availability: true,
      last_lat: true,
      last_lon: true,
    },
    orderBy: { name: 'asc' },
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
    return {
      id: o.id,
      name: o.name,
      badge_id: `BTP-${o.id.slice(-4).toUpperCase()}`,
      station: o.police_station,
      status: o.availability, // available | on_task | off_duty
      last_lat: o.last_lat ?? station.latitude,
      last_lon: o.last_lon ?? station.longitude,
      total_tickets: reports,
      active_assignments: (activeMap.get(o.id) as number) ?? 0,
      approval_rate: 100,
      effectiveness_score: Math.min(100, 50 + reports * 5),
    };
  });
}
