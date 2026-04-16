import puppeteer from 'puppeteer';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

export const generateWineList = async (req, res) => {
  try {
    const { company_id } = req.user;

    const company = await prisma.company.findUnique({ where: { id: company_id } });
    const wines = await prisma.wine.findMany({
      where: { company_id, stock_count: { gt: 0 } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });

    // Grouping by type
    const groupedWines = wines.reduce((acc, wine) => {
      acc[wine.type] = acc[wine.type] || [];
      acc[wine.type].push(wine);
      return acc;
    }, {});

    const primaryColor = company?.primary_color || '#0D2B4E';
    const accentColor = company?.secondary_color || '#4A9FD4';

    // Generate HTML
    let html = `
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 40px; }
        h1 { color: ${primaryColor}; text-align: center; font-size: 36px; margin-bottom: 40px; }
        .type-section { margin-bottom: 30px; }
        .type-title { color: ${accentColor}; font-size: 24px; border-bottom: 2px solid ${accentColor}; padding-bottom: 5px; margin-bottom: 15px; text-transform: capitalize; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { font-weight: bold; color: ${primaryColor}; }
        .price { text-align: right; font-weight: bold; }
        .vintage { color: #666; font-size: 0.9em; }
        .logo { text-align: center; margin-bottom: 20px; }
        .logo img { max-width: 150px; }
      </style>
    </head>
    <body>
      ${company?.logo_url ? `<div class="logo"><img src="${company.logo_url}" alt="Logo" /></div>` : ''}
      <h1>Wijnkaart - ${company?.name || 'WineDash'}</h1>
    `;

    for (const [type, typeWines] of Object.entries(groupedWines)) {
      html += `
        <div class="type-section">
          <h2 class="type-title">${type}</h2>
          <table>
            <thead>
              <tr>
                <th>Naam</th>
                <th>Regio</th>
                <th>Jaar</th>
                <th class="price">Prijs</th>
              </tr>
            </thead>
            <tbody>
      `;
      typeWines.forEach(wine => {
        html += `
          <tr>
            <td>${wine.name}</td>
            <td>${wine.region}</td>
            <td class="vintage">${wine.vintage || '-'}</td>
            <td class="price">€${wine.sell_price.toFixed(2)}</td>
          </tr>
        `;
      });
      html += `
            </tbody>
          </table>
        </div>
      `;
    }

    html += `</body></html>`;

    // Launch puppeteer
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="wijnkaart-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Gen Error:', error);
    res.status(500).json({ error: 'PDF genereren mislukt. Probeer het opnieuw.' });
  }
};
