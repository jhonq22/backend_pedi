const fs = require('fs');

const html = fs.readFileSync('temp_pane_examen.html', 'utf8');

// Find all cards or section titles
const cardMatches = [...html.matchAll(/<(?:div|section)[^>]*class="[^"]*(?:card|panel|accordion|bg-white|border)[^"]*"[^>]*>/gi)];
console.log('Cards count:', cardMatches.length);

// Let's find all headers: h1, h2, h3, h4, h5, legend, strong
const headerMatches = [...html.matchAll(/<(h[1-6]|legend|strong|label)[^>]*>(.*?)<\/\1>/gi)];
console.log('Headers / Labels count:', headerMatches.length);

// Let's find sections or groups (e.g. "1.", "2.", "3.", etc.)
const sectionTitles = [];
const secRegex = /<(?:h\d|div|span)[^>]*>(\s*(?:\d+[\.\)]|[A-Z][\.\)]|[IVXLCDM]+[\.\)])\s*[^<]+)<\/(?:h\d|div|span)>/gi;
let m;
while ((m = secRegex.exec(html)) !== null) {
  sectionTitles.push(m[1].trim());
}
console.log('Numbered sections in HTML:', sectionTitles);

// Let's search for tabs or nav items in pane_examen
const navMatches = [...html.matchAll(/<(?:button|a|li)[^>]*class="[^"]*(?:nav-link|tab|pill)[^"]*"[^>]*>(.*?)<\/(?:button|a|li)>/gi)];
console.log('Tab/nav buttons:', navMatches.map(n => n[1].replace(/<[^>]+>/g, '').trim()));

