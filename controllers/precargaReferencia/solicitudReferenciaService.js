// backend/controllers/precargaReferencia/solicitudReferenciaService.js

/**
 * Inserta o actualiza la solicitud en registro_solicitud y su cirugía previa en referencia_cirugia_previa
 */
const upsertSolicitudReferencia = async (connection, pacienteId, body, user, audit, solicitudIdExistente = null) => {
    const {
        centro_salud_id,
        centro_origen_nombre,
        fecha_referencia,
        prioridad_solicitada = 'Rutinaria',
        estado_referencia = 'Borrador', // 'Borrador' | 'Enviada'
        paciente_edad_referencia,
        dx_cardiologico_texto,
        dx_cardiologico_certeza = 'Presuntivo',
        estado_clinico_actual = 'Sin documentar',
        motivo_referencia,
        dx_asociado_texto,
        sugerencia_referencia,
        tratamiento_medico_texto,
        saturacion_o2,
        cirugia_paliativa_estado = 'Desconocido',
        cirugia_paliativa_tipo,
        cirugia_paliativa_fecha,
        medico_nombre_completo,
        medico_documento,
        medico_especialidad,
        medico_mms,
        medico_cm,
        completitud_porcentaje = 0
    } = body;

    // Resolver centro_salud_id y centro_origen_nombre
    let finalCentroId = centro_salud_id ? Number(centro_salud_id) : null;
    let finalCentroNombre = centro_origen_nombre ? String(centro_origen_nombre).trim() : null;

    if (!finalCentroId && finalCentroNombre) {
        const [cRows] = await connection.query(
            'SELECT id, descripcion FROM lista_centro_salud WHERE LOWER(descripcion) = LOWER(?) LIMIT 1',
            [finalCentroNombre]
        );
        if (cRows.length > 0) {
            finalCentroId = cRows[0].id;
            finalCentroNombre = cRows[0].descripcion;
        }
    } else if (finalCentroId && !finalCentroNombre) {
        const [cRows] = await connection.query(
            'SELECT descripcion FROM lista_centro_salud WHERE id = ? LIMIT 1',
            [finalCentroId]
        );
        if (cRows.length > 0) finalCentroNombre = cRows[0].descripcion;
    }

    const fechaRefFinal = fecha_referencia || new Date().toISOString().split('T')[0];
    const esEnviada = String(estado_referencia).toLowerCase() === 'enviada';
    const estadoReferenciaFinal = esEnviada ? 'Enviada' : 'Borrador';
    const estatusSolicitud = esEnviada ? 'Pendiente' : 'Borrador';
    const fechaEnvio = esEnviada ? new Date() : null;

    const satO2Val = (saturacion_o2 !== undefined && saturacion_o2 !== null && saturacion_o2 !== '')
        ? Number(saturacion_o2)
        : null;

    const cirugiaEstadoFinal = cirugia_paliativa_estado || 'Desconocido';
    const cirugiaTipoFinal = cirugiaEstadoFinal === 'Sí' ? (cirugia_paliativa_tipo || null) : null;
    const cirugiaFechaFinal = (cirugiaEstadoFinal === 'Sí' && cirugia_paliativa_fecha) ? cirugia_paliativa_fecha : null;

    const diagMotivoCorto = (dx_cardiologico_texto || motivo_referencia || 'Referencia cardiológica pediátrica').slice(0, 250);
    const usuarioRefId = user?.id ? Number(user.id) : null;

    let finalSolicitudId = solicitudIdExistente ? Number(solicitudIdExistente) : null;
    let estadoAnterior = null;

    if (finalSolicitudId) {
        const [prevRows] = await connection.query('SELECT id, estado_referencia, fecha_envio_referencia FROM registro_solicitud WHERE id = ? LIMIT 1', [finalSolicitudId]);
        if (prevRows.length === 0) {
            const err = new Error('El registro de solicitud de referencia no existe.');
            err.statusCode = 404;
            throw err;
        }
        estadoAnterior = prevRows[0].estado_referencia || 'Borrador';
        const fechaEnvioFinal = prevRows[0].fecha_envio_referencia || fechaEnvio;

        await connection.query(
            `UPDATE registro_solicitud SET
                paciente_id = ?,
                centro_salud_id = ?,
                centro_origen_nombre = ?,
                fecha_referencia = ?,
                prioridad_solicitada = ?,
                diagnostico_motivo = ?,
                dx_cardiologico_texto = ?,
                dx_cardiologico_certeza = ?,
                estado_clinico_actual = ?,
                motivo_referencia = ?,
                dx_asociado_texto = ?,
                sugerencia_referencia = ?,
                tratamiento_medico_texto = ?,
                saturacion_o2 = ?,
                cirugia_paliativa_estado = ?,
                cirugia_paliativa_tipo = ?,
                cirugia_paliativa_fecha = ?,
                medico_nombre_completo = ?,
                medico_documento = ?,
                medico_especialidad = ?,
                medico_mms = ?,
                medico_cm = ?,
                completitud_porcentaje = ?,
                paciente_edad_referencia = ?,
                estatus = ?,
                estado_referencia = ?,
                fecha_envio_referencia = ?,
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`,
            [
                pacienteId,
                finalCentroId,
                finalCentroNombre,
                fechaRefFinal,
                prioridad_solicitada,
                diagMotivoCorto,
                dx_cardiologico_texto || null,
                dx_cardiologico_certeza,
                estado_clinico_actual,
                motivo_referencia || null,
                dx_asociado_texto || null,
                sugerencia_referencia || null,
                tratamiento_medico_texto || null,
                satO2Val,
                cirugiaEstadoFinal,
                cirugiaTipoFinal,
                cirugiaFechaFinal,
                medico_nombre_completo || null,
                medico_documento || null,
                medico_especialidad || null,
                medico_mms || null,
                medico_cm || null,
                Number(completitud_porcentaje) || 0,
                paciente_edad_referencia || null,
                estatusSolicitud,
                estadoReferenciaFinal,
                fechaEnvioFinal,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                finalSolicitudId
            ]
        );
    } else {
        const [insSol] = await connection.query(
            `INSERT INTO registro_solicitud (
                paciente_id, centro_salud_id, centro_origen_nombre, tipo_operacion_id,
                fecha_solicitud, fecha_referencia, prioridad_solicitada, tipo_cita_id,
                diagnostico_motivo, dx_cardiologico_texto, dx_cardiologico_certeza,
                estado_clinico_actual, motivo_referencia, dx_asociado_texto,
                sugerencia_referencia, tratamiento_medico_texto, saturacion_o2,
                cirugia_paliativa_estado, cirugia_paliativa_tipo, cirugia_paliativa_fecha,
                medico_nombre_completo, medico_documento, medico_especialidad,
                medico_mms, medico_cm, completitud_porcentaje, usuario_referencia_id,
                paciente_edad_referencia, estatus, estado_referencia, fecha_envio_referencia,
                observacion_general, audit_usu_id, audit_ip, audit_dep_id
            ) VALUES (?, ?, ?, 1, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                pacienteId,
                finalCentroId,
                finalCentroNombre,
                fechaRefFinal,
                fechaRefFinal,
                prioridad_solicitada,
                diagMotivoCorto,
                dx_cardiologico_texto || null,
                dx_cardiologico_certeza,
                estado_clinico_actual,
                motivo_referencia || null,
                dx_asociado_texto || null,
                sugerencia_referencia || null,
                tratamiento_medico_texto || null,
                satO2Val,
                cirugiaEstadoFinal,
                cirugiaTipoFinal,
                cirugiaFechaFinal,
                medico_nombre_completo || null,
                medico_documento || null,
                medico_especialidad || null,
                medico_mms || null,
                medico_cm || null,
                Number(completitud_porcentaje) || 0,
                usuarioRefId,
                paciente_edad_referencia || null,
                estatusSolicitud,
                estadoReferenciaFinal,
                fechaEnvio,
                motivo_referencia || 'Precarga desde Centro de Referencia',
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );
        finalSolicitudId = insSol.insertId;
    }

    // Sincronizar tabla referencia_cirugia_previa
    await connection.query('DELETE FROM referencia_cirugia_previa WHERE registro_solicitud_id = ?', [finalSolicitudId]);
    if (cirugiaEstadoFinal && cirugiaEstadoFinal !== 'Desconocido') {
        await connection.query(
            `INSERT INTO referencia_cirugia_previa (
                registro_solicitud_id, paciente_id, cirugia_paliativa_estado, tipo_cirugia, fecha_cirugia,
                estatus, audit_usu_id, audit_ip, audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            [
                finalSolicitudId,
                pacienteId,
                cirugiaEstadoFinal,
                cirugiaTipoFinal,
                cirugiaFechaFinal,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );
    }

    return {
        registro_solicitud_id: finalSolicitudId,
        estado_referencia: estadoReferenciaFinal,
        estado_anterior: estadoAnterior
    };
};

/**
 * Actualiza únicamente los campos de programación de cita (fecha_cita, tipo_cita_id,
 * procedimiento_planificado_id, diagnostico_motivo_id y diagnostico_motivo) para rol_id = 2 (Red de Enlace)
 */
const updateCitaRedEnlace = async (connection, solicitudId, body, audit) => {
    const [prevRows] = await connection.query(
        'SELECT id, estado_referencia, estatus FROM registro_solicitud WHERE id = ? LIMIT 1',
        [solicitudId]
    );
    if (prevRows.length === 0) {
        const err = new Error('El registro de solicitud de referencia no existe.');
        err.statusCode = 404;
        throw err;
    }

    const fechaCitaFinal = body.fecha_cita || null;
    const tipoCitaIdFinal = body.tipo_cita_id ? Number(body.tipo_cita_id) : null;
    const procPlanificadoIdFinal = body.procedimiento_planificado_id ? Number(body.procedimiento_planificado_id) : null;
    const diagMotivoIdFinal = body.diagnostico_motivo_id ? Number(body.diagnostico_motivo_id) : null;
    let diagMotivoTexto = body.diagnostico_motivo ? String(body.diagnostico_motivo).trim() : null;

    if (diagMotivoIdFinal && !diagMotivoTexto) {
        const [diagRows] = await connection.query(
            'SELECT nombre FROM lista_tipo_general WHERE id = ? LIMIT 1',
            [diagMotivoIdFinal]
        );
        if (diagRows.length > 0) diagMotivoTexto = diagRows[0].nombre;
    }

    const estadoActual = prevRows[0].estatus || 'Pendiente';
    const nuevoEstatus = (fechaCitaFinal && (estadoActual === 'Borrador' || estadoActual === 'Pendiente'))
        ? 'Programada'
        : estadoActual;

    await connection.query(
        `UPDATE registro_solicitud SET
            fecha_cita = ?,
            tipo_cita_id = ?,
            procedimiento_planificado_id = ?,
            diagnostico_motivo_id = ?,
            diagnostico_motivo = ?,
            estatus = ?,
            audit_usu_id = ?,
            audit_ip = ?,
            audit_dep_id = ?
         WHERE id = ?`,
        [
            fechaCitaFinal,
            tipoCitaIdFinal,
            procPlanificadoIdFinal,
            diagMotivoIdFinal,
            diagMotivoTexto,
            nuevoEstatus,
            audit.audit_usu_id,
            audit.audit_ip,
            audit.audit_dep_id,
            solicitudId
        ]
    );

    return {
        registro_solicitud_id: Number(solicitudId),
        estado_referencia: prevRows[0].estado_referencia || 'Borrador',
        estatus: nuevoEstatus
    };
};

module.exports = {
    upsertSolicitudReferencia,
    updateCitaRedEnlace
};
