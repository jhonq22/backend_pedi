// routes/radiografiaRoutes.js
const express = require('express');
const router = express.Router();
const radiografiaController = require('../controllers/radiografiaController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/', verificarToken, radiografiaController.getRadiografias);
router.get('/:id', verificarToken, radiografiaController.getRadiografiaPorId);
router.post('/', verificarToken, inyectarAuditoria, radiografiaController.createRadiografia);
router.put('/:id', verificarToken, inyectarAuditoria, radiografiaController.updateRadiografia);
router.delete('/:id', verificarToken, radiografiaController.deleteRadiografia);

module.exports = router;
