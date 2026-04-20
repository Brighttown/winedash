import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ocrInvoiceFile } from '../utils/ocr.js';
import { extractInvoice, suggestWineMetadata } from '../utils/llmClient.js';
import { matchLines, matchInventoryLines } from '../utils/catalogMatcher.js';
import { TYPE_MAP } from '../utils/wineTypes.js';
import prisma from '../utils/prisma.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const SESSION_TTL_MS = 30 * 60 * 1000;

// In-memory session store (same pattern as excelController.rowStore)
const sessionStore = new Map();

// ─── Multer config ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads';
        if (!existsSync(dir)) mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `invoice_${Date.now()}${path.extname(file.originalname)}`);
    }
});

export const invoiceUploadConfig = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
        cb(new Error("Alleen afbeeldingsbestanden (JPG, PNG) en PDF's zijn toegestaan"));
    }
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/invoice/extract
 * Multipart upload → OCR → LLM extractie → fuzzy match → sessionId.
 */
export const extractInvoiceHandler = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Geen bestand geüpload' });

    const { company_id } = req.user;

    try {
        const ocrText = await ocrInvoiceFile(req.file.path, req.file.originalname);
        console.log('[invoice] OCR tekst (eerste 500 tekens):', ocrText.slice(0, 500));

        const extracted = await extractInvoice(ocrText);
        console.log('[invoice] LLM extractie:', JSON.stringify(extracted, null, 2));

        const lines = Array.isArray(extracted.lines) ? extracted.lines : [];
        const catalogMatches = await matchLines(lines);
        const inventoryMatches = await matchInventoryLines(lines, company_id);

        // Prefer catalog match; fall back to inventory match
        const enrichedLines = lines.map((line, i) => ({
            ...line,
            match: catalogMatches[i].matched ? catalogMatches[i] : inventoryMatches[i]
        }));

        const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        sessionStore.set(sessionId, {
            supplier: extracted.supplier || '',
            invoice_date: extracted.invoice_date || null,
            lines: enrichedLines
        });
        setTimeout(() => sessionStore.delete(sessionId), SESSION_TTL_MS);

        res.json({
            sessionId,
            supplier: extracted.supplier || '',
            invoice_date: extracted.invoice_date || null,
            lines: enrichedLines
        });
    } finally {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
    }
});

/**
 * POST /api/invoice/suggest
 * Body: { name, vintage?, producer? }
 * Returns LLM-suggested catalog metadata. Stateless: client provides the line info.
 */
export const suggestLineHandler = asyncHandler(async (req, res) => {
    const { name, vintage, producer } = req.body || {};
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Wijnnaam is verplicht.' });
    }
    const suggestion = await suggestWineMetadata({ name, vintage, producer });
    res.json(suggestion);
});

/**
 * POST /api/invoice/confirm
 * Body: { supplier, decisions: [{ line: {name, vintage, producer, type_hint, ...}, action, catalogId?, newCatalog?, wineOverrides? }] }
 *  action: 'link-existing' | 'create-catalog' | 'skip'
 * Stateless — client sends line data directly.
 */
