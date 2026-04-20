import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseWijnkaartFile } from '../utils/wijnkaartParser.js';
import { matchLines, matchInventoryLines } from '../utils/catalogMatcher.js';

const ALLOWED_MIME = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
]);
const ALLOWED_EXT = new Set(['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv']);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads';
        if (!existsSync(dir)) mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `wijnkaart_${Date.now()}${path.extname(file.originalname)}`);
    }
});

export const wijnkaartUploadConfig = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_MIME.has(file.mimetype) || ALLOWED_EXT.has(ext)) return cb(null, true);
        cb(new Error('Alleen PDF, Word (.docx) en Excel (.xlsx) bestanden zijn toegestaan'));
    }
});

const WIJNKAART_TOOL = {
    name: 'record_wijnkaart',
    description: 'Extraheer de gestructureerde inhoud van een restaurantwijnkaart of wijnlijst.',
    input_schema: {
        type: 'object',
        properties: {
            restaurant: { type: 'string', description: 'Naam van het restaurant of establishment' },
            lines: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name:             { type: 'string',  description: 'Naam van de wijn (zonder jaar/prijs/flesformaat)' },
                        producer:         { type: 'string',  description: 'Producent/wijnhuis/château indien bekend' },
                        vintage:          { type: 'integer', description: 'Oogstjaar — ALLEEN als expliciet vermeld. Laat leeg bij NV.' },
                        sell_price:       { type: 'number',  description: 'Verkoopprijs per fles (EUR). Dit is de prijs op de kaart.' },
                        sell_price_glass: { type: 'number',  description: 'Prijs per glas (EUR) indien vermeld, anders leeg.' },
                        bottle_size:      { type: 'string',  description: 'Flesformaat (bv. 750ml, Magnum). Leeg als onbekend.' },
                        type_hint: {
                            type: 'string',
                            enum: ['red', 'white', 'rose', 'sparkling', 'dessert', 'unknown'],
                            description: 'Wijntype op basis van context (sectie-header, kleur)'
                        }
                    },
                    required: ['name']
                }
            }
        },
        required: ['lines']
    }
};

const MODEL = 'claude-haiku-4-5-20251001';
const CHUNK_SIZE = 6000;
const MAX_CHUNKS = 10;

function splitIntoChunks(text, size) {
    if (text.length <= size) return [text];
    const chunks = [];
    let pos = 0;
    while (pos < text.length) {
        let end = Math.min(pos + size, text.length);
        if (end < text.length) {
            const nl = text.lastIndexOf('\n', end);
            if (nl > pos + size / 2) end = nl + 1;
        }
        chunks.push(text.slice(pos, end));
        pos = end;
    }
    return chunks;
}

async function extractWijnkaart(text) {
    if (!text || text.trim().length < 10) return { restaurant: '', lines: [] };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY niet ingesteld');
    const client = new Anthropic({ apiKey });

    const chunks = splitIntoChunks(text, CHUNK_SIZE).slice(0, MAX_CHUNKS);
    let restaurant = '';
    const allLines = [];
    const seen = new Set();

    for (let i = 0; i < chunks.length; i++) {
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 4096,
            tools: [WIJNKAART_TOOL],
            tool_choice: { type: 'tool', name: 'record_wijnkaart' },
            messages: [{
                role: 'user',
                content:
                    `Dit is deel ${i + 1} van ${chunks.length} van een restaurantwijnkaart of wijnlijst. ` +
                    'Extraheer ELKE wijn met naam, producent, jaargang en verkoopprijs. ' +
                    'Vul het jaargang ALLEEN in als het expliciet vermeld staat. ' +
                    'De verkoopprijs is de prijs die gasten betalen (niet de inkoopprijs). ' +
                    'Negeer kopteksten, categorie-labels en tekst die geen echte wijn is. ' +
                    'Leid het wijntype af uit sectie-headers (bijv. "Rode Wijnen" → red, "Blanc" → white).\n\n' +
                    '--- TEKST ---\n' + chunks[i]
            }]
        });

        const toolUse = response.content.find(b => b.type === 'tool_use');
        if (!toolUse) continue;
        if (i === 0 && toolUse.input.restaurant) restaurant = toolUse.input.restaurant;

        for (const line of (toolUse.input.lines || [])) {
            if (!line.name || line.name.length < 2) continue;
            const key = `${line.name.toLowerCase().trim()}|${line.vintage || ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            allLines.push(line);
        }

        if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 1500));
    }

    return { restaurant, lines: allLines };
}

export const extractWijnkaartHandler = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Geen bestand geüpload' });
    const { company_id } = req.user;

    try {
        const text = await parseWijnkaartFile(req.file.path, req.file.originalname);
        console.log('[wijnkaart] Tekst extracted:', text.slice(0, 200));

        if (!text || text.trim().length < 20) {
            return res.status(422).json({ error: 'Kon geen tekst lezen uit het bestand.' });
        }

        const extracted = await extractWijnkaart(text);
        console.log('[wijnkaart] LLM extractie:', extracted.lines.length, 'wijnen');

        const lines = extracted.lines;
        const catalogMatches = await matchLines(lines);
        const inventoryMatches = await matchInventoryLines(lines, company_id);

        const enrichedLines = lines.map((line, i) => ({
            ...line,
            match: catalogMatches[i].matched ? catalogMatches[i] : inventoryMatches[i]
        }));

        res.json({ restaurant: extracted.restaurant, lines: enrichedLines });
    } finally {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
    }
});
