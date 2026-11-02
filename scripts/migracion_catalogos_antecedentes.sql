-- migracion_antecedentes.sql
-- Fase 1: Catálogos en lista_tipo_general y Esquema de Tablas para Antecedentes Clínicos

USE `pediatrico`;

-- 1. Inserción de Catálogos en lista_tipo_general sin duplicados
-- Helper procedure or INSERT ... SELECT WHERE NOT EXISTS

INSERT INTO lista_tipo_general (tipo, nombre, orden, estatus)
SELECT * FROM (
    -- respuesta_clinica
    SELECT 'respuesta_clinica' AS tipo, 'Sí' AS nombre, 1 AS orden, 1 AS estatus UNION ALL
    SELECT 'respuesta_clinica', 'No', 2, 1 UNION ALL
    SELECT 'respuesta_clinica', 'Desconocido', 3, 1 UNION ALL

    -- estado_alergia
    SELECT 'estado_alergia', 'Sí', 1, 1 UNION ALL
    SELECT 'estado_alergia', 'No conocidas', 2, 1 UNION ALL
    SELECT 'estado_alergia', 'Desconocido', 3, 1 UNION ALL

    -- unidad_edad_cc
    SELECT 'unidad_edad_cc', 'Días', 1, 1 UNION ALL
    SELECT 'unidad_edad_cc', 'Semanas', 2, 1 UNION ALL
    SELECT 'unidad_edad_cc', 'Meses', 3, 1 UNION ALL
    SELECT 'unidad_edad_cc', 'Años', 4, 1 UNION ALL

    -- unidad_edad_kawasaki
    SELECT 'unidad_edad_kawasaki', 'Días', 1, 1 UNION ALL
    SELECT 'unidad_edad_kawasaki', 'Meses', 2, 1 UNION ALL
    SELECT 'unidad_edad_kawasaki', 'Años', 3, 1 UNION ALL

    -- presentacion_cc
    SELECT 'presentacion_cc', 'Soplo', 1, 1 UNION ALL
    SELECT 'presentacion_cc', 'Cianosis', 2, 1 UNION ALL
    SELECT 'presentacion_cc', 'Dificultad respiratoria', 3, 1 UNION ALL
    SELECT 'presentacion_cc', 'Fatiga', 4, 1 UNION ALL
    SELECT 'presentacion_cc', 'Falla de medro', 5, 1 UNION ALL
    SELECT 'presentacion_cc', 'Anomalías múltiples', 6, 1 UNION ALL
    SELECT 'presentacion_cc', 'Antecedente familiar de cardiopatía congénita', 7, 1 UNION ALL
    SELECT 'presentacion_cc', 'Otro', 8, 1 UNION ALL

    -- intervencion_previa_cc
    SELECT 'intervencion_previa_cc', 'Medicamentos', 1, 1 UNION ALL
    SELECT 'intervencion_previa_cc', 'Profilaxis de endocarditis', 2, 1 UNION ALL
    SELECT 'intervencion_previa_cc', 'Cateterismo cardíaco', 3, 1 UNION ALL
    SELECT 'intervencion_previa_cc', 'Cateterismo intervencionista', 4, 1 UNION ALL
    SELECT 'intervencion_previa_cc', 'Cirugía cardíaca', 5, 1 UNION ALL
    SELECT 'intervencion_previa_cc', 'Ninguna', 6, 1 UNION ALL

    -- estudio_cv_anormal
    SELECT 'estudio_cv_anormal', 'HOLTER', 1, 1 UNION ALL
    SELECT 'estudio_cv_anormal', 'TAC/ RNM', 2, 1 UNION ALL
    SELECT 'estudio_cv_anormal', 'Otro', 3, 1 UNION ALL

    -- tipo_hipertension_pulmonar
    SELECT 'tipo_hipertension_pulmonar', 'Primaria', 1, 1 UNION ALL
    SELECT 'tipo_hipertension_pulmonar', 'Secundaria', 2, 1 UNION ALL
    SELECT 'tipo_hipertension_pulmonar', 'No determinada', 3, 1 UNION ALL

    -- manifestacion_fiebre_reumatica
    SELECT 'manifestacion_fiebre_reumatica', 'Carditis', 1, 1 UNION ALL
    SELECT 'manifestacion_fiebre_reumatica', 'Poliartritis', 2, 1 UNION ALL
    SELECT 'manifestacion_fiebre_reumatica', 'Nódulos subcutáneos', 3, 1 UNION ALL
    SELECT 'manifestacion_fiebre_reumatica', 'Eritema marginado', 4, 1 UNION ALL
    SELECT 'manifestacion_fiebre_reumatica', 'Corea de Sydenham', 5, 1 UNION ALL
    SELECT 'manifestacion_fiebre_reumatica', 'Evidencia de infección estreptocócica previa', 6, 1 UNION ALL
    SELECT 'manifestacion_fiebre_reumatica', 'Otro', 7, 1 UNION ALL

    -- medicamento_fiebre_reumatica
    SELECT 'medicamento_fiebre_reumatica', 'Aspirina', 1, 1 UNION ALL
    SELECT 'medicamento_fiebre_reumatica', 'Esteroides', 2, 1 UNION ALL
    SELECT 'medicamento_fiebre_reumatica', 'Medicamentos anticongestivos', 3, 1 UNION ALL
    SELECT 'medicamento_fiebre_reumatica', 'Penicilina', 4, 1 UNION ALL
    SELECT 'medicamento_fiebre_reumatica', 'Otro', 5, 1 UNION ALL

    -- cirugia_fiebre_reumatica
    SELECT 'cirugia_fiebre_reumatica', 'Valvuloplastia', 1, 1 UNION ALL
    SELECT 'cirugia_fiebre_reumatica', 'Reemplazo valvular', 2, 1 UNION ALL
    SELECT 'cirugia_fiebre_reumatica', 'Ninguna', 3, 1 UNION ALL

    -- sindrome_genetico (19 opciones estándar)
    SELECT 'sindrome_genetico', 'Trisomía 13', 1, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Trisomía 18', 2, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Trisomía 21', 3, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Síndrome de Turner', 4, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Síndrome de Loeys-Dietz', 5, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Síndrome de Noonan', 6, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Síndrome de Williams', 7, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Deleción 22q11 / DiGeorge', 8, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Síndrome de Marfan', 9, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Asociación VACTERL', 10, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Asociación / síndrome CHARGE', 11, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Síndrome alcohólico fetal', 12, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Síndrome de Ehlers-Danlos', 13, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Osteogénesis imperfecta', 14, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Enfermedad por almacenamiento de glucógeno', 15, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Mucopolisacaridosis', 16, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Esclerosis tuberosa', 17, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Otro', 18, 1 UNION ALL
    SELECT 'sindrome_genetico', 'Desconocido', 19, 1 UNION ALL

    -- tipo_miopatia (9 opciones)
    SELECT 'tipo_miopatia', 'Duchenne', 1, 1 UNION ALL
    SELECT 'tipo_miopatia', 'Becker', 2, 1 UNION ALL
    SELECT 'tipo_miopatia', 'Distrofia de cinturas', 3, 1 UNION ALL
    SELECT 'tipo_miopatia', 'Distrofia miotónica', 4, 1 UNION ALL
    SELECT 'tipo_miopatia', 'Enfermedad mitocondrial', 5, 1 UNION ALL
    SELECT 'tipo_miopatia', 'Defecto de fosforilación oxidativa', 6, 1 UNION ALL
    SELECT 'tipo_miopatia', 'Enfermedad por almacenamiento de glucógeno', 7, 1 UNION ALL
    SELECT 'tipo_miopatia', 'Trastorno de oxidación de ácidos grasos', 8, 1 UNION ALL
    SELECT 'tipo_miopatia', 'Otro', 9, 1 UNION ALL

    -- categoria_diagnostico_no_cv (14 categorías)
    SELECT 'categoria_diagnostico_no_cv', 'Respiratorio', 1, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Neurológico', 2, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Endocrino', 3, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Gastrointestinal', 4, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Hematológico', 5, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Hemoglobinopatía', 6, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Reumatológico', 7, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Renal', 8, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Musculoesquelético', 9, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Dermatológico', 10, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Desarrollo', 11, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Otorrinolaringológico', 12, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Salud mental', 13, 1 UNION ALL
    SELECT 'categoria_diagnostico_no_cv', 'Otro', 14, 1 UNION ALL

    -- tipo_cirugia_no_cv (13 procedimientos + Otro)
    SELECT 'tipo_cirugia_no_cv', 'Amigdalectomía', 1, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Adenoidectomía', 2, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Miringotomía con tubos', 3, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Herniorrafia', 4, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Reparación de paladar hendido', 5, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Extracción dental', 6, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Fusión espinal', 7, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Gastrostomía/funduplicatura', 8, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Funduplicatura', 9, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Catéter venoso central', 10, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Derivación ventriculoperitoneal', 11, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Procedimiento de Ladd / malrotación intestinal', 12, 1 UNION ALL
    SELECT 'tipo_cirugia_no_cv', 'Otro', 13, 1 UNION ALL

    -- unidad_dosis_medicamento
    SELECT 'unidad_dosis_medicamento', 'mg', 1, 1 UNION ALL
    SELECT 'unidad_dosis_medicamento', 'mcg', 2, 1 UNION ALL
    SELECT 'unidad_dosis_medicamento', 'g', 3, 1 UNION ALL
    SELECT 'unidad_dosis_medicamento', 'mL', 4, 1 UNION ALL
    SELECT 'unidad_dosis_medicamento', 'UI', 5, 1 UNION ALL
    SELECT 'unidad_dosis_medicamento', 'Otra', 6, 1 UNION ALL

    -- frecuencia_medicamento
    SELECT 'frecuencia_medicamento', 'Cada 4 horas', 1, 1 UNION ALL
    SELECT 'frecuencia_medicamento', 'Cada 6 horas', 2, 1 UNION ALL
    SELECT 'frecuencia_medicamento', 'Cada 8 horas', 3, 1 UNION ALL
    SELECT 'frecuencia_medicamento', 'Cada 12 horas', 4, 1 UNION ALL
    SELECT 'frecuencia_medicamento', 'Cada 24 horas', 5, 1 UNION ALL
    SELECT 'frecuencia_medicamento', 'Semanal', 6, 1 UNION ALL
    SELECT 'frecuencia_medicamento', 'Según necesidad', 7, 1 UNION ALL
    SELECT 'frecuencia_medicamento', 'Otra', 8, 1 UNION ALL

    -- via_administracion_medicamento
    SELECT 'via_administracion_medicamento', 'Oral', 1, 1 UNION ALL
    SELECT 'via_administracion_medicamento', 'Sublingual', 2, 1 UNION ALL
    SELECT 'via_administracion_medicamento', 'Intravenosa', 3, 1 UNION ALL
    SELECT 'via_administracion_medicamento', 'Intramuscular', 4, 1 UNION ALL
    SELECT 'via_administracion_medicamento', 'Subcutánea', 5, 1 UNION ALL
    SELECT 'via_administracion_medicamento', 'Inhalatoria', 6, 1 UNION ALL
    SELECT 'via_administracion_medicamento', 'Tópica', 7, 1 UNION ALL
    SELECT 'via_administracion_medicamento', 'Sonda enteral', 8, 1 UNION ALL
    SELECT 'via_administracion_medicamento', 'Otra', 9, 1 UNION ALL

    -- tipo_alergia
    SELECT 'tipo_alergia', 'Medicamento', 1, 1 UNION ALL
    SELECT 'tipo_alergia', 'Alimento', 2, 1 UNION ALL
    SELECT 'tipo_alergia', 'Otra', 3, 1 UNION ALL

    -- severidad_alergia
    SELECT 'severidad_alergia', 'Leve', 1, 1 UNION ALL
    SELECT 'severidad_alergia', 'Moderada', 2, 1 UNION ALL
    SELECT 'severidad_alergia', 'Grave', 3, 1 UNION ALL
    SELECT 'severidad_alergia', 'Desconocida', 4, 1 UNION ALL

    -- parentesco_antecedente_familiar
    SELECT 'parentesco_antecedente_familiar', 'Madre', 1, 1 UNION ALL
    SELECT 'parentesco_antecedente_familiar', 'Padre', 2, 1 UNION ALL
    SELECT 'parentesco_antecedente_familiar', 'Hermano(a)', 3, 1 UNION ALL
    SELECT 'parentesco_antecedente_familiar', 'Hijo(a)', 4, 1 UNION ALL
    SELECT 'parentesco_antecedente_familiar', 'Abuelo(a)', 5, 1 UNION ALL
    SELECT 'parentesco_antecedente_familiar', 'Tío(a)', 6, 1 UNION ALL
    SELECT 'parentesco_antecedente_familiar', 'Primo(a)', 7, 1 UNION ALL
    SELECT 'parentesco_antecedente_familiar', 'Otro', 8, 1 UNION ALL

    -- condicion_cv_familiar (19 patologías CV familiares)
    SELECT 'condicion_cv_familiar', 'Cardiopatía congénita', 1, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Cardiomiopatía', 2, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Síndrome de QT largo', 3, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Arritmia', 4, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Muerte súbita cardíaca', 5, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Síndrome de muerte súbita del lactante', 6, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Síndrome de muerte súbita arrítmica', 7, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Síndrome de Marfan', 8, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Síndrome de Ehlers-Danlos', 9, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Enfermedad coronaria', 10, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Infarto de miocardio', 11, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Cirugía de revascularización coronaria', 12, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Intervención coronaria percutánea', 13, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Hipertensión arterial', 14, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Hiperlipidemia', 15, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Accidente cerebrovascular', 16, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Síncope', 17, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Fiebre/cardiopatía reumática', 18, 1 UNION ALL
    SELECT 'condicion_cv_familiar', 'Otro', 19, 1 UNION ALL

    -- nivel_escolaridad
    SELECT 'nivel_escolaridad', 'No escolarizado', 1, 1 UNION ALL
    SELECT 'nivel_escolaridad', 'Educación inicial', 2, 1 UNION ALL
    SELECT 'nivel_escolaridad', 'Primaria', 3, 1 UNION ALL
    SELECT 'nivel_escolaridad', 'Secundaria', 4, 1 UNION ALL
    SELECT 'nivel_escolaridad', 'Universitaria', 5, 1 UNION ALL
    SELECT 'nivel_escolaridad', 'Otra', 6, 1 UNION ALL
    SELECT 'nivel_escolaridad', 'Desconocida', 7, 1
) AS nuevos
WHERE NOT EXISTS (
    SELECT 1 FROM lista_tipo_general e 
    WHERE e.tipo = nuevos.tipo AND e.nombre = nuevos.nombre
);

