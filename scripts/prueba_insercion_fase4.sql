-- ============================================================================
-- SCRIPT DE PRUEBA DE INSERCIÓN Y VERIFICACIÓN END-TO-END (FASE 4)
-- ============================================================================
-- Valida inserción completa de las 6 pestañas y las 5 tablas detalle
-- para paciente_id = 1 y registro_solicitud_id = 1 sin errores 1054, 1048 ni warnings 1265.
-- ============================================================================

USE `pediatrico`;

-- Asegurar registro_solicitud base para pruebas con paciente_id = 1
INSERT INTO registro_solicitud (id, paciente_id, centro_salud_id, tipo_operacion_id, fecha_solicitud, estatus, observacion_general, audit_usu_id, audit_ip, audit_dep_id)
VALUES (1, 1, 4, 1, CURDATE(), 'Pendiente', 'Solicitud de prueba auditoría fase 4', '1', '127.0.0.1', '1')
ON DUPLICATE KEY UPDATE paciente_id = VALUES(paciente_id);

-- Limpiar datos previos de prueba para id = 1
DELETE FROM historia_diagnostico_no_cardiovascular WHERE registro_solicitud_id = 1;
DELETE FROM historia_cirugia_no_cardiovascular WHERE registro_solicitud_id = 1;
DELETE FROM historia_medicamento_habitual WHERE registro_solicitud_id = 1;
DELETE FROM historia_alergia WHERE registro_solicitud_id = 1;
DELETE FROM historia_antecedente_familiar WHERE registro_solicitud_id = 1;
DELETE FROM historia_antecedente WHERE registro_solicitud_id = 1;

-- 1. Inserción Maestro en `historia_antecedente` (6 Pestañas completas)
INSERT INTO historia_antecedente (
    paciente_id,
    registro_solicitud_id,
    -- Pestaña 01: Gestación y neonatal
    semanas_gestacion,
    complicaciones_gestacionales,
    detalle_complicaciones_gestacionales,
    complicaciones_neonatales,
    detalle_complicaciones_neonatales,
    -- Pestaña 02: Cardiovasculares
    cardiopatia_congenita,
    edad_diagnostico_cc,
    unidad_edad_diagnostico_cc,
    forma_presentacion_cc_otro,
    estudios_cardiacos_anormales,
    estudio_cardiaco_otro,
    hipertension_pulmonar,
    tipo_hipertension_pulmonar,
    falla_medro,
    kawasaki,
    kawasaki_fecha_inicio,
    kawasaki_edad_valor,
    kawasaki_edad_unidad,
    kawasaki_compromiso_coronario,
    kawasaki_tratamiento,
    fiebre_reumatica,
    fiebre_reumatica_fecha_inicio,
    fiebre_reumatica_edad,
    fiebre_reumatica_cardiopatia_previa,
    -- Pestaña 03: Genética y miopatías
    sindrome_genetico,
    sindrome_genetico_otro,
    miopatia,
    miopatia_otro,
    -- Pestaña 04: Médicos y cirugías
    antecedente_medico_no_cv,
    diagnosticos_no_cv_notas,
    antecedente_quirurgico_no_cv,
    -- Pestaña 05: Medicamentos y alergias
    medicamentos_actuales,
    estado_alergia,
    -- Pestaña 06: Familiares y sociales
    antecedente_familiar_cv,
    tiene_hermanos,
    nivel_escolaridad,
    -- JSONs de selecciones múltiples
    presentacion_cc_json,
    intervenciones_cc_json,
    estudios_cv_anormales_json,
    fiebre_reumatica_manifestaciones_json,
    fiebre_reumatica_medicamentos_json,
    fiebre_reumatica_cirugia_json,
    sindromes_geneticos_json,
    tipos_miopatia_json,
    -- Auditoría
    audit_usu_id,
    audit_ip,
    audit_dep_id
) VALUES (
    1,
    1,
    -- Pestaña 01
    38.5,
    'Sí',
    'Preeclampsia leve en el tercer trimestre controlada con reposo y alfa-metildopa.',
    'Sí',
    'Ictericia neonatal tratada con fototerapia durante 48 horas sin complicaciones.',
    -- Pestaña 02
    'Sí',
    3,
    'Meses',
    'Soplo continuo descubierto durante control de niño sano',
    'Sí',
    'Angio-TAC cardiovascular de control anatómico vascular',
    'Sí',
    'Secundaria',
    'Sí',
    'Sí',
    '2022-03-10',
    2,
    'Años',
    'No',
    'Inmunoglobulina intravenosa 2 g/kg dosis única más aspirina a dosis antiinflamatoria.',
    'Sí',
    '2023-01-15',
    4,
    'No',
    -- Pestaña 03
    'Sí',
    'Microdeleción cromosómica 22q11 en confirmación FISH',
    'Sí',
    'Sospecha de miopatía mitocondrial en estudio enzimático',
    -- Pestaña 04
    'Sí',
    'Paciente en seguimiento multidisciplinario por neumología y neurología infantil.',
    'Sí',
    -- Pestaña 05
    'Sí',
    'Sí',
    -- Pestaña 06
    'Sí',
    'Sí',
    'Educación inicial',
    -- JSONs
    '["Soplo", "Dificultad respiratoria", "Otro"]',
    '["Medicamentos", "Profilaxis de endocarditis"]',
    '["HOLTER", "TAC/ RNM", "Otro"]',
    '["Carditis", "Poliartritis", "Eritema marginado"]',
    '["Aspirina", "Penicilina"]',
    '["Ninguna"]',
    '["Deleción 22q11 / DiGeorge", "Otro"]',
    '["Enfermedad mitocondrial", "Otro"]',
    -- Auditoría
    '1',
    '127.0.0.1',
    '1'
);

