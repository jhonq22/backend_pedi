const fs = require('fs');
const path = require('path');

const rawData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../cirugia_data.json'), 'utf8'));
const script6 = fs.readFileSync(path.resolve(__dirname, 'cirugia_script_6.js'), 'utf8');

// Combine spec + auxiliary
const allFields = [...rawData.spec, ...(rawData.auxiliary || [])];

const AREAS = [
  { id: 'surg', label: '1. Cirugía cardiovascular', shortLabel: 'Cirugía', icon: 'pi pi-heart' },
  { id: 'anes', label: '2. Anestesiología', shortLabel: 'Anestesia', icon: 'pi pi-sliders-h' },
  { id: 'perf', label: '3. Perfusión / CEC', shortLabel: 'Perfusión', icon: 'pi pi-sync' }
];

const TABS = [
  { id: 'episode', label: 'Episodio y Prioridad', area: 'surg', categories: ['IDENTIFICACIÓN DEL EPISODIO QUIRÚRGICO', 'TIPO Y PRIORIDAD DE CIRUGÍA'] },
  { id: 'procedures', label: 'Diagnósticos y Procedimientos', area: 'surg', categories: ['DIAGNÓSTICOS PREOPERATORIOS', 'PROCEDIMIENTOS QUIRÚRGICOS'] },
  { id: 'team', label: 'Equipo y Abordaje', area: 'surg', categories: ['EQUIPO QUIRÚRGICO', 'ABORDAJE QUIRÚRGICO'] },
  { id: 'operative', label: 'Nota Operatoria', area: 'surg', categories: ['NOTA OPERATORIA'] },
  { id: 'events', label: 'Eventos y Muestras', area: 'surg', categories: ['COMPLICACIONES QUIRÚRGICAS INTRAOPERATORIAS', 'RESECCIONES / TEJIDOS / MUESTRAS'] },
  
  { id: 'anes_pre', label: 'Evaluación y Técnica', area: 'anes', categories: ['IDENTIFICACIÓN ANESTÉSICA', 'EVALUACIÓN ANESTÉSICA INMEDIATA', 'TÉCNICA ANESTÉSICA'] },
  { id: 'anes_air', label: 'Vía Aérea y Accesos', area: 'anes', categories: ['VÍA AÉREA', 'MONITORIZACIÓN Y ACCESOS COLOCADOS POR ANESTESIA', 'MEDICACIÓN Y PRODUCTOS ANESTÉSICOS'] },
  { id: 'anes_end', label: 'Complicaciones y Cierre', area: 'anes', categories: ['COMPLICACIONES ANESTÉSICAS', 'CONDICIÓN AL FINALIZAR ANESTESIA'] },

  { id: 'perf_setup', label: 'Montaje y CEC', area: 'perf', categories: ['IDENTIFICACIÓN DEL REGISTRO DE PERFUSIÓN', 'CANULACIÓN', 'CIRCULACIÓN EXTRACORPÓREA', 'PINZAMIENTO AÓRTICO'] },
  { id: 'perf_protect', label: 'Protección Miocárdica', area: 'perf', categories: ['TEMPERATURA', 'CARDIOPLEJIA / PROTECCIÓN MIOCÁRDICA', 'PARADA CIRCULATORIA', 'PERFUSIÓN CEREBRAL', 'CEBADO DEL CIRCUITO', 'ULTRAFILTRACIÓN'] },
  { id: 'perf_end', label: 'Salida y Nota CEC', area: 'perf', categories: ['SALIDA DE CEC', 'COMPLICACIONES DE PERFUSIÓN/CEC', 'NOTA DE PERFUSIÓN'] }
];

