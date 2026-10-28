// controllers/pacienteController.js
const db = require('../config/db');

/**
 * Función auxiliar para calcular la edad desglosada en años, meses y días
 */
const calcularEdadDesglosada = (fechaNacimientoStr) => {
    if (!fechaNacimientoStr) return null;
    const nacimiento = new Date(fechaNacimientoStr);
    const hoy = new Date();

    if (isNaN(nacimiento.getTime()) || nacimiento > hoy) return null;

    let anos = hoy.getFullYear() - nacimiento.getFullYear();
    let meses = hoy.getMonth() - nacimiento.getMonth();
    let dias = hoy.getDate() - nacimiento.getDate();

    if (dias < 0) {
        meses--;
        // Días en el mes anterior
        const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        dias += mesAnterior.getDate();
    }
    if (meses < 0) {
        anos--;
        meses += 12;
    }

    return {
        anos,
        meses,
        dias,
        cadena: `${anos} a, ${meses} m, ${dias} d`
    };
};

/**
 * Función auxiliar para parsear campos que pueden venir como JSON string, array o lista separada por comas
 */
const parseJsonField = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        if (typeof val === 'string' && val.includes(',')) {
            return val.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [val];
    }
};

/**
 * Función auxiliar para construir la regla formal HCIL
 */
const derivarCodigoHCIL = (datos) => {
    const tipoDoc = String(datos.tipo_documento || '').toLowerCase();
    const esNoPosee = tipoDoc === 'no_posee' || datos.tipo_documento_id === 3 || datos.es_cedula_madre;

    // Si posee cédula o pasaporte directo
    if (datos.numero_documento && !esNoPosee) {
        return String(datos.numero_documento).trim().toUpperCase();
    }
    // Si no posee documento formal y se utiliza la cédula materna + número de hijo + R
    if (datos.cedula_madre_numero && datos.numero_hijo) {
        const prefijo = (datos.cedula_madre_prefijo || 'V').trim().toUpperCase();
        const cedula = String(datos.cedula_madre_numero).trim().replace(/\D/g, '');
        const hijo = String(datos.numero_hijo).trim();
        return `${prefijo}${cedula}${hijo}R`;
    }
    // Caso de contingencia provisional
    return `HCIL-${Date.now().toString().slice(-8)}`;
};

/**
 * Listar pacientes con paginación y búsqueda
 */
