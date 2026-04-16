import multer from 'multer';
import path from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import { TYPE_MAP } from '../utils/wineTypes.js';
import prisma from '../utils/prisma.js';

const ALLOWED_EXCEL_EXT = new Set(['.xlsx', '.xls', '.csv']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// In-memory store for parsed rows (keyed by session id)
// Fine for single-server local use; replace with Redis for production
const rowStore = new Map();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads';
        if (!existsSync(dir)) mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `import_${Date.now()}${path.extname(file.originalname)}`);
    }
});

export const excelUploadConfig = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXCEL_EXT.has(ext)) return cb(null, true);
        cb(new Error('Alleen Excel (.xlsx, .xls) of CSV bestanden zijn toegestaan.'));
    }
});

export const previewExcelImport = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Geen bestand geüpload' });

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        unlinkSync(req.file.path);

        if (rows.length === 0) return res.status(400).json({ error: 'Het bestand bevat geen rijen.' });

        const columns = Object.keys(rows[0]);
        const preview = rows.slice(0, 5);

        const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        rowStore.set(sessionId, rows);
        setTimeout(() => rowStore.delete(sessionId), 30 * 60 * 1000);

        res.json({ columns, preview, totalRows: rows.length, sessionId });
    } catch (error) {
        console.error('Excel Preview Error:', error);
        res.status(500).json({ error: 'Fout bij lezen van het Excel-bestand.' });
    }
};

export const confirmExcelImport = async (req, res) => {
    try {
        const { sessionId, mapping } = req.body;

        if (!sessionId || !mapping || !mapping.name) {
            return res.status(400).json({ error: 'Ongeldige importgegevens – sessionId en naam-kolom zijn verplicht.' });
        }

        const rows = rowStore.get(sessionId);
        if (!rows) {
            return res.status(404).json({ error: 'Sessie verlopen of onbekend. Upload je bestand opnieuw.' });
        }

        const { company_id } = req.user;
        let importedCount = 0;
        const errors = [];

        for (const row of rows) {
            try {
                const name = String(row[mapping.name] || '').trim();
                if (!name) continue;

                const rawType = String(row[mapping.type] || '').toLowerCase().trim();
                const type = TYPE_MAP[rawType] || 'red';

                await prisma.wine.create({
                    data: {
                        name,
                        type,
                        region: String(row[mapping.region] || 'Onbekend').trim(),
                        country: String(row[mapping.country] || 'Onbekend').trim(),
                        vintage: parseInt(row[mapping.vintage]) || new Date().getFullYear(),
                        grape: String(row[mapping.grape] || '').trim(),
                        supplier: String(row[mapping.supplier] || 'Excel Import').trim(),
                        purchase_price: parseFloat(row[mapping.purchase_price]) || 0,
                        sell_price: parseFloat(row[mapping.sell_price]) || 0,
                        stock_count: parseInt(row[mapping.stock_count]) || 0,
                        min_stock_alert: parseInt(row[mapping.min_stock_alert]) || 5,
                        company_id,
                    }
                });
                importedCount++;
            } catch (err) {
                errors.push({ row: String(row[mapping.name] || '?'), error: 'Fout bij importeren van rij.' });
            }
        }

        rowStore.delete(sessionId);
        res.json({ success: true, importedCount, errors });
    } catch (error) {
        console.error('Excel Confirm Error:', error);
        res.status(500).json({ error: 'Importeren mislukt. Probeer het opnieuw.' });
    }
};

// ─── ADMIN: Import to WineCatalog (global database) ───────────────────────────
export const confirmCatalogImport = async (req, res) => {
    try {
        const { sessionId, mapping } = req.body;

        if (!sessionId || !mapping || !mapping.name) {
            return res.status(400).json({ error: 'Ongeldige importgegevens – sessionId en naam-kolom zijn verplicht.' });
        }

        const rows = rowStore.get(sessionId);
        if (!rows) {
            return res.status(404).json({ error: 'Sessie verlopen. Upload je bestand opnieuw.' });
        }

        let importedCount = 0;
        const errors = [];

        for (const row of rows) {
            try {
                const name = String(row[mapping.name] || '').trim();
                if (!name) continue;

                const rawType = String(row[mapping.type] || '').toLowerCase().trim();
                const type = TYPE_MAP[rawType] || 'red';

                const catalogData = {
                    type,
                    region: String(row[mapping.region] || 'Onbekend').trim(),
                    country: String(row[mapping.country] || 'Onbekend').trim(),
                    vintage: parseInt(row[mapping.vintage]) || null,
                    grape: String(row[mapping.grape] || '').trim() || null,
                    winery: String(row[mapping.winery] || '').trim() || null,
                    abv: parseFloat(row[mapping.abv]) || null,
                    body: String(row[mapping.body] || '').trim() || null,
                    acidity: String(row[mapping.acidity] || '').trim() || null,
                    elaborate: String(row[mapping.elaborate] || '').trim() || null,
                    harmonize: String(row[mapping.harmonize] || '').trim() || null,
                };

                await prisma.wineCatalog.upsert({
                    where: { name },
                    update: catalogData,
                    create: { name, ...catalogData }
                });
                importedCount++;
            } catch (err) {
                errors.push({ row: String(row[mapping.name] || '?'), error: 'Fout bij importeren van rij.' });
            }
        }

        rowStore.delete(sessionId);
        res.json({ success: true, importedCount, errors });
    } catch (error) {
        console.error('Catalog Import Error:', error);
        res.status(500).json({ error: 'Catalogus importeren mislukt.' });
    }
};
