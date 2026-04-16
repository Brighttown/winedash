import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import Tesseract from 'tesseract.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import prisma from '../utils/prisma.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MIN_TEXT_LENGTH = 100;

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

export const uploadConfig = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
        cb(new Error("Alleen afbeeldingsbestanden (JPG, PNG) en PDF's zijn toegestaan"));
    }
});

export const processInvoiceUpload = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Geen bestand geüpload' });

        const ext = path.extname(req.file.originalname).toLowerCase();
        let text = '';

        if (ext === '.pdf') {
            try {
                const buffer = await fs.readFile(req.file.path);
                const parsed = await pdfParse(buffer);
                text = (parsed.text || '').trim();
                if (text.length < MIN_TEXT_LENGTH) {
                    const { data } = await Tesseract.recognize(buffer, 'nld+eng');
                    text = data.text;
                }
            } catch {
                const { data } = await Tesseract.recognize(req.file.path, 'nld+eng');
                text = data.text;
            }
        } else {
            const { data } = await Tesseract.recognize(req.file.path, 'nld+eng');
            text = data.text;
        }

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        const extractedWines = [];

        for (const line of lines) {
            const yearMatch = line.match(/(20[12]\d)/);
            const vintage = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

            const priceMatch = line.match(/(\d+[.,]\d{2})/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0;

            const quantityMatch = line.match(/\b(\d{1,3})\s*[xX]/) || line.match(/^[0-9]{1,3}\b/);
            const quantity = quantityMatch ? parseInt(quantityMatch[1] || quantityMatch[0]) : 1;

            let cleanName = line
                .replace(/20[12]\d/g, '')
                .replace(/\d+[.,]\d{2}/g, '')
                .replace(/\b\d{1,3}\s*[xX]/g, '')
                .replace(/[€$]/g, '')
                .trim();

            if (cleanName.length > 3 && price > 0) {
                const possibilities = await prisma.wineCatalog.findMany({
                    where: {
                        OR: [
                            { name: { contains: cleanName } },
                            { name: { contains: cleanName.split(' ')[0] } }
                        ]
                    },
                    take: 3
                });

                extractedWines.push({
                    name: cleanName,
                    vintage,
                    quantity,
                    purchase_price: price,
                    sell_price: parseFloat((price * 2.5).toFixed(2)),
                    matchFound: possibilities.length > 0 ? possibilities[0] : null,
                    allMatches: possibilities
                });
            }
        }

        await fs.unlink(req.file.path).catch(() => {});

        res.json({
            success: true,
            extractedWines: extractedWines.length > 0 ? extractedWines : [
                { name: 'Onbekende Wijn (Pas aan)', vintage: new Date().getFullYear(), quantity: 1, purchase_price: 0, sell_price: 0, matchFound: null, allMatches: [] }
            ]
        });

    } catch (error) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        console.error('Invoice Upload Error:', error);
        res.status(500).json({ error: 'Fout bij verwerking van het bestand. Probeer het opnieuw.' });
    }
};
