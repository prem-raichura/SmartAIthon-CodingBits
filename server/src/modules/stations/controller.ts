import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../middleware/error.js';
import * as service from './service.js';

export const master = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await service.listMaster());
});

export const nearest = asyncHandler(async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const n = req.query.n ? Number(req.query.n) : 2;
  if (Number.isNaN(lat) || Number.isNaN(lon)) throw new AppError(400, 'lat and lon are required');
  res.json(await service.nearest(lat, lon, n));
});

export const officers = asyncHandler(async (req: Request, res: Response) => {
  const { availability } = req.query as { availability?: string };
  res.json(await service.stationOfficers(String(req.params.id), availability));
});
