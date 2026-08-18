import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './service.js';
import { PatchUserSchema, PushTokenSchema, UpdateMeSchema } from './schema.js';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await service.list());
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.getById(String(req.params.id)));
});

export const patch = asyncHandler(async (req: Request, res: Response) => {
  const data = PatchUserSchema.parse(req.body);
  res.json(await service.patch(String(req.params.id), data));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const data = UpdateMeSchema.parse(req.body);
  res.json(await service.updateMe(req.user!.id, data));
});

export const savePushToken = asyncHandler(async (req: Request, res: Response) => {
  const { push_token } = PushTokenSchema.parse(req.body);
  res.json(await service.savePushToken(req.user!.id, push_token));
});
