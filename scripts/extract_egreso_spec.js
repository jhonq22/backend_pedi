const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../../hcil_agenda_identificacion_v17.html');
const content = fs.readFileSync(htmlPath, 'utf8');

// Extraer HCIL_DISCHARGE_SPEC
const startTag = 'const HCIL_DISCHARGE_SPEC=';
const startIdx = content.indexOf(startTag);
if (startIdx === -1) {
    console.error('No se encontró HCIL_DISCHARGE_SPEC');
    process.exit(1);
}

const endTag = ';\n(()=>{';
let endIdx = content.indexOf(endTag, startIdx);
if (endIdx === -1) {
    endIdx = content.indexOf('; (()=>{', startIdx);
}
if (endIdx === -1) {
    endIdx = content.indexOf(';\r\n(()=>{', startIdx);
}

const jsonStr = content.slice(startIdx + startTag.length, endIdx).trim();
const spec = JSON.parse(jsonStr);

console.log(`✓ Extraídos ${spec.length} campos del catálogo HCIL_DISCHARGE_SPEC`);

const outSpecPath = path.join(__dirname, '../egreso_spec.json');
fs.writeFileSync(outSpecPath, JSON.stringify(spec, null, 2), 'utf8');
console.log('✓ Guardado backend/egreso_spec.json');

// Extraer código JS del módulo
const scriptStartTag = content.indexOf('(()=>{', startIdx);
const scriptEndTag = content.indexOf('window.HCILDischarge=', scriptStartTag);
const scriptBlock = content.slice(scriptStartTag, scriptEndTag + 200);
fs.writeFileSync(path.join(__dirname, '../egreso_script_fragment.js'), scriptBlock, 'utf8');
console.log('✓ Guardado backend/egreso_script_fragment.js');
