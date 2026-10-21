// routes/solicitudRoutes.js
const express = require('express');
const router = express.Router();
const solicitudController = require('../controllers/solicitudController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/', verificarToken, solicitudController.getSolicitudes);
router.get('/:id', verificarToken, solicitudController.getSolicitudPorId);
router.get('/paciente/:paciente_id/activa', verificarToken, inyectarAuditoria, solicitudController.getOCrearSolicitudActiva);
router.post('/', verificarToken, inyectarAuditoria, solicitudController.createSolicitud);
router.put('/:id', verificarToken, inyectarAuditoria, solicitudController.updateSolicitud);

module.exports = router;
