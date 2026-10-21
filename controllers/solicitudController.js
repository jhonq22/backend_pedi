// controllers/solicitudController.js
const db = require('../config/db');

/**
 * Listar solicitudes con filtros (por paciente_id, estatus, centro, etc.)
 */
const getSolicitudes = async (req, res) => {
    try {
        const { paciente_id, estatus, centro_salud_id, tipo_operacion_id } = req.query;
        let query = `
            SELECT rs.*,
                   CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido) AS paciente_nombre,
                   p.numero_historia_clinica,
                   cs.descripcion AS centro_salud_nombre,
                   top.nombre AS tipo_operacion_nombre,
                   tc.nombre AS tipo_cita_nombre,
                   COALESCE(tp.nombre, top.nombre) AS procedimiento_nombre
            FROM registro_solicitud rs
            LEFT JOIN paciente p ON rs.paciente_id = p.id
            LEFT JOIN lista_centro_salud cs ON rs.centro_salud_id = cs.id
            LEFT JOIN tipo_operacion top ON rs.tipo_operacion_id = top.id
            LEFT JOIN lista_tipo_general tc ON rs.tipo_cita_id = tc.id
            LEFT JOIN lista_tipo_general tp ON rs.procedimiento_planificado_id = tp.id
            WHERE 1=1
        `;
        const params = [];
        if (paciente_id) {
            query += ' AND rs.paciente_id = ?';
            params.push(paciente_id);
        }
        if (estatus) {
            query += ' AND rs.estatus = ?';
            params.push(estatus);
        }
        if (centro_salud_id) {
            query += ' AND rs.centro_salud_id = ?';
            params.push(centro_salud_id);
        }
        if (tipo_operacion_id) {
            query += ' AND rs.tipo_operacion_id = ?';
            params.push(tipo_operacion_id);
        }
        query += ' ORDER BY rs.id DESC';

        const [rows] = await db.query(query, params);
        res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error('Error al listar solicitudes:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar solicitudes', error: error.message });
    }
};

/**
 * Obtener detalle de una solicitud específica
 */
const getSolicitudPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT rs.*,
                    CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido) AS paciente_nombre,
                    p.numero_historia_clinica,
                    cs.descripcion AS centro_salud_nombre,
                    top.nombre AS tipo_operacion_nombre,
                    tc.nombre AS tipo_cita_nombre,
                    COALESCE(tp.nombre, top.nombre) AS procedimiento_nombre
             FROM registro_solicitud rs
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             LEFT JOIN lista_centro_salud cs ON rs.centro_salud_id = cs.id
             LEFT JOIN tipo_operacion top ON rs.tipo_operacion_id = top.id
             LEFT JOIN lista_tipo_general tc ON rs.tipo_cita_id = tc.id
             LEFT JOIN lista_tipo_general tp ON rs.procedimiento_planificado_id = tp.id
             WHERE rs.id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Solicitud no encontrada' });
        }
        res.json({ status: 'success', data: rows[0] });
    } catch (error) {
        console.error('Error al obtener solicitud:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar solicitud', error: error.message });
    }
};

/**
 * Obtener o crear solicitud activa para un paciente
 */
const getOCrearSolicitudActiva = async (req, res) => {
    try {
        const { paciente_id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        // Verificar paciente
        const [paciente] = await db.query('SELECT id FROM paciente WHERE id = ?', [paciente_id]);
        if (paciente.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Paciente no encontrado' });
        }

        // Buscar solicitud pendiente, programada o activa existente
        const [existentes] = await db.query(
            `SELECT rs.*,
                    cs.descripcion AS centro_salud_nombre,
                    top.nombre AS tipo_operacion_nombre,
                    tc.nombre AS tipo_cita_nombre,
                    COALESCE(tp.nombre, top.nombre) AS procedimiento_nombre
             FROM registro_solicitud rs
             LEFT JOIN lista_centro_salud cs ON rs.centro_salud_id = cs.id
             LEFT JOIN tipo_operacion top ON rs.tipo_operacion_id = top.id
             LEFT JOIN lista_tipo_general tc ON rs.tipo_cita_id = tc.id
             LEFT JOIN lista_tipo_general tp ON rs.procedimiento_planificado_id = tp.id
             WHERE rs.paciente_id = ?
             ORDER BY rs.id DESC
             LIMIT 1`,
            [paciente_id]
        );

        if (existentes.length > 0) {
            return res.json({ status: 'success', data: existentes[0] });
        }

        // Si no tiene solicitud, crear una automática
        const [insertResult] = await db.query(
            `INSERT INTO registro_solicitud (
                paciente_id,
                centro_salud_id,
                tipo_operacion_id,
                fecha_solicitud,
                fecha_cita,
                estatus,
                observacion_general,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, 4, 1, CURDATE(), CURDATE(), 'Programada', 'Solicitud inicial generada automáticamente', ?, ?, ?)`,
            [paciente_id, audit.audit_usu_id, audit.audit_ip, audit.audit_dep_id]
        );

        const [nueva] = await db.query(
            `SELECT rs.*,
                    cs.descripcion AS centro_salud_nombre,
                    top.nombre AS tipo_operacion_nombre,
                    tc.nombre AS tipo_cita_nombre,
                    COALESCE(tp.nombre, top.nombre) AS procedimiento_nombre
             FROM registro_solicitud rs
             LEFT JOIN lista_centro_salud cs ON rs.centro_salud_id = cs.id
             LEFT JOIN tipo_operacion top ON rs.tipo_operacion_id = top.id
             LEFT JOIN lista_tipo_general tc ON rs.tipo_cita_id = tc.id
             LEFT JOIN lista_tipo_general tp ON rs.procedimiento_planificado_id = tp.id
             WHERE rs.id = ?`,
            [insertResult.insertId]
        );

        res.status(201).json({ status: 'success', data: nueva[0] });
    } catch (error) {
        console.error('Error al obtener o crear solicitud activa:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al gestionar solicitud', error: error.message });
    }
};

