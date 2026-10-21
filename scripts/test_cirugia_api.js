const jwt = require('jsonwebtoken');

// Generate test JWT token
const token = jwt.sign({ id: 1, usuario: 'admin', rol_id: 1 }, 'secret_key_123', { expiresIn: '1h' });

async function testCirugiaApi() {
  const baseUrl = 'http://localhost:3000/api/cirugias';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  console.log('--- 1. TEST POST /api/cirugias ---');
  const newSurgeryPayload = {
    registro_solicitud_id: 1,
    surgery_id: 'TEST-SX-001',
    fecha_cirugia: '2026-10-21',
    surgery_start_datetime: '2026-10-21T08:00',
    surgery_end_datetime: '2026-10-21T12:30',
    weight_at_surgery_kg: 12.5,
    height_at_surgery_cm: 88,
    operating_room: 'Pabellón Cardiovascular 1',
    surgery_priority: 'Electiva',
    surgery_strategy: 'Corrección completa definitiva',
    first_cardiac_surgery: true,
    cardiac_surgery_number: 1,
    primary_surgeon_id: 'Dr. Alejandro Morales',
    assistant_surgeon_ids: ['Dra. Carmen Soto'],
    surgical_approach: 'Esternotomía media',
    diagnostico_preoperatorio: 'Tetralogía de Fallot',
    cirugia_realizada: 'Corrección total de Tetralogía de Fallot con parche transanular',
    operative_findings_narrative: 'CIV perimembranosa subaórtica de 15mm, estenosis infundíbulo-valvular pulmonar severa.',
    residual_lesion_present: 'No',
    postoperative_rhythm: 'Sinusal',
    chest_status: 'Cerrado completamente',
    destination_after_or: 'UCIP Cardiovascular',
    diagnoses: [
      { preop_diagnosis: 'Tetralogía de Fallot', preop_diagnosis_code: 'Q21.3' }
    ],
    procedures: [
      { procedure_name: 'Cierre de CIV con parche de dacrón', procedure_context: 'Principal' },
      { procedure_name: 'Resección infundibular y parche transanular pulmonar', procedure_context: 'Principal' }
    ],
    surgical_complications: [],
    anesthesia: {
      anesthesiologist_id: 'Dr. Roberto Mendoza',
      anesthesia_start_datetime: '2026-10-21T07:30',
      anesthesia_end_datetime: '2026-10-21T13:00',
      asa_class: 'ASA IV',
      airway_management: 'Intubación orotraqueal',
      ett_size_mm: 4.5,
      arterial_line_inserted: true,
      arterial_line_site: 'Radial derecha',
      central_line_inserted: true,
      central_line_site: 'Yugular interna derecha',
      tee_used: true
    },
    perfusion: {
      cpb_used: true,
      perfusionist_id: 'Lic. Laura Peña',
      cpb_flow_strategy: 'Normoflujo pulsátil/continuo',
      aortic_cross_clamp_used: true,
      cpb_temperature_strategy: 'Hipotermia moderada (28–32 °C)',
      cpb_min_temperature_c: 28.0,
      cardioplegia_used: true,
      cardioplegia_solution: 'Custodiol',
      cardioplegia_composition: 'Cristaloide intracelular',
      circulatory_arrest_used: false,
      prime_type: 'Con hemoderivados',
      ultrafiltration_used: true
    },
    cannulations: [
      { cannulation_type: 'Arterial', cannulation_site: 'Aorta ascendente', cannula_size_fr: 14 },
      { cannulation_type: 'Bicaval superior', cannulation_site: 'VCS', cannula_size_fr: 16 },
      { cannulation_type: 'Bicaval inferior', cannulation_site: 'VCI', cannula_size_fr: 18 }
    ],
    cpb_periods: [
      { start: '2026-10-21T09:00', end: '2026-10-21T10:45' }
    ],
    clamp_periods: [
      { start: '2026-10-21T09:15', end: '2026-10-21T10:15' }
    ],
    estatus_nota: 'Borrador'
  };

  const createRes = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(newSurgeryPayload)
  });

  const created = await createRes.json();
  console.log('Status POST:', createRes.status);
  console.log('Created ID:', created.data?.id);
  console.log('Duración cirugía calculada:', created.data?.duracion_cirugia_min, 'min');
  console.log('Duración anestesia calculada:', created.data?.anesthesia?.anesthesia_duration_min, 'min');
  console.log('Tiempo CEC calculado:', created.data?.tiempo_cec_minutos, 'min');
  console.log('Tiempo Clampeo calculado:', created.data?.tiempo_clampeo_minutos, 'min');
  console.log('Canulaciones count:', created.data?.cannulations?.length);
  console.log('Procedimientos count:', created.data?.procedures?.length);

  const testId = created.data?.id;
  if (!testId) {
    console.error('Failed to create surgery:', created);
    process.exit(1);
  }

  console.log('\n--- 2. TEST GET /api/cirugias?registro_solicitud_id=1 ---');
  const listRes = await fetch(`${baseUrl}?registro_solicitud_id=1`, { headers });
  const list = await listRes.json();
  console.log('Status GET list:', listRes.status);
  console.log('Found surgeries:', list.data?.length);

  console.log('\n--- 3. TEST GET /api/cirugias/:id ---');
  const getRes = await fetch(`${baseUrl}/${testId}`, { headers });
  const single = await getRes.json();
  console.log('Status GET single:', getRes.status);
  console.log('Cirujano:', single.data?.cirujano_principal);
  console.log('Diagnósticos:', single.data?.diagnoses);

  console.log('\n--- 4. TEST PUT /api/cirugias/:id (Update) ---');
  const updatePayload = {
    ...single.data,
    hallazgos_operatorios: 'Actualizado: hallazgos confirmados y cierre exitoso sin complicaciones.'
  };
  const updateRes = await fetch(`${baseUrl}/${testId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updatePayload)
  });
  const updated = await updateRes.json();
  console.log('Status PUT:', updateRes.status);
  console.log('Updated message:', updated.message);

  console.log('\n--- 5. TEST DELETE /api/cirugias/:id (Discard) ---');
  const deleteRes = await fetch(`${baseUrl}/${testId}`, {
    method: 'DELETE',
    headers
  });
  const deleted = await deleteRes.json();
  console.log('Status DELETE:', deleteRes.status);
  console.log('Deleted message:', deleted.message);

  console.log('\n✅ ALL API TESTS COMPLETED SUCCESSFULLY!');
}

testCirugiaApi().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
