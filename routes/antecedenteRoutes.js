// routes/antecedenteRoutes.js
const express = require('express');
const router = express.Router();
const antecedenteController = require('../controllers/antecedenteController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/:id/antecedentes', verificarToken, antecedenteController.getAntecedentesPorPaciente);
router.post('/:id/antecedentes', verificarToken, inyectarAuditoria, antecedenteController.saveAntecedentes);

module.exports = router;
