const fs = require('fs');

const html = fs.readFileSync('temp_pane_examen.html', 'utf8');

const tabIds = [
  'ex_tab_vitals',
  'ex_tab_general',
  'ex_tab_auscult',
  'ex_tab_other',
  'ex_tab_neuro1',
  'ex_tab_neuro2',
  'ex_tab_neuro3',
  'ex_tab_neuro4'
];

const tabsData = {};

for (let i = 0; i < tabIds.length; i++) {
  const currentId = tabIds[i];
  const nextId = tabIds[i + 1] || 'ex_tab_caption';
  
  const start = html.indexOf(`id="${currentId}"`);
  const end = html.indexOf(`id="${nextId}"`);
  
  const tabContent = html.substring(start, end !== -1 ? end : start + 30000);
  
  // Extract inputs/selects/textareas in this tab
  const fieldRegex = /<(input|select|textarea)[^>]+(?:id|name)=["']([^"']+)["'][^>]*>/gi;
  let match;
  const fields = [];
  while ((match = fieldRegex.exec(tabContent)) !== null) {
    const full = match[0];
    const typeMatch = full.match(/type=["']([^"']+)["']/i);
    const type = typeMatch ? typeMatch[1] : match[1];
    const placeholderMatch = full.match(/placeholder=["']([^"']+)["']/i);
    fields.push({
      id: match[2],
      tag: match[1],
      type,
      placeholder: placeholderMatch ? placeholderMatch[1] : ''
    });
  }

  // Extract labels
  const labelRegex = /<label[^>]*>(.*?)<\/label>/gis;
  const labels = [];
  let lMatch;
  while ((lMatch = labelRegex.exec(tabContent)) !== null) {
    const text = lMatch[1].replace(/<[^>]+>/g, '').trim();
    if (text) labels.push(text);
  }

  tabsData[currentId] = {
    length: tabContent.length,
    fields,
    labels: [...new Set(labels)]
  };
}

fs.writeFileSync('temp_tabs_summary.json', JSON.stringify(tabsData, null, 2), 'utf8');

for (const [id, data] of Object.entries(tabsData)) {
  console.log(`\n=== TAB: ${id} ===`);
  console.log(`Field count: ${data.fields.length}`);
  console.log('Fields:', data.fields.map(f => `${f.id} (${f.type})`).join(', '));
}