const REPEATERS = {
  diagnosis: {
    label: 'Diagnóstico preoperatorio',
    plural: 'Diagnósticos preoperatorios',
    id: 'preop_diagnosis_id',
    prop: 'diagnoses',
    scope: 'diagnosis',
    category: 'DIAGNÓSTICOS PREOPERATORIOS',
    area: 'surg'
  },
  procedure: {
    label: 'Procedimiento quirúrgico',
    plural: 'Procedimientos realizados',
    id: 'surgical_procedure_id',
    prop: 'procedures',
    scope: 'procedure',
    category: 'PROCEDIMIENTOS QUIRÚRGICOS',
    area: 'surg'
  },
  surg_comp: {
    label: 'Complicación quirúrgica',
    plural: 'Complicaciones intraoperatorias',
    id: 'surgical_complication_id',
    prop: 'surgical_complications',
    scope: 'surg_comp',
    category: 'COMPLICACIONES QUIRÚRGICAS INTRAOPERATORIAS',
    area: 'surg'
  },
  anes_comp: {
    label: 'Complicación anestésica',
    plural: 'Complicaciones anestésicas',
    id: 'anesthesia_complication_id',
    prop: 'anesthesia_complications',
    scope: 'anes_comp',
    category: 'COMPLICACIONES ANESTÉSICAS',
    area: 'anes'
  },
  cannulation: {
    label: 'Canulación',
    plural: 'Canulaciones',
    id: 'cannulation_id',
    prop: 'cannulations',
    scope: 'cannulation',
    category: 'CANULACIÓN',
    area: 'perf'
  },
  perf_comp: {
    label: 'Complicación de CEC',
    plural: 'Complicaciones de perfusión',
    id: 'perfusion_complication_id',
    prop: 'perfusion_complications',
    scope: 'perf_comp',
    category: 'COMPLICACIONES DE PERFUSIÓN/CEC',
    area: 'perf'
  }
};

const PREOP_DIAGNOSES_DEMO = [
  'Comunicación interventricular (CIV)',
  'Comunicación interauricular (CIA)',
  'Tetralogía de Fallot',
  'Coartación aórtica',
  'Ductus arterioso persistente (PDA)',
  'Transposición de grandes arterias (TGA)',
  'Canal auriculoventricular completo (CAV)',
  'Anomalía total del retorno venoso pulmonar (ATVP)',
  'Estenosis pulmonar congénita',
  'Atresia tricuspídea',
  'Tronco arterioso persistente',
  'Hipoplasia de ventrículo izquierdo (HLHS)',
  'Interrupción del arco aórtico',
  'Doble salida de ventrículo derecho (DSVD)',
  'Otro diagnóstico cardíaco congénito'
];

// Build catalog options map
const CATALOGOS = {};
allFields.forEach(f => {
  if (f.options && f.options.length > 0) {
    CATALOGOS[f.key] = f.options;
  }
});

