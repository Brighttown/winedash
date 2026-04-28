import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    previewExport,
    generatePdf,
} from '../controllers/wineExportController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/templates', listTemplates);
router.post('/templates', createTemplate);
router.get('/templates/:id', getTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

router.post('/preview', previewExport);
router.post('/pdf', generatePdf);

export default router;
