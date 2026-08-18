import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './service.js';
import { CreateRunSchema } from './schema.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = CreateRunSchema.parse(req.body);
  res.status(201).json(await service.create(data));
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await service.list());
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.getById(String(req.params.id)));
});

export const ingest = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.ingest(String(req.params.id));
  res.json(result);
});
