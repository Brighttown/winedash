import express from 'express';
import { previewExcelImport, confirmExcelImport, confirmCatalogImport, excelUploadConfig } from '../controllers/excelController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.post('/preview', excelUploadConfig.single('file'), previewExcelImport);
// Regular users: import to personal stock
router.post('/confirm', confirmExcelImport);
// Admin only: import to global WineCatalog
router.post('/confirm-catalog', requireAdmin, confirmCatalogImport);

export default router;
