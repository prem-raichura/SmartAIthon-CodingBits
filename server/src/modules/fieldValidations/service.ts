import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { z } from 'zod';
import type { CreateValidationSchema } from './schema.js';
import type { CongestionSeverity } from '@prisma/client';

export async function create(data: z.infer<typeof CreateValidationSchema>, officerId: string) {
  const assignment = await prisma.assignment.findUnique({ where: { id: data.assignment_id } });
  if (!assignment) throw new AppError(404, 'Assignment not found');
  if (assignment.user_id !== officerId) throw new AppError(403, 'Not your assignment');
  if (assignment.status === 'completed') throw new AppError(400, 'Assignment already validated');

  const existing = await prisma.fieldValidation.findUnique({
    where: { assignment_id: data.assignment_id },
  });
  if (existing) throw new AppError(409, 'Validation already submitted for this assignment');

  return prisma.$transaction(async (tx) => {
    const validation = await tx.fieldValidation.create({
      data: {
        ...data,
        officer_id: officerId,
        congestion_severity: data.congestion_severity as CongestionSeverity | undefined,
      },
    });
    await tx.assignment.update({
      where: { id: data.assignment_id },
      data: { status: 'completed' },
    });
    // Free the officer once the report is in.
    await tx.user.update({ where: { id: officerId }, data: { availability: 'available' } });
    return validation;
  });
}

export async function list(filters: { cell_id?: string; officer_id?: string }) {
  return prisma.fieldValidation.findMany({
    where: {
      ...(filters.cell_id ? { cell_id: filters.cell_id } : {}),
      ...(filters.officer_id ? { officer_id: filters.officer_id } : {}),
    },
    orderBy: { submitted_at: 'desc' },
  });
}

/** Reports enriched with officer + zone context, for the admin portal. */
export async function listDetailed(filters: {
  cell_id?: string;
  officer_id?: string;
  severity?: string;
  limit?: number;
}) {
  const rows = await prisma.fieldValidation.findMany({
    where: {
      ...(filters.cell_id ? { cell_id: filters.cell_id } : {}),
      ...(filters.officer_id ? { officer_id: filters.officer_id } : {}),
      ...(filters.severity && filters.severity !== 'all'
        ? { congestion_severity: filters.severity as CongestionSeverity }
        : {}),
    },
    orderBy: { submitted_at: 'desc' },
    take: Math.min(filters.limit ?? 200, 500),
    include: {
      officer: { select: { id: true, name: true, police_station: true, email: true } },
      cell: {
        select: {
          cell_id: true,
          h3_index: true,
          latitude: true,
          longitude: true,
          risk_level: true,
          predicted_violations: true,
          location: true,
          hotspot_code: true,
        },
      },
      assignment: { select: { id: true, status: true, opened_at: true, time_limit: true } },
    },
  });

  return rows.map((r) => ({
    validation_id: r.validation_id,
    submitted_at: r.submitted_at,
    has_congestion: r.has_congestion,
    congestion_severity: r.congestion_severity,
    dominant_vehicle_type: r.dominant_vehicle_type,
    vehicle_count_approx: r.vehicle_count_approx,
    opinion: r.opinion,
    notes: r.notes,
    latitude: r.latitude,
    longitude: r.longitude,
    photo_url: r.photo_url,
    officer: {
      id: r.officer.id,
      name: r.officer.name,
      email: r.officer.email,
      station: r.officer.police_station,
      badge_id: `BTP-${r.officer.id.slice(-4).toUpperCase()}`,
    },
    zone: {
      cell_id: r.cell.cell_id,
      h3_index: r.cell.h3_index,
      label: r.cell.hotspot_code ?? `Zone ${r.cell.h3_index.slice(-6).toUpperCase()}`,
      location: r.cell.location,
      latitude: r.cell.latitude,
      longitude: r.cell.longitude,
      risk_level: r.cell.risk_level,
      predicted_violations: r.cell.predicted_violations,
    },
    assignment: r.assignment,
  }));
}

/** Headline counts for the admin reports page. */
export async function reportStats() {
  const [total, withCongestion, withPhoto, bySeverity] = await Promise.all([
    prisma.fieldValidation.count(),
    prisma.fieldValidation.count({ where: { has_congestion: true } }),
    prisma.fieldValidation.count({ where: { NOT: { photo_url: null } } }),
    prisma.fieldValidation.groupBy({
      by: ['congestion_severity'],
      _count: { _all: true },
    }),
  ]);

  return {
    total,
    with_congestion: withCongestion,
    with_photo: withPhoto,
    by_severity: Object.fromEntries(
      bySeverity.map((s) => [s.congestion_severity ?? 'none', s._count._all]),
    ),
  };
}
