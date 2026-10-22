const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '../hcil_agenda_identificacion_v17.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const needle = "pane_laboratorios";
let idx = 0;
const occurrences = [];
while ((idx = html.indexOf(needle, idx)) !== -1) {
    occurrences.push(idx);
    idx += needle.length;
}
console.log('Occurrences of pane_laboratorios:', occurrences);

// Let's examine each occurrence
for (const pos of occurrences) {
    const start = Math.max(0, pos - 80);
    const end = Math.min(html.length, pos + 120);
    console.log(`Pos ${pos}:\n${html.substring(start, end).replace(/\n/g, ' ')}\n---`);
}

// Occurrence 3 is at 888716: const ROOT=document.getElementById('pane_laboratorios');
const jsPos = occurrences.find(p => p > 800000);
if (jsPos) {
    const scriptStart = html.lastIndexOf('<script', jsPos);
    const scriptEnd = html.indexOf('</script>', jsPos);
    console.log('Script boundaries:', scriptStart, scriptEnd, 'length:', scriptEnd - scriptStart);
    const scriptContent = html.substring(scriptStart, scriptEnd + 9);
    fs.writeFileSync(path.resolve(__dirname, 'lab_script_complete.js'), scriptContent);
    console.log('Saved lab_script_complete.js, size:', scriptContent.length);
}
