// backend/controllers/precargaReferenciaController.js
const db = require('../config/db');
const { upsertPacienteYRepresentante } = require('./precargaReferencia/pacienteUpsertService');
const { upsertSolicitudReferencia, updateCitaRedEnlace } = require('./precargaReferencia/solicitudReferenciaService');
const {
    replaceLaboratoriosReferencia,
    replaceEvaluacionesReferencia,
    registrarHistorialReferencia
} = require('./precargaReferencia/detallesReferenciaService');

const parseUserCentroIds = (centroSaludRaw) => {
    if (!centroSaludRaw) return [];
    if (Array.isArray(centroSaludRaw)) return centroSaludRaw.map(Number).filter(n => !isNaN(n));
    const str = String(centroSaludRaw).trim();
    if (!str) return [];
    if (str.startsWith('[')) {
        try {
            const arr = JSON.parse(str);
            return Array.isArray(arr) ? arr.map(Number).filter(n => !isNaN(n)) : [];
        } catch {
            return [];
        }
    }
    if (str.includes(',')) {
        return str.split(',').map(s => Number(s.trim())).filter(n => n > 0 && !isNaN(n));
    }
    const n = Number(str);
    return isNaN(n) ? [] : [n];
};

const formatDateYMD = (val) => {
    if (!val) return '';
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return '';
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const parsed = new Date(s);
    if (isNaN(parsed.getTime())) return '';
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const normalizarTipoDocumentoSalida = (rawTipo, numDoc) => {
    const t = String(rawTipo || '').trim();
    const low = t.toLowerCase();
    if (!t || low === 'no indicado') {
        return numDoc ? 'Cédula V' : 'Sin documento';
    }
    if (low === 'cedula' || low === 'cédula' || low === 'v') return 'Cédula V';
    if (low === 'e') return 'Cédula E';
    if (low === 'pasaporte') return 'Pasaporte';
    if (low === 'no_posee' || low === 'sin documento') return 'Sin documento';
    if (low.includes('acta')) return 'Acta de nacimiento';
    return t;
};

const getCentrosUsuarioActualizados = async (user, executor = db) => {
    if (user?.id) {
        try {
            const [uRows] = await executor.query('SELECT centro_salud_id FROM users WHERE id = ? LIMIT 1', [user.id]);
            if (uRows.length > 0 && uRows[0].centro_salud_id !== undefined) {
                return parseUserCentroIds(uRows[0].centro_salud_id);
            }
        } catch (err) {
            console.warn('No se pudo refrescar centro_salud_id desde users:', err.message);
        }
    }
    return parseUserCentroIds(user?.centro_salud_id);
};

/**
 * GET /api/referencias/buscar-paciente
 * Busca un paciente existente por número de documento (o HCIL) para precargar sus datos
 */
const buscarPacientePorDocumento = async (req, res) => {
    try {
        const { numero_documento, tipo_documento } = req.query;
        const docRaw = String(numero_documento || '').trim().toUpperCase();
        if (!docRaw) {
            return res.status(400).json({ status: 'error', message: 'Debe ingresar un número de documento para buscar.' });
        }

        const soloDigitos = docRaw.replace(/[^0-9]/g, '');
        const docAlfanum = docRaw.replace(/[^A-Z0-9]/g, '');
        const tipoFiltro = String(tipo_documento || '').trim();

        let query = `
            SELECT p.*
            FROM paciente p
            WHERE p.estatus = 1 AND (
                UPPER(TRIM(p.numero_documento)) = ?
                OR UPPER(REPLACE(REPLACE(TRIM(p.numero_documento), '-', ''), ' ', '')) = ?
                OR UPPER(TRIM(p.numero_historia_clinica)) = ?
        `;
        const params = [docRaw, docAlfanum, docRaw];

        if (soloDigitos && soloDigitos.length >= 4) {
            query += ` OR REPLACE(REPLACE(REPLACE(UPPER(TRIM(p.numero_documento)), 'V', ''), 'E', ''), '-', '') = ?`;
            params.push(soloDigitos);
        }

        if (tipoFiltro && !tipoFiltro.toLowerCase().includes('sin documento')) {
            query += ' ) ORDER BY (LOWER(TRIM(COALESCE(p.tipo_documento, \'\'))) = LOWER(?)) DESC, p.id DESC LIMIT 1';
            params.push(tipoFiltro);
        } else {
            query += ' ) ORDER BY p.id DESC LIMIT 1';
        }

        const [rows] = await db.query(query, params);
        if (rows.length === 0) {
            return res.json({
                status: 'success',
                encontrado: false,
                data: null
            });
        }

        const p = rows[0];

        // Resolver representante desde paciente o paciente_contacto_responsable
        let rep = {
            nombres: p.contacto_nombres,
            apellidos: p.contacto_apellidos,
            parentesco: p.contacto_parentesco,
            numero_documento: p.contacto_numero_documento,
            telefono_principal: p.contacto_telefono_principal,
            telefono_secundario: p.contacto_telefono_secundario,
            correo_electronico: p.contacto_correo_electronico
        };

        if (!rep.nombres && !rep.telefono_principal) {
            const [repRows] = await db.query(
                'SELECT * FROM paciente_contacto_responsable WHERE paciente_id = ? AND estatus = 1 ORDER BY id ASC LIMIT 1',
                [p.id]
            );
            if (repRows.length > 0) {
                rep = repRows[0];
            }
        }

        let nacResuelta = p.nacionalidad || '';
        if (!nacResuelta && p.nacionalidades) {
            try {
                const arr = JSON.parse(p.nacionalidades);
                if (Array.isArray(arr) && arr.length > 0) nacResuelta = arr[0];
            } catch {}
        }
        if (nacResuelta === 'Venezuela') nacResuelta = 'Venezolana';
        if (nacResuelta === 'Colombia') nacResuelta = 'Colombiana';

        // Mapear tipo documento normalizado (sin 'No indicado')
        const tipoDocResuelto = normalizarTipoDocumentoSalida(p.tipo_documento, p.numero_documento);

        let sexoResuelto = p.sexo || '';
        if (!sexoResuelto && Number(p.sexo_id) === 13) sexoResuelto = 'Masculino';
        if (!sexoResuelto && Number(p.sexo_id) === 14) sexoResuelto = 'Femenino';

        res.json({
            status: 'success',
            encontrado: true,
            data: {
                paciente_id: p.id,
                numero_historia_clinica: p.numero_historia_clinica,
                paciente_nombres: [p.primer_nombre, p.segundo_nombre].filter(Boolean).join(' '),
                paciente_apellidos: [p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' '),
                paciente_tipo_documento: tipoDocResuelto,
                paciente_num_documento: p.numero_documento || docRaw,
                paciente_fecha_nacimiento: formatDateYMD(p.fecha_nacimiento),
                paciente_sexo_registrado: sexoResuelto,
                paciente_nacionalidad: nacResuelta,
                domicilio_estado: p.estado_residencia || '',
                domicilio_municipio: p.municipio_residencia || '',
                domicilio_direccion: p.direccion_completa || '',
                representante_nombres: rep.nombres || '',
                representante_apellidos: rep.apellidos || '',
                representante_parentesco: rep.parentesco || '',
                representante_doc_numero: rep.numero_documento || '',
                representante_movil: rep.telefono_principal || '',
                representante_telefono: rep.telefono_secundario || '',
                representante_email: rep.correo_electronico || ''
            }
        });
    } catch (error) {
        console.error('Error en buscarPacientePorDocumento:', error);
        res.status(500).json({ status: 'error', message: 'Error al buscar paciente por documento', error: error.message });
    }
};

/**
 * GET /api/referencias/catalogos
 * Catálogos específicos para el formulario de Precarga de Referencia
 */
const getCatalogosPrecarga = async (req, res) => {
    try {
        const tiposRequeridos = [
            'prioridad_referencia',
            'certeza_diagnostica',
            'estado_clinico_referido',
            'tipo_documento_referencia',
            'sexo_referencia',
            'nacionalidad_referencia',
            'parentesco_referencia',
            'especialidad_remitente',
            'unidad_laboratorio_referencia',
            'estado_laboratorio_referencia',
            'estado_evaluacion_referencia',
            'prueba_laboratorio_referencia',
            'evaluacion_referencia',
            'tipo_cita',
            'tipo_procedimiento',
            'diagnostico_motivo_cita'
        ];

        const [rows] = await db.query(
            `SELECT id, tipo, nombre, orden 
             FROM lista_tipo_general 
             WHERE estatus = 1 AND tipo IN (?) 
             ORDER BY tipo ASC, orden ASC, id ASC`,
            [tiposRequeridos]
        );

        const agrupados = rows.reduce((acc, row) => {
            if (!acc[row.tipo]) acc[row.tipo] = [];
            acc[row.tipo].push({ id: row.id, nombre: row.nombre, orden: row.orden });
            return acc;
        }, {});

        const [centros] = await db.query(
            'SELECT id, descripcion AS nombre, descripcion FROM lista_centro_salud WHERE estatus = 1 ORDER BY id ASC'
        );

        const [estados] = await db.query(
            'SELECT id_estado AS id, estado AS nombre, estado FROM estados ORDER BY estado ASC'
        );

        res.json({
            status: 'success',
            catalogos: agrupados,
            centros_salud: centros,
            estados
        });
    } catch (error) {
        console.error('Error al cargar catálogos de precarga:', error);
        res.status(500).json({ status: 'error', message: 'Error al cargar catálogos de precarga', error: error.message });
    }
};

/**
 * GET /api/referencias/precarga
 * Histórico de pacientes referidos (filtrado por usuario/centro cuando rol_id = 6)
 */
const listarHistoricoReferencias = async (req, res) => {
    try {
        const { estado_referencia, prioridad_solicitada, centro_salud_id, q } = req.query;
        const user = req.usuario || {};
        const rolId = Number(user.rol_id);

        let query = `
            SELECT 
                rs.id AS registro_solicitud_id,
                rs.paciente_id,
                rs.centro_salud_id,
                COALESCE(NULLIF(rs.centro_origen_nombre, ''), cs.descripcion) AS centro_origen_nombre,
                rs.fecha_solicitud,
                COALESCE(rs.fecha_referencia, rs.fecha_solicitud) AS fecha_referencia,
                COALESCE(rs.prioridad_solicitada, 'Rutinaria') AS prioridad_solicitada,
                rs.estatus,
                COALESCE(rs.estado_referencia, IF(rs.estatus = 'Borrador', 'Borrador', 'Enviada')) AS estado_referencia,
                rs.fecha_envio_referencia,
                rs.paciente_edad_referencia,
                COALESCE(NULLIF(rs.dx_cardiologico_texto, ''), rs.diagnostico_motivo) AS dx_cardiologico_texto,
                rs.dx_cardiologico_certeza,
                rs.estado_clinico_actual,
                rs.motivo_referencia,
                rs.medico_nombre_completo,
                rs.completitud_porcentaje,
                rs.usuario_referencia_id,
                rs.fecha_creacion,
                rs.fecha_actualizacion,
                p.numero_historia_clinica,
                p.primer_nombre,
                p.segundo_nombre,
                p.primer_apellido,
                p.segundo_apellido,
                CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido) AS paciente_nombre_completo,
                p.tipo_documento AS paciente_tipo_documento,
                p.numero_documento AS paciente_num_documento,
                p.fecha_nacimiento AS paciente_fecha_nacimiento,
                p.sexo AS paciente_sexo_registrado,
                p.estado_residencia AS domicilio_estado,
                p.contacto_nombres AS representante_nombres,
                p.contacto_apellidos AS representante_apellidos,
                p.contacto_telefono_principal AS representante_movil,
                (SELECT COUNT(*) FROM laboratorios l WHERE l.registro_solicitud_id = rs.id AND l.estatus = 1) AS total_laboratorios,
                (SELECT COUNT(*) FROM referencia_evaluacion re WHERE re.registro_solicitud_id = rs.id AND re.estado = 'Sí' AND re.estatus = 1) AS total_evaluaciones_si
            FROM registro_solicitud rs
            JOIN paciente p ON rs.paciente_id = p.id
            LEFT JOIN lista_centro_salud cs ON rs.centro_salud_id = cs.id
            WHERE (rs.fecha_referencia IS NOT NULL OR rs.estado_referencia IS NOT NULL OR rs.usuario_referencia_id IS NOT NULL)
        `;

        const params = [];

        // Si el usuario pertenece a Centro de Referencia (rol_id = 6), filtrar por su usuario o centros asignados
        if (rolId === 6) {
            const centrosUsuario = await getCentrosUsuarioActualizados(user);
            if (centrosUsuario.length > 0) {
                query += ' AND (rs.usuario_referencia_id = ? OR rs.audit_usu_id = ? OR rs.centro_salud_id IN (?))';
                params.push(Number(user.id), String(user.id), centrosUsuario);
            } else {
                query += ' AND (rs.usuario_referencia_id = ? OR rs.audit_usu_id = ?)';
                params.push(Number(user.id), String(user.id));
            }
        } else if (rolId === 2) {
            // Rol 2 (Red de Enlace): solo ve pacientes/referencias registradas en su centro de salud asignado
            const centrosUsuario = await getCentrosUsuarioActualizados(user);
            if (centrosUsuario.length > 0) {
                query += ' AND rs.centro_salud_id IN (?)';
                params.push(centrosUsuario);
            } else {
                query += ' AND 1 = 0';
            }
        } else if (centro_salud_id) {
            query += ' AND rs.centro_salud_id = ?';
            params.push(Number(centro_salud_id));
        }

        if (estado_referencia) {
            query += " AND COALESCE(rs.estado_referencia, IF(rs.estatus = 'Borrador', 'Borrador', 'Enviada')) = ?";
            params.push(estado_referencia);
        }

        if (prioridad_solicitada) {
            query += ' AND rs.prioridad_solicitada = ?';
            params.push(prioridad_solicitada);
        }

        if (q && String(q).trim() !== '') {
            const term = `%${String(q).trim()}%`;
            query += ` AND (
                p.primer_nombre LIKE ? OR
                p.primer_apellido LIKE ? OR
                CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido) LIKE ? OR
                p.numero_documento LIKE ? OR
                p.numero_historia_clinica LIKE ? OR
                rs.dx_cardiologico_texto LIKE ? OR
                rs.motivo_referencia LIKE ? OR
                COALESCE(rs.centro_origen_nombre, cs.descripcion) LIKE ?
            )`;
            params.push(term, term, term, term, term, term, term, term);
        }

        query += ' ORDER BY rs.id DESC';

        const [rows] = await db.query(query, params);
        res.json({
            status: 'success',
            total: rows.length,
            data: rows
        });
    } catch (error) {
        console.error('Error al listar histórico de referencias:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar histórico de referencias', error: error.message });
    }
};

