import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runReminders } from '../../jobs/reminders.js';

const router = Router();

// Manual trigger for the overdue-reminder sweep (handy for testing).
router.post(
  '/reminders/run',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const sent = await runReminders();
    res.json({ ok: true, sent });
  }),
);

export default router;
