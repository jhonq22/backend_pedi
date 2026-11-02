// controllers/antecedenteController.js
const db = require('../config/db');

/**
 * Función auxiliar para resolver registro_solicitud_id y paciente_id
 */
const resolverSolicitudYPaciente = async (id, connectionOrDb) => {
    if (!id) return { solicitudId: null, pacienteId: null };

    // 1. Verificar si id corresponde directamente a registro_solicitud.id
    const [sol] = await connectionOrDb.query(
        'SELECT id, paciente_id FROM registro_solicitud WHERE id = ?',
        [id]
    );
    if (sol.length > 0) {
        return { solicitudId: sol[0].id, pacienteId: sol[0].paciente_id };
    }

    // 2. Verificar si id corresponde a paciente.id
    const [solPorPac] = await connectionOrDb.query(
        'SELECT id, paciente_id FROM registro_solicitud WHERE paciente_id = ? ORDER BY id DESC LIMIT 1',
        [id]
    );
    if (solPorPac.length > 0) {
        return { solicitudId: solPorPac[0].id, pacienteId: solPorPac[0].paciente_id };
    }

    // 3. Si existe el paciente pero aún no tiene solicitud, crear una inicial
    const [pac] = await connectionOrDb.query('SELECT id FROM paciente WHERE id = ?', [id]);
    if (pac.length > 0) {
        const [ins] = await connectionOrDb.query(
            `INSERT INTO registro_solicitud (
                paciente_id, centro_salud_id, tipo_operacion_id, fecha_solicitud, estatus, observacion_general, audit_usu_id, audit_ip, audit_dep_id
            ) VALUES (?, 4, 1, CURDATE(), 'Pendiente', 'Solicitud inicial generada automáticamente', '1', '127.0.0.1', '1')`,
            [id]
        );
        return { solicitudId: ins.insertId, pacienteId: pac[0].id };
    }

    return { solicitudId: null, pacienteId: null };
};

/**
 * Funciones de limpieza estricta (no perder números 0 o strings vacíos legítimos)
 */
const cleanVal = (val, defaultVal = null) => {
    if (val === undefined || val === null || val === '') return defaultVal;
    return val;
};

const cleanJson = (val) => {
    if (!val) return null;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) && parsed.length > 0 ? JSON.stringify(parsed) : null;
        } catch (e) {
            return null;
        }
    }
    return Array.isArray(val) && val.length > 0 ? JSON.stringify(val) : null;
};

const parseJsonSafe = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        } catch (e) {
            return [];
        }
    }
    return [];
};

/**
 * Obtener antecedentes completos asociados a una solicitud clínica (registro maestro + 5 repetidores)
 */
