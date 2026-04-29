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
    description: 'Extraheer letterlijk wat er op de wijnkaart staat — geen verrijking.',
    input_schema: {
        type: 'object',
        properties: {
            restaurant: { type: 'string', description: 'Naam van het restaurant indien zichtbaar bovenaan de kaart.' },
            lines: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name:             { type: 'string',  description: 'Naam van de wijn (zonder jaar/prijs/flesformaat).' },
                        producer:         { type: 'string',  description: 'Producent / wijnhuis / château als vermeld.' },
                        vintage:          { type: 'integer', description: 'Oogstjaar — alleen als expliciet vermeld. Leeg bij NV.' },
                        sell_price:       { type: 'number',  description: 'Verkoopprijs per fles in EUR.' },
                        sell_price_glass: { type: 'number',  description: 'Verkoopprijs per glas in EUR (alleen als vermeld).' },
                        bottle_size:      { type: 'string',  description: 'Flesformaat (bv. 750ml, Magnum). Leeg als onbekend.' },
                        type_hint: {
                            type: 'string',
                            enum: ['red', 'white', 'rose', 'sparkling', 'dessert', 'unknown'],
                            description: 'Wijntype op basis van de sectie-header van de kaart.'
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
const TARGET_CHUNK_SIZE = 3000;
const MAX_CHUNK_SIZE = 5000;
const MAX_CHUNKS = 12;

// ─── Section-aware adaptive chunking ──────────────────────────────────────────

const SECTION_KEYWORDS = /\b(rode\s*wijnen?|witte\s*wijnen?|ros[eé]\s*wijnen?|champagnes?|bruisende?\s*wijnen?|mousserend|dessertwijnen?|aperitief|red\s*wines?|white\s*wines?|sparkling\s*wines?|rose\s*wines?|dessert\s*wines?|vins?\s*rouges?|vins?\s*blancs?|vins?\s*ros[eé]s?|tinto|blanco|bianco|rosso)\b/i;

function isSectionHeader(line) {
    const t = (line || '').trim();
    if (!t || t.length > 80) return false;
    if (/[€$£]/.test(t)) return false;
    if (/\d{1,3}[,.]\d{2}/.test(t)) return false;
    if (SECTION_KEYWORDS.test(t)) return true;
    const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (letters.length >= 3 && letters === letters.toUpperCase() && t.split(/\s+/).length <= 6) return true;
    return false;
}

/**
 * Splits text in chunks waar mogelijk op section-header grenzen, zodat de header-context
 * (bv. "Rode wijnen") binnen elke chunk blijft. Adaptief: kleine kaarten = 1 chunk.
 */
function buildAdaptiveChunks(text, target = TARGET_CHUNK_SIZE, max = MAX_CHUNK_SIZE) {
    if (!text || text.length <= max) return [{ header: '', body: text || '' }];

    const lines = text.split('\n');
    const chunks = [];
    let buf = [];
    let bufLen = 0;
    let currentHeader = '';

    const flush = () => {
        if (buf.length === 0) return;
        chunks.push({ header: currentHeader, body: buf.join('\n') });
        buf = [];
        bufLen = 0;
    };

    for (const line of lines) {
        const isHeader = isSectionHeader(line);
        if (isHeader) {
            // Bij voldoende inhoud splitsen op de header-grens
            if (bufLen >= target) flush();
            currentHeader = line.trim();
        }
        buf.push(line);
        bufLen += line.length + 1;
        if (bufLen >= max) flush();
    }
    flush();

    if (chunks.length === 0) chunks.push({ header: '', body: text });
    return chunks.slice(0, MAX_CHUNKS);
}

// ─── AI extractie per chunk ───────────────────────────────────────────────────

function buildAnthropicClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        const e = new Error('AI-extractie niet beschikbaar: ANTHROPIC_API_KEY ontbreekt op de server.');
        e.status = 503;
        e.expose = true;
        throw e;
    }
    return new Anthropic({ apiKey });
}

async function extractChunk(client, chunk, index, total) {
    const headerNote = chunk.header
        ? `Deze sectie staat onder de header: "${chunk.header}". Gebruik dit om type_hint te bepalen.\n\n`
        : '';
    const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        tools: [WIJNKAART_TOOL],
        tool_choice: { type: 'tool', name: 'record_wijnkaart' },
        messages: [{
            role: 'user',
            content:
                `Dit is deel ${index + 1} van ${total} van een restaurantwijnkaart. ` +
                'Extraheer LETTERLIJK wat op de kaart staat per wijn — niet aanvullen of verrijken.\n' +
                '- naam, producent, jaargang, fles- en glasprijs (EUR), flesformaat\n' +
                '- type_hint afgeleid uit de sectie-header (bv. "Rode wijnen" → red, "Champagne" → sparkling)\n' +
                '- jaargang ALLEEN als expliciet vermeld\n' +
                '- negeer kopteksten, categorie-labels, beschrijvende teksten en regels die geen wijn zijn\n\n' +
                headerNote +
                '--- TEKST ---\n' + chunk.body
        }]
    });
    const toolUse = response.content.find(b => b.type === 'tool_use');
    if (!toolUse) return { restaurant: '', lines: [] };
    return {
        restaurant: toolUse.input.restaurant || '',
        lines: Array.isArray(toolUse.input.lines) ? toolUse.input.lines : []
    };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/** Stap 1: bestand → ruwe tekst (geen AI) */
