// controllers/agendaController.js
const db = require('../config/db');

/**
 * Listar citas/solicitudes de agenda con filtros por fecha, mes, estado, término de búsqueda o paciente
 * Lee directamente de registro_solicitud con JOIN a paciente y catálogos
 */
const getCitas = async (req, res) => {
    try {
        const { fecha, mes, estado, paciente_id, q } = req.query;

        let query = `
            SELECT 
                rs.id,
                rs.id AS solicitud_id,
                rs.id AS registro_solicitud_id,
                rs.paciente_id,
                COALESCE(rs.fecha_cita, rs.fecha_solicitud) AS fecha_cita,
                rs.fecha_solicitud,
                rs.horario_cita,
                rs.horario_cita AS horario,
                rs.tipo_cita_id,
                tc.nombre AS tipo_cita_nombre,
                rs.pediatra_responsable,
                rs.procedimiento_planificado_id,
                COALESCE(tp.nombre, top.nombre, 'Consulta Pediátrica Estándar') AS procedimiento_nombre,
                rs.tipo_operacion_id,
                rs.diagnostico_motivo,
                rs.estatus AS estado_cita,
                rs.estatus,
                rs.observacion_general AS observaciones,
                rs.observacion_general,
                rs.fecha_creacion,
                rs.fecha_actualizacion,
                p.numero_historia_clinica,
                p.estado_residencia,
                p.ciudad_residencia,
                p.direccion_completa,
                CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido) AS paciente_nombre_completo,
                p.primer_nombre,
                p.segundo_nombre,
                p.primer_apellido,
                p.segundo_apellido,
                p.fecha_nacimiento,
                p.edad_informada,
                p.unidad_edad_informada,
                p.numero_documento,
                p.cedula_madre_prefijo,
                p.cedula_madre_numero,
                p.numero_hijo,
                p.es_cedula_madre,
                s.nombre AS sexo_nombre
            FROM registro_solicitud rs
            LEFT JOIN paciente p ON rs.paciente_id = p.id
            LEFT JOIN lista_tipo_general tc ON rs.tipo_cita_id = tc.id
            LEFT JOIN lista_tipo_general tp ON rs.procedimiento_planificado_id = tp.id
            LEFT JOIN tipo_operacion top ON rs.tipo_operacion_id = top.id
            LEFT JOIN lista_tipo_general s ON p.sexo_id = s.id
            WHERE 1=1
        `;

        const params = [];

        if (fecha) {
            query += ' AND (rs.fecha_cita = ? OR (rs.fecha_cita IS NULL AND rs.fecha_solicitud = ?))';
            params.push(fecha, fecha);
        } else if (mes) {
            query += ' AND (rs.fecha_cita LIKE ? OR (rs.fecha_cita IS NULL AND rs.fecha_solicitud LIKE ?))';
            const mesWildcard = `${mes}%`;
            params.push(mesWildcard, mesWildcard);
        }

        if (estado) {
            query += ' AND rs.estatus = ?';
            params.push(estado);
        }

        if (paciente_id) {
            query += ' AND rs.paciente_id = ?';
            params.push(paciente_id);
        }

        if (q) {
            query += ` AND (
                p.numero_historia_clinica LIKE ? OR 
                p.primer_nombre LIKE ? OR 
                p.primer_apellido LIKE ? OR
                CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido) LIKE ? OR
                p.numero_documento LIKE ? OR
                p.cedula_madre_numero LIKE ? OR
                rs.diagnostico_motivo LIKE ? OR
                rs.pediatra_responsable LIKE ?
            )`;
            const term = `%${q}%`;
            params.push(term, term, term, term, term, term, term, term);
        }

        query += ' ORDER BY COALESCE(rs.fecha_cita, rs.fecha_solicitud) DESC, rs.id DESC';

        const [rows] = await db.query(query, params);

        res.json({
            status: 'success',
            total: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error al listar citas de agenda desde registro_solicitud:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar citas de la agenda', error: error.message });
    }
};

/**
 * Obtener detalle de una cita/solicitud específica por ID
 */
const getCitaPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT 
                rs.*,
                rs.id AS solicitud_id,
                rs.id AS registro_solicitud_id,
                COALESCE(rs.fecha_cita, rs.fecha_solicitud) AS fecha_cita,
                rs.horario_cita AS horario,
                rs.estatus AS estado_cita,
                rs.observacion_general AS observaciones,
                tc.nombre AS tipo_cita_nombre,
                COALESCE(tp.nombre, top.nombre, 'Consulta Pediátrica Estándar') AS procedimiento_nombre,
                p.numero_historia_clinica,
                p.estado_residencia,
                p.ciudad_residencia,
                p.direccion_completa,
                CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido) AS paciente_nombre_completo,
                p.primer_nombre,
                p.segundo_nombre,
                p.primer_apellido,
                p.segundo_apellido,
                p.fecha_nacimiento,
                p.edad_informada,
                p.unidad_edad_informada,
                p.cedula_madre_prefijo,
                p.cedula_madre_numero,
                p.numero_hijo
             FROM registro_solicitud rs
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             LEFT JOIN lista_tipo_general tc ON rs.tipo_cita_id = tc.id
             LEFT JOIN lista_tipo_general tp ON rs.procedimiento_planificado_id = tp.id
             LEFT JOIN tipo_operacion top ON rs.tipo_operacion_id = top.id
             WHERE rs.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Cita / Solicitud no encontrada' });
        }

        res.json({ status: 'success', data: rows[0] });
    } catch (error) {
        console.error('Error al obtener detalle de la cita desde registro_solicitud:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar cita', error: error.message });
    }
};

