// controllers/examenFisicoController.js
const db = require('../config/db');

/**
 * Función auxiliar para resolver el registro_solicitud_id y paciente_id
 */
const resolverSolicitudId = async (id, connectionOrDb) => {
    if (!id) return null;
    const [sol] = await connectionOrDb.query('SELECT id, paciente_id FROM registro_solicitud WHERE id = ?', [id]);
    if (sol.length > 0) return sol[0].id;

    const [solPorPac] = await connectionOrDb.query(
        'SELECT id, paciente_id FROM registro_solicitud WHERE paciente_id = ? ORDER BY id DESC LIMIT 1',
        [id]
    );
    if (solPorPac.length > 0) return solPorPac[0].id;

    const [pac] = await connectionOrDb.query('SELECT id FROM paciente WHERE id = ?', [id]);
    if (pac.length > 0) {
        const [ins] = await connectionOrDb.query(
            `INSERT INTO registro_solicitud (
                paciente_id, centro_salud_id, tipo_operacion_id, fecha_solicitud, estatus, observacion_general, audit_usu_id, audit_ip, audit_dep_id
            ) VALUES (?, 4, 1, CURDATE(), 'Pendiente', 'Solicitud inicial generada automáticamente', '1', '127.0.0.1', '1')`,
            [id]
        );
        return ins.insertId;
    }

    return null;
};

/**
 * Cálculos automáticos de fórmulas pediátricas
 */
const calcularAntropometria = (pesoKg, tallaCm) => {
    let imc = null;
    let sc = null;

    if (pesoKg > 0 && tallaCm > 0) {
        const tallaM = tallaCm / 100;
        imc = +(pesoKg / Math.pow(tallaM, 2)).toFixed(2);
        sc = +(Math.sqrt((pesoKg * tallaCm) / 3600)).toFixed(3);
    }

    return { imc, sc };
};

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

const cleanVal = (val, defaultVal = null) => {
    if (val === undefined || val === null || val === '') return defaultVal;
    return val;
};

/**
 * Obtener el examen físico vinculado a una solicitud clínica o paciente
 */
const getExamenFisicoPorPaciente = async (req, res) => {
    try {
        const { id } = req.params;
        const solicitudId = await resolverSolicitudId(id, db);

        if (!solicitudId) {
            return res.status(404).json({ status: 'error', message: 'Solicitud clínica o paciente no encontrado' });
        }

        const [rows] = await db.query(
            `SELECT ef.*,
                    rs.paciente_id AS rel_paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica
             FROM historia_examen_fisico ef
             LEFT JOIN registro_solicitud rs ON ef.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON COALESCE(ef.paciente_id, rs.paciente_id) = p.id
             WHERE ef.registro_solicitud_id = ? 
             ORDER BY ef.id DESC`,
            [solicitudId]
        );

        const dataParsed = rows.map(r => ({
            ...r,
            paciente_id: r.paciente_id || r.rel_paciente_id,
            cranial_nerves: safeJsonParse(r.cranial_nerves_json, []),
            reflexes_matrix: safeJsonParse(r.reflexes_matrix_json, []),
            primitive_reflexes: safeJsonParse(r.primitive_reflexes_json, []),
            seccion_vitals: safeJsonParse(r.seccion_vitals_json, {}),
            seccion_general: safeJsonParse(r.seccion_general_json, {}),
            seccion_auscultacion: safeJsonParse(r.seccion_auscultacion_json, {}),
            seccion_other: safeJsonParse(r.seccion_other_json, {}),
            seccion_neuro_global: safeJsonParse(r.seccion_neuro_global_json, {}),
            seccion_pares_craneales: safeJsonParse(r.seccion_pares_craneales_json, {}),
            seccion_motricidad: safeJsonParse(r.seccion_motricidad_json, {}),
            seccion_sensibilidad: safeJsonParse(r.seccion_sensibilidad_json, {}),
            datos_completos: safeJsonParse(r.datos_completos_json, {})
        }));

        res.json({
            status: 'success',
            registro_solicitud_id: solicitudId,
            data: dataParsed
        });
    } catch (error) {
        console.error('Error al obtener examen físico:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar examen físico', error: error.message });
    }
};

