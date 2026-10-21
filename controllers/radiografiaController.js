// backend/controllers/radiografiaController.js
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
             VALUES (?, 4, 1, CURDATE(), 'Pendiente', 'Solicitud inicial generada automáticamente para radiografía', '1', '127.0.0.1', '1')`,
            [solicitudIdOrPacienteId]
        );
        return ins.insertId;
    }
    return null;
};

const diffDays = (dateStrA, dateStrB) => {
    if (!dateStrA || !dateStrB) return null;
    const tA = Date.parse(dateStrA + 'T00:00:00Z');
    const tB = Date.parse(dateStrB + 'T00:00:00Z');
    if (isNaN(tA) || isNaN(tB)) return null;
    const diff = Math.floor((tA - tB) / 86400000);
    return diff >= 0 ? diff : null;
};

/**
 * Obtener listado de radiografías con soporte para filtros
 */
const getRadiografias = async (req, res) => {
    try {
        const { registro_solicitud_id, paciente_id, hospitalizacion_id } = req.query;
        let query = `
            SELECT r.*,
                   rs.paciente_id,
                   CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                   p.numero_historia_clinica
            FROM estudio_radiografia r
            LEFT JOIN registro_solicitud rs ON r.registro_solicitud_id = rs.id
            LEFT JOIN paciente p ON rs.paciente_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (registro_solicitud_id) {
            query += ' AND r.registro_solicitud_id = ?';
            params.push(registro_solicitud_id);
        }
        if (paciente_id) {
            query += ' AND rs.paciente_id = ?';
            params.push(paciente_id);
        }
        if (hospitalizacion_id) {
            query += ' AND r.hospitalizacion_id = ?';
            params.push(hospitalizacion_id);
        }
        query += ' ORDER BY r.fecha_estudio DESC, r.id DESC';

        const [rows] = await db.query(query, params);

        const dataParsed = rows.map(r => ({
            ...r,
            devices: safeJsonParse(r.devices_json, []),
            seccion_context: safeJsonParse(r.seccion_context_json, {}),
            seccion_quality: safeJsonParse(r.seccion_quality_json, {}),
            seccion_lung: safeJsonParse(r.seccion_lung_json, {}),
            seccion_pleura: safeJsonParse(r.seccion_pleura_json, {}),
            seccion_heart: safeJsonParse(r.seccion_heart_json, {}),
            seccion_devices: safeJsonParse(r.seccion_devices_json, {}),
            seccion_other: safeJsonParse(r.seccion_other_json, {}),
            datos_completos: safeJsonParse(r.datos_completos_json, {})
        }));

        res.json({ status: 'success', data: dataParsed });
    } catch (error) {
        console.error('Error al consultar radiografías:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar radiografías', error: error.message });
    }
};

/**
 * Obtener un estudio específico por ID
 */
const getRadiografiaPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT r.*,
                    rs.paciente_id,
                    CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) AS paciente_nombre,
                    p.numero_historia_clinica
             FROM estudio_radiografia r
             LEFT JOIN registro_solicitud rs ON r.registro_solicitud_id = rs.id
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE r.id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Estudio de radiografía no encontrado' });
        }

        const r = rows[0];
        const dataParsed = {
            ...r,
            devices: safeJsonParse(r.devices_json, []),
            seccion_context: safeJsonParse(r.seccion_context_json, {}),
            seccion_quality: safeJsonParse(r.seccion_quality_json, {}),
            seccion_lung: safeJsonParse(r.seccion_lung_json, {}),
            seccion_pleura: safeJsonParse(r.seccion_pleura_json, {}),
            seccion_heart: safeJsonParse(r.seccion_heart_json, {}),
            seccion_devices: safeJsonParse(r.seccion_devices_json, {}),
            seccion_other: safeJsonParse(r.seccion_other_json, {}),
            datos_completos: safeJsonParse(r.datos_completos_json, {})
        };

        res.json({ status: 'success', data: dataParsed });
    } catch (error) {
        console.error('Error al obtener radiografía:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar estudio', error: error.message });
    }
};

