// routes/dptRoutes.js
const express = require('express');
const router = express.Router();
const dptController = require('../controllers/dptController');

// Rutas para División Político Territorial (DPT) y Ciudades
router.get('/estados', dptController.getEstados);
router.get('/ciudades', dptController.getCiudadesPorEstado);
router.get('/ciudades/:id_estado', dptController.getCiudadesPorEstado);
router.get('/municipios', dptController.getMunicipiosPorEstado);
router.get('/municipios/:id_estado', dptController.getMunicipiosPorEstado);
router.get('/parroquias', dptController.getParroquiasPorMunicipio);
router.get('/parroquias/:id_municipio', dptController.getParroquiasPorMunicipio);

module.exports = router;

