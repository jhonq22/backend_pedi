// backend/test_lab_api.js
const db = require('./config/db');
const labController = require('./controllers/laboratorioController');

async function testApi() {
    try {
        console.log('Probando API de laboratorios...');

        // 1. Buscar una solicitud existente
        const [solicitudes] = await db.query('SELECT id, paciente_id FROM registro_solicitud LIMIT 1');
        let solId = solicitudes[0]?.id;
        let pacId = solicitudes[0]?.paciente_id;
        console.log('Solicitud encontrada:', solId, 'Paciente:', pacId);

        if (!solId) {
            console.log('No hay solicitudes, buscando paciente...');
            const [pacientes] = await db.query('SELECT id FROM paciente LIMIT 1');
            pacId = pacientes[0]?.id || 1;
        }

        // 2. Probar seedDemoLaboratorios
        const fakeReq = {
            body: {
                registro_solicitud_id: solId,
                paciente_id: pacId
            },
            audit: { audit_usu_id: '1', audit_ip: '127.0.0.1', audit_dep_id: '1' }
        };
        const fakeRes = {
            status: (code) => ({
                json: (data) => console.log(`Response [${code}]:`, data)
            }),
            json: (data) => console.log('Response [200]:', data)
        };

        console.log('Ejecutando seedDemoLaboratorios...');
        await labController.seedDemoLaboratorios(fakeReq, fakeRes);

        // 3. Consultar laboratorios
        console.log('Ejecutando getLaboratorios...');
        const fakeReqGet = {
            query: { registro_solicitud_id: solId, paciente_id: pacId }
        };
        const fakeResGet = {
            status: (code) => ({
                json: (data) => console.log(`Response [${code}]:`, data)
            }),
            json: (data) => {
                console.log('GetLaboratorios status:', data.status, 'Total estudios:', data.data?.length);
                for (const est of data.data) {
                    console.log(`- Estudio #${est.id} | Panel: ${est.lab_panel} | Fecha: ${est.collection_datetime} | Finalizado: ${est.finalized} | Analitos: ${est.lab_results?.length}`);
                    for (const r of est.lab_results) {
                        console.log(`    * ${r.test_name} (${r.test_code}): ${r.result_value_numeric} ${r.result_unit || ''}`);
                    }
                }
            }
        };
        await labController.getLaboratorios(fakeReqGet, fakeResGet);

        console.log('✓ Pruebas de API exitosas.');
        process.exit(0);
    } catch (err) {
        console.error('Error en pruebas de API:', err);
        process.exit(1);
    }
}

testApi();
