const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const CATALOGOS_PRECARGA = {
  prioridad_referencia: ['Rutinaria', 'Preferente', 'Urgente'],
  certeza_diagnostica: ['Presuntivo', 'Confirmado', 'Por descartar'],
  estado_clinico_referido: ['Sin documentar', 'Estable', 'Inestable'],
  tipo_documento_referencia: ['Cédula V', 'Cédula E', 'Pasaporte', 'Acta de nacimiento', 'Sin documento'],
  sexo_referencia: ['Femenino', 'Masculino', 'Indeterminado', 'Desconocido'],
  nacionalidad_referencia: ['Venezolana', 'Colombiana', 'Otra'],
  parentesco_referencia: ['Madre', 'Padre', 'Tutor/a legal', 'Otro familiar', 'Otro'],
  especialidad_remitente: ['Pediatría', 'Cardiología infantil', 'Medicina general', 'Neonatología', 'Otra'],
  unidad_laboratorio_referencia: ['g/dL', '%', '/mm³', 'mg/dL', 'mmol/L', 'mEq/L', 's', '—'],
  estado_laboratorio_referencia: ['Disponible', 'Pendiente', 'No realizado', 'Desconocido'],
  estado_evaluacion_referencia: ['No documentado', 'Sí', 'No', 'Pendiente'],
  prueba_laboratorio_referencia: [
    'Grupo sanguíneo ABO', 'Factor Rh', 'Hemoglobina (Hb)', 'Hematocrito (Hto)', 'Leucocitos',
    'Fórmula diferencial', 'Plaquetas', 'Tiempo de protrombina (TP)',
    'Tiempo parcial de tromboplastina (TPT)', 'INR', 'Fibrinógeno', 'Hepatitis A',
    'Hepatitis B', 'HBsAg', 'Anticuerpos hepatitis B', 'Hepatitis C', 'VDRL', 'VIH',
    'Glicemia', 'Urea', 'Creatinina', 'Proteínas totales', 'Albúmina', 'Potasio',
    'Calcio', 'Sodio', 'Digoxinemia', 'Coproparasitológico', 'Uroanálisis'
  ],
  evaluacion_referencia: [
    'Radiografía de tórax', 'Electrocardiograma (ECG)', 'Ecocardiograma Doppler',
    'Cateterismo cardíaco', 'Tomografía (TAC)', 'Resonancia magnética (RMN)',
    'Evaluación nutricional', 'Evaluación psicológica / psiquiátrica',
    'Evaluación odontológica', 'Otras evaluaciones'
  ]
};

async function run() {
  console.log('=== EJECUTANDO MIGRACIÓN PRECARGA REFERENCIA ===');
  const sqlFile = path.resolve(__dirname, '../../migracion_precarga_referencia.sql');
  const rawSql = fs.readFileSync(sqlFile, 'utf8');

  // Split statements safely ignoring comments and USE
  const statements = rawSql
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.replace(/--.*$/gm, '').trim())
    .filter(s => s && !s.toUpperCase().startsWith('USE '));

  for (const stmt of statements) {
    try {
      await db.query(stmt);
      console.log('✓ SQL OK:', stmt.split('\n')[0].slice(0, 70));
    } catch (err) {
      console.error('✗ SQL ERROR:', err.message, '\nStatement:', stmt.slice(0, 120));
      process.exit(1);
    }
  }

  // Sembrar catálogos en lista_tipo_general
  let catInserted = 0;
  for (const [tipo, items] of Object.entries(CATALOGOS_PRECARGA)) {
    const [existing] = await db.query('SELECT nombre FROM lista_tipo_general WHERE tipo = ?', [tipo]);
    const existingSet = new Set(existing.map(r => r.nombre.toLowerCase().trim()));
    for (let i = 0; i < items.length; i++) {
      const nombre = items[i];
      if (!existingSet.has(nombre.toLowerCase().trim())) {
        await db.query(
          `INSERT INTO lista_tipo_general (tipo, nombre, orden, estatus, audit_usu_id, audit_ip, audit_dep_id)
           VALUES (?, ?, ?, 1, '1', '127.0.0.1', '1')`,
          [tipo, nombre, i + 1]
        );
        catInserted++;
      }
    }
  }
  console.log(`✓ Catálogos precarga sembrados en lista_tipo_general: ${catInserted} nuevos`);

  // Asegurar usuario de prueba rol_id = 6 si no existe ninguno
  const [refUsers] = await db.query('SELECT id, usuario FROM users WHERE rol_id = 6');
  if (refUsers.length === 0) {
    const [centroRows] = await db.query("SELECT id FROM lista_centro_salud WHERE descripcion = 'Centro Regional de Prueba (Yaracuy)' LIMIT 1");
    const centroId = centroRows[0]?.id || 6;
    const hash = await bcrypt.hash('123', 10);
    await db.query(
      'INSERT INTO users (usuario, password, centro_salud_id, nombres, rol_id, estatus) VALUES (?, ?, ?, ?, 6, 1)',
      ['referencia@yopmail.com', hash, String(centroId), 'Centro Regional Yaracuy']
    );
    console.log(`✓ Usuario demo rol_id=6 creado: referencia@yopmail.com (clave: 123, centro_salud_id: ${centroId})`);
  } else {
    console.log('• Ya existen usuarios con rol_id=6:', refUsers.map(u => u.usuario).join(', '));
  }

  console.log('=== MIGRACIÓN COMPLETADA ===');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
