import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// Shared singleton — prevents "prepared statement already exists" with PgBouncer
const prisma = new PrismaClient();

export default prisma;
