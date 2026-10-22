// routes/laboratorioRoutes.js
const express = require('express');
const router = express.Router();
const laboratorioController = require('../controllers/laboratorioController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/', verificarToken, laboratorioController.getLaboratorios);
router.get('/:id', verificarToken, laboratorioController.getLaboratorioPorId);
router.post('/', verificarToken, inyectarAuditoria, laboratorioController.createLaboratorio);
router.post('/seed-demo', verificarToken, inyectarAuditoria, laboratorioController.seedDemoLaboratorios);
router.put('/:id', verificarToken, inyectarAuditoria, laboratorioController.updateLaboratorio);
router.put('/:id/finalizar', verificarToken, inyectarAuditoria, laboratorioController.finalizarLaboratorio);
router.delete('/:id', verificarToken, inyectarAuditoria, laboratorioController.eliminarLaboratorio);

module.exports = router;
