const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('../config/cryptoUtils');

// 1. Subir Archivo
const uploadArchivo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ningún archivo' });
        }

        const persona_id = req.body.persona_id || req.usuario?.id || null;
        const nombre_archivo = req.file.originalname;
        const ruta_real = req.file.path;

        // Encriptar la ruta física del archivo
        const ruta_encriptada = encrypt(ruta_real);

        const [result] = await db.query(
            'INSERT INTO archivos (nombre_archivo, persona_id, ruta_archivo) VALUES (?, ?, ?)',
            [nombre_archivo, persona_id, ruta_encriptada]
        );

        res.status(201).json({
            message: 'Archivo guardado correctamente',
            id: result.insertId,
            archivo: {
                id: result.insertId,
                nombre_archivo: nombre_archivo,
                size: req.file.size
            }
        });
    } catch (error) {
        console.error('Error al subir archivo:', error);
        res.status(500).json({ error: error.message });
    }
};

// 2. Listar Todos los Archivos
const getArchivos = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, nombre_archivo, persona_id FROM archivos ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error('Error al listar archivos:', error);
        res.status(500).json({ error: error.message });
    }
};

// 3. Ver Archivo en Base64 (para visualización/preview en frontend)
const getArchivoBase64 = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM archivos WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Archivo no encontrado' });
        }

        const archivo = rows[0];
        const ruta_desencriptada = decrypt(archivo.ruta_archivo);

        if (fs.existsSync(ruta_desencriptada)) {
            const bitmap = fs.readFileSync(ruta_desencriptada);
            const base64 = Buffer.from(bitmap).toString('base64');
            const ext = path.extname(ruta_desencriptada).toLowerCase().replace('.', '');
            
            let mimeType = 'application/octet-stream';
            switch (ext) {
                case 'pdf': mimeType = 'application/pdf'; break;
                case 'png': mimeType = 'image/png'; break;
                case 'jpg': case 'jpeg': mimeType = 'image/jpeg'; break;
                case 'doc': case 'docx': mimeType = 'application/msword'; break;
                case 'xls': case 'xlsx': mimeType = 'application/vnd.ms-excel'; break;
                case 'txt': mimeType = 'text/plain'; break;
            }

            res.json({
                id: archivo.id,
                nombre: archivo.nombre_archivo,
                extension: ext,
                mime: mimeType,
                base64: `data:${mimeType};base64,${base64}`
            });
        } else {
            res.status(404).json({ message: 'Archivo físico no encontrado en servidor' });
        }
    } catch (error) {
        console.error('Error al obtener archivo:', error);
        res.status(500).json({ error: error.message });
    }
};

// 4. Descargar Archivo Directo
const descargarArchivo = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM archivos WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Archivo no encontrado' });
        }

        const archivo = rows[0];
        const ruta_desencriptada = decrypt(archivo.ruta_archivo);

        if (fs.existsSync(ruta_desencriptada)) {
            res.download(ruta_desencriptada, archivo.nombre_archivo);
        } else {
            res.status(404).json({ message: 'Archivo físico no encontrado' });
        }
    } catch (error) {
        console.error('Error descargando archivo:', error);
        res.status(500).json({ error: error.message });
    }
};

// 5. Eliminar Archivo
const eliminarArchivo = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM archivos WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Archivo no encontrado' });
        }

        const archivo = rows[0];
        const ruta_desencriptada = decrypt(archivo.ruta_archivo);

        if (fs.existsSync(ruta_desencriptada)) {
            try {
                fs.unlinkSync(ruta_desencriptada);
            } catch (err) {
                console.warn('No se pudo borrar archivo físico:', err.message);
            }
        }

        await db.query('DELETE FROM archivos WHERE id = ?', [id]);
        res.json({ message: 'Archivo eliminado correctamente' });
    } catch (error) {
        console.error('Error eliminando archivo:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    uploadArchivo,
    getArchivos,
    getArchivoBase64,
    descargarArchivo,
    eliminarArchivo
};