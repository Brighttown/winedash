import prisma from '../utils/prisma.js';

export const generateWineList = async (req, res) => {
  res.status(501).json({ error: 'PDF generatie is tijdelijk uitgeschakeld op deze server.' });
};
