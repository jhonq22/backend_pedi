const fs = require('fs');
const db = require('./config/db');

(async () => {
    try {
        const content = fs.readFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/hcil_agenda_identificacion_v17.html', 'utf8');
        const p = content.indexOf('const SRC=', 550000);
        const p2 = content.indexOf('const EX=', p);
        const srcJsonStr = content.substring(p + 'const SRC='.length, p2).trim().replace(/;$/, '');
        const SRC = JSON.parse(srcJsonStr);
        
        console.log('SRC Examen parsed successfully! Total spec items:', SRC.spec.length);
        console.log('Groups (tabs):', SRC.groups.map(g => g.title + ' (' + g.key + ')'));
        
        const [dbCols] = await db.query('DESCRIBE historia_examen_fisico');
        const dbColMap = new Set(dbCols.map(c => c.Field.toLowerCase()));
        
        console.log('Existing DB columns in historia_examen_fisico:', dbColMap.size);
        
        fs.writeFileSync('c:/Users/Jhon de quesada/Documents/proyectos/pediatria/backend/src_examen_parsed.json', JSON.stringify(SRC, null, 2));
        console.log('Saved src_examen_parsed.json');
        
        process.exit(0);
    } catch (e) {
        console.error('Error in comparison:', e);
        process.exit(1);
    }
})();
