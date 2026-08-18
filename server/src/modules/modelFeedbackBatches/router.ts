import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.post('/generate', controller.generate);
router.get('/', controller.list);
router.post('/:id/submit', controller.submit);

export default router;
