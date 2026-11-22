// backend/routes/precargaReferenciaRoutes.js
const express = require('express');
const router = express.Router();
const precargaController = require('../controllers/precargaReferenciaController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

// Permitir acceso únicamente a rol_id = 1 (Admin), rol_id = 2 (Red de Enlace) o rol_id = 6 (Centro de Referencia)
const verificarRolReferencia = (req, res, next) => {
    const rolId = Number(req.usuario?.rol_id);
    if (rolId === 1 || rolId === 2 || rolId === 6) {
        return next();
    }
    return res.status(403).json({
        status: 'error',
        message: 'Acceso restringido al módulo de Referencias.'
    });
};

// Rol 2 (Red de Enlace) solo puede consultar y actualizar, nunca crear nuevas precargas
const verificarRolCrearPrecarga = (req, res, next) => {
    const rolId = Number(req.usuario?.rol_id);
    if (rolId === 1 || rolId === 6) {
        return next();
    }
    return res.status(403).json({
        status: 'error',
        message: 'Su rol no tiene permisos para crear nuevas precargas de referencia.'
    });
};

router.get('/catalogos', verificarToken, verificarRolReferencia, precargaController.getCatalogosPrecarga);
router.get('/buscar-paciente', verificarToken, verificarRolReferencia, precargaController.buscarPacientePorDocumento);
router.get('/precarga', verificarToken, verificarRolReferencia, precargaController.listarHistoricoReferencias);
router.get('/precarga/:id', verificarToken, verificarRolReferencia, precargaController.getReferenciaPorId);
router.post('/precarga', verificarToken, verificarRolCrearPrecarga, inyectarAuditoria, precargaController.crearPrecargaReferencia);
router.put('/precarga/:id', verificarToken, verificarRolReferencia, inyectarAuditoria, precargaController.actualizarPrecargaReferencia);

module.exports = router;
