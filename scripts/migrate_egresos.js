const db = require('../config/db');

async function migrateEgresos() {
    try {
        console.log('Iniciando migración de tabla egreso_hospitalario (HCIL V14 / V17)...');

        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('DROP TABLE IF EXISTS egreso_hospitalario');
        await db.query('SET FOREIGN_KEY_CHECKS = 1');

        const sql = `
        CREATE TABLE egreso_hospitalario (
            id INT AUTO_INCREMENT PRIMARY KEY,
            registro_solicitud_id INT NOT NULL,
            hospitalizacion_id INT NULL DEFAULT NULL,
            discharge_id VARCHAR(64) NOT NULL UNIQUE,
            encounter_id VARCHAR(64) NULL,
            intent VARCHAR(50) NOT NULL DEFAULT 'normal',
            parent_discharge_id VARCHAR(64) NULL,

            -- 01. Egreso e ingreso (Tab 01)
            admission_date DATE NOT NULL,
            discharge_date DATE NOT NULL,
            discharge_time TIME NOT NULL,
            length_of_stay_days INT NULL,
            discharge_service VARCHAR(100) NULL,
            discharge_physician_id VARCHAR(100) NULL,
            discharge_summary_status VARCHAR(50) NOT NULL DEFAULT 'Borrador',
            present_illness_id VARCHAR(64) NULL,
            present_illness_display TEXT NULL,
            admission_condition VARCHAR(50) NULL,
            admission_diagnosis_ids_json JSON NULL,

            -- 02. Evolución intrahospitalaria (Tab 02)
            hospital_course_outcome VARCHAR(50) NULL,
            icu_admission_occurred TINYINT(1) DEFAULT 0,
            icu_stay_days DECIMAL(6,1) NULL,
            mechanical_ventilation_during_stay TINYINT(1) DEFAULT 0,
            mechanical_support_during_stay TINYINT(1) DEFAULT 0,
            hospital_course_summary LONGTEXT NULL,
            consultation_ids_json JSON NULL,
            consultations_summary TEXT NULL,

            -- 03. Procedimientos realizados (Tab 03)
            discharge_procedure_links_json JSON NULL,
            cardiac_surgery_performed TINYINT(1) DEFAULT 0,
            cardiac_surgery_ids_json JSON NULL,
            operative_note_id VARCHAR(64) NULL,
            operative_note_attached TINYINT(1) DEFAULT 0,
            operative_note_file VARCHAR(255) NULL,
            operative_note_missing_reason TEXT NULL,
            surgery_result_discharge VARCHAR(100) NULL,
            cath_performed_during_stay TINYINT(1) DEFAULT 0,
            cath_ids_json JSON NULL,
            cath_discharge_summary TEXT NULL,
            ep_performed_during_stay TINYINT(1) DEFAULT 0,
            ep_study_ids_json JSON NULL,
            ep_discharge_summary TEXT NULL,
            complication_links_json JSON NULL,
            complications_summary TEXT NULL,
            unresolved_complication_present TINYINT(1) DEFAULT 0,

            -- 04. Estudios y Examen Físico (Tab 04)
            discharge_physical_exam_id VARCHAR(64) NULL,
            discharge_vitals_id VARCHAR(64) NULL,
            discharge_weight_kg DECIMAL(6,2) NULL,
            discharge_spo2 DECIMAL(5,1) NULL,
            discharge_exam_summary TEXT NULL,
            discharge_cxr_status VARCHAR(50) NULL,
            discharge_cxr_id VARCHAR(64) NULL,
            discharge_cxr_date DATE NULL,
            discharge_cxr_summary TEXT NULL,
            discharge_cxr_comparison VARCHAR(50) NULL,
            discharge_cxr_not_done_reason TEXT NULL,
            discharge_labs_status VARCHAR(50) NULL,
            discharge_lab_result_ids_json JSON NULL,
            discharge_labs_summary TEXT NULL,
            discharge_ecg_id VARCHAR(64) NULL,
            discharge_echo_id VARCHAR(64) NULL,
            discharge_other_imaging_ids_json JSON NULL,
            discharge_studies_summary TEXT NULL,

            -- 05. Diagnósticos de egreso (Tab 05)
            discharge_diagnoses_json JSON NULL,

            -- 06. Medicamentos y soporte (Tab 06)
            discharge_medications_json JSON NULL,
            oxygen_at_home TINYINT(1) DEFAULT 0,
            oxygen_flow_home DECIMAL(4,1) NULL,
            oxygen_interface_home VARCHAR(50) NULL,
            device_ids_at_discharge_json JSON NULL,
            vascular_access_at_discharge VARCHAR(50) NULL,
            drain_at_discharge TINYINT(1) DEFAULT 0,
            home_equipment_required_json JSON NULL,

            -- 07. Plan domiciliario y cuidados (Tab 07)
            home_feeding_route_json JSON NULL,
            home_diet_type TEXT NULL,
            activity_restriction VARCHAR(100) NULL,
            activity_restriction_detail TEXT NULL,
            sternal_precautions VARCHAR(50) NULL,
            sternal_precautions_duration VARCHAR(100) NULL,
            wound_care_required TINYINT(1) DEFAULT 0,
            wound_care_instructions TEXT NULL,
            bathing_instructions TEXT NULL,
            return_school_daycare VARCHAR(250) NULL,
            sports_restriction TEXT NULL,
            ie_prophylaxis_status VARCHAR(50) NULL,
            ie_prophylaxis_instructions TEXT NULL,
            anticoagulation_at_discharge TINYINT(1) DEFAULT 0,
            anticoagulant_medication_id VARCHAR(64) NULL,
            target_inr_min DECIMAL(3,1) NULL,
            target_inr_max DECIMAL(3,1) NULL,
            next_inr_date DATE NULL,
            device_precautions TEXT NULL,
            home_monitoring_required TINYINT(1) DEFAULT 0,
            home_spo2_monitoring TINYINT(1) DEFAULT 0,
            home_spo2_lower_limit DECIMAL(5,1) NULL,
            home_spo2_upper_limit DECIMAL(5,1) NULL,
            home_weight_monitoring TINYINT(1) DEFAULT 0,
            home_hr_monitoring TINYINT(1) DEFAULT 0,
            home_feeding_monitoring TINYINT(1) DEFAULT 0,
            warning_signs_json JSON NULL,
            warning_sign_other VARCHAR(250) NULL,

            -- 08. Pendientes y citas de seguimiento (Tab 08)
            pending_results_json JSON NULL,
            followups_json JSON NULL,

            -- 09. Destino del paciente y firma (Tab 09)
            discharge_disposition VARCHAR(100) NULL,
            transfer_facility VARCHAR(250) NULL,
            transfer_reason TEXT NULL,
            transport_requirement VARCHAR(100) NULL,
            discharge_signed_by VARCHAR(150) NULL,
            discharge_signed_at DATETIME NULL,
            finalized TINYINT(1) NOT NULL DEFAULT 0,
            datos_completos_json LONGTEXT NULL,

            -- Auditoría
            audit_usu_id VARCHAR(255) NULL,
            audit_ip VARCHAR(45) NULL,
            audit_dep_id VARCHAR(50) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_eg_solicitud (registro_solicitud_id),
            INDEX idx_eg_uuid (discharge_id),
            INDEX idx_eg_fecha (discharge_date),
            CONSTRAINT fk_eg_solicitud FOREIGN KEY (registro_solicitud_id) REFERENCES registro_solicitud(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
        `;

        await db.query(sql);
        console.log('✓ Tabla egreso_hospitalario creada exitosamente con soporte para los 10 tabs y ROW_FORMAT=DYNAMIC.');
        process.exit(0);
    } catch (err) {
        console.error('Error durante la migración de egreso_hospitalario:', err);
        process.exit(1);
    }
}

migrateEgresos();
