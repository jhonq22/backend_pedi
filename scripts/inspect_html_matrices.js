const fs = require('fs');

const html = fs.readFileSync('temp_pane_examen.html', 'utf8');

const regexes = [
  /cranial/gi,
  /reflex/gi,
  /primitiv/gi,
  /gcs/gi,
  /apex_beat/gi,
  /thrill/gi
];

regexes.forEach(reg => {
  const matches = [...html.matchAll(reg)];
  console.log(`Matches for ${reg}: ${matches.length}`);
});

// Let's find snippets around 'cranial'
let idx = 0;
while ((idx = html.toLowerCase().indexOf('cranial', idx)) !== -1) {
  console.log('\n--- cranial match snippet ---');
  console.log(html.substring(Math.max(0, idx - 100), Math.min(html.length, idx + 250)));
  idx += 100;
  if (idx > 300000) break;
}

