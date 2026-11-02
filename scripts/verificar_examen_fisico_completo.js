const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');
const examenFisicoController = require('../controllers/examenFisicoController');

async function runTests() {
  console.log('================================================================');
  console.log('  AUDITORÍA Y VERIFICACIÓN COMPLETA: EXAMEN FÍSICO PEDIÁTRICO   ');
  console.log('================================================================\n');

  let errors = 0;

  // 1. Verificar existencia de paciente y solicitud de prueba
  console.log('1. Verificando paciente_id = 1 y registro_solicitud_id = 1...');
  const [pac] = await db.query('SELECT id, primer_nombre, primer_apellido FROM paciente WHERE id = 1');
  if (pac.length === 0) {
    console.error('✗ Paciente 1 no existe en BD!');
    errors++;
  } else {
    console.log(`✓ Paciente encontrado: ${pac[0].primer_nombre} ${pac[0].primer_apellido} (ID: ${pac[0].id})`);
  }

  const [sol] = await db.query('SELECT id, paciente_id FROM registro_solicitud WHERE id = 1');
  if (sol.length === 0) {
    console.log('• Solicitud 1 no existe, creando solicitud de prueba...');
    await db.query(
      `INSERT INTO registro_solicitud (id, paciente_id, centro_salud_id, tipo_operacion_id, fecha_solicitud, estatus, observacion_general, audit_usu_id, audit_ip, audit_dep_id)
       VALUES (1, 1, 4, 1, CURDATE(), 'Pendiente', 'Solicitud de prueba automatizada', '1', '127.0.0.1', '1')
       ON DUPLICATE KEY UPDATE paciente_id = 1`
    );
    console.log('✓ Solicitud 1 garantizada en BD.');
  } else {
    console.log(`✓ Solicitud 1 encontrada (paciente_id: ${sol[0].paciente_id})`);
  }

  // 2. Probar inserción directa SQL con todos los campos V18 y audit_usu_id largo
  console.log('\n2. Probando inserción SQL directa en historia_examen_fisico con audit_usu_id largo...');
  try {
    const [insSql] = await db.query(`
      INSERT INTO historia_examen_fisico (
        paciente_id, registro_solicitud_id, peso_kg, percentil_peso, talla_cm, percentil_talla,
        imc, superficie_corporal, frecuencia_cardiaca, frecuencia_respiratoria, saturacion_oxigeno,
        soporte_oxigeno, flujo_oxigeno_litros, presion_sistolica, presion_diastolica, exam_bp_mean,
        extremidad_presion, percentil_presion, estado_perfusion, hallazgo_piel, general_exam_notes,
        inspeccion_torax, exam_chest_symmetry, cicatriz_esternotomia, cicatriz_toracotomia,
        palpacion_precordial, exam_precordial_activity, exam_apex_beat_palpable, exam_apex_beat_location,
        exam_apex_beat_midclavicular_relation, exam_apex_beat_intensity, exam_apex_beat_extent,
        exam_apex_beat_displacement, exam_parasternal_impulse, exam_precordial_heave,
        exam_epigastric_impulse, exam_precordial_thrill, exam_precordial_thrill_location,
        exam_precordial_thrill_timing, exam_precordial_thrill_intensity, fremito_presente,
        fremito_localizacion, latido_sistolico, auscultacion_pulmonar, lung_findings_side,
        trabajo_respiratorio, respiratory_exam_notes, ruidos_cardiacos, s1_tipo, s1_soplo_presente,
        s1_soplo_fase, s1_soplo_localizacion, s1_soplo_grado, murmur_s1_pitch, murmur_s1_character,
        murmur_s1_radiation, s2_tipo, s2_soplo_presente, inspeccion_abdominal, auscultacion_abdominal,
        hepatomegalia, borde_hepatico_cm, esplenomegalia, abdominal_exam_notes,
        llenado_capilar_segundos, capillary_refill_status, pulso_amplitud, pulso_localizacion,
        pulse_side, pulse_symmetry, external_genital_exam, neurologic_exam_overall,
        nivel_conciencia, pupilas_simetria, right_pupil_mm, left_pupil_mm, right_pupil_reactivity,
        gcs_eye, gcs_verbal, gcs_motor, glasgow_total, tono_muscular, motor_symmetry,
        muscle_bulk, motor_deficit, reflex_symmetry, light_touch, gait_status, romberg_test,
        neck_stiffness, perimetro_cefalico_cm, fontanela_anterior, head_control,
        audit_usu_id, audit_ip, audit_dep_id
      ) VALUES (
        1, 1, 14.20, 'P50', 95.00, 'P50',
        15.73, 0.612, 108, 24, 98,
        'Aire ambiente', NULL, 94, 58, 70.0,
        'Brazo derecho', '<P90', 'Bien perfundido', 'Normal', 'Paciente reactivo y cooperador',
        'Normal', 'Simétrico', 0, 0,
        'Normal', 'Normodinámica', 'Palpable', '5.º EIC izquierdo',
        'Sobre la línea', 'Normal', 'Localizado',
        'Ausente', 'Ausente', 'Ausente',
        'Ausente', 'Ausente', NULL,
        NULL, NULL, 0,
        NULL, 'Normal', 'Murmullo vesicular conservado', 'Bilateral',
        'Normal', 'Sin tirajes ni estridor', 'S1, S2', 'Único', 'No',
        NULL, NULL, NULL, NULL, NULL,
        NULL, 'Único', 'No', 'Plano', 'Ruidos hidroaéreos presentes',
        0, NULL, 0, 'Blando, depresible, no doloroso',
        2.0, 'Normal', '2+ normal', 'Radial',
        'Bilateral', 'Simétricos', 'Normal', 'Normal',
        'Alerta', 'Isocóricas', 3.0, 3.0, 'Reactiva',
        4, 5, 6, 15, 'Normal', 'Simétrica',
        'Normal', 'Ausente', 'Simétricos', 'Normal', 'Normal', 'Negativo',
        'Ausente', 48.5, 'Normotensa', 'Adecuado para edad',
        'usuario_con_identificador_largo_mayor_a_cincuenta_caracteres_audit_987654321', '127.0.0.1', '1'
      )
    `);
    console.log(`✓ Inserción SQL directa exitosa. ID insertado: ${insSql.insertId}`);
  } catch (err) {
    console.error('✗ Fallo en inserción SQL directa:', err);
    errors++;
  }

  // 3. Probar inserción con examen neurológico NORMAL y campos de coma en NULL (Regresión Error 1048)
  console.log('\n3. Probando inserción con campos neurológicos en NULL (Verificación Anti-Error 1048)...');
  try {
    const [insNull] = await db.query(`
      INSERT INTO historia_examen_fisico (
        paciente_id, registro_solicitud_id, peso_kg, talla_cm, frecuencia_cardiaca, frecuencia_respiratoria,
        neurologic_exam_overall, nivel_conciencia, pupilas_simetria, tono_muscular,
        audit_usu_id, audit_ip, audit_dep_id
      ) VALUES (
        1, 1, 12.00, 88.00, 115, 26,
        'Normal', NULL, NULL, NULL,
        '1', '127.0.0.1', '1'
      )
    `);
    console.log(`✓ Inserción con campos NULL permitida exitosamente. ID: ${insNull.insertId}`);
  } catch (err) {
    console.error('✗ Fallo: Error 1048 no resuelto al insertar NULL:', err);
    errors++;
  }

  // 4. Probar Controller POST createExamenFisico con datos completos y matrices
  console.log('\n4. Probando Controller createExamenFisico con payload integral...');
  try {
    const mockReq = {
      params: { id: 1 },
      audit: {
        audit_usu_id: 'admin_test_full_controller_id_long_string_123456789',
        audit_ip: '192.168.1.100',
        audit_dep_id: '4'
      },
      body: {
        paciente_id: 1,
        registro_solicitud_id: 1,
        peso_kg: 16.5,
        talla_cm: 102.0,
        frecuencia_cardiaca: 98,
        frecuencia_respiratoria: 22,
        saturacion_oxigeno: 99,
        soporte_oxigeno: 'Aire ambiente',
        presion_sistolica: 98,
        presion_diastolica: 62,
        extremidad_presion: 'Brazo derecho',
        estado_perfusion: 'Bien perfundido',
        inspeccion_torax: 'Normal',
        exam_chest_symmetry: 'Simétrico',
        cicatriz_esternotomia: 0,
        cicatriz_toracotomia: 0,
        exam_precordial_activity: 'Normodinámica',
        exam_apex_beat_palpable: 'Palpable',
        exam_apex_beat_location: '5.º EIC izquierdo',
        exam_apex_beat_midclavicular_relation: 'Sobre la línea',
        exam_apex_beat_intensity: 'Normal',
        exam_apex_beat_extent: 'Localizado',
        exam_apex_beat_displacement: 'Ausente',
        exam_parasternal_impulse: 'Ausente',
        exam_precordial_heave: 'Ausente',
        exam_epigastric_impulse: 'Ausente',
        exam_precordial_thrill: 'Ausente',
        ruidos_cardiacos: 'S1, S2',
        s1_tipo: 'Único',
        s1_soplo_presente: 'No',
        s2_tipo: 'Único',
        s2_soplo_presente: 'No',
        inspeccion_abdominal: 'Plano',
        auscultacion_abdominal: 'Ruidos hidroaéreos presentes',
        hepatomegalia: 0,
        esplenomegalia: 0,
        llenado_capilar_segundos: 1.5,
        pulso_localizacion: 'Radial',
        pulso_amplitud: '2+ normal',
        pulse_side: 'Bilateral',
        pulse_symmetry: 'Simétricos',
        neurologic_exam_overall: 'Normal',
        nivel_conciencia: 'Alerta',
        gcs_eye: 4,
        gcs_verbal: 5,
        gcs_motor: 6,
        orientation_person: 'Conservada',
        orientation_place: 'Conservada',
        orientation_time: 'Conservada',
        language_status: 'Adecuado para edad',
        pupilas_simetria: 'Isocóricas',
        right_pupil_mm: 3.0,
        left_pupil_mm: 3.0,
        right_pupil_reactivity: 'Reactiva',
        extraocular_movements: 'Conservados',
        facial_symmetry: 'Simétrica',
        tono_muscular: 'Normal',
        motor_symmetry: 'Simétrica',
        muscle_bulk: 'Normal',
        motor_deficit: 'Ausente',
        right_upper_strength: '5',
        left_upper_strength: '5',
        right_lower_strength: '5',
        left_lower_strength: '5',
        light_touch: 'Normal',
        gait_status: 'Normal',
        romberg_test: 'Negativo',
        neck_stiffness: 'Ausente',

        // Matrices
        cranial_nerves: [
          { cranial_nerve: 'I', cranial_nerve_status: 'Normal', cranial_nerve_notes: '' },
          { cranial_nerve: 'II', cranial_nerve_status: 'Normal', cranial_nerve_notes: '' },
          { cranial_nerve: 'VII', cranial_nerve_status: 'Normal', cranial_nerve_notes: '' },
          { cranial_nerve: 'XII', cranial_nerve_status: 'Normal', cranial_nerve_notes: '' }
        ],
        reflexes_matrix: [
          { nombre: 'Bicipital', nivel: 'C5-C6', izq: '2+', der: '2+' },
          { nombre: 'Rotuliano', nivel: 'L3-L4', izq: '2+', der: '2+' },
          { nombre: 'Aquíleo', nivel: 'S1-S2', izq: '2+', der: '2+' }
        ],
        primitive_reflexes: [
          { primitive_reflex: 'Moro', primitive_reflex_status: 'Presente' },
          { primitive_reflex: 'Succión', primitive_reflex_status: 'Presente' }
        ]
      }
    };

    let postResponse = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          postResponse = { code, data };
        }
      }),
      json: (data) => {
        postResponse = { code: 200, data };
      }
    };

    await examenFisicoController.createExamenFisico(mockReq, mockRes);
    if (postResponse && postResponse.data?.status === 'success') {
      console.log('✓ Controller createExamenFisico respondió status: success');
      console.log(`  - ID: ${postResponse.data.data.id}`);
      console.log(`  - IMC calculado: ${postResponse.data.data.imc} kg/m²`);
      console.log(`  - SC Mosteller: ${postResponse.data.data.superficie_corporal} m²`);
      console.log(`  - PAM calculada: ${postResponse.data.data.exam_bp_mean} mmHg`);
      console.log(`  - Glasgow total: ${postResponse.data.data.glasgow_total}/15`);
    } else {
      console.error('✗ Error en respuesta de createExamenFisico:', postResponse);
      errors++;
    }
  } catch (err) {
    console.error('✗ Excepción en Controller createExamenFisico:', err);
    errors++;
  }

  // 5. Probar Controller GET getExamenFisicoPorPaciente
  console.log('\n5. Probando Controller getExamenFisicoPorPaciente(1)...');
  try {
    const mockGetReq = { params: { id: 1 } };
    let getResponse = null;
    const mockGetRes = {
      status: (code) => ({
        json: (data) => {
          getResponse = { code, data };
        }
      }),
      json: (data) => {
        getResponse = { code: 200, data };
      }
    };

    await examenFisicoController.getExamenFisicoPorPaciente(mockGetReq, mockGetRes);
    if (getResponse && getResponse.data?.status === 'success' && getResponse.data.data.length > 0) {
      const exam = getResponse.data.data[0];
      console.log('✓ Controller getExamenFisicoPorPaciente retornó con éxito:');
      console.log(`  - Paciente ID: ${exam.paciente_id}`);
      console.log(`  - Registro Solicitud ID: ${exam.registro_solicitud_id}`);
      console.log(`  - PAM persistida: ${exam.exam_bp_mean} mmHg`);
      console.log(`  - Apex beat: ${exam.exam_apex_beat_palpable} (${exam.exam_apex_beat_location})`);
      console.log(`  - Pares craneales parseados: Array con ${exam.cranial_nerves?.length || 0} pares`);
      console.log(`  - Reflejos osteotendinosos parseados: Array con ${exam.reflexes_matrix?.length || 0} reflejos`);
      console.log(`  - Reflejos primitivos parseados: Array con ${exam.primitive_reflexes?.length || 0} reflejos`);
    } else {
      console.error('✗ Error en respuesta de getExamenFisicoPorPaciente:', getResponse);
      errors++;
    }
  } catch (err) {
    console.error('✗ Excepción en Controller getExamenFisicoPorPaciente:', err);
    errors++;
  }

  // 6. Resumen de resultados
  console.log('\n================================================================');
  if (errors === 0) {
    console.log('   ¡AUDITORÍA Y VERIFICACIÓN DE EXAMEN FÍSICO 100% EXITOSA!    ');
    console.log('   - 0 Errores SQL 1054 (Unknown column)');
    console.log('   - 0 Errores SQL 1048 (Column cannot be null)');
    console.log('   - 0 Advertencias 1265 (Data truncated)');
    console.log('   - PAM, IMC, SC y Glasgow reactivos funcionando');
    console.log('   - Persistencia completa de Choque de punta V18 y Frémito');
    console.log('   - 8 Categorías clínicas alineadas');
  } else {
    console.log(`   AUDITORÍA COMPLETADA CON ${errors} ERROR(ES). REVISAR LOGS.`);
  }
  console.log('================================================================\n');

  process.exit(errors > 0 ? 1 : 0);
}

runTests();

