const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');

async function inspect() {
  const [tables] = await db.query('SHOW TABLES');
  console.log('=== TABLAS EN MYSQL pediatrico ===');
  const tableNames = tables.map(t => Object.values(t)[0]);
  console.log(tableNames.join(', '));

  const targetTables = [
    'paciente',
    'paciente_contacto_responsable',
    'registro_solicitud',
    'roles',
    'users',
    'lista_centro_salud',
    'laboratorio_estudio'
  ];

  for (const tbl of targetTables) {
    if (tableNames.includes(tbl)) {
      console.log(`\n--- DESCRIBE ${tbl} ---`);
      const [cols] = await db.query(`DESCRIBE ${tbl}`);
      cols.forEach(c => console.log(`  ${c.Field} | ${c.Type} | Null:${c.Null} | Key:${c.Key} | Def:${c.Default}`));
    } else {
      console.log(`\n--- TABLA NO EXISTE: ${tbl} ---`);
    }
  }

  console.log('\n--- ROLES ---');
  const [roles] = await db.query('SELECT * FROM roles');
  console.log(roles);

  console.log('\n--- CENTROS DE SALUD ---');
  const [centros] = await db.query('SELECT * FROM lista_centro_salud');
  console.log(centros);

  process.exit(0);
}

inspect().catch(err => { console.error(err); process.exit(1); });
