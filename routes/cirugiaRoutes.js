// routes/cirugiaRoutes.js
const express = require('express');
const router = express.Router();
const cirugiaController = require('../controllers/cirugiaController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/', verificarToken, cirugiaController.getCirugias);
router.get('/:id', verificarToken, cirugiaController.getCirugiaPorId);
router.post('/', verificarToken, inyectarAuditoria, cirugiaController.createCirugia);
router.put('/:id', verificarToken, inyectarAuditoria, cirugiaController.updateCirugia);
router.delete('/:id', verificarToken, inyectarAuditoria, cirugiaController.deleteCirugia);

module.exports = router;
