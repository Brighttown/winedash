import prisma from '../utils/prisma.js';

export const getDashboardStats = async (req, res) => {
    try {
        const { company_id } = req.user;

        const wines = await prisma.wine.findMany({
            where: { company_id }
        });

        const totalWines = wines.length;
        let inventoryValue = 0;

        // Low stock: below min_stock_alert, sorted by urgency
        const lowStockAlerts = [];
        const slowMovers = [];
        const margins = [];

        wines.forEach(wine => {
            inventoryValue += (wine.stock_count * wine.purchase_price);

            // Low stock
            if (wine.stock_count < wine.min_stock_alert) {
                lowStockAlerts.push(wine);
            }

            // Slow movers: days_in_stock > 60 and stock_count > 0
            if (wine.days_in_stock > 60 && wine.stock_count > 0) {
                slowMovers.push(wine);
            }

            // Top margin
            if (wine.purchase_price > 0) {
                const marginPct = (wine.sell_price - wine.purchase_price) / wine.purchase_price;
                margins.push({ ...wine, marginPct });
            }
        });

        // sort lowStockAlerts by largest deficit (min - current)
        lowStockAlerts.sort((a, b) => (b.min_stock_alert - b.stock_count) - (a.min_stock_alert - a.stock_count));

        // sort slowMovers by longest first
        slowMovers.sort((a, b) => b.days_in_stock - a.days_in_stock);

        // sort margins highest first and take top 5
        margins.sort((a, b) => b.marginPct - a.marginPct);
        const topMarginWines = margins.slice(0, 5);

        res.json({
            totalWines,
            inventoryValue,
            lowStockAlerts: lowStockAlerts.slice(0, 10),
            slowMovers: slowMovers.slice(0, 10),
            topMarginWines
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Fout bij ophalen van dashboard-gegevens.' });
    }
};
