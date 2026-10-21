// controllers/antecedenteController.js
const db = require('../config/db');

/**
 * Función auxiliar para resolver el registro_solicitud_id
 */
const resolverSolicitudId = async (id, connectionOrDb) => {
    if (!id) return null;
    // 1. Verificar si id corresponde directamente a registro_solicitud
    const [sol] = await connectionOrDb.query('SELECT id FROM registro_solicitud WHERE id = ?', [id]);
    if (sol.length > 0) return sol[0].id;

    // 2. Verificar si id corresponde a paciente_id
    const [solPorPac] = await connectionOrDb.query(
        'SELECT id FROM registro_solicitud WHERE paciente_id = ? ORDER BY id DESC LIMIT 1',
        [id]
    );
    if (solPorPac.length > 0) return solPorPac[0].id;

    // 3. Si existe el paciente pero aún no tiene solicitud, crear una inicial
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
 * Obtener antecedentes completos asociados a una solicitud clínica (antecedentes generales, medicamentos habituales y alergias)
 */
const getAntecedentesPorPaciente = async (req, res) => {
    try {
        const { id } = req.params;
        const solicitudId = await resolverSolicitudId(id, db);

        if (!solicitudId) {
            return res.status(404).json({ status: 'error', message: 'Solicitud clínica o paciente no encontrado' });
        }

        // 1. Antecedente general / cardiovascular vinculado a registro_solicitud_id
        const [antecedentes] = await db.query(
            `SELECT * FROM historia_antecedente WHERE registro_solicitud_id = ? ORDER BY id DESC LIMIT 1`,
            [solicitudId]
        );

        // 2. Medicamentos habituales vinculados a registro_solicitud_id
        const [medicamentos] = await db.query(
            `SELECT m.*, 
                    u.nombre AS unidad_nombre,
                    f.nombre AS frecuencia_nombre,
                    v.nombre AS via_nombre
             FROM historia_medicamento_habitual m
             LEFT JOIN lista_tipo_general u ON m.unidad_id = u.id
             LEFT JOIN lista_tipo_general f ON m.frecuencia_id = f.id
             LEFT JOIN lista_tipo_general v ON m.via_administracion_id = v.id
             WHERE m.registro_solicitud_id = ?
             ORDER BY m.id ASC`,
            [solicitudId]
        );

        // 3. Alergias vinculadas a registro_solicitud_id
        const [alergias] = await db.query(
            `SELECT * FROM historia_alergia WHERE registro_solicitud_id = ? ORDER BY id ASC`,
            [solicitudId]
        );

        res.json({
            status: 'success',
            registro_solicitud_id: solicitudId,
            data: {
                antecedente: antecedentes.length > 0 ? antecedentes[0] : null,
                medicamentos,
                alergias
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
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        const targetSolicitudId = req.body.registro_solicitud_id || await resolverSolicitudId(id, connection);
        if (!targetSolicitudId) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Registro de solicitud clínica no encontrado' });
        }

        const {
            semanas_gestacion,
            complicaciones_gestacionales = 'No',
            detalle_complicaciones_gestacionales,
            complicaciones_neonatales = 'No',
            detalle_complicaciones_neonatales,
            cardiopatia_congenita = 'No',
            edad_diagnostico_cc,
            unidad_edad_diagnostico_cc,
            estudios_cardiacos_anormales = 'No',
            estudio_cardiaco_otro,
            hipertension_pulmonar = 'No',
            tipo_hipertension_pulmonar,
            falla_medro = 'No',
            kawasaki = 'No',
            kawasaki_fecha_inicio,
            kawasaki_compromiso_coronario,
            kawasaki_tratamiento,
            fiebre_reumatica = 'No',
            fiebre_reumatica_fecha_inicio,
            sindrome_genetico = 'No',
            sindrome_genetico_otro,
            miopatia = 'No',
            miopatia_otro,
            antecedente_familiar_cv = 'No',
            tiene_hermanos,
            nivel_escolaridad,
            // Repeaters
            medicamentos = [],
            alergias = []
        } = req.body;

        // Comprobar si ya existe registro de antecedentes para esta solicitud
        const [existente] = await connection.query(
            'SELECT id FROM historia_antecedente WHERE registro_solicitud_id = ? LIMIT 1',
            [targetSolicitudId]
        );

        if (existente.length > 0) {
            // Actualizar
            await connection.query(
                `UPDATE historia_antecedente SET
                    semanas_gestacion = ?,
                    complicaciones_gestacionales = ?,
                    detalle_complicaciones_gestacionales = ?,
                    complicaciones_neonatales = ?,
                    detalle_complicaciones_neonatales = ?,
                    cardiopatia_congenita = ?,
                    edad_diagnostico_cc = ?,
                    unidad_edad_diagnostico_cc = ?,
                    estudios_cardiacos_anormales = ?,
                    estudio_cardiaco_otro = ?,
                    hipertension_pulmonar = ?,
                    tipo_hipertension_pulmonar = ?,
                    falla_medro = ?,
                    kawasaki = ?,
                    kawasaki_fecha_inicio = ?,
                    kawasaki_compromiso_coronario = ?,
                    kawasaki_tratamiento = ?,
                    fiebre_reumatica = ?,
                    fiebre_reumatica_fecha_inicio = ?,
                    sindrome_genetico = ?,
                    sindrome_genetico_otro = ?,
                    miopatia = ?,
                    miopatia_otro = ?,
                    antecedente_familiar_cv = ?,
                    tiene_hermanos = ?,
                    nivel_escolaridad = ?,
                    audit_usu_id = ?,
                    audit_ip = ?,
                    audit_dep_id = ?
                 WHERE registro_solicitud_id = ?`,
                [
                    semanas_gestacion || null,
                    complicaciones_gestacionales,
                    detalle_complicaciones_gestacionales || null,
                    complicaciones_neonatales,
                    detalle_complicaciones_neonatales || null,
                    cardiopatia_congenita,
                    edad_diagnostico_cc || null,
                    unidad_edad_diagnostico_cc || null,
                    estudios_cardiacos_anormales,
                    estudio_cardiaco_otro || null,
                    hipertension_pulmonar,
                    tipo_hipertension_pulmonar || null,
                    falla_medro,
                    kawasaki,
                    kawasaki_fecha_inicio || null,
                    kawasaki_compromiso_coronario || null,
                    kawasaki_tratamiento || null,
                    fiebre_reumatica,
                    fiebre_reumatica_fecha_inicio || null,
                    sindrome_genetico,
                    sindrome_genetico_otro || null,
                    miopatia,
                    miopatia_otro || null,
                    antecedente_familiar_cv,
                    tiene_hermanos || null,
                    nivel_escolaridad || null,
                    audit.audit_usu_id,
                    audit.audit_ip,
                    audit.audit_dep_id,
                    targetSolicitudId
                ]
            );
        } else {
            // Insertar
            await connection.query(
                `INSERT INTO historia_antecedente (
                    registro_solicitud_id,
                    semanas_gestacion,
                    complicaciones_gestacionales,
                    detalle_complicaciones_gestacionales,
                    complicaciones_neonatales,
                    detalle_complicaciones_neonatales,
                    cardiopatia_congenita,
                    edad_diagnostico_cc,
                    unidad_edad_diagnostico_cc,
                    estudios_cardiacos_anormales,
                    estudio_cardiaco_otro,
                    hipertension_pulmonar,
                    tipo_hipertension_pulmonar,
                    falla_medro,
                    kawasaki,
                    kawasaki_fecha_inicio,
                    kawasaki_compromiso_coronario,
                    kawasaki_tratamiento,
                    fiebre_reumatica,
                    fiebre_reumatica_fecha_inicio,
                    sindrome_genetico,
                    sindrome_genetico_otro,
                    miopatia,
                    miopatia_otro,
                    antecedente_familiar_cv,
                    tiene_hermanos,
                    nivel_escolaridad,
                    audit_usu_id,
                    audit_ip,
                    audit_dep_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    targetSolicitudId,
                    semanas_gestacion || null,
                    complicaciones_gestacionales,
                    detalle_complicaciones_gestacionales || null,
                    complicaciones_neonatales,
                    detalle_complicaciones_neonatales || null,
                    cardiopatia_congenita,
                    edad_diagnostico_cc || null,
                    unidad_edad_diagnostico_cc || null,
                    estudios_cardiacos_anormales,
                    estudio_cardiaco_otro || null,
                    hipertension_pulmonar,
                    tipo_hipertension_pulmonar || null,
                    falla_medro,
                    kawasaki,
                    kawasaki_fecha_inicio || null,
                    kawasaki_compromiso_coronario || null,
                    kawasaki_tratamiento || null,
                    fiebre_reumatica,
                    fiebre_reumatica_fecha_inicio || null,
                    sindrome_genetico,
                    sindrome_genetico_otro || null,
                    miopatia,
                    miopatia_otro || null,
                    antecedente_familiar_cv,
                    tiene_hermanos || null,
                    nivel_escolaridad || null,
                    audit.audit_usu_id,
                    audit.audit_ip,
                    audit.audit_dep_id
                ]
            );
        }

        // Sincronizar medicamentos habituales vinculados a registro_solicitud_id
        await connection.query('DELETE FROM historia_medicamento_habitual WHERE registro_solicitud_id = ?', [targetSolicitudId]);
        if (Array.isArray(medicamentos) && medicamentos.length > 0) {
            for (const med of medicamentos) {
                if (med.nombre_medicamento && med.nombre_medicamento.trim()) {
                    await connection.query(
                        `INSERT INTO historia_medicamento_habitual (
                            registro_solicitud_id,
                            nombre_medicamento,
                            dosis,
                            unidad_id,
                            frecuencia_id,
                            via_administracion_id,
                            observacion,
                            audit_usu_id,
                            audit_ip,
                            audit_dep_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            targetSolicitudId,
                            med.nombre_medicamento.trim(),
                            med.dosis || null,
                            med.unidad_id || null,
                            med.frecuencia_id || null,
                            med.via_administracion_id || null,
                            med.observacion || null,
                            audit.audit_usu_id,
                            audit.audit_ip,
                            audit.audit_dep_id
                        ]
                    );
                }
            }
        }

        // Sincronizar alergias vinculadas a registro_solicitud_id
        await connection.query('DELETE FROM historia_alergia WHERE registro_solicitud_id = ?', [targetSolicitudId]);
        if (Array.isArray(alergias) && alergias.length > 0) {
            for (const al of alergias) {
                if (al.alergeno && al.alergeno.trim()) {
                    await connection.query(
                        `INSERT INTO historia_alergia (
                            registro_solicitud_id,
                            alergeno,
                            reaccion,
                            severidad,
                            audit_usu_id,
                            audit_ip,
                            audit_dep_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            targetSolicitudId,
                            al.alergeno.trim(),
                            al.reaccion || null,
                            al.severidad || null,
                            audit.audit_usu_id,
                            audit.audit_ip,
                            audit.audit_dep_id
                        ]
                    );
                }
            }
        }

        await connection.commit();

        res.json({
            status: 'success',
            registro_solicitud_id: targetSolicitudId,
            message: 'Antecedentes clínicos y repeaters guardados exitosamente'
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
