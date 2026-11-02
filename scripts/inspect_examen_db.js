const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');

async function run() {
  try {
    const [cols] = await db.query('DESCRIBE historia_examen_fisico');
    console.log('Columns of historia_examen_fisico:');
    cols.forEach(c => {
      console.log(`- ${c.Field} | ${c.Type} | Null: ${c.Null} | Default: ${c.Default}`);
    });

    const [catalogs] = await db.query("SELECT DISTINCT tipo FROM lista_tipo_general WHERE tipo LIKE '%examen%' OR tipo LIKE '%soporte%' OR tipo LIKE '%extremidad%' OR tipo LIKE '%ruido%' OR tipo LIKE '%pulso%'");
    console.log('\nRelevant catalog types in lista_tipo_general:');
    catalogs.forEach(ct => console.log(`- ${ct.tipo}`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
