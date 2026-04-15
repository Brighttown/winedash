import fs from 'fs';
import csv from 'csv-parser';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const results = [];

fs.createReadStream('../X-Wines-main/Dataset/last/XWines_Test_100_wines.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
        console.log(`Parsing finished, found ${results.length} wines.`);

        let added = 0;
        for (const row of results) {
            if (!row.WineName) continue;

            let grapeClean = '';
            if (row.Grapes) {
                grapeClean = row.Grapes.replace(/\[/g, '').replace(/\]/g, '').replace(/'/g, '').trim();
            }

            const typeMap = {
                'Red': 'red',
                'White': 'white',
                'Rosé': 'rose',
                'Sparkling': 'sparkling',
                'Dessert': 'dessert',
                'Dessert/Port': 'dessert',
            };

            let mappedType = typeMap[row.Type] || 'red';

            // Pick safest easiest year if vintage array is present
            let latestVintage = 2023; // fallback default
            if (row.Vintages) {
                let mm = row.Vintages.match(/\d{4}/);
                if (mm) latestVintage = parseInt(mm[0], 10);
            }

            // Ensure it doesn't already exist
            const existing = await prisma.wineCatalog.findFirst({
                where: { name: row.WineName }
            });

            const newData = {
                name: row.WineName,
                region: row.RegionName || 'Unknown',
                country: row.Country || 'Unknown',
                grape: grapeClean,
                type: mappedType,
                vintage: latestVintage,
                elaborate: row.Elaborate || null,
                harmonize: row.Harmonize ? row.Harmonize.replace(/\[/g, '').replace(/\]/g, '').replace(/'/g, '').trim() : null,
                abv: row.ABV ? parseFloat(row.ABV) : null,
                body: row.Body || null,
                acidity: row.Acidity || null,
                winery: row.WineryName || null,
                website: row.Website || null,
            };

            if (existing) {
                await prisma.wineCatalog.update({
                    where: { id: existing.id },
                    data: newData
                });
            } else {
                await prisma.wineCatalog.create({
                    data: newData
                });
                added++;
                console.log(`Added: ${row.WineName}`);
            }
        }

        console.log(`Import completed. Added ${added} new wines to Catalog.`);
        process.exit(0);
    });
