const db = require('./config/db');

(async () => {
    try {
        // Test creating a table where all text fields are TEXT
        const sql = `CREATE TABLE test_ef (
            id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            registro_solicitud_id INT(11) NOT NULL,
            peso_kg DECIMAL(5,2) NULL,
            talla_cm DECIMAL(5,2) NULL,
            imc DECIMAL(5,2) NULL,
            superficie_corporal DECIMAL(5,3) NULL,
            frecuencia_cardiaca INT NULL,
            frecuencia_respiratoria INT NULL,
            saturacion_oxigeno INT NULL,
            presion_sistolica INT NULL,
            presion_diastolica INT NULL,
            glasgow_total INT NULL,
            perimetro_cefalico_cm DECIMAL(4,1) NULL,
            borde_hepatico_cm DECIMAL(4,1) NULL,
            llenado_capilar_segundos DECIMAL(3,1) NULL,

            -- Categories as JSON / TEXT for full modular fidelity
            seccion_vitals_json LONGTEXT NULL,
            seccion_general_json LONGTEXT NULL,
            seccion_auscultacion_json LONGTEXT NULL,
            seccion_other_json LONGTEXT NULL,
            seccion_neuro_global_json LONGTEXT NULL,
            seccion_pares_craneales_json LONGTEXT NULL,
            seccion_motricidad_json LONGTEXT NULL,
            seccion_sensibilidad_json LONGTEXT NULL,
            datos_completos_json LONGTEXT NULL,
            observacion_general TEXT NULL,

            fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            audit_usu_id VARCHAR(50) NULL,
            audit_ip VARCHAR(45) NULL,
            audit_dep_id VARCHAR(50) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;`;

        await db.query(`DROP TABLE IF EXISTS test_ef`);
        await db.query(sql);
        console.log('Test table created successfully!');
        await db.query(`DROP TABLE test_ef`);
        process.exit(0);
    } catch (e) {
        console.error('Test error:', e);
        process.exit(1);
    }
})();
