import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './service.js';

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.listMine(req.user!.id));
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.markRead(String(req.params.id), req.user!.id));
});
