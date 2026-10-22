// routes/egresoRoutes.js
const express = require('express');
const router = express.Router();
const egresoController = require('../controllers/egresoController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/', verificarToken, egresoController.getEgresos);
router.post('/seed-demo', verificarToken, inyectarAuditoria, egresoController.seedDemoEgreso);
router.get('/:id', verificarToken, egresoController.getEgresoPorId);
router.post('/', verificarToken, inyectarAuditoria, egresoController.createEgreso);
router.put('/:id', verificarToken, inyectarAuditoria, egresoController.updateEgreso);
router.delete('/:id', verificarToken, inyectarAuditoria, egresoController.deleteEgreso);

module.exports = router;
