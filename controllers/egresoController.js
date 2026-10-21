// controllers/egresoController.js
const db = require('../config/db');

const resolverSolicitudId = async (solicitudIdOrPacienteId) => {
    if (!solicitudIdOrPacienteId) return null;
    const [sol] = await db.query('SELECT id FROM registro_solicitud WHERE id = ?', [solicitudIdOrPacienteId]);
    if (sol.length > 0) return sol[0].id;

    const [solPorPac] = await db.query(
        'SELECT id FROM registro_solicitud WHERE paciente_id = ? ORDER BY id DESC LIMIT 1',
        [solicitudIdOrPacienteId]
    );
    if (solPorPac.length > 0) return solPorPac[0].id;

    const [pac] = await db.query('SELECT id FROM paciente WHERE id = ?', [solicitudIdOrPacienteId]);
    if (pac.length > 0) {
        const [ins] = await db.query(
            `INSERT INTO registro_solicitud (paciente_id, centro_salud_id, tipo_operacion_id, fecha_solicitud, estatus, observacion_general, audit_usu_id, audit_ip, audit_dep_id)
             VALUES (?, 4, 1, CURDATE(), 'Pendiente', 'Solicitud inicial generada automáticamente', '1', '127.0.0.1', '1')`,
            [solicitudIdOrPacienteId]
        );
        return ins.insertId;
    }
    return null;
};

const getEgresos = async (req, res) => {
    try {
        const { registro_solicitud_id, paciente_id, hospitalizacion_id } = req.query;
        let query = `
            SELECT eh.*,
                   rs.paciente_id,
                   CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                   p.numero_historia_clinica
            FROM egreso_hospitalario eh
            LEFT JOIN registro_solicitud rs ON eh.registro_solicitud_id = rs.id
            LEFT JOIN paciente p ON rs.paciente_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (registro_solicitud_id) {
            query += ' AND eh.registro_solicitud_id = ?';
            params.push(registro_solicitud_id);
        }
        if (paciente_id) {
            query += ' AND rs.paciente_id = ?';
            params.push(paciente_id);
        }
        if (hospitalizacion_id) {
            query += ' AND eh.hospitalizacion_id = ?';
            params.push(hospitalizacion_id);
        }
        query += ' ORDER BY eh.fecha_egreso DESC, eh.id DESC';

        const [rows] = await db.query(query, params);
        res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error('Error al listar egresos hospitalarios:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar egresos', error: error.message });
    }
};

const getEgresoPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT eh.*,
                    rs.paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica
             FROM egreso_hospitalario eh
             LEFT JOIN registro_solicitud rs ON eh.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE eh.id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Epicrisis / egreso no encontrado' });
        }
        res.json({ status: 'success', data: rows[0] });
    } catch (error) {
        console.error('Error al obtener egreso:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar egreso', error: error.message });
    }
};

const createEgreso = async (req, res) => {
    try {
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const {
            registro_solicitud_id,
            paciente_id,
            hospitalizacion_id,
            fecha_ingreso,
            fecha_egreso,
            motivo_egreso = 'Mejoría clínica / Alta médica',
            diagnostico_ingreso,
            diagnostico_principal_egreso,
            diagnosticos_secundarios,
            resumen_hospitalizacion,
            procedimientos_intervenciones,
            condicion_salida = 'Estable hemodinámicamente',
            conciliacion_medicacion_alta,
            indicaciones_cuidados_generales,
            plan_citas_control,
            estatus_alta = 'Borrador'
        } = req.body;

        const targetSolicitudId = registro_solicitud_id || await resolverSolicitudId(paciente_id);
        if (!targetSolicitudId || !fecha_ingreso || !fecha_egreso || !diagnostico_principal_egreso || !conciliacion_medicacion_alta) {
            return res.status(400).json({
                status: 'error',
                message: 'registro_solicitud_id, fechas de estancia, diagnóstico de egreso y conciliación de medicamentos al alta son obligatorios'
            });
        }

        const [result] = await db.query(
            `INSERT INTO egreso_hospitalario (
                registro_solicitud_id,
                hospitalizacion_id,
                fecha_ingreso,
                fecha_egreso,
                motivo_egreso,
                diagnostico_ingreso,
                diagnostico_principal_egreso,
                diagnosticos_secundarios,
                resumen_hospitalizacion,
                procedimientos_intervenciones,
                condicion_salida,
                conciliacion_medicacion_alta,
                indicaciones_cuidados_generales,
                plan_citas_control,
                estatus_alta,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetSolicitudId,
                hospitalizacion_id || null,
                fecha_ingreso,
                fecha_egreso,
                motivo_egreso,
                diagnostico_ingreso || 'Cardiopatía congénita',
                diagnostico_principal_egreso,
                diagnosticos_secundarios || null,
                resumen_hospitalizacion || 'Evolución postoperatoria favorable, hemodinamia estable',
                procedimientos_intervenciones || null,
                condicion_salida,
                conciliacion_medicacion_alta,
                indicaciones_cuidados_generales || 'Reposo relativo y alarma ante disnea o fiebre',
                plan_citas_control || 'Control por cardiología infantil en 15 días',
                estatus_alta,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        res.status(201).json({
            status: 'success',
            message: 'Epicrisis / Egreso hospitalario guardado exitosamente',
            id: result.insertId,
            registro_solicitud_id: targetSolicitudId,
            estatus_alta
        });
    } catch (error) {
        console.error('Error al registrar egreso:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al guardar egreso', error: error.message });
    }
};

