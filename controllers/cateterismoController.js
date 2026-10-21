// backend/controllers/cateterismoController.js
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
             VALUES (?, 4, 1, CURDATE(), 'Pendiente', 'Solicitud inicial generada automáticamente para cateterismo', '1', '127.0.0.1', '1')`,
            [solicitudIdOrPacienteId]
        );
        return ins.insertId;
    }
    return null;
};

/**
 * Listado de cateterismos vinculados a la solicitud o paciente
 */
const getCateterismos = async (req, res) => {
    try {
        const { registro_solicitud_id, paciente_id, hospitalizacion_id } = req.query;
        let query = `
            SELECT c.*,
                   rs.paciente_id,
                   CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                   p.numero_historia_clinica
            FROM estudio_cateterismo c
            LEFT JOIN registro_solicitud rs ON c.registro_solicitud_id = rs.id
            LEFT JOIN paciente p ON rs.paciente_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (registro_solicitud_id) {
            query += ' AND c.registro_solicitud_id = ?';
            params.push(registro_solicitud_id);
        }
        if (paciente_id) {
            query += ' AND rs.paciente_id = ?';
            params.push(paciente_id);
        }
        if (hospitalizacion_id) {
            query += ' AND c.hospitalizacion_id = ?';
            params.push(hospitalizacion_id);
        }
        query += ' ORDER BY c.fecha_procedimiento DESC, c.id DESC';

        const [rows] = await db.query(query, params);

        const dataParsed = rows.map(r => ({
            ...r,
            accesses: safeJsonParse(r.accesses_json, []),
            conditions: safeJsonParse(r.conditions_json, []),
            angiographies: safeJsonParse(r.angiographies_json, []),
            interventions: safeJsonParse(r.interventions_json, []),
            complications: safeJsonParse(r.complications_json, []),
            seccion_context: safeJsonParse(r.seccion_context_json, {}),
            seccion_preparation: safeJsonParse(r.seccion_preparation_json, {}),
            seccion_access: safeJsonParse(r.seccion_access_json, {}),
            seccion_hemodynamics: safeJsonParse(r.seccion_hemodynamics_json, {}),
            seccion_imaging: safeJsonParse(r.seccion_imaging_json, {}),
            seccion_interventions: safeJsonParse(r.seccion_interventions_json, {}),
            seccion_reactivity: safeJsonParse(r.seccion_reactivity_json, {}),
            seccion_outcomes: safeJsonParse(r.seccion_outcomes_json, {}),
            seccion_closure: safeJsonParse(r.seccion_closure_json, {}),
            datos_completos: safeJsonParse(r.datos_completos_json, {})
        }));

        res.json({ status: 'success', data: dataParsed });
    } catch (error) {
        console.error('Error al consultar cateterismos:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar cateterismos', error: error.message });
    }
};

/**
 * Obtener cateterismo por ID
 */
const getCateterismoPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT c.*,
                    rs.paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica
             FROM estudio_cateterismo c
             LEFT JOIN registro_solicitud rs ON c.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE c.id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Estudio hemodinámico no encontrado' });
        }

        const r = rows[0];
        const dataParsed = {
            ...r,
            accesses: safeJsonParse(r.accesses_json, []),
            conditions: safeJsonParse(r.conditions_json, []),
            angiographies: safeJsonParse(r.angiographies_json, []),
            interventions: safeJsonParse(r.interventions_json, []),
            complications: safeJsonParse(r.complications_json, []),
            seccion_context: safeJsonParse(r.seccion_context_json, {}),
            seccion_preparation: safeJsonParse(r.seccion_preparation_json, {}),
            seccion_access: safeJsonParse(r.seccion_access_json, {}),
            seccion_hemodynamics: safeJsonParse(r.seccion_hemodynamics_json, {}),
            seccion_imaging: safeJsonParse(r.seccion_imaging_json, {}),
            seccion_interventions: safeJsonParse(r.seccion_interventions_json, {}),
            seccion_reactivity: safeJsonParse(r.seccion_reactivity_json, {}),
            seccion_outcomes: safeJsonParse(r.seccion_outcomes_json, {}),
            seccion_closure: safeJsonParse(r.seccion_closure_json, {}),
            datos_completos: safeJsonParse(r.datos_completos_json, {})
        };

        res.json({ status: 'success', data: dataParsed });
    } catch (error) {
        console.error('Error al obtener cateterismo:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar cateterismo', error: error.message });
    }
};

