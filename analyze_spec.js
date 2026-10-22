const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.resolve(__dirname, 'lab_script_complete.js'), 'utf8');

// Find SPEC definition
const specStart = script.indexOf('const SPEC=[');
const specEnd = script.indexOf('];', specStart);
const specJson = script.substring(specStart + 11, specEnd + 1);
const spec = JSON.parse(specJson);

console.log('Total SPEC items:', spec.length);

const categories = {};
for (const item of spec) {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
}

for (const cat in categories) {
    console.log(`\n=== Category: ${cat} (${categories[cat].length} items) ===`);
    for (const item of categories[cat]) {
        console.log(`  - ${item.key} | ${item.label} | ${item.type} | UI: ${item.ui} | Req: ${item.required}`);
    }
}
