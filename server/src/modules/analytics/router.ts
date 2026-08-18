import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();
router.use(requireAuth);

// Read-model endpoints matching client ENDPOINTS exactly
router.get('/dashboard',       controller.dashboard);
router.get('/hotspots',        controller.hotspots);
router.get('/stations',        controller.stations);
router.get('/officers',        controller.officers);
router.get('/officers/pending',controller.pendingOfficers);
router.get('/timeseries',      controller.timeseries);
router.get('/funnel',          controller.funnel);
router.get('/violations',      controller.violations);
router.get('/vehicles',        controller.vehicles);
router.get('/edi/explanations',controller.edi);
router.get('/activity',        controller.activity);

// Officer action proxies (keep client ENDPOINTS 1:1)
router.post('/officers/approve/:id', requireRole('admin'), controller.approveOfficer);
router.post('/officers/reject/:id',  requireRole('admin'), controller.rejectOfficer);
router.post('/officers/assign',      requireRole('admin'), controller.assignOfficer);

export default router;
