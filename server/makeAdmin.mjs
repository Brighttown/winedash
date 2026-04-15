import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const updated = await prisma.user.update({
    where: { username: 'Bellevue' },
    data: { role: 'admin' }
});
console.log(`✅ ${updated.username} is nu admin!`);
await prisma.$disconnect();
