// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Se requiere un token de autenticación.' });
    }

    try {
        const secret = process.env.JWT_SECRET || 'secret_key_123';
        const decodificado = jwt.verify(token, secret);
        req.usuario = decodificado;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Token inválido o expirado.' });
    }
};

module.exports = verificarToken;