import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../utils/prisma.js';

const flatten = (w) => ({
    id: w.id,
    name: w.catalog?.name || '(onbekend)',
    type: w.catalog?.type,
    region: w.catalog?.region,
    country: w.catalog?.country,
    image_url: w.catalog?.image_url,
    vintage: w.vintage,
    purchase_price: w.purchase_price,
    sell_price: w.sell_price,
    sell_price_glass: w.sell_price_glass,
    stock_count: w.stock_count,
    min_stock_alert: w.min_stock_alert,
    days_in_stock: w.days_in_stock,
});

export const getDashboardStats = asyncHandler(async (req, res) => {
    const { company_id } = req.user;

    const wines = await prisma.wine.findMany({
        where: { company_id },
        include: { catalog: true },
    });

    // Verkochte units laatste 30 dagen voor "best sellers"
    const since = new Date(Date.now() - 30 * 86_400_000);
    const recentSales = await prisma.stockMovement.findMany({
        where: { type: 'sale', created_at: { gte: since }, wine: { company_id } },
        select: { wine_id: true, quantity: true },
    });
    const soldByWine = recentSales.reduce((acc, m) => {
        acc[m.wine_id] = (acc[m.wine_id] || 0) + Math.abs(m.quantity);
        return acc;
    }, {});

    let inventoryValue = 0;
    const lowStockAlerts = [];
    const slowMovers = [];
    const margins = [];
    const sellers = [];

    for (const w of wines) {
        const flat = flatten(w);
        inventoryValue += (w.stock_count || 0) * (w.purchase_price || 0);

        if (w.min_stock_alert > 0 && w.stock_count < w.min_stock_alert) {
            lowStockAlerts.push(flat);
        }

        if (w.days_in_stock > 60 && w.stock_count > 0) {
            slowMovers.push(flat);
        }

        if (w.purchase_price > 0 && w.sell_price) {
            const marginPct = (w.sell_price - w.purchase_price) / w.purchase_price;
            margins.push({ ...flat, marginPct });
        }

        const soldUnits = soldByWine[w.id] || 0;
        if (soldUnits > 0) {
            sellers.push({ ...flat, units_sold_30d: soldUnits, revenue_30d: soldUnits * (w.sell_price || 0) });
        }
    }

    lowStockAlerts.sort((a, b) => (b.min_stock_alert - b.stock_count) - (a.min_stock_alert - a.stock_count));
    slowMovers.sort((a, b) => b.days_in_stock - a.days_in_stock);
    margins.sort((a, b) => b.marginPct - a.marginPct);
    sellers.sort((a, b) => b.units_sold_30d - a.units_sold_30d);

    const totalUnitsSold30d = Object.values(soldByWine).reduce((s, n) => s + n, 0);
    const totalRevenue30d = sellers.reduce((s, w) => s + w.revenue_30d, 0);

    res.json({
        totalWines: wines.length,
        inventoryValue,
        totalUnitsSold30d,
        totalRevenue30d,
        lowStockAlerts: lowStockAlerts.slice(0, 10),
        slowMovers: slowMovers.slice(0, 10),
        topMarginWines: margins.slice(0, 5),
        topSellers: sellers.slice(0, 5),
    });
});
