const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const precargaReferenciaRoutes = require('../routes/precargaReferenciaRoutes');
const pacienteRoutes = require('../routes/pacienteRoutes');
const dptRoutes = require('../routes/dptRoutes');

const app = express();
app.use(express.json());
app.use('/api/referencias', precargaReferenciaRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/dpt', dptRoutes);

const SECRET = process.env.JWT_SECRET || 'secret_key_123';
const makeToken = (user) => jwt.sign(user, SECRET, { expiresIn: '1h' });

const reqJson = (port, method, urlPath, token, body = null) =>
  new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });

const assert = (cond, msg) => {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
};

async function run() {
  const server = app.listen(0);
  const { port } = server.address();
  console.log(`=== QA E2E HTTP TEST (port ${port}) ===`);

  const tokenRol6 = makeToken({ id: 88, usuario: 'referencia@yopmail.com', rol_id: 6, centro_salud_id: '6' });
  const tokenRol6OtroCentro = makeToken({ id: 9999, usuario: 'otro@yopmail.com', rol_id: 6, centro_salud_id: '1' });
  const tokenRol2 = makeToken({ id: 85, usuario: 'redenlace@yopmail.com', rol_id: 2, centro_salud_id: '6' });
  const tokenRol3 = makeToken({ id: 86, usuario: 'informacionsalud@yopmail.com', rol_id: 3, centro_salud_id: null });

  let createdSolId = null;
  let createdPacId = null;
  let createdSinDocSolId = null;
  let createdSinDocPacId = null;
  let otherSolId = null;

  try {
    // 1. Catálogos (rol 6 y rol 2) + DPT Estados/Municipios dependientes
    const cat6 = await reqJson(port, 'GET', '/api/referencias/catalogos', tokenRol6);
    assert(cat6.status === 200 && cat6.body.catalogos?.tipo_cita?.length > 0 && cat6.body.estados?.length > 0, 'Catalogos rol 6');
    assert(!cat6.body.catalogos.tipo_documento_referencia.some(x => x.nombre.toLowerCase() === 'no indicado'), 'No debe existir No indicado');
    const cat2 = await reqJson(port, 'GET', '/api/referencias/catalogos', tokenRol2);
    assert(cat2.status === 200 && cat2.body.catalogos?.tipo_procedimiento?.length > 0, 'Catalogos rol 2');
    const cat3 = await reqJson(port, 'GET', '/api/referencias/catalogos', tokenRol3);
    assert(cat3.status === 403, 'Rol 3 bloqueado en /api/referencias');

    const estDpt = await reqJson(port, 'GET', '/api/dpt/estados', tokenRol6);
    assert(estDpt.status === 200 && estDpt.body.data?.length >= 24, 'DPT estados OK');
    const munById = await reqJson(port, 'GET', `/api/dpt/municipios/${estDpt.body.data[0].id_estado}`, tokenRol6);
    assert(munById.status === 200 && munById.body.data?.length > 0, 'DPT municipios por id_estado OK');
    const munByName = await reqJson(port, 'GET', '/api/dpt/municipios?estado=Yaracuy', tokenRol6);
    assert(munByName.status === 200 && munByName.body.data?.some(m => m.municipio === 'San Felipe'), 'DPT municipios por nombre OK');
    console.log('✓ 1. Permisos, catálogos (sin No indicado) y DPT Estados/Municipios OK');

    // 2. Búsqueda de paciente
    const b1 = await reqJson(port, 'GET', '/api/referencias/buscar-paciente?numero_documento=32132332', tokenRol6);
    assert(b1.status === 200 && b1.body.encontrado === true, 'Buscar paciente existente');
    const b2 = await reqJson(port, 'GET', '/api/referencias/buscar-paciente?numero_documento=00009998', tokenRol6);
    assert(b2.status === 200 && b2.body.encontrado === false, 'Buscar paciente inexistente');
    console.log('✓ 2. Búsqueda de paciente existente e inexistente OK');

    // 3. Casos borde de validación (rol 6)
    const badNoName = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol6, {
      centro_salud_id: 6,
      paciente_nombres: '',
      paciente_apellidos: ''
    });
    assert(badNoName.status === 400, `Esperado 400 sin nombres, recibido ${badNoName.status}`);

    const badSat = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol6, {
      centro_salud_id: 6,
      paciente_nombres: 'Test',
      paciente_apellidos: 'Qa',
      saturacion_o2: 150
    });
    assert(badSat.status === 400, `Esperado 400 saturacion > 100, recibido ${badSat.status}`);

    const badFutureBirth = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol6, {
      centro_salud_id: 6,
      paciente_nombres: 'Test',
      paciente_apellidos: 'Futuro',
      paciente_fecha_nacimiento: '2099-01-01'
    });
    assert(badFutureBirth.status === 400, `Esperado 400 fecha nacimiento futura, recibido ${badFutureBirth.status}`);

    const badFutureRef = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol6, {
      centro_salud_id: 6,
      fecha_referencia: '2099-01-01',
      paciente_nombres: 'Test',
      paciente_apellidos: 'RefFuturo'
    });
    assert(badFutureRef.status === 400, `Esperado 400 fecha referencia futura, recibido ${badFutureRef.status}`);

    const badCentro6 = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol6, {
      centro_salud_id: 1,
      paciente_nombres: 'Test',
      paciente_apellidos: 'CentroAjeno'
    });
    assert(badCentro6.status === 403, `Esperado 403 centro distinto para rol 6 asignado, recibido ${badCentro6.status}`);
    const badNombreNums = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol6, {
      centro_salud_id: 6,
      paciente_nombres: 'Juan 123',
      paciente_apellidos: 'Pérez!'
    });
    assert(badNombreNums.status === 400, `Esperado 400 nombres con números/especiales, recibido ${badNombreNums.status}`);

    const badSinMedicoCedula = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol6, {
      centro_salud_id: 6,
      estado_referencia: 'Enviada',
      paciente_nombres: 'Ana María',
      paciente_apellidos: 'Pérez',
      medico_nombre_completo: 'Elena Gómez',
      medico_documento: '',
      medico_especialidad: 'Pediatría'
    });
    assert(badSinMedicoCedula.status === 400, `Esperado 400 sin cédula médico remitente, recibido ${badSinMedicoCedula.status}`);

    const badSinMedicoEsp = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol6, {
      centro_salud_id: 6,
      estado_referencia: 'Enviada',
      paciente_nombres: 'Ana María',
      paciente_apellidos: 'Pérez',
      medico_nombre_completo: 'Elena Gómez',
      medico_documento: '14567890',
      medico_especialidad: ''
    });
    assert(badSinMedicoEsp.status === 400, `Esperado 400 sin especialidad médico remitente, recibido ${badSinMedicoEsp.status}`);

    console.log('✓ 3. Validaciones de entrada (fechas futuras, saturación, solo letras, cédula/especialidad médico, centro -> 400/403 sin 500) OK');

    // 4. Crear borrador mínimo (rol 6) con opcionales vacíos
    const uniqueDoc = '88776655';
    const draftRes = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol6, {
      centro_salud_id: 6,
      fecha_referencia: '2026-11-22',
      prioridad_solicitada: 'Rutinaria',
      estado_referencia: 'Borrador',
      paciente_nombres: 'Camila Sofía',
      paciente_apellidos: 'Mendoza Ruiz',
      paciente_tipo_documento: 'Cédula V',
      paciente_num_documento: uniqueDoc,
      paciente_fecha_nacimiento: '',
      paciente_sexo_registrado: '',
      cirugia_paliativa_estado: 'No',
      cirugia_paliativa_fecha: '',
      saturacion_o2: '',
      laboratorios: [],
      evaluaciones: []
    });
    assert(draftRes.status === 201 && draftRes.body.data?.registro_solicitud_id, 'Crear borrador mínimo rol 6: ' + JSON.stringify(draftRes.body));
    createdSolId = draftRes.body.data.registro_solicitud_id;
    createdPacId = draftRes.body.data.paciente_id;
    // 4b. Crear envío completo con "Sin documento" y campos límite (telefono alternativo 25 chars, fechas vacías)
    const sinDocRes = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol6, {
      centro_salud_id: 6,
      fecha_referencia: '2026-11-22',
      prioridad_solicitada: 'Rutinaria',
      estado_referencia: 'Enviada',
      paciente_nombres: 'Mateo Samuel',
      paciente_apellidos: 'Torres Silva',
      paciente_tipo_documento: 'Sin documento',
      paciente_num_documento: '',
      paciente_fecha_nacimiento: '2025-09-01',
      paciente_sexo_registrado: 'Masculino',
      representante_nombres: 'Laura',
      representante_apellidos: 'Silva',
      representante_parentesco: 'Madre',
      representante_movil: '04141112233',
      representante_telefono: '0254-12345678901234567890',
      motivo_referencia: 'Soplo sistólico en estudio',
      cirugia_paliativa_estado: 'Desconocido',
      cirugia_paliativa_fecha: '',
      medico_nombre_completo: 'Elena Gómez',
      medico_documento: '14567890',
      medico_especialidad: 'Pediatría',
      laboratorios: [{ prueba: 'Hemoglobina (Hb)', resultado: '11.5', unidad: 'g/dL', estado: 'Disponible', fecha: '' }],
      evaluaciones: [{ tipo: 'Radiografía de tórax', estado: 'No documentado', fecha: '', resumen: '' }]
    });
    assert(sinDocRes.status === 201 && sinDocRes.body.data?.registro_solicitud_id, 'Crear precarga Sin documento rol 6: ' + JSON.stringify(sinDocRes.body));
    createdSinDocSolId = sinDocRes.body.data.registro_solicitud_id;
    createdSinDocPacId = sinDocRes.body.data.paciente_id;
    console.log('✓ 4b. Envío "Sin documento" + límite varchar sin 500 (rol 6) ID:', createdSinDocSolId);

    // 5. Actualizar a Enviada completa (rol 6)
    const sendRes = await reqJson(port, 'PUT', `/api/referencias/precarga/${createdSolId}`, tokenRol6, {
      paciente_id: createdPacId,
      centro_salud_id: 6,
      fecha_referencia: '2026-11-22',
      prioridad_solicitada: 'Urgente',
      estado_referencia: 'Enviada',
      paciente_nombres: 'Camila Sofía',
      paciente_apellidos: 'Mendoza Ruiz',
      paciente_tipo_documento: 'Cédula V',
      paciente_num_documento: uniqueDoc,
      paciente_fecha_nacimiento: '2022-05-10',
      paciente_sexo_registrado: 'Femenino',
      paciente_nacionalidad: 'Venezolana',
      domicilio_estado: 'Yaracuy',
      domicilio_municipio: 'San Felipe',
      domicilio_direccion: 'Av. Principal',
      representante_nombres: 'Ana',
      representante_apellidos: 'Ruiz',
      representante_parentesco: 'Madre',
      representante_doc_numero: '19111222',
      representante_movil: '04141234567',
      dx_cardiologico_texto: 'CIA ostium secundum',
      dx_cardiologico_certeza: 'Confirmado',
      estado_clinico_actual: 'Estable',
      motivo_referencia: 'Evaluación quirúrgica',
      saturacion_o2: 95,
      cirugia_paliativa_estado: 'No',
      medico_nombre_completo: 'Carlos Pérez',
      medico_documento: '12345678',
      medico_especialidad: 'Pediatría',
      laboratorios: [
        { prueba: 'Hemoglobina (Hb)', resultado: '12.1', unidad: 'g/dL', estado: 'Disponible', fecha: '2026-11-22' }
      ],
      evaluaciones: [
        { tipo: 'Ecocardiograma Doppler', estado: 'Sí', fecha: '2026-11-22', resumen: 'CIA 8mm' }
      ]
    });
    assert(sendRes.status === 200 && sendRes.body.data.estado_referencia === 'Enviada', 'Enviar referencia rol 6');

    // Control de acceso: otro usuario rol 6 de otro centro no puede editar
    const forbidden6 = await reqJson(port, 'PUT', `/api/referencias/precarga/${createdSolId}`, tokenRol6OtroCentro, {
      paciente_nombres: 'Hack',
      paciente_apellidos: 'Test'
    });
    assert(forbidden6.status === 403, `Esperado 403 otro centro rol 6, recibido ${forbidden6.status}`);
    console.log('✓ 5. Envío completo (rol 6) y bloqueo 403 entre centros OK');

    // 6. Bloqueos de creación para rol 2 (Red de Enlace)
    const blockPrecarga2 = await reqJson(port, 'POST', '/api/referencias/precarga', tokenRol2, {
      paciente_nombres: 'No',
      paciente_apellidos: 'Debe'
    });
    assert(blockPrecarga2.status === 403, `Esperado 403 POST precarga rol 2, recibido ${blockPrecarga2.status}`);
    const blockPac2 = await reqJson(port, 'POST', '/api/pacientes', tokenRol2, { primer_nombre: 'No' });
    assert(blockPac2.status === 403, `Esperado 403 POST paciente rol 2, recibido ${blockPac2.status}`);
    console.log('✓ 6. Bloqueo de creación paciente/precarga para rol 2 (403) OK');

    // 7. Listado filtrado por centro para rol 2 (excluye otros centros)
    const [insOther] = await db.query(
      `INSERT INTO registro_solicitud (paciente_id, centro_salud_id, centro_origen_nombre, fecha_referencia, estado_referencia, estatus)
       VALUES (?, 1, 'Hospital Vargas de Caracas', '2026-11-22', 'Enviada', 'Pendiente')`,
      [createdPacId]
    );
    otherSolId = insOther.insertId;

    const hist2 = await reqJson(port, 'GET', '/api/referencias/precarga', tokenRol2);
    assert(hist2.status === 200, 'Listar histórico rol 2');
    const ids2 = hist2.body.data.map((r) => r.registro_solicitud_id);
    assert(ids2.includes(createdSolId), 'Rol 2 ve solicitud de su centro (6)');
    assert(!ids2.includes(otherSolId), 'Rol 2 NO ve solicitud de otro centro (1)');
    const forbidden2Get = await reqJson(port, 'GET', `/api/referencias/precarga/${otherSolId}`, tokenRol2);
    assert(forbidden2Get.status === 403, 'Rol 2 recibe 403 al intentar leer otro centro');
    console.log('✓ 7. Filtro estricto por centro_salud_id para rol 2 OK');

    // 8. Edición por rol 2: actualiza paciente/representante + 4 campos cita, NO modifica clínicos/labs/evals
    const tipoCitaId = cat2.body.catalogos.tipo_cita[0].id;
    const procId = cat2.body.catalogos.tipo_procedimiento[0].id;
    const diagId = cat2.body.catalogos.diagnostico_motivo_cita[0].id;
    const diagNombre = cat2.body.catalogos.diagnostico_motivo_cita[0].nombre;

    const upd2 = await reqJson(port, 'PUT', `/api/referencias/precarga/${createdSolId}`, tokenRol2, {
      paciente_id: createdPacId,
      paciente_nombres: 'Camila Valeria',
      paciente_apellidos: 'Mendoza López',
      paciente_tipo_documento: 'Cédula V',
      paciente_num_documento: uniqueDoc,
      paciente_fecha_nacimiento: '2022-05-11',
      paciente_sexo_registrado: 'Femenino',
      domicilio_estado: 'Yaracuy',
      domicilio_municipio: '',
      representante_nombres: 'Ana María',
      representante_apellidos: 'Ruiz Pérez',
      representante_parentesco: 'Madre',
      representante_movil: '04149998877',
      dx_cardiologico_texto: 'INTENTO_SOBRESCRITURA_INDEBIDA',
      laboratorios: [],
      evaluaciones: [],
      fecha_cita: '2026-12-05',
      tipo_cita_id: tipoCitaId,
      procedimiento_planificado_id: procId,
      diagnostico_motivo_id: diagId,
      diagnostico_motivo: diagNombre
    });
    assert(upd2.status === 200 && upd2.body.data.estatus === 'Programada', 'PUT rol 2 OK: ' + JSON.stringify(upd2.body));

    const verif = await reqJson(port, 'GET', `/api/referencias/precarga/${createdSolId}`, tokenRol2);
    const d = verif.body.data;
    assert(d.paciente_nombres === 'Camila Valeria', 'Nombre actualizado por rol 2');
    assert(d.domicilio_municipio === '', 'Municipio limpiado por rol 2');
    assert(d.representante_nombres === 'Ana María', 'Representante actualizado por rol 2');
    assert(d.fecha_cita === '2026-12-05', 'fecha_cita actualizada');
    assert(Number(d.tipo_cita_id) === Number(tipoCitaId), 'tipo_cita_id actualizado');
    assert(Number(d.procedimiento_planificado_id) === Number(procId), 'procedimiento_planificado_id actualizado');
    assert(Number(d.diagnostico_motivo_id) === Number(diagId), 'diagnostico_motivo_id actualizado');
    assert(d.dx_cardiologico_texto === 'CIA ostium secundum', 'Datos clínicos protegidos intactos');
    assert(d.laboratorios.length === 1, 'Laboratorios protegidos intactos');
    assert(d.evaluaciones.length === 1, 'Evaluaciones protegidas intactas');

    // 8b. Rol 2: validar rechazo limpio 400 de FK inválida y documento duplicado
    const badTipoCita2 = await reqJson(port, 'PUT', `/api/referencias/precarga/${createdSolId}`, tokenRol2, {
      paciente_nombres: 'Camila Valeria',
      paciente_apellidos: 'Mendoza López',
      tipo_cita_id: 9999999
    });
    assert(badTipoCita2.status === 400, `Esperado 400 tipo_cita_id inválido, recibido ${badTipoCita2.status}`);

    const dupDoc2 = await reqJson(port, 'PUT', `/api/referencias/precarga/${createdSinDocSolId}`, tokenRol2, {
      paciente_id: createdPacId, // Intento de manipular paciente_id debe ignorarse
      paciente_nombres: 'Mateo Samuel',
      paciente_apellidos: 'Torres Silva',
      paciente_tipo_documento: 'Cédula V',
      paciente_num_documento: uniqueDoc
    });
    assert(dupDoc2.status === 400, `Esperado 400 documento duplicado en rol 2, recibido ${dupDoc2.status}`);
    console.log('✓ 8. Actualización rol 2 (paciente, representante, cita, guardias FK/duplicados) OK');
  } finally {
    for (const sid of [createdSolId, createdSinDocSolId, otherSolId].filter(Boolean)) {
      await db.query('DELETE FROM laboratorios WHERE registro_solicitud_id = ?', [sid]);
      await db.query('DELETE FROM referencia_evaluacion WHERE registro_solicitud_id = ?', [sid]);
      await db.query('DELETE FROM referencia_cirugia_previa WHERE registro_solicitud_id = ?', [sid]);
      await db.query('DELETE FROM referencia_historial WHERE registro_solicitud_id = ?', [sid]);
      await db.query('DELETE FROM registro_solicitud WHERE id = ?', [sid]);
    }
    for (const pid of [createdPacId, createdSinDocPacId].filter(Boolean)) {
      await db.query('DELETE FROM paciente_contacto_responsable WHERE paciente_id = ?', [pid]);
      await db.query('DELETE FROM paciente WHERE id = ?', [pid]);
    }
    server.close();
    console.log('✓ Limpieza de registros QA completada.');
  }

  console.log('=== TODOS LOS TESTS QA E2E (ROL 2 Y ROL 6) PASARON ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('QA E2E FAILED:', err);
  process.exit(1);
});