/**
 * Registrar una nueva solicitud formal
 */
const createSolicitud = async (req, res) => {
    try {
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const {
            paciente_id,
            centro_salud_id,
            tipo_operacion_id,
            procedimiento_planificado_id,
            fecha_solicitud = new Date().toISOString().split('T')[0],
            fecha_cita,
            horario_cita,
            tipo_cita_id,
            pediatra_responsable,
            diagnostico_motivo,
            fecha_respuesta,
            estatus = 'Programada',
            observacion_general
        } = req.body;

        if (!paciente_id) {
            return res.status(400).json({ status: 'error', message: 'El campo paciente_id es requerido' });
        }

        const [paciente] = await db.query('SELECT id FROM paciente WHERE id = ?', [paciente_id]);
        if (paciente.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Paciente no encontrado' });
        }

        const [result] = await db.query(
            `INSERT INTO registro_solicitud (
                paciente_id,
                centro_salud_id,
                tipo_operacion_id,
                procedimiento_planificado_id,
                fecha_solicitud,
                fecha_cita,
                horario_cita,
                tipo_cita_id,
                pediatra_responsable,
                diagnostico_motivo,
                fecha_respuesta,
                estatus,
                observacion_general,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                paciente_id,
                centro_salud_id || null,
                tipo_operacion_id || null,
                procedimiento_planificado_id || null,
                fecha_solicitud,
                fecha_cita || null,
                horario_cita || null,
                tipo_cita_id || null,
                pediatra_responsable || null,
                diagnostico_motivo || null,
                fecha_respuesta || null,
                estatus,
                observacion_general || null,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        res.status(201).json({
            status: 'success',
            message: 'Solicitud clínica registrada exitosamente',
            id: result.insertId,
            registro_solicitud_id: result.insertId
        });
    } catch (error) {
        console.error('Error al registrar solicitud:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al registrar solicitud', error: error.message });
    }
};

/**
 * Actualizar datos o estatus de una solicitud
 */
const updateSolicitud = async (req, res) => {
    try {
        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const {
            centro_salud_id,
            tipo_operacion_id,
            procedimiento_planificado_id,
            fecha_solicitud,
            fecha_cita,
            horario_cita,
            tipo_cita_id,
            pediatra_responsable,
            diagnostico_motivo,
            fecha_respuesta,
            estatus,
            observacion_general
        } = req.body;

        const [existe] = await db.query('SELECT id FROM registro_solicitud WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Solicitud no encontrada' });
        }

        await db.query(
            `UPDATE registro_solicitud SET
                centro_salud_id = COALESCE(?, centro_salud_id),
                tipo_operacion_id = COALESCE(?, tipo_operacion_id),
                procedimiento_planificado_id = COALESCE(?, procedimiento_planificado_id),
                fecha_solicitud = COALESCE(?, fecha_solicitud),
                fecha_cita = COALESCE(?, fecha_cita),
                horario_cita = COALESCE(?, horario_cita),
                tipo_cita_id = COALESCE(?, tipo_cita_id),
                pediatra_responsable = COALESCE(?, pediatra_responsable),
                diagnostico_motivo = COALESCE(?, diagnostico_motivo),
                fecha_respuesta = COALESCE(?, fecha_respuesta),
                estatus = COALESCE(?, estatus),
                observacion_general = COALESCE(?, observacion_general),
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`,
            [
                centro_salud_id,
                tipo_operacion_id,
                procedimiento_planificado_id,
                fecha_solicitud,
                fecha_cita,
                horario_cita,
                tipo_cita_id,
                pediatra_responsable,
                diagnostico_motivo,
                fecha_respuesta,
                estatus,
                observacion_general,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                id
            ]
        );

        res.json({ status: 'success', message: 'Solicitud actualizada exitosamente' });
    } catch (error) {
        console.error('Error al actualizar solicitud:', error);
        res.status(500).json({ status: 'error', message: 'Error al actualizar solicitud', error: error.message });
    }
};

module.exports = {
    getSolicitudes,
    getSolicitudPorId,
    getOCrearSolicitudActiva,
    createSolicitud,
    updateSolicitud
};
