// backend/routes/centroSaludRoutes.js
const express = require('express');
const router = express.Router();
const centroSaludController = require('../controllers/centroSaludController');
const verificarToken = require('../middlewares/authMiddleware');

const verificarAdministrador = (req, res, next) => {
    if (Number(req.usuario?.rol_id) !== 1) {
        return res.status(403).json({
            status: 'error',
            message: 'Acceso restringido al rol Administrador.'
        });
    }
    return next();
};

router.get('/', verificarToken, verificarAdministrador, centroSaludController.getCentrosSalud);
router.post('/', verificarToken, verificarAdministrador, centroSaludController.createCentroSalud);
router.put('/:id', verificarToken, verificarAdministrador, centroSaludController.updateCentroSalud);
router.delete('/:id', verificarToken, verificarAdministrador, centroSaludController.toggleCentroSaludStatus);

module.exports = router;
