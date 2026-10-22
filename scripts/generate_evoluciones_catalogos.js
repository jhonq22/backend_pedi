const fs = require('fs');
const path = require('path');

const specPath = path.join(__dirname, '../evolucion_spec.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const TABS_EVOLUCION = [
  { id: 'episodio', numero: '01', titulo: 'Identificación', subtitulo: 'Datos del episodio, autor y evolución', icono: 'pi pi-id-card' },
  { id: 'clinica', numero: '02', titulo: 'Estado clínico', subtitulo: 'Condición general, conciencia y síntomas', icono: 'pi pi-user' },
  { id: 'vitales', numero: '03', titulo: 'Signos vitales', subtitulo: 'Antropometría y constantes vitales', icono: 'pi pi-heart' },
  { id: 'cardiorresp', numero: '04', titulo: 'Cardiopulmonar', subtitulo: 'Hemodinamia, perfusión y ventilación', icono: 'pi pi-compass' },
  { id: 'balance', numero: '05', titulo: 'Balance y nutrición', subtitulo: 'Balance hídrico, diuresis y vía enteral', icono: 'pi pi-filter' },
  { id: 'estudios', numero: '06', titulo: 'Estudios / procedimientos', subtitulo: 'Laboratorios, imágenes y procedimientos', icono: 'pi pi-images' },
  { id: 'eventos', numero: '07', titulo: 'Eventos y terapia', subtitulo: 'Eventos adversos, medicación y drenajes', icono: 'pi pi-exclamation-triangle' },
  { id: 'problemas', numero: '08', titulo: 'Problemas activos', subtitulo: 'Lista priorizada SOAP de problemas', icono: 'pi pi-list-check' },
  { id: 'plan', numero: '09', titulo: 'Plan y firma', subtitulo: 'Plan por sistemas, metas y firma', icono: 'pi pi-file-edit' }
];

const GROUPS_EVOLUCION = {
  episodio: [
    { title: 'Identificación y responsable', fields: ['daily_note_id', 'encounter_id', 'evolution_date', 'evolution_time', 'hospital_day', 'postoperative_day', 'postprocedure_day', 'care_location', 'service', 'author_id', 'note_status'] },
    { title: 'Período evaluado y evolución general', fields: ['evaluation_period_start', 'evaluation_period_end', 'clinical_course_since_previous', 'significant_events_present', 'significant_events_summary'] }
  ],
  clinica: [
    { title: 'Estado clínico actual', fields: ['general_condition', 'consciousness_status', 'pain_present', 'pain_scale', 'pain_score', 'current_symptoms', 'current_symptoms_other', 'clinical_status_summary'] }
  ],
  vitales: [
    { title: 'Antropometría pediátrica', fields: ['weight_kg', 'weight_percentile', 'height_cm', 'height_percentile', 'bmi', 'bsa'] },
    { title: 'Constantes vitales', fields: ['heart_rate', 'respiratory_rate', 'oxygen_saturation', 'oxygen_support', 'oxygen_flow', 'bp_extremity', 'bp_systolic', 'bp_diastolic', 'bp_percentile'] }
  ],
  cardiorresp: [
    { title: 'Seguimiento cardiovascular', fields: ['hemodynamic_status', 'cardiac_rhythm_status', 'perfusion_status_daily', 'cyanosis_status', 'edema_status', 'hepatomegaly_status', 'cardiovascular_daily_summary'] },
    { title: 'Seguimiento respiratorio', fields: ['respiratory_status_daily', 'respiratory_support', 'fio2_current', 'respiratory_support_change', 'respiratory_daily_summary'] }
  ],
  balance: [
    { title: 'Balance hídrico y función renal', fields: ['intake_24h_ml', 'output_24h_ml', 'fluid_balance_24h_ml', 'urine_volume_ml', 'urine_measure_hours', 'urine_output_ml_kg_h', 'renal_status_daily', 'fluid_renal_summary'] },
    { title: 'Nutrición y alimentación', fields: ['nutrition_route', 'feeding_tolerance', 'nutrition_change_24h', 'nutrition_summary'] }
  ],
  estudios: [
    { title: 'Laboratorios vinculados del período', fields: ['new_labs_available', 'lab_result_ids', 'lab_clinical_interpretation', 'lab_trend_status'] },
    { title: 'Radiografía de control y otras imágenes', fields: ['new_imaging_performed', 'imaging_study_ids', 'control_chest_xray_performed', 'imaging_results_available', 'imaging_clinical_interpretation', 'imaging_change_vs_prior'] },
    { title: 'Procedimientos del período (24 h)', fields: ['procedure_performed_24h', 'procedure_ids', 'major_procedure_present', 'procedure_tolerance', 'procedure_clinical_summary'] }
  ],
  eventos: [
    { title: 'Eventos clínicos adversos o intercurrentes', isRepeater: 'events', fields: ['clinical_event_id', 'event_datetime', 'event_type', 'event_severity', 'event_intervention', 'event_outcome'] },
    { title: 'Medicación y cambios terapéuticos', fields: ['medication_changes_present', 'medication_change_type', 'medication_change_summary'] },
    { title: 'Dispositivos, accesos y drenajes', fields: ['active_devices', 'device_change_24h', 'drain_output_24h_ml', 'devices_summary'] }
  ],
  problemas: [
    { title: 'Evaluación por problemas activos', isRepeater: 'problems', fields: ['problem_id', 'problem_priority', 'problem_status', 'problem_assessment', 'problem_plan', 'problem_resolved_date'] }
  ],
  plan: [
    { title: 'Plan terapéutico por sistemas', fields: ['plan_cardiovascular', 'plan_respiratory', 'plan_neurologic', 'plan_renal_fluid', 'plan_nutrition', 'plan_infectious', 'plan_hematologic', 'plan_other'] },
    { title: 'Estudios pendientes y metas para las próximas 24 horas', fields: ['pending_tests_present', 'pending_other_summary', 'next_24h_goals', 'anticipated_disposition', 'discharge_barriers'] },
    { title: 'Firma médica y cierre de nota', fields: ['signed_by', 'signed_at'] }
  ]
};

