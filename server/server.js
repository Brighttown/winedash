import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import wineRoutes from './routes/wines.js';
import dashboardRoutes from './routes/dashboard.js';
import pdfRoutes from './routes/pdf.js';
import uploadRoutes from './routes/upload.js';
import invoiceRoutes from './routes/invoice.js';
import catalogRoutes from './routes/catalog.js';
import excelImportRoutes from './routes/excelImport.js';
import adminRoutes from './routes/admin.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Fail-fast: required environment variables ────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`FATAL: Environment variable ${key} is not set. Exiting.`);
        process.exit(1);
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Trust proxy (required behind Render / reverse proxies) ──────────────────
app.set('trust proxy', 1);

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(o => o.trim())
    : ['http://localhost:5173'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate limiters ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Te veel pogingen. Probeer het over 15 minuten opnieuw.' },
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { error: 'Te veel uploads. Wacht even voor je opnieuw uploadt.' },
});

// ─── Static uploads folder ───────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/wines', wineRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/invoice', uploadLimiter, invoiceRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/excel', excelImportRoutes);
app.use('/api/admin', adminRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);

    // CORS errors
    if (err.message?.startsWith('CORS:')) {
        return res.status(403).json({ error: err.message });
    }

    // Multer errors (file type / size)
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Bestand is te groot.' });
    }
    if (err.message?.includes('toegestaan') || err.message?.includes('allowed')) {
        return res.status(400).json({ error: err.message });
    }

    const isProd = process.env.NODE_ENV === 'production';
    res.status(err.status || 500).json({
        error: isProd ? 'Er is een serverfout opgetreden.' : err.message,
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
