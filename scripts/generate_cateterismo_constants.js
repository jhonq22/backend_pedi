// backend/scripts/generate_cateterismo_constants.js
const fs = require('fs');
const path = require('path');
const data = require('../cateterismo_data.json');

const catalogs = {};
for (const f of data.spec) {
    if (f.options && f.options.length) {
        catalogs[f.key] = f.options;
    }
}

// Catálogos adicionales de DATA.catalogs
if (data.catalogs) {
    for (const k in data.catalogs) {
        catalogs[k] = data.catalogs[k];
    }
}

const tabs = [
    { id: 'context', numero: '01', titulo: 'Episodio e indicación', icono: 'pi pi-calendar' },
    { id: 'preparation', numero: '02', titulo: 'Preparación y anestesia', icono: 'pi pi-user-edit' },
    { id: 'access', numero: '03', titulo: 'Accesos vasculares', icono: 'pi pi-compass' },
    { id: 'hemodynamics', numero: '04', titulo: 'Hemodinámica intracardíaca', icono: 'pi pi-chart-line' },
    { id: 'imaging', numero: '05', titulo: 'Imagen y radiación', icono: 'pi pi-camera' },
    { id: 'interventions', numero: '06', titulo: 'Intervenciones y terapéutica', icono: 'pi pi-wrench' },
    { id: 'reactivity', numero: '07', titulo: 'Vasorreactividad pulmonar', icono: 'pi pi-sliders-h' },
    { id: 'outcomes', numero: '08', titulo: 'Resultados y complicaciones', icono: 'pi pi-exclamation-triangle' },
    { id: 'closure', numero: '09', titulo: 'Cierre y conclusión', icono: 'pi pi-check-circle' }
];

const chambers = [
    'AD (Aurícula derecha)',
    'VD (Ventrículo derecho)',
    'AP tronco (Arteria pulmonar)',
    'Rama derecha AP',
    'Rama izquierda AP',
    'PCP (Capilar pulmonar en cuña)',
    'AI (Aurícula izquierda)',
    'VI (Ventrículo izquierdo)',
    'Aorta ascendente',
    'Aorta descendente',
    'VCS (Vena cava superior)',
    'VCI (Vena cava inferior)'
];

const interventionTypes = [
    'Valvuloplastia pulmonar con balón',
    'Valvuloplastia aórtica con balón',
    'Angioplastia de coartación aórtica',
    'Angioplastia de ramas pulmonares',
    'Implante de stent en coartación',
    'Implante de stent en ductus / RVOT',
    'Cierre percutáneo de CIA (Comunicación Interauricular)',
    'Cierre percutáneo de CIV (Comunicación Interventricular)',
    'Cierre percutáneo de Ductus (PCA)',
    'Atrioseptostomía con balón de Rashkind',
    'Embolización de vasos colaterales / fístula'
];

const complicationTypes = [
    'Arritmia que requirió tratamiento o cardioversión',
    'Paro cardíaco reanimado',
    'Disección arterial',
    'Trombosis arterial / pérdida de pulso',
    'Hematoma significativo en sitio de punción',
    'Pseudoaneurisma / Fístula arteriovenosa',
    'Sangrado mayor que requirió transfusión',
    'Perforación cardíaca / taponamiento pericárdico',
    'Embolización / desplazamiento de dispositivo',
    'Reacción alérgica a medio de contraste',
    'Fallecimiento',
    'Otra complicación'
];

const fileContent = `// Constantes y catálogos estructurados para Cateterismo Cardíaco Pediátrico (HCIL V17)
export const TABS_CATETERISMO = ${JSON.stringify(tabs, null, 2)};

export const CATALOGOS_CATETERISMO = ${JSON.stringify(catalogs, null, 2)};

export const CAMARAS_HEMODINAMIA_DEF = ${JSON.stringify(chambers, null, 2)};

export const TIPOS_INTERVENCION_DEF = ${JSON.stringify(interventionTypes, null, 2)};

export const TIPOS_COMPLICACION_DEF = ${JSON.stringify(complicationTypes, null, 2)};

export const CATETERISMO_SPEC_FIELDS = ${JSON.stringify(data.spec, null, 2)};
`;

const targetDir = path.resolve(__dirname, '../../front/src/constants');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}
const targetPath = path.join(targetDir, 'cateterismoCatalogos.js');
fs.writeFileSync(targetPath, fileContent, 'utf8');
console.log('✓ Archivo cateterismoCatalogos.js generado con éxito en:', targetPath);
