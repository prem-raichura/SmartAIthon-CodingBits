import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './service.js';

export const dashboard      = asyncHandler(async (_req, res: Response) => { res.json(await service.getDashboard()); });
export const hotspots       = asyncHandler(async (_req, res: Response) => { res.json(await service.getHotspots()); });
export const stations       = asyncHandler(async (_req, res: Response) => { res.json(await service.getStations()); });
export const officers       = asyncHandler(async (_req, res: Response) => { res.json(await service.getOfficers()); });
export const pendingOfficers= asyncHandler(async (_req, res: Response) => { res.json(await service.getPendingOfficers()); });
export const timeseries     = asyncHandler(async (_req, res: Response) => { res.json(await service.getTimeseries()); });
export const funnel         = asyncHandler(async (_req, res: Response) => { res.json(await service.getFunnel()); });
export const violations     = asyncHandler(async (_req, res: Response) => { res.json(await service.getViolations()); });
export const vehicles       = asyncHandler(async (_req, res: Response) => { res.json(await service.getVehicles()); });
export const edi            = asyncHandler(async (_req, res: Response) => { res.json(await service.getEdi()); });
export const activity       = asyncHandler(async (_req, res: Response) => { res.json(await service.getActivity()); });

export const approveOfficer = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.approveOfficer(String(req.params.id), req.user!.id));
});
export const rejectOfficer  = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.rejectOfficer(String(req.params.id), req.user!.id));
});
export const assignOfficer  = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await service.assignOfficer(req.body));
});
