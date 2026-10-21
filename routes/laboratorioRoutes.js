// routes/laboratorioRoutes.js
const express = require('express');
const router = express.Router();
const laboratorioController = require('../controllers/laboratorioController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/', verificarToken, laboratorioController.getLaboratorios);
router.get('/:id', verificarToken, laboratorioController.getLaboratorioPorId);
router.post('/', verificarToken, inyectarAuditoria, laboratorioController.createLaboratorio);
router.put('/:id', verificarToken, inyectarAuditoria, laboratorioController.updateLaboratorio);

module.exports = router;