const OPTIONS_EVOLUCION = {
  care_location: ['Hospitalización', 'UCIP', 'UCI cardiovascular', 'Emergencia', 'Otro'],
  service: ['Cardiología', 'Cirugía cardiovascular', 'UCIP', 'Otro'],
  clinical_course_since_previous: ['Mejoría', 'Estable', 'Deterioro', 'Fluctuante', 'No comparable'],
  significant_events_present: ['Sí', 'No'],
  general_condition: ['Buena', 'Regular', 'Delicada', 'Crítica'],
  consciousness_status: ['Alerta', 'Somnoliento', 'Sedado', 'Estupor', 'Coma', 'Otro'],
  pain_present: ['Sí', 'No', 'No evaluable'],
  pain_scale: ['FLACC', 'Wong-Baker (Caras)', 'EVA (0-10)', 'NIPS', 'CRIES'],
  current_symptoms: ['Disnea', 'Cianosis', 'Dolor torácico', 'Palpitaciones', 'Fatiga', 'Mareo', 'Síncope', 'Edema', 'Intolerancia alimentaria', 'Otro'],
  oxygen_support: ['Aire ambiente', 'Cánula nasal', 'Mascarilla', 'Alto flujo', 'Ventilación', 'Otro'],
  bp_extremity: ['Brazo derecho', 'Brazo izquierdo', 'Pierna derecha', 'Pierna izquierda'],
  hemodynamic_status: ['Estable', 'Inestable', 'Dependiente de soporte'],
  cardiac_rhythm_status: ['Sinusal', 'Marcapasos', 'Arritmia', 'Otro', 'No determinado'],
  perfusion_status_daily: ['Adecuada', 'Disminuida', 'No evaluable'],
  cyanosis_status: ['Ausente', 'Presente', 'Basal conocida'],
  edema_status: ['Ausente', 'Presente', 'En disminución', 'En aumento'],
  hepatomegaly_status: ['Ausente', 'Presente', 'Sin cambios', 'En aumento', 'En disminución'],
  respiratory_status_daily: ['Estable', 'Mejoría', 'Deterioro'],
  respiratory_support: ['Aire ambiente', 'Cánula nasal', 'Mascarilla', 'Alto flujo', 'VMNI', 'Ventilación mecánica', 'Otro'],
  respiratory_support_change: ['Sin cambios', 'Aumentado', 'Disminuido', 'Retirado', 'Iniciado'],
  renal_status_daily: ['Estable', 'Mejoría', 'Deterioro', 'Lesión renal aguda', 'Diálisis'],
  nutrition_route: ['Oral', 'SNG', 'SOG', 'Gastrostomía', 'Nutrición parenteral', 'Ayuno'],
  feeding_tolerance: ['Buena', 'Regular', 'Mala', 'No aplica'],
  nutrition_change_24h: ['Sin cambios', 'Aumento', 'Disminución', 'Suspendida', 'Reiniciada'],
  new_labs_available: ['Sí', 'No'],
  lab_trend_status: ['Sin cambios relevantes', 'Mejoría', 'Deterioro', 'Mixta'],
  new_imaging_performed: ['Sí', 'No'],
  imaging_change_vs_prior: ['Mejoría', 'Sin cambios', 'Deterioro', 'Hallazgo nuevo', 'No comparable'],
  procedure_performed_24h: ['Sí', 'No'],
  procedure_tolerance: ['Sin complicaciones', 'Con complicaciones', 'No determinado'],
  event_type: ['Desaturación', 'Hipotensión', 'Hipertensión', 'Arritmia', 'Fiebre', 'Convulsión', 'Paro cardíaco', 'Sangrado', 'Bajo gasto', 'Deterioro respiratorio', 'Otro'],
  event_severity: ['Leve', 'Moderada', 'Grave', 'Amenaza vital'],
  event_outcome: ['Resuelto', 'En mejoría', 'Persistente', 'Deterioro'],
  medication_changes_present: ['Sí', 'No'],
  medication_change_type: ['Inicio', 'Suspensión', 'Aumento', 'Disminución', 'Cambio de vía', 'Cambio de intervalo'],
  active_devices: ['CVC', 'Línea arterial', 'PICC', 'Drenaje torácico', 'Sonda urinaria', 'Marcapasos', 'ECMO', 'VAD', 'Otro'],
  device_change_24h: ['Sin cambios', 'Colocado', 'Retirado', 'Reemplazado'],
  problem_status: ['Nuevo', 'Activo-estable', 'Mejorando', 'Deteriorando', 'Resuelto'],
  pending_tests_present: ['Sí', 'No'],
  anticipated_disposition: ['Continuar mismo nivel', 'Traslado a menor complejidad', 'Traslado a UCI', 'Egreso próximo', 'Otro'],
  discharge_barriers: ['Inestabilidad hemodinámica', 'Oxígeno', 'Alimentación', 'Medicación IV', 'Procedimiento pendiente', 'Educación familiar', 'Otro']
};

