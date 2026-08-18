import { existsSync } from 'node:fs';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { parsePredictionCsv } from '../../utils/csv.js';
import type { z } from 'zod';
import type { CreateRunSchema } from './schema.js';
import type { PredictionWindow } from '@prisma/client';

export async function create(data: z.infer<typeof CreateRunSchema>) {
  return prisma.predictionRun.create({ data: { ...data, prediction_window: data.prediction_window as PredictionWindow } });
}

export async function list() {
  return prisma.predictionRun.findMany({ orderBy: { created_at: 'desc' } });
}

export async function getById(id: string) {
  const run = await prisma.predictionRun.findUnique({
    where: { run_id: id },
    include: { _count: { select: { cells: true } } },
  });
  if (!run) throw new AppError(404, 'Run not found');
  return run;
}

export async function ingest(runId: string) {
  const run = await prisma.predictionRun.findUnique({ where: { run_id: runId } });
  if (!run) throw new AppError(404, 'Run not found');
  if (run.status !== 'pending') throw new AppError(400, `Run already in status: ${run.status}`);

  // Runs created by the CSV-upload flow store only the original filename in
  // csv_path — there is no file on disk to re-ingest. Fail loudly instead of
  // flipping the run to 'failed' with an opaque ENOENT.
  if (!existsSync(run.csv_path)) {
    throw new AppError(
      400,
      'This run has no readable CSV on disk. It was created by the upload flow and is already ingested.',
    );
  }

  await prisma.predictionRun.update({ where: { run_id: runId }, data: { status: 'processing' } });

  try {
    const rows = await parsePredictionCsv(run.csv_path);
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      await prisma.predictionCell.createMany({
        data: chunk.map((row) => ({
          run_id: runId,
          h3_index: row.h3_index,
          h3_resolution: run.h3_resolution,
          prediction_window: run.prediction_window,
          latitude: row.latitude,
          longitude: row.longitude,
          predicted_violations: row.predicted_violations,
          risk_level: row.risk_level,
        })),
      });
    }
    await prisma.predictionRun.update({
      where: { run_id: runId },
      data: { status: 'done', run_at: new Date() },
    });
    return { ingested: rows.length };
  } catch (err) {
    await prisma.predictionRun.update({ where: { run_id: runId }, data: { status: 'failed' } });
    throw err;
  }
}
