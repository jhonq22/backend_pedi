// controllers/laboratorioController.js
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

const getLaboratorios = async (req, res) => {
    try {
        const { registro_solicitud_id, paciente_id, hospitalizacion_id, solo_criticos } = req.query;
        let query = `
            SELECT l.*,
                   rs.paciente_id,
                   CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                   p.numero_historia_clinica
            FROM laboratorio_estudio l
            LEFT JOIN registro_solicitud rs ON l.registro_solicitud_id = rs.id
            LEFT JOIN paciente p ON rs.paciente_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (registro_solicitud_id) {
            query += ' AND l.registro_solicitud_id = ?';
            params.push(registro_solicitud_id);
        }
        if (paciente_id) {
            query += ' AND rs.paciente_id = ?';
            params.push(paciente_id);
        }
        if (hospitalizacion_id) {
            query += ' AND l.hospitalizacion_id = ?';
            params.push(hospitalizacion_id);
        }
        if (solo_criticos === 'true' || solo_criticos === '1') {
            query += ' AND l.es_valor_critico = 1';
        }
        query += ' ORDER BY l.fecha_toma_muestra DESC, l.id DESC';

        const [rows] = await db.query(query, params);
        res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error('Error al consultar laboratorios:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar laboratorio', error: error.message });
    }
};

const getLaboratorioPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT l.*,
                    rs.paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica
             FROM laboratorio_estudio l
             LEFT JOIN registro_solicitud rs ON l.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE l.id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Resultado de laboratorio no encontrado' });
        }
        res.json({ status: 'success', data: rows[0] });
    } catch (error) {
        console.error('Error al obtener laboratorio:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar analito', error: error.message });
    }
};

const createLaboratorio = async (req, res) => {
    try {
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const {
            registro_solicitud_id,
            paciente_id,
            hospitalizacion_id,
            tipo_analisis = 'Hematología Completa',
            fecha_toma_muestra,
            hora_toma_muestra,
            analito_parametro,
            resultado_valor,
            unidad_medida,
            valor_referencia_minimo,
            valor_referencia_maximo,
            es_valor_critico = 0,
            observaciones,
            estatus_analisis = 'Finalizado'
        } = req.body;

        const targetSolicitudId = registro_solicitud_id || await resolverSolicitudId(paciente_id);
        if (!targetSolicitudId || !fecha_toma_muestra || !analito_parametro || resultado_valor === undefined) {
            return res.status(400).json({
                status: 'error',
                message: 'registro_solicitud_id, fecha_toma_muestra, analito_parametro y resultado_valor son obligatorios'
            });
        }

        // Detección automática de valor crítico si no se pasó explícito y los rangos numéricos están disponibles
        let critico = es_valor_critico ? 1 : 0;
        const numVal = parseFloat(resultado_valor);
        const minVal = parseFloat(valor_referencia_minimo);
        const maxVal = parseFloat(valor_referencia_maximo);

        if (!isNaN(numVal) && !isNaN(minVal) && !isNaN(maxVal)) {
            if (numVal < minVal * 0.7 || numVal > maxVal * 1.3) {
                critico = 1; // Disparo de alerta de valor crítico clínico
            }
        }

        const [result] = await db.query(
            `INSERT INTO laboratorio_estudio (
                registro_solicitud_id,
                hospitalizacion_id,
                tipo_analisis,
                fecha_toma_muestra,
                hora_toma_muestra,
                analito_parametro,
                resultado_valor,
                unidad_medida,
                valor_referencia_minimo,
                valor_referencia_maximo,
                es_valor_critico,
                observaciones,
                estatus_analisis,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetSolicitudId,
                hospitalizacion_id || null,
                tipo_analisis,
                fecha_toma_muestra,
                hora_toma_muestra || null,
                analito_parametro,
                String(resultado_valor),
                unidad_medida || null,
                valor_referencia_minimo || null,
                valor_referencia_maximo || null,
                critico,
                observaciones || null,
                estatus_analisis,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        res.status(201).json({
            status: 'success',
            message: 'Resultado de laboratorio registrado',
            id: result.insertId,
            registro_solicitud_id: targetSolicitudId,
            es_valor_critico: critico,
            estatus_analisis
        });
    } catch (error) {
        console.error('Error al registrar analito:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al guardar laboratorio', error: error.message });
    }
};

const updateLaboratorio = async (req, res) => {
    try {
        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        // 1. REGLA DE BLOQUEO DE INMUTABILIDAD
        const [existe] = await db.query('SELECT estatus_analisis FROM laboratorio_estudio WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Resultado no encontrado' });
        }

        if (existe[0].estatus_analisis === 'Finalizado' || existe[0].estatus_analisis === 'Firmado') {
            return res.status(403).json({
                status: 'error',
                message: 'El resultado analítico está Validado/Finalizado y bloqueado contra modificaciones.'
            });
        }

        const {
            registro_solicitud_id,
            hospitalizacion_id,
            tipo_analisis,
            fecha_toma_muestra,
            hora_toma_muestra,
            analito_parametro,
            resultado_valor,
            unidad_medida,
            valor_referencia_minimo,
            valor_referencia_maximo,
            es_valor_critico,
            observaciones,
            estatus_analisis
        } = req.body;

        await db.query(
            `UPDATE laboratorio_estudio SET
                registro_solicitud_id = COALESCE(?, registro_solicitud_id),
                hospitalizacion_id = COALESCE(?, hospitalizacion_id),
                tipo_analisis = COALESCE(?, tipo_analisis),
                fecha_toma_muestra = COALESCE(?, fecha_toma_muestra),
                hora_toma_muestra = COALESCE(?, hora_toma_muestra),
                analito_parametro = COALESCE(?, analito_parametro),
                resultado_valor = COALESCE(?, resultado_valor),
                unidad_medida = COALESCE(?, unidad_medida),
                valor_referencia_minimo = COALESCE(?, valor_referencia_minimo),
                valor_referencia_maximo = COALESCE(?, valor_referencia_maximo),
                es_valor_critico = COALESCE(?, es_valor_critico),
                observaciones = COALESCE(?, observaciones),
                estatus_analisis = COALESCE(?, estatus_analisis),
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`,
            [
                registro_solicitud_id || null,
                hospitalizacion_id || null,
                tipo_analisis || null,
                fecha_toma_muestra || null,
                hora_toma_muestra || null,
                analito_parametro || null,
                resultado_valor !== undefined ? String(resultado_valor) : null,
                unidad_medida || null,
                valor_referencia_minimo || null,
                valor_referencia_maximo || null,
                es_valor_critico !== undefined ? (es_valor_critico ? 1 : 0) : null,
                observaciones || null,
                estatus_analisis || null,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                id
            ]
        );

        res.json({ status: 'success', message: 'Resultado analítico actualizado', id });
    } catch (error) {
        console.error('Error al actualizar laboratorio:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar analito', error: error.message });
    }
};

module.exports = {
    getLaboratorios,
    getLaboratorioPorId,
    createLaboratorio,
    updateLaboratorio
};
