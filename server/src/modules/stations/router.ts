import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();

// Public: the station list backs the mobile registration picker (pre-auth).
router.get('/master', controller.master);

router.use(requireAuth);
router.get('/nearest', controller.nearest);
router.get('/:id/officers', controller.officers);

export default router;
