// backend/scripts/generate_radiografias_constants.js
const fs = require('fs');
const path = require('path');
const spec = require('../xray_spec.json');

const catalogs = {};
for (const f of spec.all) {
    if (f.options && f.options.length) {
        catalogs[f.key] = f.options;
    }
}

const tabs = [
    { id: 'context', numero: '01', titulo: 'Estudio e indicación', icono: 'pi pi-calendar' },
    { id: 'quality', numero: '02', titulo: 'Técnica radiológica', icono: 'pi pi-sliders-h' },
    { id: 'lung', numero: '03', titulo: 'Parénquima y edema', icono: 'pi pi-cloud' },
    { id: 'pleura', numero: '04', titulo: 'Pleura y mediastino', icono: 'pi pi-compass' },
    { id: 'heart', numero: '05', titulo: 'Corazón y vasos', icono: 'pi pi-heart' },
    { id: 'devices', numero: '06', titulo: 'Dispositivos y líneas', icono: 'pi pi-bolt' },
    { id: 'other', numero: '07', titulo: 'Otros y conclusión', icono: 'pi pi-file-check' }
];

const fileContent = `// Constantes y catálogos estructurados para Radiografías de Tórax Pediátricas (HCIL V17)
export const TABS_RADIOGRAFIA = ${JSON.stringify(tabs, null, 2)};

export const CATALOGOS_RADIOGRAFIA = ${JSON.stringify(catalogs, null, 2)};

export const DEVICE_FIELDS_DEF = ${JSON.stringify(spec.deviceFields, null, 2)};

export const XRAY_FIELDS_SPEC = ${JSON.stringify(spec.xrayFields, null, 2)};
`;

const targetDir = path.resolve(__dirname, '../../front/src/constants');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}
const targetPath = path.join(targetDir, 'radiografiasCatalogos.js');
fs.writeFileSync(targetPath, fileContent, 'utf8');
console.log('✓ Archivo radiografiasCatalogos.js generado con éxito en:', targetPath);
