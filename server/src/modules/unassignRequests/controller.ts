import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../middleware/error.js';
import * as service from './service.js';

// Mounted on the assignments router: POST /assignments/:id/unassign-request (officer)
export const createForAssignment = asyncHandler(async (req: Request, res: Response) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) throw new AppError(400, 'A reason is required');
  res.status(201).json(await service.createRequest(String(req.params.id), req.user!.id, reason));
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as { status?: string };
  res.json(await service.list(status));
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.approve(String(req.params.id), req.user!.id));
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.reject(String(req.params.id), req.user!.id));
});
