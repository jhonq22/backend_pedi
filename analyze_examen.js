const fs = require('fs');

const html = fs.readFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/pane_examen_full.html', 'utf8');

// Parse tabs
const tabRegex = /<div class="[^"]*ex-tab-pane[^"]*"[^>]*data-ex-tab="([^"]+)"[^>]*>([\s\S]*?)(?=(?:<div class="[^"]*ex-tab-pane|$))/g;

let tabMatch;
const tabs = [];

while ((tabMatch = tabRegex.exec(html)) !== null) {
    const tabKey = tabMatch[1];
    const tabHtml = tabMatch[2];
    
    // Extract tab title
    const titleMatch = /<h3>([^<]+)<\/h3>/i.exec(tabHtml);
    const tabTitle = titleMatch ? titleMatch[1].trim() : tabKey;

    // Extract sections inside tab
    const secRegex = /<section class="[^"]*ex-card[^"]*">([\s\S]*?)(?=(?:<section class="[^"]*ex-card|$))/g;
    let secMatch;
    const sections = [];

    while ((secMatch = secRegex.exec(tabHtml)) !== null) {
        const secHtml = secMatch[1];
        const secTitleMatch = /<h3>([^<]+)<\/h3>/i.exec(secHtml);
        const secTitle = secTitleMatch ? secTitleMatch[1].trim() : 'General';

        // Extract fields in this section
        // Fields typically have data-ex-wrap or data-ex-field or <label>
        const fieldRegex = /<div class="[^"]*ex-field[^"]*"[^>]*data-ex-wrap="([^"]+)"[^>]*>([\s\S]*?)(?=(?:<div class="[^"]*ex-field[^"]*"[^>]*data-ex-wrap=|$))/g;
        let fMatch;
        const fields = [];

        while ((fMatch = fieldRegex.exec(secHtml)) !== null) {
            const fieldName = fMatch[1];
            const fieldHtml = fMatch[2];
            const labelMatch = /<label[^>]*>([\s\S]*?)<\/label>/i.exec(fieldHtml);
            let label = labelMatch ? labelMatch[1].replace(/<[^>]+>/g, '').trim() : fieldName;

            let type = 'text';
            if (fieldHtml.includes('type="number"')) type = 'number';
            else if (fieldHtml.includes('<select')) type = 'select';
            else if (fieldHtml.includes('<textarea')) type = 'textarea';
            else if (fieldHtml.includes('type="checkbox"')) type = 'checkbox';
            else if (fieldHtml.includes('class="ex-derived"')) type = 'derived';

            // Extract select options if any
            let options = [];
            if (type === 'select') {
                const optRegex = /<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/gi;
                let optMatch;
                while ((optMatch = optRegex.exec(fieldHtml)) !== null) {
                    options.push({ value: optMatch[1], label: optMatch[2].trim() });
                }
            }

            // Extract radio/checkbox choices if any
            let choices = [];
            const choiceRegex = /<label[^>]*class="[^"]*ex-chip[^"]*"[^>]*>[\s\S]*?<input[^>]*value="([^"]*)"[^>]*>[\s\S]*?<\/label>/gi;
            let cMatch;
            while ((cMatch = choiceRegex.exec(fieldHtml)) !== null) {
                choices.push(cMatch[1]);
            }

            fields.push({
                name: fieldName,
                label,
                type,
                optionsCount: options.length,
                options: options.slice(0, 5),
                choices
            });
        }

        // Also check for matrices (like reflex matrix or other table/matrix)
        const matrixMatches = [];
        const matrixRegex = /<div class="[^"]*ex-matrix-wrap[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        let mMatch;
        while ((mMatch = matrixRegex.exec(secHtml)) !== null) {
            matrixMatches.push(mMatch[1].substring(0, 200));
        }

        sections.push({
            title: secTitle,
            fieldsCount: fields.length,
            fields,
            hasMatrix: matrixMatches.length > 0
        });
    }

    tabs.push({
        tabKey,
        tabTitle,
        sectionsCount: sections.length,
        sections
    });
}

console.log('Parsed tabs:', tabs.length);
fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/examen_analysis.json', JSON.stringify(tabs, null, 2));

tabs.forEach(t => {
    console.log(`\n=== TAB: ${t.tabTitle} (${t.tabKey}) ===`);
    t.sections.forEach(s => {
        console.log(`  Section: ${s.title} (${s.fieldsCount} fields${s.hasMatrix ? ', with matrix' : ''})`);
        s.fields.forEach(f => {
            console.log(`    - [${f.type}] ${f.name} ("${f.label}")`);
        });
    });
});
