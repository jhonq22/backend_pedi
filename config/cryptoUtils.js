const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const secret = process.env.CRYPTO_SECRET || 'plantilla_segura_secret_key_123';
const key = crypto.scryptSync(secret, 'salt_app_2026', 32);

const encrypt = (text) => {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
    } catch (e) {
        return text;
    }
};

const decrypt = (text) => {
    try {
        if (!text || !text.includes(':')) return text;
        const [ivPart, encryptedPart] = text.split(':');
        const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivPart, 'hex'));
        let decrypted = decipher.update(encryptedPart, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        return text;
    }
};

module.exports = { encrypt, decrypt };