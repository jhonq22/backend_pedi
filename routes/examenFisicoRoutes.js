// routes/examenFisicoRoutes.js
const express = require('express');
const router = express.Router();
const examenFisicoController = require('../controllers/examenFisicoController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/:id/examen-fisico', verificarToken, examenFisicoController.getExamenFisicoPorPaciente);
router.post('/:id/examen-fisico', verificarToken, inyectarAuditoria, examenFisicoController.createExamenFisico);

module.exports = router;
