import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { TYPE_MAP } from '../utils/wineTypes.js';
import prisma from '../utils/prisma.js';

// Fields that live on WineCatalog (shared metadata)
const CATALOG_FIELDS = ['name', 'type', 'region', 'subregion', 'country', 'grape', 'winery', 'bottle_size'];

// Fields that live on Wine (per-account stock data)
const WINE_FIELDS = ['vintage', 'supplier', 'purchase_price', 'sell_price', 'stock_count', 'min_stock_alert'];

const wineSchema = z.object({
    // Catalog metadata
    name: z.string().min(1).max(200).optional(),
    type: z.enum(['red', 'white', 'rose', 'sparkling', 'dessert']).optional(),
    region: z.string().max(100).optional(),
    subregion: z.string().max(100).optional().nullable(),
    country: z.string().max(100).optional(),
    grape: z.string().max(200).optional().nullable(),
    winery: z.string().max(200).optional().nullable(),
    bottle_size: z.string().max(50).optional().nullable(),
    // Account-specific
    catalog_id: z.string().optional(),
    vintage: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional().nullable(),
    supplier: z.string().max(200).optional().nullable(),
    purchase_price: z.number().min(0).optional(),
    sell_price: z.number().min(0).optional().nullable(),
    stock_count: z.number().int().min(0).optional(),
    min_stock_alert: z.number().int().min(0).optional(),
});

// Returns a flat wine object combining catalog metadata + wine stock data
const flattenWine = (wine) => ({
    id: wine.id,
    catalog_id: wine.catalog_id,
    company_id: wine.company_id,
    created_at: wine.created_at,
    // From catalog
    name: wine.catalog.name,
    type: wine.catalog.type,
    region: wine.catalog.region,
    subregion: wine.catalog.subregion,
    country: wine.catalog.country,
    grape: wine.catalog.grape,
    winery: wine.catalog.winery,
    bottle_size: wine.catalog.bottle_size,
    image_url: wine.catalog.image_url,
    // Account-specific
    vintage: wine.vintage,
    supplier: wine.supplier,
    purchase_price: wine.purchase_price,
    sell_price: wine.sell_price,
    stock_count: wine.stock_count,
    min_stock_alert: wine.min_stock_alert,
    days_in_stock: wine.days_in_stock,
});

const WITH_CATALOG = { catalog: true };

export const getAllWines = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const wines = await prisma.wine.findMany({
        where: { company_id },
        include: WITH_CATALOG,
        orderBy: { catalog: { name: 'asc' } }
    });
    res.json(wines.map(flattenWine));
});

export const getWineById = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const wine = await prisma.wine.findFirst({
        where: { id: req.params.id, company_id },
        include: WITH_CATALOG
    });
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden' });
    res.json(flattenWine(wine));
});

export const createWine = asyncHandler(async (req, res) => {
    const { company_id } = req.user;

    if (req.body.type) {
        req.body.type = TYPE_MAP[req.body.type.toLowerCase()] ?? req.body.type;
    }

    const parsed = wineSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const d = parsed.data;

    // Resolve or create catalog entry
    let catalogId = d.catalog_id;
    if (!catalogId) {
        if (!d.name) return res.status(400).json({ error: 'Naam is verplicht' });
        const catalog = await prisma.wineCatalog.upsert({
            where: { name: d.name.trim() },
            update: {
                ...(d.type    && { type: d.type }),
                ...(d.region  && { region: d.region }),
                ...(d.country && { country: d.country }),
                ...(d.grape   !== undefined && { grape: d.grape }),
                ...(d.winery  !== undefined && { winery: d.winery }),
                ...(d.subregion !== undefined && { subregion: d.subregion }),
                ...(d.bottle_size !== undefined && { bottle_size: d.bottle_size }),
            },
            create: {
                name:        d.name.trim(),
                type:        d.type || 'red',
                region:      d.region || 'Onbekend',
                country:     d.country || 'Onbekend',
                grape:       d.grape ?? null,
                winery:      d.winery ?? null,
                subregion:   d.subregion ?? null,
                bottle_size: d.bottle_size ?? null,
                is_verified: false,
            }
        });
        catalogId = catalog.id;
    }

    const newWine = await prisma.wine.create({
        data: {
            catalog_id:     catalogId,
            company_id,
            vintage:        d.vintage ?? null,
            supplier:       d.supplier ?? null,
            purchase_price: d.purchase_price ?? 0,
            sell_price:     d.sell_price ?? null,
            stock_count:    d.stock_count ?? 0,
            min_stock_alert: d.min_stock_alert ?? 0,
        },
        include: WITH_CATALOG
    });

    if (newWine.stock_count > 0) {
        await prisma.stockMovement.create({
            data: { wine_id: newWine.id, type: 'adjustment', quantity: newWine.stock_count, note: 'Initial stock' }
        });
    }

    res.status(201).json(flattenWine(newWine));
});

export const updateWine = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const { id } = req.params;

    const existing = await prisma.wine.findFirst({ where: { id, company_id } });
    if (!existing) return res.status(404).json({ error: 'Wijn niet gevonden' });

    if (req.body.type) {
        req.body.type = TYPE_MAP[req.body.type.toLowerCase()] ?? req.body.type;
    }

    const parsed = wineSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const d = parsed.data;

    // Split into catalog metadata vs wine stock fields
    const catalogData = Object.fromEntries(
        CATALOG_FIELDS.filter(k => d[k] !== undefined).map(k => [k, d[k]])
    );
    const wineData = Object.fromEntries(
        WINE_FIELDS.filter(k => d[k] !== undefined).map(k => [k, d[k]])
    );

    // Stock movement when stock_count changes
    if (wineData.stock_count !== undefined && wineData.stock_count !== existing.stock_count) {
        const diff = wineData.stock_count - existing.stock_count;
        await prisma.stockMovement.create({
            data: { wine_id: id, type: 'adjustment', quantity: diff, note: 'Manual adjustment' }
        });
    }

    // Update catalog metadata (source of truth)
    if (Object.keys(catalogData).length > 0) {
        await prisma.wineCatalog.update({ where: { id: existing.catalog_id }, data: catalogData });
    }

    // Update wine stock data
    const updatedWine = await prisma.wine.update({
        where: { id },
        data: Object.keys(wineData).length > 0 ? wineData : {},
        include: WITH_CATALOG
    });

    res.json(flattenWine(updatedWine));
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
