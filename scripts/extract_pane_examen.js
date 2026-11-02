const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.');
const htmlFile = files.find(f => f.startsWith('HCIL') && f.endsWith('.html'));
if (!htmlFile) {
  console.error('HTML file not found!');
  process.exit(1);
}
console.log('Found file:', htmlFile);

const content = fs.readFileSync(htmlFile, 'utf8');

const marker = 'id="pane_examen"';
const start = content.indexOf(marker);
if (start === -1) {
  console.log('pane_examen marker not found!');
  process.exit(1);
}

// Find next pane
const nextPane = content.indexOf('id="pane_', start + marker.length);
console.log('pane_examen found at index:', start, 'next pane at:', nextPane);

const section = content.substring(start - 40, nextPane !== -1 ? nextPane : start + 100000);
fs.writeFileSync('temp_pane_examen.html', section, 'utf8');
console.log('temp_pane_examen.html written successfully, length:', section.length);
