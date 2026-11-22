const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');

async function check() {
  const [ver] = await db.query('SELECT VERSION() as version');
  console.log('DB Version:', ver[0].version);
  const [solicitudes] = await db.query('SELECT id, paciente_id, centro_salud_id, estatus FROM registro_solicitud');
  console.log('Solicitudes existentes:', solicitudes);
  process.exit(0);
}
check();
