/**
 * POS provider registry.
 *
 * Elke provider exporteert:
 *   fetchProducts(integration, decryptedCreds) → [{ external_id, name, category?, price? }]
 *   fetchTransactions(integration, decryptedCreds, { since, until }) → [{ external_id, qty, sold_at, price? }]
 *
 * Een nieuwe provider toevoegen = nieuw bestand + één regel hieronder.
 */
import * as mockProvider from './mockProvider.js';
import * as untillProvider from './untillProvider.js';

const providers = {
    mock: mockProvider,
    other: mockProvider,    // tijdelijk: "other" gebruikt mock-data
    untill: untillProvider,
    // lightspeed: lightspeedProvider,
    // square: squareProvider,
};

export const getProvider = (name) => {
    const p = providers[name];
    if (!p) throw Object.assign(new Error(`Onbekend kassasysteem: ${name}`), { status: 400 });
    return p;
};
