import express from 'express';
import {
    getCatalogWines,
    getCatalogWineById,
    createCatalogEntry,
    getUnverifiedCatalog,
    verifyCatalogEntry
} from '../controllers/catalogController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getCatalogWines);
router.get('/:id', getCatalogWineById);

// Users can create (unverified), admins create (verified)
router.post('/', createCatalogEntry);

// Admin only: management
router.get('/admin/unverified', requireAdmin, getUnverifiedCatalog);
router.patch('/admin/verify/:id', requireAdmin, verifyCatalogEntry);

export default router;
