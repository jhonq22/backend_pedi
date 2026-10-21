const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/hcil_agenda_identificacion_v17.html', 'utf8');

const start = content.indexOf('id="pane_examen"');
const nextPanel = content.indexOf('class="panel"', start + 20);

console.log('pane_examen starts at:', start, 'next panel at:', nextPanel, 'diff:', nextPanel - start);
const examenHtml = content.substring(start, nextPanel);
fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/pane_examen_full.html', examenHtml);

// Find all data-ex-field or exam_ inputs
const fieldRegex = /(?:data-ex-field="([^"]+)"|id="(exam_[^"]+)")/g;
let match;
const fields = new Set();
while ((match = fieldRegex.exec(examenHtml)) !== null) {
    fields.add(match[1] || match[2]);
}
console.log('Total unique examen fields found in HTML:', fields.size);
fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/examen_fields.json', JSON.stringify(Array.from(fields), null, 2));

// Also let's find the JavaScript logic for examen in the HTML file
// Search for data structures or functions for examen in <script>
const scriptIdx = content.indexOf('<script');
const scriptContent = content.substring(scriptIdx);

// Look for exam or examen in script
const matchesInScript = [];
const scriptRegex = /(?:ex_|exam_|examen)/gi;
let sm;
let count = 0;
while ((sm = scriptRegex.exec(scriptContent)) !== null) {
    count++;
}
console.log('Total ex_/exam_/examen matches in script:', count);

// Let's find sections or comments in JS
let jsSections = [];
const commentRegex = /\/\*([^*]|\*(?!\/))*examen([^*]|\*(?!\/))*\*\//gi;
while ((match = commentRegex.exec(scriptContent)) !== null) {
    jsSections.push(match[0].substring(0, 100));
}
console.log('JS comments matching examen:', jsSections);
