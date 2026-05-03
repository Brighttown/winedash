import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getMe,
    updateProfile,
    updatePassword,
    updateCompany,
} from '../controllers/accountController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/me', getMe);
router.patch('/profile', updateProfile);
router.patch('/password', updatePassword);
router.patch('/company', updateCompany);

export default router;
