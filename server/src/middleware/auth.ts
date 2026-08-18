import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from './error.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Unauthorized');
    req.user = verifyToken(header.slice(7));
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user || !roles.includes(req.user.role)) throw new AppError(403, 'Forbidden');
      next();
    } catch (err) {
      next(err);
    }
  };
}
