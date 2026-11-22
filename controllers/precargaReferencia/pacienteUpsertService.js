// backend/controllers/precargaReferencia/pacienteUpsertService.js

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
        ? { primero: String(primer_nombre).trim(), segundo: segundo_nombre ? String(segundo_nombre).trim() : null }
        : splitNombreCompleto(paciente_nombres);

    const apellidosSplit = primer_apellido
        ? { primero: String(primer_apellido).trim(), segundo: segundo_apellido ? String(segundo_apellido).trim() : null }
        : splitNombreCompleto(paciente_apellidos);

    if (!nombresSplit.primero || !apellidosSplit.primero) {
        const err = new Error('Los nombres y apellidos del paciente son obligatorios.');
        err.statusCode = 400;
        throw err;
    }

    const tipoDoc = paciente_tipo_documento ? String(paciente_tipo_documento).trim() : null;
    const isSinDoc = !tipoDoc || tipoDoc.toLowerCase().includes('sin documento') || tipoDoc.toLowerCase() === 'no_posee';
    const numDoc = (!isSinDoc && paciente_num_documento && String(paciente_num_documento).trim() !== '')
        ? String(paciente_num_documento).trim().toUpperCase()
        : null;

    const fechaNac = paciente_fecha_nacimiento || null;
    const sexo = paciente_sexo_registrado || null;
    const nacionalidad = paciente_nacionalidad || null;
    const nacionalidadesJson = nacionalidad ? JSON.stringify([nacionalidad]) : null;
    const estadoRes = domicilio_estado || null;
    const municipioRes = domicilio_municipio || null;
    const direccionRes = domicilio_direccion || null;

    const { edad: edadNum, unidad: unidadEdad } = calcularEdadNumericaSimple(fechaNac, fecha_referencia);

    // Datos representante
    const repNombres = representante_nombres ? String(representante_nombres).trim() : null;
    const repApellidos = representante_apellidos ? String(representante_apellidos).trim() : null;
    const repParentesco = representante_parentesco ? String(representante_parentesco).trim() : null;
    const repDoc = representante_doc_numero ? String(representante_doc_numero).trim() : null;
    const repMovil = representante_movil ? String(representante_movil).trim() : null;
    const repFijo = representante_telefono ? String(representante_telefono).trim() : null;
    const repEmail = representante_email ? String(representante_email).trim() : null;
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

    if (!existingPaciente && fechaNac) {
        const [rows] = await connection.query(
            `SELECT id, numero_historia_clinica FROM paciente 
             WHERE LOWER(primer_nombre) = LOWER(?) 
               AND LOWER(primer_apellido) = LOWER(?) 
               AND fecha_nacimiento = ? 
               AND estatus = 1
             LIMIT 1`,
            [nombresSplit.primero, apellidosSplit.primero, fechaNac]
        );
        if (rows.length > 0) existingPaciente = rows[0];
    }

    let finalPacienteId;
    let finalHc;
    let creado = false;

    if (existingPaciente) {
        finalPacienteId = existingPaciente.id;
        finalHc = existingPaciente.numero_historia_clinica;

        const updateSql = allowIdentityUpdate
            ? `UPDATE paciente SET
                tipo_documento = COALESCE(?, tipo_documento),
                numero_documento = ?,
                primer_nombre = ?,
                segundo_nombre = ?,
                primer_apellido = ?,
                segundo_apellido = ?,
                fecha_nacimiento = COALESCE(?, fecha_nacimiento),
                edad_informada = COALESCE(?, edad_informada),
                unidad_edad_informada = COALESCE(?, unidad_edad_informada),
                sexo_id = COALESCE(?, sexo_id),
                sexo = COALESCE(?, sexo),
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

        // Garantizar unicidad de HCIL
        const [dupHc] = await connection.query('SELECT id FROM paciente WHERE numero_historia_clinica = ?', [finalHc]);
        if (dupHc.length > 0) {
            finalHc = `REF-${Date.now().toString().slice(-8)}`;
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
                    numero_documento = COALESCE(?, numero_documento),
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
