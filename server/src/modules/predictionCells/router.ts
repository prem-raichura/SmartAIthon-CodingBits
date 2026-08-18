import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.getById);

export default router;
