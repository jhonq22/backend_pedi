// routes/agendaRoutes.js
const express = require('express');
const router = express.Router();
const agendaController = require('../controllers/agendaController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/', verificarToken, agendaController.getCitas);
router.get('/:id', verificarToken, agendaController.getCitaPorId);
router.post('/', verificarToken, inyectarAuditoria, agendaController.createCita);
router.put('/:id', verificarToken, inyectarAuditoria, agendaController.updateCita);

module.exports = router;
