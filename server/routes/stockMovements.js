import express from 'express';
import { getMovements, createMovement, updateMovement, revertMovement } from '../controllers/stockMovementController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', getMovements);
router.post('/', createMovement);
router.put('/:id', updateMovement);
router.delete('/:id', revertMovement);

export default router;
