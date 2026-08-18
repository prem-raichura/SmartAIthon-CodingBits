import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { run_id, risk_level, window } = req.query as Record<string, string | undefined>;
  res.json(await service.list({ run_id, risk_level, window }));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.getById(String(req.params.id)));
});
