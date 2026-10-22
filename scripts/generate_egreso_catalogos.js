const fs = require('fs');
const path = require('path');

const specPath = path.join(__dirname, '../egreso_spec.json');
const outputPath = path.join(__dirname, '../../front/src/constants/egresoCatalogos.js');

const rawSpec = fs.readFileSync(specPath, 'utf8');
const SPEC = JSON.parse(rawSpec);

const TABS_EGRESO = [
  { id: 'episode', label: '01 · Egreso e ingreso', icon: 'DocumentTextIcon' },
  { id: 'course', label: '02 · Evolución', icon: 'ClockIcon' },
  { id: 'procedures', label: '03 · Procedimientos', icon: 'WrenchIcon' },
  { id: 'studies', label: '04 · Estudios', icon: 'ChartBarIcon' },
  { id: 'diagnoses', label: '05 · Diagnósticos', icon: 'ShieldCheckIcon' },
  { id: 'medication', label: '06 · Medicamentos y soporte', icon: 'BeakerIcon' },
  { id: 'home', label: '07 · Plan domiciliario', icon: 'HomeIcon' },
  { id: 'followup', label: '08 · Pendientes y citas', icon: 'CalendarIcon' },
  { id: 'closing', label: '09 · Destino y firma', icon: 'CheckCircleIcon' },
  { id: 'review', label: '10 · Revisión y técnica', icon: 'ClipboardDocumentCheckIcon' }
];

const TAB_FOR = {
  'IDENTIFICACIÓN DEL EGRESO': 'episode',
  'ENFERMEDAD ACTUAL': 'episode',
  'DIAGNÓSTICOS AL INGRESO': 'episode',
  'EVOLUCIÓN INTRAHOSPITALARIA': 'course',
  'EXAMEN FÍSICO': 'studies',
  'RADIOGRAFÍA': 'studies',
  'LABORATORIOS': 'studies',
  'OTROS ESTUDIOS CARDIOVASCULARES AL EGRESO': 'studies',
  'SOPORTE Y DISPOSITIVOS PRESENTES AL EGRESO': 'medication',
  'DIAGNÓSTICOS DE EGRESO': 'diagnoses',
  'CONCILIACIÓN DE MEDICAMENTOS AL EGRESO': 'medication',
  'PLAN NUTRICIONAL PARA EL HOGAR': 'home',
  'ACTIVIDAD FÍSICA Y CUIDADOS POSQUIRÚRGICOS': 'home',
  'PROFILAXIS Y CUIDADOS CARDIOVASCULARES ESPECIALES': 'home',
  'MONITOREO DOMICILIARIO CARDIOVASCULAR': 'home',
  'SIGNOS DE ALARMA PARA LA FAMILIA': 'home',
  'RESULTADOS PENDIENTES AL EGRESO': 'followup',
  'CITAS DE SEGUIMIENTO': 'followup',
  'DESTINO DEL PACIENTE': 'closing',
  'FIRMA': 'closing'
};

const repeatGroups = {
  discharge_procedure_links: ['discharge_procedure_link_id', 'procedure_type', 'source_procedure_id', 'procedure_date'],
  complication_links: ['complication_link_id', 'complication_source'],
  discharge_diagnoses: ['discharge_diagnosis_id', 'diagnosis_id', 'diagnosis_status', 'diagnosis_notes'],
  discharge_medications: ['discharge_medication_id', 'medication_order_id', 'medication_action', 'medication_indication', 'medication_duration', 'special_medication_instructions'],
  pending_results: ['pending_result_id', 'pending_test_id', 'pending_test_name', 'followup_action'],
  followups: ['followup_id', 'followup_specialty', 'followup_date', 'followup_interval', 'followup_reason']
};

const OBJECT_ARRAYS = [
  'admission_diagnosis_ids',
  'consultation_ids',
  'cardiac_surgery_ids',
  'cath_ids',
  'ep_study_ids',
  'discharge_lab_result_ids',
  'discharge_other_imaging_ids',
  'device_ids_at_discharge'
];

const FIELD_MULTI = ['home_equipment_required', 'home_feeding_route', 'warning_signs'];

const BOOLEANS = [
  'icu_admission_occurred',
  'mechanical_ventilation_during_stay',
  'mechanical_support_during_stay',
  'cardiac_surgery_performed',
  'operative_note_attached',
  'cath_performed_during_stay',
  'ep_performed_during_stay',
  'unresolved_complication_present',
  'oxygen_at_home',
  'drain_at_discharge',
  'anticoagulation_at_discharge',
  'home_monitoring_required',
  'home_spo2_monitoring',
  'home_weight_monitoring',
  'home_hr_monitoring',
  'home_feeding_monitoring'
];

