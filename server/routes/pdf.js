import express from 'express';
import { generateWineList } from '../controllers/pdfController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.post('/winelist', generateWineList);

export default router;
