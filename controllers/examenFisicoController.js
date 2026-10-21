// controllers/examenFisicoController.js
const db = require('../config/db');

/**
 * Función auxiliar para resolver el registro_solicitud_id
 */
const resolverSolicitudId = async (id, connectionOrDb) => {
    if (!id) return null;
    const [sol] = await connectionOrDb.query('SELECT id FROM registro_solicitud WHERE id = ?', [id]);
    if (sol.length > 0) return sol[0].id;

    const [solPorPac] = await connectionOrDb.query(
        'SELECT id FROM registro_solicitud WHERE paciente_id = ? ORDER BY id DESC LIMIT 1',
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

/**
 * Obtener el examen físico vinculado a una solicitud clínica
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
                    rs.paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica
             FROM historia_examen_fisico ef
             LEFT JOIN registro_solicitud rs ON ef.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE ef.registro_solicitud_id = ? 
             ORDER BY ef.id DESC`,
            [solicitudId]
        );

        const dataParsed = rows.map(r => ({
            ...r,
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
 * Registrar o actualizar examen físico pediátrico casado a registro_solicitud_id
 */
const createExamenFisico = async (req, res) => {
    try {
        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        const targetSolicitudId = req.body.registro_solicitud_id || await resolverSolicitudId(id, db);
        if (!targetSolicitudId) {
            return res.status(404).json({ status: 'error', message: 'Registro de solicitud clínica no encontrado' });
        }

        const b = req.body;

        const peso_kg = b.peso_kg ?? b.weight_kg;
        const talla_cm = b.talla_cm ?? b.height_cm;
        const frecuencia_cardiaca = b.frecuencia_cardiaca ?? b.heart_rate;
        const frecuencia_respiratoria = b.frecuencia_respiratoria ?? b.respiratory_rate;

        if (!peso_kg || !talla_cm || !frecuencia_cardiaca || !frecuencia_respiratoria) {
            return res.status(400).json({
                status: 'error',
                message: 'Peso, talla, frecuencia cardíaca y frecuencia respiratoria son obligatorios en el examen físico'
            });
        }

        // Fórmulas automáticas de antropometría
        const { imc, sc } = calcularAntropometria(Number(peso_kg), Number(talla_cm));

        // Llenado capilar automático
        const llenado_capilar_segundos = Number(b.llenado_capilar_segundos ?? b.capillary_refill_seconds ?? 2);
        let capillary_refill_status = b.capillary_refill_status;
        if (!capillary_refill_status) {
            capillary_refill_status = llenado_capilar_segundos <= 2 ? 'Normal' : 'Retardado';
        }

        // Glasgow Total automático
        let gcs_total = b.glasgow_total ?? b.gcs_total;
        const gcs_eye = b.gcs_eye ?? b.glasgow_ocular;
        const gcs_verbal = b.gcs_verbal ?? b.glasgow_verbal;
        const gcs_motor = b.gcs_motor ?? b.glasgow_motor;
        if (gcs_eye && gcs_verbal && gcs_motor) {
            gcs_total = Number(gcs_eye) + Number(gcs_verbal) + Number(gcs_motor);
        }

        // Simetría de reflejos
        let reflex_symmetry = b.reflex_symmetry;
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
        const toStr = (val) => Array.isArray(val) ? val.join(', ') : (val || null);

        const recordData = {
            registro_solicitud_id: targetSolicitudId,

            // 01 Antropometría y Signos Vitales
            peso_kg: Number(peso_kg),
            percentil_peso: b.percentil_peso || b.weight_percentile || null,
            talla_cm: Number(talla_cm),
            percentil_talla: b.percentil_talla || b.height_percentile || null,
            imc: imc || b.imc || null,
            superficie_corporal: sc || b.superficie_corporal || b.bsa || null,
            frecuencia_cardiaca: Number(frecuencia_cardiaca),
            frecuencia_respiratoria: Number(frecuencia_respiratoria),
            saturacion_oxigeno: Number(b.saturacion_oxigeno ?? b.oxygen_saturation ?? 98),
            soporte_oxigeno: b.soporte_oxigeno || b.oxygen_support || 'Aire ambiente',
            flujo_oxigeno_litros: b.flujo_oxigeno_litros || b.oxygen_flow || null,
            presion_sistolica: Number(b.presion_sistolica ?? b.bp_systolic ?? 90),
            presion_diastolica: Number(b.presion_diastolica ?? b.bp_diastolic ?? 60),
            extremidad_presion: b.extremidad_presion || b.bp_extremity || 'Brazo derecho',
            percentil_presion: b.percentil_presion || b.bp_percentile || null,

            // 02 Estado general y tórax
            estado_perfusion: b.estado_perfusion || b.perfusion_status || 'Bien perfundido',
            hallazgo_piel: toStr(b.hallazgo_piel || b.skin_findings || 'Normal'),
            general_exam_notes: b.general_exam_notes || null,
            inspeccion_torax: toStr(b.inspeccion_torax || b.anterior_chest_inspection || 'Normal'),
            cicatriz_esternotomia: b.cicatriz_esternotomia ? 1 : 0,
            cicatriz_toracotomia: b.cicatriz_toracotomia ? 1 : 0,
            palpacion_precordial: toStr(b.palpacion_precordial || b.precordial_palpation || 'Normal'),
            fremito_presente: (b.fremito_presente === 1 || b.fremito_presente === 'Sí' || b.thrill_present === true) ? 1 : 0,
            fremito_localizacion: b.fremito_localizacion || b.thrill_location || null,
            latido_sistolico: b.latido_sistolico || b.pmi_type || 'Normal',
            pmi_side: b.pmi_side || null,
            pmi_intercostal_space: b.pmi_intercostal_space || null,
            pmi_reference_line: b.pmi_reference_line || null,
            pmi_notes: b.pmi_notes || null,
            precordial_palpation_notes: b.precordial_palpation_notes || null,

            // 03 Auscultación cardiopulmonar
            auscultacion_pulmonar: toStr(b.auscultacion_pulmonar || b.lung_auscultation || 'Murmullo vesicular conservado'),
            lung_findings_side: b.lung_findings_side || null,
            trabajo_respiratorio: toStr(b.trabajo_respiratorio || b.respiratory_effort || 'Normal'),
            respiratory_exam_notes: b.respiratory_exam_notes || null,
            ruidos_cardiacos: toStr(b.ruidos_cardiacos || b.heart_sounds || 'R1 y R2 presentes normofonéticos'),
            s1_tipo: toStr(b.s1_tipo || b.s1_type || 'Único'),
            s1_soplo_presente: b.s1_soplo_presente || b.murmur_s1_present || 'No',
            s1_soplo_fase: b.s1_soplo_fase || b.murmur_s1_phase || null,
            s1_soplo_localizacion: toStr(b.s1_soplo_localizacion || b.murmur_s1_location || null),
            s1_soplo_grado: b.s1_soplo_grado || b.murmur_s1_grade || null,
            murmur_s1_pitch: b.murmur_s1_pitch || null,
            murmur_s1_character: toStr(b.murmur_s1_character || null),
            murmur_s1_radiation: toStr(b.murmur_s1_radiation || null),
            murmur_s1_radiation_other: b.murmur_s1_radiation_other || null,
            s2_tipo: toStr(b.s2_tipo || b.s2_type || 'Único'),
            s2_soplo_presente: b.s2_soplo_presente || b.murmur_s2_present || 'No',
            s2_soplo_fase: b.s2_soplo_fase || b.murmur_s2_phase || null,
            s2_soplo_localizacion: toStr(b.s2_soplo_localizacion || b.murmur_s2_location || null),
            s2_soplo_grado: b.s2_soplo_grado || b.murmur_s2_grade || null,
            murmur_s2_pitch: b.murmur_s2_pitch || null,
            murmur_s2_character: toStr(b.murmur_s2_character || null),
            murmur_s2_radiation: toStr(b.murmur_s2_radiation || null),
            murmur_s2_radiation_other: b.murmur_s2_radiation_other || null,

            // 04 Abdomen, extremidades y genitales
            inspeccion_abdominal: b.inspeccion_abdominal || b.abdominal_inspection || 'Plano',
            auscultacion_abdominal: b.auscultacion_abdominal || b.abdominal_auscultation || 'Ruidos hidroaéreos presentes',
            abdominal_palpation: toStr(b.abdominal_palpation || 'Normal'),
            hepatomegalia: (b.hepatomegalia === 1 || b.hepatomegaly_present === true) ? 1 : 0,
            borde_hepatico_cm: b.borde_hepatico_cm || b.liver_edge_cm || null,
            esplenomegalia: (b.esplenomegalia === 1 || b.splenomegaly_present === true) ? 1 : 0,
            abdominal_exam_notes: b.abdominal_exam_notes || null,
            extremity_appearance: toStr(b.extremity_appearance || 'Normal'),
            edema_location: toStr(b.edema_location || null),
            edema_grade: b.edema_grade || null,
            extremity_notes: b.extremity_notes || null,
            llenado_capilar_segundos: llenado_capilar_segundos,
            capillary_refill_status: capillary_refill_status,
            pulso_amplitud: b.pulso_amplitud || b.pulse_amplitude || '2+ normal',
            pulso_localizacion: b.pulso_localizacion || b.pulse_location || 'Radial',
            pulse_side: b.pulse_side || null,
            pulse_symmetry: b.pulse_symmetry || 'Simétricos',
            pulse_symmetry_notes: b.pulse_symmetry_notes || null,
            external_genital_exam: b.external_genital_exam || 'Normal',
            external_genital_exam_notes: b.external_genital_exam_notes || null,

            // 05 Neurología global y mental
            neurologic_exam_overall: b.neurologic_exam_overall || 'Normal',
            neurologic_exam_age_appropriate: b.neurologic_exam_age_appropriate || 'Sí',
            focal_neurologic_deficit: b.focal_neurologic_deficit || 'Ausente',
            focal_neurologic_deficit_notes: b.focal_neurologic_deficit_notes || null,
            nivel_conciencia: b.nivel_conciencia || b.consciousness_level || 'Alerta',
            response_to_environment: b.response_to_environment || 'Adecuada para la edad',
            behavior_status: b.behavior_status || 'Apropiada',
            behavior_notes: b.behavior_notes || null,
            gcs_required: (b.gcs_required || gcs_total) ? 1 : 0,
            glasgow_total: gcs_total || 15,
            gcs_eye: gcs_eye ? Number(gcs_eye) : 4,
            gcs_verbal: gcs_verbal ? Number(gcs_verbal) : 5,
            gcs_motor: gcs_motor ? Number(gcs_motor) : 6,
            mental_status: b.mental_status || 'Apropiado para edad',
            orientation_person: b.orientation_person || null,
            orientation_place: b.orientation_place || null,
            orientation_time: b.orientation_time || null,
            attention_status: b.attention_status || null,
            memory_status: b.memory_status || null,
            language_status: b.language_status || 'Adecuado para edad',
            mental_status_notes: b.mental_status_notes || null,
            pupilas_simetria: b.pupilas_simetria || b.pupil_symmetry || 'Isocóricas',
            right_pupil_mm: b.right_pupil_mm || null,
            left_pupil_mm: b.left_pupil_mm || null,
            right_pupil_reactivity: b.right_pupil_reactivity || 'Reactiva',
            left_pupil_reactivity: b.left_pupil_reactivity || 'Reactiva',

            // 06 Pares craneales
            extraocular_movements: b.extraocular_movements || 'Conservados',
            gaze_alignment: b.gaze_alignment || 'Normal',
            nystagmus: b.nystagmus || 'Ausente',
            nystagmus_notes: b.nystagmus_notes || null,
            ptosis: b.ptosis || 'Ausente',
            cranial_nerves_json: cranial_nerves_json,
            facial_symmetry: b.facial_symmetry || 'Simétrica',
            facial_movement: b.facial_movement || 'Conservados',
            palate_movement: b.palate_movement || 'Simétrica',
            swallowing_status: b.swallowing_status || 'Normal',
            voice_status: b.voice_status || 'Normal',
            tongue_movement: b.tongue_movement || 'Normal',

            // 07 Motricidad y reflejos
            spontaneous_movements: b.spontaneous_movements || 'Simétricos',
            motor_symmetry: b.motor_symmetry || 'Simétrica',
            muscle_bulk: b.muscle_bulk || 'Normal',
            motor_deficit: b.motor_deficit || 'Ausente',
            motor_deficit_extremities: toStr(b.motor_deficit_extremities || null),
            pronator_drift: b.pronator_drift || 'Ausente',
            involuntary_movements: toStr(b.involuntary_movements || 'Ninguno'),
            involuntary_movement_other: b.involuntary_movement_other || null,
            tono_muscular: b.tono_muscular || b.muscle_tone_global || 'Normal',
            tone_distribution: toStr(b.tone_distribution || null),
            tone_symmetry: b.tone_symmetry || 'Simétrica',
            strength_assessment_method: b.strength_assessment_method || 'Escala 0–5',
            right_upper_strength: b.right_upper_strength || '5',
            left_upper_strength: b.left_upper_strength || '5',
            right_lower_strength: b.right_lower_strength || '5',
            left_lower_strength: b.left_lower_strength || '5',
            reflexes_matrix_json: reflexes_matrix_json,
            reflex_symmetry: reflex_symmetry || 'Simétricos',
            clonus_right: b.clonus_right || 'Ausente',
            clonus_left: b.clonus_left || 'Ausente',
            plantar_response_right: b.plantar_response_right || 'Flexora',
            plantar_response_left: b.plantar_response_left || 'Flexora',

            // 08 Sensibilidad, marcha, lactante y meníngeos
            light_touch: b.light_touch || 'Normal',
            pain_sensation: b.pain_sensation || 'Normal',
            temperature_sensation: b.temperature_sensation || 'Normal',
            vibration_sensation: b.vibration_sensation || 'Normal',
            proprioception: b.proprioception || 'Normal',
            sensory_deficit_distribution: b.sensory_deficit_distribution || null,
            coordination_overall: b.coordination_overall || 'Normal',
            finger_to_nose: b.finger_to_nose || 'Normal',
            rapid_alternating_movements: b.rapid_alternating_movements || 'Normal',
            heel_to_shin: b.heel_to_shin || 'Normal',
            truncal_ataxia: b.truncal_ataxia || 'Ausente',
            balance_status: b.balance_status || 'Normal',
            romberg_test: b.romberg_test || 'Negativo',
            single_leg_stance: b.single_leg_stance || 'Normal',
            gait_status: b.gait_status || 'Normal',
            gait_abnormality: toStr(b.gait_abnormality || null),
            heel_walking: b.heel_walking || 'Normal',
            toe_walking_test: b.toe_walking_test || 'Normal',
            tandem_gait: b.tandem_gait || 'Normal',
            gait_other: b.gait_other || null,
            perimetro_cefalico_cm: b.perimetro_cefalico_cm || b.head_circumference_cm || null,
            fontanela_anterior: b.fontanela_anterior || b.anterior_fontanelle || 'Normotensa',
            infant_posture: b.infant_posture || 'Adecuada',
            infant_antigravity_movement: b.infant_antigravity_movement || 'Presentes y simétricos',
            head_control: b.head_control || 'Adecuado para edad',
            primitive_reflexes_json: primitive_reflexes_json,
            meningeal_signs_assessed: b.meningeal_signs_assessed ? 1 : 0,
            neck_stiffness: b.neck_stiffness || 'Ausente',
            kernig_sign: b.kernig_sign || 'Negativo',
            brudzinski_sign: b.brudzinski_sign || 'Negativo',

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

            observacion_general: b.observacion_general || b.general_exam_notes || null,
            audit_usu_id: audit.audit_usu_id,
            audit_ip: audit.audit_ip,
            audit_dep_id: audit.audit_dep_id
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
                registro_solicitud_id: targetSolicitudId,
                imc,
                superficie_corporal: sc,
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