const getAntecedentesPorPaciente = async (req, res) => {
    try {
        const { id } = req.params;
        const { solicitudId, pacienteId } = await resolverSolicitudYPaciente(id, db);

        if (!solicitudId) {
            return res.status(404).json({ status: 'error', message: 'Solicitud clínica o paciente no encontrado' });
        }

        // 1. Antecedente general / cardiovascular vinculado a registro_solicitud_id
        const [antecedentes] = await db.query(
            `SELECT * FROM historia_antecedente WHERE registro_solicitud_id = ? ORDER BY id DESC LIMIT 1`,
            [solicitudId]
        );

        let antecedente = null;
        if (antecedentes.length > 0) {
            antecedente = { ...antecedentes[0] };
            // Parsear campos JSON para consumo directo en Vue 3
            antecedente.presentacion_cc = parseJsonSafe(antecedente.presentacion_cc_json);
            antecedente.intervenciones_cc = parseJsonSafe(antecedente.intervenciones_cc_json);
            antecedente.estudios_cv_anormales = parseJsonSafe(antecedente.estudios_cv_anormales_json);
            antecedente.fiebre_reumatica_manifestaciones = parseJsonSafe(antecedente.fiebre_reumatica_manifestaciones_json);
            antecedente.fiebre_reumatica_medicamentos = parseJsonSafe(antecedente.fiebre_reumatica_medicamentos_json);
            antecedente.fiebre_reumatica_cirugia = parseJsonSafe(antecedente.fiebre_reumatica_cirugia_json);
            antecedente.sindromes_geneticos = parseJsonSafe(antecedente.sindromes_geneticos_json);
            antecedente.tipos_miopatia = parseJsonSafe(antecedente.tipos_miopatia_json);
        }

        // 2. Diagnósticos no cardiovasculares
        const [diagnosticos_no_cv] = await db.query(
            `SELECT * FROM historia_diagnostico_no_cardiovascular WHERE registro_solicitud_id = ? ORDER BY id ASC`,
            [solicitudId]
        );

        // 3. Cirugías no cardiovasculares
        const [cirugias_no_cv] = await db.query(
            `SELECT * FROM historia_cirugia_no_cardiovascular WHERE registro_solicitud_id = ? ORDER BY id ASC`,
            [solicitudId]
        );

        // 4. Medicamentos habituales
        const [medicamentos] = await db.query(
            `SELECT * FROM historia_medicamento_habitual WHERE registro_solicitud_id = ? ORDER BY id ASC`,
            [solicitudId]
        );

        // 5. Alergias
        const [alergias] = await db.query(
            `SELECT * FROM historia_alergia WHERE registro_solicitud_id = ? ORDER BY id ASC`,
            [solicitudId]
        );

        // 6. Antecedentes familiares cardiovasculares
        const [familiares_raw] = await db.query(
            `SELECT * FROM historia_antecedente_familiar WHERE registro_solicitud_id = ? ORDER BY id ASC`,
            [solicitudId]
        );
        const familiares_cv = familiares_raw.map(fam => ({
            ...fam,
            condiciones: parseJsonSafe(fam.condiciones_json)
        }));

        res.json({
            status: 'success',
            registro_solicitud_id: solicitudId,
            paciente_id: pacienteId || antecedente?.paciente_id || null,
            data: {
                antecedente,
                diagnosticos_no_cv,
                cirugias_no_cv,
                medicamentos,
                alergias,
                familiares_cv
            }
        });
    } catch (error) {
        console.error('Error al obtener antecedentes:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar antecedentes', error: error.message });
    }
};

/**
 * Guardar o actualizar antecedentes asociados a registro_solicitud_id con transacción completa
 */
