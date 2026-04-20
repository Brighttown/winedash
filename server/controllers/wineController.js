import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { TYPE_MAP } from '../utils/wineTypes.js';
import prisma from '../utils/prisma.js';

const wineSchema = z.object({
    name: z.string().min(1).max(200),
    type: z.enum(['red', 'white', 'rose', 'sparkling', 'dessert']).optional().default('red'),
    region: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    vintage: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional().nullable(),
    grape: z.string().max(200).optional(),
    supplier: z.string().max(200).optional(),
    winery: z.string().max(200).optional().nullable(),
    purchase_price: z.number().min(0).optional(),
    sell_price: z.number().min(0).optional(),
    stock_count: z.number().int().min(0).optional(),
    min_stock_alert: z.number().int().min(0).optional(),
});

export const getAllWines = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const wines = await prisma.wine.findMany({
        where: { company_id },
        orderBy: { name: 'asc' }
    });
    res.json(wines);
});

export const getWineById = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const wine = await prisma.wine.findFirst({
        where: { id: req.params.id, company_id }
    });
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden' });
    res.json(wine);
});

export const createWine = asyncHandler(async (req, res) => {
    const { company_id } = req.user;

    // Normalize type if Dutch label was sent
    if (req.body.type) {
        req.body.type = TYPE_MAP[req.body.type.toLowerCase()] ?? req.body.type;
    }

    const parsed = wineSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const newWine = await prisma.wine.create({
        data: { ...parsed.data, company_id }
    });

    if (parsed.data.stock_count > 0) {
        await prisma.stockMovement.create({
            data: {
                wine_id: newWine.id,
                type: 'adjustment',
                quantity: parsed.data.stock_count,
                note: 'Initial stock'
            }
        });
    }

    res.status(201).json(newWine);
});

export const updateWine = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const { id } = req.params;

    const existing = await prisma.wine.findFirst({ where: { id, company_id } });
    if (!existing) return res.status(404).json({ error: 'Wijn niet gevonden' });

    if (req.body.type) {
        req.body.type = TYPE_MAP[req.body.type.toLowerCase()] ?? req.body.type;
    }

    const parsed = wineSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    if (parsed.data.stock_count !== undefined && parsed.data.stock_count !== existing.stock_count) {
        const diff = parsed.data.stock_count - existing.stock_count;
        await prisma.stockMovement.create({
            data: {
                wine_id: id,
                type: 'adjustment',
                quantity: diff,
                note: 'Manual adjustment'
            }
        });
    }

    const updatedWine = await prisma.wine.update({
        where: { id },
        data: parsed.data
    });

    // Sync metadata changes to WineCatalog (source of truth)
    const catalogId = updatedWine.catalog_id;
    const metadataFields = ['name', 'type', 'region', 'subregion', 'country', 'vintage', 'grape', 'winery', 'bottle_size'];
    const catalogUpdate = Object.fromEntries(
        metadataFields.filter(k => parsed.data[k] !== undefined).map(k => [k, parsed.data[k]])
    );

    if (Object.keys(catalogUpdate).length > 0) {
        if (catalogId) {
            await prisma.wineCatalog.update({ where: { id: catalogId }, data: catalogUpdate }).catch(() => {});
        } else {
            // Try to find catalog entry by name and link it
            const match = await prisma.wineCatalog.findFirst({ where: { name: { equals: updatedWine.name, mode: 'insensitive' } } });
            if (match) {
                await prisma.wineCatalog.update({ where: { id: match.id }, data: catalogUpdate });
                await prisma.wine.update({ where: { id }, data: { catalog_id: match.id } });
            }
        }
    }

    res.json(updatedWine);
});

export const deleteWine = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const { id } = req.params;

    const existing = await prisma.wine.findFirst({ where: { id, company_id } });
    if (!existing) return res.status(404).json({ error: 'Wijn niet gevonden' });

    await prisma.stockMovement.deleteMany({ where: { wine_id: id } });
    await prisma.wine.delete({ where: { id } });

    res.json({ success: true });
});
