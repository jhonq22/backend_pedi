const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.resolve(__dirname, 'lab_script_complete.js'), 'utf8');

// Find all function names defined in the script
const fnRegex = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
let m;
const functions = [];
while ((m = fnRegex.exec(script)) !== null) {
    functions.push(m[1]);
}
console.log('Functions in lab_script_complete.js:', functions);

// Find render functions specifically
const renderFns = functions.filter(f => f.startsWith('render'));
console.log('Render functions:', renderFns);

// Let's inspect the code for renderGas, renderMicro, renderBank, renderReview
for (const fn of renderFns) {
    const fnStart = script.indexOf('function ' + fn);
    if (fnStart !== -1) {
        const fnSnippet = script.substring(fnStart, fnStart + 1500);
        console.log(`\n=== FUNCTION ${fn} ===`);
        console.log(fnSnippet.substring(0, 1000));
    }
}
