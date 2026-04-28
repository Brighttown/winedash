import Fuse from 'fuse.js';
import prisma from './prisma.js';

const MATCH_THRESHOLD = 0.45;
const MAX_CANDIDATES = 5;

function tokenize(s) {
    return String(s || '')
        .toLowerCase()
        .split(/[^a-z0-9à-ÿ]+/i)
        .filter(t => t.length >= 3);
}

// ─── Catalog matching ──────────────────────────────────────────────────────────

let _catalogCache = null;
async function loadCatalog() {
    // Pull the whole catalog in one query — much faster than per-line lookups
    // when matching dozens of lines.
    const list = await prisma.wineCatalog.findMany();
    _catalogCache = list;
    return list;
}

function buildCatalogFuse(pool) {
    return new Fuse(pool, {
        includeScore: true,
        threshold: 0.7,
        keys: [
            { name: 'name', weight: 0.7 },
            { name: 'winery', weight: 0.3 },
        ],
    });
}

function scoreLine(fuse, line) {
    const query = [line.name, line.producer].filter(Boolean).join(' ');
    if (!query) return { matched: null, score: null, candidates: [] };
    let results = fuse.search(query).slice(0, MAX_CANDIDATES);
    if (line.vintage) {
        results = results.map(r => ({
            ...r,
            score: r.item.vintage === line.vintage ? Math.max(0, r.score - 0.05) : r.score,
        }));
        results.sort((a, b) => a.score - b.score);
    }
    const best = results[0];
    return {
        matched: best && best.score <= MATCH_THRESHOLD ? best.item : null,
        score: best ? best.score : null,
        candidates: results.map(r => ({ catalog: r.item, score: r.score })),
    };
}

export async function matchLines(lines) {
    const pool = await loadCatalog();
    if (pool.length === 0) return lines.map(() => ({ matched: null, score: null, candidates: [] }));
    const fuse = buildCatalogFuse(pool);
    return lines.map(line => scoreLine(fuse, line));
}

export async function matchLine(line) {
    const [result] = await matchLines([line]);
    return result;
}

// ─── Inventory matching (Wine table per company) ───────────────────────────────

export async function matchInventoryLines(lines, company_id) {
    const pool = await prisma.wine.findMany({
        where: { company_id },
        include: { catalog: true },
    });
    const valid = pool.filter(w => w.catalog);
    if (valid.length === 0) return lines.map(() => ({ matched: null, score: null, fromInventory: true }));

    const fuse = new Fuse(valid, {
        includeScore: true,
        threshold: 0.7,
        keys: [{ name: 'catalog.name', weight: 1.0 }],
    });

    const flatten = (w) => ({
        ...w,
        name: w.catalog.name,
        type: w.catalog.type,
        region: w.catalog.region,
        country: w.catalog.country,
        winery: w.catalog.winery,
    });

    return lines.map(line => {
        if (!line.name) return { matched: null, score: null, fromInventory: true };
        let results = fuse.search(line.name).slice(0, MAX_CANDIDATES);
        if (line.vintage) {
            results = results.map(r => ({
                ...r,
                score: r.item.vintage === line.vintage
                    ? Math.max(0, r.score - 0.1)
                    : r.score + 0.1,
            }));
            results.sort((a, b) => a.score - b.score);
        }
        const best = results[0];
        return {
            matched: best && best.score <= MATCH_THRESHOLD ? flatten(best.item) : null,
            score: best ? best.score : null,
            fromInventory: true,
        };
    });
}

export async function matchInventoryLine(line, company_id) {
    const [result] = await matchInventoryLines([line], company_id);
    return result;
}
