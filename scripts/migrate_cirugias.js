// backend/scripts/migrate_cirugias.js
const db = require('../config/db');

async function migrate() {
    try {
        console.log('Iniciando migración de procedimiento_quirurgico...');
        
        // Verificamos si la tabla existe para respaldar si hay datos
        const [rows] = await db.query('SHOW TABLES LIKE "procedimiento_quirurgico"');
        if (rows.length > 0) {
            const [count] = await db.query('SELECT COUNT(*) as cnt FROM procedimiento_quirurgico');
            console.log(`Tabla existente encontrada con ${count[0].cnt} registros.`);
            if (count[0].cnt > 0) {
                await db.query('CREATE TABLE IF NOT EXISTS procedimiento_quirurgico_backup AS SELECT * FROM procedimiento_quirurgico');
                console.log('Respaldo en procedimiento_quirurgico_backup creado con éxito.');
            }
            await db.query('DROP TABLE IF EXISTS procedimiento_quirurgico');
        }

        const sql = `
        CREATE TABLE procedimiento_quirurgico (
            id INT AUTO_INCREMENT PRIMARY KEY,
            registro_solicitud_id INT NOT NULL,
            hospitalizacion_id INT NULL,
            surgery_uuid VARCHAR(64) NULL,
            operative_note_uuid VARCHAR(64) NULL,
            anesthesia_record_uuid VARCHAR(64) NULL,
            perfusion_record_uuid VARCHAR(64) NULL,

            -- Identificación y Tiempos Principales
            fecha_cirugia DATE NOT NULL,
            inicio_cirugia_datetime DATETIME NULL,
            fin_cirugia_datetime DATETIME NULL,
            salida_quirofano_datetime DATETIME NULL,
            duracion_cirugia_min INT NULL,
            edad_dias_cirugia INT NULL,
            edad_meses_cirugia INT NULL,
            peso_cirugia_kg DECIMAL(6,2) NULL,
            talla_cirugia_cm DECIMAL(5,1) NULL,
            quirofano VARCHAR(50) NULL,

            -- Estrategia y Prioridad Quirúrgica
            prioridad_cirugia VARCHAR(50) NULL,
            estrategia_quirurgica VARCHAR(100) NULL,
            primera_cirugia_cv TINYINT(1) DEFAULT 1,
            numero_cirugia_cv INT DEFAULT 1,
            reoperacion_cardiaca TINYINT(1) DEFAULT 0,
            reoperacion_planificada TINYINT(1) DEFAULT 0,
            cirugia_por_complicacion TINYINT(1) DEFAULT 0,
            cirugia_previa_relacionada_id VARCHAR(64) NULL,
            complicacion_anterior_relacionada_id VARCHAR(64) NULL,

            -- Equipo Quirúrgico y Abordaje
            cirujano_principal VARCHAR(150) NOT NULL,
            cirujanos_ayudantes TEXT NULL,
            residentes_participantes TEXT NULL,
            instrumentista VARCHAR(150) NULL,
            abordaje_quirurgico VARCHAR(100) NULL,
            abordaje_quirurgico_otro VARCHAR(200) NULL,
            reesternotomia TINYINT(1) DEFAULT 0,

            -- Nota Operatoria y Diagnósticos
            diagnostico_preoperatorio VARCHAR(255) NULL,
            diagnostico_postoperatorio VARCHAR(255) NULL,
            cirugia_propuesta VARCHAR(255) NULL,
            cirugia_realizada TEXT NULL,
            resumen_procedimientos TEXT NULL,
            hallazgos_operatorios LONGTEXT NULL,
            lesion_residual VARCHAR(50) NULL,
            lesion_residual_descripcion TEXT NULL,
            eco_postreparacion_resultado TEXT NULL,
            ritmo_postoperatorio VARCHAR(50) NULL,
            estado_torax VARCHAR(100) NULL,
            destino_postoperatorio VARCHAR(100) NULL,
            complicacion_presente TINYINT(1) DEFAULT 0,
            muestra_quirurgica_obtenida TINYINT(1) DEFAULT 0,
            muestra_quirurgica_tipo VARCHAR(250) NULL,
            enviado_anatomia_patologica TINYINT(1) DEFAULT 0,

            -- Registro Anestésico
            anestesiologo VARCHAR(150) NULL,
            otros_anestesiologos TEXT NULL,
            inicio_anestesia_datetime DATETIME NULL,
            fin_anestesia_datetime DATETIME NULL,
            duracion_anestesia_min INT NULL,
            tiempo_anestesia_minutos INT NULL,
            clasificacion_asa VARCHAR(50) NULL,
            asa_emergencia TINYINT(1) DEFAULT 0,
            estado_preanestesico TEXT NULL,
            soporte_oxigeno_previo VARCHAR(100) NULL,
            soporte_vasoactivo_previo TINYINT(1) DEFAULT 0,
            tecnica_anestesica VARCHAR(100) NULL,
            tipo_induccion VARCHAR(100) NULL,
            notas_anestesicas TEXT NULL,
            manejo_via_aerea VARCHAR(100) NULL,
            via_aerea_dificil TINYINT(1) DEFAULT 0,
            via_aerea_dificil_notas TEXT NULL,
            tet_tamano_mm DECIMAL(3,1) NULL,
            tet_con_cuff VARCHAR(50) NULL,
            intentos_intubacion INT NULL,
            linea_arterial_insertada TINYINT(1) DEFAULT 1,
            linea_arterial_sitio VARCHAR(100) NULL,
            cvc_insertado TINYINT(1) DEFAULT 1,
            cvc_sitio VARCHAR(100) NULL,
            tee_utilizado TINYINT(1) DEFAULT 1,
            oximetria_cerebral_nirs TINYINT(1) DEFAULT 1,
            medicamentos_anestesicos TEXT NULL,
            hemoderivados_anestesia TEXT NULL,
            extubado_en_quirofano TINYINT(1) DEFAULT 0,
            via_aerea_traslado VARCHAR(100) NULL,
            condicion_traslado VARCHAR(100) NULL,
            destino_anestesia VARCHAR(100) NULL,
            nota_anestesica_final LONGTEXT NULL,

            -- Registro de Perfusión y CEC
            requirio_cec TINYINT(1) DEFAULT 1,
            perfusionista VARCHAR(150) NULL,
            otros_perfusionistas TEXT NULL,
            inicio_cec_datetime DATETIME NULL,
            fin_cec_datetime DATETIME NULL,
            tiempo_cec_minutos INT NULL,
            periodos_cec_conteo INT DEFAULT 0,
            estrategia_flujo_cec VARCHAR(100) NULL,
            requirio_clampeo_aortico TINYINT(1) DEFAULT 1,
            tiempo_clampeo_minutos INT NULL,
            periodos_clampeo_conteo INT DEFAULT 0,
            estrategia_termica_cec VARCHAR(100) NULL,
            temperatura_minima_cec DECIMAL(4,1) NULL,
            sitios_medicion_temperatura VARCHAR(255) NULL,
            cardioplejia_utilizada TINYINT(1) DEFAULT 1,
            cardioplejia_solucion VARCHAR(150) NULL,
            cardioplejia_tipo VARCHAR(100) NULL,
            cardioplejia_via VARCHAR(150) NULL,
            cardioplejia_temperatura VARCHAR(50) NULL,
            cardioplejia_dosis_conteo INT NULL,
            cardioplejia_volumen_total_ml DECIMAL(8,1) NULL,
            paro_circulatorio_utilizado TINYINT(1) DEFAULT 0,
            tiempo_paro_circulatorio_minutos INT NULL,
            temperatura_paro_circulatorio DECIMAL(4,1) NULL,
            perfusion_cerebral_utilizada TINYINT(1) DEFAULT 0,
            perfusion_cerebral_tipo VARCHAR(100) NULL,
            perfusion_cerebral_tiempo_min INT NULL,
            perfusion_cerebral_flujo DECIMAL(7,2) NULL,
            cebado_tipo VARCHAR(100) NULL,
            cebado_volumen_total_ml DECIMAL(8,1) NULL,
            cebado_sanguineo TINYINT(1) DEFAULT 1,
            cebado_notas TEXT NULL,
            ultrafiltracion_utilizada TINYINT(1) DEFAULT 1,
            ultrafiltracion_tipo VARCHAR(100) NULL,
            ultrafiltracion_volumen_ml DECIMAL(8,1) NULL,
            salida_cec VARCHAR(100) NULL,
            desfibrilacion_requerida TINYINT(1) DEFAULT 0,
            desfibrilacion_conteo INT NULL,
            marcapasos_temporal_salida TINYINT(1) DEFAULT 0,
            soporte_mecanico_requerido TINYINT(1) DEFAULT 0,
            soporte_mecanico_tipo VARCHAR(100) NULL,
            drenajes_colocados VARCHAR(255) NULL,
            nota_perfusion LONGTEXT NULL,

            -- Estado, Cierre y Firmas
            estatus_nota VARCHAR(50) DEFAULT 'Borrador',
            es_finalizado TINYINT(1) DEFAULT 0,
            firma_cirujano_nombre VARCHAR(150) NULL,
            firma_cirujano_fecha DATETIME NULL,
            firma_anestesiologo_nombre VARCHAR(150) NULL,
            firma_anestesiologo_fecha DATETIME NULL,
            firma_perfusionista_nombre VARCHAR(150) NULL,
            firma_perfusionista_fecha DATETIME NULL,
            fecha_finalizado DATETIME NULL,

            -- Matrices Serializadas (Repeaters HCIL V11 / V17)
            diagnoses_json LONGTEXT NULL,
            procedures_json LONGTEXT NULL,
            surgical_complications_json LONGTEXT NULL,
            anesthesia_complications_json LONGTEXT NULL,
            cannulations_json LONGTEXT NULL,
            cpb_periods_json LONGTEXT NULL,
            clamp_periods_json LONGTEXT NULL,
            perfusion_complications_json LONGTEXT NULL,

            -- Contenedores Seccionales JSON y Objeto Maestro
            surgery_fields_json LONGTEXT NULL,
            anesthesia_fields_json LONGTEXT NULL,
            perfusion_fields_json LONGTEXT NULL,
            signatures_json LONGTEXT NULL,
            datos_completos_json LONGTEXT NULL,

            -- Auditoría
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            audit_usu_id VARCHAR(255) DEFAULT '1',
            audit_ip VARCHAR(45) DEFAULT '127.0.0.1',
            audit_dep_id VARCHAR(50) DEFAULT '1',

            INDEX idx_solicitud (registro_solicitud_id),
            INDEX idx_hospitalizacion (hospitalizacion_id),
            INDEX idx_surgery_uuid (surgery_uuid),
            INDEX idx_fecha_cirugia (fecha_cirugia)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
        `;

        await db.query(sql);
        console.log('✅ Tabla procedimiento_quirurgico creada exitosamente con esquema completo HCIL V11.');
    } catch (err) {
        console.error('❌ Error en la migración de procedimiento_quirurgico:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
