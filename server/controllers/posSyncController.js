import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../utils/prisma.js';
import { decryptSecret } from '../utils/crypto.js';
import { getProvider } from '../services/posSync/index.js';

const findIntegration = async (id, company_id) => {
    const integration = await prisma.pOSIntegration.findFirst({ where: { id, company_id } });
    if (!integration) return null;
    return integration;
};

const getCreds = (integration) => ({
    api_key: decryptSecret(integration.api_key_enc),
    api_secret: decryptSecret(integration.api_secret_enc),
});

export const syncCatalog = asyncHandler(async (req, res) => {
    const integration = await findIntegration(req.params.id, req.user.company_id);
    if (!integration) return res.status(404).json({ error: 'Koppeling niet gevonden' });

    const provider = getProvider(integration.provider);
    const products = await provider.fetchProducts(integration, getCreds(integration));

    const now = new Date();
    await prisma.$transaction(
        products.map(p => prisma.pOSCatalogItem.upsert({
            where: { integration_id_external_id: { integration_id: integration.id, external_id: String(p.external_id) } },
            create: {
                integration_id: integration.id,
                external_id: String(p.external_id),
                name: p.name,
                category: p.category || null,
                price: p.price ?? null,
                last_seen_at: now,
            },
            update: {
                name: p.name,
                category: p.category || null,
                price: p.price ?? null,
                last_seen_at: now,
            },
        }))
    );

    await prisma.pOSIntegration.update({
        where: { id: integration.id },
        data: { last_synced_at: now },
    });

    res.json({ count: products.length, last_synced_at: now });
});

export const listCatalogItems = asyncHandler(async (req, res) => {
    const integration = await findIntegration(req.params.id, req.user.company_id);
    if (!integration) return res.status(404).json({ error: 'Koppeling niet gevonden' });

    const items = await prisma.pOSCatalogItem.findMany({
        where: { integration_id: integration.id },
        orderBy: { name: 'asc' },
    });
    res.json(items);
});

// ─── Mappings (per wijn) ────────────────────────────────────────────────────

const upsertSchema = z.object({
    integration_id: z.string().uuid(),
    external_id: z.string().min(1),
    unit: z.enum(['bottle', 'glass', 'half_bottle']).default('bottle'),
    units_per_sale: z.number().positive().default(1),
});

const ownsWine = async (wineId, company_id) =>
    prisma.wine.findFirst({ where: { id: wineId, company_id } });

export const listWineMappings = asyncHandler(async (req, res) => {
    const wine = await ownsWine(req.params.wineId, req.user.company_id);
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden' });

    const mappings = await prisma.pOSProductMapping.findMany({
        where: { wine_id: wine.id, integration: { company_id: req.user.company_id } },
        include: { integration: { select: { id: true, display_name: true, provider: true } } },
    });
    res.json(mappings);
});

export const upsertWineMapping = asyncHandler(async (req, res) => {
    const wine = await ownsWine(req.params.wineId, req.user.company_id);
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden' });

    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const { integration_id, external_id, unit, units_per_sale } = parsed.data;

    const integration = await findIntegration(integration_id, req.user.company_id);
    if (!integration) return res.status(404).json({ error: 'Koppeling niet gevonden' });

    const item = await prisma.pOSCatalogItem.findFirst({
        where: { integration_id: integration.id, external_id },
    });
    if (!item) return res.status(404).json({ error: 'POS-artikel niet gevonden in cache. Synchroniseer de catalogus eerst.' });

    const mapping = await prisma.pOSProductMapping.upsert({
        where: { integration_id_external_id_unit: { integration_id: integration.id, external_id, unit } },
        create: {
            integration_id: integration.id,
            wine_id: wine.id,
            external_id,
            external_name: item.name,
            unit,
            units_per_sale,
        },
        update: {
            wine_id: wine.id,
            external_name: item.name,
            units_per_sale,
        },
        include: { integration: { select: { id: true, display_name: true, provider: true } } },
    });
    res.status(200).json(mapping);
});

export const deleteWineMapping = asyncHandler(async (req, res) => {
    const wine = await ownsWine(req.params.wineId, req.user.company_id);
    if (!wine) return res.status(404).json({ error: 'Wijn niet gevonden' });

    const mapping = await prisma.pOSProductMapping.findFirst({
        where: { id: req.params.mappingId, wine_id: wine.id },
    });
    if (!mapping) return res.status(404).json({ error: 'Mapping niet gevonden' });

    await prisma.pOSProductMapping.delete({ where: { id: mapping.id } });
    res.status(204).end();
});
