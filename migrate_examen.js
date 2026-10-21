const db = require('./config/db');

(async () => {
    try {
        const [existing] = await db.query('DESCRIBE historia_examen_fisico');
        const existingCols = new Set(existing.map(c => c.Field.toLowerCase()));

        const columnsToAdd = [
            // Tab 01
            { name: 'oxygen_flow', type: 'DECIMAL(4,1) NULL' },
            
            // Tab 02
            { name: 'general_exam_notes', type: 'VARCHAR(500) NULL' },
            { name: 'pmi_side', type: 'VARCHAR(50) NULL' },
            { name: 'pmi_intercostal_space', type: 'VARCHAR(10) NULL' },
            { name: 'pmi_reference_line', type: 'VARCHAR(50) NULL' },
            { name: 'pmi_notes', type: 'VARCHAR(250) NULL' },
            { name: 'precordial_palpation_notes', type: 'VARCHAR(500) NULL' },

            // Tab 03
            { name: 'lung_findings_side', type: 'VARCHAR(50) NULL' },
            { name: 'respiratory_exam_notes', type: 'VARCHAR(500) NULL' },
            { name: 'murmur_s1_pitch', type: 'VARCHAR(50) NULL' },
            { name: 'murmur_s1_character', type: 'VARCHAR(255) NULL' },
            { name: 'murmur_s1_radiation', type: 'VARCHAR(255) NULL' },
            { name: 'murmur_s1_radiation_other', type: 'VARCHAR(150) NULL' },
            { name: 'murmur_s2_pitch', type: 'VARCHAR(50) NULL' },
            { name: 'murmur_s2_character', type: 'VARCHAR(255) NULL' },
            { name: 'murmur_s2_radiation', type: 'VARCHAR(255) NULL' },
            { name: 'murmur_s2_radiation_other', type: 'VARCHAR(150) NULL' },

            // Tab 04
            { name: 'abdominal_palpation', type: 'VARCHAR(255) NULL' },
            { name: 'abdominal_exam_notes', type: 'VARCHAR(500) NULL' },
            { name: 'extremity_appearance', type: 'VARCHAR(255) NULL' },
            { name: 'edema_location', type: 'VARCHAR(255) NULL' },
            { name: 'edema_grade', type: 'VARCHAR(50) NULL' },
            { name: 'extremity_notes', type: 'VARCHAR(500) NULL' },
            { name: 'capillary_refill_status', type: 'VARCHAR(50) NULL' },
            { name: 'pulse_side', type: 'VARCHAR(50) NULL' },
            { name: 'pulse_symmetry', type: 'VARCHAR(50) NULL' },
            { name: 'pulse_symmetry_notes', type: 'VARCHAR(500) NULL' },
            { name: 'external_genital_exam', type: 'VARCHAR(50) NULL' },
            { name: 'external_genital_exam_notes', type: 'VARCHAR(500) NULL' },

            // Tab 05 - Neurología global y mental
            { name: 'neurologic_exam_overall', type: 'VARCHAR(50) NULL' },
            { name: 'neurologic_exam_age_appropriate', type: 'VARCHAR(50) NULL' },
            { name: 'focal_neurologic_deficit', type: 'VARCHAR(50) NULL' },
            { name: 'focal_neurologic_deficit_notes', type: 'VARCHAR(500) NULL' },
            { name: 'response_to_environment', type: 'VARCHAR(50) NULL' },
            { name: 'behavior_status', type: 'VARCHAR(50) NULL' },
            { name: 'behavior_notes', type: 'VARCHAR(500) NULL' },
            { name: 'gcs_required', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'gcs_eye', type: 'TINYINT NULL' },
            { name: 'gcs_verbal', type: 'TINYINT NULL' },
            { name: 'gcs_motor', type: 'TINYINT NULL' },
            { name: 'mental_status', type: 'VARCHAR(50) NULL' },
            { name: 'orientation_person', type: 'VARCHAR(50) NULL' },
            { name: 'orientation_place', type: 'VARCHAR(50) NULL' },
            { name: 'orientation_time', type: 'VARCHAR(50) NULL' },
            { name: 'attention_status', type: 'VARCHAR(50) NULL' },
            { name: 'memory_status', type: 'VARCHAR(50) NULL' },
            { name: 'language_status', type: 'VARCHAR(50) NULL' },
            { name: 'mental_status_notes', type: 'VARCHAR(500) NULL' },
            { name: 'right_pupil_mm', type: 'DECIMAL(3,1) NULL' },
            { name: 'left_pupil_mm', type: 'DECIMAL(3,1) NULL' },
            { name: 'right_pupil_reactivity', type: 'VARCHAR(50) NULL' },
            { name: 'left_pupil_reactivity', type: 'VARCHAR(50) NULL' },

            // Tab 06 - Pares craneales
            { name: 'extraocular_movements', type: 'VARCHAR(50) NULL' },
            { name: 'gaze_alignment', type: 'VARCHAR(50) NULL' },
            { name: 'nystagmus', type: 'VARCHAR(50) NULL' },
            { name: 'nystagmus_notes', type: 'VARCHAR(250) NULL' },
            { name: 'ptosis', type: 'VARCHAR(50) NULL' },
            { name: 'cranial_nerves_json', type: 'LONGTEXT NULL' },
            { name: 'facial_symmetry', type: 'VARCHAR(50) NULL' },
            { name: 'facial_movement', type: 'VARCHAR(50) NULL' },
            { name: 'palate_movement', type: 'VARCHAR(50) NULL' },
            { name: 'swallowing_status', type: 'VARCHAR(50) NULL' },
            { name: 'voice_status', type: 'VARCHAR(50) NULL' },
            { name: 'tongue_movement', type: 'VARCHAR(50) NULL' },

            // Tab 07 - Motricidad y reflejos
            { name: 'spontaneous_movements', type: 'VARCHAR(50) NULL' },
            { name: 'motor_symmetry', type: 'VARCHAR(50) NULL' },
            { name: 'muscle_bulk', type: 'VARCHAR(50) NULL' },
            { name: 'motor_deficit', type: 'VARCHAR(50) NULL' },
            { name: 'motor_deficit_extremities', type: 'VARCHAR(255) NULL' },
            { name: 'pronator_drift', type: 'VARCHAR(50) NULL' },
            { name: 'involuntary_movements', type: 'VARCHAR(255) NULL' },
            { name: 'involuntary_movement_other', type: 'VARCHAR(150) NULL' },
            { name: 'tone_distribution', type: 'VARCHAR(255) NULL' },
            { name: 'tone_symmetry', type: 'VARCHAR(50) NULL' },
            { name: 'strength_assessment_method', type: 'VARCHAR(50) NULL' },
            { name: 'right_upper_strength', type: 'VARCHAR(50) NULL' },
            { name: 'left_upper_strength', type: 'VARCHAR(50) NULL' },
            { name: 'right_lower_strength', type: 'VARCHAR(50) NULL' },
            { name: 'left_lower_strength', type: 'VARCHAR(50) NULL' },
            { name: 'reflexes_matrix_json', type: 'LONGTEXT NULL' },
            { name: 'reflex_symmetry', type: 'VARCHAR(50) NULL' },
            { name: 'clonus_right', type: 'VARCHAR(50) NULL' },
            { name: 'clonus_left', type: 'VARCHAR(50) NULL' },
            { name: 'plantar_response_right', type: 'VARCHAR(50) NULL' },
            { name: 'plantar_response_left', type: 'VARCHAR(50) NULL' },

            // Tab 08 - Sensibilidad, marcha, lactante y meníngeos
            { name: 'light_touch', type: 'VARCHAR(50) NULL' },
            { name: 'pain_sensation', type: 'VARCHAR(50) NULL' },
            { name: 'temperature_sensation', type: 'VARCHAR(50) NULL' },
            { name: 'vibration_sensation', type: 'VARCHAR(50) NULL' },
            { name: 'proprioception', type: 'VARCHAR(50) NULL' },
            { name: 'sensory_deficit_distribution', type: 'VARCHAR(250) NULL' },
            { name: 'coordination_overall', type: 'VARCHAR(50) NULL' },
            { name: 'finger_to_nose', type: 'VARCHAR(50) NULL' },
            { name: 'rapid_alternating_movements', type: 'VARCHAR(50) NULL' },
            { name: 'heel_to_shin', type: 'VARCHAR(50) NULL' },
            { name: 'truncal_ataxia', type: 'VARCHAR(50) NULL' },
            { name: 'balance_status', type: 'VARCHAR(50) NULL' },
            { name: 'romberg_test', type: 'VARCHAR(50) NULL' },
            { name: 'single_leg_stance', type: 'VARCHAR(50) NULL' },
            { name: 'gait_status', type: 'VARCHAR(50) NULL' },
            { name: 'gait_abnormality', type: 'VARCHAR(255) NULL' },
            { name: 'heel_walking', type: 'VARCHAR(50) NULL' },
            { name: 'toe_walking_test', type: 'VARCHAR(50) NULL' },
            { name: 'tandem_gait', type: 'VARCHAR(50) NULL' },
            { name: 'gait_other', type: 'VARCHAR(150) NULL' },
            { name: 'infant_posture', type: 'VARCHAR(50) NULL' },
            { name: 'infant_antigravity_movement', type: 'VARCHAR(50) NULL' },
            { name: 'head_control', type: 'VARCHAR(50) NULL' },
            { name: 'primitive_reflexes_json', type: 'LONGTEXT NULL' },
            { name: 'meningeal_signs_assessed', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'neck_stiffness', type: 'VARCHAR(50) NULL' },
            { name: 'kernig_sign', type: 'VARCHAR(50) NULL' },
            { name: 'brudzinski_sign', type: 'VARCHAR(50) NULL' },

            // JSON contenedor de datos completos del examen físico
            { name: 'datos_completos_json', type: 'LONGTEXT NULL' }
        ];

        const toAdd = columnsToAdd.filter(c => !existingCols.has(c.name.toLowerCase()));
        console.log('Columns to add:', toAdd.length);

        for (const col of toAdd) {
            console.log(`Adding column: ${col.name} ${col.type}`);
            await db.query(`ALTER TABLE historia_examen_fisico ADD COLUMN ${col.name} ${col.type}`);
        }

        console.log('Successfully updated schema of historia_examen_fisico!');
        process.exit(0);
    } catch (e) {
        console.error('Migration error:', e);
        process.exit(1);
    }
})();
