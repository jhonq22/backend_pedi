// backend/scripts/migrate_laboratorios.js
const db = require('../config/db');

async function migrateLaboratorios() {
    try {
        console.log('Iniciando migración de tablas de Laboratorios Clínicos (HCIL V12 / V17)...');

        // Desactivar temporalmente revisión de foreign keys para recreación limpia si es necesario
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('DROP TABLE IF EXISTS laboratorio_resultado');
        await db.query('DROP TABLE IF EXISTS laboratorio_estudio');
        await db.query('SET FOREIGN_KEY_CHECKS = 1');

        // 1. Tabla Cabecera: laboratorio_estudio (Estudios seriados por muestra y fecha)
        const sqlEstudio = `
        CREATE TABLE laboratorio_estudio (
            id INT AUTO_INCREMENT PRIMARY KEY,
            registro_solicitud_id INT NOT NULL,
            hospitalizacion_id INT NULL DEFAULT NULL,
            lab_study_id VARCHAR(64) NOT NULL UNIQUE,

            -- Identificación del Estudio (Tab 01)
            lab_panel VARCHAR(100) NOT NULL,
            lab_panel_other VARCHAR(150) NULL,
            lab_order_date DATE NULL,
            requesting_physician VARCHAR(150) NULL,

            -- Datos de la Muestra (Tab 01)
            collection_datetime DATETIME NULL,
            specimen_type VARCHAR(100) NOT NULL,
            specimen_type_other VARCHAR(150) NULL,
            specimen_site VARCHAR(150) NULL,
            specimen_site_other VARCHAR(150) NULL,
            fasting_status VARCHAR(50) NULL,
            sample_quality_json JSON NULL,
            sample_quality_notes TEXT NULL,

            -- Referencia Pediátrica Derivada
            age_at_collection_days INT NULL,
            age_at_collection_months INT NULL,
            reference_sex VARCHAR(20) NULL,

            -- Contexto Gasometría (Tab 03)
            blood_gas_type VARCHAR(50) NULL,
            fio2 VARCHAR(50) NULL,
            oxygen_support_gas VARCHAR(100) NULL,

            -- Microbiología e Infección (Tab 04)
            culture_type VARCHAR(100) NULL,
            culture_collection_date DATE NULL,
            culture_result VARCHAR(50) NULL,
            organism TEXT NULL,

            -- Banco de Sangre / Preoperatorio (Tab 05)
            abo_group VARCHAR(10) NULL,
            rh_factor VARCHAR(20) NULL,
            antibody_screen VARCHAR(50) NULL,
            crossmatch_status VARCHAR(50) NULL,

            -- Estado e Inmutabilidad (Tab 06)
            finalized TINYINT(1) NOT NULL DEFAULT 0,
            finalized_at DATETIME NULL,
            estatus_analisis VARCHAR(50) NOT NULL DEFAULT 'Borrador',
            critical_admin_events_json JSON NULL,
            datos_completos_json LONGTEXT NULL,

            -- Auditoría Estándar
            audit_usu_id VARCHAR(255) NULL,
            audit_ip VARCHAR(45) NULL,
            audit_dep_id VARCHAR(50) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_lab_solicitud (registro_solicitud_id),
            INDEX idx_lab_fecha (collection_datetime),
            INDEX idx_lab_panel (lab_panel),
            INDEX idx_lab_uuid (lab_study_id),
            CONSTRAINT fk_lab_solicitud FOREIGN KEY (registro_solicitud_id) REFERENCES registro_solicitud(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
        `;
        await db.query(sqlEstudio);
        console.log('✓ Tabla laboratorio_estudio creada exitosamente.');

        // 2. Tabla Hija: laboratorio_resultado (Analitos / Pruebas del Estudio)
        const sqlResultado = `
        CREATE TABLE laboratorio_resultado (
            id INT AUTO_INCREMENT PRIMARY KEY,
            laboratorio_estudio_id INT NOT NULL,
            lab_result_id VARCHAR(64) NOT NULL UNIQUE,
            analyte_key VARCHAR(100) NULL,
            test_code VARCHAR(100) NOT NULL,
            test_name VARCHAR(255) NOT NULL,
            loinc_code VARCHAR(50) NULL,
            result_type VARCHAR(20) NOT NULL DEFAULT 'NUMERIC',
            result_operator VARCHAR(10) NOT NULL DEFAULT '=',
            result_value_numeric DECIMAL(14,4) NULL,
            result_value_text VARCHAR(500) NULL,
            result_value_code VARCHAR(100) NULL,
            result_value_boolean TINYINT(1) NULL,
            result_unit VARCHAR(50) NULL,
            reference_lower DECIMAL(14,4) NULL,
            reference_upper DECIMAL(14,4) NULL,
            reference_text VARCHAR(255) NULL,
            reference_basis VARCHAR(255) NULL,
            reference_sex VARCHAR(20) NULL,
            abnormal_flag VARCHAR(50) NOT NULL DEFAULT 'Indeterminado',
            critical_flag TINYINT(1) NOT NULL DEFAULT 0,
            critical_status VARCHAR(50) NULL,
            result_method VARCHAR(150) NULL,
            result_source VARCHAR(50) NOT NULL DEFAULT 'Manual',
            result_validated TINYINT(1) NOT NULL DEFAULT 0,
            orden INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_res_estudio (laboratorio_estudio_id),
            INDEX idx_res_analyte (analyte_key),
            INDEX idx_res_critico (critical_flag),
            CONSTRAINT fk_res_estudio FOREIGN KEY (laboratorio_estudio_id) REFERENCES laboratorio_estudio(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        await db.query(sqlResultado);
        console.log('✓ Tabla laboratorio_resultado creada exitosamente.');

        console.log('Migración de base de datos de Laboratorios completada con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('Error durante la migración de laboratorios:', error);
        process.exit(1);
    }
}

migrateLaboratorios();
