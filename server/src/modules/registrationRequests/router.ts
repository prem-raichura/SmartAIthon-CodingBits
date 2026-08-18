import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/:id/approve', controller.approve);
router.post('/:id/reject', controller.reject);

export default router;
