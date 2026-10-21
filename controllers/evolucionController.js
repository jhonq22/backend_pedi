// controllers/evolucionController.js
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

const getEvoluciones = async (req, res) => {
    try {
        const { registro_solicitud_id, paciente_id, hospitalizacion_id } = req.query;
        let query = `
            SELECT ed.*,
                   rs.paciente_id,
                   CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                   p.numero_historia_clinica
            FROM evolucion_diaria ed
            LEFT JOIN registro_solicitud rs ON ed.registro_solicitud_id = rs.id
            LEFT JOIN paciente p ON rs.paciente_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (registro_solicitud_id) {
            query += ' AND ed.registro_solicitud_id = ?';
            params.push(registro_solicitud_id);
        }
        if (paciente_id) {
            query += ' AND rs.paciente_id = ?';
            params.push(paciente_id);
        }
        if (hospitalizacion_id) {
            query += ' AND ed.hospitalizacion_id = ?';
            params.push(hospitalizacion_id);
        }
        query += ' ORDER BY ed.fecha_evolucion DESC, ed.hora_evolucion DESC, ed.id DESC';

        const [rows] = await db.query(query, params);
        res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error('Error al listar evoluciones diarias:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar evoluciones', error: error.message });
    }
};

const getEvolucionPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT ed.*,
                    rs.paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica
             FROM evolucion_diaria ed
             LEFT JOIN registro_solicitud rs ON ed.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE ed.id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Evolución no encontrada' });
        }
        res.json({ status: 'success', data: rows[0] });
    } catch (error) {
        console.error('Error al obtener evolución:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar nota de evolución', error: error.message });
    }
};

const createEvolucion = async (req, res) => {
    try {
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const {
            registro_solicitud_id,
            paciente_id,
            hospitalizacion_id,
            fecha_evolucion,
            hora_evolucion,
            dia_hospitalizacion = 1,
            dia_postoperatorio,
            subjetivo_evolucion,
            neurologico,
            cardiovascular,
            respiratorio,
            gastrointestinal_nutricion,
            renal_liquidos,
            infeccioso_laboratorio,
            impresion_diagnostica_plan,
            estatus_nota = 'Borrador'
        } = req.body;

        const targetSolicitudId = registro_solicitud_id || await resolverSolicitudId(paciente_id);
        if (!targetSolicitudId || !fecha_evolucion || !hora_evolucion || !subjetivo_evolucion || !impresion_diagnostica_plan) {
            return res.status(400).json({
                status: 'error',
                message: 'registro_solicitud_id, fecha, hora, subjetivo y plan son campos obligatorios en la nota de evolución'
            });
        }

        const [result] = await db.query(
            `INSERT INTO evolucion_diaria (
                registro_solicitud_id,
                hospitalizacion_id,
                fecha_evolucion,
                hora_evolucion,
                dia_hospitalizacion,
                dia_postoperatorio,
                subjetivo_evolucion,
                neurologico,
                cardiovascular,
                respiratorio,
                gastrointestinal_nutricion,
                renal_liquidos,
                infeccioso_laboratorio,
                impresion_diagnostica_plan,
                estatus_nota,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetSolicitudId,
                hospitalizacion_id || null,
                fecha_evolucion,
                hora_evolucion,
                dia_hospitalizacion,
                dia_postoperatorio || null,
                subjetivo_evolucion,
                neurologico || null,
                cardiovascular || null,
                respiratorio || null,
                gastrointestinal_nutricion || null,
                renal_liquidos || null,
                infeccioso_laboratorio || null,
                impresion_diagnostica_plan,
                estatus_nota,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        res.status(201).json({
            status: 'success',
            message: 'Evolución clínica diaria registrada exitosamente',
            id: result.insertId,
            registro_solicitud_id: targetSolicitudId,
            estatus_nota
        });
    } catch (error) {
        console.error('Error al registrar evolución diaria:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al guardar nota de evolución', error: error.message });
    }
};

const updateEvolucion = async (req, res) => {
    try {
        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        // 1. REGLA DE BLOQUEO DE INMUTABILIDAD
        const [existe] = await db.query('SELECT estatus_nota FROM evolucion_diaria WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Evolución clínica no encontrada' });
        }

        if (existe[0].estatus_nota === 'Finalizado' || existe[0].estatus_nota === 'Firmado') {
            return res.status(403).json({
                status: 'error',
                message: 'La evolución diaria está Firmada/Finalizada y bloqueada contra modificaciones por inmutabilidad médico-legal.'
            });
        }

        const {
            registro_solicitud_id,
            hospitalizacion_id,
            fecha_evolucion,
            hora_evolucion,
            dia_hospitalizacion,
            dia_postoperatorio,
            subjetivo_evolucion,
            neurologico,
            cardiovascular,
            respiratorio,
            gastrointestinal_nutricion,
            renal_liquidos,
            infeccioso_laboratorio,
            impresion_diagnostica_plan,
            estatus_nota
        } = req.body;

        await db.query(
            `UPDATE evolucion_diaria SET
                registro_solicitud_id = COALESCE(?, registro_solicitud_id),
                hospitalizacion_id = COALESCE(?, hospitalizacion_id),
                fecha_evolucion = COALESCE(?, fecha_evolucion),
                hora_evolucion = COALESCE(?, hora_evolucion),
                dia_hospitalizacion = COALESCE(?, dia_hospitalizacion),
                dia_postoperatorio = COALESCE(?, dia_postoperatorio),
                subjetivo_evolucion = COALESCE(?, subjetivo_evolucion),
                neurologico = COALESCE(?, neurologico),
                cardiovascular = COALESCE(?, cardiovascular),
                respiratorio = COALESCE(?, respiratorio),
                gastrointestinal_nutricion = COALESCE(?, gastrointestinal_nutricion),
                renal_liquidos = COALESCE(?, renal_liquidos),
                infeccioso_laboratorio = COALESCE(?, infeccioso_laboratorio),
                impresion_diagnostica_plan = COALESCE(?, impresion_diagnostica_plan),
                estatus_nota = COALESCE(?, estatus_nota),
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`,
            [
                registro_solicitud_id || null,
                hospitalizacion_id || null,
                fecha_evolucion || null,
                hora_evolucion || null,
                dia_hospitalizacion || null,
                dia_postoperatorio || null,
                subjetivo_evolucion || null,
                neurologico || null,
                cardiovascular || null,
                respiratorio || null,
                gastrointestinal_nutricion || null,
                renal_liquidos || null,
                infeccioso_laboratorio || null,
                impresion_diagnostica_plan || null,
                estatus_nota || null,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                id
            ]
        );

        res.json({ status: 'success', message: 'Evolución clínica actualizada', id });
    } catch (error) {
        console.error('Error al actualizar evolución:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar evolución', error: error.message });
    }
};

module.exports = {
    getEvoluciones,
    getEvolucionPorId,
    createEvolucion,
    updateEvolucion
};
