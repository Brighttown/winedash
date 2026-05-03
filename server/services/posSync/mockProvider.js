/**
 * Mock POS provider — geeft verzonnen artikelen + transacties terug.
 *
 * Gebruikt voor lokale ontwikkeling en demo's totdat echte providers (Untill,
 * Lightspeed) een werkende koppeling hebben. Provider "other" valt hier ook op terug.
 */

const FAKE_ARTICLES = [
    { external_id: 'A001', name: 'HUISWIJN ROOD GLAS',          category: 'Wijn rood', price: 5.50 },
    { external_id: 'A002', name: 'HUISWIJN ROOD FLES',          category: 'Wijn rood', price: 26.00 },
    { external_id: 'A003', name: 'HUISWIJN WIT GLAS',           category: 'Wijn wit',  price: 5.50 },
    { external_id: 'A004', name: 'HUISWIJN WIT FLES',           category: 'Wijn wit',  price: 26.00 },
    { external_id: 'A010', name: 'CHARDONNAY GLAS',             category: 'Wijn wit',  price: 6.50 },
    { external_id: 'A011', name: 'CHARDONNAY FLES',             category: 'Wijn wit',  price: 32.00 },
    { external_id: 'A020', name: 'PINOT NOIR GLAS',             category: 'Wijn rood', price: 7.00 },
    { external_id: 'A021', name: 'PINOT NOIR FLES',             category: 'Wijn rood', price: 38.00 },
    { external_id: 'A030', name: 'MARG15 FLES',                 category: 'Wijn rood', price: 280.00 },
    { external_id: 'A031', name: 'CHATEAU LATOUR 2018',         category: 'Wijn rood', price: 320.00 },
    { external_id: 'A040', name: 'CHAMPAGNE BRUT GLAS',         category: 'Bubbels',   price: 9.00 },
    { external_id: 'A041', name: 'CHAMPAGNE BRUT FLES',         category: 'Bubbels',   price: 65.00 },
    { external_id: 'A050', name: 'PROSECCO GLAS',               category: 'Bubbels',   price: 6.50 },
    { external_id: 'A051', name: 'ROSE PROVENCE FLES',          category: 'Wijn rosé', price: 28.00 },
    { external_id: 'A060', name: 'SAUVIGNON BLANC GLAS',        category: 'Wijn wit',  price: 6.00 },
    { external_id: 'A061', name: 'SAUVIGNON BLANC FLES',        category: 'Wijn wit',  price: 30.00 },
];

export const fetchProducts = async () => FAKE_ARTICLES;

export const fetchTransactions = async (_integration, _creds, { since, until }) => {
    const now = Date.now();
    return [
        { external_id: 'A001', qty: 4, sold_at: new Date(now - 3600_000).toISOString(), price: 5.50 },
        { external_id: 'A011', qty: 1, sold_at: new Date(now - 2400_000).toISOString(), price: 32.00 },
        { external_id: 'A041', qty: 2, sold_at: new Date(now - 1200_000).toISOString(), price: 65.00 },
    ];
};
