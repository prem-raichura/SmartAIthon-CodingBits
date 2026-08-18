import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';

export function signToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): { id: string; role: string } {
  try {
    return jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
}