/**
 * Registrar un nuevo estudio radiológico (HCIL V17 estructurado)
 */
const createRadiografia = async (req, res) => {
    try {
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const b = req.body;

        const targetSolicitudId = b.registro_solicitud_id || await resolverSolicitudId(b.paciente_id);
        if (!targetSolicitudId) {
            return res.status(400).json({ status: 'error', message: 'registro_solicitud_id o paciente_id requerido' });
        }

        const fecha_estudio = b.fecha_estudio || b.xray_date || new Date().toISOString().split('T')[0];
        const hora_estudio = b.hora_estudio || b.xray_time || null;
        const fecha_hora_estudio = b.fecha_hora_estudio || (fecha_estudio && hora_estudio ? `${fecha_estudio} ${hora_estudio}` : null);
        const admission_date = b.admission_date || null;
        const surgery_date = b.surgery_date || null;

        // Cálculos temporales derivados
        let hospital_day = b.hospital_day ?? null;
        if (hospital_day === null && admission_date && fecha_estudio) {
            const diff = diffDays(fecha_estudio, admission_date);
            if (diff !== null) hospital_day = diff + 1;
        }

        let postoperative_day = b.postoperative_day ?? null;
        if (postoperative_day === null && surgery_date && fecha_estudio) {
            const diff = diffDays(fecha_estudio, surgery_date);
            if (diff !== null) postoperative_day = diff;
        }

        // Dispositivos y derivaciones automáticas
        const devices = Array.isArray(b.devices) ? b.devices : (Array.isArray(b.xray_devices) ? b.xray_devices : []);
        const hasDevice = (type) => devices.some(d => d.device_type === type);
        const ett_present = b.ett_present ?? (hasDevice('Tubo endotraqueal') ? 1 : 0);
        const cvc_present = b.cvc_present ?? ((hasDevice('Catéter venoso central') || hasDevice('PICC')) ? 1 : 0);
        const drain_count = devices.filter(d => ['Drenaje pleural', 'Drenaje mediastinal'].includes(d.device_type)).length;
        const thoracic_drain_present = b.thoracic_drain_present ?? (drain_count > 0 ? 1 : 0);
        const ecmo_cannula_present = b.ecmo_cannula_present ?? (hasDevice('ECMO') ? 1 : 0);

        // Cardiomegalia automática por ICT
        const indice_cardiotoracico = b.indice_cardiotoracico || b.cardiothoracic_ratio || null;
        let cardiomegalia = b.cardiomegalia || b.cardiac_silhouette_size || null;
        if (!cardiomegalia && indice_cardiotoracico) {
            cardiomegalia = Number(indice_cardiotoracico) > 0.50 ? 'Cardiomegalia' : 'Normal';
        }

        const chest_xray_uuid = b.chest_xray_uuid || b.id || crypto.randomUUID();
        const conclusion_informe = b.conclusion_informe || b.cardiovascular_xray_summary || 'Sin conclusión informada';
        const estatus_informe = b.estatus_informe || (b.finalized ? 'Finalizado' : 'Borrador');

        // Secciones JSON estructuradas
        const seccion_context = {
            chest_xray_id: chest_xray_uuid,
            xray_date: fecha_estudio,
            xray_time: hora_estudio,
            xray_datetime: fecha_hora_estudio,
            hospital_day,
            postoperative_day,
            xray_location: b.xray_location,
            xray_interpreter_id: b.xray_interpreter_id,
            xray_indication: b.xray_indication,
            xray_indication_other: b.xray_indication_other,
            xray_control_type: b.xray_control_type,
            related_surgery_id: b.related_surgery_id,
            related_procedure_id: b.related_procedure_id
        };

        const seccion_quality = {
            proyeccion: b.proyeccion || b.xray_projection,
            patient_position: b.patient_position,
            inspiration_quality: b.inspiration_quality,
            rotation_status: b.rotation_status,
            penetration_quality: b.penetration_quality,
            calidad_tecnica: b.calidad_tecnica || b.xray_quality,
            xray_quality_limitation: b.xray_quality_limitation
        };

        const seccion_lung = {
            lung_expansion: b.lung_expansion,
            lung_parenchyma_status: b.lung_parenchyma_status,
            atelectasis_present: b.atelectasis_present,
            atelectasis_location: b.atelectasis_location,
            consolidation_present: b.consolidation_present,
            consolidation_location: b.consolidation_location,
            interstitial_opacity: b.interstitial_opacity,
            alveolar_opacity: b.alveolar_opacity,
            hyperinflation_present: b.hyperinflation_present,
            lung_other_findings: b.lung_other_findings,
            flujo_pulmonar: b.flujo_pulmonar || b.pulmonary_congestion,
            pulmonary_edema: b.pulmonary_edema,
            pulmonary_edema_distribution: b.pulmonary_edema_distribution,
            interstitial_edema_signs: b.interstitial_edema_signs,
            pulmonary_edema_severity: b.pulmonary_edema_severity
        };

        const seccion_pleura = {
            pleural_effusion: b.pleural_effusion,
            right_pleural_effusion_size: b.right_pleural_effusion_size,
            left_pleural_effusion_size: b.left_pleural_effusion_size,
            pneumothorax: b.pneumothorax,
            pneumothorax_size: b.pneumothorax_size,
            hallazgos_pleurales: b.hallazgos_pleurales || b.pleural_other_findings,
            mediastinum_status: b.mediastinum_status,
            mediastinal_shift: b.mediastinal_shift,
            thymus_visible: b.thymus_visible,
            thymic_appearance: b.thymic_appearance,
            mediastinal_notes: b.mediastinal_notes,
            diaphragm_status: b.diaphragm_status,
            diaphragmatic_paralysis_suspected: b.diaphragmatic_paralysis_suspected,
            diaphragm_notes: b.diaphragm_notes
        };

        const seccion_heart = {
            cardiac_position_xray: b.cardiac_position_xray,
            cardiac_apex_direction: b.cardiac_apex_direction,
            cardiomegalia,
            cardiac_silhouette_size: b.cardiac_silhouette_size,
            indice_cardiotoracico,
            cardiac_silhouette_configuration: b.cardiac_silhouette_configuration,
            cardiac_contour_abnormality: b.cardiac_contour_abnormality,
            cardiac_contour_notes: b.cardiac_contour_notes,
            pulmonary_vascularity: b.pulmonary_vascularity,
            pulmonary_plethora: b.pulmonary_plethora,
            pulmonary_oligemia: b.pulmonary_oligemia,
            vascularity_asymmetry: b.vascularity_asymmetry,
            pulmonary_vascularity_notes: b.pulmonary_vascularity_notes,
            main_pa_segment: b.main_pa_segment,
            right_hilum_status: b.right_hilum_status,
            left_hilum_status: b.left_hilum_status,
            central_pulmonary_arteries: b.central_pulmonary_arteries,
            pulmonary_venous_congestion: b.pulmonary_venous_congestion,
            cephalization_present: b.cephalization_present,
            perihilar_congestion: b.perihilar_congestion,
            pulmonary_venous_notes: b.pulmonary_venous_notes,
            aortic_arch_side_xray: b.aortic_arch_side_xray,
            aortic_knob_status: b.aortic_knob_status,
            great_vessel_contour: b.great_vessel_contour,
            great_vessel_notes: b.great_vessel_notes
        };

        const seccion_devices = {
            ett_present,
            ett_tip_position: b.ett_tip_position,
            ett_distance_to_carina_cm: b.ett_distance_to_carina_cm,
            cvc_present,
            cvc_tip_location: b.cvc_tip_location,
            cvc_position_status: b.cvc_position_status,
            thoracic_drain_present,
            thoracic_drain_count: b.thoracic_drain_count || drain_count,
            thoracic_drain_position_status: b.thoracic_drain_position_status,
            thoracic_drain_notes: b.thoracic_drain_notes,
            ecmo_cannula_present,
            ecmo_cannula_position: b.ecmo_cannula_position,
            mechanical_support_device_visible: b.mechanical_support_device_visible,
            mechanical_support_xray_notes: b.mechanical_support_xray_notes,
            devices
        };

        const seccion_other = {
            bone_findings: b.bone_findings,
            bone_abnormality_notes: b.bone_abnormality_notes,
            soft_tissue_status: b.soft_tissue_status,
            soft_tissue_notes: b.soft_tissue_notes,
            conclusion_informe
        };

        const [result] = await db.query(
            `INSERT INTO estudio_radiografia (
                registro_solicitud_id,
                hospitalizacion_id,
                chest_xray_uuid,
                fecha_estudio,
                hora_estudio,
                fecha_hora_estudio,
                admission_date,
                surgery_date,
                hospital_day,
                postoperative_day,
                xray_location,
                xray_interpreter_id,
                xray_indication,
                xray_indication_other,
                xray_control_type,
                related_surgery_id,
                related_procedure_id,
                proyeccion,
                patient_position,
                inspiration_quality,
                rotation_status,
                penetration_quality,
                calidad_tecnica,
                xray_quality_limitation,
                lung_expansion,
                lung_parenchyma_status,
                atelectasis_present,
                atelectasis_location,
                consolidation_present,
                consolidation_location,
                interstitial_opacity,
                alveolar_opacity,
                hyperinflation_present,
                lung_other_findings,
                flujo_pulmonar,
                pulmonary_edema,
                pulmonary_edema_distribution,
                interstitial_edema_signs,
                pulmonary_edema_severity,
                pleural_effusion,
                right_pleural_effusion_size,
                left_pleural_effusion_size,
                pneumothorax,
                pneumothorax_size,
                hallazgos_pleurales,
                mediastinum_status,
                mediastinal_shift,
                thymus_visible,
                thymic_appearance,
                mediastinal_notes,
                diaphragm_status,
                diaphragmatic_paralysis_suspected,
                diaphragm_notes,
                cardiac_position_xray,
                cardiac_apex_direction,
                cardiomegalia,
                cardiac_silhouette_size,
                indice_cardiotoracico,
                cardiac_silhouette_configuration,
                cardiac_contour_abnormality,
                cardiac_contour_notes,
                pulmonary_vascularity,
                pulmonary_plethora,
                pulmonary_oligemia,
                vascularity_asymmetry,
                pulmonary_vascularity_notes,
                main_pa_segment,
                right_hilum_status,
                left_hilum_status,
                central_pulmonary_arteries,
                pulmonary_venous_congestion,
                cephalization_present,
                perihilar_congestion,
                pulmonary_venous_notes,
                aortic_arch_side_xray,
                aortic_knob_status,
                great_vessel_contour,
                great_vessel_notes,
                ett_present,
                ett_tip_position,
                ett_distance_to_carina_cm,
                cvc_present,
                cvc_tip_location,
                cvc_position_status,
                thoracic_drain_present,
                thoracic_drain_count,
                thoracic_drain_position_status,
                thoracic_drain_notes,
                ecmo_cannula_present,
                ecmo_cannula_position,
                mechanical_support_device_visible,
                mechanical_support_xray_notes,
                dispositivos_tubos,
                devices_json,
                bone_findings,
                bone_abnormality_notes,
                soft_tissue_status,
                soft_tissue_notes,
                conclusion_informe,
                estatus_informe,
                seccion_context_json,
                seccion_quality_json,
                seccion_lung_json,
                seccion_pleura_json,
                seccion_heart_json,
                seccion_devices_json,
                seccion_other_json,
                datos_completos_json,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetSolicitudId,
                b.hospitalizacion_id || null,
                chest_xray_uuid,
                fecha_estudio,
                hora_estudio,
                fecha_hora_estudio,
                admission_date,
                surgery_date,
                hospital_day,
                postoperative_day,
                b.xray_location || null,
                b.xray_interpreter_id || null,
                Array.isArray(b.xray_indication) ? b.xray_indication.join(', ') : (b.xray_indication || null),
                b.xray_indication_other || null,
                b.xray_control_type || null,
                b.related_surgery_id || null,
                b.related_procedure_id || null,
                b.proyeccion || b.xray_projection || 'Posteroanterior (PA)',
                b.patient_position || null,
                b.inspiration_quality || null,
                b.rotation_status || null,
                b.penetration_quality || null,
                b.calidad_tecnica || b.xray_quality || 'Adecuada',
                b.xray_quality_limitation || null,
                b.lung_expansion || null,
                b.lung_parenchyma_status || null,
                b.atelectasis_present ? 1 : 0,
                Array.isArray(b.atelectasis_location) ? b.atelectasis_location.join(', ') : (b.atelectasis_location || null),
                b.consolidation_present ? 1 : 0,
                Array.isArray(b.consolidation_location) ? b.consolidation_location.join(', ') : (b.consolidation_location || null),
                b.interstitial_opacity || null,
                b.alveolar_opacity || null,
                b.hyperinflation_present ? 1 : 0,
                b.lung_other_findings || null,
                b.flujo_pulmonar || b.pulmonary_congestion || null,
                b.pulmonary_edema || null,
                b.pulmonary_edema_distribution || null,
                Array.isArray(b.interstitial_edema_signs) ? b.interstitial_edema_signs.join(', ') : (b.interstitial_edema_signs || null),
                b.pulmonary_edema_severity || null,
                b.pleural_effusion || null,
                b.right_pleural_effusion_size || null,
                b.left_pleural_effusion_size || null,
                b.pneumothorax || null,
                b.pneumothorax_size || null,
                b.hallazgos_pleurales || b.pleural_other_findings || null,
                b.mediastinum_status || null,
                b.mediastinal_shift || null,
                b.thymus_visible || null,
                b.thymic_appearance || null,
                b.mediastinal_notes || null,
                b.diaphragm_status || null,
                b.diaphragmatic_paralysis_suspected || null,
                b.diaphragm_notes || null,
                b.cardiac_position_xray || null,
                b.cardiac_apex_direction || null,
                cardiomegalia,
                b.cardiac_silhouette_size || null,
                indice_cardiotoracico,
                b.cardiac_silhouette_configuration || null,
                b.cardiac_contour_abnormality ? 1 : 0,
                b.cardiac_contour_notes || null,
                b.pulmonary_vascularity || null,
                b.pulmonary_plethora ? 1 : 0,
                b.pulmonary_oligemia ? 1 : 0,
                b.vascularity_asymmetry || null,
                b.pulmonary_vascularity_notes || null,
                b.main_pa_segment || null,
                b.right_hilum_status || null,
                b.left_hilum_status || null,
                b.central_pulmonary_arteries || null,
                b.pulmonary_venous_congestion || null,
                b.cephalization_present || null,
                b.perihilar_congestion || null,
                b.pulmonary_venous_notes || null,
                b.aortic_arch_side_xray || null,
                b.aortic_knob_status || null,
                b.great_vessel_contour || null,
                b.great_vessel_notes || null,
                ett_present ? 1 : 0,
                b.ett_tip_position || null,
                b.ett_distance_to_carina_cm || null,
                cvc_present ? 1 : 0,
                b.cvc_tip_location || null,
                b.cvc_position_status || null,
                thoracic_drain_present ? 1 : 0,
                b.thoracic_drain_count || drain_count,
                b.thoracic_drain_position_status || null,
                b.thoracic_drain_notes || null,
                ecmo_cannula_present ? 1 : 0,
                b.ecmo_cannula_position || null,
                b.mechanical_support_device_visible ? 1 : 0,
                b.mechanical_support_xray_notes || null,
                b.dispositivos_tubos || (devices.length > 0 ? `${devices.length} dispositivos registrados` : null),
                safeJsonStringify(devices),
                b.bone_findings || null,
                b.bone_abnormality_notes || null,
                b.soft_tissue_status || null,
                b.soft_tissue_notes || null,
                conclusion_informe,
                estatus_informe,
                safeJsonStringify(seccion_context),
                safeJsonStringify(seccion_quality),
                safeJsonStringify(seccion_lung),
                safeJsonStringify(seccion_pleura),
                safeJsonStringify(seccion_heart),
                safeJsonStringify(seccion_devices),
                safeJsonStringify(seccion_other),
                safeJsonStringify(b),
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        res.status(201).json({
            status: 'success',
            message: 'Informe radiológico estructurado guardado exitosamente',
            id: result.insertId,
            chest_xray_uuid,
            registro_solicitud_id: targetSolicitudId,
            estatus_informe
        });
    } catch (error) {
        console.error('Error al registrar radiografía:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al registrar radiografía', error: error.message });
    }
};

/**
 * Actualizar estudio existente respetando inmutabilidad clínica
 */
const updateRadiografia = async (req, res) => {
    try {
        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        const [existe] = await db.query('SELECT * FROM estudio_radiografia WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Informe radiológico no encontrado' });
        }

        const estatusActual = existe[0].estatus_informe;
        if ((estatusActual === 'Finalizado' || estatusActual === 'Firmado') && !req.body.forzar_edicion) {
            return res.status(403).json({
                status: 'error',
                message: 'El informe radiológico está Finalizado y bloqueado contra modificaciones por motivos de inmutabilidad clínica.'
            });
        }

        const b = req.body;
        const fecha_estudio = b.fecha_estudio || b.xray_date || existe[0].fecha_estudio;
        const hora_estudio = b.hora_estudio || b.xray_time || existe[0].hora_estudio;
        const admission_date = b.admission_date || existe[0].admission_date;
        const surgery_date = b.surgery_date || existe[0].surgery_date;

        let hospital_day = b.hospital_day ?? existe[0].hospital_day;
        if (admission_date && fecha_estudio) {
            const diff = diffDays(fecha_estudio, admission_date);
            if (diff !== null) hospital_day = diff + 1;
        }

        let postoperative_day = b.postoperative_day ?? existe[0].postoperative_day;
        if (surgery_date && fecha_estudio) {
            const diff = diffDays(fecha_estudio, surgery_date);
            if (diff !== null) postoperative_day = diff;
        }

        const devices = Array.isArray(b.devices) ? b.devices : safeJsonParse(existe[0].devices_json, []);
        const hasDevice = (type) => devices.some(d => d.device_type === type);
        const ett_present = b.ett_present ?? (hasDevice('Tubo endotraqueal') ? 1 : 0);
        const cvc_present = b.cvc_present ?? ((hasDevice('Catéter venoso central') || hasDevice('PICC')) ? 1 : 0);
        const drain_count = devices.filter(d => ['Drenaje pleural', 'Drenaje mediastinal'].includes(d.device_type)).length;
        const thoracic_drain_present = b.thoracic_drain_present ?? (drain_count > 0 ? 1 : 0);
        const ecmo_cannula_present = b.ecmo_cannula_present ?? (hasDevice('ECMO') ? 1 : 0);

        const indice_cardiotoracico = b.indice_cardiotoracico || b.cardiothoracic_ratio || existe[0].indice_cardiotoracico;
        let cardiomegalia = b.cardiomegalia || b.cardiac_silhouette_size || existe[0].cardiomegalia;
        if (!cardiomegalia && indice_cardiotoracico) {
            cardiomegalia = Number(indice_cardiotoracico) > 0.50 ? 'Cardiomegalia' : 'Normal';
        }

        await db.query(
            `UPDATE estudio_radiografia SET
                fecha_estudio = ?,
                hora_estudio = ?,
                admission_date = ?,
                surgery_date = ?,
                hospital_day = ?,
                postoperative_day = ?,
                xray_location = COALESCE(?, xray_location),
                xray_interpreter_id = COALESCE(?, xray_interpreter_id),
                xray_indication = COALESCE(?, xray_indication),
                xray_indication_other = COALESCE(?, xray_indication_other),
                xray_control_type = COALESCE(?, xray_control_type),
                proyeccion = COALESCE(?, proyeccion),
                patient_position = COALESCE(?, patient_position),
                inspiration_quality = COALESCE(?, inspiration_quality),
                rotation_status = COALESCE(?, rotation_status),
                penetration_quality = COALESCE(?, penetration_quality),
                calidad_tecnica = COALESCE(?, calidad_tecnica),
                xray_quality_limitation = COALESCE(?, xray_quality_limitation),
                lung_expansion = COALESCE(?, lung_expansion),
                lung_parenchyma_status = COALESCE(?, lung_parenchyma_status),
                atelectasis_present = ?,
                atelectasis_location = COALESCE(?, atelectasis_location),
                consolidation_present = ?,
                consolidation_location = COALESCE(?, consolidation_location),
                flujo_pulmonar = COALESCE(?, flujo_pulmonar),
                pulmonary_edema = COALESCE(?, pulmonary_edema),
                pleural_effusion = COALESCE(?, pleural_effusion),
                pneumothorax = COALESCE(?, pneumothorax),
                hallazgos_pleurales = COALESCE(?, hallazgos_pleurales),
                mediastinum_status = COALESCE(?, mediastinum_status),
                cardiomegalia = ?,
                indice_cardiotoracico = ?,
                pulmonary_vascularity = COALESCE(?, pulmonary_vascularity),
                ett_present = ?,
                cvc_present = ?,
                thoracic_drain_present = ?,
                ecmo_cannula_present = ?,
                devices_json = ?,
                conclusion_informe = COALESCE(?, conclusion_informe),
                estatus_informe = COALESCE(?, estatus_informe),
                datos_completos_json = ?,
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`,
            [
                fecha_estudio,
                hora_estudio,
                admission_date,
                surgery_date,
                hospital_day,
                postoperative_day,
                b.xray_location,
                b.xray_interpreter_id,
                Array.isArray(b.xray_indication) ? b.xray_indication.join(', ') : b.xray_indication,
                b.xray_indication_other,
                b.xray_control_type,
                b.proyeccion || b.xray_projection,
                b.patient_position,
                b.inspiration_quality,
                b.rotation_status,
                b.penetration_quality,
                b.calidad_tecnica || b.xray_quality,
                b.xray_quality_limitation,
                b.lung_expansion,
                b.lung_parenchyma_status,
                b.atelectasis_present ? 1 : 0,
                Array.isArray(b.atelectasis_location) ? b.atelectasis_location.join(', ') : b.atelectasis_location,
                b.consolidation_present ? 1 : 0,
                Array.isArray(b.consolidation_location) ? b.consolidation_location.join(', ') : b.consolidation_location,
                b.flujo_pulmonar || b.pulmonary_congestion,
                b.pulmonary_edema,
                b.pleural_effusion,
                b.pneumothorax,
                b.hallazgos_pleurales || b.pleural_other_findings,
                b.mediastinum_status,
                cardiomegalia,
                indice_cardiotoracico,
                b.pulmonary_vascularity,
                ett_present ? 1 : 0,
                cvc_present ? 1 : 0,
                thoracic_drain_present ? 1 : 0,
                ecmo_cannula_present ? 1 : 0,
                safeJsonStringify(devices),
                b.conclusion_informe || b.cardiovascular_xray_summary,
                b.estatus_informe,
                safeJsonStringify(b),
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                id
            ]
        );

        res.json({
            status: 'success',
            message: 'Informe radiológico actualizado exitosamente'
        });
    } catch (error) {
        console.error('Error al actualizar radiografía:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar informe', error: error.message });
    }
};

/**
 * Eliminar borrador de radiografía
 */
const deleteRadiografia = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT estatus_informe FROM estudio_radiografia WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Radiografía no encontrada' });
        }
        if (rows[0].estatus_informe === 'Finalizado') {
            return res.status(403).json({ status: 'error', message: 'No se puede eliminar un estudio finalizado.' });
        }
        await db.query('DELETE FROM estudio_radiografia WHERE id = ?', [id]);
        res.json({ status: 'success', message: 'Borrador descartado correctamente' });
    } catch (error) {
        console.error('Error al eliminar radiografía:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al eliminar', error: error.message });
    }
};

module.exports = {
    getRadiografias,
    getRadiografiaPorId,
    createRadiografia,
    updateRadiografia,
    deleteRadiografia
};
