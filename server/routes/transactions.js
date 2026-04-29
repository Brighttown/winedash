import express from 'express';
import { listTransactions } from '../controllers/transactionsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.get('/', listTransactions);

export default router;
