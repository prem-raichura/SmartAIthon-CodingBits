import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();

router.post('/me/push-token', requireAuth, requireRole('officer'), controller.savePushToken);
router.patch('/me', requireAuth, controller.updateMe);

router.use(requireAuth, requireRole('admin'));
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.patch('/:id', controller.patch);

export default router;
