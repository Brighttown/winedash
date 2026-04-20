import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { extractWijnkaartHandler, wijnkaartUploadConfig } from '../controllers/wijnkaartController.js';

const router = Router();
router.use(requireAuth);

router.post('/extract', wijnkaartUploadConfig.single('file'), extractWijnkaartHandler);

export default router;