/**
 * Registrar o actualizar examen físico pediátrico casado a registro_solicitud_id y paciente_id
 */
const createExamenFisico = async (req, res) => {
    try {
        const { id } = req.params;
        const audit = req.audit || {
            audit_usu_id: req.body.audit_usu_id || '1',
            audit_ip: req.body.audit_ip || '127.0.0.1',
            audit_dep_id: req.body.audit_dep_id || '1'
        };

        const targetSolicitudId = req.body.registro_solicitud_id || await resolverSolicitudId(id, db);
        if (!targetSolicitudId) {
            return res.status(404).json({ status: 'error', message: 'Registro de solicitud clínica no encontrado' });
        }

        // Resolver paciente_id
        let targetPacienteId = req.body.paciente_id;
        if (!targetPacienteId) {
            const [solRows] = await db.query('SELECT paciente_id FROM registro_solicitud WHERE id = ?', [targetSolicitudId]);
            if (solRows.length > 0 && solRows[0].paciente_id) {
                targetPacienteId = solRows[0].paciente_id;
            }
        }

        const b = req.body;

        const peso_kg = cleanVal(b.peso_kg ?? b.weight_kg);
        const talla_cm = cleanVal(b.talla_cm ?? b.height_cm);
        const frecuencia_cardiaca = cleanVal(b.frecuencia_cardiaca ?? b.heart_rate);
        const frecuencia_respiratoria = cleanVal(b.frecuencia_respiratoria ?? b.respiratory_rate);

        // Fórmulas automáticas de antropometría
        const { imc, sc } = (peso_kg && talla_cm) ? calcularAntropometria(Number(peso_kg), Number(talla_cm)) : { imc: null, sc: null };

        // Presión arterial y Presión Arterial Media (PAM)
        const presion_sistolica = cleanVal(b.presion_sistolica ?? b.bp_systolic);
        const presion_diastolica = cleanVal(b.presion_diastolica ?? b.bp_diastolic);
        let exam_bp_mean = cleanVal(b.exam_bp_mean ?? b.bp_mean);
        if (exam_bp_mean === null && presion_sistolica !== null && presion_diastolica !== null) {
            exam_bp_mean = +(((2 * Number(presion_diastolica)) + Number(presion_sistolica)) / 3).toFixed(1);
        }

        // Llenado capilar automático
        const llenado_capilar_segundos = cleanVal(b.llenado_capilar_segundos ?? b.capillary_refill_seconds, 2.0);
        let capillary_refill_status = cleanVal(b.capillary_refill_status);
        if (!capillary_refill_status && llenado_capilar_segundos !== null) {
            capillary_refill_status = Number(llenado_capilar_segundos) <= 2 ? 'Normal' : 'Retardado';
        }

        // Glasgow Total automático
        const gcs_eye = cleanVal(b.gcs_eye ?? b.glasgow_ocular);
        const gcs_verbal = cleanVal(b.gcs_verbal ?? b.glasgow_verbal);
        const gcs_motor = cleanVal(b.gcs_motor ?? b.glasgow_motor);
        let gcs_total = cleanVal(b.glasgow_total ?? b.gcs_total);
        if (gcs_eye !== null && gcs_verbal !== null && gcs_motor !== null) {
            gcs_total = Number(gcs_eye) + Number(gcs_verbal) + Number(gcs_motor);
        }

        // Simetría de reflejos
        let reflex_symmetry = cleanVal(b.reflex_symmetry);
        const reflexes_matrix = b.reflexes_matrix || b.osteotendinous_reflexes || [];
        if (!reflex_symmetry && Array.isArray(reflexes_matrix) && reflexes_matrix.length > 0) {
            const hasAsym = reflexes_matrix.some(r => r.izq && r.der && r.izq !== r.der);
            reflex_symmetry = hasAsym ? 'Asimétricos' : 'Simétricos';
        }

        // Matrices serializadas
        const cranial_nerves_json = safeJsonStringify(b.cranial_nerves || b.cranial_nerve_assessments || []);
        const reflexes_matrix_json = safeJsonStringify(reflexes_matrix);
        const primitive_reflexes_json = safeJsonStringify(b.primitive_reflexes || []);

        // Datos seccionales y datos completos JSON
        const seccion_vitals_json = safeJsonStringify(b.seccion_vitals || {});
        const seccion_general_json = safeJsonStringify(b.seccion_general || {});
        const seccion_auscultacion_json = safeJsonStringify(b.seccion_auscultacion || {});
        const seccion_other_json = safeJsonStringify(b.seccion_other || {});
        const seccion_neuro_global_json = safeJsonStringify(b.seccion_neuro_global || {});
        const seccion_pares_craneales_json = safeJsonStringify(b.seccion_pares_craneales || {});
        const seccion_motricidad_json = safeJsonStringify(b.seccion_motricidad || {});
        const seccion_sensibilidad_json = safeJsonStringify(b.seccion_sensibilidad || {});
        const datos_completos_json = safeJsonStringify(b);

        // Array / multiselect helper
        const toStr = (val, defaultVal = null) => {
            if (Array.isArray(val)) return val.join(', ');
            return cleanVal(val, defaultVal);
        };

        const toBoolNum = (val) => {
            if (val === true || val === 1 || val === '1' || val === 'Sí' || val === 'Si') return 1;
            return 0;
        };

        const recordData = {
            paciente_id: targetPacienteId ? Number(targetPacienteId) : null,
            registro_solicitud_id: Number(targetSolicitudId),

            // 01 Antropometría y Signos Vitales
            peso_kg: peso_kg !== null ? Number(peso_kg) : null,
            percentil_peso: cleanVal(b.percentil_peso || b.weight_percentile),
            talla_cm: talla_cm !== null ? Number(talla_cm) : null,
            percentil_talla: cleanVal(b.percentil_talla || b.height_percentile),
            imc: imc || cleanVal(b.imc),
            superficie_corporal: sc || cleanVal(b.superficie_corporal || b.bsa),
            frecuencia_cardiaca: frecuencia_cardiaca !== null ? Number(frecuencia_cardiaca) : null,
            frecuencia_respiratoria: frecuencia_respiratoria !== null ? Number(frecuencia_respiratoria) : null,
            saturacion_oxigeno: cleanVal(b.saturacion_oxigeno ?? b.oxygen_saturation, 98),
            soporte_oxigeno: cleanVal(b.soporte_oxigeno || b.oxygen_support, 'Aire ambiente'),
            flujo_oxigeno_litros: cleanVal(b.flujo_oxigeno_litros || b.oxygen_flow),
            presion_sistolica: presion_sistolica !== null ? Number(presion_sistolica) : null,
            presion_diastolica: presion_diastolica !== null ? Number(presion_diastolica) : null,
            exam_bp_mean: exam_bp_mean !== null ? Number(exam_bp_mean) : null,
            extremidad_presion: cleanVal(b.extremidad_presion || b.bp_extremity, 'Brazo derecho'),
            percentil_presion: cleanVal(b.percentil_presion || b.bp_percentile),

            // 02 Estado general y tórax
            estado_perfusion: cleanVal(b.estado_perfusion || b.perfusion_status, 'Bien perfundido'),
            hallazgo_piel: toStr(b.hallazgo_piel || b.skin_findings, 'Normal'),
            general_exam_notes: cleanVal(b.general_exam_notes),
            inspeccion_torax: toStr(b.inspeccion_torax || b.anterior_chest_inspection, 'Normal'),
            exam_chest_symmetry: cleanVal(b.exam_chest_symmetry || b.chest_symmetry, 'Simétrico'),
            cicatriz_esternotomia: toBoolNum(b.cicatriz_esternotomia),
            cicatriz_toracotomia: toBoolNum(b.cicatriz_toracotomia),
            palpacion_precordial: toStr(b.palpacion_precordial || b.precordial_palpation, 'Normal'),
            exam_precordial_activity: cleanVal(b.exam_precordial_activity || b.precordial_activity, 'Normodinámica'),
            
            // Choque de punta V18
            exam_apex_beat_palpable: cleanVal(b.exam_apex_beat_palpable || b.apex_beat_palpable, 'Palpable'),
            exam_apex_beat_location: cleanVal(b.exam_apex_beat_location || b.apex_beat_location),
            exam_apex_beat_location_other: cleanVal(b.exam_apex_beat_location_other || b.apex_beat_location_other),
            exam_apex_beat_midclavicular_relation: cleanVal(b.exam_apex_beat_midclavicular_relation || b.apex_beat_midclavicular_relation),
            exam_apex_beat_intensity: cleanVal(b.exam_apex_beat_intensity || b.apex_beat_intensity),
            exam_apex_beat_extent: cleanVal(b.exam_apex_beat_extent || b.apex_beat_extent),
            exam_apex_beat_displacement: cleanVal(b.exam_apex_beat_displacement || b.apex_beat_displacement),
            exam_apex_beat_displacement_other: cleanVal(b.exam_apex_beat_displacement_other || b.apex_beat_displacement_other),
            
            // Impulsos precordiales
            exam_parasternal_impulse: cleanVal(b.exam_parasternal_impulse || b.parasternal_impulse, 'Ausente'),
            exam_precordial_heave: cleanVal(b.exam_precordial_heave || b.precordial_heave, 'Ausente'),
            exam_precordial_heave_other: cleanVal(b.exam_precordial_heave_other || b.precordial_heave_other),
            exam_epigastric_impulse: cleanVal(b.exam_epigastric_impulse || b.epigastric_impulse, 'Ausente'),

            // Frémito precordial V18
            exam_precordial_thrill: cleanVal(b.exam_precordial_thrill || b.precordial_thrill || (toBoolNum(b.fremito_presente) ? 'Presente' : 'Ausente'), 'Ausente'),
            exam_precordial_thrill_location: cleanVal(b.exam_precordial_thrill_location || b.fremito_localizacion),
            exam_precordial_thrill_location_other: cleanVal(b.exam_precordial_thrill_location_other),
            exam_precordial_thrill_timing: cleanVal(b.exam_precordial_thrill_timing),
            exam_precordial_thrill_intensity: cleanVal(b.exam_precordial_thrill_intensity),
            fremito_presente: (b.exam_precordial_thrill === 'Presente' || toBoolNum(b.fremito_presente)) ? 1 : 0,
            fremito_localizacion: cleanVal(b.exam_precordial_thrill_location || b.fremito_localizacion),

            latido_sistolico: cleanVal(b.latido_sistolico || b.pmi_type, 'Normal'),
            pmi_side: cleanVal(b.pmi_side),
            pmi_intercostal_space: cleanVal(b.pmi_intercostal_space),
            pmi_reference_line: cleanVal(b.pmi_reference_line),
            pmi_notes: cleanVal(b.pmi_notes),
            precordial_palpation_notes: cleanVal(b.precordial_palpation_notes),

            // 03 Auscultación cardiopulmonar
            auscultacion_pulmonar: toStr(b.auscultacion_pulmonar || b.lung_auscultation, 'Murmullo vesicular conservado'),
            lung_findings_side: cleanVal(b.lung_findings_side),
            trabajo_respiratorio: toStr(b.trabajo_respiratorio || b.respiratory_effort, 'Normal'),
            respiratory_exam_notes: cleanVal(b.respiratory_exam_notes),
            ruidos_cardiacos: toStr(b.ruidos_cardiacos || b.heart_sounds, 'S1 y S2 presentes normofonéticos'),
            s1_tipo: toStr(b.s1_tipo || b.s1_type, 'Único'),
            s1_soplo_presente: cleanVal(b.s1_soplo_presente || b.murmur_s1_present, 'No'),
            s1_soplo_fase: cleanVal(b.s1_soplo_fase || b.murmur_s1_phase),
            s1_soplo_localizacion: toStr(b.s1_soplo_localizacion || b.murmur_s1_location),
            s1_soplo_grado: cleanVal(b.s1_soplo_grado || b.murmur_s1_grade),
            murmur_s1_pitch: cleanVal(b.murmur_s1_pitch),
            murmur_s1_character: toStr(b.murmur_s1_character),
            murmur_s1_radiation: toStr(b.murmur_s1_radiation),
            murmur_s1_radiation_other: cleanVal(b.murmur_s1_radiation_other),
            s2_tipo: toStr(b.s2_tipo || b.s2_type, 'Único'),
            s2_soplo_presente: cleanVal(b.s2_soplo_presente || b.murmur_s2_present, 'No'),
            s2_soplo_fase: cleanVal(b.s2_soplo_fase || b.murmur_s2_phase),
            s2_soplo_localizacion: toStr(b.s2_soplo_localizacion || b.murmur_s2_location),
            s2_soplo_grado: cleanVal(b.s2_soplo_grado || b.murmur_s2_grade),
            murmur_s2_pitch: cleanVal(b.murmur_s2_pitch),
            murmur_s2_character: toStr(b.murmur_s2_character),
            murmur_s2_radiation: toStr(b.murmur_s2_radiation),
            murmur_s2_radiation_other: cleanVal(b.murmur_s2_radiation_other),

            // 04 Abdomen, extremidades y genitales
            inspeccion_abdominal: cleanVal(b.inspeccion_abdominal || b.abdominal_inspection, 'Plano'),
            auscultacion_abdominal: cleanVal(b.auscultacion_abdominal || b.abdominal_auscultation, 'Ruidos hidroaéreos presentes'),
            abdominal_palpation: toStr(b.abdominal_palpation, 'Normal'),
            hepatomegalia: toBoolNum(b.hepatomegalia ?? b.hepatomegaly_present),
            borde_hepatico_cm: cleanVal(b.borde_hepatico_cm || b.liver_edge_cm),
            esplenomegalia: toBoolNum(b.esplenomegalia ?? b.splenomegaly_present),
            abdominal_exam_notes: cleanVal(b.abdominal_exam_notes),
            extremity_appearance: toStr(b.extremity_appearance, 'Normal'),
            edema_location: toStr(b.edema_location),
            edema_grade: cleanVal(b.edema_grade),
            extremity_notes: cleanVal(b.extremity_notes),
            llenado_capilar_segundos: llenado_capilar_segundos !== null ? Number(llenado_capilar_segundos) : 2.0,
            capillary_refill_status: cleanVal(capillary_refill_status, 'Normal'),
            pulso_amplitud: cleanVal(b.pulso_amplitud || b.pulse_amplitude, '2+ normal'),
            pulso_localizacion: cleanVal(b.pulso_localizacion || b.pulse_location, 'Radial'),
            pulse_side: cleanVal(b.pulse_side),
            pulse_symmetry: cleanVal(b.pulse_symmetry, 'Simétricos'),
            pulse_symmetry_notes: cleanVal(b.pulse_symmetry_notes),
            external_genital_exam: cleanVal(b.external_genital_exam, 'Normal'),
            external_genital_exam_notes: cleanVal(b.external_genital_exam_notes),

            // 05 Neurología global y mental
            neurologic_exam_overall: cleanVal(b.neurologic_exam_overall, 'Normal'),
            neurologic_exam_age_appropriate: cleanVal(b.neurologic_exam_age_appropriate, 'Sí'),
            focal_neurologic_deficit: cleanVal(b.focal_neurologic_deficit, 'Ausente'),
            focal_neurologic_deficit_notes: cleanVal(b.focal_neurologic_deficit_notes),
            nivel_conciencia: cleanVal(b.nivel_conciencia || b.consciousness_level, 'Alerta'),
            response_to_environment: cleanVal(b.response_to_environment, 'Adecuada para la edad'),
            behavior_status: cleanVal(b.behavior_status, 'Apropiada'),
            behavior_notes: cleanVal(b.behavior_notes),
            gcs_required: toBoolNum(b.gcs_required || gcs_total),
            glasgow_total: gcs_total !== null ? Number(gcs_total) : 15,
            gcs_eye: gcs_eye !== null ? Number(gcs_eye) : 4,
            gcs_verbal: gcs_verbal !== null ? Number(gcs_verbal) : 5,
            gcs_motor: gcs_motor !== null ? Number(gcs_motor) : 6,
            mental_status: cleanVal(b.mental_status, 'Apropiado para edad'),
            orientation_person: cleanVal(b.orientation_person),
            orientation_place: cleanVal(b.orientation_place),
            orientation_time: cleanVal(b.orientation_time),
            attention_status: cleanVal(b.attention_status),
            memory_status: cleanVal(b.memory_status),
            language_status: cleanVal(b.language_status, 'Adecuado para edad'),
            mental_status_notes: cleanVal(b.mental_status_notes),
            pupilas_simetria: cleanVal(b.pupilas_simetria || b.pupil_symmetry, 'Isocóricas'),
            right_pupil_mm: cleanVal(b.right_pupil_mm),
            left_pupil_mm: cleanVal(b.left_pupil_mm),
            right_pupil_reactivity: cleanVal(b.right_pupil_reactivity, 'Reactiva'),
            left_pupil_reactivity: cleanVal(b.left_pupil_reactivity, 'Reactiva'),

            // 06 Pares craneales
            extraocular_movements: cleanVal(b.extraocular_movements, 'Conservados'),
            gaze_alignment: cleanVal(b.gaze_alignment, 'Normal'),
            nystagmus: cleanVal(b.nystagmus, 'Ausente'),
            nystagmus_notes: cleanVal(b.nystagmus_notes),
            ptosis: cleanVal(b.ptosis, 'Ausente'),
            cranial_nerves_json,
            facial_symmetry: cleanVal(b.facial_symmetry, 'Simétrica'),
            facial_movement: cleanVal(b.facial_movement, 'Conservados'),
            palate_movement: cleanVal(b.palate_movement, 'Simétrica'),
            swallowing_status: cleanVal(b.swallowing_status, 'Normal'),
            voice_status: cleanVal(b.voice_status, 'Normal'),
            tongue_movement: cleanVal(b.tongue_movement, 'Normal'),

            // 07 Motricidad y reflejos
            spontaneous_movements: cleanVal(b.spontaneous_movements, 'Simétricos'),
            motor_symmetry: cleanVal(b.motor_symmetry, 'Simétrica'),
            muscle_bulk: cleanVal(b.muscle_bulk, 'Normal'),
            motor_deficit: cleanVal(b.motor_deficit, 'Ausente'),
            motor_deficit_extremities: toStr(b.motor_deficit_extremities),
            pronator_drift: cleanVal(b.pronator_drift, 'Ausente'),
            involuntary_movements: toStr(b.involuntary_movements, 'Ninguno'),
            involuntary_movement_other: cleanVal(b.involuntary_movement_other),
            tono_muscular: cleanVal(b.tono_muscular || b.muscle_tone_global, 'Normal'),
            tone_distribution: toStr(b.tone_distribution),
            tone_symmetry: cleanVal(b.tone_symmetry, 'Simétrica'),
            strength_assessment_method: cleanVal(b.strength_assessment_method, 'Escala 0–5'),
            right_upper_strength: cleanVal(b.right_upper_strength, '5'),
            left_upper_strength: cleanVal(b.left_upper_strength, '5'),
            right_lower_strength: cleanVal(b.right_lower_strength, '5'),
            left_lower_strength: cleanVal(b.left_lower_strength, '5'),
            reflexes_matrix_json,
            reflex_symmetry: cleanVal(reflex_symmetry, 'Simétricos'),
            clonus_right: cleanVal(b.clonus_right, 'Ausente'),
            clonus_left: cleanVal(b.clonus_left, 'Ausente'),
            plantar_response_right: cleanVal(b.plantar_response_right, 'Flexora'),
            plantar_response_left: cleanVal(b.plantar_response_left, 'Flexora'),

            // 08 Sensibilidad, marcha, lactante y meníngeos
            light_touch: cleanVal(b.light_touch, 'Normal'),
            pain_sensation: cleanVal(b.pain_sensation, 'Normal'),
            temperature_sensation: cleanVal(b.temperature_sensation, 'Normal'),
            vibration_sensation: cleanVal(b.vibration_sensation, 'Normal'),
            proprioception: cleanVal(b.proprioception, 'Normal'),
            sensory_deficit_distribution: cleanVal(b.sensory_deficit_distribution),
            coordination_overall: cleanVal(b.coordination_overall, 'Normal'),
            finger_to_nose: cleanVal(b.finger_to_nose, 'Normal'),
            rapid_alternating_movements: cleanVal(b.rapid_alternating_movements, 'Normal'),
            heel_to_shin: cleanVal(b.heel_to_shin, 'Normal'),
            truncal_ataxia: cleanVal(b.truncal_ataxia, 'Ausente'),
            balance_status: cleanVal(b.balance_status, 'Normal'),
            romberg_test: cleanVal(b.romberg_test, 'Negativo'),
            single_leg_stance: cleanVal(b.single_leg_stance, 'Normal'),
            gait_status: cleanVal(b.gait_status, 'Normal'),
            gait_abnormality: toStr(b.gait_abnormality),
            heel_walking: cleanVal(b.heel_walking, 'Normal'),
            toe_walking_test: cleanVal(b.toe_walking_test, 'Normal'),
            tandem_gait: cleanVal(b.tandem_gait, 'Normal'),
            gait_other: cleanVal(b.gait_other),
            perimetro_cefalico_cm: cleanVal(b.perimetro_cefalico_cm || b.head_circumference_cm),
            fontanela_anterior: cleanVal(b.fontanela_anterior || b.anterior_fontanelle, 'Normotensa'),
            infant_posture: cleanVal(b.infant_posture, 'Adecuada'),
            infant_antigravity_movement: cleanVal(b.infant_antigravity_movement, 'Presentes y simétricos'),
            head_control: cleanVal(b.head_control, 'Adecuado para edad'),
            primitive_reflexes_json,
            meningeal_signs_assessed: toBoolNum(b.meningeal_signs_assessed),
            neck_stiffness: cleanVal(b.neck_stiffness, 'Ausente'),
            kernig_sign: cleanVal(b.kernig_sign, 'Negativo'),
            brudzinski_sign: cleanVal(b.brudzinski_sign, 'Negativo'),

            // Secciones y JSON contenedor
            seccion_vitals_json,
            seccion_general_json,
            seccion_auscultacion_json,
            seccion_other_json,
            seccion_neuro_global_json,
            seccion_pares_craneales_json,
            seccion_motricidad_json,
            seccion_sensibilidad_json,
            datos_completos_json,

            observacion_general: cleanVal(b.observacion_general || b.general_exam_notes),
            audit_usu_id: String(audit.audit_usu_id || '1'),
            audit_ip: String(audit.audit_ip || '127.0.0.1'),
            audit_dep_id: String(audit.audit_dep_id || '1')
        };

        // Guardar o actualizar registro
        const [existing] = await db.query(
            'SELECT id FROM historia_examen_fisico WHERE registro_solicitud_id = ? ORDER BY id DESC LIMIT 1',
            [targetSolicitudId]
        );

        let finalId;
        if (existing.length > 0) {
            finalId = existing[0].id;
            await db.query(
                'UPDATE historia_examen_fisico SET ? WHERE id = ?',
                [recordData, finalId]
            );
        } else {
            const [ins] = await db.query(
                'INSERT INTO historia_examen_fisico SET ?',
                [recordData]
            );
            finalId = ins.insertId;
        }

        res.status(201).json({
            status: 'success',
            message: 'Examen físico pediátrico registrado y sincronizado exitosamente',
            data: {
                id: finalId,
                paciente_id: targetPacienteId,
                registro_solicitud_id: targetSolicitudId,
                imc,
                superficie_corporal: sc,
                exam_bp_mean,
                glasgow_total: gcs_total,
                capillary_refill_status,
                reflex_symmetry
            }
        });
    } catch (error) {
        console.error('Error al registrar examen físico:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al registrar examen físico', error: error.message });
    }
};

module.exports = {
    getExamenFisicoPorPaciente,
    createExamenFisico
};
