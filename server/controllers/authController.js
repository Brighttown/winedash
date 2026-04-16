import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
const JWT_SECRET = process.env.JWT_SECRET;

const registerSchema = z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().max(100).optional(),
    companyName: z.string().max(100).optional(),
});

const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

export const register = async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { username, email, password, name, companyName } = parsed.data;

    try {
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) return res.status(400).json({ error: 'Gebruikersnaam is al in gebruik.' });

        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail) return res.status(400).json({ error: 'E-mailadres is al in gebruik.' });

        const password_hash = await bcrypt.hash(password, 12);

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
        res.status(500).json({ error: 'Registratie mislukt. Probeer het opnieuw.' });
    }
};

export const login = async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht.' });
    }

    const { username, password } = parsed.data;

    try {
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
        res.status(500).json({ error: 'Inloggen mislukt. Probeer het opnieuw.' });
    }
};