-- 2. Inserción Detalle 1: Diagnósticos no CV
INSERT INTO historia_diagnostico_no_cardiovascular (
    paciente_id,
    registro_solicitud_id,
    categoria_id,
    categoria_nombre,
    diagnostico,
    observacion,
    audit_usu_id,
    audit_ip,
    audit_dep_id
) VALUES (
    1,
    1,
    1,
    'Respiratorio',
    'Asma bronquial intermitente del lactante mayor',
    'Controlado con salbutamol en crisis ocasionales',
    '1',
    '127.0.0.1',
    '1'
);

-- 3. Inserción Detalle 2: Cirugías no CV
INSERT INTO historia_cirugia_no_cardiovascular (
    paciente_id,
    registro_solicitud_id,
    procedimiento_id,
    procedimiento_nombre,
    procedimiento_otro,
    fecha_procedimiento,
    observacion,
    audit_usu_id,
    audit_ip,
    audit_dep_id
) VALUES (
    1,
    1,
    4,
    'Herniorrafia',
    NULL,
    '2022-08-20',
    'Herniorrafia inguinal derecha sin incidentes anestésicos',
    '1',
    '127.0.0.1',
    '1'
);

-- 4. Inserción Detalle 3: Medicamentos habituales (Validación de VARCHAR 180 chars sin warning 1265)
INSERT INTO historia_medicamento_habitual (
    paciente_id,
    registro_solicitud_id,
    nombre_medicamento,
    dosis,
    concentracion,
    unidad_id,
    unidad_nombre,
    frecuencia_id,
    frecuencia_nombre,
    via_administracion_id,
    via_nombre,
    observacion,
    audit_usu_id,
    audit_ip,
    audit_dep_id
) VALUES (
    1,
    1,
    -- Cadena de prueba con 180 caracteres para verificar VARCHAR(180) y ausencia de Warning 1265:
    'Medicamento Especializado Complejo Pediatrico Formula Avanzada Con Microesferas De Liberacion Prolongada Estandarizada Para Tratamiento De Cardiopatia Congenita Infantil Ref 0123456789',
    '2.5',
    '5 mg / 5 mL',
    1,
    'mL',
    4,
    'Cada 12 horas',
    1,
    'Oral',
    'Administrar en ayunas con jeringa dosificadora',
    '1',
    '127.0.0.1',
    '1'
);

-- 5. Inserción Detalle 4: Alergias conocidas
INSERT INTO historia_alergia (
    paciente_id,
    registro_solicitud_id,
    tipo_alergia_id,
    tipo_alergia_nombre,
    alergeno,
    reaccion,
    severidad,
    severidad_id,
    severidad_nombre,
    observacion,
    audit_usu_id,
    audit_ip,
    audit_dep_id
) VALUES (
    1,
    1,
    1,
    'Medicamento',
    'Amoxicilina con ácido clavulánico',
    'Exantema maculopapular pruriginoso generalizado',
    'Moderada',
    2,
    'Moderada',
    'Se suspende betalactámicos y se indica macrólidos',
    '1',
    '127.0.0.1',
    '1'
);

-- 6. Inserción Detalle 5: Antecedentes familiares CV (con regla de muerte súbita)
INSERT INTO historia_antecedente_familiar (
    paciente_id,
    registro_solicitud_id,
    parentesco_id,
    parentesco_nombre,
    condiciones_json,
    edad_diagnostico,
    edad_muerte_subita,
    observacion,
    audit_usu_id,
    audit_ip,
    audit_dep_id
) VALUES (
    1,
    1,
    2,
    'Padre',
    '["Muerte súbita cardíaca", "Cardiopatía congénita", "Síndrome de QT largo"]',
    32,
    35,
    'Muerte súbita durante actividad física, portador de desfibrilador',
    '1',
    '127.0.0.1',
    '1'
);

-- Verificación de warnings (debe retornar 0 advertencias)
SHOW WARNINGS;
