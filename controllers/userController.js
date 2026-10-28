const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. LOGIN
const login = async (req, res) => {
    const { usuario, password } = req.body;
    try {
        if (!usuario || !password) {
            return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
        }

        const [rows] = await db.query(
            `SELECT u.id, u.usuario, u.password, u.nombres, u.rol_id, u.estatus, r.rol 
             FROM users u 
             LEFT JOIN roles r ON u.rol_id = r.id 
             WHERE u.usuario = ?`,
            [usuario]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const user = rows[0];

        if (user.estatus === 0) {
            return res.status(403).json({ message: 'Usuario inactivo. Contacte al administrador' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        // Generar Token JWT
        const token = jwt.sign(
            {
                id: user.id,
                usuario: user.usuario,
                nombres: user.nombres,
                rol: user.rol,
                rol_id: user.rol_id
            },
            process.env.JWT_SECRET || 'secret_key_123',
            { expiresIn: '8h' }
        );

        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                usuario: user.usuario,
                nombres: user.nombres,
                rol: user.rol,
                rol_id: user.rol_id
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: error.message });
    }
};

// 2. CRUD: Crear Usuario
const createUser = async (req, res) => {
    const { usuario, password, nombres, rol_id, centro_salud_id } = req.body;
    try {
        if (!usuario || !password || !nombres) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios' });
        }

        // Verificar si el usuario ya existe
        const [existing] = await db.query('SELECT id FROM users WHERE usuario = ?', [usuario]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'El usuario o correo ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // El centro de salud se guarda null explícitamente según requerimiento
        const centroSaludFinal = centro_salud_id !== undefined ? centro_salud_id : null;

        const [result] = await db.query(
            'INSERT INTO users (usuario, password, nombres, rol_id, centro_salud_id, estatus) VALUES (?, ?, ?, ?, ?, 1)',
            [usuario, hashedPassword, nombres, rol_id || 2, centroSaludFinal]
        );

        res.status(201).json({ message: 'Usuario creado exitosamente', id: result.insertId });
    } catch (error) {
        console.error('Error creando usuario:', error);
        res.status(500).json({ error: error.message });
    }
};

// 3. Obtener Todos los Usuarios
const getUsers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                u.id, 
                u.usuario, 
                u.nombres, 
                u.rol_id, 
                u.centro_salud_id,
                r.rol, 
                u.estatus as estatus_usuario
            FROM users u 
            LEFT JOIN roles r ON u.rol_id = r.id
            ORDER BY u.id DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ error: error.message });
    }
};

// 4. Actualizar Usuario
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { nombres, rol_id, usuario, centro_salud_id } = req.body;
    try {
        const centroSaludFinal = centro_salud_id !== undefined ? centro_salud_id : null;
        await db.query(
            'UPDATE users SET nombres = ?, rol_id = ?, usuario = ?, centro_salud_id = ? WHERE id = ?',
            [nombres, rol_id, usuario, centroSaludFinal, id]
        );
        res.json({ message: 'Usuario actualizado correctamente' });
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        res.status(500).json({ error: error.message });
    }
};

// 5. Actualizar Contraseña
const updatePassword = async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    try {
        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
        res.json({ message: 'Contraseña actualizada con éxito' });
    } catch (error) {
        console.error('Error actualizando contraseña:', error);
        res.status(500).json({ error: error.message });
    }
};

// 6. Cambiar Estado / Desactivar Usuario
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        // Toggle de estatus (si está en 1 pasa a 0, si está en 0 pasa a 1)
        await db.query('UPDATE users SET estatus = IF(estatus = 1, 0, 1) WHERE id = ?', [id]);
        res.json({ message: 'Estado del usuario actualizado' });
    } catch (error) {
        console.error('Error cambiando estado de usuario:', error);
        res.status(500).json({ error: error.message });
    }
};

// 7. Obtener Roles Disponibles
const getRoles = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, rol FROM roles WHERE estatus = 1');
        res.json(rows);
    } catch (error) {
        // Si la tabla roles no existe o falla, devolver roles por defecto
        res.json([
            { id: 1, rol: 'Administrador' },
            { id: 2, rol: 'Usuario' }
        ]);
    }
};

module.exports = {
    login,
    createUser,
    getUsers,
    updateUser,
    updatePassword,
    deleteUser,
    getRoles
};