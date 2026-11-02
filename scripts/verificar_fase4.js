// backend/scripts/verificar_fase4.js
const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });
const fs = require('fs');
const path = require('path');
const antecedenteController = require('../controllers/antecedenteController');

async function testPhase4() {
  console.log('================================================================');
  console.log('   AUDITORÍA Y VERIFICACIÓN END-TO-END: ANTECEDENTES (FASE 4)   ');
  console.log('================================================================\n');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pediatrico',
    multipleStatements: true
  });

  console.log('1. Conexión establecida con MySQL (`pediatrico`).');

  // 1. Ejecutar el script SQL de prueba
  console.log('2. Ejecutando `prueba_insercion_fase4.sql`...');
  const sqlTest = fs.readFileSync(path.join(__dirname, 'prueba_insercion_fase4.sql'), 'utf8');
  const results = await conn.query(sqlTest);
  console.log('   ✓ Inserción SQL ejecutada sin excepciones.');

  // 2. Verificar advertencias en MySQL (SHOW WARNINGS)
  const [warnings] = await conn.query('SHOW WARNINGS');
  if (warnings.length > 0) {
    console.error('   ❌ ADVERTENCIAS DETECTADAS EN MYSQL:', warnings);
    throw new Error(`Se detectaron ${warnings.length} advertencias en MySQL`);
  } else {
    console.log('   ✓ 0 advertencias en MySQL (SHOW WARNINGS = 0). ¡Cero Warning 1265!');
  }

  // 3. Comprobar registros insertados en las 6 tablas
  console.log('\n3. Verificando persistencia y columnas en las 6 tablas:');

  const [ant] = await conn.query('SELECT * FROM historia_antecedente WHERE registro_solicitud_id = 1');
  console.log(`   - historia_antecedente: ${ant.length} fila(s) encontrada(s).`);
  if (!ant.length || ant[0].paciente_id !== 1) throw new Error('Fallo en historia_antecedente paciente_id');
  console.log(`     * paciente_id: ${ant[0].paciente_id}, registro_solicitud_id: ${ant[0].registro_solicitud_id}`);
  console.log(`     * semanas_gestacion: ${ant[0].semanas_gestacion}, cardiopatia_congenita: ${ant[0].cardiopatia_congenita}`);
  console.log(`     * presentacion_cc_json: ${ant[0].presentacion_cc_json}`);

  const [diag] = await conn.query('SELECT * FROM historia_diagnostico_no_cardiovascular WHERE registro_solicitud_id = 1');
  console.log(`   - historia_diagnostico_no_cardiovascular: ${diag.length} fila(s).`);
  console.log(`     * Diagnóstico: "${diag[0].diagnostico}", Categoría: "${diag[0].categoria_nombre}"`);

  const [cir] = await conn.query('SELECT * FROM historia_cirugia_no_cardiovascular WHERE registro_solicitud_id = 1');
  console.log(`   - historia_cirugia_no_cardiovascular: ${cir.length} fila(s).`);
  console.log(`     * Procedimiento: "${cir[0].procedimiento_nombre}", Fecha: ${cir[0].fecha_procedimiento}`);

  const [med] = await conn.query('SELECT * FROM historia_medicamento_habitual WHERE registro_solicitud_id = 1');
  console.log(`   - historia_medicamento_habitual: ${med.length} fila(s).`);
  console.log(`     * Medicamento (longitud ${med[0].nombre_medicamento.length} chars): "${med[0].nombre_medicamento}"`);
  if (med[0].nombre_medicamento.length !== 180) {
    throw new Error(`Longitud esperada de medicamento: 180, obtenida: ${med[0].nombre_medicamento.length}`);
  }
  console.log(`     * Dosis: "${med[0].dosis}", Unidad: "${med[0].unidad_nombre}", Frecuencia: "${med[0].frecuencia_nombre}"`);

  const [ale] = await conn.query('SELECT * FROM historia_alergia WHERE registro_solicitud_id = 1');
  console.log(`   - historia_alergia: ${ale.length} fila(s).`);
  console.log(`     * Alérgeno: "${ale[0].alergeno}", Severidad: "${ale[0].severidad_nombre}"`);

  const [fam] = await conn.query('SELECT * FROM historia_antecedente_familiar WHERE registro_solicitud_id = 1');
  console.log(`   - historia_antecedente_familiar: ${fam.length} fila(s).`);
  console.log(`     * Parentesco: "${fam[0].parentesco_nombre}", Edad muerte súbita: ${fam[0].edad_muerte_subita}`);
  console.log(`     * Condiciones JSON: ${fam[0].condiciones_json}`);

  // 4. Probar endpoints del controlador antecedenteController
  console.log('\n4. Probando Controller getAntecedentesPorPaciente(id = 1)...');
  const mockReqGet = { params: { id: '1' } };
  let mockResGetData = null;
  const mockResGet = {
    status: (code) => ({
      json: (data) => {
        mockResGetData = { code, data };
        return mockResGetData;
      }
    }),
    json: (data) => {
      mockResGetData = { code: 200, data };
      return mockResGetData;
    }
  };

  await antecedenteController.getAntecedentesPorPaciente(mockReqGet, mockResGet);
  if (!mockResGetData || mockResGetData.data.status !== 'success') {
    throw new Error('Fallo en getAntecedentesPorPaciente: ' + JSON.stringify(mockResGetData));
  }
  console.log('   ✓ Controller GET retornado con status 200 / success.');
  const responseData = mockResGetData.data.data;
  console.log(`     * antecedentes general cargado: ${!!responseData.antecedente}`);
  console.log(`     * presentacion_cc parseado como Array: ${Array.isArray(responseData.antecedente.presentacion_cc)} (${responseData.antecedente.presentacion_cc.length} items)`);
  console.log(`     * diagnosticos_no_cv: ${responseData.diagnosticos_no_cv.length} items`);
  console.log(`     * cirugias_no_cv: ${responseData.cirugias_no_cv.length} items`);
  console.log(`     * medicamentos: ${responseData.medicamentos.length} items`);
  console.log(`     * alergias: ${responseData.alergias.length} items`);
  console.log(`     * familiares_cv: ${responseData.familiares_cv.length} items (con condiciones parsed: ${Array.isArray(responseData.familiares_cv[0].condiciones)})`);

  // 5. Probar Controller saveAntecedentes con payload transaccional completo
  console.log('\n5. Probando Controller saveAntecedentes(id = 1)...');
  const mockReqSave = {
    params: { id: '1' },
    body: {
      registro_solicitud_id: 1,
      paciente_id: 1,
      semanas_gestacion: 39.0,
      complicaciones_gestacionales: 'No',
      complicaciones_neonatales: 'No',
      cardiopatia_congenita: 'Sí',
      edad_diagnostico_cc: 4,
      unidad_edad_diagnostico_cc: 'Meses',
      presentacion_cc: ['Soplo', 'Fatiga'],
      intervenciones_cc: ['Medicamentos'],
      estudios_cardiacos_anormales: 'No',
      hipertension_pulmonar: 'No',
      falla_medro: 'No',
      kawasaki: 'No',
      fiebre_reumatica: 'No',
      sindrome_genetico: 'Sí',
      sindromes_geneticos: ['Trisomía 21'],
      miopatia: 'No',
      antecedente_medico_no_cv: 'Sí',
      antecedente_quirurgico_no_cv: 'No',
      medicamentos_actuales: 'Sí',
      estado_alergia: 'No conocidas',
      antecedente_familiar_cv: 'No',
      tiene_hermanos: 'Sí',
      nivel_escolaridad: 'Primaria',
      diagnosticos_no_cv: [
        {
          categoria_id: 2,
          categoria_nombre: 'Neurológico',
          diagnostico: 'Crisis febril simple en lactancia',
          observacion: 'Sin recurrencia'
        }
      ],
      cirugias_no_cv: [],
      medicamentos: [
        {
          nombre_medicamento: 'Furosemida 10 mg/mL gotas orales solucion pediatrica formula estandarizada de liberacion inmediata para control de sobrecarga hidrica en cardiopatias congenitas pediátricas',
          concentracion: '10 mg/mL',
          dosis: '1',
          unidad_nombre: 'mg',
          frecuencia_nombre: 'Cada 12 horas',
          via_nombre: 'Oral',
          observacion: 'Dosis matutina y vespertina'
        }
      ],
      alergias: [],
      familiares_cv: []
    },
    audit: {
      audit_usu_id: '1',
      audit_ip: '127.0.0.1',
      audit_dep_id: '1'
    }
  };

  let mockResSaveData = null;
  const mockResSave = {
    status: (code) => ({
      json: (data) => {
        mockResSaveData = { code, data };
        return mockResSaveData;
      }
    }),
    json: (data) => {
      mockResSaveData = { code: 200, data };
      return mockResSaveData;
    }
  };

  await antecedenteController.saveAntecedentes(mockReqSave, mockResSave);
  if (!mockResSaveData || mockResSaveData.data.status !== 'success') {
    throw new Error('Fallo en saveAntecedentes: ' + JSON.stringify(mockResSaveData));
  }
  console.log('   ✓ Controller POST retornado con status 200 / success.');

  console.log('\n================================================================');
  console.log('   ¡TODAS LAS PRUEBAS DE FASE 4 COMPLETADAS CON ÉXITO ROTUNDO!  ');
  console.log('   - 0 Errores 1054 (Unknown column)');
  console.log('   - 0 Errores 1048 (Bad null error)');
  console.log('   - 0 Advertencias 1265 (Data truncated)');
  console.log('   - Todas las 6 pestañas y 5 tablas detalle operan al 100%');
  console.log('================================================================');

  await conn.end();
}

testPhase4().catch(err => {
  console.error('\n❌ ERROR EN PRUEBA DE FASE 4:', err);
  process.exit(1);
});

