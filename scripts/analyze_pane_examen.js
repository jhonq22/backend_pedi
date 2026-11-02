const fs = require('fs');

const html = fs.readFileSync('temp_pane_examen.html', 'utf8');

// Find all inputs, selects, textareas with id or name
const re = /<(input|select|textarea)[^>]+(?:id|name)=["']([^"']+)["'][^>]*>/gi;
let match;
const fields = [];
while ((match = re.exec(html)) !== null) {
  const tag = match[1];
  const idOrName = match[2];
  const full = match[0];
  const typeMatch = full.match(/type=["']([^"']+)["']/i);
  const type = typeMatch ? typeMatch[1] : tag;
  fields.push({ id: idOrName, tag, type });
}

console.log(`Total input/select/textarea fields in pane_examen: ${fields.length}`);

// Group by prefix or inspect unique IDs
const fieldIds = [...new Set(fields.map(f => f.id))];
console.log('Sample IDs (first 50):', fieldIds.slice(0, 50));
console.log('Sample IDs (50-100):', fieldIds.slice(50, 100));
console.log('Sample IDs (100-150):', fieldIds.slice(100, 150));
console.log('Sample IDs (150-200):', fieldIds.slice(150, 200));
console.log('Sample IDs (200+):', fieldIds.slice(200));

fs.writeFileSync('temp_pane_examen_fields.json', JSON.stringify(fields, null, 2), 'utf8');

