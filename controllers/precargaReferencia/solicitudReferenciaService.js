// backend/controllers/precargaReferencia/solicitudReferenciaService.js

const SOLO_LETRAS_NOMBRE_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+(?:\s+[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+)*$/;

const isValidYMD = (val) => {
    if (!val) return false;
    const s = String(val).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const getTodayLocalYMD = () => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
};

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

    // Resolver centro_salud_id y centro_origen_nombre (con fallback al centro asignado del usuario si rol_id = 6)
    let finalCentroId = centro_salud_id ? Number(centro_salud_id) : null;
    if (!finalCentroId && Number(user?.rol_id) === 6 && user?.centro_salud_id) {
        const parsed = String(user.centro_salud_id).replace(/[\[\]\s"]/g, '').split(',').map(Number).find(n => n > 0 && !isNaN(n));
        if (parsed) finalCentroId = parsed;
    }
    let finalCentroNombre = centro_origen_nombre ? String(centro_origen_nombre).trim().slice(0, 255) : null;

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

    if (!finalCentroId) {
        const err = new Error('Debe especificar un centro regional de origen válido.');
        err.statusCode = 400;
        throw err;
    }

    let fechaRefFinal = getTodayLocalYMD();
    if (fecha_referencia !== undefined && fecha_referencia !== null && String(fecha_referencia).trim() !== '') {
        const cleanRef = String(fecha_referencia).trim();
        if (!isValidYMD(cleanRef)) {
            const err = new Error('La fecha de referencia debe tener el formato válido YYYY-MM-DD.');
            err.statusCode = 400;
            throw err;
        }
        if (cleanRef > getTodayLocalYMD()) {
            const err = new Error('La fecha de referencia no puede ser posterior al día de hoy.');
            err.statusCode = 400;
            throw err;
        }
        fechaRefFinal = cleanRef;
    }
    const esEnviada = String(estado_referencia).toLowerCase() === 'enviada';
    const estadoReferenciaFinal = esEnviada ? 'Enviada' : 'Borrador';
    const estatusSolicitud = esEnviada ? 'Pendiente' : 'Borrador';
    const fechaEnvio = esEnviada ? new Date() : null;

    let satO2Val = null;
    if (saturacion_o2 !== undefined && saturacion_o2 !== null && String(saturacion_o2).trim() !== '') {
        const numSat = Number(saturacion_o2);
        if (isNaN(numSat) || numSat < 0 || numSat > 100) {
            const err = new Error('La saturación de O₂ debe ser un valor numérico entre 0 y 100.');
            err.statusCode = 400;
            throw err;
        }
        satO2Val = numSat;
    }

    const cirugiaEstadoFinal = cirugia_paliativa_estado || 'Desconocido';
    const cirugiaTipoFinal = cirugiaEstadoFinal === 'Sí' && cirugia_paliativa_tipo
        ? String(cirugia_paliativa_tipo).trim().slice(0, 255)
        : null;
    let cirugiaFechaFinal = null;
    if (cirugiaEstadoFinal === 'Sí' && cirugia_paliativa_fecha && String(cirugia_paliativa_fecha).trim() !== '') {
        const fCir = String(cirugia_paliativa_fecha).trim();
        if (!isValidYMD(fCir)) {
            const err = new Error('La fecha de cirugía paliativa no es válida.');
            err.statusCode = 400;
            throw err;
        }
        cirugiaFechaFinal = fCir;
    }

    const medicoNombreClean = medico_nombre_completo ? String(medico_nombre_completo).trim().slice(0, 150) : null;
    const medicoDocClean = medico_documento ? String(medico_documento).trim().slice(0, 50) : null;
    const medicoEspClean = medico_especialidad ? String(medico_especialidad).trim().slice(0, 100) : null;

    if (medicoNombreClean && !SOLO_LETRAS_NOMBRE_REGEX.test(medicoNombreClean)) {
        const err = new Error('El nombre y apellidos del médico remitente solo debe contener letras y acentos (sin números ni caracteres especiales).');
        err.statusCode = 400;
        throw err;
    }
    if (medicoDocClean && !/^\d+$/.test(medicoDocClean)) {
        const err = new Error('La cédula del médico remitente solo debe contener dígitos numéricos.');
        err.statusCode = 400;
        throw err;
    }
    if (esEnviada) {
        if (!medicoNombreClean) {
            const err = new Error('Debe indicar el nombre y apellidos del médico remitente.');
            err.statusCode = 400;
            throw err;
        }
        if (!medicoDocClean) {
            const err = new Error('Debe indicar la cédula del médico remitente.');
            err.statusCode = 400;
            throw err;
        }
        if (!medicoEspClean) {
            const err = new Error('Debe indicar la especialidad del médico remitente.');
            err.statusCode = 400;
            throw err;
        }
    }

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

    let fechaCitaFinal = null;
    if (body.fecha_cita !== undefined && body.fecha_cita !== null && String(body.fecha_cita).trim() !== '') {
        const cleanCita = String(body.fecha_cita).trim();
        if (!isValidYMD(cleanCita)) {
            const err = new Error('La fecha asignada de cita debe tener un formato válido.');
            err.statusCode = 400;
            throw err;
        }
        fechaCitaFinal = cleanCita;
    }
    const tipoCitaParsed = body.tipo_cita_id ? Number(body.tipo_cita_id) : null;
    const tipoCitaIdFinal = tipoCitaParsed && !isNaN(tipoCitaParsed) ? tipoCitaParsed : null;
    const procParsed = body.procedimiento_planificado_id ? Number(body.procedimiento_planificado_id) : null;
    const procPlanificadoIdFinal = procParsed && !isNaN(procParsed) ? procParsed : null;
    const diagParsed = body.diagnostico_motivo_id ? Number(body.diagnostico_motivo_id) : null;
    const diagMotivoIdFinal = diagParsed && !isNaN(diagParsed) ? diagParsed : null;
    let diagMotivoTexto = body.diagnostico_motivo ? String(body.diagnostico_motivo).trim().slice(0, 255) : null;

    if (tipoCitaIdFinal) {
        const [tcRows] = await connection.query('SELECT id FROM lista_tipo_general WHERE id = ? LIMIT 1', [tipoCitaIdFinal]);
        if (tcRows.length === 0) {
            const err = new Error('El tipo de consulta seleccionado no es válido.');
            err.statusCode = 400;
            throw err;
        }
    }
    if (procPlanificadoIdFinal) {
        const [tpRows] = await connection.query('SELECT id FROM lista_tipo_general WHERE id = ? LIMIT 1', [procPlanificadoIdFinal]);
        if (tpRows.length === 0) {
            const err = new Error('El procedimiento cardiovascular seleccionado no es válido.');
            err.statusCode = 400;
            throw err;
        }
    }

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
