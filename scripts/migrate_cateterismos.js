// backend/scripts/migrate_cateterismos.js
const db = require('../config/db');

async function migrate() {
    try {
        console.log('Iniciando migración de estudio_cateterismo...');
        await db.query('DROP TABLE IF EXISTS estudio_cateterismo');

        const sql = `
        CREATE TABLE estudio_cateterismo (
            id INT AUTO_INCREMENT PRIMARY KEY,
            registro_solicitud_id INT NOT NULL,
            hospitalizacion_id INT NULL,
            cath_uuid VARCHAR(64) NULL,
            
            -- Contexto e Identificación (Tab 01)
            fecha_procedimiento DATE NULL,
            hora_inicio TIME NULL,
            hora_fin TIME NULL,
            sala_cateterismo VARCHAR(100) NULL,
            primer_operador VARCHAR(150) NULL,
            segundo_operador VARCHAR(150) NULL,
            fellow_residente VARCHAR(150) NULL,
            anestesiologo VARCHAR(150) NULL,
            enfermeria VARCHAR(150) NULL,
            tecnologo_radiologico VARCHAR(150) NULL,
            prioridad_procedimiento VARCHAR(50) NULL,
            tipo_cateterismo VARCHAR(100) NULL,
            indicacion_procedimiento TEXT NULL,
            indicacion_otra VARCHAR(255) NULL,
            diagnostico_cardiopatia_base VARCHAR(255) NULL,
            estado_quirurgico_previo VARCHAR(100) NULL,
            cirugias_previas_resumen TEXT NULL,
            clase_funcional_ross_nyha VARCHAR(50) NULL,

            -- Preparación del Paciente (Tab 02)
            peso_kg DECIMAL(5,2) NULL,
            talla_cm DECIMAL(5,2) NULL,
            superficie_corporal DECIMAL(5,3) NULL,
            fc_pre INT NULL,
            ta_sistolica_pre INT NULL,
            ta_diastolica_pre INT NULL,
            ta_media_pre INT NULL,
            spo2_pre DECIMAL(5,2) NULL,
            hb_pre DECIMAL(4,2) NULL,
            hto_pre DECIMAL(4,2) NULL,
            tipo_anestesia VARCHAR(100) NULL,
            via_aerea VARCHAR(100) NULL,
            fio2_pre DECIMAL(5,2) NULL,
            uso_ultrasonido_vascular TINYINT(1) DEFAULT 0,

            -- Accesos y Anticoagulación (Tab 03)
            sitio_acceso_vascular VARCHAR(255) NULL,
            heparina_dosis_total DECIMAL(8,2) NULL,
            heparina_unidad VARCHAR(20) NULL,
            act_basal INT NULL,
            act_pico INT NULL,
            protamina_administrada TINYINT(1) DEFAULT 0,
            protamina_dosis_mg DECIMAL(6,2) NULL,

            -- Hemodinámica Resumen (Tab 04)
            presion_auricula_derecha DECIMAL(5,2) NULL,
            presion_ventriculo_derecho DECIMAL(5,2) NULL,
            presion_arteria_pulmonar DECIMAL(5,2) NULL,
            presion_auricula_izquierda DECIMAL(5,2) NULL,
            presion_ventriculo_izquierdo DECIMAL(5,2) NULL,
            presion_aorta DECIMAL(5,2) NULL,
            presion_capilar_pulmonar DECIMAL(5,2) NULL,
            gasto_cardiaco_qp DECIMAL(5,2) NULL,
            gasto_cardiaco_qs DECIMAL(5,2) NULL,
            relacion_qp_qs DECIMAL(5,2) NULL,
            resistencia_vascular_pulmonar_rvp DECIMAL(5,2) NULL,
            resistencia_vascular_sistemica_rvs DECIMAL(5,2) NULL,
            relacion_rp_rs DECIMAL(5,2) NULL,

            -- Imagen y Radiación (Tab 05)
            tiempo_fluoroscopia_min DECIMAL(6,2) NULL,
            kerma_aire_total_mgy DECIMAL(8,2) NULL,
            producto_dosis_area_dap DECIMAL(8,2) NULL,
            medio_contraste_tipo VARCHAR(100) NULL,
            volumen_contraste_ml DECIMAL(6,2) NULL,
            volumen_contraste_ml_kg DECIMAL(5,2) NULL,
            ecocardiograma_transesofagico TINYINT(1) DEFAULT 0,
            ecocardiograma_intracardiaco TINYINT(1) DEFAULT 0,
            ecocardiograma_hallazgos TEXT NULL,

            -- Intervenciones y Terapéutica (Tab 06)
            intervencion_realizada TEXT NULL,
            dispositivo_implantado VARCHAR(255) NULL,
            exito_procedimiento VARCHAR(100) NULL,

            -- Vasorreactividad Pulmonar (Tab 07)
            prueba_vasorreactividad TINYINT(1) DEFAULT 0,
            vasorreactividad_agente VARCHAR(100) NULL,
            vasorreactividad_resultado VARCHAR(50) NULL,
            vasorreactividad_papm_basal DECIMAL(5,2) NULL,
            vasorreactividad_papm_reto DECIMAL(5,2) NULL,
            vasorreactividad_rvp_basal DECIMAL(5,2) NULL,
            vasorreactividad_rvp_reto DECIMAL(5,2) NULL,
            vasorreactividad_notas TEXT NULL,

            -- Resultados y Complicaciones (Tab 08)
            transfusion_hemoderivados TINYINT(1) DEFAULT 0,
            transfusion_detalles TEXT NULL,
            soporte_mecanico_requerido TINYINT(1) DEFAULT 0,
            complicaciones TEXT NULL,

            -- Cierre y Destino (Tab 09)
            estado_paciente_cierre VARCHAR(100) NULL,
            destino_posterior VARCHAR(100) NULL,
            estado_pulsos_femorales VARCHAR(100) NULL,
            conclusion_informe TEXT NULL,
            estatus_informe VARCHAR(50) DEFAULT 'Borrador',

            -- Matrices Serializadas (Repeaters HCIL V17)
            accesses_json LONGTEXT NULL,
            conditions_json LONGTEXT NULL,
            angiographies_json LONGTEXT NULL,
            interventions_json LONGTEXT NULL,
            complications_json LONGTEXT NULL,

            -- Contenedores Seccionales JSON y Datos Completos
            seccion_context_json LONGTEXT NULL,
            seccion_preparation_json LONGTEXT NULL,
            seccion_access_json LONGTEXT NULL,
            seccion_hemodynamics_json LONGTEXT NULL,
            seccion_imaging_json LONGTEXT NULL,
            seccion_interventions_json LONGTEXT NULL,
            seccion_reactivity_json LONGTEXT NULL,
            seccion_outcomes_json LONGTEXT NULL,
            seccion_closure_json LONGTEXT NULL,
            datos_completos_json LONGTEXT NULL,

            -- Auditoría
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            audit_usu_id VARCHAR(255) DEFAULT '1',
            audit_ip VARCHAR(45) DEFAULT '127.0.0.1',
            audit_dep_id VARCHAR(50) DEFAULT '1',

            INDEX idx_solicitud (registro_solicitud_id),
            INDEX idx_fecha (fecha_procedimiento),
            INDEX idx_uuid (cath_uuid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
        `;

        await db.query(sql);
        console.log('✓ Tabla estudio_cateterismo creada exitosamente con soporte para los 161 campos, 9 pestañas y 5 repeaters.');
        process.exit(0);
    } catch (err) {
        console.error('Error durante la migración de estudio_cateterismo:', err);
        process.exit(1);
    }
}

migrate();
