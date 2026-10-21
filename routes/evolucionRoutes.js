// routes/evolucionRoutes.js
const express = require('express');
const router = express.Router();
const evolucionController = require('../controllers/evolucionController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/', verificarToken, evolucionController.getEvoluciones);
router.get('/:id', verificarToken, evolucionController.getEvolucionPorId);
router.post('/', verificarToken, inyectarAuditoria, evolucionController.createEvolucion);
router.put('/:id', verificarToken, inyectarAuditoria, evolucionController.updateEvolucion);

module.exports = router;
