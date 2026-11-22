const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');

async function run() {
  const [tipos] = await db.query('SELECT tipo, COUNT(*) as cnt FROM lista_tipo_general WHERE estatus = 1 GROUP BY tipo ORDER BY tipo');
  console.log('=== lista_tipo_general tipos ===');
  tipos.forEach(t => console.log(`  ${t.tipo}: ${t.cnt}`));

  const [sampleTipos] = await db.query("SELECT id, tipo, nombre FROM lista_tipo_general WHERE tipo IN ('tipo_documento','sexo','parentesco','nacionalidad','tipo_cita','estatus_registro') AND estatus=1 ORDER BY tipo, orden, id");
  console.log('\n=== Sample catalogs ===');
  console.log(sampleTipos);

  const [users] = await db.query('SELECT id, usuario, nombres, rol_id, centro_salud_id, estatus FROM users');
  console.log('\n=== users ===');
  console.log(users);

  const [estados] = await db.query('SELECT COUNT(*) as cnt FROM estados');
  console.log('\n=== estados count ===', estados[0].cnt);

  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
