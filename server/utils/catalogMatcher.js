import Fuse from 'fuse.js';
import prisma from './prisma.js';

const MATCH_THRESHOLD = 0.45;   // Fuse score ≤ this = automatisch gekoppeld (0=perfect, 1=slecht)
const MAX_CANDIDATES = 5;
const MAX_DB_CANDIDATES = 80;

function tokenize(s) {
    return String(s || '')
        .toLowerCase()
        .split(/[^a-z0-9à-ÿ]+/i)
        .filter(t => t.length >= 3);
}

/**
 * Pull a rough candidate set from the catalog using case-insensitive substring
 * search on each significant token. Keeps the pool small enough to feed into Fuse.
 */
async function fetchCandidates(name, producer) {
    const tokens = [...new Set([...tokenize(name), ...tokenize(producer)])];
    if (tokens.length === 0) return [];

    const ors = [];
    for (const tok of tokens.slice(0, 5)) {
        ors.push({ name: { contains: tok } });
    }

    return prisma.wineCatalog.findMany({
        where: { OR: ors },
        take: MAX_DB_CANDIDATES
    });
}

/**
 * Match a single extracted invoice line against the WineCatalog.
 * Returns { matched, score, candidates }.
 *   - matched:    the best catalog entry if score ≤ threshold, else null
 *   - score:      the best Fuse score (0 = perfect, 1 = worst), or null
 *   - candidates: top N candidates with their scores, always
 */
export async function matchLine(line) {
    const pool = await fetchCandidates(line.name, line.producer);
    if (pool.length === 0) {
        return { matched: null, score: null, candidates: [] };
    }

    const fuse = new Fuse(pool, {
        includeScore: true,
        threshold: 0.7,
        keys: [
            { name: 'name', weight: 0.7 },
            { name: 'winery', weight: 0.3 }
        ]
    });

    const query = [line.name, line.producer].filter(Boolean).join(' ');
    let results = fuse.search(query).slice(0, MAX_CANDIDATES);

    // Small bonus for exact vintage match: nudge the score down by 0.05
    if (line.vintage) {
        results = results.map(r => ({
            ...r,
            score: r.item.vintage === line.vintage ? Math.max(0, r.score - 0.05) : r.score
        }));
        results.sort((a, b) => a.score - b.score);
    }

    const best = results[0];
    return {
        matched: best && best.score <= MATCH_THRESHOLD ? best.item : null,
        score: best ? best.score : null,
        candidates: results.map(r => ({ catalog: r.item, score: r.score }))
    };
}

/** Match an array of extracted lines — sequential to avoid SQLite lock contention. */
export async function matchLines(lines) {
    const results = [];
    for (const line of lines) {
        results.push(await matchLine(line));
    }
    return results;
}

// ─── Inventory matching (Wine table per company) ───────────────────────────────

async function matchInventoryLine(line, company_id) {
    const tokens = [...new Set([...tokenize(line.name), ...tokenize(line.producer)])];
    if (tokens.length === 0) return { matched: null, score: null, fromInventory: true };

    const ors = tokens.slice(0, 5).map(tok => ({
        catalog: { name: { contains: tok, mode: 'insensitive' } }
    }));

    const pool = await prisma.wine.findMany({
        where: { company_id, OR: ors },
        include: { catalog: true },
        take: MAX_DB_CANDIDATES
    });

    if (pool.length === 0) return { matched: null, score: null, fromInventory: true };

    const fuse = new Fuse(pool, {
        includeScore: true,
        threshold: 0.7,
        keys: [{ name: 'catalog.name', weight: 1.0 }]
    });

    let results = fuse.search(line.name).slice(0, MAX_CANDIDATES);

    if (line.vintage) {
        results = results.map(r => ({
            ...r,
            score: r.item.vintage === line.vintage
                ? Math.max(0, r.score - 0.1)
                : r.score + 0.1
        }));
        results.sort((a, b) => a.score - b.score);
    }

    const best = results[0];
    // Flatten catalog into the matched wine for downstream compatibility
    const flattenMatch = (w) => w ? { ...w, name: w.catalog.name, type: w.catalog.type, region: w.catalog.region, country: w.catalog.country, winery: w.catalog.winery } : null;
    return {
        matched: best && best.score <= MATCH_THRESHOLD ? flattenMatch(best.item) : null,
        score: best ? best.score : null,
        fromInventory: true
    };
}

/** For each line without a catalog match, try to find an existing Wine in inventory. */
export async function matchInventoryLines(lines, company_id) {
    const results = [];
    for (const line of lines) {
        results.push(await matchInventoryLine(line, company_id));
    }
    return results;
}