export const confirmInvoiceHandler = asyncHandler(async (req, res) => {
    const { supplier, decisions } = req.body;
    const { company_id } = req.user;

    if (!Array.isArray(decisions)) {
        return res.status(400).json({ error: 'Ongeldige gegevens: decisions vereist.' });
    }

    const supplierName = (supplier || 'Factuur Import').trim() || 'Factuur Import';

    const result = await prisma.$transaction(async (tx) => {
        let createdCatalog = 0;
        let createdWines = 0;
        let updatedWines = 0;
        let movements = 0;

        for (const decision of decisions) {
            if (decision.action === 'skip') continue;

            const line = decision.line || {};
            if (!line.name) continue;

            const quantity = Number(decision.wineOverrides?.quantity ?? line.quantity) || 0;
            if (quantity <= 0) continue;

            const purchasePrice = Number(decision.wineOverrides?.purchase_price ?? line.unit_price) || 0;
            const sellPrice = decision.wineOverrides?.sell_price != null && decision.wineOverrides.sell_price !== ''
                ? Number(decision.wineOverrides.sell_price)
                : null;
            const rawVintage = decision.wineOverrides?.vintage ?? line.vintage;
            const vintage = rawVintage ? Number(rawVintage) : null;

            // ── update-stock: direct voorraad bijwerken op bestaande wijn ───────
            if (decision.action === 'update-stock' && decision.wineId) {
                const existing = await tx.wine.findFirst({ where: { id: decision.wineId, company_id } });
                if (!existing) throw new Error(`Wijn niet gevonden: ${decision.wineId}`);
                await tx.wine.update({
                    where: { id: existing.id },
                    data: {
                        stock_count: { increment: quantity },
                        purchase_price: purchasePrice || existing.purchase_price,
                        supplier: supplierName
                    }
                });
                await tx.stockMovement.create({
                    data: { wine_id: existing.id, type: 'purchase', quantity, note: `Factuur-import: ${supplierName}` }
                });
                updatedWines++;
                movements++;
                continue;
            }

            // Resolve catalog entry (either existing or newly created)
            let catalog = null;
            if (decision.action === 'link-existing' && decision.catalogId) {
                catalog = await tx.wineCatalog.findUnique({ where: { id: decision.catalogId } });
                if (!catalog) throw new Error(`Catalog entry ${decision.catalogId} niet gevonden.`);
            } else if (decision.action === 'create-catalog') {
                const nc = decision.newCatalog || {};
                const rawType = String(nc.type || line.type_hint || 'red').toLowerCase();
                const type = TYPE_MAP[rawType] || 'red';

                catalog = await tx.wineCatalog.upsert({
                    where: { name: String(nc.name || line.name).trim() },
                    update: {},
                    create: {
                        name: String(nc.name || line.name).trim(),
                        type,
                        region: String(nc.region || 'Onbekend').trim(),
                        subregion: nc.subregion ? String(nc.subregion).trim() : null,
                        country: String(nc.country || 'Onbekend').trim(),
                        vintage: nc.vintage ? Number(nc.vintage) : (vintage || null),
                        grape: nc.grape ? String(nc.grape).trim() : null,
                        bottle_size: nc.bottle_size ? String(nc.bottle_size).trim() : (line.bottle_size || null),
                        winery: nc.winery ? String(nc.winery).trim() : (line.producer || null),
                        is_verified: false
                    }
                });
                createdCatalog++;
            }

            if (!catalog) continue; // skip if no catalog entry could be resolved

            // Check for existing stock entry (same catalog + company + vintage)
            const existing = await tx.wine.findFirst({
                where: { company_id, catalog_id: catalog.id, vintage }
            });

            let wineId;
            if (existing) {
                const updated = await tx.wine.update({
                    where: { id: existing.id },
                    data: {
                        stock_count: { increment: quantity },
                        purchase_price: purchasePrice || existing.purchase_price,
                        sell_price: sellPrice || existing.sell_price,
                        supplier: supplierName,
                    }
                });
                wineId = updated.id;
                updatedWines++;
            } else {
                const created = await tx.wine.create({
                    data: {
                        catalog_id: catalog.id,
                        vintage,
                        supplier: supplierName,
                        purchase_price: purchasePrice,
                        sell_price: sellPrice,
                        stock_count: quantity,
                        min_stock_alert: 0,
                        company_id
                    }
                });
                wineId = created.id;
                createdWines++;
            }

            await tx.stockMovement.create({
                data: {
                    wine_id: wineId,
                    type: 'purchase',
                    quantity,
                    note: `Factuur-import: ${supplierName}`
                }
            });
            movements++;
        }

        return { createdCatalog, createdWines, updatedWines, movements };
    }, { timeout: 60000 });

    res.json({ success: true, ...result });
});
