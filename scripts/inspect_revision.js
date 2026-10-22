const fs = require('fs');
const content = fs.readFileSync('hcil_agenda_identificacion_v17.html', 'utf8');

const idx = content.indexOf('let errors=validate(false)');
if (idx !== -1) {
  console.log(content.slice(Math.max(0, idx - 800), idx + 1200));
}
