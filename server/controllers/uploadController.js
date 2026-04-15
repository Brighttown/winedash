import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Tesseract from 'tesseract.js';
import puppeteer from 'puppeteer';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Setup multer for uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `invoice_${Date.now()}${path.extname(file.originalname)}`);
    }
});

export const uploadConfig = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) return cb(null, true);
        cb(new Error("Alleen afbeeldingsbestanden en PDF's zijn toegestaan"));
    }
});

export const processInvoiceUpload = async (req, res) => {
    let browser;
    try {
        if (!req.file) return res.status(400).json({ error: 'Geen bestand geüpload' });

        const ext = path.extname(req.file.originalname).toLowerCase();
        let text = '';

        if (ext === '.pdf') {
            // Use Puppeteer to "see" the PDF (works for both text and scans)
            browser = await puppeteer.launch({ headless: 'new' });
            const page = await browser.newPage();
            const absolutePath = path.resolve(req.file.path);
            await page.goto(`file://${absolutePath}`, { waitUntil: 'networkidle0' });

            // Set scale for better OCR
            await page.setViewport({ width: 2000, height: 2800, deviceScaleFactor: 2 });

            // Capture the whole page as an image
            const screenshotBuffer = await page.screenshot({ fullPage: true });
            const { data } = await Tesseract.recognize(screenshotBuffer, 'nld+eng');
            text = data.text;
        } else {
            // Direct OCR on image
            const { data } = await Tesseract.recognize(req.file.path, 'nld+eng');
            text = data.text;
        }

        // HEURISTIC PARSING
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        const extractedWines = [];

        for (let line of lines) {
            const yearMatch = line.match(/(20[12]\d)/);
            const vintage = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

            const priceMatch = line.match(/(\d+[.,]\d{2})/);
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0;

            const quantityMatch = line.match(/\b(\d{1,3})\s*[xX]/) || line.match(/^[0-9]{1,3}\b/);
            const quantity = quantityMatch ? parseInt(quantityMatch[1] || quantityMatch[0]) : 1;

            let cleanName = line.replace(/20[12]\d/g, '').replace(/\d+[.,]\d{2}/g, '').replace(/\b\d{1,3}\s*[xX]/g, '').replace(/[€$]/g, '').trim();

            if (cleanName.length > 3 && price > 0) {
                // TRY TO FIND A MATCH IN CATALOG
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
                    sell_price: price * 2.5,
                    matchFound: possibilities.length > 0 ? possibilities[0] : null,
                    allMatches: possibilities
                });
            }
        }

        // CLEANUP
        if (req.file) fs.unlink(req.file.path, () => { });
        if (browser) await browser.close();

        res.json({
            success: true,
            extractedWines: extractedWines.length > 0 ? extractedWines : [
                { name: "Onbekende Wijn (Pas aan)", vintage: new Date().getFullYear(), quantity: 1, purchase_price: 0, sell_price: 0, matchFound: null, allMatches: [] }
            ]
        });

    } catch (error) {
        if (browser) await browser.close();
        console.error('Invoice Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
};

