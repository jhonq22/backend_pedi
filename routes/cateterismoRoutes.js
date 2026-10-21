// routes/cateterismoRoutes.js
const express = require('express');
const router = express.Router();
const cateterismoController = require('../controllers/cateterismoController');
const verificarToken = require('../middlewares/authMiddleware');
const inyectarAuditoria = require('../middlewares/auditMiddleware');

router.get('/', verificarToken, cateterismoController.getCateterismos);
router.get('/:id', verificarToken, cateterismoController.getCateterismoPorId);
router.post('/', verificarToken, inyectarAuditoria, cateterismoController.createCateterismo);
router.put('/:id', verificarToken, inyectarAuditoria, cateterismoController.updateCateterismo);
router.delete('/:id', verificarToken, cateterismoController.deleteCateterismo);

module.exports = router;
