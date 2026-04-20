import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Extract raw text from PDF, DOCX, or XLSX.
 */
export async function parseWijnkaartFile(filePath, originalName) {
    const ext = path.extname(originalName || filePath).toLowerCase();

    if (ext === '.pdf') {
        try {
            const buffer = await fs.readFile(filePath);
            const parsed = await pdfParse(buffer);
            const text = (parsed.text || '').trim();
            if (text.length >= 50) return text;
        } catch (e) {
            console.warn('[wijnkaart] pdf-parse mislukt:', e.message);
        }
        return '';
    }

    if (ext === '.docx' || ext === '.doc') {
        try {
            const mammoth = (await import('mammoth')).default;
            const buffer = await fs.readFile(filePath);
            const result = await mammoth.extractRawText({ buffer });
            return result.value || '';
        } catch (e) {
            console.warn('[wijnkaart] mammoth mislukt:', e.message);
            return '';
        }
    }

    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
        try {
            const XLSX = (await import('xlsx')).default;
            const workbook = XLSX.readFile(filePath);
            const lines = [];
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                for (const row of rows) {
                    const line = row.filter(Boolean).join('\t');
                    if (line.trim()) lines.push(line);
                }
            }
            return lines.join('\n');
        } catch (e) {
            console.warn('[wijnkaart] xlsx mislukt:', e.message);
            return '';
        }
    }

    return '';
}
