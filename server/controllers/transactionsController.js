import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../utils/prisma.js';

const INVOICE_NOTE_RE = /^Factuur-import:\s*(.+)$/i;

// Bucket invoice-import movements per minute, so a single uploaded invoice that
// generated N stock movements within the same second appears as one transaction.
const minuteKey = (date) => {
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`;
};

const movementToLine = (m) => ({
    id: m.id,
    wine_id: m.wine_id,
    wine_name: m.wine?.catalog?.name || 'Onbekende wijn',
    wine_vintage: m.wine?.vintage ?? null,
    wine_type: m.wine?.catalog?.type ?? null,
    quantity: m.quantity,
    purchase_price: m.wine?.purchase_price ?? 0,
    sell_price: m.wine?.sell_price ?? null,
    note: m.note ?? null,
    created_at: m.created_at,
});

// GET /api/transactions
// Query: type=all|invoice|purchase|sale|adjustment, from=ISO, to=ISO, search=
export const listTransactions = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const { type = 'all', from, to, search } = req.query;

    const where = { wine: { company_id } };
    if (from || to) {
        where.created_at = {};
        if (from) where.created_at.gte = new Date(from);
        if (to) where.created_at.lte = new Date(to);
    }
    if (type && type !== 'all' && type !== 'invoice') {
        where.type = type;
    }

    const movements = await prisma.stockMovement.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: {
            wine: {
                include: { catalog: true },
            },
        },
        take: 2000,
    });

    // Group invoice-import movements; everything else is its own transaction.
    const groups = new Map();
    const transactions = [];

    for (const m of movements) {
        const match = m.note && INVOICE_NOTE_RE.exec(m.note);
        if (match && m.type === 'purchase') {
            const supplier = match[1].trim();
            const key = `inv|${supplier}|${minuteKey(m.created_at)}`;
            let group = groups.get(key);
            if (!group) {
                group = {
                    id: `invoice:${key}`,
                    kind: 'invoice',
                    type: 'purchase',
                    supplier,
                    created_at: m.created_at,
                    lines: [],
                    total_quantity: 0,
                    total_value: 0,
                };
                groups.set(key, group);
                transactions.push(group);
            }
            const line = movementToLine(m);
            group.lines.push(line);
            group.total_quantity += line.quantity;
            group.total_value += line.quantity * (line.purchase_price || 0);
        } else {
            const line = movementToLine(m);
            transactions.push({
                id: `mut:${m.id}`,
                kind: 'mutation',
                type: m.type,
                supplier: null,
                created_at: m.created_at,
                lines: [line],
                total_quantity: line.quantity,
                total_value: line.quantity * (m.type === 'sale'
                    ? (line.sell_price || 0)
                    : (line.purchase_price || 0)),
            });
        }
    }

    // Apply type=invoice filter at this level (groups only)
    let result = transactions;
    if (type === 'invoice') {
        result = result.filter(t => t.kind === 'invoice');
    }

    // Free-text search over supplier / wine name / note
    if (search) {
        const q = String(search).toLowerCase();
        result = result.filter(t => {
            if (t.supplier && t.supplier.toLowerCase().includes(q)) return true;
            return t.lines.some(l =>
                (l.wine_name || '').toLowerCase().includes(q) ||
                (l.note || '').toLowerCase().includes(q)
            );
        });
    }

    // Sort newest first (groups inherit oldest member's date due to insertion order)
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ transactions: result });
});
