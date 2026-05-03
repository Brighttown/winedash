import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    listWineMappings,
    upsertWineMapping,
    deleteWineMapping,
} from '../controllers/posSyncController.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', listWineMappings);
router.put('/', upsertWineMapping);
router.delete('/:mappingId', deleteWineMapping);

export default router;
