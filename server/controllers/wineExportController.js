import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildExportTree, validateStructure } from '../utils/wineExportEngine.js';
import { renderExportPdf } from '../utils/wineExportPdf.js';

const flattenWine = (w) => ({
    id: w.id,
    name: w.catalog.name,
    type: w.catalog.type,
    region: w.catalog.region,
    subregion: w.catalog.subregion,
    country: w.catalog.country,
    grape: w.catalog.grape,
    winery: w.catalog.winery,
    vintage: w.vintage,
    sell_price: w.sell_price,
    purchase_price: w.purchase_price,
    stock_count: w.stock_count,
});

const fetchWines = async (company_id) => {
    const wines = await prisma.wine.findMany({
        where: { company_id },
        include: { catalog: true },
    });
    return wines.filter(w => w.catalog).map(flattenWine);
};

const templateSchema = z.object({
    name: z.string().min(1).max(100),
    title: z.string().max(120).optional(),
    structure: z.any(),
});

export const listTemplates = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const templates = await prisma.wineExportTemplate.findMany({
        where: { company_id },
        orderBy: { updated_at: 'desc' },
    });
    res.json(templates);
});

export const getTemplate = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const t = await prisma.wineExportTemplate.findFirst({
        where: { id: req.params.id, company_id },
    });
    if (!t) return res.status(404).json({ error: 'Template niet gevonden' });
    res.json(t);
});

export const createTemplate = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const err = validateStructure(parsed.data.structure);
    if (err) return res.status(400).json({ error: err });

    const t = await prisma.wineExportTemplate.create({
        data: {
            company_id,
            name: parsed.data.name,
            title: parsed.data.title || 'Wijnkaart',
            structure: parsed.data.structure,
        },
    });
    res.status(201).json(t);
});

export const updateTemplate = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const existing = await prisma.wineExportTemplate.findFirst({
        where: { id: req.params.id, company_id },
    });
    if (!existing) return res.status(404).json({ error: 'Template niet gevonden' });

    const parsed = templateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    if (parsed.data.structure !== undefined) {
        const err = validateStructure(parsed.data.structure);
        if (err) return res.status(400).json({ error: err });
    }

    const t = await prisma.wineExportTemplate.update({
        where: { id: existing.id },
        data: parsed.data,
    });
    res.json(t);
});

export const deleteTemplate = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const existing = await prisma.wineExportTemplate.findFirst({
        where: { id: req.params.id, company_id },
    });
    if (!existing) return res.status(404).json({ error: 'Template niet gevonden' });
    await prisma.wineExportTemplate.delete({ where: { id: existing.id } });
    res.json({ success: true });
});

// Preview which wines fall into which group, without generating a PDF.
export const previewExport = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    const { structure } = req.body;
    const err = validateStructure(structure);
    if (err) return res.status(400).json({ error: err });

    const wines = await fetchWines(company_id);
    const tree = buildExportTree(wines, structure);
    res.json({ tree, totalWines: wines.length });
});

// Generate PDF from a template id, or from an inline structure in the body.
export const generatePdf = asyncHandler(async (req, res) => {
    const { company_id } = req.user;
    let title = 'Wijnkaart';
    let structure;

    if (req.body?.template_id) {
        const t = await prisma.wineExportTemplate.findFirst({
            where: { id: req.body.template_id, company_id },
        });
        if (!t) return res.status(404).json({ error: 'Template niet gevonden' });
        title = t.title || t.name;
        structure = t.structure;
    } else {
        const err = validateStructure(req.body?.structure);
        if (err) return res.status(400).json({ error: err });
        structure = req.body.structure;
        title = req.body.title || 'Wijnkaart';
    }

    const company = await prisma.company.findUnique({ where: { id: company_id } });
    const wines = await fetchWines(company_id);
    const tree = buildExportTree(wines, structure);

    const safeName = (title || 'wijnkaart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wijnkaart';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);

    renderExportPdf(res, { title, tree, companyName: company?.name });
});
