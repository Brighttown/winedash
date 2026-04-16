import path from 'path';
import fs from 'fs/promises';
import Tesseract from 'tesseract.js';
import puppeteer from 'puppeteer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const MIN_TEXT_LENGTH = 100; // below this → assume scanned PDF, use OCR

/**
 * Extract text from an invoice file (PDF or image).
 *
 * For PDFs:
 *   1. Try pdf-parse (fast, extracts all pages at once — works for text PDFs)
 *   2. If result is too short (scanned PDF), fall back to Puppeteer + Tesseract OCR
 *
 * For images: Tesseract directly.
 */
export async function ocrInvoiceFile(filePath, originalName) {
    const ext = path.extname(originalName || filePath).toLowerCase();

    if (ext === '.pdf') {
        // ── 1. Try text extraction (all pages) ────────────────────────────────
        try {
            const buffer = await fs.readFile(filePath);
            const parsed = await pdfParse(buffer);
            const text = (parsed.text || '').trim();
            if (text.length >= MIN_TEXT_LENGTH) {
                console.log(`[ocr] pdf-parse geslaagd: ${text.length} tekens, ${parsed.numpages} pagina's`);
                return text;
            }
            console.log(`[ocr] pdf-parse te weinig tekst (${text.length} tekens), val terug op OCR`);
        } catch (e) {
            console.warn('[ocr] pdf-parse mislukt, val terug op OCR:', e.message);
        }

        // ── 2. Fallback: Puppeteer screenshot + Tesseract ──────────────────────
        let browser;
        try {
            browser = await puppeteer.launch({ headless: 'new' });
            const page = await browser.newPage();
            const absolutePath = path.resolve(filePath);
            await page.goto(`file://${absolutePath}`, { waitUntil: 'networkidle0' });
            await page.setViewport({ width: 2000, height: 2800, deviceScaleFactor: 2 });
            const screenshotBuffer = await page.screenshot({ fullPage: true });
            const { data } = await Tesseract.recognize(screenshotBuffer, 'nld+eng');
            console.log(`[ocr] Tesseract OCR geslaagd: ${data.text.length} tekens`);
            return data.text;
        } finally {
            if (browser) await browser.close();
        }
    }

    // ── Images: Tesseract directly ─────────────────────────────────────────────
    const { data } = await Tesseract.recognize(filePath, 'nld+eng');
    console.log(`[ocr] Tesseract afbeelding: ${data.text.length} tekens`);
    return data.text;
}
