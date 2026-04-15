import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

export const getAllWines = async (req, res) => {
    try {
        const { company_id } = req.user;
        const wines = await prisma.wine.findMany({
            where: { company_id },
            orderBy: { name: 'asc' }
        });
        res.json(wines);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getWineById = async (req, res) => {
    try {
        const { company_id } = req.user;
        const wine = await prisma.wine.findFirst({
            where: { id: req.params.id, company_id }
        });
        if (!wine) return res.status(404).json({ error: 'Wine not found' });
        res.json(wine);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createWine = async (req, res) => {
    try {
        const { company_id } = req.user;
        const wineData = req.body;

        const newWine = await prisma.wine.create({
            data: {
                ...wineData,
                company_id
            }
        });

        // Also record stock movement if initial stock > 0
        if (wineData.stock_count > 0) {
            await prisma.stockMovement.create({
                data: {
                    wine_id: newWine.id,
                    type: 'adjustment',
                    quantity: wineData.stock_count,
                    note: 'Initial stock'
                }
            });
        }

        res.status(201).json(newWine);
    } catch (error) {
        console.error('Add To Stock Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const updateWine = async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const updateData = req.body;

        const existingId = await prisma.wine.findFirst({ where: { id, company_id } });
        if (!existingId) return res.status(404).json({ error: 'Wine not found' });

        // Handle stock movement if stock_count is being explicitly updated
        if (updateData.stock_count !== undefined && updateData.stock_count !== existingId.stock_count) {
            const diff = updateData.stock_count - existingId.stock_count;
            await prisma.stockMovement.create({
                data: {
                    wine_id: id,
                    type: 'adjustment',
                    quantity: diff,
                    note: 'Manual adjustment'
                }
            });
        }

        const updatedWine = await prisma.wine.update({
            where: { id },
            data: updateData
        });

        res.json(updatedWine);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteWine = async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;

        const existing = await prisma.wine.findFirst({ where: { id, company_id } });
        if (!existing) return res.status(404).json({ error: 'Wine not found' });

        // delete related stock movements first
        await prisma.stockMovement.deleteMany({
            where: { wine_id: id }
        });

        await prisma.wine.delete({
            where: { id }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
