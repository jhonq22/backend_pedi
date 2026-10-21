const fs = require('fs');

const tabs = JSON.parse(fs.readFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/examen_analysis.json', 'utf8'));

let out = '';
tabs.forEach(t => {
    out += `\n=== TAB: ${t.tabTitle} (${t.tabKey}) ===\n`;
    t.sections.forEach(s => {
        out += `  Section: ${s.title} (${s.fieldsCount} fields${s.hasMatrix ? ', with matrix' : ''})\n`;
        s.fields.forEach(f => {
            out += `    - [${f.type}] ${f.name} ("${f.label}")\n`;
        });
    });
});

fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/examen_summary.txt', out, 'utf8');
console.log('Written examen_summary.txt');
