// backend/scripts/generate_laboratorios_constants.js
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.resolve(__dirname, '../lab_script_complete.js'), 'utf8');

// 1. Extraer SPEC
const specStart = script.indexOf('const SPEC=[');
const specEnd = script.indexOf('];', specStart);
const spec = JSON.parse(script.substring(specStart + 11, specEnd + 1));

// 2. Extraer FIXED_UNIT
const fixedStart = script.indexOf('const FIXED_UNIT={');
const fixedEnd = script.indexOf('};', fixedStart);
const fixedUnitStr = script.substring(fixedStart + 17, fixedEnd + 1);
const fixedUnit = eval('(' + fixedUnitStr + ')');

// 3. Extraer PANELS
const panelsStart = script.indexOf('const PANELS={');
const panelsEnd = script.indexOf('};', panelsStart);
const panelsStr = script.substring(panelsStart + 13, panelsEnd + 1);
const panels = eval('(' + panelsStr + ')');

// 4. Analitos únicos de catálogo
const GROUPS = Array.from(new Set(spec.filter(x => x.category === 'HEMOGRAMA' || ['ELECTROLITOS', 'FUNCIÓN RENAL', 'FUNCIÓN HEPÁTICA Y PROTEÍNAS', 'BIOMARCADORES CARDIOVASCULARES', 'COAGULACIÓN', 'GASOMETRÍA', 'GLUCOSA Y METABOLISMO', 'PERFIL LIPÍDICO', 'MARCADORES INFLAMATORIOS', 'HIERRO', 'FUNCIÓN TIROIDEA'].includes(x.category)).map(x => x.category)));
const ANALYTES = spec.filter(x => GROUPS.includes(x.category) && !['blood_gas_type', 'fio2', 'oxygen_support_gas'].includes(x.key)).filter((x, i, a) => a.findIndex(y => y.key === x.key) === i);

// Construir archivo de constantes
const output = `// Constantes y Catálogos Estructurados para Laboratorios Clínicos Pediátricos (HCIL V12 / V17)

export const TABS_LABORATORIO = [
  { id: 'context', numero: '01', titulo: 'Estudio y muestra', icono: 'pi pi-id-card' },
  { id: 'results', numero: '02', titulo: 'Resultados', icono: 'pi pi-list' },
  { id: 'gas', numero: '03', titulo: 'Gasometría', icono: 'pi pi-compass' },
  { id: 'micro', numero: '04', titulo: 'Microbiología', icono: 'pi pi-shield' },
  { id: 'bank', numero: '05', titulo: 'Banco de sangre', icono: 'pi pi-heart' },
  { id: 'review', numero: '06', titulo: 'Revisión técnica', icono: 'pi pi-file-check' }
];

export const PANEL_OPTIONS = [
  'Hematología',
  'Química',
  'Electrolitos',
  'Función renal',
  'Función hepática',
  'Coagulación',
  'Gases',
  'Biomarcadores cardíacos',
  'Inflamación-infección',
  'Metabólico',
  'Endocrino',
  'Microbiología',
  'Banco de sangre',
  'Otro'
];

export const PANELS_MAP = ${JSON.stringify(panels, null, 2)};

export const FIXED_UNITS = ${JSON.stringify(fixedUnit, null, 2)};

export const CATALOGOS_LABORATORIO = {
  specimen_type: [
    'Sangre total',
    'Plasma',
    'Suero',
    'Sangre arterial',
    'Sangre venosa',
    'Sangre capilar',
    'Orina',
    'LCR',
    'Otro'
  ],
  specimen_site: [
    'Arterial',
    'Venoso periférico',
    'Línea arterial',
    'CVC',
    'Otro'
  ],
  fasting_status: [
    'En ayunas',
    'No en ayunas',
    'Desconocido',
    'No aplica'
  ],
  sample_quality: [
    'Adecuada',
    'Hemolizada',
    'Lipémica',
    'Ictérica',
    'Coagulada',
    'Insuficiente',
    'Otra'
  ],
  blood_gas_type: [
    'Arterial',
    'Venosa',
    'Capilar',
    'Mixta'
  ],
  oxygen_support_gas: [
    'Aire ambiente',
    'Cánula',
    'Mascarilla',
    'Alto flujo',
    'VMNI',
    'Ventilación invasiva',
    'Otro'
  ],
  culture_type: [
    'Hemocultivo',
    'Urocultivo',
    'Cultivo de catéter',
    'Otro'
  ],
  culture_result: [
    'Sin crecimiento',
    'Positivo',
    'Contaminado',
    'Pendiente'
  ],
  abo_group: [
    'A',
    'B',
    'AB',
    'O'
  ],
  rh_factor: [
    'Positivo',
    'Negativo',
    'Indeterminado'
  ],
  antibody_screen: [
    'Negativa',
    'Positiva',
    'Pendiente'
  ],
  crossmatch_status: [
    'Compatible',
    'Incompatible',
    'Pendiente',
    'No realizada'
  ],
  source_options: [
    'Manual',
    'Importado LIS',
    'Documento externo',
    'IA extraído'
  ],
  operator_options: [
    '=',
    '<',
    '>',
    '≤',
    '≥'
  ],
  result_type_options: [
    'NUMERIC',
    'TEXT',
    'CODED',
    'BOOLEAN'
  ],
  coded_options: [
    'Positivo',
    'Negativo',
    'Reactivo',
    'No reactivo',
    'Indeterminado',
    'Pendiente',
    'Otro'
  ],
  critical_status_options: [
    'Pendiente',
    'Notificado',
    'Confirmado'
  ]
};

export const SPEC_LABORATORIO = ${JSON.stringify(spec, null, 2)};

export const ANALYTES_CATALOG = ${JSON.stringify(ANALYTES, null, 2)};

export const getDefaultUnit = (analyteKey) => {
  if (FIXED_UNITS[analyteKey] !== undefined) return FIXED_UNITS[analyteKey];
  const item = ANALYTES_CATALOG.find(a => a.key === analyteKey);
  if (!item) return '';
  const fmt = item.format || '';
  const candidates = ['mmol/L', 'mg/dL', 'µmol/L', 'g/dL', 'pg/mL', 'ng/mL', 'mg/L', 'µg/dL', 'mUI/L', 'U/L', 'fL', 'pg', '%', 'mm/h', 'mmHg', 'segundos'];
  return candidates.find(c => fmt.trim().startsWith(c)) || '';
};
`;

fs.writeFileSync(path.resolve(__dirname, '../../front/src/constants/laboratoriosCatalogos.js'), output);
console.log('✓ Archivo front/src/constants/laboratoriosCatalogos.js generado con éxito.');