const NUMBERS_EVOLUCION = {
  weight_kg: { min: 0.2, max: 500, step: 0.01, unit: 'kg' },
  height_cm: { min: 10, max: 230, step: 0.1, unit: 'cm' },
  heart_rate: { min: 0, max: 300, step: 1, unit: 'lpm' },
  respiratory_rate: { min: 0, max: 100, step: 1, unit: 'rpm' },
  oxygen_saturation: { min: 20, max: 100, step: 1, unit: '%' },
  oxygen_flow: { min: 0, max: 99.9, step: 0.1, unit: 'L/min' },
  bp_systolic: { min: 1, max: 350, step: 1, unit: 'mmHg' },
  bp_diastolic: { min: 0, max: 349, step: 1, unit: 'mmHg' },
  fio2_current: { min: 0.21, max: 1.0, step: 0.01, unit: 'fracción (0.21-1.0)' },
  intake_24h_ml: { min: 0, max: 99999, step: 0.1, unit: 'mL' },
  output_24h_ml: { min: 0, max: 99999, step: 0.1, unit: 'mL' },
  urine_volume_ml: { min: 0, max: 99999, step: 0.1, unit: 'mL' },
  urine_measure_hours: { min: 1, max: 48, step: 0.5, unit: 'horas' },
  drain_output_24h_ml: { min: 0, max: 99999, step: 0.1, unit: 'mL' }
};

const MULTI_KEYS = ['current_symptoms', 'nutrition_route', 'medication_change_type', 'active_devices', 'discharge_barriers'];

const AUTO_KEYS = [
  'daily_note_id', 'encounter_id', 'hospital_day', 'postoperative_day', 'postprocedure_day',
  'author_id', 'note_status', 'bmi', 'bsa', 'fluid_balance_24h_ml', 'urine_output_ml_kg_h',
  'control_chest_xray_performed', 'imaging_results_available', 'major_procedure_present',
  'drain_output_24h_ml', 'signed_by', 'signed_at'
];

const MAXLEN = {
  significant_events_summary: 2000,
  clinical_status_summary: 1500,
  cardiovascular_daily_summary: 1500,
  respiratory_daily_summary: 1000,
  fluid_renal_summary: 1000,
  nutrition_summary: 750,
  lab_clinical_interpretation: 1500,
  imaging_clinical_interpretation: 1500,
  procedure_clinical_summary: 1500,
  medication_change_summary: 1000,
  devices_summary: 750,
  plan_cardiovascular: 1500,
  plan_respiratory: 1000,
  plan_neurologic: 1000,
  plan_renal_fluid: 1000,
  plan_nutrition: 1000,
  plan_infectious: 1000,
  plan_hematologic: 1000,
  plan_other: 1000,
  pending_other_summary: 750,
  next_24h_goals: 1500,
  current_symptoms_other: 250
};

