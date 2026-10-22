const fs = require('fs');
const content = fs.readFileSync('hcil_agenda_identificacion_v17.html', 'utf8');

const regex = /<section[^>]*data-pane=[\"']([^\"']+)[\"'][^>]*>/g;
let m;
const panes = [];
while ((m = regex.exec(content)) !== null) {
  const start = m.index;
  const chunk = content.slice(start, start + 350);
  const h2 = /<h2>(.*?)<\/h2>/.exec(chunk);
  const icon = /<div class=[\"']panel-icon[\"']>([^<]+)<\/div>/.exec(chunk);
  panes.push({
    pane: m[1],
    number: icon ? icon[1] : '',
    title: h2 ? h2[1] : ''
  });
}
console.log('Paneles data-pane encontrados:', panes);
