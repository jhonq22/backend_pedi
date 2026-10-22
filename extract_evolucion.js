const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../hcil_agenda_identificacion_v17.html'), 'utf8');

// 1. Extraer HTML pane_evoluciones
const startPane = html.indexOf('id="pane_evoluciones"');
const endPane = html.indexOf('<section class="panel"', startPane + 20);
console.log('Pane indices:', startPane, endPane);
const paneHtml = html.substring(startPane, endPane > 0 ? endPane : startPane + 40000);
fs.writeFileSync(path.resolve(__dirname, 'pane_evoluciones_extracted.html'), paneHtml);
console.log('Saved pane_evoluciones_extracted.html, length:', paneHtml.length);

// 2. Extraer CSS para dn-
const cssStart = html.indexOf('/* HCIL V13');
const cssEnd = html.indexOf('/* HCIL V', cssStart + 20);
console.log('CSS indices:', cssStart, cssEnd);
const cssCode = html.substring(cssStart, cssEnd > 0 ? cssEnd : cssStart + 20000);
fs.writeFileSync(path.resolve(__dirname, 'evolucion_styles.css'), cssCode);
console.log('Saved evolucion_styles.css, length:', cssCode.length);

// 3. Extraer SPEC (window.HCILDailySpec)
const specStart = html.indexOf('window.HCILDailySpec=[');
const specEnd = html.indexOf('];', specStart);
const specJson = html.substring(specStart + 'window.HCILDailySpec='.length, specEnd + 1);
fs.writeFileSync(path.resolve(__dirname, 'evolucion_spec.json'), specJson);
console.log('Saved evolucion_spec.json, length:', specJson.length);

// 4. Extraer script completo de HCILDaily (desde specStart hasta fin de bloque)
const scriptEnd = html.indexOf('window.HCILDaily={', specStart);
const closingScript = html.indexOf('</script>', scriptEnd);
const jsCode = html.substring(specStart, closingScript + 9);
fs.writeFileSync(path.resolve(__dirname, 'evolucion_script_complete.js'), jsCode);
console.log('Saved evolucion_script_complete.js, length:', jsCode.length);
