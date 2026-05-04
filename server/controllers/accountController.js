import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../utils/prisma.js';

const profileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
});

const passwordSchema = z.object({
    current_password: z.string().min(1),
    new_password: z.string().min(8).max(200),
});

const FONT_FAMILIES = ['Helvetica', 'Times-Roman', 'Courier'];
const FONT_WEIGHTS = ['normal', 'bold'];

const styleSlot = z.object({
    font: z.enum(FONT_FAMILIES).optional(),
    size: z.number().min(6).max(48).optional(),
    weight: z.enum(FONT_WEIGHTS).optional(),
}).strict();

const priceStyleSlot = z.object({
    font: z.enum(FONT_FAMILIES).optional(),
    size: z.number().min(6).max(48).optional(),
    weight: z.enum(FONT_WEIGHTS).optional(),
    decimal: z.enum(['.', ',']).optional(),
}).strict();

const menuStyleSchema = z.object({
    heading: styleSlot.optional(),
    body: styleSlot.optional(),
    price: priceStyleSlot.optional(),
}).strict();

const iconSchema = z.object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(80),
    mime: z.string().min(1).max(80),
    data_url: z.string().min(1).max(500_000), // ~500KB base64
    position: z.object({
        h: z.enum(['left', 'right']).default('left'),
        v: z.enum(['top', 'middle', 'bottom']).default('middle'),
    }).optional(),
});

const companySchema = z.object({
    name: z.string().min(1).max(100).optional(),
    logo_url: z.string().max(500).optional().nullable(),
    primary_color: z.string().max(20).optional().nullable(),
    secondary_color: z.string().max(20).optional().nullable(),
    menu_style: menuStyleSchema.optional().nullable(),
    icons: z.array(iconSchema).max(30).optional().nullable(),
});

const serializeUser = (u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    role: u.role,
    created_at: u.created_at,
});

const serializeCompany = (c) => c && ({
    id: c.id,
    name: c.name,
    logo_url: c.logo_url,
    primary_color: c.primary_color,
    secondary_color: c.secondary_color,
    menu_style: c.menu_style || null,
    icons: c.icons || [],
});

export const getMe = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { companies: true },
    });
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    const company = user.companies.find(c => c.id === req.user.company_id) || user.companies[0] || null;
    res.json({ user: serializeUser(user), company: serializeCompany(company) });
});

export const updateProfile = asyncHandler(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

    if (parsed.data.email) {
        const existing = await prisma.user.findFirst({
            where: { email: parsed.data.email, NOT: { id: req.user.id } },
        });
        if (existing) return res.status(400).json({ error: 'E-mailadres is al in gebruik.' });
    }

    const user = await prisma.user.update({
        where: { id: req.user.id },
        data: parsed.data,
    });
    res.json(serializeUser(user));
});

export const updatePassword = asyncHandler(async (req, res) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Wachtwoord moet minstens 8 tekens hebben.' });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    const ok = await bcrypt.compare(parsed.data.current_password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Huidig wachtwoord klopt niet.' });
    const password_hash = await bcrypt.hash(parsed.data.new_password, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password_hash } });
    res.json({ ok: true });
});

export const updateCompany = asyncHandler(async (req, res) => {
    const parsed = companySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    if (!req.user.company_id) return res.status(400).json({ error: 'Geen bedrijf gekoppeld aan account.' });

    const existing = await prisma.company.findFirst({
        where: { id: req.user.company_id, user_id: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Bedrijf niet gevonden' });

    const company = await prisma.company.update({
        where: { id: existing.id },
        data: parsed.data,
    });
    res.json(serializeCompany(company));
});
