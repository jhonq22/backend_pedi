// backend/controllers/centroSaludController.js
const db = require('../config/db');

const getCentrosSalud = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, descripcion, estatus, fecha_creacion, fecha_actualizacion
             FROM lista_centro_salud
             ORDER BY id DESC`
        );
        res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error('Error al obtener centros de salud:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar los centros de salud', error: error.message });
    }
};

const createCentroSalud = async (req, res) => {
    try {
        const descripcion = String(req.body?.descripcion || '').trim();
        if (!descripcion) {
            return res.status(400).json({ status: 'error', message: 'La descripción del centro de salud es obligatoria.' });
        }

        const [dup] = await db.query(
            'SELECT id FROM lista_centro_salud WHERE LOWER(TRIM(descripcion)) = LOWER(?) LIMIT 1',
            [descripcion]
        );
        if (dup.length > 0) {
            return res.status(400).json({ status: 'error', message: 'Ya existe un centro de salud registrado con esa descripción.' });
        }

        const [result] = await db.query(
            'INSERT INTO lista_centro_salud (descripcion, estatus) VALUES (?, 1)',
            [descripcion]
        );

        res.status(201).json({
            status: 'success',
            message: 'Centro de salud creado exitosamente.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error al crear centro de salud:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al crear centro de salud', error: error.message });
    }
};

const updateCentroSalud = async (req, res) => {
    try {
        const { id } = req.params;
        const descripcion = String(req.body?.descripcion || '').trim();
        const estatus = req.body?.estatus !== undefined ? Number(req.body.estatus) : undefined;

        if (!descripcion) {
            return res.status(400).json({ status: 'error', message: 'La descripción del centro de salud es obligatoria.' });
        }

        const [existe] = await db.query('SELECT id FROM lista_centro_salud WHERE id = ? LIMIT 1', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Centro de salud no encontrado.' });
        }

        const [dup] = await db.query(
            'SELECT id FROM lista_centro_salud WHERE LOWER(TRIM(descripcion)) = LOWER(?) AND id <> ? LIMIT 1',
            [descripcion, id]
        );
        if (dup.length > 0) {
            return res.status(400).json({ status: 'error', message: 'Ya existe otro centro de salud con esa descripción.' });
        }

        await db.query(
            'UPDATE lista_centro_salud SET descripcion = ?, estatus = COALESCE(?, estatus) WHERE id = ?',
            [descripcion, estatus !== undefined && !isNaN(estatus) ? estatus : null, id]
        );

        res.json({ status: 'success', message: 'Centro de salud actualizado correctamente.' });
    } catch (error) {
        console.error('Error al actualizar centro de salud:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar centro de salud', error: error.message });
    }
};

const toggleCentroSaludStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const [existe] = await db.query('SELECT id, estatus FROM lista_centro_salud WHERE id = ? LIMIT 1', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Centro de salud no encontrado.' });
        }

        await db.query('UPDATE lista_centro_salud SET estatus = IF(estatus = 1, 0, 1) WHERE id = ?', [id]);
        res.json({ status: 'success', message: 'Estado del centro de salud actualizado.' });
    } catch (error) {
        console.error('Error al cambiar estado del centro de salud:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al cambiar estado', error: error.message });
    }
};

module.exports = {
    getCentrosSalud,
    createCentroSalud,
    updateCentroSalud,
    toggleCentroSaludStatus
};