export const parseTextHandler = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Geen bestand geüpload' });
    try {
        const text = await parseWijnkaartFile(req.file.path, req.file.originalname);
        console.log('[wijnkaart] Tekst extracted:', text.slice(0, 200));
        if (!text || text.trim().length < 20) {
            return res.status(422).json({ error: 'Kon geen tekst lezen uit het bestand.' });
        }
        res.json({ text, chars: text.length });
    } finally {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
    }
});

/**
 * Stap 2 (streaming): tekst → parallelle chunks → NDJSON-stream van wijnen.
 * Geen matching hier — alleen pure detectie. Matching gebeurt in /match.
 *
 * Body: { text }
 * Response: text/plain stream van JSON-lines:
 *   {"type":"start","totalChunks":N}
 *   {"type":"chunk","index":i,"header":"...","lines":[...]}
 *   {"type":"chunk-error","index":i,"message":"..."}
 *   {"type":"done","restaurant":"..."}
 */
export const analyzeStreamHandler = asyncHandler(async (req, res) => {
    const { text } = req.body || {};
    if (!text || text.trim().length < 20) {
        return res.status(400).json({ error: 'Geen tekst om te analyseren.' });
    }

    const client = buildAnthropicClient();
    const chunks = buildAdaptiveChunks(text);

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (obj) => {
        res.write(JSON.stringify(obj) + '\n');
    };

    send({ type: 'start', totalChunks: chunks.length });

    const seen = new Set();
    let restaurant = '';
    let chunkErrors = 0;

    // Alle chunks parallel; elk schrijft zijn eigen resultaat zodra klaar.
    await Promise.all(chunks.map(async (chunk, i) => {
        try {
            const { restaurant: r, lines } = await extractChunk(client, chunk, i, chunks.length);
            if (i === 0 && r && !restaurant) restaurant = r;

            const fresh = [];
            for (const line of lines) {
                if (!line.name || line.name.length < 2) continue;
                const key = `${line.name.toLowerCase().trim()}|${line.vintage || ''}`;
                if (seen.has(key)) continue;
                seen.add(key);
                fresh.push(line);
            }
            send({ type: 'chunk', index: i, header: chunk.header, lines: fresh });
        } catch (err) {
            chunkErrors++;
            const msg = err?.error?.error?.message || err?.message || String(err);
            console.error(`[wijnkaart] chunk ${i + 1}/${chunks.length} mislukt:`, msg);
            send({ type: 'chunk-error', index: i, message: msg });
        }
    }));

    send({
        type: 'done',
        restaurant,
        partial: chunkErrors > 0 && chunkErrors < chunks.length,
        failed: chunkErrors === chunks.length
    });
    res.end();
});

/**
 * Stap 3: bulk-match gedetecteerde wijnen tegen catalogus + voorraad.
 * Body: { lines: [{ name, vintage?, producer?, ... }] }
 */
export const matchHandler = asyncHandler(async (req, res) => {
    const { lines } = req.body || {};
    const { company_id } = req.user;
    if (!Array.isArray(lines)) {
        return res.status(400).json({ error: 'lines (array) is vereist.' });
    }
    if (lines.length === 0) return res.json({ matches: [] });

    const [catalogMatches, inventoryMatches] = await Promise.all([
        matchLines(lines),
        matchInventoryLines(lines, company_id)
    ]);

    // Voorkeur: voorraad-match (zodat we update-stock kunnen doen), anders catalogus-match.
    const matches = lines.map((_, i) =>
        inventoryMatches[i].matched ? inventoryMatches[i] : catalogMatches[i]
    );

    res.json({ matches });
});

/**
 * Legacy /analyze: doet detectie + matching in één call. Behouden voor backwards-compat,
 * maar de client gebruikt nu /analyze-stream + /match.
 */
export const analyzeHandler = asyncHandler(async (req, res) => {
    const { text } = req.body || {};
    const { company_id } = req.user;
    if (!text || text.trim().length < 20) {
        return res.status(400).json({ error: 'Geen tekst om te analyseren.' });
    }

    const client = buildAnthropicClient();
    const chunks = buildAdaptiveChunks(text);

    let restaurant = '';
    const seen = new Set();
    const allLines = [];
    const errors = [];

    const results = await Promise.all(chunks.map(async (chunk, i) => {
        try {
            return await extractChunk(client, chunk, i, chunks.length);
        } catch (err) {
            const msg = err?.error?.error?.message || err?.message || String(err);
            errors.push(`chunk ${i + 1}: ${msg}`);
            return { restaurant: '', lines: [] };
        }
    }));

    for (let i = 0; i < results.length; i++) {
        if (i === 0 && results[i].restaurant) restaurant = results[i].restaurant;
        for (const line of results[i].lines) {
            if (!line.name || line.name.length < 2) continue;
            const key = `${line.name.toLowerCase().trim()}|${line.vintage || ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            allLines.push(line);
        }
    }

    if (allLines.length === 0 && errors.length === chunks.length) {
        const e = new Error(`AI-extractie mislukt: ${errors[0]}`);
        e.status = 502;
        e.expose = true;
        throw e;
    }

    const [catalogMatches, inventoryMatches] = await Promise.all([
        matchLines(allLines),
        matchInventoryLines(allLines, company_id)
    ]);
    const enrichedLines = allLines.map((line, i) => ({
        ...line,
        match: catalogMatches[i].matched ? catalogMatches[i] : inventoryMatches[i]
    }));

    res.json({ restaurant, lines: enrichedLines, partialError: errors[0] || null });
});