const AUTO_FIELDS = [
  'discharge_id',
  'encounter_id',
  'admission_date',
  'length_of_stay_days',
  'discharge_physician_id',
  'discharge_summary_status',
  'present_illness_display',
  'cardiac_surgery_performed',
  'cardiac_surgery_ids',
  'operative_note_id',
  'operative_note_attached',
  'operative_note_file',
  'cath_performed_during_stay',
  'cath_ids',
  'ep_performed_during_stay',
  'ep_study_ids',
  'discharge_physical_exam_id',
  'discharge_vitals_id',
  'discharge_cxr_date',
  'discharge_signed_by',
  'discharge_signed_at'
];

const OPTIONS_EGRESO = {
  discharge_service: ['Cardiología', 'Cirugía cardiovascular', 'UCIP', 'Pediatría general', 'Otro'],
  admission_condition: ['Estable', 'Delicada', 'Crítica', 'Otra'],
  hospital_course_outcome: ['Favorable', 'Estable', 'Sin mejoría clínica', 'Complicación resuelta', 'Complicación activa'],
  discharge_cxr_status: ['Realizada', 'No realizada', 'No indicada'],
  discharge_cxr_comparison: ['Mejoría evidente', 'Estable / Sin cambios', 'Empeoramiento / Nueva opacidad', 'No comparable'],
  discharge_labs_status: ['Disponibles', 'No realizados', 'No indicados', 'Pendientes'],
  discharge_disposition: [
    'Domicilio',
    'Traslado a otro hospital',
    'Rehabilitación',
    'Otro servicio',
    'Alta contra indicación',
    'Fallecimiento',
    'Otro'
  ],
  medication_action: ['Iniciar', 'Continuar', 'Modificar', 'Suspender'],
  diagnosis_status: ['Activo', 'Resuelto', 'Crónico', 'Postoperatorio', 'Requiere seguimiento'],
  home_feeding_route: ['Oral', 'SNG', 'Gastrostomía', 'Otra'],
  warning_signs: [
    'Dificultad respiratoria',
    'Aumento de cianosis',
    'Saturación fuera de rango',
    'Fiebre',
    'Rechazo del alimento',
    'Vómitos persistentes',
    'Decaimiento',
    'Síncope',
    'Palpitaciones',
    'Edema',
    'Disminución de diuresis',
    'Sangrado',
    'Alteración de herida',
    'Otro'
  ],
  home_equipment_required: ['Oxígeno', 'Pulsioxímetro', 'Balanza', 'Bomba de alimentación', 'Aspirador', 'Otro'],
  activity_restriction: ['Sin restricción', 'Restricción parcial', 'Reposo relativo', 'Restricción específica'],
  sternal_precautions: ['Sí', 'No', 'No aplica'],
  ie_prophylaxis_status: ['Indicada', 'No indicada', 'Pendiente definición'],
  followup_specialty: [
    'Cardiología pediátrica',
    'Cirugía cardiovascular',
    'Pediatría general',
    'Nefrología',
    'Neurología',
    'Infectología',
    'Nutrición infantil',
    'Odontología',
    'Rehabilitación / Fisioterapia',
    'Otro'
  ],
  vascular_access_at_discharge: ['Ninguno', 'Vía periférica heparinizada', 'Catéter central', 'PICC', 'Otro']
};

