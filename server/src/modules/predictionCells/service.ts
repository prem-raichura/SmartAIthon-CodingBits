import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import type { RiskLevel, PredictionWindow } from '@prisma/client';

export async function list(filters: { run_id?: string; risk_level?: string; window?: string }) {
  return prisma.predictionCell.findMany({
    where: {
      ...(filters.run_id ? { run_id: filters.run_id } : {}),
      ...(filters.risk_level ? { risk_level: filters.risk_level as RiskLevel } : {}),
      ...(filters.window ? { prediction_window: filters.window as PredictionWindow } : {}),
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getById(id: string) {
  const cell = await prisma.predictionCell.findUnique({ where: { cell_id: id } });
  if (!cell) throw new AppError(404, 'Cell not found');
  return cell;
}
