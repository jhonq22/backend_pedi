// routes/pacienteRoutes.js
const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

const verificarNoRedEnlaceCrear = (req, res, next) => {
    if (Number(req.usuario?.rol_id) === 2) {
        return res.status(403).json({
            status: 'error',
            message: 'El rol Red de Enlace solo puede editar pacientes existentes, no agregar nuevos.'
        });
    }
    return next();
};

router.get('/', verificarToken, pacienteController.getPacientes);
router.get('/:id', verificarToken, pacienteController.getPacientePorId);
router.post('/', verificarToken, verificarNoRedEnlaceCrear, inyectarAuditoria, pacienteController.createPaciente);
router.put('/:id', verificarToken, inyectarAuditoria, pacienteController.updatePaciente);
router.post('/:id/contactos', verificarToken, inyectarAuditoria, pacienteController.addContacto);

module.exports = router;