const output = `// Constantes y catálogos estructurados para Evolución Clínica Diaria Pediátrica (HCIL V13 / V17)
export const TABS_EVOLUCION = ${JSON.stringify(TABS_EVOLUCION, null, 2)};

export const GROUPS_EVOLUCION = ${JSON.stringify(GROUPS_EVOLUCION, null, 2)};

export const OPTIONS_EVOLUCION = ${JSON.stringify(OPTIONS_EVOLUCION, null, 2)};

export const NUMBERS_EVOLUCION = ${JSON.stringify(NUMBERS_EVOLUCION, null, 2)};

export const MULTI_KEYS = ${JSON.stringify(MULTI_KEYS, null, 2)};

export const AUTO_KEYS = ${JSON.stringify(AUTO_KEYS, null, 2)};

export const MAXLEN = ${JSON.stringify(MAXLEN, null, 2)};

export const DEFAULT_EVOLUCION = {
  daily_note_id: '',
  encounter_id: '',
  evolution_date: '',
  evolution_time: '',
  evaluation_period_start: '',
  evaluation_period_end: '',
  care_location: 'Hospitalización',
  service: 'Cardiología',
  author_id: 'MEDICO-DEMO-001',
  hospital_day: 1,
  postoperative_day: null,
  postprocedure_day: null,
  clinical_course_since_previous: 'Estable',
  significant_events_present: 'No',
  significant_events_summary: '',

  general_condition: 'Buena',
  consciousness_status: 'Alerta',
  pain_present: 'No',
  pain_scale: 'FLACC',
  pain_score: '0',
  current_symptoms: [],
  current_symptoms_other: '',
  clinical_status_summary: '',

  weight_kg: null,
  weight_percentile: '',
  height_cm: null,
  height_percentile: '',
  bmi: null,
  bsa: null,
  heart_rate: null,
  respiratory_rate: null,
  oxygen_saturation: null,
  oxygen_support: 'Aire ambiente',
  oxygen_flow: null,
  bp_extremity: 'Brazo derecho',
  bp_systolic: null,
  bp_diastolic: null,
  bp_percentile: '',

  hemodynamic_status: 'Estable',
  cardiac_rhythm_status: 'Sinusal',
  perfusion_status_daily: 'Adecuada',
  cyanosis_status: 'Ausente',
  edema_status: 'Ausente',
  hepatomegaly_status: 'Ausente',
  cardiovascular_daily_summary: '',
  respiratory_status_daily: 'Estable',
  respiratory_support: 'Aire ambiente',
  fio2_current: 0.21,
  respiratory_support_change: 'Sin cambios',
  respiratory_daily_summary: '',

  intake_24h_ml: null,
  output_24h_ml: null,
  fluid_balance_24h_ml: null,
  urine_volume_ml: null,
  urine_measure_hours: 24,
  urine_output_ml_kg_h: null,
  renal_status_daily: 'Estable',
  fluid_renal_summary: '',
  nutrition_route: ['Oral'],
  feeding_tolerance: 'Buena',
  nutrition_change_24h: 'Sin cambios',
  nutrition_summary: '',

  new_labs_available: 'No',
  lab_result_ids: [],
  lab_clinical_interpretation: '',
  lab_trend_status: 'Sin cambios relevantes',
  new_imaging_performed: 'No',
  imaging_study_ids: [],
  control_chest_xray_performed: false,
  imaging_results_available: 'No',
  imaging_clinical_interpretation: '',
  imaging_change_vs_prior: 'Sin cambios',
  procedure_performed_24h: 'No',
  procedure_ids: [],
  major_procedure_present: false,
  procedure_tolerance: 'Sin complicaciones',
  procedure_clinical_summary: '',

  clinical_events: [],
  medication_changes_present: 'No',
  medication_change_type: [],
  medication_change_summary: '',
  active_devices: [],
  device_change_24h: 'Sin cambios',
  drain_output_24h_ml: null,
  drain_entries: [],
  devices_summary: '',

  active_problems: [],

  plan_cardiovascular: '',
  plan_respiratory: '',
  plan_neurologic: '',
  plan_renal_fluid: '',
  plan_nutrition: '',
  plan_infectious: '',
  plan_hematologic: '',
  plan_other: '',
  pending_tests_present: 'No',
  pending_other_summary: '',
  next_24h_goals: '',
  anticipated_disposition: 'Continuar mismo nivel',
  discharge_barriers: [],

  signed_by: '',
  signed_at: null,
  finalized: false,
  estatus_nota: 'Borrador'
};
`;

const destPath = path.join(__dirname, '../../front/src/constants/evolucionesCatalogos.js');
fs.writeFileSync(destPath, output, 'utf8');
console.log('✓ Archivo front/src/constants/evolucionesCatalogos.js generado con éxito.');
