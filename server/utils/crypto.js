import crypto from 'crypto';

// Derive a stable 32-byte key from JWT_SECRET so we don't need a new env var.
// If you ever rotate JWT_SECRET, existing encrypted POS credentials become unreadable.
const getKey = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET ontbreekt');
    return crypto.createHash('sha256').update(`pos-int:${secret}`).digest();
};

export const encryptSecret = (plaintext) => {
    if (plaintext == null || plaintext === '') return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
};

export const decryptSecret = (payload) => {
    if (!payload) return null;
    const [ivB64, tagB64, encB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !encB64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]);
    return dec.toString('utf8');
};

export const maskSecret = (payload) => {
    const plain = decryptSecret(payload);
    if (!plain) return null;
    const last4 = plain.slice(-4);
    return `••••${last4}`;
};