// Output code for front/src/constants/cirugiaCatalogos.js
const fileContent = `// Catálogos, especificaciones y definiciones para Cirugía Cardiovascular Pediátrica (HCIL V11 / Módulo 11)
// Migrado 1:1 desde hcil_agenda_identificacion_v17.html

export const AREAS = ${JSON.stringify(AREAS, null, 2)};

export const TABS = ${JSON.stringify(TABS, null, 2)};

export const REPEATERS = ${JSON.stringify(REPEATERS, null, 2)};

export const PREOP_DIAGNOSES_DEMO = ${JSON.stringify(PREOP_DIAGNOSES_DEMO, null, 2)};

export const CATALOGOS = ${JSON.stringify(CATALOGOS, null, 2)};

export const CIRUGIA_FIELDS = ${JSON.stringify(allFields, null, 2)};

export const generarUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const crearCirugiaVacia = (existingCount = 0) => {
  const sxId = generarUUID();
  return {
    id: null,
    surgery_id: sxId,
    encounter_id: null,
    operative_note_id: generarUUID(),
    
    // Identificación y tiempos principales (Surgery Scope)
    surgery_date: new Date().toISOString().split('T')[0],
    surgery_start_datetime: '',
    surgery_end_datetime: '',
    or_exit_datetime: '',
    surgery_duration_min: null,
    age_at_surgery_days: null,
    age_at_surgery_months: null,
    weight_at_surgery_kg: null,
    height_at_surgery_cm: null,
    operating_room: '',
    surgery_priority: 'Electiva',
    surgery_strategy: 'Corrección completa definitiva',
    first_cardiac_surgery: existingCount === 0 ? true : false,
    cardiac_surgery_number: existingCount + 1,
    redo_surgery: existingCount > 0,
    planned_reoperation: false,
    surgery_due_to_complication: false,
    parent_surgery_id: null,
    parent_complication_id: null,
    
    // Equipo y abordaje
    primary_surgeon_id: '',
    assistant_surgeon_ids: [],
    surgical_resident_ids: [],
    scrub_nurse_id: '',
    surgical_approach: 'Esternotomía media',
    surgical_approach_other: '',
    redo_sternotomy: false,
    
    // Nota operatoria y hallazgos
    operative_procedure_summary: '',
    operative_findings_narrative: '',
    residual_lesion_present: 'No',
    residual_lesion_description: '',
    postrepair_echo_id: null,
    postrepair_echo_result: '',
    postoperative_rhythm: 'Sinusal',
    chest_status: 'Cerrado completamente',
    destination_after_or: 'UCIP Cardiovascular',
    operative_note_signed_by: '',
    operative_note_signed_at: null,
    complication_present: false,
    specimen_obtained: false,
    specimen_type: '',
    pathology_requested: false,
    
    // Sub-registros de Cirugía
    diagnoses: [],
    procedures: [],
    surgical_complications: [],
    
    // Anestesiología (Scope Anesthesia)
    anesthesia: {
      anesthesia_record_id: generarUUID(),
      anesthesiologist_id: '',
      anesthesia_assistant_ids: [],
      anesthesia_start_datetime: '',
      anesthesia_end_datetime: '',
      anesthesia_duration_min: null,
      asa_class: 'ASA IV',
      asa_emergency: false,
      preanesthesia_status: '',
      preop_oxygen_support: 'Aire ambiente',
      preop_vasoactive_support: false,
      anesthesia_type: 'General balanceada',
      induction_type: 'Endovenosa',
      anesthesia_notes: '',
      airway_management: 'Intubación orotraqueal',
      difficult_airway: false,
      airway_difficulty_notes: '',
      ett_size_mm: null,
      ett_cuffed: 'Sin cuff',
      intubation_attempts: 1,
      arterial_line_inserted: true,
      arterial_line_site: 'Radial derecha',
      central_line_inserted: true,
      central_line_site: 'Yugular interna derecha',
      tee_used: true,
      tee_study_id: null,
      cerebral_oximetry_used: true,
      anesthesia_medication_ids: [],
      anesthesia_transfusion_ids: [],
      anesthesia_fluid_balance_id: null,
      extubated_in_or: false,
      post_anesthesia_airway: 'Intubado con TET',
      post_anesthesia_condition: 'Crítico estable',
      anesthesia_destination: 'UCIP Cardiovascular',
      anesthesia_note: '',
      anesthesia_signed_by: '',
      anesthesia_signed_at: null
    },
    anesthesia_complications: [],
    
    // Perfusión y CEC (Scope Perfusion)
    perfusion: {
      perfusion_record_id: generarUUID(),
      cpb_used: true,
      perfusionist_id: '',
      assistant_perfusionist_ids: [],
      cpb_start_datetime: '',
      cpb_end_datetime: '',
      cpb_total_time_min: null,
      cpb_period_count: 0,
      cpb_flow_strategy: 'Normoflujo pulsátil/continuo',
      aortic_cross_clamp_used: true,
      cross_clamp_total_time_min: null,
      cross_clamp_period_count: 0,
      cpb_temperature_strategy: 'Hipotermia moderada (28–32 °C)',
      cpb_min_temperature_c: 28.0,
      temperature_measurement_site: ['Nasofaríngea', 'Rectal'],
      cardioplegia_used: true,
      cardioplegia_solution: 'Custodiol / Histidina-Triptófano-Cetoglutarato',
      cardioplegia_composition: 'Cristaloide intracelular',
      cardioplegia_route: ['Anterógrada en raíz aórtica'],
      cardioplegia_temperature: 'Fría (4 °C)',
      cardioplegia_dose_count: 1,
      cardioplegia_total_volume_ml: 400,
      circulatory_arrest_used: false,
      circulatory_arrest_total_time_min: null,
      circulatory_arrest_temperature_c: null,
      cerebral_perfusion_used: false,
      cerebral_perfusion_type: 'No requerida',
      cerebral_perfusion_time_min: null,
      cerebral_perfusion_flow: null,
      prime_type: 'Con hemoderivados',
      prime_total_volume_ml: 500,
      blood_prime_used: true,
      prime_notes: '',
      ultrafiltration_used: true,
      ultrafiltration_type: 'Convencional (CUF) y modificada (MUF)',
      ultrafiltrate_volume_ml: 350,
      weaning_from_cpb: 'Salida exitosa al primer intento',
      defibrillation_required: false,
      defibrillation_count: null,
      temporary_pacing_required: false,
      mechanical_support_required: false,
      mechanical_support_type: 'No requerido',
      perfusion_note: '',
      perfusion_signed_by: '',
      perfusion_signed_at: null
    },
    cannulations: [],
    cpb_periods: [],
    clamp_periods: [],
    perfusion_complications: [],
    
    // Validaciones y Firmas
    signed: {
      surg: null,
      anes: null,
      perf: null
    },
    estatus_nota: 'Borrador',
    finalized: false,
    finalized_at: null,
    summaryEdited: false
  };
};
`;

const outputPath = path.resolve(__dirname, '../../front/src/constants/cirugiaCatalogos.js');
fs.writeFileSync(outputPath, fileContent, 'utf8');
console.log('Successfully generated:', outputPath);
