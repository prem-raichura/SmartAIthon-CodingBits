import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error.js';
import * as controller from './controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      // AppError so the handler answers 400 rather than a generic 500.
      cb(new AppError(400, 'Only image files allowed'));
    } else {
      cb(null, true);
    }
  },
});

const router = Router();
router.post('/', requireAuth, requireRole('officer'), upload.single('photo'), controller.uploadPhoto);
export default router;
