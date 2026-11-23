// backend/controllers/precargaReferencia/pacienteUpsertService.js

const SOLO_LETRAS_NOMBRE_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+(?:\s+[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+)*$/;

const validarNombreSoloLetras = (valor, etiqueta) => {
    const clean = String(valor || '').trim();
    if (!clean) return;
    if (!SOLO_LETRAS_NOMBRE_REGEX.test(clean)) {
        const err = new Error(`${etiqueta} solo debe contener letras y acentos (sin números ni caracteres especiales).`);
        err.statusCode = 400;
        throw err;
    }
};

const splitNombreCompleto = (texto) => {
    const clean = String(texto || '').trim().replace(/\s+/g, ' ');
    if (!clean) return { primero: '', segundo: null };
    const parts = clean.split(' ');
    return {
        primero: parts[0],
        segundo: parts.length > 1 ? parts.slice(1).join(' ') : null
    };
};

const calcularEdadNumericaSimple = (fechaNacStr, fechaRefStr) => {
    if (!fechaNacStr) return { edad: null, unidad: 'años' };
    const birth = new Date(fechaNacStr);
    const ref = fechaRefStr ? new Date(fechaRefStr) : new Date();
    if (isNaN(birth.getTime()) || isNaN(ref.getTime()) || birth > ref) {
        return { edad: null, unidad: 'años' };
    }
    const diffDays = Math.floor((ref - birth) / 86400000);
    if (diffDays < 60) return { edad: Math.max(0, diffDays), unidad: 'días' };
    let months = (ref.getFullYear() - birth.getFullYear()) * 12 + (ref.getMonth() - birth.getMonth());
    if (ref.getDate() < birth.getDate()) months--;
    if (months < 12) return { edad: Math.max(1, months), unidad: 'meses' };
    return { edad: Math.floor(months / 12), unidad: 'años' };
};

const isValidCalendarDateYMD = (val) => {
    if (!val) return false;
    const s = String(val).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const normalizarTipoDocEntrada = (rawTipo, numDoc) => {
    const t = String(rawTipo || '').trim();
    const low = t.toLowerCase();
    if (!t || low === 'no indicado') {
        return numDoc ? 'Cédula V' : 'Sin documento';
    }
    if (low === 'no_posee' || low.includes('sin documento')) return 'Sin documento';
    return t.slice(0, 50);
};

const generarHCILProvisional = (tipoDoc, numDoc, cedMadreNum, numHijo) => {
    const cleanDoc = String(numDoc || '').trim().toUpperCase().replace(/\s+/g, '');
    const tipoLower = String(tipoDoc || '').toLowerCase();
    if (cleanDoc && !tipoLower.includes('sin documento') && tipoLower !== 'no_posee') {
        return cleanDoc.slice(0, 30);
    }
    if (cedMadreNum) {
        const digits = String(cedMadreNum).replace(/\D/g, '');
        if (digits) return `V${digits}${numHijo || 1}R`.slice(0, 30);
    }
    return `REF-${Date.now().toString().slice(-8)}`;
};

/**
 * Busca si el paciente ya existe (por paciente_id, por número de documento, o por nombre+apellido+fecha_nacimiento)
 * y realiza UPDATE si existe o INSERT si no existe. Retorna { paciente_id, numero_historia_clinica, creado }.
 */
const upsertPacienteYRepresentante = async (connection, body, audit, options = {}) => {
    const { allowIdentityUpdate = false } = options;
    const {
        paciente_id,
        paciente_nombres,
        paciente_apellidos,
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        paciente_tipo_documento,
        paciente_num_documento,
        paciente_fecha_nacimiento,
        paciente_sexo_registrado,
        paciente_nacionalidad,
        domicilio_estado,
        domicilio_municipio,
        domicilio_direccion,
        fecha_referencia,
        representante_nombres,
        representante_apellidos,
        representante_parentesco,
        representante_doc_numero,
        representante_movil,
        representante_telefono,
        representante_email
    } = body;

    const nombresSplit = primer_nombre
        ? { primero: String(primer_nombre).trim().slice(0, 60), segundo: segundo_nombre ? String(segundo_nombre).trim().slice(0, 60) : null }
        : splitNombreCompleto(paciente_nombres);

    const apellidosSplit = primer_apellido
        ? { primero: String(primer_apellido).trim().slice(0, 60), segundo: segundo_apellido ? String(segundo_apellido).trim().slice(0, 60) : null }
        : splitNombreCompleto(paciente_apellidos);

    if (nombresSplit.primero) nombresSplit.primero = nombresSplit.primero.slice(0, 60);
    if (nombresSplit.segundo) nombresSplit.segundo = nombresSplit.segundo.slice(0, 60);
    if (apellidosSplit.primero) apellidosSplit.primero = apellidosSplit.primero.slice(0, 60);
    if (apellidosSplit.segundo) apellidosSplit.segundo = apellidosSplit.segundo.slice(0, 60);

    if (!nombresSplit.primero || !apellidosSplit.primero) {
        const err = new Error('Los nombres y apellidos del paciente son obligatorios.');
        err.statusCode = 400;
        throw err;
    }

    validarNombreSoloLetras(nombresSplit.primero, 'El primer nombre del paciente');
    validarNombreSoloLetras(nombresSplit.segundo, 'El segundo nombre del paciente');
    validarNombreSoloLetras(apellidosSplit.primero, 'El primer apellido del paciente');
    validarNombreSoloLetras(apellidosSplit.segundo, 'El segundo apellido del paciente');

    const tipoDoc = normalizarTipoDocEntrada(paciente_tipo_documento, paciente_num_documento);
    const isSinDoc = !tipoDoc || tipoDoc.toLowerCase().includes('sin documento') || tipoDoc.toLowerCase() === 'no_posee';
    const numDoc = (!isSinDoc && paciente_num_documento && String(paciente_num_documento).trim() !== '')
        ? String(paciente_num_documento).trim().toUpperCase().slice(0, 30)
        : null;

    const rawFechaNac = paciente_fecha_nacimiento ? String(paciente_fecha_nacimiento).trim() : '';
    let fechaNac = null;
    if (rawFechaNac) {
        if (!isValidCalendarDateYMD(rawFechaNac)) {
            const err = new Error('La fecha de nacimiento no es válida.');
            err.statusCode = 400;
            throw err;
        }
        const hoy = new Date();
        const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        if (rawFechaNac > hoyStr) {
            const err = new Error('La fecha de nacimiento no puede ser posterior a la fecha actual.');
            err.statusCode = 400;
            throw err;
        }
        fechaNac = rawFechaNac;
    }
    const sexo = paciente_sexo_registrado ? String(paciente_sexo_registrado).trim().slice(0, 20) : null;
    const nacionalidad = paciente_nacionalidad ? String(paciente_nacionalidad).trim().slice(0, 100) : null;
    const nacionalidadesJson = nacionalidad ? JSON.stringify([nacionalidad]) : null;
    const estadoRes = domicilio_estado ? String(domicilio_estado).trim().slice(0, 100) : null;
    const municipioRes = domicilio_municipio ? String(domicilio_municipio).trim().slice(0, 100) : null;
    const direccionRes = domicilio_direccion ? String(domicilio_direccion).trim().slice(0, 500) : null;

    const { edad: edadNum, unidad: unidadEdad } = calcularEdadNumericaSimple(fechaNac, fecha_referencia);

    // Datos representante (respetando longitudes exactas de columnas MySQL)
    const repNombres = representante_nombres ? String(representante_nombres).trim().slice(0, 120) : null;
    const repApellidos = representante_apellidos ? String(representante_apellidos).trim().slice(0, 120) : null;
    validarNombreSoloLetras(repNombres, 'Los nombres del representante');
    validarNombreSoloLetras(repApellidos, 'Los apellidos del representante');
    const repParentesco = representante_parentesco ? String(representante_parentesco).trim().slice(0, 50) : null;
    const repDoc = representante_doc_numero ? String(representante_doc_numero).trim().slice(0, 35) : null;
    const repMovil = representante_movil ? String(representante_movil).trim().slice(0, 25) : null;
    const repFijo = representante_telefono ? String(representante_telefono).trim().slice(0, 20) : null;
    const repEmail = representante_email ? String(representante_email).trim().slice(0, 254) : null;
    const telPrincipalFinal = repMovil || repFijo || null;
    const telSecundarioFinal = repMovil ? repFijo : null;

    // Resolver IDs opcionales de catálogos si existen en lista_tipo_general
    let sexoId = null;
    if (sexo) {
        const [sexRows] = await connection.query(
            "SELECT id FROM lista_tipo_general WHERE tipo = 'sexo' AND LOWER(nombre) = LOWER(?) LIMIT 1",
            [sexo]
        );
        if (sexRows.length > 0) sexoId = sexRows[0].id;
    }

    let parentescoId = null;
    if (repParentesco) {
        const [parRows] = await connection.query(
            "SELECT id FROM lista_tipo_general WHERE tipo = 'parentesco' AND LOWER(nombre) LIKE LOWER(?) LIMIT 1",
            [`%${repParentesco.split('/')[0].trim()}%`]
        );
        if (parRows.length > 0) parentescoId = parRows[0].id;
    }

    // 1. Buscar paciente existente
    let existingPaciente = null;
    if (paciente_id) {
        const [rows] = await connection.query('SELECT id, numero_historia_clinica FROM paciente WHERE id = ? LIMIT 1', [paciente_id]);
        if (rows.length > 0) existingPaciente = rows[0];
    }

    if (!existingPaciente && numDoc) {
        const [rows] = await connection.query(
            'SELECT id, numero_historia_clinica FROM paciente WHERE UPPER(numero_documento) = UPPER(?) AND estatus = 1 LIMIT 1',
            [numDoc]
        );
        if (rows.length > 0) existingPaciente = rows[0];
    }

    if (!existingPaciente && !numDoc && fechaNac) {
        const [rows] = await connection.query(
            `SELECT id, numero_historia_clinica FROM paciente 
             WHERE LOWER(primer_nombre) = LOWER(?) 
               AND LOWER(primer_apellido) = LOWER(?) 
               AND fecha_nacimiento = ? 
               AND (numero_documento IS NULL OR TRIM(numero_documento) = '')
               AND estatus = 1
             LIMIT 1`,
            [nombresSplit.primero, apellidosSplit.primero, fechaNac]
        );
        if (rows.length > 0) existingPaciente = rows[0];
    }

    if (existingPaciente && numDoc) {
        const [dupDocRows] = await connection.query(
            `SELECT id FROM paciente 
             WHERE UPPER(TRIM(numero_documento)) = UPPER(?) 
               AND LOWER(TRIM(COALESCE(tipo_documento, ''))) = LOWER(?)
               AND id != ? 
               AND estatus = 1 
             LIMIT 1`,
            [numDoc, tipoDoc, existingPaciente.id]
        );
        if (dupDocRows.length > 0) {
            const err = new Error(`Ya existe otro paciente registrado con el documento ${tipoDoc} ${numDoc}.`);
            err.statusCode = 400;
            throw err;
        }
    }

    let finalPacienteId;
    let finalHc;
    let creado = false;

    if (existingPaciente) {
        finalPacienteId = existingPaciente.id;
        finalHc = existingPaciente.numero_historia_clinica;

        const updateSql = allowIdentityUpdate
            ? `UPDATE paciente SET
                tipo_documento = ?,
                numero_documento = ?,
                primer_nombre = ?,
                segundo_nombre = ?,
                primer_apellido = ?,
                segundo_apellido = ?,
                fecha_nacimiento = COALESCE(?, fecha_nacimiento),
                edad_informada = COALESCE(?, edad_informada),
                unidad_edad_informada = COALESCE(?, unidad_edad_informada),
                sexo_id = ?,
                sexo = COALESCE(?, sexo),
                nacionalidad = ?,
                nacionalidades = ?,
                estado_residencia = ?,
                municipio_residencia = ?,
                direccion_completa = ?,
                contacto_nombres = COALESCE(?, contacto_nombres),
                contacto_apellidos = COALESCE(?, contacto_apellidos),
                contacto_parentesco = COALESCE(?, contacto_parentesco),
                contacto_numero_documento = ?,
                contacto_telefono_principal = COALESCE(?, contacto_telefono_principal),
                contacto_telefono_secundario = ?,
                contacto_correo_electronico = ?,
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`
            : `UPDATE paciente SET
                tipo_documento = COALESCE(?, tipo_documento),
                numero_documento = COALESCE(?, numero_documento),
                primer_nombre = COALESCE(NULLIF(primer_nombre, ''), ?),
                segundo_nombre = COALESCE(NULLIF(segundo_nombre, ''), ?),
                primer_apellido = COALESCE(NULLIF(primer_apellido, ''), ?),
                segundo_apellido = COALESCE(NULLIF(segundo_apellido, ''), ?),
                fecha_nacimiento = COALESCE(fecha_nacimiento, ?),
                edad_informada = COALESCE(edad_informada, ?),
                unidad_edad_informada = COALESCE(unidad_edad_informada, ?),
                sexo_id = COALESCE(sexo_id, ?),
                sexo = COALESCE(NULLIF(sexo, ''), ?),
                nacionalidad = COALESCE(?, nacionalidad),
                nacionalidades = COALESCE(?, nacionalidades),
                estado_residencia = COALESCE(?, estado_residencia),
                municipio_residencia = COALESCE(?, municipio_residencia),
                direccion_completa = COALESCE(?, direccion_completa),
                contacto_nombres = COALESCE(?, contacto_nombres),
                contacto_apellidos = COALESCE(?, contacto_apellidos),
                contacto_parentesco = COALESCE(?, contacto_parentesco),
                contacto_numero_documento = COALESCE(?, contacto_numero_documento),
                contacto_telefono_principal = COALESCE(?, contacto_telefono_principal),
                contacto_telefono_secundario = ?,
                contacto_correo_electronico = ?,
                audit_usu_id = ?,
                audit_ip = ?,
                audit_dep_id = ?
             WHERE id = ?`;

        await connection.query(
            updateSql,
            [
                tipoDoc,
                numDoc,
                nombresSplit.primero,
                nombresSplit.segundo,
                apellidosSplit.primero,
                apellidosSplit.segundo,
                fechaNac,
                edadNum,
                unidadEdad,
                sexoId,
                sexo,
                nacionalidad,
                nacionalidadesJson,
                estadoRes,
                municipioRes,
                direccionRes,
                repNombres,
                repApellidos,
                repParentesco,
                repDoc,
                telPrincipalFinal,
                telSecundarioFinal,
                repEmail,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id,
                finalPacienteId
            ]
        );
    } else {
        creado = true;
        finalHc = generarHCILProvisional(tipoDoc, numDoc, repDoc, 1);

        // Garantizar unicidad absoluta de HCIL
        let attempt = 0;
        while (attempt < 5) {
            const [dupHc] = await connection.query('SELECT id FROM paciente WHERE numero_historia_clinica = ? LIMIT 1', [finalHc]);
            if (dupHc.length === 0) break;
            attempt++;
            const randSuffix = Math.floor(100 + Math.random() * 900);
            finalHc = `REF-${Date.now().toString().slice(-6)}${randSuffix}`;
        }

        const [insPac] = await connection.query(
            `INSERT INTO paciente (
                numero_historia_clinica,
                tipo_documento,
                numero_documento,
                es_cedula_madre,
                primer_nombre,
                segundo_nombre,
                primer_apellido,
                segundo_apellido,
                fecha_nacimiento,
                edad_informada,
                unidad_edad_informada,
                sexo_id,
                sexo,
                nacionalidad,
                nacionalidades,
                pais_residencia,
                estado_residencia,
                municipio_residencia,
                direccion_completa,
                contacto_nombres,
                contacto_apellidos,
                contacto_parentesco,
                contacto_tipo_documento,
                contacto_numero_documento,
                contacto_telefono_principal,
                contacto_telefono_secundario,
                contacto_correo_electronico,
                estatus,
                audit_usu_id,
                audit_ip,
                audit_dep_id
            ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Venezuela', ?, ?, ?, ?, ?, ?, 'Cédula', ?, ?, ?, ?, 1, ?, ?, ?)`,
            [
                finalHc,
                tipoDoc,
                numDoc,
                nombresSplit.primero,
                nombresSplit.segundo,
                apellidosSplit.primero,
                apellidosSplit.segundo,
                fechaNac,
                edadNum,
                unidadEdad,
                sexoId,
                sexo,
                nacionalidad,
                nacionalidadesJson,
                estadoRes,
                municipioRes,
                direccionRes,
                repNombres,
                repApellidos,
                repParentesco,
                repDoc,
                telPrincipalFinal,
                telSecundarioFinal,
                repEmail,
                audit.audit_usu_id,
                audit.audit_ip,
                audit.audit_dep_id
            ]
        );
        finalPacienteId = insPac.insertId;
    }

    // Sincronizar tabla secundaria paciente_contacto_responsable si hay datos del representante
    if (repNombres || repApellidos || telPrincipalFinal) {
        const [repRows] = await connection.query(
            'SELECT id FROM paciente_contacto_responsable WHERE paciente_id = ? AND estatus = 1 ORDER BY id ASC LIMIT 1',
            [finalPacienteId]
        );

        if (repRows.length > 0) {
            await connection.query(
                `UPDATE paciente_contacto_responsable SET
                    nombres = COALESCE(?, nombres),
                    apellidos = COALESCE(?, apellidos),
                    parentesco_id = COALESCE(?, parentesco_id),
                    parentesco = COALESCE(?, parentesco),
                    numero_documento = ${allowIdentityUpdate ? '?' : 'COALESCE(?, numero_documento)'},
                    telefono_principal = COALESCE(?, telefono_principal),
                    telefono_secundario = ?,
                    correo_electronico = ?,
                    audit_usu_id = ?,
                    audit_ip = ?,
                    audit_dep_id = ?
                 WHERE id = ?`,
                [
                    repNombres,
                    repApellidos,
                    parentescoId,
                    repParentesco,
                    repDoc,
                    telPrincipalFinal,
                    telSecundarioFinal,
                    repEmail,
                    audit.audit_usu_id,
                    audit.audit_ip,
                    audit.audit_dep_id,
                    repRows[0].id
                ]
            );
        } else {
            await connection.query(
                `INSERT INTO paciente_contacto_responsable (
                    paciente_id, nombres, apellidos, parentesco_id, parentesco,
                    tipo_documento, numero_documento, telefono_principal, telefono_secundario,
                    correo_electronico, estatus, audit_usu_id, audit_ip, audit_dep_id
                ) VALUES (?, ?, ?, ?, ?, 'Cédula', ?, ?, ?, ?, 1, ?, ?, ?)`,
                [
                    finalPacienteId,
                    repNombres || 'Representante',
                    repApellidos || 'Registrado',
                    parentescoId,
                    repParentesco || 'Otro',
                    repDoc,
                    telPrincipalFinal || '',
                    telSecundarioFinal,
                    repEmail,
                    audit.audit_usu_id,
                    audit.audit_ip,
                    audit.audit_dep_id
                ]
            );
        }
    }

    return {
        paciente_id: finalPacienteId,
        numero_historia_clinica: finalHc,
        creado
    };
};

module.exports = {
    upsertPacienteYRepresentante
};
