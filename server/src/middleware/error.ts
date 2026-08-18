import type { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(422).json({ error: 'Validation error', details: err.issues });
  }
  // Multer rejects oversized/invalid uploads — a client mistake, not a 500.
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : `Upload error: ${err.message}`;
    return res.status(400).json({ error: message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
