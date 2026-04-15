import express from 'express';
import { uploadConfig, processInvoiceUpload } from '../controllers/uploadController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.post('/invoice', uploadConfig.single('file'), processInvoiceUpload);

export default router;
