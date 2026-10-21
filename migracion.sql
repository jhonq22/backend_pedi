-- =============================================================================
-- SCRIPT DE MIGRACIÓN: BASE DE DATOS PEDIÁTRICO
-- Compatible con MySQL 5.7+ / MariaDB 10.3+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. TABLA: tipo_operacion
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tipo_operacion` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` VARCHAR(255) NULL DEFAULT NULL,
  `estatus` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Datos iniciales solicitados
INSERT INTO `tipo_operacion` (`nombre`, `descripcion`) VALUES
('Hemodinamia', 'Procedimientos hemodinámicos y cateterismos intervencionistas'),
('Marcapasos', 'Implante, recambio o revisión de marcapasos');

-- -----------------------------------------------------------------------------
-- 2. TABLA: registro_solicitud
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `registro_solicitud` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `paciente_id` INT(11) NOT NULL,
  `centro_salud_id` INT(11) NULL DEFAULT NULL,
  `tipo_operacion_id` INT(11) NULL DEFAULT NULL,
  `fecha_solicitud` DATE NOT NULL,
  `fecha_cita` DATE NULL DEFAULT NULL,
  `horario_cita` VARCHAR(100) NULL DEFAULT NULL,
  `tipo_cita_id` INT(11) NULL DEFAULT NULL,
  `pediatra_responsable` VARCHAR(150) NULL DEFAULT NULL,
  `procedimiento_planificado_id` INT(11) NULL DEFAULT NULL,
  `diagnostico_motivo` VARCHAR(255) NULL DEFAULT NULL,
  `fecha_respuesta` DATE NULL DEFAULT NULL,
  `estatus` VARCHAR(50) NOT NULL DEFAULT 'Pendiente',
  `observacion_general` TEXT NULL DEFAULT NULL,
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. TABLA: paciente (Identificación, Demografía y Domicilio estructurado)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `paciente` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `numero_historia_clinica` VARCHAR(32) NOT NULL,
  `tipo_documento_id` INT(11) NULL DEFAULT NULL,
  `numero_documento` VARCHAR(25) NULL DEFAULT NULL,
  `es_cedula_madre` TINYINT(1) NOT NULL DEFAULT 0,
  `cedula_madre_prefijo` VARCHAR(2) NULL DEFAULT NULL,
  `cedula_madre_numero` VARCHAR(15) NULL DEFAULT NULL,
  `numero_hijo` INT(11) NULL DEFAULT NULL,
  `primer_nombre` VARCHAR(60) NOT NULL,
  `segundo_nombre` VARCHAR(60) NULL DEFAULT NULL,
  `primer_apellido` VARCHAR(60) NOT NULL,
  `segundo_apellido` VARCHAR(60) NULL DEFAULT NULL,
  `fecha_nacimiento` DATE NULL DEFAULT NULL,
  `edad_informada` INT(11) NULL DEFAULT NULL,
  `unidad_edad_informada` VARCHAR(20) NULL DEFAULT NULL,
  `sexo_id` INT(11) NULL DEFAULT NULL,
  `pais_nacimiento_id` INT(11) NULL DEFAULT NULL,
  `estado_nacimiento_id` INT(11) NULL DEFAULT NULL,
  `municipio_nacimiento_id` INT(11) NULL DEFAULT NULL,
  `parroquia_nacimiento_id` INT(11) NULL DEFAULT NULL,
  `ciudad_nacimiento_id` INT(11) NULL DEFAULT NULL,
  `lugar_nacimiento_otro` VARCHAR(150) NULL DEFAULT NULL,
  `pais_residencia_id` INT(11) NULL DEFAULT NULL,
  `estado_residencia_id` INT(11) NULL DEFAULT NULL,
  `municipio_residencia_id` INT(11) NULL DEFAULT NULL,
  `parroquia_residencia_id` INT(11) NULL DEFAULT NULL,
  `ciudad_residencia_id` INT(11) NULL DEFAULT NULL,
  `urbanizacion_sector` VARCHAR(100) NULL DEFAULT NULL,
  `calle_avenida` VARCHAR(100) NULL DEFAULT NULL,
  `casa_edificio` VARCHAR(80) NULL DEFAULT NULL,
  `punto_referencia` VARCHAR(150) NULL DEFAULT NULL,
  `direccion_completa` VARCHAR(500) NULL DEFAULT NULL,
  `idioma_preferido_id` INT(11) NULL DEFAULT NULL,
  `idioma_preferido` VARCHAR(100) NULL DEFAULT 'Español',
  `otros_idiomas` TEXT NULL DEFAULT NULL,
  `requiere_interprete` VARCHAR(20) NULL DEFAULT 'no',
  `idioma_interprete_id` INT(11) NULL DEFAULT NULL,
  `idioma_interprete` VARCHAR(100) NULL DEFAULT NULL,
  `idioma_interprete_otro` VARCHAR(100) NULL DEFAULT NULL,
  `etnia_id` INT(11) NULL DEFAULT NULL,
  `etnias` TEXT NULL DEFAULT NULL,
  `etnia_otro` VARCHAR(100) NULL DEFAULT NULL,
  `tipo_documento` VARCHAR(50) NULL DEFAULT NULL,
  `sexo` VARCHAR(20) NULL DEFAULT NULL,
  `nacionalidades` TEXT NULL DEFAULT NULL,
  `pais_nacimiento` VARCHAR(100) NULL DEFAULT 'Venezuela',
  `estado_nacimiento` VARCHAR(100) NULL DEFAULT NULL,
  `municipio_nacimiento` VARCHAR(100) NULL DEFAULT NULL,
  `parroquia_nacimiento` VARCHAR(100) NULL DEFAULT NULL,
  `ciudad_nacimiento` VARCHAR(100) NULL DEFAULT NULL,
  `pais_residencia` VARCHAR(100) NULL DEFAULT 'Venezuela',
  `estado_residencia` VARCHAR(100) NULL DEFAULT NULL,
  `municipio_residencia` VARCHAR(100) NULL DEFAULT NULL,
  `parroquia_residencia` VARCHAR(100) NULL DEFAULT NULL,
  `ciudad_residencia` VARCHAR(100) NULL DEFAULT NULL,
  `contacto_nombres` VARCHAR(120) NULL DEFAULT NULL,
  `contacto_apellidos` VARCHAR(120) NULL DEFAULT NULL,
  `contacto_parentesco` VARCHAR(50) NULL DEFAULT NULL,
  `contacto_parentesco_otro` VARCHAR(50) NULL DEFAULT NULL,
  `contacto_tipo_documento` VARCHAR(50) NULL DEFAULT NULL,
  `contacto_numero_documento` VARCHAR(25) NULL DEFAULT NULL,
  `contacto_telefono_principal` VARCHAR(25) NULL DEFAULT NULL,
  `contacto_telefono_secundario` VARCHAR(25) NULL DEFAULT NULL,
  `contacto_telefono_adicional` VARCHAR(25) NULL DEFAULT NULL,
  `contacto_correo_electronico` VARCHAR(254) NULL DEFAULT NULL,
  `contacto_red_social` VARCHAR(50) NULL DEFAULT NULL,
  `estatus` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. TABLA: paciente_contacto_responsable
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `paciente_contacto_responsable` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `paciente_id` INT(11) NOT NULL,
  `nombres` VARCHAR(120) NOT NULL,
  `apellidos` VARCHAR(120) NOT NULL,
  `parentesco_id` INT(11) NULL DEFAULT 1,
  `parentesco` VARCHAR(50) NULL DEFAULT NULL,
  `parentesco_otro` VARCHAR(50) NULL DEFAULT NULL,
  `tipo_documento_id` INT(11) NULL DEFAULT NULL,
  `tipo_documento` VARCHAR(50) NULL DEFAULT NULL,
  `numero_documento` VARCHAR(25) NULL DEFAULT NULL,
  `telefono_principal` VARCHAR(20) NOT NULL,
  `telefono_secundario` VARCHAR(20) NULL DEFAULT NULL,
  `telefono_adicional` VARCHAR(20) NULL DEFAULT NULL,
  `correo_electronico` VARCHAR(254) NULL DEFAULT NULL,
  `red_social` VARCHAR(50) NULL DEFAULT NULL,
  `estatus` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. TABLA: paciente_nacionalidad (Soporta múltiples nacionalidades)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `paciente_nacionalidad` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `paciente_id` INT(11) NOT NULL,
  `nacionalidad_id` INT(11) NOT NULL,
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (Nota: El módulo de Precarga de Citas y Agenda se encuentra unificado en la tabla registro_solicitud)

