// backend/controllers/laboratorioController.js
const db = require('../config/db');
const crypto = require('crypto');

const safeJsonParse = (val, fallback = null) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
};

const safeJsonStringify = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') return val;
    try {
        return JSON.stringify(val);
    } catch {
        return null;
    }
};

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
             VALUES (?, 4, 1, CURDATE(), 'Pendiente', 'Solicitud inicial generada automáticamente para laboratorio', '1', '127.0.0.1', '1')`,
            [solicitudIdOrPacienteId]
        );
        return ins.insertId;
    }
    return null;
};

/**
 * Calcula edad pediátrica al momento de la toma de muestra (en días y meses cumplidos)
 */
const calcularEdadPediatrica = async (registroSolicitudId, collectionDatetime) => {
    try {
        if (!collectionDatetime) return { days: null, months: null, sex: null };

        const [rows] = await db.query(`
            SELECT p.fecha_nacimiento, p.sexo
            FROM registro_solicitud rs
            JOIN paciente p ON rs.paciente_id = p.id
            WHERE rs.id = ?
        `, [registroSolicitudId]);

        if (rows.length === 0 || !rows[0].fecha_nacimiento) {
            return { days: null, months: null, sex: null };
        }

        const nac = new Date(rows[0].fecha_nacimiento);
        const col = new Date(collectionDatetime);
        if (isNaN(nac.getTime()) || isNaN(col.getTime()) || col < nac) {
            return { days: null, months: null, sex: rows[0].sexo || null };
        }

        const days = Math.round((Date.UTC(col.getFullYear(), col.getMonth(), col.getDate()) - Date.UTC(nac.getFullYear(), nac.getMonth(), nac.getDate())) / 86400000);
        let months = (col.getFullYear() - nac.getFullYear()) * 12 + col.getMonth() - nac.getMonth();
        if (col.getDate() < nac.getDate()) months--;

        return {
            days: Math.max(0, days),
            months: Math.max(0, months),
            sex: rows[0].sexo ? (rows[0].sexo.toLowerCase() === 'femenino' ? 'Femenino' : 'Masculino') : null
        };
    } catch (err) {
        console.error('Error calculando edad pediátrica:', err);
        return { days: null, months: null, sex: null };
    }
};

/**
 * Obtener todos los estudios seriados vinculados a la solicitud o paciente
 */
const getLaboratorios = async (req, res) => {
    try {
        const { registro_solicitud_id, paciente_id, hospitalizacion_id, solo_criticos } = req.query;
        let query = `
            SELECT l.*,
                   rs.paciente_id,
                   CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                   p.numero_historia_clinica,
                   p.fecha_nacimiento,
                   p.sexo AS paciente_sexo
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
        query += ' ORDER BY l.collection_datetime DESC, l.id DESC';

        const [estudios] = await db.query(query, params);

        if (estudios.length === 0) {
            return res.json({ status: 'success', data: [] });
        }

        // Obtener resultados asociados a los estudios encontrados
        const estudioIds = estudios.map(e => e.id);
        const [resultados] = await db.query(
            `SELECT * FROM laboratorio_resultado WHERE laboratorio_estudio_id IN (?) ORDER BY orden ASC, id ASC`,
            [estudioIds]
        );

        // Agrupar analitos por estudio
        const resultadosPorEstudio = {};
        for (const r of resultados) {
            if (!resultadosPorEstudio[r.laboratorio_estudio_id]) {
                resultadosPorEstudio[r.laboratorio_estudio_id] = [];
            }
            resultadosPorEstudio[r.laboratorio_estudio_id].push({
                ...r,
                critical_flag: Boolean(r.critical_flag),
                result_validated: Boolean(r.result_validated),
                result_value_boolean: r.result_value_boolean === 1 ? 'Sí' : (r.result_value_boolean === 0 ? 'No' : '')
            });
        }

        // Mapear respuesta completa con formato HCIL V12/V17
        let data = estudios.map(e => ({
            ...e,
            finalized: Boolean(e.finalized),
            sample_quality: safeJsonParse(e.sample_quality_json, []),
            critical_admin_events: safeJsonParse(e.critical_admin_events_json, []),
            datos_completos: safeJsonParse(e.datos_completos_json, {}),
            lab_results: resultadosPorEstudio[e.id] || []
        }));

        if (solo_criticos === 'true' || solo_criticos === '1') {
            data = data.filter(e => e.lab_results.some(r => r.critical_flag));
        }

        res.json({ status: 'success', data });
    } catch (error) {
        console.error('Error al consultar laboratorios:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar laboratorio', error: error.message });
    }
};

