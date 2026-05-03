import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../utils/prisma.js';
import { encryptSecret, maskSecret } from '../utils/crypto.js';

const PROVIDERS = ['lightspeed', 'untill', 'square', 'other'];

const createSchema = z.object({
    provider: z.enum(PROVIDERS),
    display_name: z.string().min(1).max(100),
    api_key: z.string().min(1).max(500),
    api_secret: z.string().max(500).optional().nullable(),
    location_id: z.string().max(100).optional().nullable(),
    config: z.record(z.any()).optional().nullable(),
});

const updateSchema = z.object({
    display_name: z.string().min(1).max(100).optional(),
    api_key: z.string().min(1).max(500).optional(),
    api_secret: z.string().max(500).optional().nullable(),
    location_id: z.string().max(100).optional().nullable(),
    config: z.record(z.any()).optional().nullable(),
    is_active: z.boolean().optional(),
});

const serialize = (row) => ({
    id: row.id,
    provider: row.provider,
    display_name: row.display_name,
    api_key_masked: maskSecret(row.api_key_enc),
    has_secret: !!row.api_secret_enc,
    location_id: row.location_id,
    config: row.config || null,
    is_active: row.is_active,
    last_synced_at: row.last_synced_at,
    created_at: row.created_at,
});

export const listIntegrations = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const rows = await prisma.pOSIntegration.findMany({
        where: { company_id },
        orderBy: { created_at: 'desc' },
    });
    res.json(rows.map(serialize));
});

export const createIntegration = asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const { company_id } = req.user;
    const { provider, display_name, api_key, api_secret, location_id, config } = parsed.data;

    const row = await prisma.pOSIntegration.create({
        data: {
            company_id,
            provider,
            display_name,
            api_key_enc: encryptSecret(api_key),
            api_secret_enc: encryptSecret(api_secret),
            location_id: location_id || null,
            config: config || null,
        },
    });
    res.status(201).json(serialize(row));
});

export const updateIntegration = asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const { company_id } = req.user;

    const existing = await prisma.pOSIntegration.findFirst({
        where: { id: req.params.id, company_id },
    });
    if (!existing) return res.status(404).json({ error: 'Koppeling niet gevonden' });

    const data = {};
    if (parsed.data.display_name !== undefined) data.display_name = parsed.data.display_name;
    if (parsed.data.api_key !== undefined) data.api_key_enc = encryptSecret(parsed.data.api_key);
    if (parsed.data.api_secret !== undefined) data.api_secret_enc = encryptSecret(parsed.data.api_secret);
    if (parsed.data.location_id !== undefined) data.location_id = parsed.data.location_id || null;
    if (parsed.data.config !== undefined) data.config = parsed.data.config || null;
    if (parsed.data.is_active !== undefined) data.is_active = parsed.data.is_active;

    const row = await prisma.pOSIntegration.update({
        where: { id: existing.id },
        data,
    });
    res.json(serialize(row));
});

export const deleteIntegration = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const existing = await prisma.pOSIntegration.findFirst({
        where: { id: req.params.id, company_id },
    });
    if (!existing) return res.status(404).json({ error: 'Koppeling niet gevonden' });
    await prisma.pOSIntegration.delete({ where: { id: existing.id } });
    res.status(204).end();
});
