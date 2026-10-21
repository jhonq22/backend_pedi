// backend/scripts/migrate_radiografias.js
const db = require('../config/db');

async function migrate() {
    try {
        console.log('Iniciando migración de estudio_radiografia...');
        await db.query('DROP TABLE IF EXISTS estudio_radiografia');

        const sql = `
        CREATE TABLE estudio_radiografia (
            id INT AUTO_INCREMENT PRIMARY KEY,
            registro_solicitud_id INT NOT NULL,
            hospitalizacion_id INT NULL,
            chest_xray_uuid VARCHAR(64) NULL,
            
            -- Contexto (Tab 01)
            fecha_estudio DATE NULL,
            hora_estudio TIME NULL,
            fecha_hora_estudio VARCHAR(50) NULL,
            admission_date DATE NULL,
            surgery_date DATE NULL,
            hospital_day INT NULL,
            postoperative_day INT NULL,
            xray_location VARCHAR(100) NULL,
            xray_interpreter_id VARCHAR(100) NULL,
            xray_indication TEXT NULL,
            xray_indication_other VARCHAR(255) NULL,
            xray_control_type VARCHAR(100) NULL,
            related_surgery_id VARCHAR(100) NULL,
            related_procedure_id VARCHAR(100) NULL,

            -- Calidad Técnica (Tab 02)
            proyeccion VARCHAR(100) NULL,
            patient_position VARCHAR(100) NULL,
            inspiration_quality VARCHAR(100) NULL,
            rotation_status VARCHAR(100) NULL,
            penetration_quality VARCHAR(100) NULL,
            calidad_tecnica VARCHAR(100) NULL,
            xray_quality_limitation TEXT NULL,

            -- Parénquima y Edema (Tab 03)
            lung_expansion VARCHAR(100) NULL,
            lung_parenchyma_status VARCHAR(100) NULL,
            atelectasis_present TINYINT(1) DEFAULT 0,
            atelectasis_location TEXT NULL,
            consolidation_present TINYINT(1) DEFAULT 0,
            consolidation_location TEXT NULL,
            interstitial_opacity VARCHAR(100) NULL,
            alveolar_opacity VARCHAR(100) NULL,
            hyperinflation_present TINYINT(1) DEFAULT 0,
            lung_other_findings TEXT NULL,
            flujo_pulmonar VARCHAR(100) NULL,
            pulmonary_edema VARCHAR(100) NULL,
            pulmonary_edema_distribution VARCHAR(100) NULL,
            interstitial_edema_signs TEXT NULL,
            pulmonary_edema_severity VARCHAR(100) NULL,

            -- Pleura y Mediastino (Tab 04)
            pleural_effusion VARCHAR(100) NULL,
            right_pleural_effusion_size VARCHAR(100) NULL,
            left_pleural_effusion_size VARCHAR(100) NULL,
            pneumothorax VARCHAR(100) NULL,
            pneumothorax_size VARCHAR(100) NULL,
            hallazgos_pleurales TEXT NULL,
            mediastinum_status VARCHAR(100) NULL,
            mediastinal_shift VARCHAR(100) NULL,
            thymus_visible VARCHAR(100) NULL,
            thymic_appearance VARCHAR(100) NULL,
            mediastinal_notes TEXT NULL,
            diaphragm_status VARCHAR(100) NULL,
            diaphragmatic_paralysis_suspected VARCHAR(100) NULL,
            diaphragm_notes TEXT NULL,

            -- Corazón y Grandes Vasos (Tab 05)
            cardiac_position_xray VARCHAR(100) NULL,
            cardiac_apex_direction VARCHAR(100) NULL,
            cardiomegalia VARCHAR(100) NULL,
            cardiac_silhouette_size VARCHAR(100) NULL,
            indice_cardiotoracico DECIMAL(5,2) NULL,
            cardiac_silhouette_configuration VARCHAR(100) NULL,
            cardiac_contour_abnormality TINYINT(1) DEFAULT 0,
            cardiac_contour_notes TEXT NULL,
            pulmonary_vascularity VARCHAR(100) NULL,
            pulmonary_plethora TINYINT(1) DEFAULT 0,
            pulmonary_oligemia TINYINT(1) DEFAULT 0,
            vascularity_asymmetry VARCHAR(100) NULL,
            pulmonary_vascularity_notes TEXT NULL,
            main_pa_segment VARCHAR(100) NULL,
            right_hilum_status VARCHAR(100) NULL,
            left_hilum_status VARCHAR(100) NULL,
            central_pulmonary_arteries VARCHAR(100) NULL,
            pulmonary_venous_congestion VARCHAR(100) NULL,
            cephalization_present VARCHAR(100) NULL,
            perihilar_congestion VARCHAR(100) NULL,
            pulmonary_venous_notes TEXT NULL,
            aortic_arch_side_xray VARCHAR(100) NULL,
            aortic_knob_status VARCHAR(100) NULL,
            great_vessel_contour VARCHAR(100) NULL,
            great_vessel_notes TEXT NULL,

            -- Dispositivos (Tab 06)
            ett_present TINYINT(1) DEFAULT 0,
            ett_tip_position VARCHAR(100) NULL,
            ett_distance_to_carina_cm DECIMAL(5,2) NULL,
            cvc_present TINYINT(1) DEFAULT 0,
            cvc_tip_location VARCHAR(100) NULL,
            cvc_position_status VARCHAR(100) NULL,
            thoracic_drain_present TINYINT(1) DEFAULT 0,
            thoracic_drain_count INT NULL,
            thoracic_drain_position_status VARCHAR(100) NULL,
            thoracic_drain_notes TEXT NULL,
            ecmo_cannula_present TINYINT(1) DEFAULT 0,
            ecmo_cannula_position VARCHAR(100) NULL,
            mechanical_support_device_visible TINYINT(1) DEFAULT 0,
            mechanical_support_xray_notes TEXT NULL,
            dispositivos_tubos TEXT NULL,
            devices_json LONGTEXT NULL,

            -- Otros y Conclusión (Tab 07)
            bone_findings VARCHAR(100) NULL,
            bone_abnormality_notes TEXT NULL,
            soft_tissue_status VARCHAR(100) NULL,
            soft_tissue_notes TEXT NULL,
            conclusion_informe TEXT NULL,
            estatus_informe VARCHAR(50) DEFAULT 'Borrador',

            -- Contenedores Seccionales y Global
            seccion_context_json LONGTEXT NULL,
            seccion_quality_json LONGTEXT NULL,
            seccion_lung_json LONGTEXT NULL,
            seccion_pleura_json LONGTEXT NULL,
            seccion_heart_json LONGTEXT NULL,
            seccion_devices_json LONGTEXT NULL,
            seccion_other_json LONGTEXT NULL,
            datos_completos_json LONGTEXT NULL,

            -- Auditoría
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            audit_usu_id VARCHAR(255) DEFAULT '1',
            audit_ip VARCHAR(45) DEFAULT '127.0.0.1',
            audit_dep_id VARCHAR(50) DEFAULT '1',

            INDEX idx_solicitud (registro_solicitud_id),
            INDEX idx_fecha (fecha_estudio),
            INDEX idx_uuid (chest_xray_uuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
        `;

        await db.query(sql);
        console.log('✓ Tabla estudio_radiografia creada exitosamente con soporte para los 100 campos y ROW_FORMAT=DYNAMIC.');
        process.exit(0);
    } catch (err) {
        console.error('Error durante la migración:', err);
        process.exit(1);
    }
}

migrate();