-- -----------------------------------------------------------------------------
-- 7. TABLA: historia_antecedente (Antecedentes generales y cardiovasculares)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `historia_antecedente` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `registro_solicitud_id` INT(11) NOT NULL,
  `semanas_gestacion` DECIMAL(4,1) NULL DEFAULT NULL,
  `complicaciones_gestacionales` VARCHAR(20) NOT NULL DEFAULT 'No',
  `detalle_complicaciones_gestacionales` TEXT NULL DEFAULT NULL,
  `complicaciones_neonatales` VARCHAR(20) NOT NULL DEFAULT 'No',
  `detalle_complicaciones_neonatales` TEXT NULL DEFAULT NULL,
  `cardiopatia_congenita` VARCHAR(20) NOT NULL DEFAULT 'No',
  `edad_diagnostico_cc` INT(11) NULL DEFAULT NULL,
  `unidad_edad_diagnostico_cc` VARCHAR(20) NULL DEFAULT NULL,
  `estudios_cardiacos_anormales` VARCHAR(20) NOT NULL DEFAULT 'No',
  `estudio_cardiaco_otro` VARCHAR(150) NULL DEFAULT NULL,
  `hipertension_pulmonar` VARCHAR(20) NOT NULL DEFAULT 'No',
  `tipo_hipertension_pulmonar` VARCHAR(50) NULL DEFAULT NULL,
  `falla_medro` VARCHAR(20) NOT NULL DEFAULT 'No',
  `kawasaki` VARCHAR(20) NOT NULL DEFAULT 'No',
  `kawasaki_fecha_inicio` DATE NULL DEFAULT NULL,
  `kawasaki_compromiso_coronario` VARCHAR(20) NULL DEFAULT NULL,
  `kawasaki_tratamiento` TEXT NULL DEFAULT NULL,
  `fiebre_reumatica` VARCHAR(20) NOT NULL DEFAULT 'No',
  `fiebre_reumatica_fecha_inicio` DATE NULL DEFAULT NULL,
  `sindrome_genetico` VARCHAR(20) NOT NULL DEFAULT 'No',
  `sindrome_genetico_otro` VARCHAR(250) NULL DEFAULT NULL,
  `miopatia` VARCHAR(20) NOT NULL DEFAULT 'No',
  `miopatia_otro` VARCHAR(200) NULL DEFAULT NULL,
  `antecedente_familiar_cv` VARCHAR(20) NOT NULL DEFAULT 'No',
  `tiene_hermanos` VARCHAR(20) NULL DEFAULT NULL,
  `nivel_escolaridad` VARCHAR(50) NULL DEFAULT NULL,
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. TABLA: historia_medicamento_habitual
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `historia_medicamento_habitual` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `registro_solicitud_id` INT(11) NOT NULL,
  `nombre_medicamento` VARCHAR(150) NOT NULL,
  `dosis` VARCHAR(50) NULL DEFAULT NULL,
  `unidad_id` INT(11) NULL DEFAULT NULL,
  `frecuencia_id` INT(11) NULL DEFAULT NULL,
  `via_administracion_id` INT(11) NULL DEFAULT NULL,
  `observacion` TEXT NULL DEFAULT NULL,
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. TABLA: historia_alergia
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `historia_alergia` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `registro_solicitud_id` INT(11) NOT NULL,
  `alergeno` VARCHAR(150) NOT NULL,
  `reaccion` VARCHAR(255) NULL DEFAULT NULL,
  `severidad` VARCHAR(50) NULL DEFAULT NULL,
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. TABLA: historia_examen_fisico (Antropometría, Cardio y Neuro pediátrico)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `historia_examen_fisico` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `registro_solicitud_id` INT(11) NOT NULL,
  `peso_kg` DECIMAL(5,2) NOT NULL,
  `percentil_peso` VARCHAR(50) NULL DEFAULT NULL,
  `talla_cm` DECIMAL(5,2) NOT NULL,
  `percentil_talla` VARCHAR(50) NULL DEFAULT NULL,
  `imc` DECIMAL(5,2) NULL DEFAULT NULL,
  `superficie_corporal` DECIMAL(5,3) NULL DEFAULT NULL,
  `frecuencia_cardiaca` INT(11) NOT NULL,
  `frecuencia_respiratoria` INT(11) NOT NULL,
  `saturacion_oxigeno` INT(11) NOT NULL,
  `soporte_oxigeno` VARCHAR(50) NULL DEFAULT NULL,
  `flujo_oxigeno_litros` DECIMAL(4,1) NULL DEFAULT NULL,
  `presion_sistolica` INT(11) NOT NULL,
  `presion_diastolica` INT(11) NOT NULL,
  `extremidad_presion` VARCHAR(50) NOT NULL,
  `percentil_presion` VARCHAR(50) NULL DEFAULT NULL,
  `estado_perfusion` VARCHAR(50) NOT NULL,
  `hallazgo_piel` VARCHAR(150) NULL DEFAULT NULL,
  `inspeccion_torax` VARCHAR(150) NULL DEFAULT NULL,
  `cicatriz_esternotomia` TINYINT(1) NOT NULL DEFAULT 0,
  `cicatriz_toracotomia` TINYINT(1) NOT NULL DEFAULT 0,
  `palpacion_precordial` VARCHAR(150) NULL DEFAULT NULL,
  `fremito_presente` TINYINT(1) NOT NULL DEFAULT 0,
  `fremito_localizacion` VARCHAR(100) NULL DEFAULT NULL,
  `latido_sistolico` VARCHAR(50) NULL DEFAULT NULL,
  `auscultacion_pulmonar` VARCHAR(255) NULL DEFAULT NULL,
  `trabajo_respiratorio` VARCHAR(150) NULL DEFAULT NULL,
  `ruidos_cardiacos` VARCHAR(255) NULL DEFAULT NULL,
  `s1_tipo` VARCHAR(150) NULL DEFAULT NULL,
  `s1_soplo_presente` VARCHAR(10) NULL DEFAULT 'No',
  `s1_soplo_fase` VARCHAR(50) NULL DEFAULT NULL,
  `s1_soplo_grado` VARCHAR(20) NULL DEFAULT NULL,
  `s1_soplo_localizacion` VARCHAR(255) NULL DEFAULT NULL,
  `s2_tipo` VARCHAR(150) NULL DEFAULT NULL,
  `s2_soplo_presente` VARCHAR(10) NULL DEFAULT 'No',
  `s2_soplo_fase` VARCHAR(50) NULL DEFAULT NULL,
  `s2_soplo_grado` VARCHAR(20) NULL DEFAULT NULL,
  `s2_soplo_localizacion` VARCHAR(255) NULL DEFAULT NULL,
  `inspeccion_abdominal` VARCHAR(50) NULL DEFAULT NULL,
  `auscultacion_abdominal` VARCHAR(100) NULL DEFAULT NULL,
  `hepatomegalia` TINYINT(1) NOT NULL DEFAULT 0,
  `borde_hepatico_cm` DECIMAL(4,1) NULL DEFAULT NULL,
  `esplenomegalia` TINYINT(1) NOT NULL DEFAULT 0,
  `llenado_capilar_segundos` DECIMAL(3,1) NOT NULL,
  `pulso_amplitud` VARCHAR(50) NOT NULL,
  `pulso_localizacion` VARCHAR(50) NOT NULL,
  `nivel_conciencia` VARCHAR(50) NOT NULL,
  `glasgow_total` INT(11) NULL DEFAULT NULL,
  `pupilas_simetria` VARCHAR(50) NOT NULL,
  `tono_muscular` VARCHAR(50) NOT NULL,
  `perimetro_cefalico_cm` DECIMAL(4,1) NULL DEFAULT NULL,
  `fontanela_anterior` VARCHAR(50) NULL DEFAULT NULL,
  `observacion_general` TEXT NULL DEFAULT NULL,
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. TABLA: estudio_radiografia
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `estudio_radiografia` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `registro_solicitud_id` INT(11) NOT NULL,
  `hospitalizacion_id` INT(11) NULL DEFAULT NULL,
  `fecha_estudio` DATE NOT NULL,
  `hora_estudio` TIME NULL DEFAULT NULL,
  `proyeccion` VARCHAR(50) NOT NULL,
  `calidad_tecnica` VARCHAR(50) NULL DEFAULT NULL,
  `indice_cardiotoracico` DECIMAL(4,2) NULL DEFAULT NULL,
  `cardiomegalia` VARCHAR(50) NULL DEFAULT NULL,
  `flujo_pulmonar` VARCHAR(100) NULL DEFAULT NULL,
  `hallazgos_pleurales` VARCHAR(255) NULL DEFAULT NULL,
  `dispositivos_tubos` TEXT NULL DEFAULT NULL,
  `conclusion_informe` TEXT NOT NULL,
  `estatus_informe` VARCHAR(50) NOT NULL DEFAULT 'Borrador',
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. TABLA: estudio_cateterismo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `estudio_cateterismo` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `registro_solicitud_id` INT(11) NOT NULL,
  `hospitalizacion_id` INT(11) NULL DEFAULT NULL,
  `fecha_procedimiento` DATE NOT NULL,
  `tipo_cateterismo` VARCHAR(100) NOT NULL,
  `sitio_acceso_vascular` VARCHAR(150) NOT NULL,
  `presion_auricula_derecha` DECIMAL(5,2) NULL DEFAULT NULL,
  `presion_ventriculo_derecho` DECIMAL(5,2) NULL DEFAULT NULL,
  `presion_arteria_pulmonar` DECIMAL(5,2) NULL DEFAULT NULL,
  `presion_auricula_izquierda` DECIMAL(5,2) NULL DEFAULT NULL,
  `presion_ventriculo_izquierdo` DECIMAL(5,2) NULL DEFAULT NULL,
  `presion_aorta` DECIMAL(5,2) NULL DEFAULT NULL,
  `gasto_cardiaco_qp` DECIMAL(5,2) NULL DEFAULT NULL,
  `gasto_cardiaco_qs` DECIMAL(5,2) NULL DEFAULT NULL,
  `relacion_qp_qs` DECIMAL(5,2) NULL DEFAULT NULL,
  `intervencion_realizada` TEXT NULL DEFAULT NULL,
  `dispositivo_implantado` VARCHAR(255) NULL DEFAULT NULL,
  `complicaciones` TEXT NULL DEFAULT NULL,
  `estatus_informe` VARCHAR(50) NOT NULL DEFAULT 'Borrador',
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 13. TABLA: procedimiento_quirurgico (Cirugía Cardiovascular)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `procedimiento_quirurgico` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `registro_solicitud_id` INT(11) NOT NULL,
  `hospitalizacion_id` INT(11) NULL DEFAULT NULL,
  `fecha_cirugia` DATE NOT NULL,
  `diagnostico_preoperatorio` VARCHAR(255) NOT NULL,
  `diagnostico_postoperatorio` VARCHAR(255) NOT NULL,
  `cirugia_propuesta` VARCHAR(255) NOT NULL,
  `cirugia_realizada` TEXT NOT NULL,
  `cirujano_principal` VARCHAR(150) NOT NULL,
  `primer_ayudante` VARCHAR(150) NULL DEFAULT NULL,
  `anestesiologo` VARCHAR(150) NULL DEFAULT NULL,
  `tiempo_anestesia_minutos` INT(11) NULL DEFAULT NULL,
  `requirio_cec` TINYINT(1) NOT NULL DEFAULT 0,
  `tiempo_cec_minutos` INT(11) NULL DEFAULT NULL,
  `tiempo_clampeo_minutos` INT(11) NULL DEFAULT NULL,
  `tiempo_paro_circulatorio_minutos` INT(11) NULL DEFAULT NULL,
  `temperatura_minima_cec` DECIMAL(4,1) NULL DEFAULT NULL,
  `cardioplejia_tipo` VARCHAR(100) NULL DEFAULT NULL,
  `drenajes_colocados` VARCHAR(255) NULL DEFAULT NULL,
  `hallazgos_operatorios` TEXT NOT NULL,
  `estatus_nota` VARCHAR(50) NOT NULL DEFAULT 'Borrador',
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 14. TABLA: laboratorio_estudio
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `laboratorio_estudio` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `registro_solicitud_id` INT(11) NOT NULL,
  `hospitalizacion_id` INT(11) NULL DEFAULT NULL,
  `tipo_analisis` VARCHAR(100) NOT NULL,
  `fecha_toma_muestra` DATE NOT NULL,
  `hora_toma_muestra` TIME NULL DEFAULT NULL,
  `analito_parametro` VARCHAR(100) NOT NULL,
  `resultado_valor` VARCHAR(50) NOT NULL,
  `unidad_medida` VARCHAR(30) NULL DEFAULT NULL,
  `valor_referencia_minimo` VARCHAR(50) NULL DEFAULT NULL,
  `valor_referencia_maximo` VARCHAR(50) NULL DEFAULT NULL,
  `es_valor_critico` TINYINT(1) NOT NULL DEFAULT 0,
  `observaciones` TEXT NULL DEFAULT NULL,
  `estatus_analisis` VARCHAR(50) NOT NULL DEFAULT 'Finalizado',
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 15. TABLA: evolucion_diaria (Seguimiento clínico hospitalario)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `evolucion_diaria` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `registro_solicitud_id` INT(11) NOT NULL,
  `hospitalizacion_id` INT(11) NULL DEFAULT NULL,
  `fecha_evolucion` DATE NOT NULL,
  `hora_evolucion` TIME NOT NULL,
  `dia_hospitalizacion` INT(11) NOT NULL DEFAULT 1,
  `dia_postoperatorio` INT(11) NULL DEFAULT NULL,
  `subjetivo_evolucion` TEXT NOT NULL,
  `neurologico` TEXT NULL DEFAULT NULL,
  `cardiovascular` TEXT NULL DEFAULT NULL,
  `respiratorio` TEXT NULL DEFAULT NULL,
  `gastrointestinal_nutricion` TEXT NULL DEFAULT NULL,
  `renal_liquidos` TEXT NULL DEFAULT NULL,
  `infeccioso_laboratorio` TEXT NULL DEFAULT NULL,
  `impresion_diagnostica_plan` TEXT NOT NULL,
  `estatus_nota` VARCHAR(50) NOT NULL DEFAULT 'Borrador',
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 16. TABLA: egreso_hospitalario
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `egreso_hospitalario` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `registro_solicitud_id` INT(11) NOT NULL,
  `hospitalizacion_id` INT(11) NULL DEFAULT NULL,
  `fecha_ingreso` DATE NOT NULL,
  `fecha_egreso` DATE NOT NULL,
  `motivo_egreso` VARCHAR(100) NOT NULL,
  `diagnostico_ingreso` VARCHAR(255) NOT NULL,
  `diagnostico_principal_egreso` VARCHAR(255) NOT NULL,
  `diagnosticos_secundarios` TEXT NULL DEFAULT NULL,
  `resumen_hospitalizacion` TEXT NOT NULL,
  `procedimientos_intervenciones` TEXT NULL DEFAULT NULL,
  `condicion_salida` VARCHAR(100) NOT NULL,
  `conciliacion_medicacion_alta` TEXT NOT NULL,
  `indicaciones_cuidados_generales` TEXT NOT NULL,
  `plan_citas_control` TEXT NULL DEFAULT NULL,
  `estatus_alta` VARCHAR(50) NOT NULL DEFAULT 'Borrador',
  `fecha_creacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `audit_usu_id` VARCHAR(255) NULL DEFAULT NULL,
  `audit_ip` VARCHAR(45) NULL DEFAULT NULL,
  `audit_dep_id` VARCHAR(50) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 17. POBLADO DE CATÁLOGOS EN `lista_tipo_general`
-- Tipos extraídos de hcil_agenda_identificacion_v17.html
-- =============================================================================

-- Tipo de Citas de Agenda
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('tipo_cita', 'Cita de primera vez', NULL, 1, 1),
('tipo_cita', 'Cita control', NULL, 2, 1);

-- Procedimientos Cardiovasculares Planificados (Precarga)
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('tipo_procedimiento', 'Cateterismo diagnóstico', NULL, 1, 1),
('tipo_procedimiento', 'Cateterismo intervencionista', NULL, 2, 1),
('tipo_procedimiento', 'Cirugía correctora con CEC', NULL, 3, 1),
('tipo_procedimiento', 'Cirugía paliativa sin CEC', NULL, 4, 1),
('tipo_procedimiento', 'Colocación de marcapasos', NULL, 5, 1),
('tipo_procedimiento', 'Revisión / recambio de marcapasos', NULL, 6, 1),
('tipo_procedimiento', 'Ecocardiograma especializado', NULL, 7, 1);

-- Tipos de Documentos de Identidad
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('tipo_documento', 'Cédula', NULL, 1, 1),
('tipo_documento', 'Pasaporte', NULL, 2, 1),
('tipo_documento', 'No posee', NULL, 3, 1);

-- Sexo
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('sexo', 'Masculino', NULL, 1, 1),
('sexo', 'Femenino', NULL, 2, 1);

-- Parentesco de Contacto Responsable
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('parentesco', 'Madre', NULL, 1, 1),
('parentesco', 'Padre', NULL, 2, 1),
('parentesco', 'Abuela', NULL, 3, 1),
('parentesco', 'Abuelo', NULL, 4, 1),
('parentesco', 'Tía', NULL, 5, 1),
('parentesco', 'Tío', NULL, 6, 1),
('parentesco', 'Hermana', NULL, 7, 1),
('parentesco', 'Hermano', NULL, 8, 1),
('parentesco', 'Tutor legal', NULL, 9, 1),
('parentesco', 'Otro', NULL, 10, 1);

-- Idiomas del Sistema
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('idioma', 'Español', NULL, 1, 1),
('idioma', 'Inglés', NULL, 2, 1),
('idioma', 'Portugués', NULL, 3, 1),
('idioma', 'Wayuunaiki / Wayuu', NULL, 4, 1),
('idioma', 'Warao', NULL, 5, 1),
('idioma', 'Pemón', NULL, 6, 1),
('idioma', 'Otro idioma', NULL, 7, 1);

-- Manifestaciones Iniciales de Cardiopatía Congénita
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('presentacion_cc', 'Soplo', NULL, 1, 1),
('presentacion_cc', 'Cianosis', NULL, 2, 1),
('presentacion_cc', 'Dificultad respiratoria', NULL, 3, 1),
('presentacion_cc', 'Fatiga', NULL, 4, 1),
('presentacion_cc', 'Falla de medro', NULL, 5, 1),
('presentacion_cc', 'Anomalías múltiples', NULL, 6, 1),
('presentacion_cc', 'Antecedente familiar de cardiopatía congénita', NULL, 7, 1),
('presentacion_cc', 'Otro', NULL, 8, 1);

-- Intervenciones Previas CC
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('intervencion_previa_cc', 'Medicamentos', NULL, 1, 1),
('intervencion_previa_cc', 'Profilaxis de endocarditis', NULL, 2, 1),
('intervencion_previa_cc', 'Cateterismo cardíaco', NULL, 3, 1),
('intervencion_previa_cc', 'Cateterismo intervencionista', NULL, 4, 1),
('intervencion_previa_cc', 'Cirugía cardíaca', NULL, 5, 1),
('intervencion_previa_cc', 'Ninguna', NULL, 6, 1);

-- Síndromes Genéticos Frecuentes
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('sindrome_genetico', 'Trisomía 21 (Down)', NULL, 1, 1),
('sindrome_genetico', 'Trisomía 18 (Edwards)', NULL, 2, 1),
('sindrome_genetico', 'Trisomía 13 (Patau)', NULL, 3, 1),
('sindrome_genetico', 'Síndrome de Turner', NULL, 4, 1),
('sindrome_genetico', 'Deleción 22q11 / DiGeorge', NULL, 5, 1),
('sindrome_genetico', 'Síndrome de Marfan', NULL, 6, 1),
('sindrome_genetico', 'Síndrome de Noonan', NULL, 7, 1),
('sindrome_genetico', 'Síndrome de Williams', NULL, 8, 1),
('sindrome_genetico', 'Otro', NULL, 9, 1);

-- Fases de Soplos Cardíacos
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('fase_soplo', 'Protosistólico', NULL, 1, 1),
('fase_soplo', 'Mesosistólico', NULL, 2, 1),
('fase_soplo', 'Holosistólico', NULL, 3, 1),
('fase_soplo', 'Continuo', NULL, 4, 1),
('fase_soplo', 'Protodiastólico', NULL, 5, 1),
('fase_soplo', 'Mesodiastólico', NULL, 6, 1);

-- Grados de Soplos Cardíacos (Escala Levine)
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('grado_soplo', 'I/VI', NULL, 1, 1),
('grado_soplo', 'II/VI', NULL, 2, 1),
('grado_soplo', 'III/VI', NULL, 3, 1),
('grado_soplo', 'IV/VI', NULL, 4, 1),
('grado_soplo', 'V/VI', NULL, 5, 1),
('grado_soplo', 'VI/VI', NULL, 6, 1);

-- Localización / Focos de Auscultación Precordial
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('foco_auscultacion', 'Foco aórtico', NULL, 1, 1),
('foco_auscultacion', 'Foco pulmonar', NULL, 2, 1),
('foco_auscultacion', 'Foco aórtico accesorio', NULL, 3, 1),
('foco_auscultacion', 'Foco tricuspídeo', NULL, 4, 1),
('foco_auscultacion', 'Foco mitral (Ápex)', NULL, 5, 1),
('foco_auscultacion', 'Borde esternal medio izquierdo', NULL, 6, 1),
('foco_auscultacion', 'Borde esternal inferior izquierdo', NULL, 7, 1),
('foco_auscultacion', 'Espalda / interescapular', NULL, 8, 1);

-- Escala de Amplitud de Pulsos Arteriales
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('amplitud_pulso', '0 (Ausente)', NULL, 1, 1),
('amplitud_pulso', '1+ (Disminuido)', NULL, 2, 1),
('amplitud_pulso', '2+ (Normal)', NULL, 3, 1),
('amplitud_pulso', '3+ (Aumentado)', NULL, 4, 1),
('amplitud_pulso', '4+ (Salton / Water Hammer)', NULL, 5, 1);

-- Estados de Citas, Solicitudes y Documentos
INSERT INTO `lista_tipo_general` (`tipo`, `nombre`, `padre_id`, `orden`, `estatus`) VALUES
('estatus_registro', 'Pendiente', NULL, 1, 1),
('estatus_registro', 'Aprobada', NULL, 2, 1),
('estatus_registro', 'Programada', NULL, 3, 1),
('estatus_registro', 'Atendida', NULL, 4, 1),
('estatus_registro', 'Cancelada', NULL, 5, 1),
('estatus_registro', 'Rechazada', NULL, 6, 1),
('estatus_documento', 'Borrador', NULL, 1, 1),
('estatus_documento', 'Firmado', NULL, 2, 1),
('estatus_documento', 'Anulado', NULL, 3, 1);

-- -----------------------------------------------------------------------------
-- RESTRICCIONES DE CLAVE FORÁNEA (Foreign Keys)
-- -----------------------------------------------------------------------------
ALTER TABLE `registro_solicitud`
  ADD CONSTRAINT `fk_solicitud_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `paciente` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_solicitud_tipo_cita` FOREIGN KEY (`tipo_cita_id`) REFERENCES `lista_tipo_general` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_solicitud_procedimiento` FOREIGN KEY (`procedimiento_planificado_id`) REFERENCES `lista_tipo_general` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `historia_antecedente`
  ADD CONSTRAINT `fk_antecedente_solicitud` FOREIGN KEY (`registro_solicitud_id`) REFERENCES `registro_solicitud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `historia_medicamento_habitual`
  ADD CONSTRAINT `fk_medicamento_solicitud` FOREIGN KEY (`registro_solicitud_id`) REFERENCES `registro_solicitud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `historia_alergia`
  ADD CONSTRAINT `fk_alergia_solicitud` FOREIGN KEY (`registro_solicitud_id`) REFERENCES `registro_solicitud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `historia_examen_fisico`
  ADD CONSTRAINT `fk_examen_solicitud` FOREIGN KEY (`registro_solicitud_id`) REFERENCES `registro_solicitud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `estudio_radiografia`
  ADD CONSTRAINT `fk_radiografia_solicitud` FOREIGN KEY (`registro_solicitud_id`) REFERENCES `registro_solicitud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `estudio_cateterismo`
  ADD CONSTRAINT `fk_cateterismo_solicitud` FOREIGN KEY (`registro_solicitud_id`) REFERENCES `registro_solicitud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `procedimiento_quirurgico`
  ADD CONSTRAINT `fk_cirugia_solicitud` FOREIGN KEY (`registro_solicitud_id`) REFERENCES `registro_solicitud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `laboratorio_estudio`
  ADD CONSTRAINT `fk_laboratorio_solicitud` FOREIGN KEY (`registro_solicitud_id`) REFERENCES `registro_solicitud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `evolucion_diaria`
  ADD CONSTRAINT `fk_evolucion_solicitud` FOREIGN KEY (`registro_solicitud_id`) REFERENCES `registro_solicitud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `egreso_hospitalario`
  ADD CONSTRAINT `fk_egreso_solicitud` FOREIGN KEY (`registro_solicitud_id`) REFERENCES `registro_solicitud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;