const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');
const ctrl = require('../controllers/precargaReferenciaController');

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
};

async function run() {
  console.log('=== TEST END-TO-END PRECARGA REFERENCIA ===');
  let createdSolicitudes = [];
  let createdPacienteId = null;

  try {
    // 1. Catálogos
    const resCat = mockRes();
    await ctrl.getCatalogosPrecarga({ usuario: { id: 1, rol_id: 6 } }, resCat);
    if (resCat.statusCode !== 200 || resCat.body.status !== 'success') {
      throw new Error('Fallo getCatalogosPrecarga: ' + JSON.stringify(resCat.body));
    }
    console.log('✓ getCatalogosPrecarga OK. Centros:', resCat.body.centros_salud.length, 'Estados:', resCat.body.estados.length);

    // 1b. Buscar paciente existente por documento (id=1 tiene doc 32132332) y documento inexistente
    const resBuscarExistente = mockRes();
    await ctrl.buscarPacientePorDocumento({ query: { numero_documento: '32132332' }, usuario: { id: 88, rol_id: 6 } }, resBuscarExistente);
    if (resBuscarExistente.statusCode !== 200 || !resBuscarExistente.body.encontrado || resBuscarExistente.body.data.paciente_id !== 1) {
      throw new Error('Fallo buscarPacientePorDocumento (existente): ' + JSON.stringify(resBuscarExistente.body));
    }
    console.log('✓ buscarPacientePorDocumento (existente 32132332) OK:', resBuscarExistente.body.data.paciente_nombres, resBuscarExistente.body.data.paciente_apellidos);

    const resBuscarNuevo = mockRes();
    await ctrl.buscarPacientePorDocumento({ query: { numero_documento: '00000001' }, usuario: { id: 88, rol_id: 6 } }, resBuscarNuevo);
    if (resBuscarNuevo.statusCode !== 200 || resBuscarNuevo.body.encontrado !== false) {
      throw new Error('Fallo buscarPacientePorDocumento (no existente): ' + JSON.stringify(resBuscarNuevo.body));
    }
    console.log('✓ buscarPacientePorDocumento (no existente) OK: encontrado =', resBuscarNuevo.body.encontrado);

    // 2. Crear nueva precarga (Borrador) -> INSERT paciente nuevo
    const uniqueDoc = '99887766';
    const payloadCreate = {
      centro_origen_nombre: 'Centro Regional de Prueba (Yaracuy)',
      fecha_referencia: '2026-11-21',
      prioridad_solicitada: 'Preferente',
      estado_referencia: 'Borrador',
      paciente_nombres: 'Lucía Valentina',
      paciente_apellidos: 'Pérez Moreno',
      paciente_tipo_documento: 'Cédula V',
      paciente_num_documento: uniqueDoc,
      paciente_fecha_nacimiento: '2023-02-19',
      paciente_edad_referencia: '3 años, 9 meses',
      paciente_sexo_registrado: 'Femenino',
      paciente_nacionalidad: 'Venezolana',
      domicilio_estado: 'Yaracuy',
      domicilio_municipio: 'San Felipe',
      domicilio_direccion: 'Sector Jardines, calle Principal',
      representante_nombres: 'Mariana Isabel',
      representante_apellidos: 'Pérez Rojas',
      representante_parentesco: 'Madre',
      representante_doc_numero: '18444555',
      representante_movil: '04141112233',
      representante_telefono: '',
      representante_email: 'mariana@test.com',
      dx_cardiologico_texto: 'Comunicación interventricular (CIV)',
      dx_cardiologico_certeza: 'Presuntivo',
      estado_clinico_actual: 'Estable',
      motivo_referencia: 'Evaluación por cardiología infantil',
      dx_asociado_texto: 'Sin otros',
      sugerencia_referencia: 'Ecocardiograma control',
      tratamiento_medico_texto: 'Furosemida 1 mg/kg/día',
      saturacion_o2: 96,
      cirugia_paliativa_estado: 'Sí',
      cirugia_paliativa_tipo: 'Cerclaje pulmonar',
      cirugia_paliativa_fecha: '2024-05-10',
      medico_nombre_completo: 'Dra. Laura Rodríguez',
      medico_documento: '15222333',
      medico_especialidad: 'Pediatría',
      medico_mms: 'MMS-1234',
      medico_cm: 'CM-5678',
      completitud_porcentaje: 100,
      laboratorios: [
        { prueba: 'Hemoglobina (Hb)', resultado: '11.8', unidad: 'g/dL', estado: 'Disponible', fecha: '2026-11-20' },
        { prueba: 'Leucocitos', resultado: '8700', unidad: '/mm³', estado: 'Disponible', fecha: '2026-11-20' }
      ],
      evaluaciones: [
        { tipo: 'Ecocardiograma Doppler', estado: 'Sí', fecha: '2026-11-20', resumen: 'CIV perimembranosa' },
        { tipo: 'Radiografía de tórax', estado: 'No documentado', fecha: '', resumen: '' }
      ]
    };

    const reqCreate = {
      body: payloadCreate,
      usuario: { id: 88, rol_id: 6, centro_salud_id: '6' },
      audit: { audit_usu_id: '88', audit_ip: '127.0.0.1', audit_dep_id: '6' }
    };
    const resCreate = mockRes();
    await ctrl.crearPrecargaReferencia(reqCreate, resCreate);
    if (resCreate.statusCode !== 201 || !resCreate.body.data?.registro_solicitud_id) {
      throw new Error('Fallo crearPrecargaReferencia: ' + JSON.stringify(resCreate.body));
    }
    createdPacienteId = resCreate.body.data.paciente_id;
    createdSolicitudes.push(resCreate.body.data.registro_solicitud_id);
    console.log('✓ crearPrecargaReferencia (INSERT paciente + solicitud + 2 labs + 2 evals) OK:', resCreate.body.data);

    // 3. Upsert con mismo numero_documento -> debe hacer UPDATE al mismo paciente_id y crear nueva solicitud
    const resUpsert = mockRes();
    await ctrl.crearPrecargaReferencia({
      ...reqCreate,
      body: { ...payloadCreate, domicilio_municipio: 'Independencia', estado_referencia: 'Enviada' }
    }, resUpsert);
    if (resUpsert.statusCode !== 201 || resUpsert.body.data.paciente_id !== createdPacienteId || resUpsert.body.data.paciente_creado !== false) {
      throw new Error('Fallo lógica Upsert paciente existente: ' + JSON.stringify(resUpsert.body));
    }
    createdSolicitudes.push(resUpsert.body.data.registro_solicitud_id);
    console.log('✓ Upsert paciente existente (UPDATE mismo paciente_id + nueva solicitud Enviada) OK:', resUpsert.body.data);

    // 4. PUT actualizar borrador existente
    const solId1 = createdSolicitudes[0];
    const resUpdate = mockRes();
    await ctrl.actualizarPrecargaReferencia({
      params: { id: solId1 },
      body: { ...payloadCreate, paciente_id: createdPacienteId, estado_referencia: 'Enviada' },
      usuario: { id: 88, rol_id: 6, centro_salud_id: '6' },
      audit: { audit_usu_id: '88', audit_ip: '127.0.0.1', audit_dep_id: '6' }
    }, resUpdate);
    if (resUpdate.statusCode !== 200 || resUpdate.body.data.estado_referencia !== 'Enviada') {
      throw new Error('Fallo actualizarPrecargaReferencia: ' + JSON.stringify(resUpdate.body));
    }
    console.log('✓ actualizarPrecargaReferencia (PUT Enviada) OK');

    // 5. GET por ID
    const resGetId = mockRes();
    await ctrl.getReferenciaPorId({ params: { id: solId1 }, usuario: { id: 88, rol_id: 6, centro_salud_id: '6' } }, resGetId);
    if (resGetId.statusCode !== 200 || resGetId.body.data.laboratorios.length !== 2 || resGetId.body.data.evaluaciones.length !== 2) {
      throw new Error('Fallo getReferenciaPorId: ' + JSON.stringify(resGetId.body));
    }
    console.log('✓ getReferenciaPorId OK. Labs:', resGetId.body.data.laboratorios.length, 'Evals:', resGetId.body.data.evaluaciones.length, 'Historial:', resGetId.body.data.historial.length);

    // 6. GET Histórico filtrado por rol_id = 6
    const resHist = mockRes();
    await ctrl.listarHistoricoReferencias({ query: {}, usuario: { id: 88, rol_id: 6, centro_salud_id: '6' } }, resHist);
    if (resHist.statusCode !== 200 || resHist.body.data.length < 2) {
      throw new Error('Fallo listarHistoricoReferencias: ' + JSON.stringify(resHist.body));
    }
    console.log('✓ listarHistoricoReferencias (rol_id=6) OK. Registros:', resHist.body.data.length);
  } finally {
    // Limpiar registros de prueba para mantener BD limpia
    for (const sid of createdSolicitudes) {
      await db.query('DELETE FROM laboratorios WHERE registro_solicitud_id = ?', [sid]);
      await db.query('DELETE FROM referencia_evaluacion WHERE registro_solicitud_id = ?', [sid]);
      await db.query('DELETE FROM referencia_cirugia_previa WHERE registro_solicitud_id = ?', [sid]);
      await db.query('DELETE FROM referencia_historial WHERE registro_solicitud_id = ?', [sid]);
      await db.query('DELETE FROM registro_solicitud WHERE id = ?', [sid]);
    }
    if (createdPacienteId) {
      await db.query('DELETE FROM paciente_contacto_responsable WHERE paciente_id = ?', [createdPacienteId]);
      await db.query('DELETE FROM paciente WHERE id = ?', [createdPacienteId]);
    }
    console.log('✓ Limpieza de registros de prueba completada.');
  }

  console.log('=== TODOS LOS TESTS BACKEND PASARON EXITOSAMENTE ===');
  process.exit(0);
}

run().catch(err => {
  console.error('ERROR TEST:', err);
  process.exit(1);
});
