// backend/controllers/cirugiaController.js
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

const elapsedMinutes = (start, end) => {
    if (!start || !end) return null;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e) || e < s) return null;
    return Math.round((e - s) / 60000);
};

const sumPeriods = (periods) => {
    if (!Array.isArray(periods) || periods.length === 0) return 0;
    let total = 0;
    let anyValid = false;
    for (const p of periods) {
        const m = elapsedMinutes(p.start, p.end);
        if (m !== null) {
            total += m;
            anyValid = true;
        }
    }
    return anyValid ? total : null;
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
             VALUES (?, 4, 1, CURDATE(), 'Pendiente', 'Solicitud inicial generada automáticamente para cirugía cardiovascular', '1', '127.0.0.1', '1')`,
            [solicitudIdOrPacienteId]
        );
        return ins.insertId;
    }
    return null;
};

/**
 * Reconstruye el objeto de respuesta unificado combinando columnas SQL y objetos JSON
 */
const formatCirugiaResponse = (row) => {
    const surgeryFields = safeJsonParse(row.surgery_fields_json, {});
    const anesthesiaFields = safeJsonParse(row.anesthesia_fields_json, {});
    const perfusionFields = safeJsonParse(row.perfusion_fields_json, {});
    const signatures = safeJsonParse(row.signatures_json, { surg: null, anes: null, perf: null });
    const datosCompletos = safeJsonParse(row.datos_completos_json, {});

    const diagnoses = safeJsonParse(row.diagnoses_json, []);
    const procedures = safeJsonParse(row.procedures_json, []);
    const surgical_complications = safeJsonParse(row.surgical_complications_json, []);
    const anesthesia_complications = safeJsonParse(row.anesthesia_complications_json, []);
    const cannulations = safeJsonParse(row.cannulations_json, []);
    const cpb_periods = safeJsonParse(row.cpb_periods_json, []);
    const clamp_periods = safeJsonParse(row.clamp_periods_json, []);
    const perfusion_complications = safeJsonParse(row.perfusion_complications_json, []);

    // Formatear fecha para evitar desfase de zona horaria
    const fechaCirugiaStr = row.fecha_cirugia 
        ? (typeof row.fecha_cirugia === 'string' ? row.fecha_cirugia.split('T')[0] : new Date(row.fecha_cirugia).toISOString().split('T')[0])
        : '';

    return {
        id: row.id,
        registro_solicitud_id: row.registro_solicitud_id,
        paciente_id: row.paciente_id,
        paciente_nombre: row.paciente_nombre,
        numero_historia_clinica: row.numero_historia_clinica,
        hospitalizacion_id: row.hospitalizacion_id,
        
        // Identificadores
        surgery_id: row.surgery_uuid || `SX-${row.id}`,
        surgery_uuid: row.surgery_uuid,
        operative_note_id: row.operative_note_uuid || `NOTE-${row.id}`,
        operative_note_uuid: row.operative_note_uuid,
        anesthesia_record_id: row.anesthesia_record_uuid || `ANES-${row.id}`,
        anesthesia_record_uuid: row.anesthesia_record_uuid,
        perfusion_record_id: row.perfusion_record_uuid || `PERF-${row.id}`,
        perfusion_record_uuid: row.perfusion_record_uuid,

        // Fechas y Tiempos de Cirugía
        fecha_cirugia: fechaCirugiaStr,
        surgery_date: fechaCirugiaStr,
        surgery_start_datetime: row.inicio_cirugia_datetime || surgeryFields.surgery_start_datetime || '',
        surgery_end_datetime: row.fin_cirugia_datetime || surgeryFields.surgery_end_datetime || '',
        or_exit_datetime: row.salida_quirofano_datetime || surgeryFields.or_exit_datetime || '',
        surgery_duration_min: row.duracion_cirugia_min,
        duracion_cirugia_min: row.duracion_cirugia_min,
        age_at_surgery_days: row.edad_dias_cirugia,
        age_at_surgery_months: row.edad_meses_cirugia,
        weight_at_surgery_kg: row.peso_cirugia_kg !== null ? Number(row.peso_cirugia_kg) : null,
        height_at_surgery_cm: row.talla_cirugia_cm !== null ? Number(row.talla_cirugia_cm) : null,
        operating_room: row.quirofano || surgeryFields.operating_room || '',

        // Estrategia y Prioridad
        surgery_priority: row.prioridad_cirugia || 'Electiva',
        surgery_strategy: row.estrategia_quirurgica || 'Corrección completa definitiva',
        first_cardiac_surgery: row.primera_cirugia_cv === 1,
        cardiac_surgery_number: row.numero_cirugia_cv || 1,
        redo_surgery: row.reoperacion_cardiaca === 1,
        planned_reoperation: row.reoperacion_planificada === 1,
        surgery_due_to_complication: row.cirugia_por_complicacion === 1,
        parent_surgery_id: row.cirugia_previa_relacionada_id,
        parent_complication_id: row.complicacion_anterior_relacionada_id,

        // Equipo y Abordaje
        cirujano_principal: row.cirujano_principal,
        primary_surgeon_id: row.cirujano_principal,
        cirujanos_ayudantes: safeJsonParse(row.cirujanos_ayudantes, []),
        assistant_surgeon_ids: safeJsonParse(row.cirujanos_ayudantes, []),
        surgical_resident_ids: safeJsonParse(row.residentes_participantes, []),
        scrub_nurse_id: row.instrumentista || '',
        instrumentista: row.instrumentista || '',
        surgical_approach: row.abordaje_quirurgico || 'Esternotomía media',
        surgical_approach_other: row.abordaje_quirurgico_otro || '',
        redo_sternotomy: row.reesternotomia === 1,

        // Nota Operatoria y Diagnósticos
        diagnostico_preoperatorio: row.diagnostico_preoperatorio || '',
        diagnostico_postoperatorio: row.diagnostico_postoperatorio || '',
        cirugia_propuesta: row.cirugia_propuesta || '',
        cirugia_realizada: row.cirugia_realizada || '',
        operative_procedure_summary: row.resumen_procedimientos || row.cirugia_realizada || '',
        operative_findings_narrative: row.hallazgos_operatorios || '',
        hallazgos_operatorios: row.hallazgos_operatorios || '',
        residual_lesion_present: row.lesion_residual || 'No',
        residual_lesion_description: row.lesion_residual_descripcion || '',
        postrepair_echo_result: row.eco_postreparacion_resultado || '',
        postoperative_rhythm: row.ritmo_postoperatorio || 'Sinusal',
        chest_status: row.estado_torax || 'Cerrado completamente',
        destination_after_or: row.destino_postoperatorio || 'UCIP Cardiovascular',
        complication_present: row.complicacion_presente === 1,
        specimen_obtained: row.muestra_quirurgica_obtenida === 1,
        specimen_type: row.muestra_quirurgica_tipo || '',
        pathology_requested: row.enviado_anatomia_patologica === 1,

        // Registro Anestésico Agrupado
        anestesiologo: row.anestesiologo || '',
        tiempo_anestesia_minutos: row.duracion_anestesia_min || row.tiempo_anestesia_minutos,
        anesthesia: {
            anesthesia_record_id: row.anesthesia_record_uuid || `ANES-${row.id}`,
            anesthesiologist_id: row.anestesiologo || '',
            anesthesia_assistant_ids: safeJsonParse(row.otros_anestesiologos, []),
            anesthesia_start_datetime: row.inicio_anestesia_datetime || anesthesiaFields.anesthesia_start_datetime || '',
            anesthesia_end_datetime: row.fin_anestesia_datetime || anesthesiaFields.anesthesia_end_datetime || '',
            anesthesia_duration_min: row.duracion_anestesia_min,
            asa_class: row.clasificacion_asa || 'ASA IV',
            asa_emergency: row.asa_emergencia === 1,
            preanesthesia_status: row.estado_preanestesico || '',
            preop_oxygen_support: row.soporte_oxigeno_previo || 'Aire ambiente',
            preop_vasoactive_support: row.soporte_vasoactivo_previo === 1,
            anesthesia_type: row.tecnica_anestesica || 'General balanceada',
            induction_type: row.tipo_induccion || 'Endovenosa',
            anesthesia_notes: row.notas_anestesicas || '',
            airway_management: row.manejo_via_aerea || 'Intubación orotraqueal',
            difficult_airway: row.via_aerea_dificil === 1,
            airway_difficulty_notes: row.via_aerea_dificil_notas || '',
            ett_size_mm: row.tet_tamano_mm !== null ? Number(row.tet_tamano_mm) : null,
            ett_cuffed: row.tet_con_cuff || 'Sin cuff',
            intubation_attempts: row.intentos_intubacion || 1,
            arterial_line_inserted: row.linea_arterial_insertada === 1,
            arterial_line_site: row.linea_arterial_sitio || 'Radial derecha',
            central_line_inserted: row.cvc_insertado === 1,
            central_line_site: row.cvc_sitio || 'Yugular interna derecha',
            tee_used: row.tee_utilizado === 1,
            cerebral_oximetry_used: row.oximetria_cerebral_nirs === 1,
            anesthesia_medication_ids: safeJsonParse(row.medicamentos_anestesicos, []),
            anesthesia_transfusion_ids: safeJsonParse(row.hemoderivados_anestesia, []),
            extubated_in_or: row.extubado_en_quirofano === 1,
            post_anesthesia_airway: row.via_aerea_traslado || 'Intubado con TET',
            post_anesthesia_condition: row.condicion_traslado || 'Crítico estable',
            anesthesia_destination: row.destino_anestesia || 'UCIP Cardiovascular',
            anesthesia_note: row.nota_anestesica_final || '',
            anesthesia_signed_by: row.firma_anestesiologo_nombre || '',
            anesthesia_signed_at: row.firma_anestesiologo_fecha || null
        },

        // Registro de Perfusión y CEC Agrupado
        requirio_cec: row.requirio_cec === 1,
        tiempo_cec_minutos: row.tiempo_cec_minutos,
        tiempo_clampeo_minutos: row.tiempo_clampeo_minutos,
        tiempo_paro_circulatorio_minutos: row.tiempo_paro_circulatorio_minutos,
        temperatura_minima_cec: row.temperatura_minima_cec !== null ? Number(row.temperatura_minima_cec) : null,
        cardioplejia_tipo: row.cardioplejia_tipo || '',
        drenajes_colocados: row.drenajes_colocados || '',
        perfusion: {
            perfusion_record_id: row.perfusion_record_uuid || `PERF-${row.id}`,
            cpb_used: row.requirio_cec === 1,
            perfusionist_id: row.perfusionista || '',
            assistant_perfusionist_ids: safeJsonParse(row.otros_perfusionistas, []),
            cpb_start_datetime: row.inicio_cec_datetime || perfusionFields.cpb_start_datetime || '',
            cpb_end_datetime: row.fin_cec_datetime || perfusionFields.cpb_end_datetime || '',
            cpb_total_time_min: row.tiempo_cec_minutos,
            cpb_period_count: row.periodos_cec_conteo || 0,
            cpb_flow_strategy: row.estrategia_flujo_cec || 'Normoflujo pulsátil/continuo',
            aortic_cross_clamp_used: row.requirio_clampeo_aortico === 1,
            cross_clamp_total_time_min: row.tiempo_clampeo_minutos,
            cross_clamp_period_count: row.periodos_clampeo_conteo || 0,
            cpb_temperature_strategy: row.estrategia_termica_cec || 'Hipotermia moderada (28–32 °C)',
            cpb_min_temperature_c: row.temperatura_minima_cec !== null ? Number(row.temperatura_minima_cec) : 28.0,
            temperature_measurement_site: safeJsonParse(row.sitios_medicion_temperatura, ['Nasofaríngea', 'Rectal']),
            cardioplegia_used: row.cardioplejia_utilizada === 1,
            cardioplegia_solution: row.cardioplejia_solucion || 'Custodiol / Histidina-Triptófano-Cetoglutarato',
            cardioplegia_composition: row.cardioplejia_tipo || 'Cristaloide intracelular',
            cardioplegia_route: safeJsonParse(row.cardioplejia_via, ['Anterógrada en raíz aórtica']),
            cardioplegia_temperature: row.cardioplejia_temperatura || 'Fría (4 °C)',
            cardioplegia_dose_count: row.cardioplejia_dosis_conteo || 1,
            cardioplegia_total_volume_ml: row.cardioplejia_volumen_total_ml !== null ? Number(row.cardioplejia_volumen_total_ml) : null,
            circulatory_arrest_used: row.paro_circulatorio_utilizado === 1,
            circulatory_arrest_total_time_min: row.tiempo_paro_circulatorio_minutos,
            circulatory_arrest_temperature_c: row.temperatura_paro_circulatorio !== null ? Number(row.temperatura_paro_circulatorio) : null,
            cerebral_perfusion_used: row.perfusion_cerebral_utilizada === 1,
            cerebral_perfusion_type: row.perfusion_cerebral_tipo || 'No requerida',
            cerebral_perfusion_time_min: row.perfusion_cerebral_tiempo_min,
            cerebral_perfusion_flow: row.perfusion_cerebral_flujo !== null ? Number(row.perfusion_cerebral_flujo) : null,
            prime_type: row.cebado_tipo || 'Con hemoderivados',
            prime_total_volume_ml: row.cebado_volumen_total_ml !== null ? Number(row.cebado_volumen_total_ml) : 500,
            blood_prime_used: row.cebado_sanguineo === 1,
            prime_notes: row.cebado_notas || '',
            ultrafiltration_used: row.ultrafiltracion_utilizada === 1,
            ultrafiltration_type: row.ultrafiltracion_tipo || 'Convencional (CUF) y modificada (MUF)',
            ultrafiltrate_volume_ml: row.ultrafiltracion_volumen_ml !== null ? Number(row.ultrafiltracion_volumen_ml) : null,
            weaning_from_cpb: row.salida_cec || 'Salida exitosa al primer intento',
            defibrillation_required: row.desfibrilacion_requerida === 1,
            defibrillation_count: row.desfibrilacion_conteo,
            temporary_pacing_required: row.marcapasos_temporal_salida === 1,
            soporte_mecanico_requerido: row.soporte_mecanico_requerido === 1,
            soporte_mecanico_tipo: row.soporte_mecanico_tipo || 'No requerido',
            perfusion_note: row.nota_perfusion || '',
            perfusion_signed_by: row.firma_perfusionista_nombre || '',
            perfusion_signed_at: row.firma_perfusionista_fecha || null
        },

        // Subtablas / Repeaters
        diagnoses,
        procedures,
        surgical_complications,
        anesthesia_complications,
        cannulations,
        cpb_periods,
        clamp_periods,
        perfusion_complications,

        // Estado y Firmas
        estatus_nota: row.estatus_nota || 'Borrador',
        finalized: row.es_finalizado === 1 || row.estatus_nota === 'Finalizado',
        es_finalizado: row.es_finalizado === 1 || row.estatus_nota === 'Finalizado',
        finalized_at: row.fecha_finalizado,
        signed: {
            surg: row.firma_cirujano_nombre ? { by: row.firma_cirujano_nombre, at: row.firma_cirujano_fecha } : (signatures.surg || null),
            anes: row.firma_anestesiologo_nombre ? { by: row.firma_anestesiologo_nombre, at: row.firma_anestesiologo_fecha } : (signatures.anes || null),
            perf: row.firma_perfusionista_nombre ? { by: row.firma_perfusionista_nombre, at: row.firma_perfusionista_fecha } : (signatures.perf || null)
        },

        // Campos complementarios
        datos_completos: datosCompletos
    };
};

/**
 * Listado de cirugías vinculadas a la solicitud o paciente
 */
const getCirugias = async (req, res) => {
    try {
        const { registro_solicitud_id, paciente_id, hospitalizacion_id } = req.query;
        let query = `
            SELECT pq.*,
                   rs.paciente_id,
                   CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                   p.numero_historia_clinica
            FROM procedimiento_quirurgico pq
            LEFT JOIN registro_solicitud rs ON pq.registro_solicitud_id = rs.id
            LEFT JOIN paciente p ON rs.paciente_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (registro_solicitud_id) {
            query += ' AND pq.registro_solicitud_id = ?';
            params.push(registro_solicitud_id);
        }
        if (paciente_id) {
            query += ' AND rs.paciente_id = ?';
            params.push(paciente_id);
        }
        if (hospitalizacion_id) {
            query += ' AND pq.hospitalizacion_id = ?';
            params.push(hospitalizacion_id);
        }
        query += ' ORDER BY pq.fecha_cirugia DESC, pq.id DESC';

        const [rows] = await db.query(query, params);
        const dataParsed = rows.map(formatCirugiaResponse);

        res.json({ status: 'success', data: dataParsed });
    } catch (error) {
        console.error('Error al listar cirugías:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar cirugías', error: error.message });
    }
};

