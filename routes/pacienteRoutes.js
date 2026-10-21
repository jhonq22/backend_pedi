// routes/pacienteRoutes.js
const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/', verificarToken, pacienteController.getPacientes);
router.get('/:id', verificarToken, pacienteController.getPacientePorId);
router.post('/', verificarToken, inyectarAuditoria, pacienteController.createPaciente);
router.put('/:id', verificarToken, inyectarAuditoria, pacienteController.updatePaciente);
router.post('/:id/contactos', verificarToken, inyectarAuditoria, pacienteController.addContacto);

module.exports = router;