const saveAntecedentes = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const audit = req.audit || {
            audit_usu_id: req.body.audit_usu_id || '1',
            audit_ip: req.body.audit_ip || '127.0.0.1',
            audit_dep_id: req.body.audit_dep_id || '1'
        };

        const resolved = await resolverSolicitudYPaciente(id || req.body.registro_solicitud_id || req.body.paciente_id, connection);
        const targetSolicitudId = req.body.registro_solicitud_id || resolved.solicitudId;
        const targetPacienteId = req.body.paciente_id || resolved.pacienteId;

        if (!targetSolicitudId) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Registro de solicitud clínica no encontrado' });
        }

        const b = req.body;

        // Limpieza y preparación de datos maestros
        const semanas_gestacion = cleanVal(b.semanas_gestacion);
        const complicaciones_gestacionales = cleanVal(b.complicaciones_gestacionales, 'No');
        const detalle_complicaciones_gestacionales = cleanVal(b.detalle_complicaciones_gestacionales);
        const complicaciones_neonatales = cleanVal(b.complicaciones_neonatales, 'No');
        const detalle_complicaciones_neonatales = cleanVal(b.detalle_complicaciones_neonatales);
        const cardiopatia_congenita = cleanVal(b.cardiopatia_congenita, 'No');
        const edad_diagnostico_cc = cleanVal(b.edad_diagnostico_cc);
        const unidad_edad_diagnostico_cc = cleanVal(b.unidad_edad_diagnostico_cc);
        const forma_presentacion_cc_otro = cleanVal(b.forma_presentacion_cc_otro || b.chd_presenting_finding_other);
        const estudios_cardiacos_anormales = cleanVal(b.estudios_cardiacos_anormales || b.abnormal_cardiac_study_history, 'No');
        const estudio_cardiaco_otro = cleanVal(b.estudio_cardiaco_otro || b.abnormal_cardiac_study_other);
        const hipertension_pulmonar = cleanVal(b.hipertension_pulmonar || b.pulmonary_hypertension_history, 'No');
        const tipo_hipertension_pulmonar = cleanVal(b.tipo_hipertension_pulmonar || b.pulmonary_hypertension_type);
        const falla_medro = cleanVal(b.falla_medro || b.failure_to_thrive_history, 'No');
        const kawasaki = cleanVal(b.kawasaki || b.kawasaki_history, 'No');
        const kawasaki_fecha_inicio = cleanVal(b.kawasaki_fecha_inicio || b.kawasaki_onset_date);
        const kawasaki_edad_valor = cleanVal(b.kawasaki_edad_valor || b.kawasaki_age_value);
        const kawasaki_edad_unidad = cleanVal(b.kawasaki_edad_unidad || b.kawasaki_age_unit);
        const kawasaki_compromiso_coronario = cleanVal(b.kawasaki_compromiso_coronario);
        const kawasaki_tratamiento = cleanVal(b.kawasaki_tratamiento || b.kawasaki_treatment_history);
        const fiebre_reumatica = cleanVal(b.fiebre_reumatica || b.rheumatic_fever_history, 'No');
        const fiebre_reumatica_fecha_inicio = cleanVal(b.fiebre_reumatica_fecha_inicio || b.rheumatic_fever_onset_date);
        const fiebre_reumatica_edad = cleanVal(b.fiebre_reumatica_edad || b.rheumatic_fever_age);
        const fiebre_reumatica_cardiopatia_previa = cleanVal(b.fiebre_reumatica_cardiopatia_previa || b.previous_rheumatic_heart_disease);
        const sindrome_genetico = cleanVal(b.sindrome_genetico || b.genetic_syndrome_history, 'No');
        const sindrome_genetico_otro = cleanVal(b.sindrome_genetico_otro || b.genetic_syndrome_other);
        const miopatia = cleanVal(b.miopatia || b.myopathy_history, 'No');
        const miopatia_otro = cleanVal(b.miopatia_otro || b.myopathy_other);
        const antecedente_medico_no_cv = cleanVal(b.antecedente_medico_no_cv || b.noncardiac_medical_history, 'No');
        const diagnosticos_no_cv_notas = cleanVal(b.diagnosticos_no_cv_notas || b.noncardiac_diagnosis_notes);
        const antecedente_quirurgico_no_cv = cleanVal(b.antecedente_quirurgico_no_cv || b.noncardiac_surgery_history, 'No');
        const medicamentos_actuales = cleanVal(b.medicamentos_actuales || b.current_medications, 'No');
        const estado_alergia = cleanVal(b.estado_alergia || b.allergy_status, 'No conocidas');
        const antecedente_familiar_cv = cleanVal(b.antecedente_familiar_cv || b.family_cv_history, 'No');
        const tiene_hermanos = cleanVal(b.tiene_hermanos || b.siblings_present);
        const nivel_escolaridad = cleanVal(b.nivel_escolaridad || b.education_level);

        // Campos JSON
        const presentacion_cc_json = cleanJson(b.presentacion_cc || b.chd_presenting_findings);
        const intervenciones_cc_json = cleanJson(b.intervenciones_cc || b.chd_prior_interventions);
        const estudios_cv_anormales_json = cleanJson(b.estudios_cv_anormales || b.abnormal_cardiac_studies);
        const fiebre_reumatica_manifestaciones_json = cleanJson(b.fiebre_reumatica_manifestaciones || b.rheumatic_fever_manifestations);
        const fiebre_reumatica_medicamentos_json = cleanJson(b.fiebre_reumatica_medicamentos || b.rheumatic_fever_medications);
        const fiebre_reumatica_cirugia_json = cleanJson(b.fiebre_reumatica_cirugia || b.rheumatic_fever_surgery);
        const sindromes_geneticos_json = cleanJson(b.sindromes_geneticos || b.genetic_syndromes);
        const tipos_miopatia_json = cleanJson(b.tipos_miopatia || b.myopathy_type);

        // Comprobar si ya existe registro maestro para esta solicitud
        const [existente] = await connection.query(
            'SELECT id FROM historia_antecedente WHERE registro_solicitud_id = ? LIMIT 1',
            [targetSolicitudId]
        );

        if (existente.length > 0) {
            await connection.query(
                `UPDATE historia_antecedente SET
                    paciente_id = ?,
                    semanas_gestacion = ?,
                    complicaciones_gestacionales = ?,
                    detalle_complicaciones_gestacionales = ?,
                    complicaciones_neonatales = ?,
                    detalle_complicaciones_neonatales = ?,
                    cardiopatia_congenita = ?,
                    edad_diagnostico_cc = ?,
                    unidad_edad_diagnostico_cc = ?,
                    forma_presentacion_cc_otro = ?,
                    estudios_cardiacos_anormales = ?,
                    estudio_cardiaco_otro = ?,
                    hipertension_pulmonar = ?,
                    tipo_hipertension_pulmonar = ?,
                    falla_medro = ?,
                    kawasaki = ?,
                    kawasaki_fecha_inicio = ?,
                    kawasaki_edad_valor = ?,
                    kawasaki_edad_unidad = ?,
                    kawasaki_compromiso_coronario = ?,
                    kawasaki_tratamiento = ?,
                    fiebre_reumatica = ?,
                    fiebre_reumatica_fecha_inicio = ?,
                    fiebre_reumatica_edad = ?,
                    fiebre_reumatica_cardiopatia_previa = ?,
                    sindrome_genetico = ?,
                    sindrome_genetico_otro = ?,
                    miopatia = ?,
                    miopatia_otro = ?,
                    antecedente_medico_no_cv = ?,
                    diagnosticos_no_cv_notas = ?,
                    antecedente_quirurgico_no_cv = ?,
                    medicamentos_actuales = ?,
                    estado_alergia = ?,
                    antecedente_familiar_cv = ?,
                    tiene_hermanos = ?,
                    nivel_escolaridad = ?,
                    presentacion_cc_json = ?,
                    intervenciones_cc_json = ?,
                    estudios_cv_anormales_json = ?,
                    fiebre_reumatica_manifestaciones_json = ?,
                    fiebre_reumatica_medicamentos_json = ?,
                    fiebre_reumatica_cirugia_json = ?,
                    sindromes_geneticos_json = ?,
                    tipos_miopatia_json = ?,
                    audit_usu_id = ?,
                    audit_ip = ?,
                    audit_dep_id = ?
                 WHERE registro_solicitud_id = ?`,
                [
                    targetPacienteId,
                    semanas_gestacion,
                    complicaciones_gestacionales,
                    detalle_complicaciones_gestacionales,
                    complicaciones_neonatales,
                    detalle_complicaciones_neonatales,
                    cardiopatia_congenita,
                    edad_diagnostico_cc,
                    unidad_edad_diagnostico_cc,
                    forma_presentacion_cc_otro,
                    estudios_cardiacos_anormales,
                    estudio_cardiaco_otro,
                    hipertension_pulmonar,
                    tipo_hipertension_pulmonar,
                    falla_medro,
                    kawasaki,
                    kawasaki_fecha_inicio,
                    kawasaki_edad_valor,
                    kawasaki_edad_unidad,
                    kawasaki_compromiso_coronario,
                    kawasaki_tratamiento,
                    fiebre_reumatica,
                    fiebre_reumatica_fecha_inicio,
                    fiebre_reumatica_edad,
                    fiebre_reumatica_cardiopatia_previa,
                    sindrome_genetico,
                    sindrome_genetico_otro,
                    miopatia,
                    miopatia_otro,
                    antecedente_medico_no_cv,
                    diagnosticos_no_cv_notas,
                    antecedente_quirurgico_no_cv,
                    medicamentos_actuales,
                    estado_alergia,
                    antecedente_familiar_cv,
                    tiene_hermanos,
                    nivel_escolaridad,
                    presentacion_cc_json,
                    intervenciones_cc_json,
                    estudios_cv_anormales_json,
                    fiebre_reumatica_manifestaciones_json,
                    fiebre_reumatica_medicamentos_json,
                    fiebre_reumatica_cirugia_json,
                    sindromes_geneticos_json,
                    tipos_miopatia_json,
                    audit.audit_usu_id,
                    audit.audit_ip,
                    audit.audit_dep_id,
                    targetSolicitudId
                ]
            );
        } else {
            await connection.query(
                `INSERT INTO historia_antecedente (
                    paciente_id,
                    registro_solicitud_id,
                    semanas_gestacion,
                    complicaciones_gestacionales,
                    detalle_complicaciones_gestacionales,
                    complicaciones_neonatales,
                    detalle_complicaciones_neonatales,
                    cardiopatia_congenita,
                    edad_diagnostico_cc,
                    unidad_edad_diagnostico_cc,
                    forma_presentacion_cc_otro,
                    estudios_cardiacos_anormales,
                    estudio_cardiaco_otro,
                    hipertension_pulmonar,
                    tipo_hipertension_pulmonar,
                    falla_medro,
                    kawasaki,
                    kawasaki_fecha_inicio,
                    kawasaki_edad_valor,
                    kawasaki_edad_unidad,
                    kawasaki_compromiso_coronario,
                    kawasaki_tratamiento,
                    fiebre_reumatica,
                    fiebre_reumatica_fecha_inicio,
                    fiebre_reumatica_edad,
                    fiebre_reumatica_cardiopatia_previa,
                    sindrome_genetico,
                    sindrome_genetico_otro,
                    miopatia,
                    miopatia_otro,
                    antecedente_medico_no_cv,
                    diagnosticos_no_cv_notas,
                    antecedente_quirurgico_no_cv,
                    medicamentos_actuales,
                    estado_alergia,
                    antecedente_familiar_cv,
                    tiene_hermanos,
                    nivel_escolaridad,
                    presentacion_cc_json,
                    intervenciones_cc_json,
                    estudios_cv_anormales_json,
                    fiebre_reumatica_manifestaciones_json,
                    fiebre_reumatica_medicamentos_json,
                    fiebre_reumatica_cirugia_json,
                    sindromes_geneticos_json,
                    tipos_miopatia_json,
                    audit_usu_id,
                    audit_ip,
                    audit_dep_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    targetPacienteId,
                    targetSolicitudId,
                    semanas_gestacion,
                    complicaciones_gestacionales,
                    detalle_complicaciones_gestacionales,
                    complicaciones_neonatales,
                    detalle_complicaciones_neonatales,
                    cardiopatia_congenita,
                    edad_diagnostico_cc,
                    unidad_edad_diagnostico_cc,
                    forma_presentacion_cc_otro,
                    estudios_cardiacos_anormales,
                    estudio_cardiaco_otro,
                    hipertension_pulmonar,
                    tipo_hipertension_pulmonar,
                    falla_medro,
                    kawasaki,
                    kawasaki_fecha_inicio,
                    kawasaki_edad_valor,
                    kawasaki_edad_unidad,
                    kawasaki_compromiso_coronario,
                    kawasaki_tratamiento,
                    fiebre_reumatica,
                    fiebre_reumatica_fecha_inicio,
                    fiebre_reumatica_edad,
                    fiebre_reumatica_cardiopatia_previa,
                    sindrome_genetico,
                    sindrome_genetico_otro,
                    miopatia,
                    miopatia_otro,
                    antecedente_medico_no_cv,
                    diagnosticos_no_cv_notas,
                    antecedente_quirurgico_no_cv,
                    medicamentos_actuales,
                    estado_alergia,
                    antecedente_familiar_cv,
                    tiene_hermanos,
                    nivel_escolaridad,
                    presentacion_cc_json,
                    intervenciones_cc_json,
                    estudios_cv_anormales_json,
                    fiebre_reumatica_manifestaciones_json,
                    fiebre_reumatica_medicamentos_json,
                    fiebre_reumatica_cirugia_json,
                    sindromes_geneticos_json,
                    tipos_miopatia_json,
                    audit.audit_usu_id,
                    audit.audit_ip,
                    audit.audit_dep_id
                ]
            );
        }

        // 1. Sincronizar historia_diagnostico_no_cardiovascular
        await connection.query('DELETE FROM historia_diagnostico_no_cardiovascular WHERE registro_solicitud_id = ?', [targetSolicitudId]);
        const diagnosticos_no_cv = Array.isArray(b.diagnosticos_no_cv) ? b.diagnosticos_no_cv : [];
        for (const diag of diagnosticos_no_cv) {
            const diagName = cleanVal(diag.diagnostico || diag.noncardiac_diagnosis);
            if (diagName) {
                await connection.query(
                    `INSERT INTO historia_diagnostico_no_cardiovascular (
                        paciente_id,
                        registro_solicitud_id,
                        categoria_id,
                        categoria_nombre,
                        diagnostico,
                        observacion,
                        audit_usu_id,
                        audit_ip,
                        audit_dep_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        targetPacienteId,
                        targetSolicitudId,
                        cleanVal(diag.categoria_id),
                        cleanVal(diag.categoria_nombre || diag.noncardiac_category),
                        diagName.substring(0, 180),
                        cleanVal(diag.observacion || diag.noncardiac_diagnosis_notes),
                        audit.audit_usu_id,
                        audit.audit_ip,
                        audit.audit_dep_id
                    ]
                );
            }
        }

        // 2. Sincronizar historia_cirugia_no_cardiovascular
        await connection.query('DELETE FROM historia_cirugia_no_cardiovascular WHERE registro_solicitud_id = ?', [targetSolicitudId]);
        const cirugias_no_cv = Array.isArray(b.cirugias_no_cv) ? b.cirugias_no_cv : [];
        for (const cir of cirugias_no_cv) {
            const procNombre = cleanVal(cir.procedimiento_nombre || cir.noncardiac_procedure_type);
            if (procNombre) {
                await connection.query(
                    `INSERT INTO historia_cirugia_no_cardiovascular (
                        paciente_id,
                        registro_solicitud_id,
                        procedimiento_id,
                        procedimiento_nombre,
                        procedimiento_otro,
                        fecha_procedimiento,
                        observacion,
                        audit_usu_id,
                        audit_ip,
                        audit_dep_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        targetPacienteId,
                        targetSolicitudId,
                        cleanVal(cir.procedimiento_id),
                        procNombre,
                        cleanVal(cir.procedimiento_otro || cir.noncardiac_procedure_other),
                        cleanVal(cir.fecha_procedimiento || cir.noncardiac_procedure_date),
                        cleanVal(cir.observacion || cir.noncardiac_procedure_notes),
                        audit.audit_usu_id,
                        audit.audit_ip,
                        audit.audit_dep_id
                    ]
                );
            }
        }

        // 3. Sincronizar historia_medicamento_habitual (maxlength 180 chars)
        await connection.query('DELETE FROM historia_medicamento_habitual WHERE registro_solicitud_id = ?', [targetSolicitudId]);
        const medicamentos = Array.isArray(b.medicamentos) ? b.medicamentos : [];
        for (const med of medicamentos) {
            const medNombre = cleanVal(med.nombre_medicamento || med.medication_name);
            if (medNombre) {
                await connection.query(
                    `INSERT INTO historia_medicamento_habitual (
                        paciente_id,
                        registro_solicitud_id,
                        nombre_medicamento,
                        dosis,
                        concentracion,
                        unidad_id,
                        unidad_nombre,
                        frecuencia_id,
                        frecuencia_nombre,
                        via_administracion_id,
                        via_nombre,
                        observacion,
                        audit_usu_id,
                        audit_ip,
                        audit_dep_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        targetPacienteId,
                        targetSolicitudId,
                        medNombre.substring(0, 180),
                        cleanVal(med.dosis || med.medication_dose),
                        cleanVal(med.concentracion || med.medication_concentration),
                        cleanVal(med.unidad_id),
                        cleanVal(med.unidad_nombre || med.medication_dose_unit),
                        cleanVal(med.frecuencia_id),
                        cleanVal(med.frecuencia_nombre || med.medication_frequency),
                        cleanVal(med.via_administracion_id),
                        cleanVal(med.via_nombre || med.medication_route),
                        cleanVal(med.observacion || med.medication_notes),
                        audit.audit_usu_id,
                        audit.audit_ip,
                        audit.audit_dep_id
                    ]
                );
            }
        }

        // 4. Sincronizar historia_alergia
        await connection.query('DELETE FROM historia_alergia WHERE registro_solicitud_id = ?', [targetSolicitudId]);
        const alergias = Array.isArray(b.alergias) ? b.alergias : [];
        for (const al of alergias) {
            const alergeno = cleanVal(al.alergeno || al.allergen_name);
            if (alergeno) {
                const sevNombre = cleanVal(al.severidad_nombre || al.severidad || al.allergy_severity);
                await connection.query(
                    `INSERT INTO historia_alergia (
                        paciente_id,
                        registro_solicitud_id,
                        tipo_alergia_id,
                        tipo_alergia_nombre,
                        alergeno,
                        reaccion,
                        severidad,
                        severidad_id,
                        severidad_nombre,
                        observacion,
                        audit_usu_id,
                        audit_ip,
                        audit_dep_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        targetPacienteId,
                        targetSolicitudId,
                        cleanVal(al.tipo_alergia_id),
                        cleanVal(al.tipo_alergia_nombre || al.allergy_type),
                        alergeno.substring(0, 150),
                        cleanVal(al.reaccion || al.allergic_reaction_description),
                        sevNombre,
                        cleanVal(al.severidad_id),
                        sevNombre,
                        cleanVal(al.observacion || al.allergy_notes),
                        audit.audit_usu_id,
                        audit.audit_ip,
                        audit.audit_dep_id
                    ]
                );
            }
        }

        // 5. Sincronizar historia_antecedente_familiar
        await connection.query('DELETE FROM historia_antecedente_familiar WHERE registro_solicitud_id = ?', [targetSolicitudId]);
        const familiares_cv = Array.isArray(b.familiares_cv) ? b.familiares_cv : [];
        for (const fam of familiares_cv) {
            const parNombre = cleanVal(fam.parentesco_nombre || fam.family_relationship);
            if (parNombre) {
                const condJson = cleanJson(fam.condiciones || fam.family_condition || fam.condiciones_json);
                await connection.query(
                    `INSERT INTO historia_antecedente_familiar (
                        paciente_id,
                        registro_solicitud_id,
                        parentesco_id,
                        parentesco_nombre,
                        condiciones_json,
                        edad_diagnostico,
                        edad_muerte_subita,
                        observacion,
                        audit_usu_id,
                        audit_ip,
                        audit_dep_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        targetPacienteId,
                        targetSolicitudId,
                        cleanVal(fam.parentesco_id),
                        parNombre,
                        condJson,
                        cleanVal(fam.edad_diagnostico || fam.family_age_at_diagnosis),
                        cleanVal(fam.edad_muerte_subita || fam.family_sudden_death_age),
                        cleanVal(fam.observacion || fam.family_history_notes),
                        audit.audit_usu_id,
                        audit.audit_ip,
                        audit.audit_dep_id
                    ]
                );
            }
        }

        await connection.commit();

        res.json({
            status: 'success',
            registro_solicitud_id: targetSolicitudId,
            paciente_id: targetPacienteId,
            message: 'Antecedentes clínicos y sus 5 tablas repetibles guardados exitosamente'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al guardar antecedentes:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al guardar antecedentes', error: error.message });
    } finally {
        connection.release();
    }
};

module.exports = {
    getAntecedentesPorPaciente,
    saveAntecedentes
};
