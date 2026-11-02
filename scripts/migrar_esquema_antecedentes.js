// backend/scripts/migrar_esquema_antecedentes.js
const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pediatrico',
    multipleStatements: true
  });

  console.log('--- FASE 1: INICIANDO MIGRACIÓN DE ANTECEDENTES ---');

  // 1. Ejecutar script de catálogos en lista_tipo_general
  const sqlCatalogos = fs.readFileSync(path.join(__dirname, 'migracion_catalogos_antecedentes.sql'), 'utf8');
  await conn.query(sqlCatalogos);
  console.log('✓ Catálogos insertados exitosamente en lista_tipo_general');

  // Helper para verificar existencia de columnas
  async function columnExists(table, column) {
    const [rows] = await conn.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return rows.length > 0;
  }

  // 2. Modificaciones y ajustes en historia_antecedente
  console.log('Modificando historia_antecedente...');
  
  if (!(await columnExists('historia_antecedente', 'paciente_id'))) {
    await conn.query('ALTER TABLE historia_antecedente ADD COLUMN paciente_id INT NULL AFTER id');
    console.log('  + Added paciente_id');
  }

  // Ajustar columnas existentes para que permitan NULL y no fallen con ER_BAD_NULL_ERROR (1048)
  const columnsToRelax = [
    'complicaciones_gestacionales VARCHAR(20) NULL DEFAULT "No"',
    'complicaciones_neonatales VARCHAR(20) NULL DEFAULT "No"',
    'cardiopatia_congenita VARCHAR(20) NULL DEFAULT "No"',
    'estudios_cardiacos_anormales VARCHAR(20) NULL DEFAULT "No"',
    'hipertension_pulmonar VARCHAR(20) NULL DEFAULT "No"',
    'falla_medro VARCHAR(20) NULL DEFAULT "No"',
    'kawasaki VARCHAR(20) NULL DEFAULT "No"',
    'fiebre_reumatica VARCHAR(20) NULL DEFAULT "No"',
    'sindrome_genetico VARCHAR(20) NULL DEFAULT "No"',
    'miopatia VARCHAR(20) NULL DEFAULT "No"',
    'antecedente_familiar_cv VARCHAR(20) NULL DEFAULT "No"',
    'audit_ip VARCHAR(100) NULL',
    'audit_dep_id VARCHAR(100) NULL'
  ];

  for (const colDef of columnsToRelax) {
    const colName = colDef.split(' ')[0];
    try {
      await conn.query(`ALTER TABLE historia_antecedente MODIFY COLUMN ${colDef}`);
    } catch (e) {
      console.warn(`  Warning modifying ${colName}:`, e.message);
    }
  }

  // Columnas nuevas en historia_antecedente
  const newColsAnt = [
    { name: 'forma_presentacion_cc_otro', def: 'VARCHAR(200) NULL AFTER unidad_edad_diagnostico_cc' },
    { name: 'kawasaki_edad_valor', def: 'INT NULL AFTER kawasaki_fecha_inicio' },
    { name: 'kawasaki_edad_unidad', def: 'VARCHAR(20) NULL AFTER kawasaki_edad_valor' },
    { name: 'fiebre_reumatica_edad', def: 'INT NULL AFTER fiebre_reumatica_fecha_inicio' },
    { name: 'fiebre_reumatica_cardiopatia_previa', def: 'VARCHAR(20) NULL AFTER fiebre_reumatica_edad' },
    { name: 'antecedente_medico_no_cv', def: 'VARCHAR(20) NULL DEFAULT "No" AFTER miopatia_otro' },
    { name: 'diagnosticos_no_cv_notas', def: 'TEXT NULL AFTER antecedente_medico_no_cv' },
    { name: 'antecedente_quirurgico_no_cv', def: 'VARCHAR(20) NULL DEFAULT "No" AFTER diagnosticos_no_cv_notas' },
    { name: 'medicamentos_actuales', def: 'VARCHAR(20) NULL DEFAULT "No" AFTER antecedente_quirurgico_no_cv' },
    { name: 'estado_alergia', def: 'VARCHAR(20) NULL DEFAULT "No conocidas" AFTER medicamentos_actuales' },
    // Columnas JSON para selecciones múltiples
    { name: 'presentacion_cc_json', def: 'JSON NULL' },
    { name: 'intervenciones_cc_json', def: 'JSON NULL' },
    { name: 'estudios_cv_anormales_json', def: 'JSON NULL' },
    { name: 'fiebre_reumatica_manifestaciones_json', def: 'JSON NULL' },
    { name: 'fiebre_reumatica_medicamentos_json', def: 'JSON NULL' },
    { name: 'fiebre_reumatica_cirugia_json', def: 'JSON NULL' },
    { name: 'sindromes_geneticos_json', def: 'JSON NULL' },
    { name: 'tipos_miopatia_json', def: 'JSON NULL' }
  ];

  for (const col of newColsAnt) {
    if (!(await columnExists('historia_antecedente', col.name))) {
      await conn.query(`ALTER TABLE historia_antecedente ADD COLUMN ${col.name} ${col.def}`);
      console.log(`  + Added ${col.name} to historia_antecedente`);
    }
  }

  // 3. Crear tabla repetible 1: historia_diagnostico_no_cardiovascular
  console.log('Creando tabla historia_diagnostico_no_cardiovascular...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS historia_diagnostico_no_cardiovascular (
      id INT AUTO_INCREMENT PRIMARY KEY,
      paciente_id INT NULL,
      registro_solicitud_id INT NOT NULL,
      categoria_id INT NULL,
      categoria_nombre VARCHAR(100) NULL,
      diagnostico VARCHAR(180) NOT NULL,
      observacion TEXT NULL,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      audit_usu_id VARCHAR(255) NULL,
      audit_ip VARCHAR(100) NULL,
      audit_dep_id VARCHAR(100) NULL,
      INDEX idx_diag_solicitud (registro_solicitud_id),
      INDEX idx_diag_paciente (paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ Tabla historia_diagnostico_no_cardiovascular lista');

  // 4. Crear tabla repetible 2: historia_cirugia_no_cardiovascular
  console.log('Creando tabla historia_cirugia_no_cardiovascular...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS historia_cirugia_no_cardiovascular (
      id INT AUTO_INCREMENT PRIMARY KEY,
      paciente_id INT NULL,
      registro_solicitud_id INT NOT NULL,
      procedimiento_id INT NULL,
      procedimiento_nombre VARCHAR(150) NULL,
      procedimiento_otro VARCHAR(250) NULL,
      fecha_procedimiento DATE NULL,
      observacion TEXT NULL,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      audit_usu_id VARCHAR(255) NULL,
      audit_ip VARCHAR(100) NULL,
      audit_dep_id VARCHAR(100) NULL,
      INDEX idx_cir_solicitud (registro_solicitud_id),
      INDEX idx_cir_paciente (paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ Tabla historia_cirugia_no_cardiovascular lista');

  // 5. Ajustar tabla repetible 3: historia_medicamento_habitual
  console.log('Ajustando tabla historia_medicamento_habitual...');
  if (!(await columnExists('historia_medicamento_habitual', 'paciente_id'))) {
    await conn.query('ALTER TABLE historia_medicamento_habitual ADD COLUMN paciente_id INT NULL AFTER id');
    console.log('  + Added paciente_id');
  }
  // Modificar nombre_medicamento a VARCHAR(180) para evitar warning 1265
  await conn.query('ALTER TABLE historia_medicamento_habitual MODIFY COLUMN nombre_medicamento VARCHAR(180) NOT NULL');
  console.log('  ✓ nombre_medicamento ajustado a VARCHAR(180)');

  // Columnas adicionales para medicamentos
  const medCols = [
    { name: 'unidad_nombre', def: 'VARCHAR(50) NULL AFTER unidad_id' },
    { name: 'concentracion', def: 'VARCHAR(100) NULL AFTER dosis' },
    { name: 'frecuencia_nombre', def: 'VARCHAR(100) NULL AFTER frecuencia_id' },
    { name: 'via_nombre', def: 'VARCHAR(50) NULL AFTER via_administracion_id' }
  ];
  for (const col of medCols) {
    if (!(await columnExists('historia_medicamento_habitual', col.name))) {
      await conn.query(`ALTER TABLE historia_medicamento_habitual ADD COLUMN ${col.name} ${col.def}`);
      console.log(`  + Added ${col.name} to historia_medicamento_habitual`);
    }
  }
  await conn.query('ALTER TABLE historia_medicamento_habitual MODIFY COLUMN audit_ip VARCHAR(100) NULL, MODIFY COLUMN audit_dep_id VARCHAR(100) NULL');

  // 6. Ajustar tabla repetible 4: historia_alergia
  console.log('Ajustando tabla historia_alergia...');
  if (!(await columnExists('historia_alergia', 'paciente_id'))) {
    await conn.query('ALTER TABLE historia_alergia ADD COLUMN paciente_id INT NULL AFTER id');
    console.log('  + Added paciente_id');
  }
  const alergiaCols = [
    { name: 'tipo_alergia_id', def: 'INT NULL AFTER registro_solicitud_id' },
    { name: 'tipo_alergia_nombre', def: 'VARCHAR(50) NULL AFTER tipo_alergia_id' },
    { name: 'severidad_id', def: 'INT NULL AFTER reaccion' },
    { name: 'severidad_nombre', def: 'VARCHAR(50) NULL AFTER severidad_id' },
    { name: 'observacion', def: 'TEXT NULL AFTER severidad' }
  ];
  for (const col of alergiaCols) {
    if (!(await columnExists('historia_alergia', col.name))) {
      await conn.query(`ALTER TABLE historia_alergia ADD COLUMN ${col.name} ${col.def}`);
      console.log(`  + Added ${col.name} to historia_alergia`);
    }
  }
  await conn.query('ALTER TABLE historia_alergia MODIFY COLUMN audit_ip VARCHAR(100) NULL, MODIFY COLUMN audit_dep_id VARCHAR(100) NULL');

  // 7. Crear tabla repetible 5: historia_antecedente_familiar
  console.log('Creando tabla historia_antecedente_familiar...');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS historia_antecedente_familiar (
      id INT AUTO_INCREMENT PRIMARY KEY,
      paciente_id INT NULL,
      registro_solicitud_id INT NOT NULL,
      parentesco_id INT NULL,
      parentesco_nombre VARCHAR(100) NULL,
      condiciones_json JSON NULL,
      edad_diagnostico INT NULL,
      edad_muerte_subita INT NULL,
      observacion TEXT NULL,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      audit_usu_id VARCHAR(255) NULL,
      audit_ip VARCHAR(100) NULL,
      audit_dep_id VARCHAR(100) NULL,
      INDEX idx_fam_solicitud (registro_solicitud_id),
      INDEX idx_fam_paciente (paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ Tabla historia_antecedente_familiar lista');

  console.log('--- FASE 1 COMPLETADA CON ÉXITO ---');
  await conn.end();
}

runMigration().catch(err => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});

