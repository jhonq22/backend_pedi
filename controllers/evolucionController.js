// controllers/evolucionController.js
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
             VALUES (?, 4, 1, CURDATE(), 'Pendiente', 'Solicitud inicial generada automáticamente para evolución clínica', '1', '127.0.0.1', '1')`,
            [solicitudIdOrPacienteId]
        );
        return ins.insertId;
    }
    return null;
};

const formatRow = (row) => {
    if (!row) return null;
    return {
        ...row,
        current_symptoms: safeJsonParse(row.current_symptoms_json, []),
        nutrition_route: safeJsonParse(row.nutrition_route_json, ['Oral']),
        lab_result_ids: safeJsonParse(row.lab_result_ids_json, []),
        imaging_study_ids: safeJsonParse(row.imaging_study_ids_json, []),
        procedure_ids: safeJsonParse(row.procedure_ids_json, []),
        clinical_events: safeJsonParse(row.clinical_events_json, []),
        medication_change_type: safeJsonParse(row.medication_change_type_json, []),
        active_devices: safeJsonParse(row.active_devices_json, []),
        drain_entries: safeJsonParse(row.drain_entries_json, []),
        active_problems: safeJsonParse(row.active_problems_json, []),
        discharge_barriers: safeJsonParse(row.discharge_barriers_json, []),
        datos_completos: safeJsonParse(row.datos_completos_json, null)
    };
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
        query += ' ORDER BY ed.evolution_date DESC, ed.evolution_time DESC, ed.id DESC';

        const [rows] = await db.query(query, params);
        res.json({
            status: 'success',
            data: rows.map(formatRow)
        });
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
            return res.status(404).json({ status: 'error', message: 'Evolución clínica no encontrada' });
        }
        res.json({ status: 'success', data: formatRow(rows[0]) });
    } catch (error) {
        console.error('Error al obtener evolución:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar nota de evolución', error: error.message });
    }
};

const calculateClinicalMetrics = (body) => {
    const weight = body.weight_kg !== undefined && body.weight_kg !== '' && body.weight_kg !== null ? Number(body.weight_kg) : null;
    const height = body.height_cm !== undefined && body.height_cm !== '' && body.height_cm !== null ? Number(body.height_cm) : null;

    let bmi = null;
    if (weight && height && height > 0) {
        bmi = Number((weight / Math.pow(height / 100, 2)).toFixed(2));
    }

    let bsa = null;
    if (weight && height && weight > 0 && height > 0) {
        // Mosteller formula: sqrt((weight * height) / 3600)
        bsa = Number(Math.sqrt((weight * height) / 3600).toFixed(3));
    }

    const intake = body.intake_24h_ml !== undefined && body.intake_24h_ml !== '' && body.intake_24h_ml !== null ? Number(body.intake_24h_ml) : null;
    const output = body.output_24h_ml !== undefined && body.output_24h_ml !== '' && body.output_24h_ml !== null ? Number(body.output_24h_ml) : null;

    let fluid_balance_24h_ml = null;
    if (intake !== null && output !== null) {
        fluid_balance_24h_ml = Number((intake - output).toFixed(1));
    }

    const urineVol = body.urine_volume_ml !== undefined && body.urine_volume_ml !== '' && body.urine_volume_ml !== null ? Number(body.urine_volume_ml) : (output !== null ? output : null);
    const urineHours = body.urine_measure_hours ? Number(body.urine_measure_hours) : 24;

    let urine_output_ml_kg_h = null;
    if (urineVol !== null && weight && weight > 0 && urineHours > 0) {
        urine_output_ml_kg_h = Number((urineVol / weight / urineHours).toFixed(2));
    }

    // Drain totals
    let drain_output_24h_ml = null;
    if (Array.isArray(body.drain_entries) && body.drain_entries.length > 0) {
        drain_output_24h_ml = body.drain_entries.reduce((sum, item) => sum + (Number(item.volume) || 0), 0);
        drain_output_24h_ml = Number(drain_output_24h_ml.toFixed(1));
    }

    return {
        bmi: body.bmi !== undefined && body.bmi !== null ? body.bmi : bmi,
        bsa: body.bsa !== undefined && body.bsa !== null ? body.bsa : bsa,
        fluid_balance_24h_ml: body.fluid_balance_24h_ml !== undefined && body.fluid_balance_24h_ml !== null ? body.fluid_balance_24h_ml : fluid_balance_24h_ml,
        urine_output_ml_kg_h: body.urine_output_ml_kg_h !== undefined && body.urine_output_ml_kg_h !== null ? body.urine_output_ml_kg_h : urine_output_ml_kg_h,
        drain_output_24h_ml: body.drain_output_24h_ml !== undefined && body.drain_output_24h_ml !== null ? body.drain_output_24h_ml : drain_output_24h_ml
    };
};

const createEvolucion = async (req, res) => {
    try {
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const b = req.body;

        const targetSolicitudId = b.registro_solicitud_id || await resolverSolicitudId(b.paciente_id);
        if (!targetSolicitudId) {
            return res.status(400).json({
                status: 'error',
                message: 'No se pudo vincular la nota a un registro_solicitud o paciente válido.'
            });
        }

        const daily_note_id = b.daily_note_id || crypto.randomUUID();
        const metrics = calculateClinicalMetrics(b);

        const now = new Date();
        const evolution_date = b.evolution_date || now.toISOString().slice(0, 10);
        const evolution_time = b.evolution_time || now.toTimeString().slice(0, 8);

        const sql = `
            INSERT INTO evolucion_diaria (
                registro_solicitud_id, hospitalizacion_id, daily_note_id, encounter_id, intent, parent_note_id,
                evolution_date, evolution_time, evaluation_period_start, evaluation_period_end,
                care_location, service, author_id, hospital_day, postoperative_day, postprocedure_day,
                clinical_course_since_previous, significant_events_present, significant_events_summary,
                general_condition, consciousness_status, pain_present, pain_scale, pain_score,
                current_symptoms_json, current_symptoms_other, clinical_status_summary,
                weight_kg, weight_percentile, height_cm, height_percentile, bmi, bsa,
                heart_rate, respiratory_rate, oxygen_saturation, oxygen_support, oxygen_flow,
                bp_extremity, bp_systolic, bp_diastolic, bp_percentile,
                hemodynamic_status, cardiac_rhythm_status, perfusion_status_daily, cyanosis_status,
                edema_status, hepatomegaly_status, cardiovascular_daily_summary,
                respiratory_status_daily, respiratory_support, fio2_current, respiratory_support_change, respiratory_daily_summary,
                intake_24h_ml, output_24h_ml, fluid_balance_24h_ml, urine_output_ml_kg_h, urine_volume_ml, urine_measure_hours,
                renal_status_daily, fluid_renal_summary,
                nutrition_route_json, feeding_tolerance, nutrition_change_24h, nutrition_summary,
                new_labs_available, lab_result_ids_json, lab_clinical_interpretation, lab_trend_status,
                new_imaging_performed, imaging_study_ids_json, control_chest_xray_performed, imaging_results_available,
                imaging_clinical_interpretation, imaging_change_vs_prior,
                procedure_performed_24h, procedure_ids_json, major_procedure_present, procedure_tolerance, procedure_clinical_summary,
                clinical_events_json, medication_changes_present, medication_change_type_json, medication_change_summary,
                active_devices_json, device_change_24h, drain_output_24h_ml, drain_entries_json, devices_summary,
                active_problems_json,
                plan_cardiovascular, plan_respiratory, plan_neurologic, plan_renal_fluid,
                plan_nutrition, plan_infectious, plan_hematologic, plan_other,
                pending_tests_present, pending_other_summary, next_24h_goals, anticipated_disposition, discharge_barriers_json,
                signed_by, signed_at, finalized, estatus_nota, datos_completos_json,
                audit_usu_id, audit_ip, audit_dep_id
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?
            )
        `;

        const values = [
            targetSolicitudId,
            b.hospitalizacion_id || null,
            daily_note_id,
            b.encounter_id || null,
            b.intent || 'normal',
            b.parent_note_id || null,

            evolution_date,
            evolution_time,
            b.evaluation_period_start || null,
            b.evaluation_period_end || null,
            b.care_location || 'Hospitalización',
            b.service || 'Cardiología',
            b.author_id || 'MEDICO-DEMO-001',
            b.hospital_day || 1,
            b.postoperative_day || null,
            b.postprocedure_day || null,
            b.clinical_course_since_previous || 'Estable',
            b.significant_events_present || 'No',
            b.significant_events_summary || null,

            b.general_condition || 'Buena',
            b.consciousness_status || 'Alerta',
            b.pain_present || 'No',
            b.pain_scale || null,
            b.pain_score || null,
            safeJsonStringify(b.current_symptoms || []),
            b.current_symptoms_other || null,
            b.clinical_status_summary || null,

            b.weight_kg || null,
            b.weight_percentile || null,
            b.height_cm || null,
            b.height_percentile || null,
            metrics.bmi,
            metrics.bsa,
            b.heart_rate || null,
            b.respiratory_rate || null,
            b.oxygen_saturation || null,
            b.oxygen_support || 'Aire ambiente',
            b.oxygen_flow || null,
            b.bp_extremity || 'Brazo derecho',
            b.bp_systolic || null,
            b.bp_diastolic || null,
            b.bp_percentile || null,

            b.hemodynamic_status || 'Estable',
            b.cardiac_rhythm_status || 'Sinusal',
            b.perfusion_status_daily || 'Adecuada',
            b.cyanosis_status || 'Ausente',
            b.edema_status || 'Ausente',
            b.hepatomegaly_status || 'Ausente',
            b.cardiovascular_daily_summary || null,

            b.respiratory_status_daily || 'Estable',
            b.respiratory_support || 'Aire ambiente',
            b.fio2_current || 0.21,
            b.respiratory_support_change || 'Sin cambios',
            b.respiratory_daily_summary || null,

            b.intake_24h_ml || null,
            b.output_24h_ml || null,
            metrics.fluid_balance_24h_ml,
            metrics.urine_output_ml_kg_h,
            b.urine_volume_ml || null,
            b.urine_measure_hours || 24,
            b.renal_status_daily || 'Estable',
            b.fluid_renal_summary || null,

            safeJsonStringify(b.nutrition_route || ['Oral']),
            b.feeding_tolerance || 'Buena',
            b.nutrition_change_24h || 'Sin cambios',
            b.nutrition_summary || null,

            b.new_labs_available || 'No',
            safeJsonStringify(b.lab_result_ids || []),
            b.lab_clinical_interpretation || null,
            b.lab_trend_status || null,

            b.new_imaging_performed || 'No',
            safeJsonStringify(b.imaging_study_ids || []),
            b.control_chest_xray_performed ? 1 : 0,
            b.imaging_results_available || 'No',
            b.imaging_clinical_interpretation || null,
            b.imaging_change_vs_prior || null,

            b.procedure_performed_24h || 'No',
            safeJsonStringify(b.procedure_ids || []),
            b.major_procedure_present ? 1 : 0,
            b.procedure_tolerance || null,
            b.procedure_clinical_summary || null,

            safeJsonStringify(b.clinical_events || []),
            b.medication_changes_present || 'No',
            safeJsonStringify(b.medication_change_type || []),
            b.medication_change_summary || null,

            safeJsonStringify(b.active_devices || []),
            b.device_change_24h || 'Sin cambios',
            metrics.drain_output_24h_ml,
            safeJsonStringify(b.drain_entries || []),
            b.devices_summary || null,

            safeJsonStringify(b.active_problems || []),

            b.plan_cardiovascular || null,
            b.plan_respiratory || null,
            b.plan_neurologic || null,
            b.plan_renal_fluid || null,
            b.plan_nutrition || null,
            b.plan_infectious || null,
            b.plan_hematologic || null,
            b.plan_other || null,

            b.pending_tests_present || 'No',
            b.pending_other_summary || null,
            b.next_24h_goals || null,
            b.anticipated_disposition || 'Continuar mismo nivel',
            safeJsonStringify(b.discharge_barriers || []),

            b.signed_by || null,
            b.signed_at || null,
            b.finalized ? 1 : 0,
            b.estatus_nota || 'Borrador',
            safeJsonStringify(b),

            audit.audit_usu_id,
            audit.audit_ip,
            audit.audit_dep_id
        ];

        const [result] = await db.query(sql, values);

        res.status(201).json({
            status: 'success',
            message: 'Evolución clínica diaria registrada exitosamente',
            id: result.insertId,
            daily_note_id,
            registro_solicitud_id: targetSolicitudId
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
        const b = req.body;

        const [existe] = await db.query('SELECT * FROM evolucion_diaria WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Evolución clínica no encontrada' });
        }

        if (existe[0].finalized || existe[0].estatus_nota === 'Firmada' || existe[0].estatus_nota === 'Firmado') {
            return res.status(403).json({
                status: 'error',
                message: 'La evolución diaria está Firmada y bloqueada contra modificaciones por inmutabilidad médico-legal.'
            });
        }

        const metrics = calculateClinicalMetrics(b);

        const sql = `
            UPDATE evolucion_diaria SET
                hospitalizacion_id = COALESCE(?, hospitalizacion_id),
                encounter_id = COALESCE(?, encounter_id),
                intent = COALESCE(?, intent),
                evolution_date = COALESCE(?, evolution_date),
                evolution_time = COALESCE(?, evolution_time),
                evaluation_period_start = ?,
                evaluation_period_end = ?,
                care_location = COALESCE(?, care_location),
                service = COALESCE(?, service),
                author_id = COALESCE(?, author_id),
                hospital_day = COALESCE(?, hospital_day),
                postoperative_day = ?,
                postprocedure_day = ?,
                clinical_course_since_previous = COALESCE(?, clinical_course_since_previous),
                significant_events_present = COALESCE(?, significant_events_present),
                significant_events_summary = ?,
                general_condition = COALESCE(?, general_condition),
                consciousness_status = COALESCE(?, consciousness_status),
                pain_present = COALESCE(?, pain_present),
                pain_scale = ?,
                pain_score = ?,
                current_symptoms_json = ?,
                current_symptoms_other = ?,
                clinical_status_summary = ?,
                weight_kg = ?,
                weight_percentile = ?,
                height_cm = ?,
                height_percentile = ?,
                bmi = ?,
                bsa = ?,
                heart_rate = ?,
                respiratory_rate = ?,
                oxygen_saturation = ?,
                oxygen_support = COALESCE(?, oxygen_support),
                oxygen_flow = ?,
                bp_extremity = COALESCE(?, bp_extremity),
                bp_systolic = ?,
                bp_diastolic = ?,
                bp_percentile = ?,
                hemodynamic_status = COALESCE(?, hemodynamic_status),
                cardiac_rhythm_status = COALESCE(?, cardiac_rhythm_status),
                perfusion_status_daily = COALESCE(?, perfusion_status_daily),
                cyanosis_status = COALESCE(?, cyanosis_status),
                edema_status = COALESCE(?, edema_status),
                hepatomegaly_status = COALESCE(?, hepatomegaly_status),
                cardiovascular_daily_summary = ?,
                respiratory_status_daily = COALESCE(?, respiratory_status_daily),
                respiratory_support = COALESCE(?, respiratory_support),
                fio2_current = ?,
                respiratory_support_change = COALESCE(?, respiratory_support_change),
                respiratory_daily_summary = ?,
                intake_24h_ml = ?,
                output_24h_ml = ?,
                fluid_balance_24h_ml = ?,
                urine_output_ml_kg_h = ?,
                urine_volume_ml = ?,
                urine_measure_hours = ?,
                renal_status_daily = COALESCE(?, renal_status_daily),
                fluid_renal_summary = ?,
                nutrition_route_json = ?,
                feeding_tolerance = COALESCE(?, feeding_tolerance),
                nutrition_change_24h = COALESCE(?, nutrition_change_24h),
                nutrition_summary = ?,
                new_labs_available = COALESCE(?, new_labs_available),
                lab_result_ids_json = ?,
                lab_clinical_interpretation = ?,
                lab_trend_status = ?,
                new_imaging_performed = COALESCE(?, new_imaging_performed),
                imaging_study_ids_json = ?,
                control_chest_xray_performed = ?,
                imaging_results_available = ?,
                imaging_clinical_interpretation = ?,
                imaging_change_vs_prior = ?,
                procedure_performed_24h = COALESCE(?, procedure_performed_24h),
                procedure_ids_json = ?,
                major_procedure_present = ?,
                procedure_tolerance = ?,
                procedure_clinical_summary = ?,
                clinical_events_json = ?,
                medication_changes_present = COALESCE(?, medication_changes_present),
                medication_change_type_json = ?,
                medication_change_summary = ?,
                active_devices_json = ?,
                device_change_24h = COALESCE(?, device_change_24h),
                drain_output_24h_ml = ?,
                drain_entries_json = ?,
                devices_summary = ?,
                active_problems_json = ?,
                plan_cardiovascular = ?,
                plan_respiratory = ?,
                plan_neurologic = ?,
                plan_renal_fluid = ?,
                plan_nutrition = ?,
                plan_infectious = ?,
                plan_hematologic = ?,
                plan_other = ?,
                pending_tests_present = COALESCE(?, pending_tests_present),
                pending_other_summary = ?,
                next_24h_goals = ?,
                anticipated_disposition = COALESCE(?, anticipated_disposition),
                discharge_barriers_json = ?,
                signed_by = ?,
                signed_at = ?,
                finalized = ?,
                estatus_nota = COALESCE(?, estatus_nota),
                datos_completos_json = ?,
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
            WHERE id = ?
        `;

        const values = [
            b.hospitalizacion_id !== undefined ? b.hospitalizacion_id : null,
            b.encounter_id !== undefined ? b.encounter_id : null,
            b.intent !== undefined ? b.intent : null,
            b.evolution_date !== undefined ? b.evolution_date : null,
            b.evolution_time !== undefined ? b.evolution_time : null,
            b.evaluation_period_start || null,
            b.evaluation_period_end || null,
            b.care_location !== undefined ? b.care_location : null,
            b.service !== undefined ? b.service : null,
            b.author_id !== undefined ? b.author_id : null,
            b.hospital_day !== undefined ? b.hospital_day : null,
            b.postoperative_day !== undefined ? b.postoperative_day : null,
            b.postprocedure_day !== undefined ? b.postprocedure_day : null,
            b.clinical_course_since_previous !== undefined ? b.clinical_course_since_previous : null,
            b.significant_events_present !== undefined ? b.significant_events_present : null,
            b.significant_events_summary || null,
            b.general_condition !== undefined ? b.general_condition : null,
            b.consciousness_status !== undefined ? b.consciousness_status : null,
            b.pain_present !== undefined ? b.pain_present : null,
            b.pain_scale || null,
            b.pain_score || null,
            b.current_symptoms !== undefined ? safeJsonStringify(b.current_symptoms) : existe[0].current_symptoms_json,
            b.current_symptoms_other || null,
            b.clinical_status_summary || null,
            b.weight_kg !== undefined ? b.weight_kg : null,
            b.weight_percentile || null,
            b.height_cm !== undefined ? b.height_cm : null,
            b.height_percentile || null,
            metrics.bmi,
            metrics.bsa,
            b.heart_rate !== undefined ? b.heart_rate : null,
            b.respiratory_rate !== undefined ? b.respiratory_rate : null,
            b.oxygen_saturation !== undefined ? b.oxygen_saturation : null,
            b.oxygen_support !== undefined ? b.oxygen_support : null,
            b.oxygen_flow !== undefined ? b.oxygen_flow : null,
            b.bp_extremity !== undefined ? b.bp_extremity : null,
            b.bp_systolic !== undefined ? b.bp_systolic : null,
            b.bp_diastolic !== undefined ? b.bp_diastolic : null,
            b.bp_percentile || null,
            b.hemodynamic_status !== undefined ? b.hemodynamic_status : null,
            b.cardiac_rhythm_status !== undefined ? b.cardiac_rhythm_status : null,
            b.perfusion_status_daily !== undefined ? b.perfusion_status_daily : null,
            b.cyanosis_status !== undefined ? b.cyanosis_status : null,
            b.edema_status !== undefined ? b.edema_status : null,
            b.hepatomegaly_status !== undefined ? b.hepatomegaly_status : null,
            b.cardiovascular_daily_summary || null,
            b.respiratory_status_daily !== undefined ? b.respiratory_status_daily : null,
            b.respiratory_support !== undefined ? b.respiratory_support : null,
            b.fio2_current !== undefined ? b.fio2_current : null,
            b.respiratory_support_change !== undefined ? b.respiratory_support_change : null,
            b.respiratory_daily_summary || null,
            b.intake_24h_ml !== undefined ? b.intake_24h_ml : null,
            b.output_24h_ml !== undefined ? b.output_24h_ml : null,
            metrics.fluid_balance_24h_ml,
            metrics.urine_output_ml_kg_h,
            b.urine_volume_ml !== undefined ? b.urine_volume_ml : null,
            b.urine_measure_hours !== undefined ? b.urine_measure_hours : null,
            b.renal_status_daily !== undefined ? b.renal_status_daily : null,
            b.fluid_renal_summary || null,
            b.nutrition_route !== undefined ? safeJsonStringify(b.nutrition_route) : existe[0].nutrition_route_json,
            b.feeding_tolerance !== undefined ? b.feeding_tolerance : null,
            b.nutrition_change_24h !== undefined ? b.nutrition_change_24h : null,
            b.nutrition_summary || null,
            b.new_labs_available !== undefined ? b.new_labs_available : null,
            b.lab_result_ids !== undefined ? safeJsonStringify(b.lab_result_ids) : existe[0].lab_result_ids_json,
            b.lab_clinical_interpretation || null,
            b.lab_trend_status || null,
            b.new_imaging_performed !== undefined ? b.new_imaging_performed : null,
            b.imaging_study_ids !== undefined ? safeJsonStringify(b.imaging_study_ids) : existe[0].imaging_study_ids_json,
            b.control_chest_xray_performed !== undefined ? (b.control_chest_xray_performed ? 1 : 0) : existe[0].control_chest_xray_performed,
            b.imaging_results_available || null,
            b.imaging_clinical_interpretation || null,
            b.imaging_change_vs_prior || null,
            b.procedure_performed_24h !== undefined ? b.procedure_performed_24h : null,
            b.procedure_ids !== undefined ? safeJsonStringify(b.procedure_ids) : existe[0].procedure_ids_json,
            b.major_procedure_present !== undefined ? (b.major_procedure_present ? 1 : 0) : existe[0].major_procedure_present,
            b.procedure_tolerance || null,
            b.procedure_clinical_summary || null,
            b.clinical_events !== undefined ? safeJsonStringify(b.clinical_events) : existe[0].clinical_events_json,
            b.medication_changes_present !== undefined ? b.medication_changes_present : null,
            b.medication_change_type !== undefined ? safeJsonStringify(b.medication_change_type) : existe[0].medication_change_type_json,
            b.medication_change_summary || null,
            b.active_devices !== undefined ? safeJsonStringify(b.active_devices) : existe[0].active_devices_json,
            b.device_change_24h !== undefined ? b.device_change_24h : null,
            metrics.drain_output_24h_ml,
            b.drain_entries !== undefined ? safeJsonStringify(b.drain_entries) : existe[0].drain_entries_json,
            b.devices_summary || null,
            b.active_problems !== undefined ? safeJsonStringify(b.active_problems) : existe[0].active_problems_json,
            b.plan_cardiovascular || null,
            b.plan_respiratory || null,
            b.plan_neurologic || null,
            b.plan_renal_fluid || null,
            b.plan_nutrition || null,
            b.plan_infectious || null,
            b.plan_hematologic || null,
            b.plan_other || null,
            b.pending_tests_present !== undefined ? b.pending_tests_present : null,
            b.pending_other_summary || null,
            b.next_24h_goals || null,
            b.anticipated_disposition !== undefined ? b.anticipated_disposition : null,
            b.discharge_barriers !== undefined ? safeJsonStringify(b.discharge_barriers) : existe[0].discharge_barriers_json,
            b.signed_by || existe[0].signed_by,
            b.signed_at || existe[0].signed_at,
            b.finalized !== undefined ? (b.finalized ? 1 : 0) : existe[0].finalized,
            b.estatus_nota || existe[0].estatus_nota,
            safeJsonStringify(b),
            audit.audit_usu_id,
            audit.audit_ip,
            audit.audit_dep_id,
            id
        ];

        await db.query(sql, values);

        res.json({
            status: 'success',
            message: 'Evolución clínica diaria actualizada correctamente',
            id
        });
    } catch (error) {
        console.error('Error al actualizar evolución:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar evolución', error: error.message });
    }
};

const deleteEvolucion = async (req, res) => {
    try {
        const { id } = req.params;
        const [existe] = await db.query('SELECT finalized, estatus_nota FROM evolucion_diaria WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Evolución no encontrada' });
        }
        if (existe[0].finalized || existe[0].estatus_nota === 'Firmada' || existe[0].estatus_nota === 'Firmado') {
            return res.status(403).json({
                status: 'error',
                message: 'No se puede eliminar una evolución firmada/finalizada.'
            });
        }
        await db.query('DELETE FROM evolucion_diaria WHERE id = ?', [id]);
        res.json({ status: 'success', message: 'Evolución diaria eliminada' });
    } catch (error) {
        console.error('Error al eliminar evolución:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al eliminar evolución', error: error.message });
    }
};

/**
 * Seed con datos clínicos reales de prueba para verificar inmediatamente el módulo
 */
const seedDemoEvoluciones = async (req, res) => {
    try {
        const { paciente_id, registro_solicitud_id } = req.body;
        const targetSolicitudId = registro_solicitud_id || await resolverSolicitudId(paciente_id || 1);

        if (!targetSolicitudId) {
            return res.status(400).json({ status: 'error', message: 'Solicitud no encontrada para sembrado demo.' });
        }

        // Demo Evolución 1: Postoperatorio Inmediato Día 1
        const note1 = {
            daily_note_id: crypto.randomUUID(),
            registro_solicitud_id: targetSolicitudId,
            evolution_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
            evolution_time: '08:30:00',
            care_location: 'UCIP',
            service: 'Cirugía cardiovascular',
            author_id: 'DR-PEDIATRIA-CARD',
            hospital_day: 3,
            postoperative_day: 1,
            postprocedure_day: null,
            clinical_course_since_previous: 'Mejoría',
            significant_events_present: 'No',
            significant_events_summary: '',
            general_condition: 'Delicada',
            consciousness_status: 'Somnoliento',
            pain_present: 'Sí',
            pain_scale: 'FLACC',
            pain_score: '3',
            current_symptoms: ['Fatiga'],
            current_symptoms_other: '',
            clinical_status_summary: 'Lactante mayor en su 1er día de postoperatorio de corrección de Tetralogía de Fallot. Extubado a cánula de alto flujo, hemodinámicamente estable sin inotrópicos a altas dosis.',
            weight_kg: 10.5,
            height_cm: 82.0,
            bmi: 15.62,
            bsa: 0.49,
            heart_rate: 118,
            respiratory_rate: 26,
            oxygen_saturation: 98,
            oxygen_support: 'Alto flujo',
            oxygen_flow: 8.0,
            bp_extremity: 'Brazo derecho',
            bp_systolic: 92,
            bp_diastolic: 56,
            bp_percentile: 'P50-P75',
            hemodynamic_status: 'Estable',
            cardiac_rhythm_status: 'Sinusal',
            perfusion_status_daily: 'Adecuada',
            cyanosis_status: 'Ausente',
            edema_status: 'Ausente',
            hepatomegaly_status: 'Ausente',
            cardiovascular_daily_summary: 'Ruidos cardíacos rítmicos sin soplos agregados. Llenado capilar 2 segundos, pulsos periféricos palpables y simétricos.',
            respiratory_status_daily: 'Mejoría',
            respiratory_support: 'Alto flujo',
            fio2_current: 0.35,
            respiratory_support_change: 'Disminuido',
            respiratory_daily_summary: 'Tórax simétrico, murmullo vesicular presente bilateral sin estertores ni tiraje intercostal evidente.',
            intake_24h_ml: 1250.0,
            output_24h_ml: 1100.0,
            fluid_balance_24h_ml: 150.0,
            urine_volume_ml: 650.0,
            urine_measure_hours: 24,
            urine_output_ml_kg_h: 2.58,
            renal_status_daily: 'Estable',
            fluid_renal_summary: 'Diuresis espontánea adecuada por sonda vesical, aspecto claro. Creatinina y electrolitos en rango normal.',
            nutrition_route: ['SNG'],
            feeding_tolerance: 'Buena',
            nutrition_change_24h: 'Iniciado',
            nutrition_summary: 'Inicio de fórmula enteral continua por SNG a 10 ml/h con excelente tolerancia gástrica.',
            new_labs_available: 'Sí',
            lab_result_ids: [],
            lab_clinical_interpretation: 'Gasometría arterial: pH 7.39, pCO2 38, pO2 88, HCO3 23, Lactato 1.1 mmol/L. Hb 12.8 g/dL, plaquetas 195.000.',
            lab_trend_status: 'Mejoría',
            new_imaging_performed: 'Sí',
            imaging_study_ids: [],
            control_chest_xray_performed: 1,
            imaging_results_available: 'Sí',
            imaging_clinical_interpretation: 'Rx de tórax portátil de control: adecuada expansión pulmonar, silueta cardíaca con leve cardiomegalia postquirúrgica, línea venosa central normoposicionada.',
            imaging_change_vs_prior: 'Mejoría',
            procedure_performed_24h: 'No',
            procedure_ids: [],
            major_procedure_present: 0,
            procedure_tolerance: 'Sin complicaciones',
            procedure_clinical_summary: '',
            clinical_events: [],
            medication_changes_present: 'Sí',
            medication_change_type: ['Disminución'],
            medication_change_summary: 'Descenso progresivo de infusión de milrinona a 0.375 mcg/kg/min.',
            active_devices: ['CVC', 'Línea arterial', 'Drenaje torácico', 'Sonda urinaria'],
            device_change_24h: 'Sin cambios',
            drain_output_24h_ml: 65.0,
            drain_entries: [
                { drain_name: 'Drenaje mediastínico', volume: 45, aspect: 'Serohemático' },
                { drain_name: 'Drenaje pleural derecho', volume: 20, aspect: 'Seroso' }
            ],
            devices_summary: 'Catéter venoso central yugular interno derecho sin signos inflamatorios. Drenajes con escaso débito serohemático permeable.',
            active_problems: [
                {
                    problem_id: 'Tetralogía de Fallot corregida',
                    problem_priority: 1,
                    problem_status: 'Activo-estable',
                    problem_assessment: 'PO1 de corrección total de TF. Evolución favorable, extubado, normotenso.',
                    problem_plan: 'Mantener milrinona a titulación descendente, analgesia con paracetamol IV reglado.',
                    problem_resolved_date: null
                },
                {
                    problem_id: 'Manejo del dolor postoperatorio',
                    problem_priority: 2,
                    problem_status: 'Mejorando',
                    problem_assessment: 'FLACC 3/10, responde bien a analgesia de rescate.',
                    problem_plan: 'Continuar paracetamol cada 6 h y tramadol condicional.',
                    problem_resolved_date: null
                }
            ],
            plan_cardiovascular: 'Mantener perfusión con milrinona a dosis baja. Monitorización continua ECG.',
            plan_respiratory: 'Descenso de FiO2 a 30% si SpO2 > 95%. Estimulación de fisioterapia respiratoria.',
            plan_neurologic: 'Vigilar escala de Ramsay / sedación, fomentar vigilia activa.',
            plan_renal_fluid: 'Líquidos basales restringidos al 80% (100 ml/kg/día). Control estricto de balance horario.',
            plan_nutrition: 'Progresar nutrición enteral por SNG según tolerancia.',
            plan_infectious: 'Cefazolina profiláctica de 24 h postoperatorias.',
            plan_hematologic: 'Vigilar débito de tubos torácicos. Control de hematocrito diario.',
            plan_other: 'Movilización pasiva en cuna.',
            pending_tests_present: 'Sí',
            pending_other_summary: 'Ecocardiograma transtorácico de control postquirúrgico programado para mañana.',
            next_24h_goals: '1. Destete de milrinona. 2. Retiro de catéter arterial y sonda vesical si diuresis > 2 ml/kg/h. 3. Retiro de drenaje mediastínico si débito < 20 ml en 12 h.',
            anticipated_disposition: 'Traslado a menor complejidad',
            discharge_barriers: ['Medicación IV', 'Alimentación'],
            signed_by: 'Dr. Alejandro Benítez (Cardiología Pediátrica)',
            signed_at: new Date(Date.now() - 86400000).toISOString(),
            finalized: 1,
            estatus_nota: 'Firmada'
        };

        // Guardar nota demo
        const fakeReq1 = {
            body: { ...note1, paciente_id },
            audit: { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' }
        };
        const fakeRes1 = {
            status: () => ({ json: () => {} }),
            json: (payload) => payload
        };

        await createEvolucion(fakeReq1, fakeRes1);

        res.json({
            status: 'success',
            message: 'Evolución clínica diaria demo sembrada correctamente'
        });
    } catch (err) {
        console.error('Error al sembrar evoluciones demo:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

module.exports = {
    getEvoluciones,
    getEvolucionPorId,
    createEvolucion,
    updateEvolucion,
    deleteEvolucion,
    seedDemoEvoluciones
};
