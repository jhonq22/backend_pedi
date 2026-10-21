const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/hcil_agenda_identificacion_v17.html', 'utf8');

const scriptStart = content.indexOf('<script>');
const script = content.substring(scriptStart);

// Let's find occurrences of ex_ in script
const matches = [];
let idx = 0;
while ((idx = script.indexOf('ex_', idx)) !== -1) {
    matches.push(idx);
    idx += 4;
}

console.log('Found ex_ in script:', matches.length);
if (matches.length > 0) {
    console.log('First occurrence context:');
    console.log(script.substring(matches[0] - 50, matches[0] + 300));
    console.log('Middle occurrence context:');
    console.log(script.substring(matches[Math.floor(matches.length / 2)] - 50, matches[Math.floor(matches.length / 2)] + 300));
}

// Find functions related to examen
const fnRegex = /function\s+([a-zA-Z0-9_]*exam[a-zA-Z0-9_]*|[a-zA-Z0-9_]*ex_[a-zA-Z0-9_]*)\s*\(/gi;
let fnMatch;
while ((fnMatch = fnRegex.exec(script)) !== null) {
    console.log('Found function:', fnMatch[1]);
}

// Let's search for "pane_examen" in script
let paneIdx = script.indexOf('pane_examen');
console.log('pane_examen in script:', paneIdx);
if (paneIdx !== -1) {
    console.log(script.substring(paneIdx - 50, paneIdx + 300));
}
