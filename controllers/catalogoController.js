// controllers/catalogoController.js
const db = require('../config/db');

/**
 * Obtener todos los catálogos del sistema agrupados por tipo
 * Incluye lista_tipo_general, lista_centro_salud y tipo_operacion
 */
const getCatalogos = async (req, res) => {
    try {
        // 1. Obtener todos los registros activos de lista_tipo_general
        const [tiposGenerales] = await db.query(
            `SELECT id, tipo, nombre, padre_id, orden 
             FROM lista_tipo_general 
             WHERE estatus = 1 
             ORDER BY tipo, orden ASC, nombre ASC`
        );

        // Agrupar por tipo (tipo_cita, tipo_documento, parentesco, etc.)
        const agrupados = tiposGenerales.reduce((acc, curr) => {
            if (!acc[curr.tipo]) {
                acc[curr.tipo] = [];
            }
            acc[curr.tipo].push({
                id: curr.id,
                nombre: curr.nombre,
                padre_id: curr.padre_id,
                orden: curr.orden
            });
            return acc;
        }, {});

        // 2. Centros de salud
        const [centros] = await db.query(
            `SELECT id, descripcion AS nombre, descripcion, estatus 
             FROM lista_centro_salud 
             WHERE estatus = 1 
             ORDER BY descripcion ASC`
        );

        // 3. Tipos de operación
        const [operaciones] = await db.query(
            `SELECT id, nombre, descripcion, estatus 
             FROM tipo_operacion 
             WHERE estatus = 1 
             ORDER BY nombre ASC`
        );

        res.json({
            status: 'success',
            catalogos: agrupados,
            centros_salud: centros,
            tipos_operacion: operaciones
        });
    } catch (error) {
        console.error('Error al obtener catálogos:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al cargar catálogos', error: error.message });
    }
};

/**
 * Obtener elementos de un catálogo específico por su clave de tipo
 */
const getCatalogoPorTipo = async (req, res) => {
    const { tipo } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT id, nombre, padre_id, orden 
             FROM lista_tipo_general 
             WHERE tipo = ? AND estatus = 1 
             ORDER BY orden ASC, nombre ASC`,
            [tipo]
        );
        res.json({ status: 'success', tipo, data: rows });
    } catch (error) {
        console.error(`Error al obtener catálogo ${tipo}:`, error);
        res.status(500).json({ status: 'error', message: `Error al obtener catálogo ${tipo}`, error: error.message });
    }
};

module.exports = {
    getCatalogos,
    getCatalogoPorTipo
};