/**
 * Obtener detalle de una cirugía por ID
 */
const getCirugiaPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT pq.*,
                    rs.paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica
             FROM procedimiento_quirurgico pq
             LEFT JOIN registro_solicitud rs ON pq.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE pq.id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Nota quirúrgica no encontrada' });
        }
        res.json({ status: 'success', data: formatCirugiaResponse(rows[0]) });
    } catch (error) {
        console.error('Error al obtener cirugía:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar nota operatoria', error: error.message });
    }
};

/**
 * Prepara los valores para INSERT o UPDATE a partir del body recibido
 */
const prepareSurgeryValues = (body, audit) => {
    // Normalizar fuentes anidadas o planas
    const anes = body.anesthesia || {};
    const perf = body.perfusion || {};
    const signed = body.signed || {};

    const surgery_uuid = body.surgery_id || body.surgery_uuid || crypto.randomUUID();
    const operative_note_uuid = body.operative_note_id || body.operative_note_uuid || crypto.randomUUID();
    const anesthesia_record_uuid = anes.anesthesia_record_id || body.anesthesia_record_uuid || crypto.randomUUID();
    const perfusion_record_uuid = perf.perfusion_record_id || body.perfusion_record_uuid || crypto.randomUUID();

    // Diagnósticos y procedimientos
    const diagnoses = Array.isArray(body.diagnoses) ? body.diagnoses : [];
    const procedures = Array.isArray(body.procedures) ? body.procedures : [];
    const surgical_complications = Array.isArray(body.surgical_complications) ? body.surgical_complications : [];
    const anesthesia_complications = Array.isArray(body.anesthesia_complications) ? body.anesthesia_complications : [];
    const cannulations = Array.isArray(body.cannulations) ? body.cannulations : [];
    const cpb_periods = Array.isArray(body.cpb_periods) ? body.cpb_periods : [];
    const clamp_periods = Array.isArray(body.clamp_periods) ? body.clamp_periods : [];
    const perfusion_complications = Array.isArray(body.perfusion_complications) ? body.perfusion_complications : [];

    // Tiempos calculados
    const duracionCirugiaMin = body.duracion_cirugia_min !== undefined && body.duracion_cirugia_min !== null
        ? Number(body.duracion_cirugia_min)
        : elapsedMinutes(body.surgery_start_datetime || body.inicio_cirugia_datetime, body.surgery_end_datetime || body.fin_cirugia_datetime);

    const duracionAnestesiaMin = anes.anesthesia_duration_min !== undefined && anes.anesthesia_duration_min !== null
        ? Number(anes.anesthesia_duration_min)
        : elapsedMinutes(anes.anesthesia_start_datetime, anes.anesthesia_end_datetime);

    const cpbTimeTotal = perf.cpb_total_time_min !== undefined && perf.cpb_total_time_min !== null
        ? Number(perf.cpb_total_time_min)
        : (sumPeriods(cpb_periods) ?? (body.tiempo_cec_minutos ? Number(body.tiempo_cec_minutos) : null));

    const clampTimeTotal = perf.cross_clamp_total_time_min !== undefined && perf.cross_clamp_total_time_min !== null
        ? Number(perf.cross_clamp_total_time_min)
        : (sumPeriods(clamp_periods) ?? (body.tiempo_clampeo_minutos ? Number(body.tiempo_clampeo_minutos) : null));

    // Resumen de cirugías y diagnósticos si no viene explícito
    let cirugiaRealizada = body.cirugia_realizada || body.operative_procedure_summary || '';
    if (!cirugiaRealizada && procedures.length > 0) {
        cirugiaRealizada = procedures.map((p, i) => `${i + 1}. ${p.procedure_name || p.fields?.procedure_name || ''}`).filter(Boolean).join('\n');
    }

    let diagPreop = body.diagnostico_preoperatorio || '';
    if (!diagPreop && diagnoses.length > 0) {
        diagPreop = diagnoses.map(d => d.preop_diagnosis || d.fields?.preop_diagnosis || '').filter(Boolean).join('; ');
    }

    const estatusNota = body.estatus_nota || (body.finalized ? 'Finalizado' : 'Borrador');
    const esFinalizado = (estatusNota === 'Finalizado' || estatusNota === 'Firmado' || body.finalized) ? 1 : 0;

    return {
        hospitalizacion_id: body.hospitalizacion_id || null,
        surgery_uuid,
        operative_note_uuid,
        anesthesia_record_uuid,
        perfusion_record_uuid,

        // Tiempos e Identificación
        fecha_cirugia: body.fecha_cirugia || body.surgery_date || new Date().toISOString().split('T')[0],
        inicio_cirugia_datetime: body.surgery_start_datetime || body.inicio_cirugia_datetime || null,
        fin_cirugia_datetime: body.surgery_end_datetime || body.fin_cirugia_datetime || null,
        salida_quirofano_datetime: body.or_exit_datetime || body.salida_quirofano_datetime || null,
        duracion_cirugia_min: duracionCirugiaMin,
        edad_dias_cirugia: body.age_at_surgery_days || null,
        edad_meses_cirugia: body.age_at_surgery_months || null,
        peso_cirugia_kg: body.weight_at_surgery_kg || body.peso_cirugia_kg || null,
        talla_cirugia_cm: body.height_at_surgery_cm || body.talla_cirugia_cm || null,
        quirofano: body.operating_room || body.quirofano || null,

        // Prioridad y Estrategia
        prioridad_cirugia: body.surgery_priority || body.prioridad_cirugia || 'Electiva',
        estrategia_quirurgica: body.surgery_strategy || body.estrategia_quirurgica || 'Corrección completa definitiva',
        primera_cirugia_cv: body.first_cardiac_surgery !== undefined ? (body.first_cardiac_surgery ? 1 : 0) : 1,
        numero_cirugia_cv: body.cardiac_surgery_number || body.numero_cirugia_cv || 1,
        reoperacion_cardiaca: body.redo_surgery ? 1 : 0,
        reoperacion_planificada: body.planned_reoperation ? 1 : 0,
        cirugia_por_complicacion: body.surgery_due_to_complication ? 1 : 0,
        cirugia_previa_relacionada_id: body.parent_surgery_id || null,
        complicacion_anterior_relacionada_id: body.parent_complication_id || null,

        // Equipo y Abordaje
        cirujano_principal: body.cirujano_principal || body.primary_surgeon_id || 'Cirujano Principal Pendiente',
        cirujanos_ayudantes: safeJsonStringify(body.assistant_surgeon_ids || body.cirujanos_ayudantes || []),
        residentes_participantes: safeJsonStringify(body.surgical_resident_ids || body.residentes_participantes || []),
        instrumentista: body.scrub_nurse_id || body.instrumentista || null,
        abordaje_quirurgico: body.surgical_approach || body.abordaje_quirurgico || 'Esternotomía media',
        abordaje_quirurgico_otro: body.surgical_approach_other || body.abordaje_quirurgico_otro || null,
        reesternotomia: body.redo_sternotomy ? 1 : 0,

        // Nota Operatoria y Hallazgos
        diagnostico_preoperatorio: diagPreop || 'Diagnóstico Preoperatorio Pendiente',
        diagnostico_postoperatorio: body.diagnostico_postoperatorio || null,
        cirugia_propuesta: body.cirugia_propuesta || null,
        cirugia_realizada: cirugiaRealizada || 'Cirugía Cardiovascular',
        resumen_procedimientos: body.operative_procedure_summary || cirugiaRealizada,
        hallazgos_operatorios: body.operative_findings_narrative || body.hallazgos_operatorios || 'Sin hallazgos especificados',
        lesion_residual: body.residual_lesion_present || body.lesion_residual || 'No',
        lesion_residual_descripcion: body.residual_lesion_description || body.lesion_residual_descripcion || null,
        eco_postreparacion_resultado: body.postrepair_echo_result || body.eco_postreparacion_resultado || null,
        ritmo_postoperatorio: body.postoperative_rhythm || body.ritmo_postoperatorio || 'Sinusal',
        estado_torax: body.chest_status || body.estado_torax || 'Cerrado completamente',
        destino_postoperatorio: body.destination_after_or || body.destino_postoperatorio || 'UCIP Cardiovascular',
        complicacion_presente: body.complication_present || surgical_complications.length > 0 ? 1 : 0,
        muestra_quirurgica_obtenida: body.specimen_obtained ? 1 : 0,
        muestra_quirurgica_tipo: body.specimen_type || null,
        enviado_anatomia_patologica: body.pathology_requested ? 1 : 0,

        // Anestesia
        anestesiologo: anes.anesthesiologist_id || body.anestesiologo || null,
        otros_anestesiologos: safeJsonStringify(anes.anesthesia_assistant_ids || []),
        inicio_anestesia_datetime: anes.anesthesia_start_datetime || null,
        fin_anestesia_datetime: anes.anesthesia_end_datetime || null,
        duracion_anestesia_min: duracionAnestesiaMin,
        tiempo_anestesia_minutos: duracionAnestesiaMin,
        clasificacion_asa: anes.asa_class || 'ASA IV',
        asa_emergencia: anes.asa_emergency ? 1 : 0,
        estado_preanestesico: anes.preanesthesia_status || null,
        soporte_oxigeno_previo: anes.preop_oxygen_support || 'Aire ambiente',
        soporte_vasoactivo_previo: anes.preop_vasoactive_support ? 1 : 0,
        tecnica_anestesica: anes.anesthesia_type || 'General balanceada',
        tipo_induccion: anes.induction_type || 'Endovenosa',
        notas_anestesicas: anes.anesthesia_notes || null,
        manejo_via_aerea: anes.airway_management || 'Intubación orotraqueal',
        via_aerea_dificil: anes.difficult_airway ? 1 : 0,
        via_aerea_dificil_notas: anes.airway_difficulty_notes || null,
        tet_tamano_mm: anes.ett_size_mm || null,
        tet_con_cuff: anes.ett_cuffed || 'Sin cuff',
        intentos_intubacion: anes.intubation_attempts || 1,
        linea_arterial_insertada: anes.arterial_line_inserted !== undefined ? (anes.arterial_line_inserted ? 1 : 0) : 1,
        linea_arterial_sitio: anes.arterial_line_site || 'Radial derecha',
        cvc_insertado: anes.central_line_inserted !== undefined ? (anes.central_line_inserted ? 1 : 0) : 1,
        cvc_sitio: anes.central_line_site || 'Yugular interna derecha',
        tee_utilizado: anes.tee_used !== undefined ? (anes.tee_used ? 1 : 0) : 1,
        oximetria_cerebral_nirs: anes.cerebral_oximetry_used !== undefined ? (anes.cerebral_oximetry_used ? 1 : 0) : 1,
        medicamentos_anestesicos: safeJsonStringify(anes.anesthesia_medication_ids || []),
        hemoderivados_anestesia: safeJsonStringify(anes.anesthesia_transfusion_ids || []),
        extubado_en_quirofano: anes.extubated_in_or ? 1 : 0,
        via_aerea_traslado: anes.post_anesthesia_airway || 'Intubado con TET',
        condicion_traslado: anes.post_anesthesia_condition || 'Crítico estable',
        destino_anestesia: anes.anesthesia_destination || 'UCIP Cardiovascular',
        nota_anestesica_final: anes.anesthesia_note || null,

        // Perfusión y CEC
        requirio_cec: (perf.cpb_used !== undefined ? perf.cpb_used : body.requirio_cec) ? 1 : 0,
        perfusionista: perf.perfusionist_id || null,
        otros_perfusionistas: safeJsonStringify(perf.assistant_perfusionist_ids || []),
        inicio_cec_datetime: perf.cpb_start_datetime || null,
        fin_cec_datetime: perf.cpb_end_datetime || null,
        tiempo_cec_minutos: cpbTimeTotal,
        periodos_cec_conteo: cpb_periods.length,
        estrategia_flujo_cec: perf.cpb_flow_strategy || 'Normoflujo pulsátil/continuo',
        requirio_clampeo_aortico: (perf.aortic_cross_clamp_used !== undefined ? perf.aortic_cross_clamp_used : true) ? 1 : 0,
        tiempo_clampeo_minutos: clampTimeTotal,
        periodos_clampeo_conteo: clamp_periods.length,
        estrategia_termica_cec: perf.cpb_temperature_strategy || 'Hipotermia moderada (28–32 °C)',
        temperatura_minima_cec: perf.cpb_min_temperature_c || body.temperatura_minima_cec || 28.0,
        sitios_medicion_temperatura: safeJsonStringify(perf.temperature_measurement_site || ['Nasofaríngea', 'Rectal']),
        cardioplejia_utilizada: (perf.cardioplegia_used !== undefined ? perf.cardioplegia_used : true) ? 1 : 0,
        cardioplejia_solucion: perf.cardioplegia_solution || 'Custodiol / Histidina-Triptófano-Cetoglutarato',
        cardioplejia_tipo: perf.cardioplegia_composition || body.cardioplejia_tipo || 'Cristaloide intracelular',
        cardioplejia_via: safeJsonStringify(perf.cardioplegia_route || ['Anterógrada en raíz aórtica']),
        cardioplejia_temperatura: perf.cardioplegia_temperature || 'Fría (4 °C)',
        cardioplejia_dosis_conteo: perf.cardioplegia_dose_count || 1,
        cardioplejia_volumen_total_ml: perf.cardioplegia_total_volume_ml || null,
        paro_circulatorio_utilizado: perf.circulatory_arrest_used ? 1 : 0,
        tiempo_paro_circulatorio_minutos: perf.circulatory_arrest_total_time_min || body.tiempo_paro_circulatorio_minutos || null,
        temperatura_paro_circulatorio: perf.circulatory_arrest_temperature_c || null,
        perfusion_cerebral_utilizada: perf.cerebral_perfusion_used ? 1 : 0,
        perfusion_cerebral_tipo: perf.cerebral_perfusion_type || 'No requerida',
        perfusion_cerebral_tiempo_min: perf.cerebral_perfusion_time_min || null,
        perfusion_cerebral_flujo: perf.cerebral_perfusion_flow || null,
        cebado_tipo: perf.prime_type || 'Con hemoderivados',
        cebado_volumen_total_ml: perf.prime_total_volume_ml || 500,
        cebado_sanguineo: (perf.blood_prime_used !== undefined ? perf.blood_prime_used : true) ? 1 : 0,
        cebado_notas: perf.prime_notes || null,
        ultrafiltracion_utilizada: (perf.ultrafiltration_used !== undefined ? perf.ultrafiltration_used : true) ? 1 : 0,
        ultrafiltracion_tipo: perf.ultrafiltration_type || 'Convencional (CUF) y modificada (MUF)',
        ultrafiltracion_volumen_ml: perf.ultrafiltrate_volume_ml || null,
        salida_cec: perf.weaning_from_cpb || 'Salida exitosa al primer intento',
        desfibrilacion_requerida: perf.defibrillation_required ? 1 : 0,
        desfibrilacion_conteo: perf.defibrillation_count || null,
        marcapasos_temporal_salida: perf.temporary_pacing_required ? 1 : 0,
        soporte_mecanico_requerido: perf.mechanical_support_required ? 1 : 0,
        soporte_mecanico_tipo: perf.mechanical_support_type || 'No requerido',
        drenajes_colocados: body.drenajes_colocados || null,
        nota_perfusion: perf.perfusion_note || null,

        // Firmas y Estado
        estatus_nota: estatusNota,
        es_finalizado: esFinalizado,
        firma_cirujano_nombre: signed.surg?.by || body.operative_note_signed_by || (esFinalizado ? (body.cirujano_principal || 'Cirujano Cardiovascular') : null),
        firma_cirujano_fecha: signed.surg?.at || body.operative_note_signed_at || (esFinalizado ? new Date() : null),
        firma_anestesiologo_nombre: signed.anes?.by || anes.anesthesia_signed_by || (esFinalizado ? (anes.anesthesiologist_id || 'Anestesiólogo Cardiovascular') : null),
        firma_anestesiologo_fecha: signed.anes?.at || anes.anesthesia_signed_at || (esFinalizado ? new Date() : null),
        firma_perfusionista_nombre: signed.perf?.by || perf.perfusion_signed_by || (esFinalizado ? (perf.perfusionist_id || 'Perfusionista Cardiovascular') : null),
        firma_perfusionista_fecha: signed.perf?.at || perf.perfusion_signed_at || (esFinalizado ? new Date() : null),
        fecha_finalizado: esFinalizado ? new Date() : null,

        // Repeaters Serializados
        diagnoses_json: safeJsonStringify(diagnoses),
        procedures_json: safeJsonStringify(procedures),
        surgical_complications_json: safeJsonStringify(surgical_complications),
        anesthesia_complications_json: safeJsonStringify(anesthesia_complications),
        cannulations_json: safeJsonStringify(cannulations),
        cpb_periods_json: safeJsonStringify(cpb_periods),
        clamp_periods_json: safeJsonStringify(clamp_periods),
        perfusion_complications_json: safeJsonStringify(perfusion_complications),

        // Secciones completas
        surgery_fields_json: safeJsonStringify(body),
        anesthesia_fields_json: safeJsonStringify(anes),
        perfusion_fields_json: safeJsonStringify(perf),
        signatures_json: safeJsonStringify(signed),
        datos_completos_json: safeJsonStringify(body),

        // Auditoría
        audit_usu_id: audit?.audit_usu_id || '1',
        audit_ip: audit?.audit_ip || '127.0.0.1',
        audit_dep_id: audit?.audit_dep_id || '1'
    };
};

