const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');
const fs = require('fs');

async function run() {
  const [cols] = await db.query('DESCRIBE historia_examen_fisico');
  const dbColNames = new Set(cols.map(c => c.Field.toLowerCase()));

  const fields = JSON.parse(fs.readFileSync('temp_pane_examen_fields.json', 'utf8'));
  const uniqueHtmlIds = [...new Set(fields.map(f => f.id))];

  console.log(`Unique HTML field IDs: ${uniqueHtmlIds.length}`);
  console.log(`DB table columns: ${dbColNames.size}`);

  const vueContent = fs.readFileSync('front/src/components/paciente/ExamenFisicoForm.vue', 'utf8');

  const report = [];
  for (const id of uniqueHtmlIds) {
    const cleanId = id.replace(/^exam_/, '');
    const inDbExact = dbColNames.has(id.toLowerCase());
    const inDbClean = dbColNames.has(cleanId.toLowerCase());
    const inVue = vueContent.includes(id) || vueContent.includes(cleanId);

    report.push({
      htmlId: id,
      cleanId,
      inDb: inDbExact ? id : (inDbClean ? cleanId : false),
      inVue
    });
  }

  const missingInDb = report.filter(r => !r.inDb);
  const missingInVue = report.filter(r => !r.inVue);

  console.log('\n--- Missing in DB (Total: ' + missingInDb.length + ') ---');
  missingInDb.forEach(m => console.log(`- ${m.htmlId} (clean: ${m.cleanId}) [In Vue: ${m.inVue}]`));

  console.log('\n--- Missing in Vue (Total: ' + missingInVue.length + ') ---');
  missingInVue.forEach(m => console.log(`- ${m.htmlId} (inDb: ${m.inDb})`));

  process.exit(0);
}

run();

