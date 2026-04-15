import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretwinedashkey';

export const register = async (req, res) => {
    try {
        const { username, email, password, name, companyName } = req.body;

        if (!username) return res.status(400).json({ error: 'Gebruikersnaam is verplicht.' });

        // Check if username or email already exists
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) return res.status(400).json({ error: 'Gebruikersnaam is al in gebruik.' });

        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail) return res.status(400).json({ error: 'E-mailadres is al in gebruik.' });

        const password_hash = await bcrypt.hash(password, 10);

        // First registered user becomes admin automatically
        const userCount = await prisma.user.count();
        const role = userCount === 0 ? 'admin' : 'user';

        const user = await prisma.user.create({
            data: {
                username,
                email,
                password_hash,
                name: name || username,
                role,
                companies: {
                    create: {
                        name: companyName || `${name || username}'s Bedrijf`
                    }
                }
            },
            include: { companies: true }
        });

        const company_id = user.companies[0].id;
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role, company_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role, company_id }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { username },
            include: { companies: true }
        });

        if (!user) return res.status(401).json({ error: 'Ongeldige gebruikersnaam of wachtwoord.' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Ongeldige gebruikersnaam of wachtwoord.' });

        const company_id = user.companies.length > 0 ? user.companies[0].id : null;
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role, company_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role, company_id }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
};