/**
 * Crear nueva cirugía cardiovascular
 */
const createCirugia = async (req, res) => {
    try {
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        let { registro_solicitud_id, paciente_id } = req.body;

        const resolvedSolicitudId = await resolverSolicitudId(registro_solicitud_id || paciente_id);
        if (!resolvedSolicitudId) {
            return res.status(400).json({
                status: 'error',
                message: 'No se pudo resolver o crear un registro_solicitud_id válido para la cirugía.'
            });
        }

        const valuesObj = prepareSurgeryValues(req.body, audit);
        valuesObj.registro_solicitud_id = resolvedSolicitudId;

        const cols = Object.keys(valuesObj);
        const placeholders = cols.map(() => '?').join(', ');
        const vals = cols.map(c => valuesObj[c]);

        const sql = `INSERT INTO procedimiento_quirurgico (${cols.join(', ')}) VALUES (${placeholders})`;
        const [result] = await db.query(sql, vals);

        const newId = result.insertId;
        const [rows] = await db.query(
            `SELECT pq.*,
                    rs.paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica
             FROM procedimiento_quirurgico pq
             LEFT JOIN registro_solicitud rs ON pq.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE pq.id = ?`,
            [newId]
        );

        res.status(201).json({
            status: 'success',
            message: 'Cirugía cardiovascular registrada con éxito',
            data: formatCirugiaResponse(rows[0])
        });
    } catch (error) {
        console.error('Error al registrar cirugía cardiovascular:', error);
        res.status(500).json({ status: 'error', message: 'Error al registrar cirugía cardiovascular', error: error.message });
    }
};

