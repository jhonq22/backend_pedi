const fs = require('fs');

const html = fs.readFileSync('temp_pane_examen.html', 'utf8');

const tableMatches = [...html.matchAll(/<table[^>]*>(.*?)<\/table>/gis)];
console.log(`Found ${tableMatches.length} tables in pane_examen:`);

tableMatches.forEach((t, i) => {
  const tableContent = t[1];
  const ths = [...tableContent.matchAll(/<th[^>]*>(.*?)<\/th>/gis)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const rows = [...tableContent.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)];
  console.log(`\nTable ${i + 1}: Headers: [${ths.join(' | ')}], Rows: ${rows.length}`);
});

