// controllers/egresoController.js
const db = require('../config/db');
const crypto = require('crypto');

const generateUUID = () => {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'uuid-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
};

const safeJsonParse = (val, fallback = []) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
        return JSON.parse(val);
    } catch (e) {
        return fallback;
    }
};

const safeJsonStringify = (val, fallback = '[]') => {
    if (val === undefined || val === null) return fallback;
    if (typeof val === 'string') {
        try {
            JSON.parse(val);
            return val;
        } catch {
            return JSON.stringify(val);
        }
    }
    return JSON.stringify(val);
};

const calculateStayDays = (admDate, disDate) => {
    if (!admDate || !disDate) return null;
    const d1 = new Date(admDate);
    const d2 = new Date(disDate);
    const diffTime = d2.getTime() - d1.getTime();
    if (isNaN(diffTime)) return null;
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : 0;
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
             VALUES (?, 4, 1, CURDATE(), 'Pendiente', 'Solicitud inicial generada automáticamente para egreso', '1', '127.0.0.1', '1')`,
            [solicitudIdOrPacienteId]
        );
        return ins.insertId;
    }
    return null;
};

const unpackEgresoRow = (row) => {
    if (!row) return null;
    return {
        ...row,
        admission_diagnosis_ids: safeJsonParse(row.admission_diagnosis_ids_json, []),
        consultation_ids: safeJsonParse(row.consultation_ids_json, []),
        discharge_procedure_links: safeJsonParse(row.discharge_procedure_links_json, []),
        cardiac_surgery_ids: safeJsonParse(row.cardiac_surgery_ids_json, []),
        cath_ids: safeJsonParse(row.cath_ids_json, []),
        ep_study_ids: safeJsonParse(row.ep_study_ids_json, []),
        complication_links: safeJsonParse(row.complication_links_json, []),
        discharge_lab_result_ids: safeJsonParse(row.discharge_lab_result_ids_json, []),
        discharge_other_imaging_ids: safeJsonParse(row.discharge_other_imaging_ids_json, []),
        discharge_diagnoses: safeJsonParse(row.discharge_diagnoses_json, []),
        discharge_medications: safeJsonParse(row.discharge_medications_json, []),
        device_ids_at_discharge: safeJsonParse(row.device_ids_at_discharge_json, []),
        home_equipment_required: safeJsonParse(row.home_equipment_required_json, []),
        home_feeding_route: safeJsonParse(row.home_feeding_route_json, ['Oral']),
        warning_signs: safeJsonParse(row.warning_signs_json, []),
        pending_results: safeJsonParse(row.pending_results_json, []),
        followups: safeJsonParse(row.followups_json, []),
        datos_completos: safeJsonParse(row.datos_completos_json, null)
    };
};

const getEgresos = async (req, res) => {
    try {
        const { registro_solicitud_id, paciente_id, hospitalizacion_id } = req.query;
        let query = `
            SELECT eh.*,
                   rs.paciente_id,
                   CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                   p.numero_historia_clinica,
                   p.fecha_nacimiento
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
        query += ' ORDER BY eh.discharge_date DESC, eh.id DESC';

        const [rows] = await db.query(query, params);
        const unpacked = rows.map(unpackEgresoRow);
        res.json({ status: 'success', data: unpacked });
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
                    p.numero_historia_clinica,
                    p.fecha_nacimiento
             FROM egreso_hospitalario eh
             LEFT JOIN registro_solicitud rs ON eh.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE eh.id = ? OR eh.discharge_id = ?`,
            [id, id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Informe de egreso no encontrado' });
        }
        res.json({ status: 'success', data: unpackEgresoRow(rows[0]) });
    } catch (error) {
        console.error('Error al obtener egreso:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar egreso', error: error.message });
    }
};

const createEgreso = async (req, res) => {
    try {
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const body = req.body;

        const targetSolicitudId = body.registro_solicitud_id || await resolverSolicitudId(body.paciente_id);
        if (!targetSolicitudId) {
            return res.status(400).json({
                status: 'error',
                message: 'No se pudo vincular el egreso a una solicitud o paciente válido.'
            });
        }

        const discharge_id = body.discharge_id || generateUUID();
        const encounter_id = body.encounter_id || `HOSP-${Date.now().toString().slice(-6)}`;
        const intent = body.intent || 'normal';
        const parent_discharge_id = body.parent_discharge_id || null;

        const admission_date = body.admission_date || new Date().toISOString().slice(0, 10);
        const discharge_date = body.discharge_date || new Date().toISOString().slice(0, 10);
        const discharge_time = body.discharge_time || '14:00';
        const length_of_stay_days = body.length_of_stay_days !== undefined && body.length_of_stay_days !== null
            ? Number(body.length_of_stay_days)
            : calculateStayDays(admission_date, discharge_date);

        const discharge_service = body.discharge_service || 'Cardiología';
        const discharge_physician_id = body.discharge_physician_id || 'PROFESIONAL-DEMO-SIN-AUTENTICAR';
        const discharge_summary_status = body.discharge_summary_status || 'Borrador';

        const sql = `
            INSERT INTO egreso_hospitalario (
                registro_solicitud_id, hospitalizacion_id, discharge_id, encounter_id, intent, parent_discharge_id,
                admission_date, discharge_date, discharge_time, length_of_stay_days, discharge_service,
                discharge_physician_id, discharge_summary_status, present_illness_id, present_illness_display,
                admission_condition, admission_diagnosis_ids_json, hospital_course_outcome, icu_admission_occurred,
                icu_stay_days, mechanical_ventilation_during_stay, mechanical_support_during_stay,
                hospital_course_summary, consultation_ids_json, consultations_summary, discharge_procedure_links_json,
                cardiac_surgery_performed, cardiac_surgery_ids_json, operative_note_id, operative_note_attached,
                operative_note_file, operative_note_missing_reason, surgery_result_discharge, cath_performed_during_stay,
                cath_ids_json, cath_discharge_summary, ep_performed_during_stay, ep_study_ids_json, ep_discharge_summary,
                complication_links_json, complications_summary, unresolved_complication_present,
                discharge_physical_exam_id, discharge_vitals_id, discharge_weight_kg, discharge_spo2,
                discharge_exam_summary, discharge_cxr_status, discharge_cxr_id, discharge_cxr_date,
                discharge_cxr_summary, discharge_cxr_comparison, discharge_cxr_not_done_reason,
                discharge_labs_status, discharge_lab_result_ids_json, discharge_labs_summary,
                discharge_ecg_id, discharge_echo_id, discharge_other_imaging_ids_json, discharge_studies_summary,
                discharge_diagnoses_json, discharge_medications_json, oxygen_at_home, oxygen_flow_home,
                oxygen_interface_home, device_ids_at_discharge_json, vascular_access_at_discharge, drain_at_discharge,
                home_equipment_required_json, home_feeding_route_json, home_diet_type, activity_restriction,
                activity_restriction_detail, sternal_precautions, sternal_precautions_duration, wound_care_required,
                wound_care_instructions, bathing_instructions, return_school_daycare, sports_restriction,
                ie_prophylaxis_status, ie_prophylaxis_instructions, anticoagulation_at_discharge,
                anticoagulant_medication_id, target_inr_min, target_inr_max, next_inr_date, device_precautions,
                home_monitoring_required, home_spo2_monitoring, home_spo2_lower_limit, home_spo2_upper_limit,
                home_weight_monitoring, home_hr_monitoring, home_feeding_monitoring, warning_signs_json,
                warning_sign_other, pending_results_json, followups_json, discharge_disposition, transfer_facility,
                transfer_reason, transport_requirement, discharge_signed_by, discharge_signed_at, finalized,
                datos_completos_json, audit_usu_id, audit_ip, audit_dep_id
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?
            )
        `;

        const values = [
            targetSolicitudId,
            body.hospitalizacion_id || null,
            discharge_id,
            encounter_id,
            intent,
            parent_discharge_id,

            // 01
            admission_date,
            discharge_date,
            discharge_time,
            length_of_stay_days,
            discharge_service,
            discharge_physician_id,
            discharge_summary_status,
            body.present_illness_id || null,
            body.present_illness_display || null,
            body.admission_condition || 'Estable',
            safeJsonStringify(body.admission_diagnosis_ids || []),

            // 02
            body.hospital_course_outcome || 'Favorable',
            body.icu_admission_occurred ? 1 : 0,
            body.icu_stay_days || null,
            body.mechanical_ventilation_during_stay ? 1 : 0,
            body.mechanical_support_during_stay ? 1 : 0,
            body.hospital_course_summary || null,
            safeJsonStringify(body.consultation_ids || []),
            body.consultations_summary || null,

            // 03
            safeJsonStringify(body.discharge_procedure_links || []),
            body.cardiac_surgery_performed ? 1 : 0,
            safeJsonStringify(body.cardiac_surgery_ids || []),
            body.operative_note_id || null,
            body.operative_note_attached ? 1 : 0,
            body.operative_note_file || null,
            body.operative_note_missing_reason || null,
            body.surgery_result_discharge || null,
            body.cath_performed_during_stay ? 1 : 0,
            safeJsonStringify(body.cath_ids || []),
            body.cath_discharge_summary || null,
            body.ep_performed_during_stay ? 1 : 0,
            safeJsonStringify(body.ep_study_ids || []),
            body.ep_discharge_summary || null,
            safeJsonStringify(body.complication_links || []),
            body.complications_summary || null,
            body.unresolved_complication_present ? 1 : 0,

            // 04
            body.discharge_physical_exam_id || null,
            body.discharge_vitals_id || null,
            body.discharge_weight_kg || null,
            body.discharge_spo2 || null,
            body.discharge_exam_summary || null,
            body.discharge_cxr_status || 'Realizada',
            body.discharge_cxr_id || null,
            body.discharge_cxr_date || null,
            body.discharge_cxr_summary || null,
            body.discharge_cxr_comparison || null,
            body.discharge_cxr_not_done_reason || null,
            body.discharge_labs_status || 'Disponibles',
            safeJsonStringify(body.discharge_lab_result_ids || []),
            body.discharge_labs_summary || null,
            body.discharge_ecg_id || null,
            body.discharge_echo_id || null,
            safeJsonStringify(body.discharge_other_imaging_ids || []),
            body.discharge_studies_summary || null,

            // 05
            safeJsonStringify(body.discharge_diagnoses || []),

            // 06
            safeJsonStringify(body.discharge_medications || []),
            body.oxygen_at_home ? 1 : 0,
            body.oxygen_flow_home || null,
            body.oxygen_interface_home || null,
            safeJsonStringify(body.device_ids_at_discharge || []),
            body.vascular_access_at_discharge || 'Ninguno',
            body.drain_at_discharge ? 1 : 0,
            safeJsonStringify(body.home_equipment_required || []),

            // 07
            safeJsonStringify(body.home_feeding_route || ['Oral']),
            body.home_diet_type || null,
            body.activity_restriction || 'Reposo relativo',
            body.activity_restriction_detail || null,
            body.sternal_precautions || 'No aplica',
            body.sternal_precautions_duration || null,
            body.wound_care_required ? 1 : 0,
            body.wound_care_instructions || null,
            body.bathing_instructions || null,
            body.return_school_daycare || null,
            body.sports_restriction || null,
            body.ie_prophylaxis_status || 'Pendiente definición',
            body.ie_prophylaxis_instructions || null,
            body.anticoagulation_at_discharge ? 1 : 0,
            body.anticoagulant_medication_id || null,
            body.target_inr_min || null,
            body.target_inr_max || null,
            body.next_inr_date || null,
            body.device_precautions || null,
            body.home_monitoring_required ? 1 : 0,
            body.home_spo2_monitoring ? 1 : 0,
            body.home_spo2_lower_limit || null,
            body.home_spo2_upper_limit || null,
            body.home_weight_monitoring ? 1 : 0,
            body.home_hr_monitoring ? 1 : 0,
            body.home_feeding_monitoring ? 1 : 0,
            safeJsonStringify(body.warning_signs || []),
            body.warning_sign_other || null,

            // 08
            safeJsonStringify(body.pending_results || []),
            safeJsonStringify(body.followups || []),

            // 09
            body.discharge_disposition || 'Domicilio',
            body.transfer_facility || null,
            body.transfer_reason || null,
            body.transport_requirement || null,
            body.discharge_signed_by || null,
            body.discharge_signed_at || null,
            body.finalized ? 1 : 0,
            safeJsonStringify(body.datos_completos || body),

            // Auditoría
            audit.audit_usu_id,
            audit.audit_ip,
            audit.audit_dep_id
        ];

        const [result] = await db.query(sql, values);

        res.status(201).json({
            status: 'success',
            message: 'Informe de egreso guardado exitosamente',
            id: result.insertId,
            discharge_id,
            registro_solicitud_id: targetSolicitudId
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
        const body = req.body;

        // Verificar existencia y bloqueo de inmutabilidad si ya está firmado
        const [existe] = await db.query('SELECT discharge_summary_status, finalized FROM egreso_hospitalario WHERE id = ? OR discharge_id = ?', [id, id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Informe de egreso no encontrado' });
        }

        if (existe[0].discharge_summary_status === 'Firmado' && body.discharge_summary_status === 'Firmado') {
            return res.status(403).json({
                status: 'error',
                message: 'El informe de egreso está firmado y bloqueado contra modificaciones por salvaguarda legal.'
            });
        }

        const admission_date = body.admission_date;
        const discharge_date = body.discharge_date;
        const length_of_stay_days = body.length_of_stay_days !== undefined && body.length_of_stay_days !== null
            ? Number(body.length_of_stay_days)
            : calculateStayDays(admission_date, discharge_date);

        const sql = `
            UPDATE egreso_hospitalario SET
                hospitalizacion_id = COALESCE(?, hospitalizacion_id),
                intent = COALESCE(?, intent),
                parent_discharge_id = COALESCE(?, parent_discharge_id),
                admission_date = COALESCE(?, admission_date),
                discharge_date = COALESCE(?, discharge_date),
                discharge_time = COALESCE(?, discharge_time),
                length_of_stay_days = COALESCE(?, length_of_stay_days),
                discharge_service = COALESCE(?, discharge_service),
                discharge_physician_id = COALESCE(?, discharge_physician_id),
                discharge_summary_status = COALESCE(?, discharge_summary_status),
                present_illness_id = ?,
                present_illness_display = ?,
                admission_condition = COALESCE(?, admission_condition),
                admission_diagnosis_ids_json = ?,
                hospital_course_outcome = COALESCE(?, hospital_course_outcome),
                icu_admission_occurred = ?,
                icu_stay_days = ?,
                mechanical_ventilation_during_stay = ?,
                mechanical_support_during_stay = ?,
                hospital_course_summary = ?,
                consultation_ids_json = ?,
                consultations_summary = ?,
                discharge_procedure_links_json = ?,
                cardiac_surgery_performed = ?,
                cardiac_surgery_ids_json = ?,
                operative_note_id = ?,
                operative_note_attached = ?,
                operative_note_file = ?,
                operative_note_missing_reason = ?,
                surgery_result_discharge = ?,
                cath_performed_during_stay = ?,
                cath_ids_json = ?,
                cath_discharge_summary = ?,
                ep_performed_during_stay = ?,
                ep_study_ids_json = ?,
                ep_discharge_summary = ?,
                complication_links_json = ?,
                complications_summary = ?,
                unresolved_complication_present = ?,
                discharge_physical_exam_id = ?,
                discharge_vitals_id = ?,
                discharge_weight_kg = ?,
                discharge_spo2 = ?,
                discharge_exam_summary = ?,
                discharge_cxr_status = ?,
                discharge_cxr_id = ?,
                discharge_cxr_date = ?,
                discharge_cxr_summary = ?,
                discharge_cxr_comparison = ?,
                discharge_cxr_not_done_reason = ?,
                discharge_labs_status = ?,
                discharge_lab_result_ids_json = ?,
                discharge_labs_summary = ?,
                discharge_ecg_id = ?,
                discharge_echo_id = ?,
                discharge_other_imaging_ids_json = ?,
                discharge_studies_summary = ?,
                discharge_diagnoses_json = ?,
                discharge_medications_json = ?,
                oxygen_at_home = ?,
                oxygen_flow_home = ?,
                oxygen_interface_home = ?,
                device_ids_at_discharge_json = ?,
                vascular_access_at_discharge = ?,
                drain_at_discharge = ?,
                home_equipment_required_json = ?,
                home_feeding_route_json = ?,
                home_diet_type = ?,
                activity_restriction = ?,
                activity_restriction_detail = ?,
                sternal_precautions = ?,
                sternal_precautions_duration = ?,
                wound_care_required = ?,
                wound_care_instructions = ?,
                bathing_instructions = ?,
                return_school_daycare = ?,
                sports_restriction = ?,
                ie_prophylaxis_status = ?,
                ie_prophylaxis_instructions = ?,
                anticoagulation_at_discharge = ?,
                anticoagulant_medication_id = ?,
                target_inr_min = ?,
                target_inr_max = ?,
                next_inr_date = ?,
                device_precautions = ?,
                home_monitoring_required = ?,
                home_spo2_monitoring = ?,
                home_spo2_lower_limit = ?,
                home_spo2_upper_limit = ?,
                home_weight_monitoring = ?,
                home_hr_monitoring = ?,
                home_feeding_monitoring = ?,
                warning_signs_json = ?,
                warning_sign_other = ?,
                pending_results_json = ?,
                followups_json = ?,
                discharge_disposition = ?,
                transfer_facility = ?,
                transfer_reason = ?,
                transport_requirement = ?,
                discharge_signed_by = ?,
                discharge_signed_at = ?,
                finalized = ?,
                datos_completos_json = ?,
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
            WHERE id = ? OR discharge_id = ?
        `;

        const values = [
            body.hospitalizacion_id !== undefined ? body.hospitalizacion_id : null,
            body.intent !== undefined ? body.intent : null,
            body.parent_discharge_id !== undefined ? body.parent_discharge_id : null,
            admission_date !== undefined ? admission_date : null,
            discharge_date !== undefined ? discharge_date : null,
            body.discharge_time !== undefined ? body.discharge_time : null,
            length_of_stay_days !== undefined ? length_of_stay_days : null,
            body.discharge_service !== undefined ? body.discharge_service : null,
            body.discharge_physician_id !== undefined ? body.discharge_physician_id : null,
            body.discharge_summary_status !== undefined ? body.discharge_summary_status : null,
            body.present_illness_id || null,
            body.present_illness_display || null,
            body.admission_condition !== undefined ? body.admission_condition : null,
            safeJsonStringify(body.admission_diagnosis_ids || []),
            body.hospital_course_outcome !== undefined ? body.hospital_course_outcome : null,
            body.icu_admission_occurred ? 1 : 0,
            body.icu_stay_days || null,
            body.mechanical_ventilation_during_stay ? 1 : 0,
            body.mechanical_support_during_stay ? 1 : 0,
            body.hospital_course_summary || null,
            safeJsonStringify(body.consultation_ids || []),
            body.consultations_summary || null,
            safeJsonStringify(body.discharge_procedure_links || []),
            body.cardiac_surgery_performed ? 1 : 0,
            safeJsonStringify(body.cardiac_surgery_ids || []),
            body.operative_note_id || null,
            body.operative_note_attached ? 1 : 0,
            body.operative_note_file || null,
            body.operative_note_missing_reason || null,
            body.surgery_result_discharge || null,
            body.cath_performed_during_stay ? 1 : 0,
            safeJsonStringify(body.cath_ids || []),
            body.cath_discharge_summary || null,
            body.ep_performed_during_stay ? 1 : 0,
            safeJsonStringify(body.ep_study_ids || []),
            body.ep_discharge_summary || null,
            safeJsonStringify(body.complication_links || []),
            body.complications_summary || null,
            body.unresolved_complication_present ? 1 : 0,
            body.discharge_physical_exam_id || null,
            body.discharge_vitals_id || null,
            body.discharge_weight_kg || null,
            body.discharge_spo2 || null,
            body.discharge_exam_summary || null,
            body.discharge_cxr_status || 'Realizada',
            body.discharge_cxr_id || null,
            body.discharge_cxr_date || null,
            body.discharge_cxr_summary || null,
            body.discharge_cxr_comparison || null,
            body.discharge_cxr_not_done_reason || null,
            body.discharge_labs_status || 'Disponibles',
            safeJsonStringify(body.discharge_lab_result_ids || []),
            body.discharge_labs_summary || null,
            body.discharge_ecg_id || null,
            body.discharge_echo_id || null,
            safeJsonStringify(body.discharge_other_imaging_ids || []),
            body.discharge_studies_summary || null,
            safeJsonStringify(body.discharge_diagnoses || []),
            safeJsonStringify(body.discharge_medications || []),
            body.oxygen_at_home ? 1 : 0,
            body.oxygen_flow_home || null,
            body.oxygen_interface_home || null,
            safeJsonStringify(body.device_ids_at_discharge || []),
            body.vascular_access_at_discharge || 'Ninguno',
            body.drain_at_discharge ? 1 : 0,
            safeJsonStringify(body.home_equipment_required || []),
            safeJsonStringify(body.home_feeding_route || ['Oral']),
            body.home_diet_type || null,
            body.activity_restriction || 'Reposo relativo',
            body.activity_restriction_detail || null,
            body.sternal_precautions || 'No aplica',
            body.sternal_precautions_duration || null,
            body.wound_care_required ? 1 : 0,
            body.wound_care_instructions || null,
            body.bathing_instructions || null,
            body.return_school_daycare || null,
            body.sports_restriction || null,
            body.ie_prophylaxis_status || 'Pendiente definición',
            body.ie_prophylaxis_instructions || null,
            body.anticoagulation_at_discharge ? 1 : 0,
            body.anticoagulant_medication_id || null,
            body.target_inr_min || null,
            body.target_inr_max || null,
            body.next_inr_date || null,
            body.device_precautions || null,
            body.home_monitoring_required ? 1 : 0,
            body.home_spo2_monitoring ? 1 : 0,
            body.home_spo2_lower_limit || null,
            body.home_spo2_upper_limit || null,
            body.home_weight_monitoring ? 1 : 0,
            body.home_hr_monitoring ? 1 : 0,
            body.home_feeding_monitoring ? 1 : 0,
            safeJsonStringify(body.warning_signs || []),
            body.warning_sign_other || null,
            safeJsonStringify(body.pending_results || []),
            safeJsonStringify(body.followups || []),
            body.discharge_disposition || 'Domicilio',
            body.transfer_facility || null,
            body.transfer_reason || null,
            body.transport_requirement || null,
            body.discharge_signed_by || null,
            body.discharge_signed_at || null,
            body.finalized ? 1 : 0,
            safeJsonStringify(body.datos_completos || body),
            audit.audit_usu_id,
            audit.audit_ip,
            audit.audit_dep_id,
            id,
            id
        ];

        await db.query(sql, values);

        res.json({
            status: 'success',
            message: 'Informe de egreso actualizado exitosamente',
            id
        });
    } catch (error) {
        console.error('Error al actualizar egreso:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar egreso', error: error.message });
    }
};

const deleteEgreso = async (req, res) => {
    try {
        const { id } = req.params;
        const [existe] = await db.query('SELECT discharge_summary_status FROM egreso_hospitalario WHERE id = ? OR discharge_id = ?', [id, id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Informe de egreso no encontrado' });
        }
        if (existe[0].discharge_summary_status === 'Firmado') {
            return res.status(403).json({
                status: 'error',
                message: 'No es posible eliminar un informe de egreso firmado.'
            });
        }
        await db.query('DELETE FROM egreso_hospitalario WHERE id = ? OR discharge_id = ?', [id, id]);
        res.json({ status: 'success', message: 'Informe de egreso eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar egreso:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al eliminar egreso', error: error.message });
    }
};

const seedDemoEgreso = async (req, res) => {
    try {
        const { paciente_id, registro_solicitud_id } = req.body;
        const targetSolicitudId = registro_solicitud_id || await resolverSolicitudId(paciente_id || 1);
        if (!targetSolicitudId) {
            return res.status(400).json({ status: 'error', message: 'Paciente o solicitud inválida para demo' });
        }

        const dId = generateUUID();
        const demoData = {
            registro_solicitud_id: targetSolicitudId,
            discharge_id: dId,
            encounter_id: 'HOSP-PED-2026-084',
            admission_date: '2026-10-18',
            discharge_date: new Date().toISOString().slice(0, 10),
            discharge_time: '14:30',
            length_of_stay_days: 4,
            discharge_service: 'Cardiología',
            discharge_physician_id: 'DR. MARCOS PEÑA - CIRUGÍA CARDIOVASCULAR',
            discharge_summary_status: 'Borrador',
            admission_condition: 'Delicada',
            present_illness_display: 'Paciente escolar con antecedentes de comunicación interventricular perimembranosa e insuficiencia cardíaca descompensada, ingresado para corrección quirúrgica definitiva.',
            admission_diagnosis_ids: ['CIV-01', 'ICC-NYHA-III'],
            hospital_course_outcome: 'Favorable',
            icu_admission_occurred: true,
            icu_stay_days: 2.0,
            mechanical_ventilation_during_stay: true,
            mechanical_support_during_stay: false,
            hospital_course_summary: 'Ingreso electivo para cierre quirúrgico de defecto septal. En el postoperatorio inmediato cursó 48 horas en UCIP con soporte inotrópico y extubación programada sin complicaciones. Pasó a sala de cardiología al 3er día con adecuada tolerancia oral, diuresis conservada y ruidos cardíacos rítmicos.',
            cardiac_surgery_performed: true,
            cardiac_surgery_ids: ['SURG-001'],
            surgery_result_discharge: 'Reparación anatómica y hemodinámica completa (Parche de pericardio bovino)',
            operative_note_attached: true,
            cath_performed_during_stay: false,
            cath_ids: [],
            complication_links: [],
            complications_summary: 'Sin complicaciones mayores ni arritmias registradas.',
            unresolved_complication_present: false,
            discharge_weight_kg: 18.5,
            discharge_spo2: 99.0,
            discharge_exam_summary: 'Paciente activo, reactivo, afebril, hemodinámicamente compensado. Ruidos cardíacos rítmicos, sin soplos de CIV residual. Murmullo vesicular conservado bilateralmente sin agregados. Abdomen blando, no doloroso, sin visceromegalias. Herida operatoria limpia y afrontada, sin eritema ni secreciones.',
            discharge_cxr_status: 'Realizada',
            discharge_cxr_comparison: 'Mejoría evidente',
            discharge_cxr_summary: 'Disminución del índice cardiotorácico a 0.51, campos pulmonares limpios sin infiltrados ni derrame pleural.',
            discharge_labs_status: 'Disponibles',
            discharge_labs_summary: 'Hemoglobina 12.8 g/dL, Leucocitos 7,800/mm3, Plaquetas 245,000/mm3, Creatinina 0.42 mg/dL, Sodio 139 mEq/L, Potasio 4.2 mEq/L. Sin leucocitosis ni alteración electrolítica.',
            discharge_diagnoses: [
                {
                    discharge_diagnosis_id: 'diag-1',
                    diagnosis_id: 'CIV perimembranosa cerrada con parche',
                    diagnosis_status: 'Resuelto',
                    diagnosis_notes: 'Cierre total ecocardiográficamente constatado sin shunt residual'
                },
                {
                    discharge_diagnosis_id: 'diag-2',
                    diagnosis_id: 'Postoperatorio de cirugía cardiovascular',
                    diagnosis_status: 'Postoperatorio',
                    diagnosis_notes: 'Evolución favorable en fase de cicatrización'
                }
            ],
            discharge_medications: [
                {
                    discharge_medication_id: 'med-1',
                    medication_order_id: 'Furosemida 10 mg VO c/12h',
                    medication_action: 'Continuar',
                    medication_indication: 'Prevención de congestión venosa pulmonar',
                    medication_duration: '14 días post-alta',
                    special_medication_instructions: 'Administrar con el desayuno y la merienda de la tarde'
                },
                {
                    discharge_medication_id: 'med-2',
                    medication_order_id: 'Espironolactona 6.25 mg VO c/24h',
                    medication_action: 'Continuar',
                    medication_indication: 'Ahorrador de potasio y remodelado',
                    medication_duration: '1 mes',
                    special_medication_instructions: 'Tomar con alimentos'
                },
                {
                    discharge_medication_id: 'med-3',
                    medication_order_id: 'Paracetamol 250 mg VO si presenta dolor',
                    medication_action: 'Iniciar',
                    medication_indication: 'Analgesia según necesidad',
                    medication_duration: '3-5 días SOS',
                    special_medication_instructions: 'No exceder 4 tomas al día'
                }
            ],
            oxygen_at_home: false,
            vascular_access_at_discharge: 'Ninguno',
            drain_at_discharge: false,
            home_equipment_required: ['Pulsioxímetro', 'Balanza'],
            home_feeding_route: ['Oral'],
            home_diet_type: 'Dieta hipercalórica e hiposódica fraccionada, abundante líquido.',
            activity_restriction: 'Reposo relativo',
            activity_restriction_detail: 'Evitar correr, saltar o juegos con impacto torácico por 6 semanas.',
            sternal_precautions: 'Sí',
            sternal_precautions_duration: '6 semanas',
            wound_care_required: true,
            wound_care_instructions: 'Aseo de herida torácica con agua tibia y jabón neutro. Secar sin frotar con gasa limpia. No aplicar pomadas ni antisépticos coloreados.',
            bathing_instructions: 'Baño de esponja o ducha corta protegiendo el chorro directo de agua.',
            return_school_daycare: 'Permiso escolar por 30 días.',
            sports_restriction: 'Exento de educación física por 90 días.',
            ie_prophylaxis_status: 'Indicada',
            ie_prophylaxis_instructions: 'Profilaxis con Amoxicilina 50 mg/kg 1 hora antes de todo procedimiento dental invasivo durante los próximos 6 meses.',
            anticoagulation_at_discharge: false,
            home_monitoring_required: true,
            home_spo2_monitoring: true,
            home_spo2_lower_limit: 94.0,
            home_spo2_upper_limit: 100.0,
            home_weight_monitoring: true,
            home_hr_monitoring: true,
            warning_signs: ['Dificultad respiratoria', 'Fiebre', 'Alteración de herida', 'Vómitos persistentes'],
            warning_sign_other: 'Palidez extrema o sudoración fría al alimentarse',
            pending_results: [
                {
                    pending_result_id: 'pend-1',
                    pending_test_id: 'Hemocultivo de control pre-alta',
                    pending_test_name: 'Hemocultivo x2 frascos',
                    followup_action: 'Revisar resultado preliminar a las 48h con laboratorio central'
                }
            ],
            followups: [
                {
                    followup_id: 'fol-1',
                    followup_specialty: 'Cardiología pediátrica',
                    followup_date: '',
                    followup_interval: '7 a 10 días',
                    followup_reason: 'Evaluación ecocardiográfica ambulatoria de control de parche septal y retiro de puntos'
                },
                {
                    followup_id: 'fol-2',
                    followup_specialty: 'Cirugía cardiovascular',
                    followup_date: '',
                    followup_interval: '1 mes',
                    followup_reason: 'Revisión de consolidación esternal y alta quirúrgica definitiva'
                }
            ],
            discharge_disposition: 'Domicilio'
        };

        req.body = demoData;
        return createEgreso(req, res);
    } catch (error) {
        console.error('Error al sembrar egreso demo:', error);
        res.status(500).json({ status: 'error', message: 'Error al sembrar demo', error: error.message });
    }
};

module.exports = {
    getEgresos,
    getEgresoPorId,
    createEgreso,
    updateEgreso,
    deleteEgreso,
    seedDemoEgreso
};