/**
 * GET /api/referencias/precarga/:id
 * Obtener el detalle completo de una precarga por registro_solicitud_id
 */
const getReferenciaPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const [solRows] = await db.query(
            `SELECT rs.*,
                    COALESCE(NULLIF(rs.centro_origen_nombre, ''), cs.descripcion) AS centro_origen_nombre_resuelto,
                    p.numero_historia_clinica,
                    p.tipo_documento,
                    p.numero_documento,
                    p.primer_nombre,
                    p.segundo_nombre,
                    p.primer_apellido,
                    p.segundo_apellido,
                    p.fecha_nacimiento,
                    p.sexo_id,
                    p.sexo,
                    p.nacionalidad,
                    p.nacionalidades,
                    p.estado_residencia,
                    p.municipio_residencia,
                    p.direccion_completa,
                    p.contacto_nombres,
                    p.contacto_apellidos,
                    p.contacto_parentesco,
                    p.contacto_numero_documento,
                    p.contacto_telefono_principal,
                    p.contacto_telefono_secundario,
                    p.contacto_correo_electronico,
                    tc.nombre AS tipo_cita_nombre,
                    tp.nombre AS procedimiento_planificado_nombre,
                    td.nombre AS diagnostico_motivo_nombre
             FROM registro_solicitud rs
             JOIN paciente p ON rs.paciente_id = p.id
             LEFT JOIN lista_centro_salud cs ON rs.centro_salud_id = cs.id
             LEFT JOIN lista_tipo_general tc ON rs.tipo_cita_id = tc.id
             LEFT JOIN lista_tipo_general tp ON rs.procedimiento_planificado_id = tp.id
             LEFT JOIN lista_tipo_general td ON rs.diagnostico_motivo_id = td.id
             WHERE rs.id = ? LIMIT 1`,
            [id]
        );

        if (solRows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Precarga de referencia no encontrada' });
        }

        const r = solRows[0];

        // Control de acceso para rol_id = 6 y rol_id = 2
        const user = req.usuario || {};
        if (Number(user.rol_id) === 6) {
            const centrosUsuario = await getCentrosUsuarioActualizados(user);
            const esPropio = Number(r.usuario_referencia_id) === Number(user.id) ||
                             String(r.audit_usu_id) === String(user.id) ||
                             centrosUsuario.includes(Number(r.centro_salud_id));
            if (!esPropio) {
                return res.status(403).json({ status: 'error', message: 'No tiene permiso para acceder a esta referencia.' });
            }
        } else if (Number(user.rol_id) === 2) {
            const centrosUsuario = await getCentrosUsuarioActualizados(user);
            if (centrosUsuario.length === 0 || !centrosUsuario.includes(Number(r.centro_salud_id))) {
                return res.status(403).json({ status: 'error', message: 'Solo puede acceder a referencias registradas en su centro de salud.' });
            }
        }

        // Fallback representante desde paciente_contacto_responsable si no está directo en paciente
        let rep = {
            nombres: r.contacto_nombres,
            apellidos: r.contacto_apellidos,
            parentesco: r.contacto_parentesco,
            numero_documento: r.contacto_numero_documento,
            telefono_principal: r.contacto_telefono_principal,
            telefono_secundario: r.contacto_telefono_secundario,
            correo_electronico: r.contacto_correo_electronico
        };

        if (!rep.nombres && !rep.telefono_principal) {
            const [repRows] = await db.query(
                'SELECT * FROM paciente_contacto_responsable WHERE paciente_id = ? AND estatus = 1 ORDER BY id ASC LIMIT 1',
                [r.paciente_id]
            );
            if (repRows.length > 0) {
                rep = repRows[0];
            }
        }

        const [laboratorios] = await db.query(
            'SELECT id, prueba, resultado, unidad, estado, DATE_FORMAT(fecha, "%Y-%m-%d") AS fecha FROM laboratorios WHERE registro_solicitud_id = ? AND estatus = 1 ORDER BY orden ASC, id ASC',
            [id]
        );

        const [evaluaciones] = await db.query(
            'SELECT id, tipo, estado, DATE_FORMAT(fecha, "%Y-%m-%d") AS fecha, resumen FROM referencia_evaluacion WHERE registro_solicitud_id = ? AND estatus = 1 ORDER BY orden ASC, id ASC',
            [id]
        );

        const [cirugias] = await db.query(
            'SELECT id, cirugia_paliativa_estado, tipo_cirugia, DATE_FORMAT(fecha_cirugia, "%Y-%m-%d") AS fecha_cirugia FROM referencia_cirugia_previa WHERE registro_solicitud_id = ? AND estatus = 1 LIMIT 1',
            [id]
        );

        const [historial] = await db.query(
            'SELECT id, accion, estado_anterior, estado_nuevo, fecha_creacion, audit_usu_id FROM referencia_historial WHERE registro_solicitud_id = ? ORDER BY id DESC',
            [id]
        );

        const pacienteNombres = [r.primer_nombre, r.segundo_nombre].filter(Boolean).join(' ');
        const pacienteApellidos = [r.primer_apellido, r.segundo_apellido].filter(Boolean).join(' ');

        let nacResuelta = r.nacionalidad;
        if (!nacResuelta && r.nacionalidades) {
            try {
                const arr = JSON.parse(r.nacionalidades);
                if (Array.isArray(arr) && arr.length > 0) nacResuelta = arr[0];
            } catch {}
        }
        if (nacResuelta === 'Venezuela') nacResuelta = 'Venezolana';
        if (nacResuelta === 'Colombia') nacResuelta = 'Colombiana';

        const tipoDocResuelto = normalizarTipoDocumentoSalida(r.tipo_documento, r.numero_documento);

        let sexoResuelto = r.sexo || '';
        if (!sexoResuelto && Number(r.sexo_id) === 13) sexoResuelto = 'Masculino';
        if (!sexoResuelto && Number(r.sexo_id) === 14) sexoResuelto = 'Femenino';

        res.json({
            status: 'success',
            data: {
                registro_solicitud_id: r.id,
                paciente_id: r.paciente_id,
                numero_historia_clinica: r.numero_historia_clinica,
                centro_salud_id: r.centro_salud_id,
                centro_origen_nombre: r.centro_origen_nombre_resuelto || '',
                fecha_referencia: formatDateYMD(r.fecha_referencia) || formatDateYMD(r.fecha_solicitud),
                prioridad_solicitada: r.prioridad_solicitada || 'Rutinaria',
                estado_referencia: r.estado_referencia || 'Borrador',
                estatus: r.estatus,
                fecha_envio_referencia: r.fecha_envio_referencia,
                paciente_edad_referencia: r.paciente_edad_referencia || '',
                completitud_porcentaje: r.completitud_porcentaje || 0,

                // Datos del paciente
                paciente_nombres: pacienteNombres,
                paciente_apellidos: pacienteApellidos,
                paciente_tipo_documento: tipoDocResuelto,
                paciente_num_documento: r.numero_documento || '',
                paciente_fecha_nacimiento: formatDateYMD(r.fecha_nacimiento),
                paciente_sexo_registrado: sexoResuelto,
                paciente_nacionalidad: nacResuelta || '',
                domicilio_estado: r.estado_residencia || '',
                domicilio_municipio: r.municipio_residencia || '',
                domicilio_direccion: r.direccion_completa || '',

                // Datos del representante
                representante_nombres: rep.nombres || '',
                representante_apellidos: rep.apellidos || '',
                representante_parentesco: rep.parentesco || '',
                representante_doc_numero: rep.numero_documento || '',
                representante_movil: rep.telefono_principal || '',
                representante_telefono: rep.telefono_secundario || '',
                representante_email: rep.correo_electronico || '',

                // Datos clínicos de referencia
                dx_cardiologico_texto: r.dx_cardiologico_texto || r.diagnostico_motivo || '',
                dx_cardiologico_certeza: r.dx_cardiologico_certeza || 'Presuntivo',
                estado_clinico_actual: r.estado_clinico_actual || 'Sin documentar',
                motivo_referencia: r.motivo_referencia || '',
                dx_asociado_texto: r.dx_asociado_texto || '',
                sugerencia_referencia: r.sugerencia_referencia || '',
                tratamiento_medico_texto: r.tratamiento_medico_texto || '',
                saturacion_o2: r.saturacion_o2 !== null && r.saturacion_o2 !== undefined ? Number(r.saturacion_o2) : '',
                cirugia_paliativa_estado: cirugias[0]?.cirugia_paliativa_estado || r.cirugia_paliativa_estado || 'Desconocido',
                cirugia_paliativa_tipo: cirugias[0]?.tipo_cirugia || r.cirugia_paliativa_tipo || '',
                cirugia_paliativa_fecha: cirugias[0]?.fecha_cirugia || formatDateYMD(r.cirugia_paliativa_fecha),

                // Datos de cita (Red de Enlace - rol_id = 2)
                fecha_cita: formatDateYMD(r.fecha_cita),
                tipo_cita_id: r.tipo_cita_id ? Number(r.tipo_cita_id) : '',
                tipo_cita_nombre: r.tipo_cita_nombre || '',
                procedimiento_planificado_id: r.procedimiento_planificado_id ? Number(r.procedimiento_planificado_id) : '',
                procedimiento_planificado_nombre: r.procedimiento_planificado_nombre || '',
                diagnostico_motivo_id: r.diagnostico_motivo_id ? Number(r.diagnostico_motivo_id) : '',
                diagnostico_motivo: r.diagnostico_motivo || r.diagnostico_motivo_nombre || '',
                diagnostico_motivo_nombre: r.diagnostico_motivo_nombre || '',

                // Médico remitente
                medico_nombre_completo: r.medico_nombre_completo || '',
                medico_documento: r.medico_documento || '',
                medico_especialidad: r.medico_especialidad || '',
                medico_mms: r.medico_mms || '',
                medico_cm: r.medico_cm || '',

                // Detalles múltiples
                laboratorios,
                evaluaciones,
                cirugia_previa: cirugias[0] || null,
                historial
            }
        });
    } catch (error) {
        console.error('Error al consultar precarga de referencia:', error);
        res.status(500).json({ status: 'error', message: 'Error al consultar precarga de referencia', error: error.message });
    }
};

