const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 1, email: 'admin@pediatria.com' }, process.env.JWT_SECRET || 'secret_key_123');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/egresos' + path,
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
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
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
  const listRes = await request('GET', '?paciente_id=1');
  console.log('GET /api/egresos status:', listRes.status, 'body:', listRes.body, 'raw:', listRes.raw);

  const seedRes = await request('POST', '/seed-demo', { paciente_id: 1 });
  console.log('POST /api/egresos/seed-demo status:', seedRes.status, 'body:', seedRes.body, 'raw:', seedRes.raw);
}

run();