/**
 * Registrar formulario de precarga de cita directamente en registro_solicitud
 * - Datos del menor (primer_nombre, segundo_nombre, apellidos, fecha_nacimiento, etc.) -> tabla paciente (crea o actualiza)
 * - Los demás campos de la cita -> tabla registro_solicitud vinculada con paciente_id
 */
const createCita = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const {
            paciente_id,
            datos_paciente_precarga,
            // Campos de la cita
            fecha_cita,
            horario,
            horario_cita,
            tipo_cita_id = 1,
            pediatra_responsable,
            procedimiento_planificado_id,
            tipo_operacion_id,
            diagnostico_motivo,
            estado_cita,
            estatus,
            observaciones,
            observacion_general,
            centro_salud_id,
            // Datos del paciente pasados en primer nivel si no vienen en datos_paciente_precarga
            primer_nombre,
            segundo_nombre,
            primer_apellido,
            segundo_apellido,
            fecha_nacimiento,
            edad_informada,
            unidad_edad_informada,
            cedula_madre_prefijo,
            cedula_madre_numero,
            numero_hijo
        } = req.body;

        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        let finalPacienteId = paciente_id ? parseInt(paciente_id, 10) : null;

        // Extraer datos del paciente unificando datos_paciente_precarga o campos de nivel raíz
        const dp = datos_paciente_precarga || {};
        const pNombre1 = dp.primer_nombre || primer_nombre;
        const pNombre2 = dp.segundo_nombre || segundo_nombre || null;
        const pApellido1 = dp.primer_apellido || primer_apellido;
        const pApellido2 = dp.segundo_apellido || segundo_apellido || null;
        const pFechaNac = dp.fecha_nacimiento || fecha_nacimiento || null;
        const pEdad = dp.edad_informada ?? edad_informada ?? null;
        const pUnidadEdad = dp.unidad_edad_informada || unidad_edad_informada || 'años';
        const pCedMadrePref = dp.cedula_madre_prefijo || cedula_madre_prefijo || 'V';
        const pCedMadreNum = dp.cedula_madre_numero || cedula_madre_numero || null;
        const pNumHijo = dp.numero_hijo ?? numero_hijo ?? 1;

        let numeroHistoria = '';

        if (!finalPacienteId) {
            // Si no se proporcionó paciente_id, crear el paciente a partir de la precarga
            if (!pNombre1 || !pApellido1) {
                await connection.rollback();
                return res.status(400).json({
                    status: 'error',
                    message: 'El primer nombre y primer apellido del paciente menor son obligatorios para la precarga.'
                });
            }

            // Generación de número de historia clínica HCIL
            if (pCedMadreNum && pNumHijo) {
                numeroHistoria = `${pCedMadrePref}${String(pCedMadreNum).trim().replace(/\D/g, '')}${pNumHijo}R`;
            } else {
                numeroHistoria = `HC-PED-${Date.now().toString().slice(-6)}`;
            }

            const [pResult] = await connection.query(
                `INSERT INTO paciente (
                    numero_historia_clinica,
                    es_cedula_madre,
                    cedula_madre_prefijo,
                    cedula_madre_numero,
                    numero_hijo,
                    primer_nombre,
                    segundo_nombre,
                    primer_apellido,
                    segundo_apellido,
                    fecha_nacimiento,
                    edad_informada,
                    unidad_edad_informada,
                    audit_usu_id,
                    audit_ip,
                    audit_dep_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    numeroHistoria,
                    pCedMadreNum ? 1 : 0,
                    pCedMadreNum ? pCedMadrePref : null,
                    pCedMadreNum ? String(pCedMadreNum).trim() : null,
                    pNumHijo,
                    pNombre1.trim(),
                    pNombre2 ? pNombre2.trim() : null,
                    pApellido1.trim(),
                    pApellido2 ? pApellido2.trim() : null,
                    pFechaNac,
                    pEdad,
                    pUnidadEdad,
                    audit.audit_usu_id,
                    audit.audit_ip,
                    audit.audit_dep_id
                ]
            );

            finalPacienteId = pResult.insertId;
        } else {
            // Si ya existe el paciente_id, opcionalmente actualizar datos demográficos básicos si se enviaron
            const [pExiste] = await connection.query('SELECT numero_historia_clinica FROM paciente WHERE id = ?', [finalPacienteId]);
            if (pExiste.length > 0) {
                numeroHistoria = pExiste[0].numero_historia_clinica;
                if (pNombre1 || pApellido1) {
                    await connection.query(
                        `UPDATE paciente SET 
                            primer_nombre = COALESCE(?, primer_nombre),
                            segundo_nombre = COALESCE(?, segundo_nombre),
                            primer_apellido = COALESCE(?, primer_apellido),
                            segundo_apellido = COALESCE(?, segundo_apellido),
                            fecha_nacimiento = COALESCE(?, fecha_nacimiento),
                            edad_informada = COALESCE(?, edad_informada),
                            unidad_edad_informada = COALESCE(?, unidad_edad_informada)
                         WHERE id = ?`,
                        [pNombre1, pNombre2, pApellido1, pApellido2, pFechaNac, pEdad, pUnidadEdad, finalPacienteId]
                    );
                }
            } else {
                await connection.rollback();
                return res.status(404).json({ status: 'error', message: 'El paciente_id especificado no existe' });
            }
        }

        // Determinar valores para registro_solicitud asegurando no-null en tipo_cita_id y procedimiento_planificado_id
        const fechaAsignadaCita = fecha_cita || new Date().toISOString().split('T')[0];
        const horarioFinal = horario || horario_cita || '08:00 AM - Consulta Matutina';
        const estadoFinal = estado_cita || estatus || 'Programada';
        const obsFinal = observaciones || observacion_general || null;
        
        // tipo_cita_id: si viene null o no numérico, asignar 1 ('Cita de primera vez')
        const tipoCitaFinal = (tipo_cita_id !== null && tipo_cita_id !== undefined && !isNaN(parseInt(tipo_cita_id, 10)))
            ? parseInt(tipo_cita_id, 10)
            : 1;

        // procedimiento_planificado_id: si viene null, 'consulta_estandar' o vacío, asignar por defecto 9 ('Ecocardiograma especializado') o tipo_operacion_id
        let procPlanId = null;
        if (procedimiento_planificado_id && procedimiento_planificado_id !== 'consulta_estandar' && !isNaN(parseInt(procedimiento_planificado_id, 10))) {
            procPlanId = parseInt(procedimiento_planificado_id, 10);
        } else if (tipo_operacion_id && !isNaN(parseInt(tipo_operacion_id, 10))) {
            procPlanId = parseInt(tipo_operacion_id, 10);
        } else {
            // Valor por defecto estándar en catálogo (9: Ecocardiograma especializado o 1)
            procPlanId = 9;
        }

        const tipoOpId = (tipo_operacion_id && !isNaN(parseInt(tipo_operacion_id, 10)))
            ? parseInt(tipo_operacion_id, 10)
            : (procPlanId <= 2 ? procPlanId : 1);

        const centroSaludFinal = centro_salud_id || 4;
        const diagMotivo = diagnostico_motivo || 'Consulta y evaluación pediátrica';

        // Guardar directamente en la tabla registro_solicitud
        const [solResult] = await connection.query(
            `INSERT INTO registro_solicitud (
                paciente_id,
                centro_salud_id,
                tipo_operacion_id,
                fecha_solicitud,
                fecha_cita,
                horario_cita,
                tipo_cita_id,
                pediatra_responsable,
                procedimiento_planificado_id,
                diagnostico_motivo,
                estatus,
                observacion_general,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                finalPacienteId,
                centroSaludFinal,
                tipoOpId,
                fechaAsignadaCita,
                fechaAsignadaCita,
                horarioFinal,
                tipoCitaFinal,
                pediatra_responsable || 'Pediatra de Guardia',
                procPlanId,
                diagMotivo,
                estadoFinal,
                obsFinal,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        const nuevaSolicitudId = solResult.insertId;

        await connection.commit();

        res.status(201).json({
            status: 'success',
            message: 'Precarga y cita médica registradas exitosamente en registro_solicitud',
            id: nuevaSolicitudId,
            registro_solicitud_id: nuevaSolicitudId,
            solicitud_id: nuevaSolicitudId,
            paciente_id: finalPacienteId,
            numero_historia_clinica: numeroHistoria,
            data: {
                id: nuevaSolicitudId,
                registro_solicitud_id: nuevaSolicitudId,
                solicitud_id: nuevaSolicitudId,
                paciente_id: finalPacienteId,
                fecha_cita: fechaAsignadaCita,
                horario_cita: horarioFinal,
                tipo_cita_id,
                pediatra_responsable,
                procedimiento_planificado_id: procPlanId,
                diagnostico_motivo: diagMotivo,
                estatus: estadoFinal,
                observacion_general: obsFinal,
                numero_historia_clinica: numeroHistoria
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar precarga en registro_solicitud:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al registrar la precarga en registro_solicitud', error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Reprogramar o actualizar cita en registro_solicitud
 */
const updateCita = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            fecha_cita,
            horario,
            horario_cita,
            tipo_cita_id,
            pediatra_responsable,
            procedimiento_planificado_id,
            diagnostico_motivo,
            estado_cita,
            estatus,
            observaciones,
            observacion_general
        } = req.body;

        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        const [existe] = await db.query('SELECT id FROM registro_solicitud WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Cita / Solicitud no encontrada' });
        }

        const estadoFinal = estado_cita || estatus || null;
        const horarioFinal = horario || horario_cita || null;
        const obsFinal = observaciones || observacion_general || null;

        await db.query(
            `UPDATE registro_solicitud SET
                fecha_cita = COALESCE(?, fecha_cita),
                horario_cita = COALESCE(?, horario_cita),
                tipo_cita_id = COALESCE(?, tipo_cita_id),
                pediatra_responsable = COALESCE(?, pediatra_responsable),
                procedimiento_planificado_id = COALESCE(?, procedimiento_planificado_id),
                diagnostico_motivo = COALESCE(?, diagnostico_motivo),
                estatus = COALESCE(?, estatus),
                observacion_general = COALESCE(?, observacion_general),
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`,
            [
                fecha_cita || null,
                horarioFinal,
                tipo_cita_id || null,
                pediatra_responsable || null,
                procedimiento_planificado_id || null,
                diagnostico_motivo || null,
                estadoFinal,
                obsFinal,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                id
            ]
        );

        const [actualizada] = await db.query(
            `SELECT rs.*,
                    rs.id AS solicitud_id,
                    rs.estatus AS estado_cita,
                    p.numero_historia_clinica,
                    CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido) AS paciente_nombre_completo
             FROM registro_solicitud rs
             LEFT JOIN paciente p ON rs.paciente_id = p.id
             WHERE rs.id = ?`,
            [id]
        );

        res.json({
            status: 'success',
            message: 'Cita médica actualizada correctamente en registro_solicitud',
            data: actualizada[0]
        });
    } catch (error) {
        console.error('Error al actualizar cita en registro_solicitud:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar la cita', error: error.message });
    }
};

module.exports = {
    getCitas,
    getCitaPorId,
    createCita,
    updateCita
};
