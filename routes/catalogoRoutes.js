// routes/catalogoRoutes.js
const express = require('express');
const router = express.Router();
const catalogoController = require('../controllers/catalogoController');

// Los catálogos pueden consultarse libremente para inicialización de formularios
router.get('/', catalogoController.getCatalogos);
router.get('/:tipo', catalogoController.getCatalogoPorTipo);

module.exports = router;
