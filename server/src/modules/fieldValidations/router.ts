import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();

router.post('/', requireAuth, requireRole('officer'), controller.create);
router.get('/', requireAuth, controller.list);

// Admin portal: full report feed + headline counts.
router.get('/detailed', requireAuth, requireRole('admin'), controller.listDetailed);
router.get('/stats', requireAuth, requireRole('admin'), controller.stats);

export default router;