/**
 * Obtener un estudio de laboratorio específico por su ID
 */
const getLaboratorioPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [estudios] = await db.query(
            `SELECT l.*,
                    rs.paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica,
                    p.fecha_nacimiento,
                    p.sexo AS paciente_sexo
             FROM laboratorio_estudio l
             LEFT JOIN registro_solicitud rs ON l.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE l.id = ?`,
            [id]
        );

        if (estudios.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Estudio de laboratorio no encontrado' });
        }

        const estudio = estudios[0];
        const [resultados] = await db.query(
            `SELECT * FROM laboratorio_resultado WHERE laboratorio_estudio_id = ? ORDER BY orden ASC, id ASC`,
            [id]
        );

        const data = {
            ...estudio,
            finalized: Boolean(estudio.finalized),
            sample_quality: safeJsonParse(estudio.sample_quality_json, []),
            critical_admin_events: safeJsonParse(estudio.critical_admin_events_json, []),
            datos_completos: safeJsonParse(estudio.datos_completos_json, {}),
            lab_results: resultados.map(r => ({
                ...r,
                critical_flag: Boolean(r.critical_flag),
                result_validated: Boolean(r.result_validated),
                result_value_boolean: r.result_value_boolean === 1 ? 'Sí' : (r.result_value_boolean === 0 ? 'No' : '')
            }))
        };

        res.json({ status: 'success', data });
    } catch (error) {
        console.error('Error al obtener laboratorio:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar estudio de laboratorio', error: error.message });
    }
};

/**
 * Crear un nuevo estudio serial de laboratorio con sus analitos
 */
