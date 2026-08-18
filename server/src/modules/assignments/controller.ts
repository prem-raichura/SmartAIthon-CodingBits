import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './service.js';
import { CreateAssignmentSchema, PatchAssignmentSchema } from './schema.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = CreateAssignmentSchema.parse(req.body);
  res.status(201).json(await service.create(data));
});

export const listAll = asyncHandler(async (req: Request, res: Response) => {
  const { user_id, status } = req.query as Record<string, string | undefined>;
  res.json(await service.listAll({ user_id, status }));
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as { status?: string };
  res.json(await service.listMine(req.user!.id, status));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.getById(String(req.params.id), req.user!.id, req.user!.role));
});

export const patch = asyncHandler(async (req: Request, res: Response) => {
  const { action } = PatchAssignmentSchema.parse(req.body);
  res.json(await service.patch(String(req.params.id), action, req.user!.id, req.user!.role));
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
  res.json(await service.cancel(String(req.params.id), reason));
});
