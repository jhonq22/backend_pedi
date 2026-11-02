const fs = require('fs');

const html = fs.readFileSync('temp_pane_examen.html', 'utf8');

// Find tab panes
// Let's find IDs matching tab or subpane
const tabRegex = /id=["'](ex_tab_\w+|tab_\w+|pane_\w+)["']/gi;
let match;
const tabIds = [];
while ((match = tabRegex.exec(html)) !== null) {
  tabIds.push(match[1]);
}
console.log('Tab pane IDs found:', tabIds);

// If not with id="ex_tab_...", let's search data-tab or class="tab-pane"
const tabPanes = [...html.matchAll(/class=["'][^"']*tab-pane[^"']*["'][^>]*id=["']([^"']+)["']/gi)];
console.log('Tab-panes found:', tabPanes.map(t => t[1]));

// Or search role="tabpanel"
const roleTabs = [...html.matchAll(/role=["']tabpanel["'][^>]*id=["']([^"']+)["']/gi)];
console.log('Role tabpanels found:', roleTabs.map(t => t[1]));