/**
 * POST /api/referencias/precarga
 * Transacción orquestada:
 * 1. Upsert Paciente + Representante -> obtiene paciente_id
 * 2. Insert registro_solicitud + referencia_cirugia_previa -> obtiene registro_solicitud_id
 * 3. Insert bucle laboratorios + referencia_evaluacion
 * 4. Registrar evento en referencia_historial
 */
const crearPrecargaReferencia = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const user = req.usuario || {};
        const body = req.body || {};

        // Si el usuario rol_id = 6 tiene centro asignado, validar o fijar su centro
        if (Number(user.rol_id) === 6) {
            const centrosUsuario = await getCentrosUsuarioActualizados(user, connection);
            if (centrosUsuario.length > 0) {
                if (body.centro_salud_id && !centrosUsuario.includes(Number(body.centro_salud_id))) {
                    await connection.rollback();
                    return res.status(403).json({
                        status: 'error',
                        message: 'No tiene permiso para registrar referencias en un centro distinto al asignado.'
                    });
                }
                if (!body.centro_salud_id) {
                    body.centro_salud_id = centrosUsuario[0];
                }
            }
        }

        // 1. Upsert Paciente + Representante
        const { paciente_id, numero_historia_clinica, creado: pacienteCreado } = await upsertPacienteYRepresentante(connection, body, audit);

        // 2. Insert Solicitud + Cirugía previa
        const { registro_solicitud_id, estado_referencia } = await upsertSolicitudReferencia(connection, paciente_id, body, user, audit, null);

        // 3. Insert Laboratorios múltiples
        const totalLabs = await replaceLaboratoriosReferencia(connection, registro_solicitud_id, paciente_id, body.laboratorios, audit);

        // 4. Insert Evaluaciones realizadas
        const totalEvals = await replaceEvaluacionesReferencia(connection, registro_solicitud_id, paciente_id, body.evaluaciones, audit);

        // 5. Registrar Historial
        const accion = estado_referencia === 'Enviada'
            ? 'Referencia enviada al centro receptor'
            : 'Borrador de precarga guardado';
        await registrarHistorialReferencia(connection, registro_solicitud_id, paciente_id, accion, null, estado_referencia, audit);

        await connection.commit();

        res.status(201).json({
            status: 'success',
            message: estado_referencia === 'Enviada'
                ? 'Referencia enviada y registrada exitosamente.'
                : 'Borrador de precarga guardado exitosamente.',
            data: {
                registro_solicitud_id,
                paciente_id,
                numero_historia_clinica,
                paciente_creado: pacienteCreado,
                estado_referencia,
                total_laboratorios: totalLabs,
                total_evaluaciones: totalEvals
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error en crearPrecargaReferencia:', error);
        const status = error.statusCode || 500;
        res.status(status).json({
            status: 'error',
            message: error.message || 'Error interno al guardar la precarga de referencia'
        });
    } finally {
        connection.release();
    }
};

/**
 * PUT /api/referencias/precarga/:id
 * Actualiza una precarga existente (borrador o envío definitivo) dentro de una transacción
 */
const actualizarPrecargaReferencia = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const user = req.usuario || {};
        const body = req.body || {};

        // Si el usuario rol_id = 6 tiene centro asignado, validar o fijar su centro
        if (Number(user.rol_id) === 6) {
            const centrosUsuario = await getCentrosUsuarioActualizados(user, connection);
            if (centrosUsuario.length > 0) {
                if (body.centro_salud_id && !centrosUsuario.includes(Number(body.centro_salud_id))) {
                    await connection.rollback();
                    return res.status(403).json({
                        status: 'error',
                        message: 'No tiene permiso para registrar referencias en un centro distinto al asignado.'
                    });
                }
                if (!body.centro_salud_id) {
                    body.centro_salud_id = centrosUsuario[0];
                }
            }
        }

        // Buscar solicitud existente para obtener paciente_id y validar acceso
        const [solRows] = await connection.query(
            'SELECT paciente_id, centro_salud_id, usuario_referencia_id, audit_usu_id FROM registro_solicitud WHERE id = ? LIMIT 1',
            [id]
        );
        if (solRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Registro de solicitud de referencia no encontrado' });
        }

        if (!body.paciente_id) {
            body.paciente_id = solRows[0].paciente_id;
        }

        // Control de acceso para rol_id = 6 (Centro de Referencia)
        if (Number(user.rol_id) === 6) {
            const centrosUsuario = await getCentrosUsuarioActualizados(user, connection);
            const rSol = solRows[0];
            const esPropio = Number(rSol.usuario_referencia_id) === Number(user.id) ||
                             String(rSol.audit_usu_id) === String(user.id) ||
                             centrosUsuario.includes(Number(rSol.centro_salud_id));
            if (!esPropio) {
                await connection.rollback();
                return res.status(403).json({ status: 'error', message: 'No tiene permiso para modificar esta referencia.' });
            }
        }

        // Flujo específico para rol_id = 2 (Red de Enlace): solo edita datos de paciente, representante y campos de cita
        if (Number(user.rol_id) === 2) {
            const centrosUsuario = await getCentrosUsuarioActualizados(user, connection);
            if (centrosUsuario.length === 0 || !centrosUsuario.includes(Number(solRows[0].centro_salud_id))) {
                await connection.rollback();
                return res.status(403).json({ status: 'error', message: 'Solo puede editar referencias registradas en su centro de salud.' });
            }

            // Forzar paciente_id vinculado a esta solicitud (evita modificar otro paciente por manipulación de payload)
            body.paciente_id = solRows[0].paciente_id;
            const { paciente_id, numero_historia_clinica } = await upsertPacienteYRepresentante(connection, body, audit, { allowIdentityUpdate: true });
            const { registro_solicitud_id, estado_referencia, estatus } = await updateCitaRedEnlace(connection, id, body, audit);
            await registrarHistorialReferencia(
                connection,
                registro_solicitud_id,
                paciente_id,
                'Datos de paciente, representante y cita actualizados por Red de Enlace',
                estado_referencia,
                estado_referencia,
                audit
            );

            await connection.commit();
            return res.json({
                status: 'success',
                message: 'Datos del paciente, representante y cita actualizados exitosamente.',
                data: {
                    registro_solicitud_id,
                    paciente_id,
                    numero_historia_clinica,
                    estado_referencia,
                    estatus
                }
            });
        }

        // 1. Upsert Paciente + Representante
        const { paciente_id, numero_historia_clinica } = await upsertPacienteYRepresentante(connection, body, audit);

        // 2. Update Solicitud + Cirugía previa
        const { registro_solicitud_id, estado_referencia, estado_anterior } = await upsertSolicitudReferencia(connection, paciente_id, body, user, audit, id);

        // 3. Reemplazar Laboratorios múltiples
        const totalLabs = await replaceLaboratoriosReferencia(connection, registro_solicitud_id, paciente_id, body.laboratorios, audit);

        // 4. Reemplazar Evaluaciones realizadas
        const totalEvals = await replaceEvaluacionesReferencia(connection, registro_solicitud_id, paciente_id, body.evaluaciones, audit);

        // 5. Registrar Historial
        const accion = (estado_anterior !== 'Enviada' && estado_referencia === 'Enviada')
            ? 'Referencia enviada al centro receptor'
            : (estado_referencia === 'Enviada' ? 'Referencia enviada actualizada' : 'Borrador de precarga actualizado');
        await registrarHistorialReferencia(connection, registro_solicitud_id, paciente_id, accion, estado_anterior, estado_referencia, audit);

        await connection.commit();

        res.json({
            status: 'success',
            message: estado_referencia === 'Enviada'
                ? 'Referencia actualizada y enviada exitosamente.'
                : 'Borrador de precarga actualizado exitosamente.',
            data: {
                registro_solicitud_id,
                paciente_id,
                numero_historia_clinica,
                estado_referencia,
                total_laboratorios: totalLabs,
                total_evaluaciones: totalEvals
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error en actualizarPrecargaReferencia:', error);
        const status = error.statusCode || 500;
        res.status(status).json({
            status: 'error',
            message: error.message || 'Error interno al actualizar la precarga de referencia'
        });
    } finally {
        connection.release();
    }
};

module.exports = {
    buscarPacientePorDocumento,
    getCatalogosPrecarga,
    listarHistoricoReferencias,
    getReferenciaPorId,
    crearPrecargaReferencia,
    actualizarPrecargaReferencia
};
