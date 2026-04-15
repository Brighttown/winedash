import pkg from '@prisma/client';
import bcrypt from 'bcryptjs';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Find Julian (by name or username containing 'Julian')
const users = await prisma.user.findMany({
    where: {
        OR: [
            { username: { contains: 'Julian' } },
            { name: { contains: 'Julian' } }
        ]
    },
    select: { id: true, username: true, name: true, role: true }
});

if (users.length === 0) {
    console.log('❌ Geen gebruiker gevonden met naam of gebruikersnaam "Julian".');
    console.log('Beschikbare gebruikers:');
    const all = await prisma.user.findMany({ select: { username: true, name: true, role: true } });
    all.forEach(u => console.log(`  - ${u.username} (${u.name}) [${u.role}]`));
} else {
    const user = users[0];
    const newPassword = 'Admin1234!';
    const password_hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin', password_hash }
    });
    console.log(`✅ ${user.username} (${user.name}) is nu admin!`);
    console.log(`🔑 Nieuw wachtwoord: ${newPassword}`);
}
await prisma.$disconnect();
