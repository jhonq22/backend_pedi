const db = require('../config/db');
const { seedDemoEvoluciones } = require('../controllers/evolucionController');

async function runSeed() {
    try {
        console.log('Sembrando evoluciones demo...');
        const req = {
            body: { paciente_id: 1, registro_solicitud_id: 1 },
            audit: { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' }
        };
        const res = {
            status: () => ({ json: (p) => console.log('Response status:', p) }),
            json: (p) => console.log('Response payload:', p)
        };
        await seedDemoEvoluciones(req, res);
        console.log('✓ Sembrado finalizado.');
        process.exit(0);
    } catch (e) {
        console.error('Error en seed:', e);
        process.exit(1);
    }
}

runSeed();
