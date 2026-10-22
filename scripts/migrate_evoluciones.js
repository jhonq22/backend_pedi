// backend/scripts/migrate_evoluciones.js
const db = require('../config/db');

async function migrateEvoluciones() {
    try {
        console.log('Iniciando migración de tablas de Evolución Clínica Diaria (HCIL V13 / V17)...');

        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('DROP TABLE IF EXISTS evolucion_diaria');
        await db.query('SET FOREIGN_KEY_CHECKS = 1');

        const sql = `
        CREATE TABLE evolucion_diaria (
            id INT AUTO_INCREMENT PRIMARY KEY,
            registro_solicitud_id INT NOT NULL,
            hospitalizacion_id INT NULL DEFAULT NULL,
            daily_note_id VARCHAR(64) NOT NULL UNIQUE,
            encounter_id VARCHAR(64) NULL,
            intent VARCHAR(50) NOT NULL DEFAULT 'normal',
            parent_note_id VARCHAR(64) NULL,

            -- 01. Identificación y responsable (Tab 01)
            evolution_date DATE NOT NULL,
            evolution_time TIME NOT NULL,
            evaluation_period_start DATETIME NULL,
            evaluation_period_end DATETIME NULL,
            care_location VARCHAR(100) NULL,
            service VARCHAR(100) NULL,
            author_id VARCHAR(100) NULL,
            hospital_day INT NULL,
            postoperative_day INT NULL,
            postprocedure_day INT NULL,
            clinical_course_since_previous VARCHAR(50) NULL,
            significant_events_present VARCHAR(10) NULL,
            significant_events_summary TEXT NULL,

            -- 02. Estado clínico actual (Tab 02)
            general_condition VARCHAR(50) NULL,
            consciousness_status VARCHAR(50) NULL,
            pain_present VARCHAR(50) NULL,
            pain_scale VARCHAR(50) NULL,
            pain_score VARCHAR(20) NULL,
            current_symptoms_json JSON NULL,
            current_symptoms_other VARCHAR(250) NULL,
            clinical_status_summary TEXT NULL,

            -- 03. Antropometría y Signos vitales (Tab 03)
            weight_kg DECIMAL(6,2) NULL,
            weight_percentile VARCHAR(150) NULL,
            height_cm DECIMAL(6,1) NULL,
            height_percentile VARCHAR(150) NULL,
            bmi DECIMAL(5,2) NULL,
            bsa DECIMAL(5,2) NULL,
            heart_rate INT NULL,
            respiratory_rate INT NULL,
            oxygen_saturation INT NULL,
            oxygen_support VARCHAR(100) NULL,
            oxygen_flow DECIMAL(5,2) NULL,
            bp_extremity VARCHAR(50) NULL,
            bp_systolic INT NULL,
            bp_diastolic INT NULL,
            bp_percentile VARCHAR(150) NULL,

            -- 04. Cardiopulmonar (Tab 04)
            hemodynamic_status VARCHAR(50) NULL,
            cardiac_rhythm_status VARCHAR(50) NULL,
            perfusion_status_daily VARCHAR(50) NULL,
            cyanosis_status VARCHAR(50) NULL,
            edema_status VARCHAR(50) NULL,
            hepatomegaly_status VARCHAR(50) NULL,
            cardiovascular_daily_summary TEXT NULL,
            respiratory_status_daily VARCHAR(50) NULL,
            respiratory_support VARCHAR(100) NULL,
            fio2_current DECIMAL(4,2) NULL,
            respiratory_support_change VARCHAR(50) NULL,
            respiratory_daily_summary TEXT NULL,

            -- 05. Balance y Nutrición (Tab 05)
            intake_24h_ml DECIMAL(8,1) NULL,
            output_24h_ml DECIMAL(8,1) NULL,
            fluid_balance_24h_ml DECIMAL(8,1) NULL,
            urine_output_ml_kg_h DECIMAL(5,2) NULL,
            urine_volume_ml DECIMAL(8,1) NULL,
            urine_measure_hours DECIMAL(4,1) NULL,
            renal_status_daily VARCHAR(50) NULL,
            fluid_renal_summary TEXT NULL,
            nutrition_route_json JSON NULL,
            feeding_tolerance VARCHAR(50) NULL,
            nutrition_change_24h VARCHAR(50) NULL,
            nutrition_summary TEXT NULL,

            -- 06. Estudios y Procedimientos (Tab 06)
            new_labs_available VARCHAR(10) NULL,
            lab_result_ids_json JSON NULL,
            lab_clinical_interpretation TEXT NULL,
            lab_trend_status VARCHAR(50) NULL,
            new_imaging_performed VARCHAR(10) NULL,
            imaging_study_ids_json JSON NULL,
            control_chest_xray_performed TINYINT(1) DEFAULT 0,
            imaging_results_available VARCHAR(50) NULL,
            imaging_clinical_interpretation TEXT NULL,
            imaging_change_vs_prior VARCHAR(50) NULL,
            procedure_performed_24h VARCHAR(10) NULL,
            procedure_ids_json JSON NULL,
            major_procedure_present TINYINT(1) DEFAULT 0,
            procedure_tolerance VARCHAR(50) NULL,
            procedure_clinical_summary TEXT NULL,

            -- 07. Eventos, Medicación y Dispositivos (Tab 07)
            clinical_events_json JSON NULL,
            medication_changes_present VARCHAR(10) NULL,
            medication_change_type_json JSON NULL,
            medication_change_summary TEXT NULL,
            active_devices_json JSON NULL,
            device_change_24h VARCHAR(50) NULL,
            drain_output_24h_ml DECIMAL(8,1) NULL,
            drain_entries_json JSON NULL,
            devices_summary TEXT NULL,

            -- 08. Problemas Activos (Tab 08)
            active_problems_json JSON NULL,

            -- 09. Plan por Sistemas y Objetivos (Tab 09)
            plan_cardiovascular TEXT NULL,
            plan_respiratory TEXT NULL,
            plan_neurologic TEXT NULL,
            plan_renal_fluid TEXT NULL,
            plan_nutrition TEXT NULL,
            plan_infectious TEXT NULL,
            plan_hematologic TEXT NULL,
            plan_other TEXT NULL,
            pending_tests_present VARCHAR(10) NULL,
            pending_other_summary TEXT NULL,
            next_24h_goals TEXT NULL,
            anticipated_disposition VARCHAR(100) NULL,
            discharge_barriers_json JSON NULL,

            -- Estado y Firma
            signed_by VARCHAR(150) NULL,
            signed_at DATETIME NULL,
            finalized TINYINT(1) NOT NULL DEFAULT 0,
            estatus_nota VARCHAR(50) NOT NULL DEFAULT 'Borrador',
            datos_completos_json LONGTEXT NULL,

            -- Auditoría
            audit_usu_id VARCHAR(255) NULL,
            audit_ip VARCHAR(45) NULL,
            audit_dep_id VARCHAR(50) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_ev_solicitud (registro_solicitud_id),
            INDEX idx_ev_uuid (daily_note_id),
            INDEX idx_ev_fecha (evolution_date),
            CONSTRAINT fk_ev_solicitud FOREIGN KEY (registro_solicitud_id) REFERENCES registro_solicitud(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
        `;

        await db.query(sql);
        console.log('✓ Tabla evolucion_diaria creada exitosamente con soporte para los 9 tabs clínicos y ROW_FORMAT=DYNAMIC.');
        process.exit(0);
    } catch (err) {
        console.error('Error durante la migración de evolucion_diaria:', err);
        process.exit(1);
    }
}

migrateEvoluciones();
