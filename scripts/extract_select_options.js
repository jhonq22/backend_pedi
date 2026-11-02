const fs = require('fs');

const html = fs.readFileSync('temp_pane_examen.html', 'utf8');

const selectRegex = /<select[^>]+(?:id|name)=["']([^"']+)["'][^>]*>(.*?)<\/select>/gis;
let match;
const selects = {};
while ((match = selectRegex.exec(html)) !== null) {
  const id = match[1];
  const body = match[2];
  const optionRegex = /<option[^>]*value=["']([^"']*)["'][^>]*>(.*?)<\/option>/gis;
  let oMatch;
  const options = [];
  while ((oMatch = optionRegex.exec(body)) !== null) {
    options.push({ value: oMatch[1], text: oMatch[2].trim() });
  }
  selects[id] = options;
}

fs.writeFileSync('temp_select_options.json', JSON.stringify(selects, null, 2), 'utf8');
console.log(`Found ${Object.keys(selects).length} select elements with options.`);

// Let's print some key select options
for (const [key, opts] of Object.entries(selects)) {
  console.log(`- ${key} (${opts.length} options): ${opts.map(o => o.text).join(' | ')}`);
}

