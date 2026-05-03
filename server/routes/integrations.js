import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    listIntegrations,
    createIntegration,
    updateIntegration,
    deleteIntegration,
} from '../controllers/integrationController.js';
import { syncCatalog, listCatalogItems } from '../controllers/posSyncController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', listIntegrations);
router.post('/', createIntegration);
router.patch('/:id', updateIntegration);
router.delete('/:id', deleteIntegration);

router.post('/:id/sync-catalog', syncCatalog);
router.get('/:id/catalog-items', listCatalogItems);

export default router;
