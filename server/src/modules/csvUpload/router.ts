import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './controller.js';

// memoryStorage keeps the upload in RAM — required on serverless (read-only FS).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.post('/', upload.single('file'), controller.upload);
// Body (analytics bundle) parsed by the global express.json({ limit: JSON_BODY_LIMIT }).
router.post('/store', controller.storeBundle);
router.get('/history', controller.getHistory);

export default router;
