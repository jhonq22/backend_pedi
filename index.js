// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Configuración de variables de entorno
dotenv.config();

// Importar rutas principales del sistema
const userRoutes = require('./routes/userRoutes');
const archivoRoutes = require('./routes/archivoRoutes');
const catalogoRoutes = require('./routes/catalogoRoutes');
const agendaRoutes = require('./routes/agendaRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const antecedenteRoutes = require('./routes/antecedenteRoutes');
const examenFisicoRoutes = require('./routes/examenFisicoRoutes');
const radiografiaRoutes = require('./routes/radiografiaRoutes');
const cateterismoRoutes = require('./routes/cateterismoRoutes');
const cirugiaRoutes = require('./routes/cirugiaRoutes');
const laboratorioRoutes = require('./routes/laboratorioRoutes');
const evolucionRoutes = require('./routes/evolucionRoutes');
const egresoRoutes = require('./routes/egresoRoutes');
const solicitudRoutes = require('./routes/solicitudRoutes');
const dptRoutes = require('./routes/dptRoutes');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas de la API REST
app.use('/api/users', userRoutes);
app.use('/api/archivos', archivoRoutes);
app.use('/api/catalogos', catalogoRoutes);
app.use('/api/dpt', dptRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/pacientes', antecedenteRoutes);
app.use('/api/pacientes', examenFisicoRoutes);
app.use('/api/solicitudes', solicitudRoutes);
app.use('/api/solicitudes', antecedenteRoutes);
app.use('/api/solicitudes', examenFisicoRoutes);
app.use('/api/radiografias', radiografiaRoutes);
app.use('/api/cateterismos', cateterismoRoutes);
app.use('/api/cirugias', cirugiaRoutes);
app.use('/api/laboratorios', laboratorioRoutes);
app.use('/api/evoluciones', evolucionRoutes);
app.use('/api/egresos', egresoRoutes);

// Ruta base para comprobación de estado y documentación de endpoints
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        sistema: 'HCI Pediátrico Integral API',
        version: '1.0.0',
        endpoints: [
            '/api/users',
            '/api/archivos',
            '/api/catalogos',
            '/api/agenda',
            '/api/pacientes',
            '/api/pacientes/:id/antecedentes',
            '/api/pacientes/:id/examen-fisico',
            '/api/radiografias',
            '/api/cateterismos',
            '/api/cirugias',
            '/api/laboratorios',
            '/api/evoluciones',
            '/api/egresos'
        ]
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor backend HCI Pediatría corriendo en http://localhost:${PORT}`);
});