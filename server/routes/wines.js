import express from 'express';
import { getAllWines, getWineById, createWine, updateWine, deleteWine } from '../controllers/wineController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getAllWines);
router.get('/:id', getWineById);
router.post('/', createWine);
router.put('/:id', updateWine);
router.delete('/:id', deleteWine);

export default router;
