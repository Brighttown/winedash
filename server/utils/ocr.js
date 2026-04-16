import path from 'path';
import fs from 'fs/promises';
import Tesseract from 'tesseract.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const MIN_TEXT_LENGTH = 100; // below this → assume scanned PDF, use OCR

/**
 * Extract text from an invoice file (PDF or image).
 *
 * For PDFs:
 *   1. Try pdf-parse (fast, text-based PDFs)
 *   2. If result is too short (scanned PDF), use Tesseract directly on the buffer
 *
 * For images: Tesseract directly.
 */
export async function ocrInvoiceFile(filePath, originalName) {
    const ext = path.extname(originalName || filePath).toLowerCase();

    if (ext === '.pdf') {
        // ── 1. Try text extraction ─────────────────────────────────────────────
        try {
            const buffer = await fs.readFile(filePath);
            const parsed = await pdfParse(buffer);
            const text = (parsed.text || '').trim();
            if (text.length >= MIN_TEXT_LENGTH) {
                console.log(`[ocr] pdf-parse geslaagd: ${text.length} tekens, ${parsed.numpages} pagina's`);
                return text;
            }
            console.log(`[ocr] pdf-parse te weinig tekst (${text.length} tekens), val terug op Tesseract`);
        } catch (e) {
            console.warn('[ocr] pdf-parse mislukt:', e.message);
        }

        // ── 2. Fallback: Tesseract op PDF buffer ───────────────────────────────
        try {
            const buffer = await fs.readFile(filePath);
            const { data } = await Tesseract.recognize(buffer, 'nld+eng');
            console.log(`[ocr] Tesseract PDF fallback: ${data.text.length} tekens`);
            return data.text;
        } catch (e) {
            console.warn('[ocr] Tesseract PDF fallback mislukt:', e.message);
            return '';
        }
    }

    // ── Images: Tesseract directly ─────────────────────────────────────────────
    try {
        const { data } = await Tesseract.recognize(filePath, 'nld+eng');
        console.log(`[ocr] Tesseract afbeelding: ${data.text.length} tekens`);
        return data.text;
    } catch (e) {
        console.warn('[ocr] Tesseract afbeelding mislukt:', e.message);
        return '';
    }
}
