import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../utils/prisma.js';

const catalogSchema = z.object({
    name: z.string().min(1).max(200),
    type: z.enum(['red', 'white', 'rose', 'sparkling', 'dessert']).optional(),
    region: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    vintage: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional().nullable(),
    grape: z.string().max(200).optional().nullable(),
    winery: z.string().max(200).optional().nullable(),
});

export const getCatalogWines = asyncHandler(async (req, res) => {
    const { search } = req.query;
    const catalog = await prisma.wineCatalog.findMany({
        where: search ? {
            OR: [
                { name: { contains: search } },
                { region: { contains: search } },
                { grape: { contains: search } }
            ]
        } : {},
        orderBy: { name: 'asc' }
    });
    res.json(catalog);
});

export const getCatalogWineById = asyncHandler(async (req, res) => {
    const wine = await prisma.wineCatalog.findUnique({
        where: { id: req.params.id }
    });
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden in catalogus' });
    res.json(wine);
});

export const createCatalogEntry = asyncHandler(async (req, res) => {
    const parsed = catalogSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { name, ...rest } = parsed.data;
    const is_verified = req.user.role === 'admin';

    const wine = await prisma.wineCatalog.upsert({
        where: { name },
        update: {},
        create: { name, ...rest, is_verified }
    });
    res.status(201).json(wine);
});

export const getUnverifiedCatalog = asyncHandler(async (req, res) => {
    const catalog = await prisma.wineCatalog.findMany({
        where: { is_verified: false },
        orderBy: { created_at: 'desc' }
    });
    res.json(catalog);
});

export const verifyCatalogEntry = asyncHandler(async (req, res) => {
    const wine = await prisma.wineCatalog.update({
        where: { id: req.params.id },
        data: { is_verified: true }
    });
    res.json(wine);
});
