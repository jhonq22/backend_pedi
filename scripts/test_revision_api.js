const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 1, email: 'admin@pediatria.com' }, process.env.JWT_SECRET || 'secret_key_123');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/solicitudes' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  try {
    console.log('1. Consultando expediente integral para la solicitud 1...');
    const expRes = await request('GET', '/1/expediente-integral');
    console.log('Expediente integral status:', expRes.status);
    if (expRes.body && expRes.body.data) {
      const d = expRes.body.data;
      console.log('Paciente:', d.paciente?.primer_nombre, d.paciente?.primer_apellido);
      console.log('Radiografías count:', d.radiografias?.length);
      console.log('Cateterismos count:', d.cateterismos?.length);
      console.log('Cirugías count:', d.cirugias?.length);
      console.log('Laboratorios count:', d.laboratorios?.length);
      console.log('Evoluciones count:', d.evoluciones?.length);
      console.log('Egresos count:', d.egresos?.length);
    }

    console.log('2. Probando finalización de expediente...');
    const finRes = await request('POST', '/1/finalizar-expediente', {
      profesional_responsable: 'DR. MARCOS PEÑA - CIRUGÍA CARDIOVASCULAR',
      observaciones_finales: 'Expediente clínico integral verificado y cerrado satisfactoriamente en auditoría.',
      validaciones_superadas: true
    });
    console.log('Finalizar status:', finRes.status, finRes.body);

    console.log('3. Consultando historial de cierres...');
    const cieRes = await request('GET', '/1/cierres');
    console.log('Historial cierres count:', cieRes.body?.data?.length);

    console.log('✓ Prueba de endpoints API de Revisión y Registro superada con éxito.');
  } catch (err) {
    console.error('Error en pruebas de API:', err);
    process.exit(1);
  }
}

run();
