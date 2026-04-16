import express from 'express';
import {
    invoiceUploadConfig,
    extractInvoiceHandler,
    suggestLineHandler,
    confirmInvoiceHandler
} from '../controllers/invoiceController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.post('/extract', invoiceUploadConfig.single('file'), extractInvoiceHandler);
router.post('/suggest', suggestLineHandler);
router.post('/confirm', confirmInvoiceHandler);

export default router;