/**
 * Actualizar cirugía existente
 */
const updateCirugia = async (req, res) => {
    try {
        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        // Verificar inmutabilidad si ya está finalizada
        const [existente] = await db.query('SELECT id, es_finalizado, estatus_nota FROM procedimiento_quirurgico WHERE id = ?', [id]);
        if (existente.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Cirugía cardiovascular no encontrada' });
        }

        if ((existente[0].es_finalizado === 1 || existente[0].estatus_nota === 'Finalizado') && !req.body._desbloquear) {
            return res.status(403).json({
                status: 'error',
                message: 'La cirugía cardiovascular ya ha sido finalizada y no puede modificarse directamente (Inmutabilidad clínica).'
            });
        }

        const valuesObj = prepareSurgeryValues(req.body, audit);
        // Evitamos sobrescribir registro_solicitud_id a null
        if (req.body.registro_solicitud_id) {
            valuesObj.registro_solicitud_id = req.body.registro_solicitud_id;
        }

        const cols = Object.keys(valuesObj);
        const setClause = cols.map(c => `${c} = ?`).join(', ');
        const vals = [...cols.map(c => valuesObj[c]), id];

        const sql = `UPDATE procedimiento_quirurgico SET ${setClause} WHERE id = ?`;
        await db.query(sql, vals);

        const [rows] = await db.query(
            `SELECT pq.*,
                    rs.paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica
             FROM procedimiento_quirurgico pq
             LEFT JOIN registro_solicitud rs ON pq.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE pq.id = ?`,
            [id]
        );

        res.json({
            status: 'success',
            message: 'Cirugía cardiovascular actualizada exitosamente',
            data: formatCirugiaResponse(rows[0])
        });
    } catch (error) {
        console.error('Error al actualizar cirugía cardiovascular:', error);
        res.status(500).json({ status: 'error', message: 'Error al actualizar cirugía cardiovascular', error: error.message });
    }
};

/**
 * Eliminar cirugía cardiovascular (solo borradores)
 */
const deleteCirugia = async (req, res) => {
    try {
        const { id } = req.params;
        const [existente] = await db.query('SELECT id, es_finalizado, estatus_nota FROM procedimiento_quirurgico WHERE id = ?', [id]);
        if (existente.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Cirugía cardiovascular no encontrada' });
        }

        if (existente[0].es_finalizado === 1 || existente[0].estatus_nota === 'Finalizado') {
            return res.status(403).json({
                status: 'error',
                message: 'No es posible eliminar una cirugía cardiovascular finalizada.'
            });
        }

        await db.query('DELETE FROM procedimiento_quirurgico WHERE id = ?', [id]);
        res.json({ status: 'success', message: 'Cirugía cardiovascular descartada/eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar cirugía cardiovascular:', error);
        res.status(500).json({ status: 'error', message: 'Error al eliminar cirugía cardiovascular', error: error.message });
    }
};

module.exports = {
    getCirugias,
    getCirugiaPorId,
    createCirugia,
    updateCirugia,
    deleteCirugia
};
