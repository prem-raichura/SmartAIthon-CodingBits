import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/me', requireAuth, controller.me);
router.post('/change-password', requireAuth, controller.changePassword);

export default router;
