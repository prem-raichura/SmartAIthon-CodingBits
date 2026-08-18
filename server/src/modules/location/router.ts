import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();
router.use(requireAuth);

router.post('/ping', requireRole('officer'), controller.ping);
router.get('/breaches', requireRole('admin'), controller.breaches);

export default router;
