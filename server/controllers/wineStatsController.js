import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../utils/prisma.js';

const DAY_MS = 86_400_000;

const dayKey = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

// GET /api/wines/:wineId/stats?days=30
export const getWineStats = asyncHandler(async (req, res) => {
    const { wineId } = req.params;
    const { company_id } = req.user;

    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);

    const wine = await prisma.wine.findFirst({
        where: { id: wineId, company_id },
        include: { catalog: true },
    });
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden' });

    const now = new Date();
    const periodStart = new Date(now.getTime() - days * DAY_MS);
    const prevStart = new Date(now.getTime() - 2 * days * DAY_MS);

    const movements = await prisma.stockMovement.findMany({
        where: { wine_id: wineId, created_at: { gte: prevStart } },
        orderBy: { created_at: 'asc' },
    });

    const sellPrice = wine.sell_price || 0;
    const purchasePrice = wine.purchase_price || 0;

    let unitsSold = 0;
    let unitsPurchased = 0;
    let unitsAdjusted = 0;
    let prevUnitsSold = 0;

    const byDay = new Map();
    for (let i = 0; i < days; i++) {
        const d = new Date(now.getTime() - (days - 1 - i) * DAY_MS);
        byDay.set(dayKey(d), 0);
    }

    for (const m of movements) {
        const inCurrent = m.created_at >= periodStart;
        const qty = m.quantity;

        if (m.type === 'sale') {
            const sold = Math.abs(qty);
            if (inCurrent) {
                unitsSold += sold;
                const k = dayKey(m.created_at);
                if (byDay.has(k)) byDay.set(k, byDay.get(k) + sold);
            } else {
                prevUnitsSold += sold;
            }
        } else if (m.type === 'purchase' && inCurrent) {
            unitsPurchased += Math.abs(qty);
        } else if (m.type === 'adjustment' && inCurrent) {
            unitsAdjusted += qty;
        }
    }

    const revenue = unitsSold * sellPrice;
    const cogs = unitsSold * purchasePrice;
    const profit = revenue - cogs;
    const avgPerDay = unitsSold / days;

    const series = Array.from(byDay.entries()).map(([date, units]) => ({ date, units }));
    const bestDay = series.reduce((a, b) => (b.units > a.units ? b : a), { date: null, units: 0 });

    const deltaPct = prevUnitsSold > 0
        ? ((unitsSold - prevUnitsSold) / prevUnitsSold)
        : (unitsSold > 0 ? 1 : 0);

    // Tempo voor restvoorraad: hoeveel dagen tot uitverkocht bij dit ritme?
    const daysUntilEmpty = avgPerDay > 0 && wine.stock_count > 0
        ? Math.ceil(wine.stock_count / avgPerDay)
        : null;

    res.json({
        period_days: days,
        units_sold: unitsSold,
        units_purchased: unitsPurchased,
        units_adjusted: unitsAdjusted,
        revenue,
        cogs,
        profit,
        avg_per_day: avgPerDay,
        prev_units_sold: prevUnitsSold,
        delta_pct: deltaPct,
        best_day: bestDay.units > 0 ? bestDay : null,
        days_until_empty: daysUntilEmpty,
        series,
    });
});
