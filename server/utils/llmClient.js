import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
const CHUNK_SIZE = 6000;   // tekens per LLM-call (groot genoeg voor een 4-pagina's factuur in één chunk)
const MAX_OUTPUT = 4096;   // ~150 tokens/regel × 26 regels + overhead
const MAX_CHUNKS = 10;     // cap op aantal chunks (~30 wijnen voor een factuur; grote kaarten worden afgekapt)

let _client = null;
function getClient() {
    if (_client) return _client;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set. Add it to server/.env to use invoice AI features.');
    }
    _client = new Anthropic({ apiKey });
    return _client;
}

// ─── Tool: structured invoice extraction ──────────────────────────────────────
const INVOICE_TOOL = {
    name: 'record_invoice',
    description: 'Record the structured contents of a wine-purchase invoice or wine list.',
    input_schema: {
        type: 'object',
        properties: {
            supplier: { type: 'string', description: 'Naam van de leverancier/verkoper/restaurant' },
            invoice_date: { type: 'string', description: 'ISO-datum indien zichtbaar, anders leeg' },
            lines: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name:        { type: 'string',  description: 'Naam van de wijn (zonder jaar/prijs/hoeveelheid/flesformaat)' },
                        producer:    { type: 'string',  description: 'Producent/wijnhuis/château indien bekend' },
                        vintage:     { type: 'integer', description: 'Oogstjaar (bv. 2020) — ALLEEN invullen als het jaartal expliciet in de tekst staat. Laat leeg als het ontbreekt.' },
                        quantity:    { type: 'integer', description: 'Aantal flessen — gebruik 1 als niet vermeld' },
                        unit_price:  { type: 'number',  description: 'Netto inkoopprijs per fles (EUR). Bereken als: Bedrag / Aantal. NIET de lijstprijs/stukprijs vóór korting.' },
                        total_price: { type: 'number',  description: 'Totaalbedrag voor deze regel (EUR) — de kolom "Bedrag" op de factuur.' },
                        bottle_size: { type: 'string',  description: 'Flesformaat als leesbare tekst. Leid af uit de eenheid: FLES→"750ml", MAGN/Magnum→"Magnum (1.5L)", DEMI/HALF→"375ml", MAG3L/Jeroboam→"Jeroboam (3L)". Laat leeg als onbekend.' },
                        type_hint: {
                            type: 'string',
                            enum: ['red', 'white', 'rose', 'sparkling', 'dessert', 'unknown'],
                            description: 'Wijntype op basis van context (sectie-header, kleur)'
                        }
                    },
                    required: ['name', 'quantity']
                }
            },
            total: { type: 'number', description: 'Totaalbedrag van de factuur (EUR)' }
        },
        required: ['supplier', 'lines']
    }
};

/**
 * Splits long OCR text into overlapping chunks and runs one LLM call per chunk.
 * Results are merged: supplier from first chunk, lines concatenated (deduped by name+vintage).
 */
