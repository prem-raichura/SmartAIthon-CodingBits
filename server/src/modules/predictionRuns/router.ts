import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/:id/ingest', controller.ingest);

export default router;
