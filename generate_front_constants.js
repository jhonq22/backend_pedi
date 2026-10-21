const fs = require('fs');

const src = JSON.parse(fs.readFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/src_examen_parsed.json', 'utf8'));

const tabs = [
  { key: 'vitals', numero: '01', titulo: 'Antropometría y signos vitales', subtitulo: 'Peso, talla, percentiles, IMC, SC Mosteller, SpO₂ y presión arterial', icono: 'pi pi-sliders-h' },
  { key: 'general', numero: '02', titulo: 'Estado general y tórax', subtitulo: 'Perfusión, piel, cicatrices e inspección/palpación precordial', icono: 'pi pi-heart' },
  { key: 'auscult', numero: '03', titulo: 'Auscultación cardiopulmonar', subtitulo: 'Campos pulmonares, ruidos cardíacos, soplos S1 y S2 (Levine)', icono: 'pi pi-volume-up' },
  { key: 'other', numero: '04', titulo: 'Abdomen, extremidades y genitales', subtitulo: 'Visceromegalias, edemas, llenado capilar, pulsos arteriales y genitales', icono: 'pi pi-compass' },
  { key: 'neuro1', numero: '05', titulo: 'Neurología · Evaluación global', subtitulo: 'Conciencia, Glasgow pediátrico, estado mental, lenguaje y pupilas', icono: 'pi pi-eye' },
  { key: 'neuro2', numero: '06', titulo: 'Neurología · Pares craneales', subtitulo: 'Motilidad ocular, matriz I-XII, simetría facial y orofaringe', icono: 'pi pi-sitemap' },
  { key: 'neuro3', numero: '07', titulo: 'Neurología · Motricidad y reflejos', subtitulo: 'Tono, fuerza (0-5), matriz reflejos bilaterales, clonus y Babinski', icono: 'pi pi-bolt' },
  { key: 'neuro4', numero: '08', titulo: 'Neurología · Sensibilidad y desarrollo', subtitulo: 'Sensibilidad, marcha, reflejos primitivos del lactante y signos meníngeos', icono: 'pi pi-shield' }
];

const paresCranealesDef = [
  { par: 'I', nombre: 'Olfatorio', area: 'Olfato (cuando es pertinente)' },
  { par: 'II', nombre: 'Óptico', area: 'Visión y campos visuales' },
  { par: 'III', nombre: 'Oculomotor', area: 'Motilidad ocular extrínseca y reflejo pupilar' },
  { par: 'IV', nombre: 'Troclear / Patético', area: 'Músculo oblicuo superior' },
  { par: 'V', nombre: 'Trigémino', area: 'Sensibilidad facial y masticación' },
  { par: 'VI', nombre: 'Abducens', area: 'Músculo recto lateral' },
  { par: 'VII', nombre: 'Facial', area: 'Simetría facial y mímica' },
  { par: 'VIII', nombre: 'Vestibulococlear', area: 'Audición y equilibrio' },
  { par: 'IX', nombre: 'Glosofaríngeo', area: 'Paladar, deglución y gusto posterior' },
  { par: 'X', nombre: 'Vago / Neumogástrico', area: 'Fonación, paladar y deglución' },
  { par: 'XI', nombre: 'Accesorio / Espinal', area: 'Elevación de hombros y esternocleidomastoideo' },
  { par: 'XII', nombre: 'Hipogloso', area: 'Movilidad y trofismo lingual' }
];

const reflejosOsteoDef = [
  { tipo: 'Bicipital', nivel: 'C5-C6' },
  { tipo: 'Tricipital', nivel: 'C7-C8' },
  { tipo: 'Braquiorradial', nivel: 'C5-C6' },
  { tipo: 'Rotuliano', nivel: 'L3-L4' },
  { tipo: 'Aquíleo', nivel: 'S1-S2' }
];

const reflejosPrimitivosDef = [
  { tipo: 'Moro', normalHasta: '4-6 meses' },
  { tipo: 'Búsqueda', normalHasta: '3-4 meses' },
  { tipo: 'Succión', normalHasta: '4 meses' },
  { tipo: 'Prensión palmar', normalHasta: '4-6 meses' },
  { tipo: 'Prensión plantar', normalHasta: '9-12 meses' },
  { tipo: 'Tónico cervical asimétrico', normalHasta: '5-7 meses' }
];

const jsContent = `// constants/examenFisicoCatalogos.js
// Catálogos oficiales y estructura de 167 campos del Examen Físico Pediátrico

export const TABS_EXAMEN = ${JSON.stringify(tabs, null, 2)};

export const PARES_CRANEALES_DEF = ${JSON.stringify(paresCranealesDef, null, 2)};

export const REFLEJOS_OSTEO_DEF = ${JSON.stringify(reflejosOsteoDef, null, 2)};

export const REFLEJOS_PRIMITIVOS_DEF = ${JSON.stringify(reflejosPrimitivosDef, null, 2)};

export const CATALOGOS_EXAMEN = ${JSON.stringify(src.catalog, null, 2)};
`;

fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/front/src/constants/examenFisicoCatalogos.js', jsContent, 'utf8');
console.log('Successfully written front/src/constants/examenFisicoCatalogos.js!');
