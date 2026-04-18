import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../utils/prisma.js';

const movementSchema = z.object({
    type: z.enum(['purchase', 'sale', 'adjustment']),
    quantity: z.number().int().refine(n => n !== 0, { message: 'Aantal mag niet nul zijn' }),
    note: z.string().max(500).optional(),
});

// GET /api/wines/:wineId/movements
export const getMovements = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const { wineId } = req.params;

    const wine = await prisma.wine.findFirst({ where: { id: wineId, company_id } });
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden' });

    const movements = await prisma.stockMovement.findMany({
        where: { wine_id: wineId },
        orderBy: { created_at: 'desc' },
    });

    res.json({ wine, movements });
});

// POST /api/wines/:wineId/movements
export const createMovement = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const { wineId } = req.params;

    const wine = await prisma.wine.findFirst({ where: { id: wineId, company_id } });
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden' });

    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

    const { type, quantity, note } = parsed.data;

    // Purchase is always positive, sale always negative, adjustment keeps sign
    let finalQty = quantity;
    if (type === 'purchase') finalQty = Math.abs(quantity);
    if (type === 'sale') finalQty = -Math.abs(quantity);

    const [movement] = await prisma.$transaction([
        prisma.stockMovement.create({
            data: { wine_id: wineId, type, quantity: finalQty, note },
        }),
        prisma.wine.update({
            where: { id: wineId },
            data: { stock_count: { increment: finalQty } },
        }),
    ]);

    res.status(201).json(movement);
});

// PUT /api/wines/:wineId/movements/:id
export const updateMovement = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const { wineId, id } = req.params;

    const wine = await prisma.wine.findFirst({ where: { id: wineId, company_id } });
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden' });

    const existing = await prisma.stockMovement.findFirst({ where: { id, wine_id: wineId } });
    if (!existing) return res.status(404).json({ error: 'Mutatie niet gevonden' });

    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

    const { type, quantity, note } = parsed.data;

    let finalQty = quantity;
    if (type === 'purchase') finalQty = Math.abs(quantity);
    if (type === 'sale') finalQty = -Math.abs(quantity);

    // Difference between new and old quantity to adjust stock
    const diff = finalQty - existing.quantity;

    const [movement] = await prisma.$transaction([
        prisma.stockMovement.update({
            where: { id },
            data: { type, quantity: finalQty, note },
        }),
        prisma.wine.update({
            where: { id: wineId },
            data: { stock_count: { increment: diff } },
        }),
    ]);

    res.json(movement);
});

// DELETE /api/wines/:wineId/movements/:id  (revert = undo the movement)
export const revertMovement = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const { wineId, id } = req.params;

    const wine = await prisma.wine.findFirst({ where: { id: wineId, company_id } });
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden' });

    const existing = await prisma.stockMovement.findFirst({ where: { id, wine_id: wineId } });
    if (!existing) return res.status(404).json({ error: 'Mutatie niet gevonden' });

    await prisma.$transaction([
        prisma.wine.update({
            where: { id: wineId },
            data: { stock_count: { increment: -existing.quantity } },
        }),
        prisma.stockMovement.delete({ where: { id } }),
    ]);

    res.json({ success: true });
});
