import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    parseTextHandler,
    analyzeHandler,
    analyzeStreamHandler,
    matchHandler,
    wijnkaartUploadConfig
} from '../controllers/wijnkaartController.js';

const router = Router();
router.use(requireAuth);

router.post('/parse', wijnkaartUploadConfig.single('file'), parseTextHandler);
router.post('/analyze', analyzeHandler);
router.post('/analyze-stream', analyzeStreamHandler);
router.post('/match', matchHandler);

export default router;
