import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, email: true, role: true }
});
console.log('=== GEBRUIKERS IN DATABASE ===');
users.forEach(u => {
    console.log(`  Username: ${u.username} | Name: ${u.name} | Email: ${u.email} | Role: ${u.role}`);
});
await prisma.$disconnect();
