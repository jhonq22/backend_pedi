const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');

const CATALOGOS_A_VERIFICAR = {
  soporte_oxigeno: [
    'Aire ambiente', 'Cánula nasal', 'Mascarilla simple', 'Mascarilla con reservorio',
    'Cánula de alto flujo', 'CPAP/BiPAP', 'Ventilación mecánica invasiva', 'Otro'
  ],
  extremidad_presion: [
    'Brazo derecho', 'Brazo izquierdo', 'Pierna derecha', 'Pierna izquierda'
  ],
  estado_perfusion: [
    'Bien perfundido', 'Hipoperfundido'
  ],
  inspeccion_torax: [
    'Normal', 'Simétrico', 'Asimétrico', 'Tonel', 'Cifótico', 'Excavado', 'Pectus excavatum', 'Pectus carinatum'
  ],
  actividad_precordial: [
    'Normodinámica', 'Hiperdinámica', 'Hipodinámica', 'No evaluable'
  ],
  apex_beat_palpable: [
    'Palpable', 'No palpable', 'No evaluable'
  ],
  apex_beat_location: [
    '4.º EIC izquierdo', '5.º EIC izquierdo', 'Otro'
  ],
  apex_beat_midclavicular: [
    'Medial', 'Sobre la línea', 'Lateral'
  ],
  apex_beat_intensity: [
    'Normal', 'Aumentada', 'Disminuida'
  ],
  apex_beat_extent: [
    'Localizado', 'Difuso'
  ],
  apex_beat_displacement: [
    'Ausente', 'Hacia la izquierda', 'Hacia abajo y a la izquierda', 'Otro'
  ],
  impulso_paraesternal: [
    'Ausente', 'Presente izquierdo', 'Presente derecho'
  ],
  impulso_precordial_heave: [
    'Ausente', 'Paraesternal izquierdo', 'Apical', 'Otro'
  ],
  impulso_epigastrico: [
    'Ausente', 'Presente'
  ],
  fremito_precordial: [
    'Ausente', 'Presente', 'No evaluable'
  ],
  fremito_localizacion: [
    'Foco aórtico', 'Pulmonar', 'Tricuspídeo', 'Mitral', 'Borde esternal izquierdo', 'Supraesternal', 'Otro'
  ],
  fremito_timing: [
    'Sistólico', 'Diastólico', 'Continuo'
  ],
  fremito_intensidad: [
    'Leve', 'Moderado', 'Intenso'
  ],
  ruidos_cardiacos: [
    'S1 y S2 presentes normofonéticos', 'Rítmicos sin soplos', 'S1 único',
    'S2 desdoblado fisiológico', 'S2 desdoblado fijo', 'S2 único', 'Ritmo de galope',
    'Clic de eyección', 'Galope de sumación', 'Roce pericárdico'
  ],
  s1_tipo: [
    'Único', 'Desdoblamiento fisiológico', 'Desdoblamiento amplio', 'Hipofonético', 'Hiperfonético', 'Soplo'
  ],
  s2_tipo: [
    'Único', 'Desdoblamiento fisiológico', 'Desdoblamiento amplio, fijo y permanente', 'P2 hiperfonético', 'Soplo'
  ],
  soplo_fase: [
    'Protosistólico', 'Mesosistólico', 'Holosistólico', 'Continuo', 'Protodiastólico', 'Mesodiastólico', 'Telediastólico'
  ],
  soplo_grado: [
    'I/VI', 'II/VI', 'III/VI', 'IV/VI', 'V/VI', 'VI/VI'
  ],
  soplo_pitch: [
    'Alta', 'Media', 'Baja'
  ],
  soplo_caracter: [
    'Vibratorio', 'Soplante', 'Áspero-rudo', 'Multifrecuencia', 'Chillón', 'En maquinaria', 'Inespecífico'
  ],
  soplo_irradiacion: [
    'Cuello/carótidas', 'Axila izquierda', 'Axila derecha', 'Espalda', 'Infraclavicular', 'No irradia', 'Otro'
  ],
  inspeccion_abdominal: [
    'Plano', 'Globoso', 'Escafoide'
  ],
  auscultacion_abdominal: [
    'Ruidos hidroaéreos presentes', 'Ruidos hidroaéreos aumentados', 'Ruidos hidroaéreos disminuidos', 'Ruidos hidroaéreos ausentes'
  ],
  amplitud_pulso: [
    '0 ausente', '1+ disminuido', '2+ normal', '3+ aumentado', '4+ salton-water hammer'
  ],
  pulso_localizacion: [
    'Radial', 'Braquial', 'Cubital', 'Femoral', 'Pedio', 'Tibial posterior', 'Carotídeo', 'Aorta abdominal'
  ],
  simetria_pulsos: [
    'Simétricos', 'Asimétricos', 'No evaluable'
  ],
  nivel_conciencia: [
    'Alerta', 'Somnoliento', 'Obnubilado', 'Estupor', 'Coma', 'No evaluable'
  ],
  pupilas_simetria: [
    'Isocóricas', 'Anisocóricas', 'Discóricas', 'No evaluable'
  ],
  pupilas_reactividad: [
    'Reactiva', 'Hiporreactiva', 'Arreactiva', 'No evaluable'
  ],
  tono_muscular: [
    'Normal', 'Hipotonía', 'Hipertonía', 'Mixto', 'No evaluable'
  ],
  fontanela_anterior: [
    'Normotensa', 'Abombada', 'Deprimida', 'Cerrada', 'No evaluable'
  ],
  control_cefalico: [
    'Adecuado para edad', 'Retrasado', 'No evaluable'
  ]
};

async function seed() {
  console.log('--- Verificando y poblando catálogos en lista_tipo_general ---');
  let inserted = 0;
  for (const [tipo, opciones] of Object.entries(CATALOGOS_A_VERIFICAR)) {
    const [existing] = await db.query(
      'SELECT nombre FROM lista_tipo_general WHERE tipo = ?',
      [tipo]
    );
    const existingSet = new Set(existing.map(e => e.nombre.toLowerCase().trim()));

    for (let i = 0; i < opciones.length; i++) {
      const nombre = opciones[i];
      if (!existingSet.has(nombre.toLowerCase().trim())) {
        await db.query(
          `INSERT INTO lista_tipo_general (
            tipo, nombre, orden, estatus, audit_usu_id, audit_ip, audit_dep_id
          ) VALUES (?, ?, ?, 1, '1', '127.0.0.1', '1')`,
          [tipo, nombre, i + 1]
        );
        inserted++;
      }
    }
  }

  console.log(`✓ Catálogos verificados. Nuevos registros insertados: ${inserted}`);
  process.exit(0);
}

seed();

