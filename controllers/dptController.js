// controllers/dptController.js
const db = require('../config/db');

/**
 * Obtener todos los estados de Venezuela
 */
const getEstados = async (req, res) => {
    try {
        const [estados] = await db.query(
            'SELECT id_estado, estado, `iso_3166-2` AS iso FROM estados ORDER BY estado ASC'
        );
        res.json({
            status: 'success',
            data: estados
        });
    } catch (error) {
        console.error('Error al obtener estados DPT:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error al consultar estados en la base de datos',
            error: error.message
        });
    }
};

/**
 * Obtener municipios por id_estado (o por query param / nombre de estado)
 */
const getMunicipiosPorEstado = async (req, res) => {
    try {
        const estadoParam = req.params.id_estado || req.query.id_estado || req.query.estado_id || req.query.estado;

        if (!estadoParam) {
            return res.status(400).json({
                status: 'error',
                message: 'Debe especificar el id_estado o estado'
            });
        }

        let query = '';
        let params = [];

        if (!isNaN(estadoParam)) {
            query = 'SELECT id_municipio, id_estado, municipio FROM municipios WHERE id_estado = ? ORDER BY municipio ASC';
            params = [Number(estadoParam)];
        } else {
            // Si viene el nombre del estado (ej. "Miranda", "Distrito Capital")
            query = `SELECT m.id_municipio, m.id_estado, m.municipio 
                     FROM municipios m
                     JOIN estados e ON m.id_estado = e.id_estado
                     WHERE LOWER(e.estado) = LOWER(?)
                     ORDER BY m.municipio ASC`;
            params = [estadoParam.trim()];
        }

        const [municipios] = await db.query(query, params);
        res.json({
            status: 'success',
            total: municipios.length,
            data: municipios
        });
    } catch (error) {
        console.error('Error al obtener municipios DPT:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error al consultar municipios en la base de datos',
            error: error.message
        });
    }
};

/**
 * Obtener parroquias por id_municipio (o por query param / nombre de municipio)
 */
const getParroquiasPorMunicipio = async (req, res) => {
    try {
        const municipioParam = req.params.id_municipio || req.query.id_municipio || req.query.municipio_id || req.query.municipio;

        if (!municipioParam) {
            return res.status(400).json({
                status: 'error',
                message: 'Debe especificar el id_municipio o municipio'
            });
        }

        let query = '';
        let params = [];

        if (!isNaN(municipioParam)) {
            query = 'SELECT id_parroquia, id_municipio, parroquia FROM parroquias WHERE id_municipio = ? ORDER BY parroquia ASC';
            params = [Number(municipioParam)];
        } else {
            // Si viene el nombre del municipio
            query = `SELECT p.id_parroquia, p.id_municipio, p.parroquia 
                     FROM parroquias p
                     JOIN municipios m ON p.id_municipio = m.id_municipio
                     WHERE LOWER(m.municipio) = LOWER(?)
                     ORDER BY p.parroquia ASC`;
            params = [municipioParam.trim()];
        }

        const [parroquias] = await db.query(query, params);
        res.json({
            status: 'success',
            total: parroquias.length,
            data: parroquias
        });
    } catch (error) {
        console.error('Error al obtener parroquias DPT:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error al consultar parroquias en la base de datos',
            error: error.message
        });
    }
};

/**
 * Obtener ciudades por id_estado (o por query param / nombre de estado)
 */
const getCiudadesPorEstado = async (req, res) => {
    try {
        const estadoParam = req.params.id_estado || req.query.id_estado || req.query.estado_id || req.query.estado;

        if (!estadoParam) {
            return res.status(400).json({
                status: 'error',
                message: 'Debe especificar el id_estado o estado'
            });
        }

        let query = '';
        let params = [];

        if (!isNaN(estadoParam)) {
            query = 'SELECT id_ciudad, id_estado, ciudad, capital FROM ciudades WHERE id_estado = ? ORDER BY capital DESC, ciudad ASC';
            params = [Number(estadoParam)];
        } else {
            // Si viene el nombre del estado (ej. "Miranda", "Distrito Capital")
            query = `SELECT c.id_ciudad, c.id_estado, c.ciudad, c.capital 
                     FROM ciudades c
                     JOIN estados e ON c.id_estado = e.id_estado
                     WHERE LOWER(e.estado) = LOWER(?)
                     ORDER BY c.capital DESC, c.ciudad ASC`;
            params = [estadoParam.trim()];
        }

        const [ciudades] = await db.query(query, params);
        res.json({
            status: 'success',
            total: ciudades.length,
            data: ciudades
        });
    } catch (error) {
        console.error('Error al obtener ciudades DPT:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error al consultar ciudades en la base de datos',
            error: error.message
        });
    }
};

module.exports = {
    getEstados,
    getCiudadesPorEstado,
    getMunicipiosPorEstado,
    getParroquiasPorMunicipio
};

