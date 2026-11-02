const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');

async function migrate() {
  console.log('--- INICIANDO MIGRACIÓN DE BD: historia_examen_fisico ---');
  
  // 1. Obtener columnas existentes
  const [cols] = await db.query('DESCRIBE historia_examen_fisico');
  const existingCols = new Map(cols.map(c => [c.Field.toLowerCase(), c]));

  // Helper para verificar si existe columna
  const hasCol = (name) => existingCols.has(name.toLowerCase());

  // Helper seguro para ejecutar alter
  const executeAlter = async (sql, desc) => {
    try {
      await db.query(sql);
      console.log(`✓ [EXITO] ${desc}`);
    } catch (err) {
      console.error(`✗ [ERROR] ${desc}:`, err.message);
    }
  };

  // 1. Columna paciente_id
  if (!hasCol('paciente_id')) {
    await executeAlter(
      'ALTER TABLE historia_examen_fisico ADD COLUMN paciente_id INT NULL AFTER id',
      'Agregar paciente_id INT NULL AFTER id'
    );
  } else {
    console.log('• paciente_id ya existe en historia_examen_fisico.');
  }

  // 2. Modificar columnas NOT NULL para evitar error 1048
  const colsToNullable = [
    { name: 'peso_kg', def: 'DECIMAL(5,2) NULL DEFAULT NULL' },
    { name: 'talla_cm', def: 'DECIMAL(5,2) NULL DEFAULT NULL' },
    { name: 'frecuencia_cardiaca', def: 'INT NULL DEFAULT NULL' },
    { name: 'frecuencia_respiratoria', def: 'INT NULL DEFAULT NULL' },
    { name: 'saturacion_oxigeno', def: 'INT NULL DEFAULT NULL' },
    { name: 'presion_sistolica', def: 'INT NULL DEFAULT NULL' },
    { name: 'presion_diastolica', def: 'INT NULL DEFAULT NULL' },
    { name: 'extremidad_presion', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'estado_perfusion', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'llenado_capilar_segundos', def: 'DECIMAL(3,1) NULL DEFAULT NULL' },
    { name: 'pulso_amplitud', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'pulso_localizacion', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'nivel_conciencia', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'pupilas_simetria', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'tono_muscular', def: 'VARCHAR(100) NULL DEFAULT NULL' }
  ];

  for (const c of colsToNullable) {
    if (hasCol(c.name)) {
      await executeAlter(
        `ALTER TABLE historia_examen_fisico MODIFY COLUMN ${c.name} ${c.def}`,
        `Permitir NULL en ${c.name}`
      );
    }
  }

  // 3. Ajustar campos de auditoría a VARCHAR(255) y VARCHAR(100)
  await executeAlter(
    'ALTER TABLE historia_examen_fisico MODIFY COLUMN audit_usu_id VARCHAR(255) NULL, MODIFY COLUMN audit_ip VARCHAR(100) NULL, MODIFY COLUMN audit_dep_id VARCHAR(100) NULL',
    'Ampliación de campos de auditoría (audit_usu_id a VARCHAR(255))'
  );

  // 4. Nuevas columnas de V18 requeridas
  const newCols = [
    { name: 'exam_bp_mean', def: 'DECIMAL(5,1) NULL DEFAULT NULL' },
    { name: 'exam_chest_symmetry', def: 'VARCHAR(50) NULL DEFAULT NULL' },
    { name: 'exam_precordial_activity', def: 'VARCHAR(50) NULL DEFAULT NULL' },
    
    // Choque de punta V18
    { name: 'exam_apex_beat_palpable', def: 'VARCHAR(50) NULL DEFAULT NULL' },
    { name: 'exam_apex_beat_location', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'exam_apex_beat_location_other', def: 'VARCHAR(255) NULL DEFAULT NULL' },
    { name: 'exam_apex_beat_midclavicular_relation', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'exam_apex_beat_intensity', def: 'VARCHAR(50) NULL DEFAULT NULL' },
    { name: 'exam_apex_beat_extent', def: 'VARCHAR(50) NULL DEFAULT NULL' },
    { name: 'exam_apex_beat_displacement', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'exam_apex_beat_displacement_other', def: 'VARCHAR(255) NULL DEFAULT NULL' },

    // Impulsos precordiales
    { name: 'exam_parasternal_impulse', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'exam_precordial_heave', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'exam_precordial_heave_other', def: 'VARCHAR(255) NULL DEFAULT NULL' },
    { name: 'exam_epigastric_impulse', def: 'VARCHAR(50) NULL DEFAULT NULL' },

    // Frémito precordial V18
    { name: 'exam_precordial_thrill', def: 'VARCHAR(50) NULL DEFAULT NULL' },
    { name: 'exam_precordial_thrill_location', def: 'VARCHAR(100) NULL DEFAULT NULL' },
    { name: 'exam_precordial_thrill_location_other', def: 'VARCHAR(255) NULL DEFAULT NULL' },
    { name: 'exam_precordial_thrill_timing', def: 'VARCHAR(50) NULL DEFAULT NULL' },
    { name: 'exam_precordial_thrill_intensity', def: 'VARCHAR(50) NULL DEFAULT NULL' },

    // Glasgow y notas
    { name: 'glasgow_total', def: 'INT NULL DEFAULT NULL' },
    { name: 'gcs_eye', def: 'INT NULL DEFAULT NULL' },
    { name: 'gcs_verbal', def: 'INT NULL DEFAULT NULL' },
    { name: 'gcs_motor', def: 'INT NULL DEFAULT NULL' },
    { name: 'gcs_required', def: 'TINYINT(1) NULL DEFAULT 0' },
    { name: 'behavior_notes', def: 'TEXT NULL DEFAULT NULL' },
    { name: 'focal_neurologic_deficit_notes', def: 'TEXT NULL DEFAULT NULL' },
    { name: 'nystagmus_notes', def: 'TEXT NULL DEFAULT NULL' },
    { name: 'involuntary_movement_other', def: 'TEXT NULL DEFAULT NULL' },
    { name: 'sensory_deficit_distribution', def: 'TEXT NULL DEFAULT NULL' },
    { name: 'gait_other', def: 'TEXT NULL DEFAULT NULL' },
    { name: 'reflex_symmetry', def: 'VARCHAR(50) NULL DEFAULT NULL' },
    { name: 'capillary_refill_status', def: 'VARCHAR(50) NULL DEFAULT NULL' }
  ];

  for (const c of newCols) {
    if (!hasCol(c.name)) {
      await executeAlter(
        `ALTER TABLE historia_examen_fisico ADD COLUMN ${c.name} ${c.def}`,
        `Agregar columna ${c.name}`
      );
    } else {
      console.log(`• Columna ${c.name} ya existe.`);
    }
  }

  console.log('\n--- MIGRACIÓN DE BD COMPLETADA EXITOSAMENTE ---');
  process.exit(0);
}

migrate();

