import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { parseTextHandler, analyzeHandler, wijnkaartUploadConfig } from '../controllers/wijnkaartController.js';

const router = Router();
router.use(requireAuth);

router.post('/parse', wijnkaartUploadConfig.single('file'), parseTextHandler);
router.post('/analyze', analyzeHandler);

export default router;
