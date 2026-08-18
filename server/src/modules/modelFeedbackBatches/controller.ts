import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './service.js';
import { GenerateBatchSchema } from './schema.js';

export const generate = asyncHandler(async (req: Request, res: Response) => {
  const { month, model_version } = GenerateBatchSchema.parse(req.body);
  res.status(201).json(await service.generate(month, model_version));
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await service.list());
});

export const submit = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.submit(String(req.params.id)));
});
