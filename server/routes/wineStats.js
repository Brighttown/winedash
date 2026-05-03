import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getWineStats } from '../controllers/wineStatsController.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);
router.get('/', getWineStats);

export default router;
