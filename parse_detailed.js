const fs = require('fs');

const html = fs.readFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/pane_examen_full.html', 'utf8');

// Parse tabs
const tabRegex = /<div class="[^"]*ex-tab-pane[^"]*"[^>]*data-ex-tab="([^"]+)"[^>]*>([\s\S]*?)(?=(?:<div class="[^"]*ex-tab-pane|$))/g;

let tabMatch;
const allFields = [];

while ((tabMatch = tabRegex.exec(html)) !== null) {
    const tabKey = tabMatch[1];
    const tabHtml = tabMatch[2];
    
    // Find all inputs, selects, textareas
    // Regex for inputs with id="exam_..." or data-ex-field="..."
    const elementRegex = /<(input|select|textarea|div)[^>]+(?:data-ex-field="([^"]+)"|id="(exam_[^"]+)"|class="[^"]*ex-derived[^"]*"[^>]*data-ex-display="([^"]+)")([\s\S]*?)<\/(?:select|textarea|div>|\s*)/gi;
    
    // Better: let's match each ex-field or matrix row
    // Also capture all fields in data-ex-wrap="fieldName"
    const wrapRegex = /<div class="[^"]*ex-field[^"]*"[^>]*data-ex-wrap="([^"]+)"[^>]*>([\s\S]*?)(?=(?:<div class="[^"]*ex-field[^"]*"[^>]*data-ex-wrap=|<\/div>\s*<\/section>))/g;
    
    let wMatch;
    while ((wMatch = wrapRegex.exec(tabHtml)) !== null) {
        const wrapName = wMatch[1];
        const inner = wMatch[2];
        
        const labelM = /<label[^>]*>([\s\S]*?)<\/label>/i.exec(inner);
        const label = labelM ? labelM[1].replace(/<[^>]+>/g, '').trim() : wrapName;
        
        let type = 'text';
        if (inner.includes('<select')) type = 'select';
        else if (inner.includes('<textarea')) type = 'textarea';
        else if (inner.includes('type="number"')) type = 'number';
        else if (inner.includes('type="checkbox"')) type = 'checkbox';
        else if (inner.includes('class="ex-derived"')) type = 'derived';
        
        let options = [];
        if (type === 'select') {
            const optR = /<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/gi;
            let om;
            while ((om = optR.exec(inner)) !== null) {
                options.push({ val: om[1], txt: om[2].trim() });
            }
        }
        
        let choices = [];
        const chR = /<input[^>]*type="checkbox"[^>]*value="([^"]*)"[^>]*>[\s\S]*?<span>([^<]*)<\/span>/gi;
        let cm;
        while ((cm = chR.exec(inner)) !== null) {
            choices.push({ val: cm[1], txt: cm[2].trim() });
        }
        
        allFields.push({
            tab: tabKey,
            field: wrapName,
            label,
            type,
            options,
            choices
        });
    }
}

console.log('Total extracted wrapped fields:', allFields.length);
fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/all_examen_fields_detailed.json', JSON.stringify(allFields, null, 2));

// Also let's inspect the matrices in tabs:
// Tab neuro2: Pares craneales (matriz)
// Tab neuro3: Reflejos osteotendinosos (matriz)
// Tab neuro4: Evaluación especial del lactante (matriz reflejos primitivos)
const cranialMatrixMatch = /<div class="ex-matrix-wrap" id="ex_cn_matrix">([\s\S]*?)<\/div>/i.exec(html);
if (cranialMatrixMatch) {
    console.log('Found Cranial Matrix! length:', cranialMatrixMatch[1].length);
    fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/cranial_matrix.html', cranialMatrixMatch[1]);
}

const reflexMatrixMatch = /<div class="ex-matrix-wrap" id="ex_reflex_matrix">([\s\S]*?)<\/div>/i.exec(html);
if (reflexMatrixMatch) {
    console.log('Found Reflex Matrix! length:', reflexMatrixMatch[1].length);
    fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/reflex_matrix.html', reflexMatrixMatch[1]);
}

const primitiveReflexMatch = /<div class="ex-matrix-wrap" id="ex_primitive_matrix">([\s\S]*?)<\/div>/i.exec(html);
if (primitiveReflexMatch) {
    console.log('Found Primitive Reflex Matrix! length:', primitiveReflexMatch[1].length);
    fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/primitive_matrix.html', primitiveReflexMatch[1]);
}