const updateEgreso = async (req, res) => {
    try {
        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        // 1. REGLA DE BLOQUEO DE INMUTABILIDAD
        const [existe] = await db.query('SELECT estatus_alta FROM egreso_hospitalario WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Egreso hospitalario no encontrado' });
        }

        if (existe[0].estatus_alta === 'Finalizado' || existe[0].estatus_alta === 'Firmado') {
            return res.status(403).json({
                status: 'error',
                message: 'La epicrisis de egreso está Firmada/Finalizada y bloqueada contra modificaciones por salvaguarda clínica.'
            });
        }

        const {
            registro_solicitud_id,
            hospitalizacion_id,
            fecha_ingreso,
            fecha_egreso,
            motivo_egreso,
            diagnostico_ingreso,
            diagnostico_principal_egreso,
            diagnosticos_secundarios,
            resumen_hospitalizacion,
            procedimientos_intervenciones,
            condicion_salida,
            conciliacion_medicacion_alta,
            indicaciones_cuidados_generales,
            plan_citas_control,
            estatus_alta
        } = req.body;

        await db.query(
            `UPDATE egreso_hospitalario SET
                registro_solicitud_id = COALESCE(?, registro_solicitud_id),
                hospitalizacion_id = COALESCE(?, hospitalizacion_id),
                fecha_ingreso = COALESCE(?, fecha_ingreso),
                fecha_egreso = COALESCE(?, fecha_egreso),
                motivo_egreso = COALESCE(?, motivo_egreso),
                diagnostico_ingreso = COALESCE(?, diagnostico_ingreso),
                diagnostico_principal_egreso = COALESCE(?, diagnostico_principal_egreso),
                diagnosticos_secundarios = COALESCE(?, diagnosticos_secundarios),
                resumen_hospitalizacion = COALESCE(?, resumen_hospitalizacion),
                procedimientos_intervenciones = COALESCE(?, procedimientos_intervenciones),
                condicion_salida = COALESCE(?, condicion_salida),
                conciliacion_medicacion_alta = COALESCE(?, conciliacion_medicacion_alta),
                indicaciones_cuidados_generales = COALESCE(?, indicaciones_cuidados_generales),
                plan_citas_control = COALESCE(?, plan_citas_control),
                estatus_alta = COALESCE(?, estatus_alta),
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`,
            [
                registro_solicitud_id || null,
                hospitalizacion_id || null,
                fecha_ingreso || null,
                fecha_egreso || null,
                motivo_egreso || null,
                diagnostico_ingreso || null,
                diagnostico_principal_egreso || null,
                diagnosticos_secundarios || null,
                resumen_hospitalizacion || null,
                procedimientos_intervenciones || null,
                condicion_salida || null,
                conciliacion_medicacion_alta || null,
                indicaciones_cuidados_generales || null,
                plan_citas_control || null,
                estatus_alta || null,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                id
            ]
        );

        res.json({ status: 'success', message: 'Epicrisis de egreso actualizada', id });
    } catch (error) {
        console.error('Error al actualizar egreso:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar egreso', error: error.message });
    }
};

module.exports = {
    getEgresos,
    getEgresoPorId,
    createEgreso,
    updateEgreso
};