export async function extractInvoice(ocrText) {
    if (!ocrText || ocrText.trim().length < 10) {
        console.warn('[llm] extractInvoice: OCR tekst te kort of leeg, geen extractie mogelijk');
        return { supplier: '', lines: [] };
    }

    const client = getClient();
    const allChunks = splitIntoChunks(ocrText, CHUNK_SIZE);
    const chunks = allChunks.slice(0, MAX_CHUNKS);
    if (allChunks.length > MAX_CHUNKS) {
        console.log(`[llm] Document afgekapt: ${allChunks.length} chunks → ${MAX_CHUNKS} (rate limit)`);
    }
    console.log(`[llm] Verwerken in ${chunks.length} chunk(s), totaal ${ocrText.length} tekens`);
    chunks.forEach((c, i) => console.log(`[llm] Chunk ${i + 1}: ${c.length} tekens`));

    let supplier = '';
    let invoice_date = null;
    const allLines = [];
    const seen = new Set();

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: MAX_OUTPUT,
            tools: [INVOICE_TOOL],
            tool_choice: { type: 'tool', name: 'record_invoice' },
            messages: [{
                role: 'user',
                content:
                    'Hieronder staat tekst van een wijnfactuur of wijnkaart (deel ' + (i + 1) + ' van ' + chunks.length + '). ' +
                    'De tekst kan font-encoding fouten bevatten waarbij letters verkeerd zijn weergegeven (bv. "C" i.p.v. "L", "J" i.p.v. "L", "|" i.p.v. "l"). ' +
                    'Gebruik je kennis van wijnamen, producenten en regio\'s om dergelijke fouten te corrigeren in de output. ' +
                    'Extraheer ELKE wijnregel: naam, producent, hoeveelheid en prijs. ' +
                    'Vul het oogstjaar ALLEEN in als het expliciet vermeld staat in de tekst (bv. "Château X 2019" → vintage 2019). Laat vintage leeg als het ontbreekt. ' +
                    'Negeer kopteksten, categorie-labels, BTW-regels en tekst die geen echte wijn is. ' +
                    'Als het type niet zeker is, leid het af uit de sectie-header (bv. "Vins Rouges" → red).\n\n' +
                    '--- TEKST ---\n' + chunk
            }]
        });

        const toolUse = response.content.find(b => b.type === 'tool_use');
        console.log(`[llm] Chunk ${i + 1}: stop_reason=${response.stop_reason}, tool_use=${!!toolUse}, regels=${toolUse?.input?.lines?.length ?? 0}`);
        if (!toolUse) {
            console.warn(`[llm] Chunk ${i + 1}: geen tool_use ontvangen. Volledige response content:`, JSON.stringify(response.content));
            continue;
        }

        if (i === 0 && toolUse.input.supplier) supplier = toolUse.input.supplier;
        if (i === 0 && toolUse.input.invoice_date) invoice_date = toolUse.input.invoice_date;

        for (const line of (toolUse.input.lines || [])) {
            if (!line.name || line.name.length < 2) continue;
            const key = `${line.name.toLowerCase().trim()}|${line.vintage || ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            allLines.push(line);
        }

        // Kleine pauze tussen chunks om rate limit te respecteren
        if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 1500));
    }

    console.log(`[llm] Extractie klaar: ${allLines.length} unieke wijnen gevonden`);
    return { supplier, invoice_date, lines: allLines };
}

/** Split text into chunks of ~size chars, breaking at newlines. */
function splitIntoChunks(text, size) {
    if (text.length <= size) return [text];
    const chunks = [];
    let pos = 0;
    while (pos < text.length) {
        let end = Math.min(pos + size, text.length);
        // Break at last newline within chunk to avoid splitting mid-line
        if (end < text.length) {
            const nl = text.lastIndexOf('\n', end);
            if (nl > pos + size / 2) end = nl + 1;
        }
        chunks.push(text.slice(pos, end));
        pos = end;
    }
    return chunks;
}

// ─── Tool: metadata suggestion for a single unmatched wine ────────────────────
const SUGGEST_TOOL = {
    name: 'suggest_wine_metadata',
    description: 'Suggest catalog metadata fields for a wine based on its name and vintage.',
    input_schema: {
        type: 'object',
        properties: {
            type:       { type: 'string', enum: ['red', 'white', 'rose', 'sparkling', 'dessert'] },
            region:     { type: 'string', description: 'Grote wijnregio (bv. Bourgogne, Bordeaux, Rioja, Toscane, Wachau). Nooit het land zelf invullen als regio.' },
            subregion:  { type: 'string', description: 'Specifieke streek of appellation binnen de regio (bv. Pauillac, Côte de Nuits, Rioja Alta, Chianti Classico, Pouilly-Fumé). Laat leeg als niet van toepassing.' },
            country:    {
                type: 'string',
                enum: [
                    'Frankrijk', 'Italië', 'Spanje', 'Portugal', 'Duitsland', 'Oostenrijk',
                    'Zwitserland', 'Griekenland', 'Hongarije', 'Roemenië', 'Bulgarije',
                    'Slovenië', 'Kroatië', 'Servië', 'Georgië', 'Moldavië',
                    'Verenigde Staten', 'Canada', 'Argentinië', 'Chili', 'Uruguay', 'Brazilië',
                    'Zuid-Afrika', 'Australië', 'Nieuw-Zeeland', 'Israël', 'Libanon',
                    'Marokko', 'Japan', 'China'
                ],
                description: 'Land van herkomst — kies exact uit de lijst'
            },
            grape:      { type: 'string', description: 'Druivenras(sen) als kommalijst indien meerdere (bv. "Cabernet Sauvignon, Merlot")' },
            winery:     { type: 'string', description: 'Wijnhuis/producent — laat leeg als onbekend, gebruik NOOIT "<UNKNOWN>" of placeholders' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        required: ['type']
    }
};

export async function suggestWineMetadata({ name, vintage, producer }) {
    const client = getClient();
    const prompt = [
        `Wijnnaam: ${name}`,
        producer ? `Producent: ${producer}` : null,
        vintage  ? `Jaar: ${vintage}`       : null,
        '',
        'Stel op basis van deze gegevens de best passende catalogus-metadata voor. ' +
        'Vermeld bij grape ALLE bekende druivenrassen als kommalijst (bv. "Grenache, Syrah, Mourvèdre"). ' +
        'Vul bij regio ALLEEN een specifieke wijnregio in (bv. Wachau, Kamptal, Toscane) — nooit het land zelf. ' +
        'Laat winery leeg als de producent onbekend is; gebruik nooit placeholders zoals "<UNKNOWN>". ' +
        'Als je het niet zeker weet, geef dan de meest waarschijnlijke waarde en zet confidence op "low".'
    ].filter(Boolean).join('\n');

    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await client.messages.create({
                model: MODEL,
                max_tokens: 500,
                tools: [SUGGEST_TOOL],
                tool_choice: { type: 'tool', name: 'suggest_wine_metadata' },
                messages: [{ role: 'user', content: prompt }]
            });
            const toolUse = response.content.find(b => b.type === 'tool_use');
            if (!toolUse) return { type: 'red', confidence: 'low' };
            return toolUse.input;
        } catch (err) {
            if (err.status === 429 && attempt < MAX_RETRIES) {
                const retryAfter = err.headers?.['retry-after'];
                const waitMs = retryAfter ? (parseInt(retryAfter, 10) + 2) * 1000 : 15000;
                console.log(`[llm] Rate limit (429), wachten ${waitMs}ms voor retry ${attempt + 1}/${MAX_RETRIES}...`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }
            throw err;
        }
    }
}