const DEFAULT_DISCHARGE = {
  discharge_id: '',
  encounter_id: '',
  intent: 'normal',
  parent_discharge_id: null,
  admission_date: '',
  discharge_date: new Date().toISOString().slice(0, 10),
  discharge_time: '14:00',
  length_of_stay_days: 0,
  discharge_service: 'Cardiología',
  discharge_physician_id: 'PROFESIONAL-DEMO-SIN-AUTENTICAR',
  discharge_summary_status: 'Borrador',
  present_illness_id: null,
  present_illness_display: '',
  admission_condition: 'Delicada',
  admission_diagnosis_ids: [],
  hospital_course_outcome: 'Favorable',
  icu_admission_occurred: false,
  icu_stay_days: null,
  mechanical_ventilation_during_stay: false,
  mechanical_support_during_stay: false,
  hospital_course_summary: '',
  consultation_ids: [],
  consultations_summary: '',
  discharge_procedure_links: [],
  cardiac_surgery_performed: false,
  cardiac_surgery_ids: [],
  operative_note_id: null,
  operative_note_attached: false,
  operative_note_file: '',
  operative_note_missing_reason: '',
  surgery_result_discharge: 'Reparación anatómica y hemodinámica satisfactoria',
  cath_performed_during_stay: false,
  cath_ids: [],
  cath_discharge_summary: '',
  ep_performed_during_stay: false,
  ep_study_ids: [],
  ep_discharge_summary: '',
  complication_links: [],
  complications_summary: '',
  unresolved_complication_present: false,
  discharge_physical_exam_id: null,
  discharge_vitals_id: null,
  discharge_weight_kg: null,
  discharge_spo2: null,
  discharge_exam_summary: '',
  discharge_cxr_status: 'Realizada',
  discharge_cxr_id: null,
  discharge_cxr_date: '',
  discharge_cxr_summary: '',
  discharge_cxr_comparison: 'Mejoría evidente',
  discharge_cxr_not_done_reason: '',
  discharge_labs_status: 'Disponibles',
  discharge_lab_result_ids: [],
  discharge_labs_summary: '',
  discharge_ecg_id: null,
  discharge_echo_id: null,
  discharge_other_imaging_ids: [],
  discharge_studies_summary: '',
  discharge_diagnoses: [],
  discharge_medications: [],
  oxygen_at_home: false,
  oxygen_flow_home: null,
  oxygen_interface_home: '',
  device_ids_at_discharge: [],
  vascular_access_at_discharge: 'Ninguno',
  drain_at_discharge: false,
  home_equipment_required: [],
  home_feeding_route: ['Oral'],
  home_diet_type: 'Dieta adecuada para la edad, normosódica, fraccionada',
  activity_restriction: 'Reposo relativo',
  activity_restriction_detail: 'Evitar esfuerzos intensos y juegos bruscos por 30 días',
  sternal_precautions: 'Sí',
  sternal_precautions_duration: '6 semanas postoperatorias',
  wound_care_required: true,
  wound_care_instructions: 'Lavado con agua y jabón neutro, secar meticulosamente sin frotar. Mantener descubierta.',
  bathing_instructions: 'Ducha rápida con agua tibia sin sumergir la herida esternal.',
  return_school_daycare: 'Reevaluación en 1 mes previo reinicio escolar',
  sports_restriction: 'Sin educación física ni deportes de contacto durante 3 meses',
  ie_prophylaxis_status: 'Indicada',
  ie_prophylaxis_instructions: 'Profilaxis con amoxicilina previa a procedimientos dentales u orales.',
  anticoagulation_at_discharge: false,
  anticoagulant_medication_id: null,
  target_inr_min: null,
  target_inr_max: null,
  next_inr_date: '',
  device_precautions: '',
  home_monitoring_required: true,
  home_spo2_monitoring: true,
  home_spo2_lower_limit: 92,
  home_spo2_upper_limit: 100,
  home_weight_monitoring: true,
  home_hr_monitoring: true,
  home_feeding_monitoring: true,
  warning_signs: ['Dificultad respiratoria', 'Fiebre', 'Rechazo del alimento', 'Alteración de herida'],
  warning_sign_other: '',
  pending_results: [],
  followups: [],
  discharge_disposition: 'Domicilio',
  transfer_facility: '',
  transfer_reason: '',
  transport_requirement: '',
  discharge_signed_by: '',
  discharge_signed_at: null,
  finalized: false
};

const content = `/**
 * Catálogos, Constantes y Especificaciones para el Módulo de Egreso Hospitalario (HCIL V14 / V17)
 * Autogenerado para compatibilidad plena con la plantilla y base de datos de pediatría.
 */

export const TABS_EGRESO = ${JSON.stringify(TABS_EGRESO, null, 2)};

export const TAB_FOR = ${JSON.stringify(TAB_FOR, null, 2)};

export const REPEAT_GROUPS = ${JSON.stringify(repeatGroups, null, 2)};

export const OBJECT_ARRAYS = ${JSON.stringify(OBJECT_ARRAYS, null, 2)};

export const FIELD_MULTI = ${JSON.stringify(FIELD_MULTI, null, 2)};

export const BOOLEANS = ${JSON.stringify(BOOLEANS, null, 2)};

export const AUTO_FIELDS = ${JSON.stringify(AUTO_FIELDS, null, 2)};

export const OPTIONS_EGRESO = ${JSON.stringify(OPTIONS_EGRESO, null, 2)};

export const DEFAULT_DISCHARGE = ${JSON.stringify(DEFAULT_DISCHARGE, null, 2)};

export const SPEC_EGRESO = ${JSON.stringify(SPEC, null, 2)};
`;

fs.writeFileSync(outputPath, content, 'utf8');
console.log(`✓ Archivo egresoCatalogos.js generado exitosamente en ${outputPath}`);
