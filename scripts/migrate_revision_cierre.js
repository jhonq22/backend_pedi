const db = require('../config/db');

async function migrateRevisionCierre() {
    try {
        console.log('Iniciando migración de tabla expediente_cierre (HCIL V15 / V17)...');

        const sql = `
        CREATE TABLE IF NOT EXISTS expediente_cierre (
            id INT AUTO_INCREMENT PRIMARY KEY,
            registro_solicitud_id INT NOT NULL,
            paciente_id INT NOT NULL,
            cierre_uuid VARCHAR(64) NOT NULL UNIQUE,
            fecha_cierre DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            estatus_cierre VARCHAR(50) NOT NULL DEFAULT 'Finalizado',
            profesional_responsable VARCHAR(150) NULL,
            observaciones_finales TEXT NULL,
            validaciones_superadas TINYINT(1) NOT NULL DEFAULT 1,
            resumen_integral_json LONGTEXT NULL,
            audit_usu_id VARCHAR(255) NULL,
            audit_ip VARCHAR(45) NULL,
            audit_dep_id VARCHAR(50) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ec_solicitud (registro_solicitud_id),
            INDEX idx_ec_paciente (paciente_id),
            INDEX idx_ec_uuid (cierre_uuid),
            CONSTRAINT fk_ec_solicitud FOREIGN KEY (registro_solicitud_id) REFERENCES registro_solicitud(id) ON DELETE CASCADE,
            CONSTRAINT fk_ec_paciente FOREIGN KEY (paciente_id) REFERENCES paciente(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
        `;

        await db.query(sql);
        console.log('✓ Tabla expediente_cierre creada exitosamente con soporte para auditoría integral y ROW_FORMAT=DYNAMIC.');
        process.exit(0);
    } catch (err) {
        console.error('Error durante la migración de expediente_cierre:', err);
        process.exit(1);
    }
}

migrateRevisionCierre();
