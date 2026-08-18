import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.listMine);
router.patch('/:id/read', controller.markRead);

export default router;
