import express from 'express';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);
router.use(requireAdmin);

// GET all users
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, email: true, name: true, role: true, created_at: true }
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH user role
router.patch('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Ongeldige rol' });
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { role }
        });
        res.json({ id: user.id, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