const createLaboratorio = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const body = req.body;

        const targetSolicitudId = body.registro_solicitud_id || await resolverSolicitudId(body.paciente_id);
        if (!targetSolicitudId) {
            await connection.rollback();
            return res.status(400).json({ status: 'error', message: 'No se encontró solicitud o paciente vinculado válido.' });
        }

        if (!body.lab_panel || !body.specimen_type) {
            await connection.rollback();
            return res.status(400).json({ status: 'error', message: 'El grupo de laboratorio y el tipo de muestra son obligatorios.' });
        }

        const lab_study_id = body.lab_study_id || crypto.randomUUID();
        const collection_datetime = body.collection_datetime || (body.fecha_toma_muestra ? `${body.fecha_toma_muestra} ${body.hora_toma_muestra || '08:00:00'}` : new Date().toISOString().slice(0, 19).replace('T', ' '));

        // Calcular referencias pediátricas derivadas
        const refPed = await calcularEdadPediatrica(targetSolicitudId, collection_datetime);
        const age_days = body.age_at_collection_days !== undefined ? body.age_at_collection_days : refPed.days;
        const age_months = body.age_at_collection_months !== undefined ? body.age_at_collection_months : refPed.months;
        const ref_sex = body.reference_sex || refPed.sex;

        const isFinalized = body.finalized ? 1 : (body.estatus_analisis === 'Finalizado' ? 1 : 0);
        const finalizedAt = isFinalized ? (body.finalized_at || new Date().toISOString().slice(0, 19).replace('T', ' ')) : null;

        const [insEstudio] = await connection.query(
            `INSERT INTO laboratorio_estudio (
                registro_solicitud_id,
                hospitalizacion_id,
                lab_study_id,
                lab_panel,
                lab_panel_other,
                lab_order_date,
                requesting_physician,
                collection_datetime,
                specimen_type,
                specimen_type_other,
                specimen_site,
                specimen_site_other,
                fasting_status,
                sample_quality_json,
                sample_quality_notes,
                age_at_collection_days,
                age_at_collection_months,
                reference_sex,
                blood_gas_type,
                fio2,
                oxygen_support_gas,
                culture_type,
                culture_collection_date,
                culture_result,
                organism,
                abo_group,
                rh_factor,
                antibody_screen,
                crossmatch_status,
                finalized,
                finalized_at,
                estatus_analisis,
                critical_admin_events_json,
                datos_completos_json,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetSolicitudId,
                body.hospitalizacion_id || null,
                lab_study_id,
                body.lab_panel,
                body.lab_panel_other || null,
                body.lab_order_date || null,
                body.requesting_physician || null,
                collection_datetime,
                body.specimen_type,
                body.specimen_type_other || null,
                body.specimen_site || null,
                body.specimen_site_other || null,
                body.fasting_status || null,
                safeJsonStringify(body.sample_quality || []),
                body.sample_quality_notes || null,
                age_days,
                age_months,
                ref_sex,
                body.blood_gas_type || null,
                body.fio2 || null,
                body.oxygen_support_gas || null,
                body.culture_type || null,
                body.culture_collection_date || null,
                body.culture_result || null,
                body.organism || null,
                body.abo_group || null,
                body.rh_factor || null,
                body.antibody_screen || null,
                body.crossmatch_status || null,
                isFinalized,
                finalizedAt,
                body.estatus_analisis || (isFinalized ? 'Finalizado' : 'Borrador'),
                safeJsonStringify(body.critical_admin_events || []),
                safeJsonStringify(body.datos_completos || body),
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        const nuevoEstudioId = insEstudio.insertId;

        // Inserción de analitos
        const results = Array.isArray(body.lab_results) ? body.lab_results : [];
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            const lab_res_id = r.lab_result_id || crypto.randomUUID();
            const boolVal = r.result_value_boolean === 'Sí' || r.result_value_boolean === true ? 1 : (r.result_value_boolean === 'No' || r.result_value_boolean === false ? 0 : null);
            const numVal = r.result_value_numeric !== undefined && r.result_value_numeric !== null && String(r.result_value_numeric).trim() !== '' ? parseFloat(String(r.result_value_numeric).replace(',', '.')) : null;
            const refLow = r.reference_lower !== undefined && r.reference_lower !== null && String(r.reference_lower).trim() !== '' ? parseFloat(String(r.reference_lower).replace(',', '.')) : null;
            const refHigh = r.reference_upper !== undefined && r.reference_upper !== null && String(r.reference_upper).trim() !== '' ? parseFloat(String(r.reference_upper).replace(',', '.')) : null;

            await connection.query(
                `INSERT INTO laboratorio_resultado (
                    laboratorio_estudio_id,
                    lab_result_id,
                    analyte_key,
                    test_code,
                    test_name,
                    loinc_code,
                    result_type,
                    result_operator,
                    result_value_numeric,
                    result_value_text,
                    result_value_code,
                    result_value_boolean,
                    result_unit,
                    reference_lower,
                    reference_upper,
                    reference_text,
                    reference_basis,
                    reference_sex,
                    abnormal_flag,
                    critical_flag,
                    critical_status,
                    result_method,
                    result_source,
                    result_validated,
                    orden
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nuevoEstudioId,
                    lab_res_id,
                    r.analyte_key || null,
                    r.test_code || `DEMO_${(r.analyte_key || 'PRUEBA').toUpperCase()}`,
                    r.test_name || 'Prueba sin nombre',
                    r.loinc_code || null,
                    r.result_type || 'NUMERIC',
                    r.result_operator || '=',
                    numVal,
                    r.result_value_text || null,
                    r.result_value_code || null,
                    boolVal,
                    r.result_unit || null,
                    refLow,
                    refHigh,
                    r.reference_text || null,
                    r.reference_basis || null,
                    r.reference_sex || ref_sex,
                    r.abnormal_flag || 'Indeterminado',
                    r.critical_flag ? 1 : 0,
                    r.critical_flag ? (r.critical_status || 'Pendiente') : null,
                    r.result_method || null,
                    r.result_source || 'Manual',
                    r.result_validated ? 1 : 0,
                    i
                ]
            );
        }

        await connection.commit();

        res.status(201).json({
            status: 'success',
            message: 'Estudio de laboratorio registrado exitosamente',
            id: nuevoEstudioId,
            lab_study_id,
            registro_solicitud_id: targetSolicitudId,
            finalized: Boolean(isFinalized)
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar estudio de laboratorio:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al guardar estudio de laboratorio', error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Actualizar un estudio de laboratorio (cumple regla de inmutabilidad si está finalizado)
 */
const updateLaboratorio = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const body = req.body;

        const [existe] = await connection.query('SELECT * FROM laboratorio_estudio WHERE id = ?', [id]);
        if (existe.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Estudio de laboratorio no encontrado.' });
        }

        const estudioActual = existe[0];

        // 1. REGLA CLÍNICA DE INMUTABILIDAD:
        // Si el estudio está finalizado, no se permite alterar valores clínicos ni muestras.
        // Solo se permite actualizar el estado administrativo simulado de notificaciones críticas.
        if (estudioActual.finalized === 1 || estudioActual.estatus_analisis === 'Finalizado') {
            if (body.lab_results && Array.isArray(body.lab_results)) {
                for (const r of body.lab_results) {
                    if (r.critical_flag && r.critical_status) {
                        await connection.query(
                            `UPDATE laboratorio_resultado SET critical_status = ? WHERE laboratorio_estudio_id = ? AND lab_result_id = ?`,
                            [r.critical_status, id, r.lab_result_id]
                        );
                    }
                }
            }
            if (body.critical_admin_events) {
                await connection.query(
                    `UPDATE laboratorio_estudio SET critical_admin_events_json = ?, audit_usu_id = ?, audit_ip = ? WHERE id = ?`,
                    [safeJsonStringify(body.critical_admin_events), audit.audit_usu_id, audit.audit_ip, id]
                );
            }
            await connection.commit();
            return res.json({
                status: 'success',
                message: 'Estudio finalizado: se conservó la inmutabilidad clínica y se actualizó el seguimiento administrativo de alertas críticas.',
                id
            });
        }

        // 2. Si es un borrador, actualizar todos los campos clínicos
        const collection_datetime = body.collection_datetime || (body.fecha_toma_muestra ? `${body.fecha_toma_muestra} ${body.hora_toma_muestra || '08:00:00'}` : estudioActual.collection_datetime);
        const refPed = await calcularEdadPediatrica(estudioActual.registro_solicitud_id, collection_datetime);

        const isFinalized = body.finalized ? 1 : (body.estatus_analisis === 'Finalizado' ? 1 : 0);
        const finalizedAt = isFinalized ? (estudioActual.finalized_at || new Date().toISOString().slice(0, 19).replace('T', ' ')) : null;

        await connection.query(
            `UPDATE laboratorio_estudio SET
                lab_panel = COALESCE(?, lab_panel),
                lab_panel_other = ?,
                lab_order_date = ?,
                requesting_physician = ?,
                collection_datetime = COALESCE(?, collection_datetime),
                specimen_type = COALESCE(?, specimen_type),
                specimen_type_other = ?,
                specimen_site = ?,
                specimen_site_other = ?,
                fasting_status = ?,
                sample_quality_json = ?,
                sample_quality_notes = ?,
                age_at_collection_days = COALESCE(?, age_at_collection_days),
                age_at_collection_months = COALESCE(?, age_at_collection_months),
                reference_sex = COALESCE(?, reference_sex),
                blood_gas_type = ?,
                fio2 = ?,
                oxygen_support_gas = ?,
                culture_type = ?,
                culture_collection_date = ?,
                culture_result = ?,
                organism = ?,
                abo_group = ?,
                rh_factor = ?,
                antibody_screen = ?,
                crossmatch_status = ?,
                finalized = ?,
                finalized_at = ?,
                estatus_analisis = ?,
                critical_admin_events_json = ?,
                datos_completos_json = ?,
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`,
            [
                body.lab_panel || null,
                body.lab_panel_other || null,
                body.lab_order_date || null,
                body.requesting_physician || null,
                collection_datetime,
                body.specimen_type || null,
                body.specimen_type_other || null,
                body.specimen_site || null,
                body.specimen_site_other || null,
                body.fasting_status || null,
                safeJsonStringify(body.sample_quality || []),
                body.sample_quality_notes || null,
                body.age_at_collection_days !== undefined ? body.age_at_collection_days : refPed.days,
                body.age_at_collection_months !== undefined ? body.age_at_collection_months : refPed.months,
                body.reference_sex || refPed.sex,
                body.blood_gas_type || null,
                body.fio2 || null,
                body.oxygen_support_gas || null,
                body.culture_type || null,
                body.culture_collection_date || null,
                body.culture_result || null,
                body.organism || null,
                body.abo_group || null,
                body.rh_factor || null,
                body.antibody_screen || null,
                body.crossmatch_status || null,
                isFinalized,
                finalizedAt,
                body.estatus_analisis || (isFinalized ? 'Finalizado' : 'Borrador'),
                safeJsonStringify(body.critical_admin_events || []),
                safeJsonStringify(body.datos_completos || body),
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                id
            ]
        );

        // Reemplazar / Sincronizar analitos en borrador
        if (body.lab_results && Array.isArray(body.lab_results)) {
            await connection.query('DELETE FROM laboratorio_resultado WHERE laboratorio_estudio_id = ?', [id]);
            for (let i = 0; i < body.lab_results.length; i++) {
                const r = body.lab_results[i];
                const lab_res_id = r.lab_result_id || crypto.randomUUID();
                const boolVal = r.result_value_boolean === 'Sí' || r.result_value_boolean === true ? 1 : (r.result_value_boolean === 'No' || r.result_value_boolean === false ? 0 : null);
                const numVal = r.result_value_numeric !== undefined && r.result_value_numeric !== null && String(r.result_value_numeric).trim() !== '' ? parseFloat(String(r.result_value_numeric).replace(',', '.')) : null;
                const refLow = r.reference_lower !== undefined && r.reference_lower !== null && String(r.reference_lower).trim() !== '' ? parseFloat(String(r.reference_lower).replace(',', '.')) : null;
                const refHigh = r.reference_upper !== undefined && r.reference_upper !== null && String(r.reference_upper).trim() !== '' ? parseFloat(String(r.reference_upper).replace(',', '.')) : null;

                await connection.query(
                    `INSERT INTO laboratorio_resultado (
                        laboratorio_estudio_id,
                        lab_result_id,
                        analyte_key,
                        test_code,
                        test_name,
                        loinc_code,
                        result_type,
                        result_operator,
                        result_value_numeric,
                        result_value_text,
                        result_value_code,
                        result_value_boolean,
                        result_unit,
                        reference_lower,
                        reference_upper,
                        reference_text,
                        reference_basis,
                        reference_sex,
                        abnormal_flag,
                        critical_flag,
                        critical_status,
                        result_method,
                        result_source,
                        result_validated,
                        orden
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        lab_res_id,
                        r.analyte_key || null,
                        r.test_code || `DEMO_${(r.analyte_key || 'PRUEBA').toUpperCase()}`,
                        r.test_name || 'Prueba sin nombre',
                        r.loinc_code || null,
                        r.result_type || 'NUMERIC',
                        r.result_operator || '=',
                        numVal,
                        r.result_value_text || null,
                        r.result_value_code || null,
                        boolVal,
                        r.result_unit || null,
                        refLow,
                        refHigh,
                        r.reference_text || null,
                        r.reference_basis || null,
                        r.reference_sex || body.reference_sex || refPed.sex,
                        r.abnormal_flag || 'Indeterminado',
                        r.critical_flag ? 1 : 0,
                        r.critical_flag ? (r.critical_status || 'Pendiente') : null,
                        r.result_method || null,
                        r.result_source || 'Manual',
                        r.result_validated ? 1 : 0,
                        i
                    ]
                );
            }
        }

        await connection.commit();

        res.json({
            status: 'success',
            message: isFinalized ? 'Estudio finalizado exitosamente y bloqueado contra modificaciones clínicas.' : 'Borrador de estudio actualizado correctamente.',
            id
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al actualizar estudio de laboratorio:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar laboratorio', error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Finalizar estudio de laboratorio (bloqueo inmutable)
 */
const finalizarLaboratorio = async (req, res) => {
    try {
        const { id } = req.params;
        const [existe] = await db.query('SELECT * FROM laboratorio_estudio WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Estudio no encontrado.' });
        }

        const estudio = existe[0];
        if (estudio.finalized === 1) {
            return res.json({ status: 'success', message: 'El estudio ya se encuentra finalizado.', id });
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.query(
            `UPDATE laboratorio_estudio SET finalized = 1, finalized_at = ?, estatus_analisis = 'Finalizado' WHERE id = ?`,
            [now, id]
        );

        res.json({
            status: 'success',
            message: 'Estudio finalizado exitosamente como DEMO e inmutable. Sus valores clínicos quedan bloqueados.',
            id
        });
    } catch (error) {
        console.error('Error al finalizar laboratorio:', error);
        res.status(500).json({ status: 'error', message: 'Error al finalizar estudio', error: error.message });
    }
};

/**
 * Eliminar un estudio de laboratorio (solo permitido si es borrador)
 */
const eliminarLaboratorio = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT finalized, estatus_analisis FROM laboratorio_estudio WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Estudio no encontrado.' });
        }

        if (rows[0].finalized === 1 || rows[0].estatus_analisis === 'Finalizado') {
            return res.status(403).json({
                status: 'error',
                message: 'No es posible eliminar un estudio de laboratorio finalizado. Los registros permanecen inmutables para trazabilidad clínica.'
            });
        }

        await db.query('DELETE FROM laboratorio_estudio WHERE id = ?', [id]);
        res.json({ status: 'success', message: 'Borrador de estudio eliminado correctamente.', id });
    } catch (error) {
        console.error('Error al eliminar estudio:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al eliminar estudio', error: error.message });
    }
};

/**
 * Cargar estudios iniciales de demostración (Hematología, Electrolitos, Gases) si el paciente no tiene estudios
 */
const seedDemoLaboratorios = async (req, res) => {
    try {
        const { registro_solicitud_id, paciente_id } = req.body;
        const targetSolicitudId = registro_solicitud_id || await resolverSolicitudId(paciente_id);
        if (!targetSolicitudId) {
            return res.status(400).json({ status: 'error', message: 'Se requiere una solicitud o paciente activo.' });
        }

        // Verificar si ya tiene estudios
        const [existentes] = await db.query('SELECT id FROM laboratorio_estudio WHERE registro_solicitud_id = ?', [targetSolicitudId]);
        if (existentes.length > 0) {
            return res.json({ status: 'success', message: 'El paciente ya cuenta con estudios registrados.', count: existentes.length });
        }

        // 1. Hematología
        await createLaboratorio({
            body: {
                registro_solicitud_id: targetSolicitudId,
                lab_panel: 'Hematología',
                lab_order_date: '2026-10-10',
                requesting_physician: 'MEDICO-DEMO-001',
                collection_datetime: '2026-10-11 08:20:00',
                specimen_type: 'Sangre total',
                specimen_site: 'Venoso periférico',
                sample_quality: ['Adecuada'],
                fasting_status: 'Desconocido',
                finalized: 1,
                estatus_analisis: 'Finalizado',
                lab_results: [
                    { analyte_key: 'wbc', test_code: 'DEMO_WBC', test_name: 'Leucocitos', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '7.6', result_unit: '×10³/µL', abnormal_flag: 'Normal', critical_flag: false },
                    { analyte_key: 'hemoglobin', test_code: 'DEMO_HEMOGLOBIN', test_name: 'Hemoglobina', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '12.4', result_unit: 'g/dL', abnormal_flag: 'Normal', critical_flag: false },
                    { analyte_key: 'hematocrit', test_code: 'DEMO_HEMATOCRIT', test_name: 'Hematocrito', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '37.2', result_unit: '%', abnormal_flag: 'Normal', critical_flag: false },
                    { analyte_key: 'platelets', test_code: 'DEMO_PLATELETS', test_name: 'Plaquetas', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '278', result_unit: '×10³/µL', abnormal_flag: 'Normal', critical_flag: false }
                ]
            }
        }, {
            status: () => ({ json: () => {} })
        });

        // 2. Electrolitos
        await createLaboratorio({
            body: {
                registro_solicitud_id: targetSolicitudId,
                lab_panel: 'Electrolitos',
                lab_order_date: '2026-10-10',
                requesting_physician: 'MEDICO-DEMO-001',
                collection_datetime: '2026-10-12 10:30:00',
                specimen_type: 'Suero',
                specimen_site: 'Venoso periférico',
                sample_quality: ['Adecuada'],
                fasting_status: 'Desconocido',
                finalized: 1,
                estatus_analisis: 'Finalizado',
                lab_results: [
                    { analyte_key: 'sodium', test_code: 'DEMO_SODIUM', test_name: 'Sodio', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '138', result_unit: 'mmol/L', abnormal_flag: 'Normal', critical_flag: false },
                    { analyte_key: 'potassium', test_code: 'DEMO_POTASSIUM', test_name: 'Potasio', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '4.2', result_unit: 'mmol/L', abnormal_flag: 'Normal', critical_flag: false },
                    { analyte_key: 'chloride', test_code: 'DEMO_CHLORIDE', test_name: 'Cloro', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '103', result_unit: 'mmol/L', abnormal_flag: 'Normal', critical_flag: false }
                ]
            }
        }, {
            status: () => ({ json: () => {} })
        });

        // 3. Gases
        await createLaboratorio({
            body: {
                registro_solicitud_id: targetSolicitudId,
                lab_panel: 'Gases',
                lab_order_date: '2026-10-10',
                requesting_physician: 'MEDICO-DEMO-001',
                collection_datetime: '2026-10-13 09:45:00',
                specimen_type: 'Sangre arterial',
                specimen_site: 'Arterial',
                blood_gas_type: 'Arterial',
                fio2: '0.21',
                oxygen_support_gas: 'Aire ambiente',
                sample_quality: ['Adecuada'],
                fasting_status: 'Desconocido',
                finalized: 1,
                estatus_analisis: 'Finalizado',
                lab_results: [
                    { analyte_key: 'ph', test_code: 'DEMO_PH', test_name: 'pH', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '7.38', result_unit: '', abnormal_flag: 'Normal', critical_flag: false },
                    { analyte_key: 'pco2', test_code: 'DEMO_PCO2', test_name: 'pCO₂', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '40', result_unit: 'mmHg', abnormal_flag: 'Normal', critical_flag: false },
                    { analyte_key: 'po2', test_code: 'DEMO_PO2', test_name: 'pO₂', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '88', result_unit: 'mmHg', abnormal_flag: 'Normal', critical_flag: false },
                    { analyte_key: 'bicarbonate', test_code: 'DEMO_BICARBONATE', test_name: 'HCO₃⁻', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '24', result_unit: 'mmol/L', abnormal_flag: 'Normal', critical_flag: false },
                    { analyte_key: 'base_excess', test_code: 'DEMO_BASE_EXCESS', test_name: 'Exceso de base', result_type: 'NUMERIC', result_operator: '=', result_value_numeric: '-0.5', result_unit: 'mmol/L', abnormal_flag: 'Normal', critical_flag: false }
                ]
            }
        }, {
            status: () => ({ json: () => {} })
        });

        res.json({ status: 'success', message: 'Estudios seriales de demostración precargados con éxito.' });
    } catch (error) {
        console.error('Error al precargar demo laboratorios:', error);
        res.status(500).json({ status: 'error', message: 'Error al precargar estudios de ejemplo', error: error.message });
    }
};

module.exports = {
    getLaboratorios,
    getLaboratorioPorId,
    createLaboratorio,
    updateLaboratorio,
    finalizarLaboratorio,
    eliminarLaboratorio,
    seedDemoLaboratorios
};
