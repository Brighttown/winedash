import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

export const getCatalogWines = async (req, res) => {
    try {
        const { search } = req.query;
        const catalog = await prisma.wineCatalog.findMany({
            where: search ? {
                OR: [
                    { name: { contains: search } },
                    { region: { contains: search } },
                    { grape: { contains: search } }
                ]
            } : {},
            orderBy: { name: 'asc' }
        });
        res.json(catalog);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getCatalogWineById = async (req, res) => {
    try {
        const wine = await prisma.wineCatalog.findUnique({
            where: { id: req.params.id }
        });
        if (!wine) return res.status(404).json({ error: 'Wine not found' });
        res.json(wine);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createCatalogEntry = async (req, res) => {
    try {
        const { name, type, region, country, vintage, grape, winery } = req.body;
        // Admins are auto-verified, users are not
        const is_verified = req.user.role === 'admin';

        const wine = await prisma.wineCatalog.upsert({
            where: { name },
            update: {}, // Don't overwrite if exists
            create: {
                name, type, region, country, vintage, grape, winery,
                is_verified
            }
        });
        res.status(201).json(wine);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getUnverifiedCatalog = async (req, res) => {
    try {
        const catalog = await prisma.wineCatalog.findMany({
            where: { is_verified: false },
            orderBy: { created_at: 'desc' }
        });
        res.json(catalog);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const verifyCatalogEntry = async (req, res) => {
    try {
        const wine = await prisma.wineCatalog.update({
            where: { id: req.params.id },
            data: { is_verified: true }
        });
        res.json(wine);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

