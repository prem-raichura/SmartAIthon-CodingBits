import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './service.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.list(req.query.status as string | undefined);
  res.json(result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getById(String(req.params.id));
  res.json(result);
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.approve(String(req.params.id), req.user!.id);
  res.json(result);
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.reject(String(req.params.id), req.user!.id);
  res.json(result);
});