/**
 * Registrar cateterismo estructurado (HCIL V17)
 */
const createCateterismo = async (req, res) => {
    try {
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const b = req.body;

        const targetSolicitudId = b.registro_solicitud_id || await resolverSolicitudId(b.paciente_id);
        if (!targetSolicitudId) {
            return res.status(400).json({ status: 'error', message: 'registro_solicitud_id o paciente_id requerido' });
        }

        const cath_uuid = b.cath_uuid || b.cath_id || crypto.randomUUID();
        const fecha_procedimiento = b.fecha_procedimiento || b.cath_date || new Date().toISOString().split('T')[0];

        // Cálculo de superficie corporal Mosteller
        const peso_kg = b.peso_kg || b.patient_weight_kg || null;
        const talla_cm = b.talla_cm || b.patient_height_cm || null;
        let superficie_corporal = b.superficie_corporal || b.body_surface_area || null;
        if (!superficie_corporal && peso_kg > 0 && talla_cm > 0) {
            superficie_corporal = +(Math.sqrt((peso_kg * talla_cm) / 3600)).toFixed(3);
        }

        // Cálculos hemodinámicos derivados
        const qp = b.gasto_cardiaco_qp || b.pulmonary_blood_flow || null;
        const qs = b.gasto_cardiaco_qs || b.systemic_blood_flow || null;
        let relacion_qp_qs = b.relacion_qp_qs || b.qp_qs_ratio || null;
        if (!relacion_qp_qs && qp > 0 && qs > 0) {
            relacion_qp_qs = +(qp / qs).toFixed(2);
        }

        const rvp = b.resistencia_vascular_pulmonar_rvp || b.pulmonary_vascular_resistance || null;
        const rvs = b.resistencia_vascular_sistemica_rvs || b.systemic_vascular_resistance || null;
        let relacion_rp_rs = b.relacion_rp_rs || b.rp_rs_ratio || null;
        if (!relacion_rp_rs && rvp > 0 && rvs > 0) {
            relacion_rp_rs = +(rvp / rvs).toFixed(2);
        }

        // Contraste por kg
        const volumen_contraste_ml = b.volumen_contraste_ml || b.contrast_total_volume || null;
        let volumen_contraste_ml_kg = b.volumen_contraste_ml_kg || null;
        if (!volumen_contraste_ml_kg && volumen_contraste_ml > 0 && peso_kg > 0) {
            volumen_contraste_ml_kg = +(volumen_contraste_ml / peso_kg).toFixed(2);
        }

        // Repeaters
        const accesses = Array.isArray(b.accesses) ? b.accesses : [];
        const conditions = Array.isArray(b.conditions) ? b.conditions : [];
        const angiographies = Array.isArray(b.angiographies) ? b.angiographies : [];
        const interventions = Array.isArray(b.interventions) ? b.interventions : [];
        const complications = Array.isArray(b.complications) ? b.complications : [];

        // Sitio de acceso resumen
        let sitio_acceso_vascular = b.sitio_acceso_vascular || null;
        if (!sitio_acceso_vascular && accesses.length > 0) {
            sitio_acceso_vascular = accesses.map(a => `${a.access_site || ''} (${a.vessel_type || ''})`).join(', ');
        }

        // Intervención y dispositivo resumen
        let intervencion_realizada = b.intervencion_realizada || null;
        if (!intervencion_realizada && interventions.length > 0) {
            intervencion_realizada = interventions.map(i => i.intervention_type || i.target_structure || 'Intervención').join('; ');
        }

        let dispositivo_implantado = b.dispositivo_implantado || null;
        if (!dispositivo_implantado) {
            const allDevices = interventions.flatMap(i => i.devices || []);
            if (allDevices.length > 0) {
                dispositivo_implantado = allDevices.map(d => `${d.device_category || ''} ${d.device_brand_model || ''} (${d.device_size || ''})`).join(', ');
            }
        }

        const estatus_informe = b.estatus_informe || (b.finalized ? 'Finalizado' : 'Borrador');
        const conclusion_informe = b.conclusion_informe || b.procedure_conclusion || 'Cateterismo registrado sin novedades críticas.';

        const [result] = await db.query(
            `INSERT INTO estudio_cateterismo (
                registro_solicitud_id,
                hospitalizacion_id,
                cath_uuid,
                fecha_procedimiento,
                hora_inicio,
                hora_fin,
                sala_cateterismo,
                primer_operador,
                segundo_operador,
                fellow_residente,
                anestesiologo,
                enfermeria,
                tecnologo_radiologico,
                prioridad_procedimiento,
                tipo_cateterismo,
                indicacion_procedimiento,
                indicacion_otra,
                diagnostico_cardiopatia_base,
                estado_quirurgico_previo,
                cirugias_previas_resumen,
                clase_funcional_ross_nyha,
                peso_kg,
                talla_cm,
                superficie_corporal,
                fc_pre,
                ta_sistolica_pre,
                ta_diastolica_pre,
                ta_media_pre,
                spo2_pre,
                hb_pre,
                hto_pre,
                tipo_anestesia,
                via_aerea,
                fio2_pre,
                uso_ultrasonido_vascular,
                sitio_acceso_vascular,
                heparina_dosis_total,
                heparina_unidad,
                act_basal,
                act_pico,
                protamina_administrada,
                protamina_dosis_mg,
                presion_auricula_derecha,
                presion_ventriculo_derecho,
                presion_arteria_pulmonar,
                presion_auricula_izquierda,
                presion_ventriculo_izquierdo,
                presion_aorta,
                presion_capilar_pulmonar,
                gasto_cardiaco_qp,
                gasto_cardiaco_qs,
                relacion_qp_qs,
                resistencia_vascular_pulmonar_rvp,
                resistencia_vascular_sistemica_rvs,
                relacion_rp_rs,
                tiempo_fluoroscopia_min,
                kerma_aire_total_mgy,
                producto_dosis_area_dap,
                medio_contraste_tipo,
                volumen_contraste_ml,
                volumen_contraste_ml_kg,
                ecocardiograma_transesofagico,
                ecocardiograma_intracardiaco,
                ecocardiograma_hallazgos,
                intervencion_realizada,
                dispositivo_implantado,
                exito_procedimiento,
                prueba_vasorreactividad,
                vasorreactividad_agente,
                vasorreactividad_resultado,
                vasorreactividad_papm_basal,
                vasorreactividad_papm_reto,
                vasorreactividad_rvp_basal,
                vasorreactividad_rvp_reto,
                vasorreactividad_notas,
                transfusion_hemoderivados,
                transfusion_detalles,
                soporte_mecanico_requerido,
                complicaciones,
                estado_paciente_cierre,
                destino_posterior,
                estado_pulsos_femorales,
                conclusion_informe,
                estatus_informe,
                accesses_json,
                conditions_json,
                angiographies_json,
                interventions_json,
                complications_json,
                seccion_context_json,
                seccion_preparation_json,
                seccion_access_json,
                seccion_hemodynamics_json,
                seccion_imaging_json,
                seccion_interventions_json,
                seccion_reactivity_json,
                seccion_outcomes_json,
                seccion_closure_json,
                datos_completos_json,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetSolicitudId,
                b.hospitalizacion_id || null,
                cath_uuid,
                fecha_procedimiento,
                b.hora_inicio || b.start_time || null,
                b.hora_fin || b.end_time || null,
                b.sala_cateterismo || b.cath_room || 'Sala de Hemodinamia 1',
                b.primer_operador || b.primary_operator_id || null,
                b.segundo_operador || b.secondary_operator_id || null,
                b.fellow_residente || b.fellow_id || null,
                b.anestesiologo || b.anesthesiologist_id || null,
                b.enfermeria || b.nursing_staff_id || null,
                b.tecnologo_radiologico || b.radiology_tech_id || null,
                b.prioridad_procedimiento || b.procedure_priority || 'Electivo',
                b.tipo_cateterismo || b.procedure_type || 'Diagnóstico e intervencionista',
                Array.isArray(b.indicacion_procedimiento) ? b.indicacion_procedimiento.join(', ') : (b.indicacion_procedimiento || b.cath_indication || null),
                b.indicacion_otra || b.cath_indication_other || null,
                b.diagnostico_cardiopatia_base || b.pre_diagnosis_congenital || null,
                b.estado_quirurgico_previo || b.pre_diagnosis_surgical_status || 'No operado',
                b.cirugias_previas_resumen || b.previous_surgeries_summary || null,
                b.clase_funcional_ross_nyha || b.pre_procedure_nyha_class || null,
                peso_kg,
                talla_cm,
                superficie_corporal,
                b.fc_pre || b.pre_procedure_heart_rate || null,
                b.ta_sistolica_pre || b.pre_procedure_bp_systolic || null,
                b.ta_diastolica_pre || b.pre_procedure_bp_diastolic || null,
                b.ta_media_pre || b.pre_procedure_bp_mean || null,
                b.spo2_pre || b.pre_procedure_spo2 || null,
                b.hb_pre || b.pre_procedure_hemoglobin || null,
                b.hto_pre || b.pre_procedure_hematocrit || null,
                b.tipo_anestesia || b.anesthesia_type || 'Anestesia general',
                b.via_aerea || b.airway_management || 'Tubo endotraqueal',
                b.fio2_pre || null,
                b.uso_ultrasonido_vascular ? 1 : 0,
                sitio_acceso_vascular,
                b.heparina_dosis_total || b.heparin_total_dose || null,
                b.heparina_unidad || b.heparin_total_dose_unit || 'UI/kg',
                b.act_basal || null,
                b.act_pico || null,
                b.protamina_administrada ? 1 : 0,
                b.protamina_dosis_mg || null,
                b.presion_auricula_derecha || null,
                b.presion_ventriculo_derecho || null,
                b.presion_arteria_pulmonar || null,
                b.presion_auricula_izquierda || null,
                b.presion_ventriculo_izquierdo || null,
                b.presion_aorta || null,
                b.presion_capilar_pulmonar || null,
                qp,
                qs,
                relacion_qp_qs,
                rvp,
                rvs,
                relacion_rp_rs,
                b.tiempo_fluoroscopia_min || b.fluoroscopy_time || null,
                b.kerma_aire_total_mgy || b.cumulative_air_kerma || null,
                b.producto_dosis_area_dap || b.dose_area_product || null,
                b.medio_contraste_tipo || b.contrast_agent_type || null,
                volumen_contraste_ml,
                volumen_contraste_ml_kg,
                b.ecocardiograma_transesofagico ? 1 : 0,
                b.ecocardiograma_intracardiaco ? 1 : 0,
                b.ecocardiograma_hallazgos || null,
                intervencion_realizada,
                dispositivo_implantado,
                b.exito_procedimiento || 'Éxito completo sin complicaciones residuales',
                b.prueba_vasorreactividad ? 1 : 0,
                b.vasorreactividad_agente || null,
                b.vasorreactividad_resultado || null,
                b.vasorreactividad_papm_basal || null,
                b.vasorreactividad_papm_reto || null,
                b.vasorreactividad_rvp_basal || null,
                b.vasorreactividad_rvp_reto || null,
                b.vasorreactividad_notas || null,
                b.transfusion_hemoderivados ? 1 : 0,
                b.transfusion_detalles || null,
                b.soporte_mecanico_requerido ? 1 : 0,
                Array.isArray(b.complicaciones) ? b.complicaciones.map(c => c.complication_type).join(', ') : (b.complicaciones || null),
                b.estado_paciente_cierre || b.patient_status_at_closure || 'Estable',
                b.destino_posterior || b.post_procedure_destination || 'UCI Cardiovascular',
                b.estado_pulsos_femorales || b.femoral_pulse_status || 'Pulsos simétricos presentes',
                conclusion_informe,
                estatus_informe,
                safeJsonStringify(accesses),
                safeJsonStringify(conditions),
                safeJsonStringify(angiographies),
                safeJsonStringify(interventions),
                safeJsonStringify(complications),
                safeJsonStringify(b.seccion_context || {}),
                safeJsonStringify(b.seccion_preparation || {}),
                safeJsonStringify(b.seccion_access || {}),
                safeJsonStringify(b.seccion_hemodynamics || {}),
                safeJsonStringify(b.seccion_imaging || {}),
                safeJsonStringify(b.seccion_interventions || {}),
                safeJsonStringify(b.seccion_reactivity || {}),
                safeJsonStringify(b.seccion_outcomes || {}),
                safeJsonStringify(b.seccion_closure || {}),
                safeJsonStringify(b),
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        res.status(201).json({
            status: 'success',
            message: 'Cateterismo cardíaco estructurado registrado exitosamente',
            id: result.insertId,
            cath_uuid,
            registro_solicitud_id: targetSolicitudId,
            estatus_informe
        });
    } catch (error) {
        console.error('Error al registrar cateterismo:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al registrar cateterismo', error: error.message });
    }
};

/**
 * Actualizar cateterismo (solo si no está finalizado)
 */
const updateCateterismo = async (req, res) => {
    try {
        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        const [existe] = await db.query('SELECT * FROM estudio_cateterismo WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Cateterismo no encontrado' });
        }

        if ((existe[0].estatus_informe === 'Finalizado' || existe[0].estatus_informe === 'Firmado') && !req.body.forzar_edicion) {
            return res.status(403).json({
                status: 'error',
                message: 'El procedimiento está Finalizado y bloqueado contra modificaciones por motivos de inmutabilidad clínica.'
            });
        }

        const b = req.body;
        const peso_kg = b.peso_kg || b.patient_weight_kg || existe[0].peso_kg;
        const talla_cm = b.talla_cm || b.patient_height_cm || existe[0].talla_cm;
        let superficie_corporal = b.superficie_corporal || existe[0].superficie_corporal;
        if (!superficie_corporal && peso_kg > 0 && talla_cm > 0) {
            superficie_corporal = +(Math.sqrt((peso_kg * talla_cm) / 3600)).toFixed(3);
        }

        const qp = b.gasto_cardiaco_qp ?? existe[0].gasto_cardiaco_qp;
        const qs = b.gasto_cardiaco_qs ?? existe[0].gasto_cardiaco_qs;
        let relacion_qp_qs = b.relacion_qp_qs ?? existe[0].relacion_qp_qs;
        if (qp > 0 && qs > 0) relacion_qp_qs = +(qp / qs).toFixed(2);

        const rvp = b.resistencia_vascular_pulmonar_rvp ?? existe[0].resistencia_vascular_pulmonar_rvp;
        const rvs = b.resistencia_vascular_sistemica_rvs ?? existe[0].resistencia_vascular_sistemica_rvs;
        let relacion_rp_rs = b.relacion_rp_rs ?? existe[0].relacion_rp_rs;
        if (rvp > 0 && rvs > 0) relacion_rp_rs = +(rvp / rvs).toFixed(2);

        const accesses = Array.isArray(b.accesses) ? b.accesses : safeJsonParse(existe[0].accesses_json, []);
        const conditions = Array.isArray(b.conditions) ? b.conditions : safeJsonParse(existe[0].conditions_json, []);
        const angiographies = Array.isArray(b.angiographies) ? b.angiographies : safeJsonParse(existe[0].angiographies_json, []);
        const interventions = Array.isArray(b.interventions) ? b.interventions : safeJsonParse(existe[0].interventions_json, []);
        const complications = Array.isArray(b.complications) ? b.complications : safeJsonParse(existe[0].complications_json, []);

        await db.query(
            `UPDATE estudio_cateterismo SET
                fecha_procedimiento = COALESCE(?, fecha_procedimiento),
                hora_inicio = COALESCE(?, hora_inicio),
                hora_fin = COALESCE(?, hora_fin),
                tipo_cateterismo = COALESCE(?, tipo_cateterismo),
                prioridad_procedimiento = COALESCE(?, prioridad_procedimiento),
                primer_operador = COALESCE(?, primer_operador),
                segundo_operador = COALESCE(?, segundo_operador),
                peso_kg = ?,
                talla_cm = ?,
                superficie_corporal = ?,
                tipo_anestesia = COALESCE(?, tipo_anestesia),
                via_aerea = COALESCE(?, via_aerea),
                sitio_acceso_vascular = COALESCE(?, sitio_acceso_vascular),
                presion_auricula_derecha = COALESCE(?, presion_auricula_derecha),
                presion_ventriculo_derecho = COALESCE(?, presion_ventriculo_derecho),
                presion_arteria_pulmonar = COALESCE(?, presion_arteria_pulmonar),
                presion_auricula_izquierda = COALESCE(?, presion_auricula_izquierda),
                presion_ventriculo_izquierdo = COALESCE(?, presion_ventriculo_izquierdo),
                presion_aorta = COALESCE(?, presion_aorta),
                gasto_cardiaco_qp = ?,
                gasto_cardiaco_qs = ?,
                relacion_qp_qs = ?,
                resistencia_vascular_pulmonar_rvp = ?,
                resistencia_vascular_sistemica_rvs = ?,
                relacion_rp_rs = ?,
                tiempo_fluoroscopia_min = COALESCE(?, tiempo_fluoroscopia_min),
                volumen_contraste_ml = COALESCE(?, volumen_contraste_ml),
                intervencion_realizada = COALESCE(?, intervencion_realizada),
                dispositivo_implantado = COALESCE(?, dispositivo_implantado),
                conclusion_informe = COALESCE(?, conclusion_informe),
                estatus_informe = COALESCE(?, estatus_informe),
                accesses_json = ?,
                conditions_json = ?,
                angiographies_json = ?,
                interventions_json = ?,
                complications_json = ?,
                datos_completos_json = ?,
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`,
            [
                b.fecha_procedimiento,
                b.hora_inicio,
                b.hora_fin,
                b.tipo_cateterismo,
                b.prioridad_procedimiento,
                b.primer_operador,
                b.segundo_operador,
                peso_kg,
                talla_cm,
                superficie_corporal,
                b.tipo_anestesia,
                b.via_aerea,
                b.sitio_acceso_vascular,
                b.presion_auricula_derecha,
                b.presion_ventriculo_derecho,
                b.presion_arteria_pulmonar,
                b.presion_auricula_izquierda,
                b.presion_ventriculo_izquierdo,
                b.presion_aorta,
                qp,
                qs,
                relacion_qp_qs,
                rvp,
                rvs,
                relacion_rp_rs,
                b.tiempo_fluoroscopia_min,
                b.volumen_contraste_ml,
                b.intervencion_realizada,
                b.dispositivo_implantado,
                b.conclusion_informe,
                b.estatus_informe,
                safeJsonStringify(accesses),
                safeJsonStringify(conditions),
                safeJsonStringify(angiographies),
                safeJsonStringify(interventions),
                safeJsonStringify(complications),
                safeJsonStringify(b),
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                id
            ]
        );

        res.json({ status: 'success', message: 'Cateterismo actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar cateterismo:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar cateterismo', error: error.message });
    }
};

/**
 * Eliminar borrador de cateterismo
 */
const deleteCateterismo = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT estatus_informe FROM estudio_cateterismo WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Cateterismo no encontrado' });
        }
        if (rows[0].estatus_informe === 'Finalizado') {
            return res.status(403).json({ status: 'error', message: 'No se puede eliminar un procedimiento finalizado.' });
        }
        await db.query('DELETE FROM estudio_cateterismo WHERE id = ?', [id]);
        res.json({ status: 'success', message: 'Borrador de cateterismo descartado' });
    } catch (error) {
        console.error('Error al eliminar cateterismo:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al eliminar', error: error.message });
    }
};

module.exports = {
    getCateterismos,
    getCateterismoPorId,
    createCateterismo,
    updateCateterismo,
    deleteCateterismo
};
