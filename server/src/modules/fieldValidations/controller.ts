import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './service.js';
import { CreateValidationSchema } from './schema.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = CreateValidationSchema.parse(req.body);
  res.status(201).json(await service.create(data, req.user!.id));
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { cell_id, officer_id } = req.query as Record<string, string | undefined>;
  // Officers only ever see their own field reports; the officer_id filter is
  // admin-only. Without this any logged-in officer could read every other
  // officer's notes, coordinates and photos.
  const scopedOfficerId = req.user!.role === 'admin' ? officer_id : req.user!.id;
  res.json(await service.list({ cell_id, officer_id: scopedOfficerId }));
});

/** Admin-only: every submitted report, with officer and zone context. */
export const listDetailed = asyncHandler(async (req: Request, res: Response) => {
  const { cell_id, officer_id, severity, limit } = req.query as Record<string, string | undefined>;
  res.json(
    await service.listDetailed({
      cell_id,
      officer_id,
      severity,
      limit: limit ? Number(limit) : undefined,
    }),
  );
});

export const stats = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await service.reportStats());
});
