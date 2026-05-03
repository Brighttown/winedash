/**
 * Untill TPAPI-POS provider.
 *
 * STATUS: stub — implementatie wacht op AppToken van Untill.
 * Zodra die binnen is hoeven alleen de TODO's hieronder ingevuld te worden;
 * controllers en UI veranderen niet.
 *
 * Verwachte config (POSIntegration.config Json):
 *   { host: "pos.klant.nl", port: 3064, database: "PROD", use_ssl: true,
 *     username: "tpapi-user", sales_area_id: "5000000208" }
 *
 * Verwachte secrets (versleuteld in api_key_enc / api_secret_enc):
 *   api_key_enc    = TPAPI password
 *   api_secret_enc = (ongebruikt; AppToken zit in env UNTILL_APP_TOKEN)
 *
 * Docs: https://apidocs.untill.com/pos/
 */

const baseUrl = (cfg) => {
    const proto = cfg.use_ssl ? 'https' : 'http';
    return cfg.use_ssl
        ? `${proto}://${cfg.host}/shield/api/v1/${cfg.database}`
        : `${proto}://${cfg.host}:${cfg.port || 3064}/api/v1/${cfg.database}`;
};

const buildAuth = (integration, creds) => ({
    UserName: integration.config?.username,
    Password: creds.api_key,                       // TPAPI password
    AppToken: process.env.UNTILL_APP_TOKEN,        // applicatie-globaal, niet per klant
});

export const fetchProducts = async (integration, creds) => {
    if (!process.env.UNTILL_APP_TOKEN) {
        throw Object.assign(new Error('UNTILL_APP_TOKEN ontbreekt op de server'), { status: 503 });
    }
    if (!integration.config?.host || !integration.config?.database) {
        throw Object.assign(new Error('Untill-koppeling mist host of database'), { status: 400 });
    }

    const url = `${baseUrl(integration.config)}/GetArticlesInfo`;
    const auth = buildAuth(integration, creds);

    // TODO: zodra echte JSON-vorm bekend is uit /api/-docs op de installatie:
    //   const res = await fetch(url, { method: 'POST', headers: {...}, body: JSON.stringify({ ...auth, dailystock: true }) });
    //   const data = await res.json();
    //   return data.Articles.map(a => ({ external_id: String(a.Id), name: a.Name, category: a.GroupName, price: a.Price }));
    throw Object.assign(new Error('Untill-implementatie nog niet geactiveerd'), { status: 501 });
};

export const fetchTransactions = async (integration, creds, { since, until }) => {
    if (!process.env.UNTILL_APP_TOKEN) {
        throw Object.assign(new Error('UNTILL_APP_TOKEN ontbreekt op de server'), { status: 503 });
    }
    // TODO: FindTransactions of GetDetailedTurnoverReport met DateFrom/DateTo
    throw Object.assign(new Error('Untill-implementatie nog niet geactiveerd'), { status: 501 });
};
