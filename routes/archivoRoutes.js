// routes/archivoRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const archivoController = require('../controllers/archivoController');
const verificarToken = require('../middlewares/authMiddleware');
const fs = require('fs');
const path = require('path');

// Asegurar que la carpeta de destino exista
const dir = path.join(__dirname, '../archivos');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Formato: timestamp-nombreoriginal.ext
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${cleanName}`);
    }
});

// Filtro de tipos de archivo permitidos
const fileFilter = (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
        return cb(null, true);
    }
    cb(new Error("Formato no soportado. Formatos permitidos: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, TXT"));
};

// Configuración de Multer (límite 10MB)
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: fileFilter
});

// Rutas
router.post('/upload', verificarToken, (req, res, next) => {
    upload.single('archivo')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'El archivo excede el tamaño máximo permitido (10MB).' });
            }
            return res.status(400).json({ message: err.message });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
}, archivoController.uploadArchivo);

router.get('/', verificarToken, archivoController.getArchivos);
router.get('/ver/:id', verificarToken, archivoController.getArchivoBase64);
router.get('/descargar/:id', verificarToken, archivoController.descargarArchivo);
router.delete('/:id', verificarToken, archivoController.eliminarArchivo);

module.exports = router;