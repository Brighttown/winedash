import jwt from 'jsonwebtoken';

// JWT_SECRET must be set; server.js already enforces this at startup.
const JWT_SECRET = process.env.JWT_SECRET;

export const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authenticatie vereist' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ error: 'Ongeldig of verlopen token' });
    }
};

export const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Alleen admins hebben hier toegang tot.' });
    }
    next();
};
