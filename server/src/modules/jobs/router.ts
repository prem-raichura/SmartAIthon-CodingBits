import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { env } from '../../config/env.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runReminders } from '../../jobs/reminders.js';

const router = Router();

/**
 * Allows either an admin JWT or a platform scheduler presenting CRON_SECRET.
 *
 * On a serverless host the in-process node-cron never runs (only src/index.ts
 * starts it), so the sweep has to be driven by an external scheduler such as
 * Vercel Cron — which cannot log in. The secret may arrive as
 * `Authorization: Bearer <secret>` (Vercel Cron's format) or `x-cron-secret`.
 */
function requireAdminOrCronSecret(req: Request, res: Response, next: NextFunction) {
  const secret = env.CRON_SECRET;
  if (secret) {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const provided = (req.headers['x-cron-secret'] as string | undefined) ?? bearer;
    if (provided && provided === secret) return next();
  }
  // Fall back to normal admin auth.
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(new AppError(401, 'Unauthorized'));
    requireRole('admin')(req, res, next);
  });
}

// Overdue-reminder sweep. Triggered by an admin, or by a scheduler with CRON_SECRET.
router.post(
  '/reminders/run',
  requireAdminOrCronSecret,
  asyncHandler(async (_req: Request, res: Response) => {
    const sent = await runReminders();
    res.json({ ok: true, sent });
  }),
);

// GET variant: Vercel Cron issues GET requests.
router.get(
  '/reminders/run',
  requireAdminOrCronSecret,
  asyncHandler(async (_req: Request, res: Response) => {
    const sent = await runReminders();
    res.json({ ok: true, sent });
  }),
);

export default router;