const getPacientes = async (req, res) => {
    try {
        const { q, estatus = 1, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT 
                p.id,
                p.numero_historia_clinica,
                p.tipo_documento_id,
                COALESCE(
                    td.nombre,
                    CASE 
                        WHEN p.tipo_documento = 'cedula' THEN 'Cédula'
                        WHEN p.tipo_documento = 'pasaporte' THEN 'Pasaporte'
                        WHEN p.tipo_documento = 'no_posee' THEN 'No posee'
                        ELSE NULL
                    END,
                    'Documento'
                ) AS tipo_documento_nombre,
                p.numero_documento,
                p.es_cedula_madre,
                p.cedula_madre_prefijo,
                p.cedula_madre_numero,
                p.numero_hijo,
                p.primer_nombre,
                p.segundo_nombre,
                p.primer_apellido,
                p.segundo_apellido,
                CONCAT_WS(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido) AS nombre_completo,
                p.fecha_nacimiento,
                p.edad_informada,
                p.unidad_edad_informada,
                p.sexo_id,
                COALESCE(NULLIF(p.sexo, ''), s.nombre) AS sexo_nombre,
                p.sexo,
                p.pais_residencia,
                p.estado_residencia,
                p.ciudad_residencia,
                p.municipio_residencia,
                p.parroquia_residencia,
                p.direccion_completa,
                COALESCE(NULLIF(p.contacto_telefono_principal, ''), c.telefono_principal) AS contacto_telefono_principal,
                p.contacto_nombres,
                p.contacto_apellidos,
                p.estatus,
                p.fecha_creacion,
                p.fecha_actualizacion
            FROM paciente p
            LEFT JOIN lista_tipo_general td ON p.tipo_documento_id = td.id AND td.tipo = 'tipo_documento'
            LEFT JOIN lista_tipo_general s ON p.sexo_id = s.id AND s.tipo = 'sexo'
            LEFT JOIN paciente_contacto_responsable c ON p.id = c.paciente_id AND c.estatus = 1
            WHERE p.estatus = ?
        `;

        const params = [estatus];

        if (q) {
            query += ` AND (
                p.numero_historia_clinica LIKE ? OR
                p.numero_documento LIKE ? OR
                p.cedula_madre_numero LIKE ? OR
                p.primer_nombre LIKE ? OR
                p.primer_apellido LIKE ? OR
                CONCAT_WS(' ', p.primer_nombre, p.primer_apellido) LIKE ?
            )`;
            const term = `%${q}%`;
            params.push(term, term, term, term, term, term);
        }

        query += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
        params.push(Number(limit), Number(offset));

        const [rows] = await db.query(query, params);

        // Contar total para paginación
        const [totalRows] = await db.query(
            `SELECT COUNT(*) as total FROM paciente WHERE estatus = ?`,
            [estatus]
        );

        res.json({
            status: 'success',
            total: totalRows[0].total,
            limit: Number(limit),
            offset: Number(offset),
            data: rows
        });
    } catch (error) {
        console.error('Error al listar pacientes:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar pacientes', error: error.message });
    }
};

/**
 * Obtener un paciente específico con sus contactos y nacionalidades
 */
const getPacientePorId = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Datos del paciente
        const [pacientes] = await db.query(
            `SELECT p.*,
                    COALESCE(NULLIF(p.sexo, ''), s.nombre) AS sexo_nombre,
                    COALESCE(
                        td.nombre,
                        CASE 
                            WHEN p.tipo_documento = 'cedula' THEN 'Cédula'
                            WHEN p.tipo_documento = 'pasaporte' THEN 'Pasaporte'
                            WHEN p.tipo_documento = 'no_posee' THEN 'No posee'
                            ELSE NULL
                        END,
                        'Documento'
                    ) AS tipo_documento_nombre,
                    idioma.nombre AS idioma_nombre,
                    etnia.nombre AS etnia_nombre
             FROM paciente p
             LEFT JOIN lista_tipo_general s ON p.sexo_id = s.id AND s.tipo = 'sexo'
             LEFT JOIN lista_tipo_general td ON p.tipo_documento_id = td.id AND td.tipo = 'tipo_documento'
             LEFT JOIN lista_tipo_general idioma ON p.idioma_preferido_id = idioma.id
             LEFT JOIN lista_tipo_general etnia ON p.etnia_id = etnia.id
             WHERE p.id = ?`,
            [id]
        );

        if (pacientes.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Paciente no encontrado' });
        }

        const paciente = pacientes[0];
        paciente.edad_desglosada = calcularEdadDesglosada(paciente.fecha_nacimiento);

        // 2. Contactos responsables
        const [contactos] = await db.query(
            `SELECT c.*,
                    par.nombre AS parentesco_nombre,
                    td.nombre AS tipo_documento_nombre
             FROM paciente_contacto_responsable c
             LEFT JOIN lista_tipo_general par ON c.parentesco_id = par.id
             LEFT JOIN lista_tipo_general td ON c.tipo_documento_id = td.id
             WHERE c.paciente_id = ? AND c.estatus = 1
             ORDER BY c.id ASC`,
            [id]
        );

        // 3. Nacionalidades
        const [nacionalidades] = await db.query(
            `SELECT pn.nacionalidad_id
             FROM paciente_nacionalidad pn
             WHERE pn.paciente_id = ?`,
            [id]
        );

        // 4. Solicitudes asociadas y solicitud activa
        let [solicitudes] = await db.query(
            `SELECT rs.*,
                    cs.descripcion AS centro_salud_nombre,
                    top.nombre AS tipo_operacion_nombre,
                    tc.nombre AS tipo_cita_nombre,
                    COALESCE(tp.nombre, top.nombre) AS procedimiento_nombre,
                    COALESCE(td.nombre, rs.diagnostico_motivo) AS diagnostico_motivo_nombre
             FROM registro_solicitud rs
             LEFT JOIN lista_centro_salud cs ON rs.centro_salud_id = cs.id
             LEFT JOIN tipo_operacion top ON rs.tipo_operacion_id = top.id
             LEFT JOIN lista_tipo_general tc ON rs.tipo_cita_id = tc.id
             LEFT JOIN lista_tipo_general tp ON rs.procedimiento_planificado_id = tp.id
             LEFT JOIN lista_tipo_general td ON rs.diagnostico_motivo_id = td.id
             WHERE rs.paciente_id = ?
             ORDER BY rs.id DESC`,
            [id]
        );

        if (solicitudes.length === 0) {
            const [insSol] = await db.query(
                `INSERT INTO registro_solicitud (paciente_id, centro_salud_id, tipo_operacion_id, fecha_solicitud, fecha_cita, estatus, observacion_general, audit_usu_id, audit_ip, audit_dep_id)
                 VALUES (?, 4, 1, CURDATE(), CURDATE(), 'Programada', 'Solicitud inicial generada automáticamente', '1', '127.0.0.1', '1')`,
                [id]
            );
            const [nueva] = await db.query(
                `SELECT rs.*,
                        cs.descripcion AS centro_salud_nombre,
                        top.nombre AS tipo_operacion_nombre,
                        tc.nombre AS tipo_cita_nombre,
                        COALESCE(tp.nombre, top.nombre) AS procedimiento_nombre,
                        COALESCE(td.nombre, rs.diagnostico_motivo) AS diagnostico_motivo_nombre
                 FROM registro_solicitud rs
                 LEFT JOIN lista_centro_salud cs ON rs.centro_salud_id = cs.id
                 LEFT JOIN tipo_operacion top ON rs.tipo_operacion_id = top.id
                 LEFT JOIN lista_tipo_general tc ON rs.tipo_cita_id = tc.id
                 LEFT JOIN lista_tipo_general tp ON rs.procedimiento_planificado_id = tp.id
                 LEFT JOIN lista_tipo_general td ON rs.diagnostico_motivo_id = td.id
                 WHERE rs.id = ?`,
                [insSol.insertId]
            );
            solicitudes = nueva;
        }

        // Parsear arrays de nacionalidades, otros_idiomas, etnias
        let rowNacionalidades = parseJsonField(paciente.nacionalidades);
        if (rowNacionalidades.length === 0 && nacionalidades.length > 0) {
            rowNacionalidades = nacionalidades.map(n => n.nacionalidad_id);
        }
        paciente.nacionalidades = rowNacionalidades;
        paciente.otros_idiomas = parseJsonField(paciente.otros_idiomas);
        paciente.etnias = parseJsonField(paciente.etnias);

        // Si contactos en tabla secundaria está vacía, pero existen datos directos:
        if (contactos.length === 0 && (paciente.contacto_nombres || paciente.contacto_telefono_principal)) {
            contactos.push({
                nombres: paciente.contacto_nombres,
                apellidos: paciente.contacto_apellidos,
                parentesco: paciente.contacto_parentesco || 'Madre',
                parentesco_nombre: paciente.contacto_parentesco || 'Madre',
                parentesco_otro: paciente.contacto_parentesco_otro,
                tipo_documento: paciente.contacto_tipo_documento || 'Cédula',
                tipo_documento_nombre: paciente.contacto_tipo_documento || 'Cédula',
                numero_documento: paciente.contacto_numero_documento,
                telefono_principal: paciente.contacto_telefono_principal,
                telefono_secundario: paciente.contacto_telefono_secundario,
                telefono_adicional: paciente.contacto_telefono_adicional,
                correo_electronico: paciente.contacto_correo_electronico,
                red_social: paciente.contacto_red_social
            });
        } else if (contactos.length > 0 && !paciente.contacto_nombres) {
            paciente.contacto_nombres = contactos[0].nombres;
            paciente.contacto_apellidos = contactos[0].apellidos;
            paciente.contacto_parentesco = contactos[0].parentesco || contactos[0].parentesco_nombre;
            paciente.contacto_parentesco_otro = contactos[0].parentesco_otro;
            paciente.contacto_tipo_documento = contactos[0].tipo_documento || contactos[0].tipo_documento_nombre;
            paciente.contacto_numero_documento = contactos[0].numero_documento;
            paciente.contacto_telefono_principal = contactos[0].telefono_principal;
            paciente.contacto_telefono_secundario = contactos[0].telefono_secundario;
            paciente.contacto_telefono_adicional = contactos[0].telefono_adicional;
            paciente.contacto_correo_electronico = contactos[0].correo_electronico;
            paciente.contacto_red_social = contactos[0].red_social;
        }

        paciente.contactos = contactos;
        paciente.solicitudes = solicitudes;
        paciente.solicitud_activa = solicitudes[0] || null;
        paciente.registro_solicitud_id = solicitudes[0]?.id || null;

        res.json({
            status: 'success',
            data: paciente
        });
    } catch (error) {
        console.error('Error al obtener paciente:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al consultar paciente', error: error.message });
    }
};

/**
 * Registrar paciente completo con contactos y nacionalidades (Transaccional)
 */
const createPaciente = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const {
            tipo_documento_id,
            tipo_documento,
            numero_documento,
            es_cedula_madre = 0,
            cedula_madre_prefijo,
            cedula_madre_numero,
            numero_hijo,
            primer_nombre,
            segundo_nombre,
            primer_apellido,
            segundo_apellido,
            fecha_nacimiento,
            edad_informada,
            unidad_edad_informada = 'años',
            sexo_id,
            sexo,
            pais_nacimiento_id,
            pais_nacimiento = 'Venezuela',
            estado_nacimiento_id,
            estado_nacimiento,
            municipio_nacimiento_id,
            municipio_nacimiento,
            parroquia_nacimiento_id,
            parroquia_nacimiento,
            ciudad_nacimiento_id,
            ciudad_nacimiento,
            lugar_nacimiento_otro,
            pais_residencia_id,
            pais_residencia = 'Venezuela',
            estado_residencia_id,
            estado_residencia,
            municipio_residencia_id,
            municipio_residencia,
            parroquia_residencia_id,
            parroquia_residencia,
            ciudad_residencia_id,
            ciudad_residencia,
            urbanizacion_sector,
            calle_avenida,
            casa_edificio,
            punto_referencia,
            direccion_completa,
            idioma_preferido_id,
            idioma_preferido = 'Español',
            requiere_interprete = 'no',
            idioma_interprete_id,
            idioma_interprete,
            idioma_interprete_otro,
            etnia_id,
            etnias = [],
            etnia_otro,
            // Arrays
            nacionalidades = [],
            otros_idiomas = [],
            // Contactos
            contactos = [],
            contacto_nombres,
            contacto_apellidos,
            contacto_parentesco,
            contacto_parentesco_otro,
            contacto_tipo_documento,
            contacto_numero_documento,
            contacto_telefono_principal,
            contacto_telefono_secundario,
            contacto_telefono_adicional,
            contacto_correo_electronico,
            contacto_red_social
        } = req.body;

        if (!primer_nombre || !primer_apellido) {
            await connection.rollback();
            return res.status(400).json({ status: 'error', message: 'El primer nombre y primer apellido son requeridos' });
        }

        // 1. Validar duplicidad de documento propio si se proporciona cédula o pasaporte
        if (numero_documento && String(numero_documento).trim() !== '') {
            const numDocLimpio = String(numero_documento).trim();
            const [duplicadoDoc] = await connection.query(
                'SELECT id, primer_nombre, primer_apellido, numero_historia_clinica FROM paciente WHERE numero_documento = ?',
                [numDocLimpio]
            );
            if (duplicadoDoc.length > 0) {
                await connection.rollback();
                return res.status(400).json({
                    status: 'error',
                    message: `Ya existe un paciente registrado con el número de cédula/documento ${numDocLimpio} (${duplicadoDoc[0].primer_nombre} ${duplicadoDoc[0].primer_apellido} - HCIL: ${duplicadoDoc[0].numero_historia_clinica})`
                });
            }
        }

        // 2. Validar duplicidad de cédula materna y número de hijo si aplica
        const tipoDocStr = String(tipo_documento || '').toLowerCase();
        const esNoPoseeDoc = tipoDocStr === 'no_posee' || tipo_documento_id === 3 || es_cedula_madre;
        if (esNoPoseeDoc && cedula_madre_numero && numero_hijo) {
            const cedulaLimpia = String(cedula_madre_numero).trim().replace(/\D/g, '');
            const prefijoLimpio = (cedula_madre_prefijo || 'V').trim().toUpperCase();
            const [duplicadoMaterno] = await connection.query(
                `SELECT id, primer_nombre, primer_apellido, numero_historia_clinica 
                 FROM paciente 
                 WHERE cedula_madre_numero = ? AND numero_hijo = ? AND (cedula_madre_prefijo = ? OR cedula_madre_prefijo IS NULL)`,
                [cedulaLimpia, numero_hijo, prefijoLimpio]
            );
            if (duplicadoMaterno.length > 0) {
                await connection.rollback();
                return res.status(400).json({
                    status: 'error',
                    message: `Ya existe un registro con la Cédula Materna ${prefijoLimpio}-${cedulaLimpia} y el Hijo N° ${numero_hijo} (${duplicadoMaterno[0].primer_nombre} ${duplicadoMaterno[0].primer_apellido} - HCIL: ${duplicadoMaterno[0].numero_historia_clinica})`
                });
            }
        }

        // Derivar código formal HCIL
        const hcil = derivarCodigoHCIL(req.body);

        // Verificar si la historia clínica ya está registrada
        const [existente] = await connection.query(
            'SELECT id FROM paciente WHERE numero_historia_clinica = ?',
            [hcil]
        );
        if (existente.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                status: 'error',
                message: `El número de historia clínica HCIL (${hcil}) ya se encuentra asignado a otro paciente`
            });
        }

        // Preparar sincronización de contacto y campos directos
        let finalContactoNombres = contacto_nombres;
        let finalContactoApellidos = contacto_apellidos;
        let finalContactoParentesco = contacto_parentesco;
        let finalContactoParentescoOtro = contacto_parentesco_otro;
        let finalContactoTipoDoc = contacto_tipo_documento;
        let finalContactoNumDoc = contacto_numero_documento;
        let finalContactoTelPrinc = contacto_telefono_principal;
        let finalContactoTelSec = contacto_telefono_secundario;
        let finalContactoTelAdic = contacto_telefono_adicional;
        let finalContactoEmail = contacto_correo_electronico;
        let finalContactoRedSocial = contacto_red_social;

        let listaContactos = Array.isArray(contactos) ? [...contactos] : [];
        if (listaContactos.length > 0) {
            const c0 = listaContactos[0];
            if (!finalContactoNombres) finalContactoNombres = c0.nombres;
            if (!finalContactoApellidos) finalContactoApellidos = c0.apellidos;
            if (!finalContactoParentesco) finalContactoParentesco = c0.parentesco || c0.parentesco_nombre;
            if (!finalContactoParentescoOtro) finalContactoParentescoOtro = c0.parentesco_otro;
            if (!finalContactoTipoDoc) finalContactoTipoDoc = c0.tipo_documento || c0.tipo_documento_nombre;
            if (!finalContactoNumDoc) finalContactoNumDoc = c0.numero_documento;
            if (!finalContactoTelPrinc) finalContactoTelPrinc = c0.telefono_principal;
            if (!finalContactoTelSec) finalContactoTelSec = c0.telefono_secundario;
            if (!finalContactoTelAdic) finalContactoTelAdic = c0.telefono_adicional;
            if (!finalContactoEmail) finalContactoEmail = c0.correo_electronico;
            if (!finalContactoRedSocial) finalContactoRedSocial = c0.red_social;
        } else if (finalContactoNombres && finalContactoApellidos) {
            listaContactos.push({
                nombres: finalContactoNombres,
                apellidos: finalContactoApellidos,
                parentesco: finalContactoParentesco || 'Madre',
                parentesco_otro: finalContactoParentescoOtro,
                tipo_documento: finalContactoTipoDoc || 'Cédula',
                numero_documento: finalContactoNumDoc,
                telefono_principal: finalContactoTelPrinc || 'N/A',
                telefono_secundario: finalContactoTelSec,
                telefono_adicional: finalContactoTelAdic,
                correo_electronico: finalContactoEmail,
                red_social: finalContactoRedSocial
            });
        }

        const strNac = Array.isArray(nacionalidades) ? JSON.stringify(nacionalidades) : (nacionalidades || null);
        const strOtrosIdiomas = Array.isArray(otros_idiomas) ? JSON.stringify(otros_idiomas) : (otros_idiomas || null);
        const strEtnias = Array.isArray(etnias) ? JSON.stringify(etnias) : (etnias || null);

        let finalSexoId = sexo_id;
        if (!finalSexoId && sexo) {
            if (String(sexo).toLowerCase().includes('masc')) finalSexoId = 13;
            else if (String(sexo).toLowerCase().includes('fem')) finalSexoId = 14;
        } else if (finalSexoId == 1) {
            finalSexoId = 14;
        } else if (finalSexoId == 2) {
            finalSexoId = 13;
        }

        let finalTipoDocId = tipo_documento_id;
        if (tipo_documento === 'cedula' || (!tipo_documento && finalTipoDocId === 1)) {
            finalTipoDocId = 10;
        } else if (tipo_documento === 'pasaporte' || (!tipo_documento && finalTipoDocId === 2)) {
            finalTipoDocId = 11;
        } else if (tipo_documento === 'no_posee' || (!tipo_documento && finalTipoDocId === 3)) {
            finalTipoDocId = 12;
        }

        const esVenezuelaRes = !pais_residencia || String(pais_residencia).trim().toLowerCase() === 'venezuela';
        const finalPaisResidencia = pais_residencia ? String(pais_residencia).trim() : 'Venezuela';
        const finalPaisResId = pais_residencia_id || null;
        const finalEstadoResId = estado_residencia_id || null;
        const finalEstadoRes = estado_residencia || null;
        const finalMunicipioResId = municipio_residencia_id || null;
        const finalMunicipioRes = municipio_residencia || null;
        const finalParroquiaResId = !esVenezuelaRes ? null : (parroquia_residencia_id || null);
        const finalParroquiaRes = !esVenezuelaRes ? null : (parroquia_residencia || null);
        const finalCiudadResId = esVenezuelaRes ? null : (ciudad_residencia_id || null);
        const finalCiudadRes = esVenezuelaRes ? null : (ciudad_residencia || null);

        // Insertar paciente principal
        const [resultPaciente] = await connection.query(
            `INSERT INTO paciente (
                numero_historia_clinica,
                tipo_documento_id,
                tipo_documento,
                numero_documento,
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
                sexo_id,
                sexo,
                nacionalidades,
                pais_nacimiento_id,
                pais_nacimiento,
                estado_nacimiento_id,
                estado_nacimiento,
                municipio_nacimiento_id,
                municipio_nacimiento,
                parroquia_nacimiento_id,
                parroquia_nacimiento,
                ciudad_nacimiento_id,
                ciudad_nacimiento,
                lugar_nacimiento_otro,
                pais_residencia_id,
                pais_residencia,
                estado_residencia_id,
                estado_residencia,
                municipio_residencia_id,
                municipio_residencia,
                parroquia_residencia_id,
                parroquia_residencia,
                ciudad_residencia_id,
                ciudad_residencia,
                urbanizacion_sector,
                calle_avenida,
                casa_edificio,
                punto_referencia,
                direccion_completa,
                idioma_preferido_id,
                idioma_preferido,
                otros_idiomas,
                requiere_interprete,
                idioma_interprete_id,
                idioma_interprete,
                idioma_interprete_otro,
                etnia_id,
                etnias,
                etnia_otro,
                contacto_nombres,
                contacto_apellidos,
                contacto_parentesco,
                contacto_parentesco_otro,
                contacto_tipo_documento,
                contacto_numero_documento,
                contacto_telefono_principal,
                contacto_telefono_secundario,
                contacto_telefono_adicional,
                contacto_correo_electronico,
                contacto_red_social,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?
            )`,
            [
                hcil,
                finalTipoDocId || null,
                tipo_documento || null,
                numero_documento || null,
                es_cedula_madre ? 1 : 0,
                cedula_madre_prefijo || null,
                cedula_madre_numero || null,
                numero_hijo || null,
                primer_nombre,
                segundo_nombre || null,
                primer_apellido,
                segundo_apellido || null,
                fecha_nacimiento || null,
                edad_informada || null,
                unidad_edad_informada || 'años',
                finalSexoId || null,
                sexo || null,
                strNac,
                pais_nacimiento_id || null,
                pais_nacimiento || 'Venezuela',
                estado_nacimiento_id || null,
                estado_nacimiento || null,
                municipio_nacimiento_id || null,
                municipio_nacimiento || null,
                parroquia_nacimiento_id || null,
                parroquia_nacimiento || null,
                ciudad_nacimiento_id || null,
                ciudad_nacimiento || null,
                lugar_nacimiento_otro || null,
                finalPaisResId,
                finalPaisResidencia,
                finalEstadoResId,
                finalEstadoRes,
                finalMunicipioResId,
                finalMunicipioRes,
                finalParroquiaResId,
                finalParroquiaRes,
                finalCiudadResId,
                finalCiudadRes,
                urbanizacion_sector || null,
                calle_avenida || null,
                casa_edificio || null,
                punto_referencia || null,
                direccion_completa || null,
                idioma_preferido_id || null,
                idioma_preferido || 'Español',
                strOtrosIdiomas,
                requiere_interprete || 'no',
                idioma_interprete_id || null,
                idioma_interprete || null,
                idioma_interprete_otro || null,
                etnia_id || null,
                strEtnias,
                etnia_otro || null,
                finalContactoNombres || null,
                finalContactoApellidos || null,
                finalContactoParentesco || null,
                finalContactoParentescoOtro || null,
                finalContactoTipoDoc || null,
                finalContactoNumDoc || null,
                finalContactoTelPrinc || null,
                finalContactoTelSec || null,
                finalContactoTelAdic || null,
                finalContactoEmail || null,
                finalContactoRedSocial || null,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        const pacienteId = resultPaciente.insertId;

        // Insertar contactos responsables en tabla secundaria
        if (listaContactos.length > 0) {
            for (const c of listaContactos) {
                if (c.nombres && c.apellidos) {
                    await connection.query(
                        `INSERT INTO paciente_contacto_responsable (
                            paciente_id,
                            nombres,
                            apellidos,
                            parentesco_id,
                            parentesco,
                            parentesco_otro,
                            tipo_documento_id,
                            tipo_documento,
                            numero_documento,
                            telefono_principal,
                            telefono_secundario,
                            telefono_adicional,
                            correo_electronico,
                            red_social,
                            audit_usu_id,
                            audit_ip,
                            audit_dep_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            pacienteId,
                            c.nombres,
                            c.apellidos,
                            c.parentesco_id || 1,
                            c.parentesco || c.parentesco_nombre || 'Madre',
                            c.parentesco_otro || null,
                            c.tipo_documento_id || null,
                            c.tipo_documento || c.tipo_documento_nombre || 'Cédula',
                            c.numero_documento || null,
                            c.telefono_principal || 'N/A',
                            c.telefono_secundario || null,
                            c.telefono_adicional || null,
                            c.correo_electronico || null,
                            c.red_social || null,
                            audit.audit_usu_id,
                            audit.audit_ip,
                            audit.audit_dep_id
                        ]
                    );
                }
            }
        }

        // Insertar nacionalidades si vienen con IDs numéricos
        if (Array.isArray(nacionalidades) && nacionalidades.length > 0) {
            for (const nacId of nacionalidades) {
                if (typeof nacId === 'number' || /^\d+$/.test(String(nacId))) {
                    await connection.query(
                        `INSERT INTO paciente_nacionalidad (
                            paciente_id,
                            nacionalidad_id,
                            audit_usu_id,
                            audit_ip,
                            audit_dep_id
                        ) VALUES (?, ?, ?, ?, ?)`,
                        [pacienteId, Number(nacId), audit.audit_usu_id, audit.audit_ip, audit.audit_dep_id]
                    );
                }
            }
        }

        // Crear automáticamente la solicitud clínica inicial para el paciente
        const [solResult] = await connection.query(
            `INSERT INTO registro_solicitud (
                paciente_id,
                centro_salud_id,
                tipo_operacion_id,
                fecha_solicitud,
                estatus,
                observacion_general,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, 4, 1, CURDATE(), 'Pendiente', 'Solicitud inicial de atención médica pediátrica', ?, ?, ?)`,
            [
                pacienteId,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        await connection.commit();

        res.status(201).json({
            status: 'success',
            message: 'Paciente registrado exitosamente en el sistema pediátrico',
            id: pacienteId,
            numero_historia_clinica: hcil,
            solicitud_id: solResult.insertId
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar paciente:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al registrar paciente', error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Actualizar datos administrativos de un paciente
 */
const updatePaciente = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };

        // Verificar existencia
        const [existe] = await connection.query('SELECT id, numero_historia_clinica FROM paciente WHERE id = ?', [id]);
        if (existe.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Paciente no encontrado' });
        }

        const {
            tipo_documento_id,
            tipo_documento,
            numero_documento,
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
            sexo_id,
            sexo,
            pais_nacimiento_id,
            pais_nacimiento,
            estado_nacimiento_id,
            estado_nacimiento,
            municipio_nacimiento_id,
            municipio_nacimiento,
            parroquia_nacimiento_id,
            parroquia_nacimiento,
            ciudad_nacimiento_id,
            ciudad_nacimiento,
            lugar_nacimiento_otro,
            pais_residencia_id,
            pais_residencia,
            estado_residencia_id,
            estado_residencia,
            municipio_residencia_id,
            municipio_residencia,
            parroquia_residencia_id,
            parroquia_residencia,
            ciudad_residencia_id,
            ciudad_residencia,
            urbanizacion_sector,
            calle_avenida,
            casa_edificio,
            punto_referencia,
            direccion_completa,
            idioma_preferido_id,
            idioma_preferido,
            requiere_interprete,
            idioma_interprete_id,
            idioma_interprete,
            idioma_interprete_otro,
            etnia_id,
            etnias,
            etnia_otro,
            nacionalidades,
            otros_idiomas,
            // Contactos
            contactos = [],
            contacto_nombres,
            contacto_apellidos,
            contacto_parentesco,
            contacto_parentesco_otro,
            contacto_tipo_documento,
            contacto_numero_documento,
            contacto_telefono_principal,
            contacto_telefono_secundario,
            contacto_telefono_adicional,
            contacto_correo_electronico,
            contacto_red_social
        } = req.body;

        // 1. Validar duplicidad de documento propio si se actualiza el número de cédula o pasaporte
        if (numero_documento && String(numero_documento).trim() !== '') {
            const numDocLimpio = String(numero_documento).trim();
            const [duplicadoDoc] = await connection.query(
                'SELECT id, primer_nombre, primer_apellido, numero_historia_clinica FROM paciente WHERE numero_documento = ? AND id != ?',
                [numDocLimpio, id]
            );
            if (duplicadoDoc.length > 0) {
                await connection.rollback();
                return res.status(400).json({
                    status: 'error',
                    message: `Ya existe otro paciente registrado con el número de cédula/documento ${numDocLimpio} (${duplicadoDoc[0].primer_nombre} ${duplicadoDoc[0].primer_apellido} - HCIL: ${duplicadoDoc[0].numero_historia_clinica})`
                });
            }
        }

        // 2. Validar duplicidad de cédula materna y número de hijo si aplica
        const tipoDocStr = String(tipo_documento || '').toLowerCase();
        const esNoPoseeDoc = tipoDocStr === 'no_posee' || tipo_documento_id === 3 || es_cedula_madre;
        if (esNoPoseeDoc && cedula_madre_numero && numero_hijo) {
            const cedulaLimpia = String(cedula_madre_numero).trim().replace(/\D/g, '');
            const prefijoLimpio = (cedula_madre_prefijo || 'V').trim().toUpperCase();
            const [duplicadoMaterno] = await connection.query(
                `SELECT id, primer_nombre, primer_apellido, numero_historia_clinica 
                 FROM paciente 
                 WHERE cedula_madre_numero = ? AND numero_hijo = ? AND (cedula_madre_prefijo = ? OR cedula_madre_prefijo IS NULL) AND id != ?`,
                [cedulaLimpia, numero_hijo, prefijoLimpio, id]
            );
            if (duplicadoMaterno.length > 0) {
                await connection.rollback();
                return res.status(400).json({
                    status: 'error',
                    message: `Ya existe otro registro con la Cédula Materna ${prefijoLimpio}-${cedulaLimpia} y el Hijo N° ${numero_hijo} (${duplicadoMaterno[0].primer_nombre} ${duplicadoMaterno[0].primer_apellido} - HCIL: ${duplicadoMaterno[0].numero_historia_clinica})`
                });
            }
        }

        const strNac = nacionalidades !== undefined ? (Array.isArray(nacionalidades) ? JSON.stringify(nacionalidades) : nacionalidades) : undefined;
        const strOtrosIdiomas = otros_idiomas !== undefined ? (Array.isArray(otros_idiomas) ? JSON.stringify(otros_idiomas) : otros_idiomas) : undefined;
        const strEtnias = etnias !== undefined ? (Array.isArray(etnias) ? JSON.stringify(etnias) : etnias) : undefined;

        let finalContactoNombres = contacto_nombres;
        let finalContactoApellidos = contacto_apellidos;
        let finalContactoParentesco = contacto_parentesco;
        let finalContactoParentescoOtro = contacto_parentesco_otro;
        let finalContactoTipoDoc = contacto_tipo_documento;
        let finalContactoNumDoc = contacto_numero_documento;
        let finalContactoTelPrinc = contacto_telefono_principal;
        let finalContactoTelSec = contacto_telefono_secundario;
        let finalContactoTelAdic = contacto_telefono_adicional;
        let finalContactoEmail = contacto_correo_electronico;
        let finalContactoRedSocial = contacto_red_social;

        let listaContactos = Array.isArray(contactos) ? [...contactos] : [];
        if (listaContactos.length > 0) {
            const c0 = listaContactos[0];
            if (!finalContactoNombres) finalContactoNombres = c0.nombres;
            if (!finalContactoApellidos) finalContactoApellidos = c0.apellidos;
            if (!finalContactoParentesco) finalContactoParentesco = c0.parentesco || c0.parentesco_nombre;
            if (!finalContactoParentescoOtro) finalContactoParentescoOtro = c0.parentesco_otro;
            if (!finalContactoTipoDoc) finalContactoTipoDoc = c0.tipo_documento || c0.tipo_documento_nombre;
            if (!finalContactoNumDoc) finalContactoNumDoc = c0.numero_documento;
            if (!finalContactoTelPrinc) finalContactoTelPrinc = c0.telefono_principal;
            if (!finalContactoTelSec) finalContactoTelSec = c0.telefono_secundario;
            if (!finalContactoTelAdic) finalContactoTelAdic = c0.telefono_adicional;
            if (!finalContactoEmail) finalContactoEmail = c0.correo_electronico;
            if (!finalContactoRedSocial) finalContactoRedSocial = c0.red_social;
        }

        let finalSexoId = sexo_id;
        if (!finalSexoId && sexo) {
            if (String(sexo).toLowerCase().includes('masc')) finalSexoId = 13;
            else if (String(sexo).toLowerCase().includes('fem')) finalSexoId = 14;
        } else if (finalSexoId == 1) {
            finalSexoId = 14;
        } else if (finalSexoId == 2) {
            finalSexoId = 13;
        }

        let finalTipoDocId = tipo_documento_id;
        if (tipo_documento === 'cedula' || (!tipo_documento && finalTipoDocId === 1)) {
            finalTipoDocId = 10;
        } else if (tipo_documento === 'pasaporte' || (!tipo_documento && finalTipoDocId === 2)) {
            finalTipoDocId = 11;
        } else if (tipo_documento === 'no_posee' || (!tipo_documento && finalTipoDocId === 3)) {
            finalTipoDocId = 12;
        }

        const updateResidencia = pais_residencia !== undefined;
        const esVenezuelaRes = updateResidencia
            ? (!pais_residencia || String(pais_residencia).trim().toLowerCase() === 'venezuela')
            : null;

        let finalPaisResId = pais_residencia_id !== undefined ? (pais_residencia_id || null) : null;
        let finalPaisRes = pais_residencia !== undefined ? (pais_residencia || 'Venezuela') : null;
        let finalEstadoResId = estado_residencia_id !== undefined ? (estado_residencia_id || null) : null;
        let finalEstadoRes = estado_residencia !== undefined ? (estado_residencia || null) : null;
        let finalMunicipioResId = municipio_residencia_id !== undefined ? (municipio_residencia_id || null) : null;
        let finalMunicipioRes = municipio_residencia !== undefined ? (municipio_residencia || null) : null;
        let finalParroquiaResId = parroquia_residencia_id !== undefined ? (parroquia_residencia_id || null) : null;
        let finalParroquiaRes = parroquia_residencia !== undefined ? (parroquia_residencia || null) : null;
        let finalCiudadResId = ciudad_residencia_id !== undefined ? (ciudad_residencia_id || null) : null;
        let finalCiudadRes = ciudad_residencia !== undefined ? (ciudad_residencia || null) : null;

        if (esVenezuelaRes === true) {
            finalCiudadResId = null;
            finalCiudadRes = null;
        } else if (esVenezuelaRes === false) {
            finalParroquiaResId = null;
            finalParroquiaRes = null;
        }

        await connection.query(
            `UPDATE paciente SET
                tipo_documento_id = COALESCE(?, tipo_documento_id),
                tipo_documento = COALESCE(?, tipo_documento),
                numero_documento = COALESCE(?, numero_documento),
                es_cedula_madre = COALESCE(?, es_cedula_madre),
                cedula_madre_prefijo = COALESCE(?, cedula_madre_prefijo),
                cedula_madre_numero = COALESCE(?, cedula_madre_numero),
                numero_hijo = COALESCE(?, numero_hijo),
                primer_nombre = COALESCE(?, primer_nombre),
                segundo_nombre = COALESCE(?, segundo_nombre),
                primer_apellido = COALESCE(?, primer_apellido),
                segundo_apellido = COALESCE(?, segundo_apellido),
                fecha_nacimiento = COALESCE(?, fecha_nacimiento),
                edad_informada = COALESCE(?, edad_informada),
                unidad_edad_informada = COALESCE(?, unidad_edad_informada),
                sexo_id = COALESCE(?, sexo_id),
                sexo = COALESCE(?, sexo),
                nacionalidades = COALESCE(?, nacionalidades),
                pais_nacimiento_id = COALESCE(?, pais_nacimiento_id),
                pais_nacimiento = COALESCE(?, pais_nacimiento),
                estado_nacimiento_id = COALESCE(?, estado_nacimiento_id),
                estado_nacimiento = COALESCE(?, estado_nacimiento),
                municipio_nacimiento_id = COALESCE(?, municipio_nacimiento_id),
                municipio_nacimiento = COALESCE(?, municipio_nacimiento),
                parroquia_nacimiento_id = COALESCE(?, parroquia_nacimiento_id),
                parroquia_nacimiento = COALESCE(?, parroquia_nacimiento),
                ciudad_nacimiento_id = COALESCE(?, ciudad_nacimiento_id),
                ciudad_nacimiento = COALESCE(?, ciudad_nacimiento),
                lugar_nacimiento_otro = COALESCE(?, lugar_nacimiento_otro),
                pais_residencia_id = CASE WHEN ? = 1 THEN ? ELSE pais_residencia_id END,
                pais_residencia = CASE WHEN ? = 1 THEN ? ELSE pais_residencia END,
                estado_residencia_id = CASE WHEN ? = 1 THEN ? ELSE estado_residencia_id END,
                estado_residencia = CASE WHEN ? = 1 THEN ? ELSE estado_residencia END,
                municipio_residencia_id = CASE WHEN ? = 1 THEN ? ELSE municipio_residencia_id END,
                municipio_residencia = CASE WHEN ? = 1 THEN ? ELSE municipio_residencia END,
                parroquia_residencia_id = CASE WHEN ? = 1 THEN ? ELSE parroquia_residencia_id END,
                parroquia_residencia = CASE WHEN ? = 1 THEN ? ELSE parroquia_residencia END,
                ciudad_residencia_id = CASE WHEN ? = 1 THEN ? ELSE ciudad_residencia_id END,
                ciudad_residencia = CASE WHEN ? = 1 THEN ? ELSE ciudad_residencia END,
                urbanizacion_sector = COALESCE(?, urbanizacion_sector),
                calle_avenida = COALESCE(?, calle_avenida),
                casa_edificio = COALESCE(?, casa_edificio),
                punto_referencia = COALESCE(?, punto_referencia),
                direccion_completa = COALESCE(?, direccion_completa),
                idioma_preferido_id = COALESCE(?, idioma_preferido_id),
                idioma_preferido = COALESCE(?, idioma_preferido),
                otros_idiomas = COALESCE(?, otros_idiomas),
                requiere_interprete = COALESCE(?, requiere_interprete),
                idioma_interprete_id = COALESCE(?, idioma_interprete_id),
                idioma_interprete = COALESCE(?, idioma_interprete),
                idioma_interprete_otro = COALESCE(?, idioma_interprete_otro),
                etnia_id = COALESCE(?, etnia_id),
                etnias = COALESCE(?, etnias),
                etnia_otro = COALESCE(?, etnia_otro),
                contacto_nombres = COALESCE(?, contacto_nombres),
                contacto_apellidos = COALESCE(?, contacto_apellidos),
                contacto_parentesco = COALESCE(?, contacto_parentesco),
                contacto_parentesco_otro = COALESCE(?, contacto_parentesco_otro),
                contacto_tipo_documento = COALESCE(?, contacto_tipo_documento),
                contacto_numero_documento = COALESCE(?, contacto_numero_documento),
                contacto_telefono_principal = COALESCE(?, contacto_telefono_principal),
                contacto_telefono_secundario = COALESCE(?, contacto_telefono_secundario),
                contacto_telefono_adicional = COALESCE(?, contacto_telefono_adicional),
                contacto_correo_electronico = COALESCE(?, contacto_correo_electronico),
                contacto_red_social = COALESCE(?, contacto_red_social),
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`,
            [
                finalTipoDocId !== undefined ? finalTipoDocId : null,
                tipo_documento !== undefined ? tipo_documento : null,
                numero_documento !== undefined ? numero_documento : null,
                es_cedula_madre !== undefined ? (es_cedula_madre ? 1 : 0) : null,
                cedula_madre_prefijo !== undefined ? cedula_madre_prefijo : null,
                cedula_madre_numero !== undefined ? cedula_madre_numero : null,
                numero_hijo !== undefined ? numero_hijo : null,
                primer_nombre !== undefined ? primer_nombre : null,
                segundo_nombre !== undefined ? segundo_nombre : null,
                primer_apellido !== undefined ? primer_apellido : null,
                segundo_apellido !== undefined ? segundo_apellido : null,
                fecha_nacimiento !== undefined ? fecha_nacimiento : null,
                edad_informada !== undefined ? edad_informada : null,
                unidad_edad_informada !== undefined ? unidad_edad_informada : null,
                finalSexoId !== undefined ? finalSexoId : null,
                sexo !== undefined ? sexo : null,
                strNac !== undefined ? strNac : null,
                pais_nacimiento_id !== undefined ? pais_nacimiento_id : null,
                pais_nacimiento !== undefined ? pais_nacimiento : null,
                estado_nacimiento_id !== undefined ? estado_nacimiento_id : null,
                estado_nacimiento !== undefined ? estado_nacimiento : null,
                municipio_nacimiento_id !== undefined ? municipio_nacimiento_id : null,
                municipio_nacimiento !== undefined ? municipio_nacimiento : null,
                parroquia_nacimiento_id !== undefined ? parroquia_nacimiento_id : null,
                parroquia_nacimiento !== undefined ? parroquia_nacimiento : null,
                ciudad_nacimiento_id !== undefined ? ciudad_nacimiento_id : null,
                ciudad_nacimiento !== undefined ? ciudad_nacimiento : null,
                lugar_nacimiento_otro !== undefined ? lugar_nacimiento_otro : null,
                updateResidencia ? 1 : 0,
                finalPaisResId,
                updateResidencia ? 1 : 0,
                finalPaisRes,
                updateResidencia ? 1 : 0,
                finalEstadoResId,
                updateResidencia ? 1 : 0,
                finalEstadoRes,
                updateResidencia ? 1 : 0,
                finalMunicipioResId,
                updateResidencia ? 1 : 0,
                finalMunicipioRes,
                updateResidencia ? 1 : 0,
                finalParroquiaResId,
                updateResidencia ? 1 : 0,
                finalParroquiaRes,
                updateResidencia ? 1 : 0,
                finalCiudadResId,
                updateResidencia ? 1 : 0,
                finalCiudadRes,
                urbanizacion_sector !== undefined ? urbanizacion_sector : null,
                calle_avenida !== undefined ? calle_avenida : null,
                casa_edificio !== undefined ? casa_edificio : null,
                punto_referencia !== undefined ? punto_referencia : null,
                direccion_completa !== undefined ? direccion_completa : null,
                idioma_preferido_id !== undefined ? idioma_preferido_id : null,
                idioma_preferido !== undefined ? idioma_preferido : null,
                strOtrosIdiomas !== undefined ? strOtrosIdiomas : null,
                requiere_interprete !== undefined ? requiere_interprete : null,
                idioma_interprete_id !== undefined ? idioma_interprete_id : null,
                idioma_interprete !== undefined ? idioma_interprete : null,
                idioma_interprete_otro !== undefined ? idioma_interprete_otro : null,
                etnia_id !== undefined ? etnia_id : null,
                strEtnias !== undefined ? strEtnias : null,
                etnia_otro !== undefined ? etnia_otro : null,
                finalContactoNombres !== undefined ? finalContactoNombres : null,
                finalContactoApellidos !== undefined ? finalContactoApellidos : null,
                finalContactoParentesco !== undefined ? finalContactoParentesco : null,
                finalContactoParentescoOtro !== undefined ? finalContactoParentescoOtro : null,
                finalContactoTipoDoc !== undefined ? finalContactoTipoDoc : null,
                finalContactoNumDoc !== undefined ? finalContactoNumDoc : null,
                finalContactoTelPrinc !== undefined ? finalContactoTelPrinc : null,
                finalContactoTelSec !== undefined ? finalContactoTelSec : null,
                finalContactoTelAdic !== undefined ? finalContactoTelAdic : null,
                finalContactoEmail !== undefined ? finalContactoEmail : null,
                finalContactoRedSocial !== undefined ? finalContactoRedSocial : null,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                id
            ]
        );

        // Si se actualizan contactos en paciente_contacto_responsable
        if (listaContactos.length > 0 || finalContactoNombres) {
            const [contExistentes] = await connection.query(
                'SELECT id FROM paciente_contacto_responsable WHERE paciente_id = ? AND estatus = 1 ORDER BY id ASC LIMIT 1',
                [id]
            );

            const cData = listaContactos[0] || {
                nombres: finalContactoNombres,
                apellidos: finalContactoApellidos,
                parentesco: finalContactoParentesco || 'Madre',
                parentesco_otro: finalContactoParentescoOtro,
                tipo_documento: finalContactoTipoDoc || 'Cédula',
                numero_documento: finalContactoNumDoc,
                telefono_principal: finalContactoTelPrinc || 'N/A',
                telefono_secundario: finalContactoTelSec,
                telefono_adicional: finalContactoTelAdic,
                correo_electronico: finalContactoEmail,
                red_social: finalContactoRedSocial
            };

            if (contExistentes.length > 0) {
                await connection.query(
                    `UPDATE paciente_contacto_responsable SET
                        nombres = COALESCE(?, nombres),
                        apellidos = COALESCE(?, apellidos),
                        parentesco = COALESCE(?, parentesco),
                        parentesco_otro = COALESCE(?, parentesco_otro),
                        tipo_documento = COALESCE(?, tipo_documento),
                        numero_documento = COALESCE(?, numero_documento),
                        telefono_principal = COALESCE(?, telefono_principal),
                        telefono_secundario = COALESCE(?, telefono_secundario),
                        telefono_adicional = COALESCE(?, telefono_adicional),
                        correo_electronico = COALESCE(?, correo_electronico),
                        red_social = COALESCE(?, red_social),
                        audit_usu_id = ?,
                        audit_ip = ?,
                        audit_dep_id = ?
                    WHERE id = ?`,
                    [
                        cData.nombres || null,
                        cData.apellidos || null,
                        cData.parentesco || cData.parentesco_nombre || null,
                        cData.parentesco_otro || null,
                        cData.tipo_documento || cData.tipo_documento_nombre || null,
                        cData.numero_documento || null,
                        cData.telefono_principal || null,
                        cData.telefono_secundario || null,
                        cData.telefono_adicional || null,
                        cData.correo_electronico || null,
                        cData.red_social || null,
                        audit.audit_usu_id,
                        audit.audit_ip,
                        audit.audit_dep_id,
                        contExistentes[0].id
                    ]
                );
            } else if (cData.nombres && cData.apellidos) {
                await connection.query(
                    `INSERT INTO paciente_contacto_responsable (
                        paciente_id,
                        nombres,
                        apellidos,
                        parentesco_id,
                        parentesco,
                        parentesco_otro,
                        tipo_documento_id,
                        tipo_documento,
                        numero_documento,
                        telefono_principal,
                        telefono_secundario,
                        telefono_adicional,
                        correo_electronico,
                        red_social,
                        audit_usu_id,
                        audit_ip,
                        audit_dep_id
                    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        cData.nombres,
                        cData.apellidos,
                        cData.parentesco || cData.parentesco_nombre || 'Madre',
                        cData.parentesco_otro || null,
                        cData.tipo_documento_id || null,
                        cData.tipo_documento || cData.tipo_documento_nombre || 'Cédula',
                        cData.numero_documento || null,
                        cData.telefono_principal || 'N/A',
                        cData.telefono_secundario || null,
                        cData.telefono_adicional || null,
                        cData.correo_electronico || null,
                        cData.red_social || null,
                        audit.audit_usu_id,
                        audit.audit_ip,
                        audit.audit_dep_id
                    ]
                );
            }
        }

        // Si se actualizan nacionalidades
        if (Array.isArray(nacionalidades)) {
            await connection.query('DELETE FROM paciente_nacionalidad WHERE paciente_id = ?', [id]);
            for (const nacId of nacionalidades) {
                if (typeof nacId === 'number' || /^\d+$/.test(String(nacId))) {
                    await connection.query(
                        `INSERT INTO paciente_nacionalidad (
                            paciente_id,
                            nacionalidad_id,
                            audit_usu_id,
                            audit_ip,
                            audit_dep_id
                        ) VALUES (?, ?, ?, ?, ?)`,
                        [id, Number(nacId), audit.audit_usu_id, audit.audit_ip, audit.audit_dep_id]
                    );
                }
            }
        }

        await connection.commit();

        res.json({
            status: 'success',
            message: 'Datos del paciente actualizados exitosamente',
            id
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al actualizar paciente:', error);
        res.status(500).json({ status: 'error', message: 'Error interno al actualizar datos', error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Agregar contacto responsable a un paciente
 */
const addContacto = async (req, res) => {
    try {
        const { id } = req.params;
        const audit = req.audit || { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' };
        const {
            nombres,
            apellidos,
            parentesco_id,
            parentesco_otro,
            tipo_documento_id,
            numero_documento,
            telefono_principal,
            telefono_secundario,
            telefono_adicional,
            correo_electronico,
            red_social
        } = req.body;

        if (!nombres || !apellidos || !telefono_principal) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Nombres, apellidos y teléfono principal son obligatorios' 
            });
        }

        const [result] = await db.query(
            `INSERT INTO paciente_contacto_responsable (
                paciente_id,
                nombres,
                apellidos,
                parentesco_id,
                parentesco_otro,
                tipo_documento_id,
                numero_documento,
                telefono_principal,
                telefono_secundario,
                telefono_adicional,
                correo_electronico,
                red_social,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                nombres,
                apellidos,
                parentesco_id || 1,
                parentesco_otro || null,
                tipo_documento_id || null,
                numero_documento || null,
                telefono_principal,
                telefono_secundario || null,
                telefono_adicional || null,
                correo_electronico || null,
                red_social || null,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );

        res.status(201).json({
            status: 'success',
            message: 'Contacto responsable agregado exitosamente',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error al agregar contacto:', error);
        res.status(500).json({ status: 'error', message: 'Error al agregar contacto responsable', error: error.message });
    }
};

module.exports = {
    getPacientes,
    getPacientePorId,
    createPaciente,
    updatePaciente,
    addContacto
};
