import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole('admin'), controller.list);
router.post('/:id/approve', requireRole('admin'), controller.approve);
router.post('/:id/reject', requireRole('admin'), controller.reject);

export default router;
