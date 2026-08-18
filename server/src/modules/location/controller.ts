import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './service.js';

const PingSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  assignment_id: z.string().uuid().optional(),
});

export const ping = asyncHandler(async (req: Request, res: Response) => {
  const data = PingSchema.parse(req.body);
  res.json(await service.ping(req.user!.id, data));
});

export const breaches = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await service.breaches());
});
