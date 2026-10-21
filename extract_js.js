const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/hcil_agenda_identificacion_v17.html', 'utf8');

const scriptStart = content.indexOf('<script>');
const script = content.substring(scriptStart);

const paneIdx = script.indexOf('pane_examen');
// Look backward to find where the Examen config starts
const srcStart = script.lastIndexOf('const SRC', paneIdx);
console.log('srcStart:', srcStart, 'paneIdx:', paneIdx);

// Extract around 15000 characters from srcStart
const extracted = script.substring(srcStart, paneIdx + 8000);
fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/examen_js_extracted.js', extracted);
console.log('Saved examen_js_extracted.js');
