// backend/controllers/precargaReferencia/detallesReferenciaService.js

/**
 * Reemplaza en bucle los exámenes en la tabla `laboratorios` para un `registro_solicitud_id`
 */
const replaceLaboratoriosReferencia = async (connection, registroSolicitudId, pacienteId, laboratorios = [], audit) => {
    await connection.query('DELETE FROM laboratorios WHERE registro_solicitud_id = ?', [registroSolicitudId]);

    if (!Array.isArray(laboratorios) || laboratorios.length === 0) {
        return 0;
    }

    let count = 0;
    for (let i = 0; i < laboratorios.length; i++) {
        const lab = laboratorios[i];
        if (!lab || !lab.prueba) continue;

        await connection.query(
            `INSERT INTO laboratorios (
                registro_solicitud_id, paciente_id, prueba, resultado, unidad, estado, fecha, orden,
                estatus, audit_usu_id, audit_ip, audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            [
                registroSolicitudId,
                pacienteId,
                String(lab.prueba).trim().slice(0, 150),
                lab.resultado !== undefined && lab.resultado !== null ? String(lab.resultado).trim().slice(0, 255) : '',
                lab.unidad ? String(lab.unidad).trim().slice(0, 50) : null,
                lab.estado ? String(lab.estado).trim().slice(0, 50) : 'Disponible',
                lab.fecha || null,
                i + 1,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );
        count++;
    }
    return count;
};

/**
 * Reemplaza en bucle las evaluaciones realizadas en `referencia_evaluacion` para un `registro_solicitud_id`
 */
const replaceEvaluacionesReferencia = async (connection, registroSolicitudId, pacienteId, evaluaciones = [], audit) => {
    await connection.query('DELETE FROM referencia_evaluacion WHERE registro_solicitud_id = ?', [registroSolicitudId]);

    if (!Array.isArray(evaluaciones) || evaluaciones.length === 0) {
        return 0;
    }

    let count = 0;
    for (let i = 0; i < evaluaciones.length; i++) {
        const ev = evaluaciones[i];
        if (!ev || !ev.tipo) continue;

        const estado = ev.estado ? String(ev.estado).trim() : 'No documentado';
        const fecha = estado === 'Sí' && ev.fecha ? ev.fecha : null;
        const resumen = estado === 'Sí' && ev.resumen ? String(ev.resumen).trim() : null;

        await connection.query(
            `INSERT INTO referencia_evaluacion (
                registro_solicitud_id, paciente_id, tipo, estado, fecha, resumen, orden,
                estatus, audit_usu_id, audit_ip, audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            [
                registroSolicitudId,
                pacienteId,
                String(ev.tipo).trim().slice(0, 150),
                estado.slice(0, 50),
                fecha,
                resumen,
                i + 1,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );
        count++;
    }
    return count;
};

/**
 * Registra evento de auditoría funcional en `referencia_historial`
 */
const registrarHistorialReferencia = async (connection, registroSolicitudId, pacienteId, accion, estadoAnterior, estadoNuevo, audit) => {
    await connection.query(
        `INSERT INTO referencia_historial (
            registro_solicitud_id, paciente_id, accion, estado_anterior, estado_nuevo,
            audit_usu_id, audit_ip, audit_dep_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            registroSolicitudId,
            pacienteId,
            String(accion).slice(0, 255),
            estadoAnterior || null,
            estadoNuevo || null,
            audit.audit_usu_id,
            audit.audit_ip,
            audit.audit_dep_id
        ]
    );
};

module.exports = {
    replaceLaboratoriosReferencia,
    replaceEvaluacionesReferencia,
    registrarHistorialReferencia
};
