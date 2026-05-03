import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    listIntegrations,
    createIntegration,
    updateIntegration,
    deleteIntegration,
} from '../controllers/integrationController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', listIntegrations);
router.post('/', createIntegration);
router.patch('/:id', updateIntegration);
router.delete('/:id', deleteIntegration);

export default router;
