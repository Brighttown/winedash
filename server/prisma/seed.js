import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    // 1. Create a dummy user
    const password_hash = await bcrypt.hash('admin123', 10);
    const user = await prisma.user.upsert({
        where: { email: 'admin@winedash.local' },
        update: {},
        create: {
            email: 'admin@winedash.local',
            password_hash,
            name: 'Admin User',
        },
    });

    // 2. Create a dummy company
    let company = await prisma.company.findFirst();
    if (!company) {
        company = await prisma.company.create({
            data: {
                name: 'The Grand Hotel',
                primary_color: '#0D2B4E',
                secondary_color: '#4A9FD4',
                user_id: user.id,
            },
        });
    }

    // 3. Create 20 realistic wine entries
    const winesData = [
        { name: 'Château Margaux', region: 'Bordeaux', country: 'France', vintage: 2015, grape: 'Cabernet Sauvignon', type: 'red', supplier: 'Grand Cru Direct', purchase_price: 350.00, sell_price: 850.00, stock_count: 12, min_stock_alert: 6, days_in_stock: 45 },
        { name: 'Tignanello', region: 'Tuscany', country: 'Italy', vintage: 2018, grape: 'Sangiovese Blend', type: 'red', supplier: 'Italian Vines', purchase_price: 95.00, sell_price: 210.00, stock_count: 8, min_stock_alert: 12, days_in_stock: 30 },
        { name: 'Sassicaia', region: 'Tuscany', country: 'Italy', vintage: 2017, grape: 'Cabernet Franc, Cabernet Sauvignon', type: 'red', supplier: 'Enoteca', purchase_price: 180.00, sell_price: 450.00, stock_count: 5, min_stock_alert: 6, days_in_stock: 75 },
        { name: 'Opus One', region: 'Napa Valley', country: 'USA', vintage: 2016, grape: 'Bordeaux Blend', type: 'red', supplier: 'Napa Imports', purchase_price: 280.00, sell_price: 700.00, stock_count: 4, min_stock_alert: 5, days_in_stock: 120 },
        { name: 'Cloudy Bay', region: 'Marlborough', country: 'New Zealand', vintage: 2022, grape: 'Sauvignon Blanc', type: 'white', supplier: 'Oceania Wines', purchase_price: 22.00, sell_price: 65.00, stock_count: 48, min_stock_alert: 24, days_in_stock: 15 },
        { name: 'Dom Perignon', region: 'Champagne', country: 'France', vintage: 2012, grape: 'Chardonnay, Pinot Noir', type: 'sparkling', supplier: 'LVMH Direct', purchase_price: 140.00, sell_price: 380.00, stock_count: 15, min_stock_alert: 12, days_in_stock: 25 },
        { name: 'Moët & Chandon Imperial', region: 'Champagne', country: 'France', vintage: 2020, grape: 'Chardonnay, Pinot Noir', type: 'sparkling', supplier: 'LVMH Direct', purchase_price: 35.00, sell_price: 90.00, stock_count: 60, min_stock_alert: 24, days_in_stock: 5 },
        { name: 'Veuve Clicquot Yellow Label', region: 'Champagne', country: 'France', vintage: 2021, grape: 'Pinot Noir, Chardonnay', type: 'sparkling', supplier: 'LVMH Direct', purchase_price: 42.00, sell_price: 110.00, stock_count: 36, min_stock_alert: 24, days_in_stock: 10 },
        { name: 'Chablis Grand Cru Les Clos', region: 'Burgundy', country: 'France', vintage: 2019, grape: 'Chardonnay', type: 'white', supplier: 'Burgundy Select', purchase_price: 75.00, sell_price: 190.00, stock_count: 10, min_stock_alert: 12, days_in_stock: 65 },
        { name: 'Meursault-Charmes', region: 'Burgundy', country: 'France', vintage: 2018, grape: 'Chardonnay', type: 'white', supplier: 'Burgundy Select', purchase_price: 85.00, sell_price: 220.00, stock_count: 6, min_stock_alert: 6, days_in_stock: 40 },
        { name: 'Whispering Angel', region: 'Provence', country: 'France', vintage: 2022, grape: 'Grenache, Cinsault', type: 'rose', supplier: 'Provence imports', purchase_price: 18.00, sell_price: 55.00, stock_count: 72, min_stock_alert: 36, days_in_stock: 12 },
        { name: 'Miraval Rosé', region: 'Provence', country: 'France', vintage: 2022, grape: 'Cinsault, Grenache, Syrah', type: 'rose', supplier: 'Provence imports', purchase_price: 16.00, sell_price: 48.00, stock_count: 90, min_stock_alert: 24, days_in_stock: 8 },
        { name: 'Barolo Riserva', region: 'Piedmont', country: 'Italy', vintage: 2015, grape: 'Nebbiolo', type: 'red', supplier: 'Italian Vines', purchase_price: 65.00, sell_price: 180.00, stock_count: 8, min_stock_alert: 12, days_in_stock: 90 },
        { name: 'Amarone della Valpolicella', region: 'Veneto', country: 'Italy', vintage: 2016, grape: 'Corvina, Rondinella', type: 'red', supplier: 'Italian Vines', purchase_price: 55.00, sell_price: 150.00, stock_count: 15, min_stock_alert: 10, days_in_stock: 45 },
        { name: 'Sancerre Les Collines Blanc', region: 'Loire Valley', country: 'France', vintage: 2021, grape: 'Sauvignon Blanc', type: 'white', supplier: 'Loire Direct', purchase_price: 25.00, sell_price: 75.00, stock_count: 24, min_stock_alert: 18, days_in_stock: 20 },
        { name: 'Rioja Gran Reserva', region: 'Rioja', country: 'Spain', vintage: 2014, grape: 'Tempranillo', type: 'red', supplier: 'Iberia Selection', purchase_price: 28.00, sell_price: 85.00, stock_count: 14, min_stock_alert: 12, days_in_stock: 70 },
        { name: 'Pingus', region: 'Ribera del Duero', country: 'Spain', vintage: 2018, grape: 'Tinto Fino', type: 'red', supplier: 'Iberia Selection', purchase_price: 450.00, sell_price: 1200.00, stock_count: 2, min_stock_alert: 2, days_in_stock: 110 },
        { name: 'Penfolds Grange', region: 'South Australia', country: 'Australia', vintage: 2016, grape: 'Shiraz', type: 'red', supplier: 'Oceania Wines', purchase_price: 550.00, sell_price: 1400.00, stock_count: 3, min_stock_alert: 2, days_in_stock: 180 },
        { name: 'Ruinart Blanc de Blancs', region: 'Champagne', country: 'France', vintage: 2020, grape: 'Chardonnay', type: 'sparkling', supplier: 'LVMH Direct', purchase_price: 55.00, sell_price: 145.00, stock_count: 18, min_stock_alert: 12, days_in_stock: 22 },
        { name: 'Pouilly-Fumé', region: 'Loire Valley', country: 'France', vintage: 2022, grape: 'Sauvignon Blanc', type: 'white', supplier: 'Loire Direct', purchase_price: 24.00, sell_price: 70.00, stock_count: 30, min_stock_alert: 18, days_in_stock: 18 }
    ];

    for (const w of winesData) {
        const existing = await prisma.wine.findFirst({ where: { name: w.name, company_id: company.id } });
        if (!existing) {
            await prisma.wine.create({
                data: {
                    ...w,
                    company_id: company.id
                }
            });
        }
    }

    // 4. Seed Global catalog
    const catalogData = winesData.map(w => ({
        name: w.name, region: w.region, country: w.country, vintage: w.vintage, grape: w.grape, type: w.type
    }));
    for (const c of catalogData) {
        const exists = await prisma.wineCatalog.findFirst({ where: { name: c.name } });
        if (!exists) {
            await prisma.wineCatalog.create({ data: c });
        }
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
