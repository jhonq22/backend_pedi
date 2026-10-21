// config/db.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Probar conexión (opcional, solo para ver en consola)
pool.getConnection()
    .then(connection => {
        pool.releaseConnection(connection);
        console.log('Base de datos conectada exitosamente.');
    })
    .catch(err => {
        console.error('Error conectando a la base de datos:', err);
    });

module.exports = pool;