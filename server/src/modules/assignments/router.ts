import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './controller.js';
import * as unassign from '../unassignRequests/controller.js';

const router = Router();

// /me must come before /:id
router.get('/me', requireAuth, requireRole('officer'), controller.listMine);

router.post('/', requireAuth, requireRole('admin'), controller.create);
router.get('/', requireAuth, requireRole('admin'), controller.listAll);
router.get('/:id', requireAuth, controller.getById);
router.patch('/:id', requireAuth, controller.patch);
router.post('/:id/cancel', requireAuth, requireRole('admin'), controller.cancel);
router.post('/:id/unassign-request', requireAuth, requireRole('officer'), unassign.createForAssignment);

export default router;
