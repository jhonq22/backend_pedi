const fs = require('fs');
const path = require('path');

const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'evolucion_spec.json'), 'utf8'));
const script = fs.readFileSync(path.resolve(__dirname, 'evolucion_script_complete.js'), 'utf8');

console.log('Total SPEC items:', spec.length);

// Extract categories
const categories = {};
for (const item of spec) {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
}
console.log('Categories count:', Object.keys(categories).length);
for (const cat in categories) {
    console.log(`\n=== Category: ${cat} (${categories[cat].length} items) ===`);
    for (const item of categories[cat]) {
        console.log(`  - ${item.key} | ${item.label} | ${item.type} | UI: ${item.ui} | Req: ${item.required}`);
    }
}

// Find TABS in script
const tabStart = script.indexOf('const TABS=[');
const tabEnd = script.indexOf('];', tabStart);
console.log('\nTABS definition:');
console.log(script.substring(tabStart, tabEnd + 2));

// Find sample or demo data
const sampleStart = script.indexOf('function sample(');
if (sampleStart !== -1) {
    console.log('\nSample function:');
    console.log(script.substring(sampleStart, sampleStart + 2000));
}
