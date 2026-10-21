const db = require('./config/db');

(async () => {
    try {
        console.log('Converting existing long VARCHARs to TEXT...');
        // Change long varchars to TEXT so they don't consume inline row space
        const varcharsToText = [
            'general_exam_notes',
            'precordial_palpation_notes',
            'respiratory_exam_notes',
            'abdominal_exam_notes',
            'extremity_notes',
            'pulse_symmetry_notes',
            'external_genital_exam_notes',
            'focal_neurologic_deficit_notes',
            'behavior_notes',
            's1_soplo_localizacion',
            's2_soplo_localizacion',
            'auscultacion_pulmonar',
            'ruidos_cardiacos',
            'murmur_s1_character',
            'murmur_s1_radiation',
            'murmur_s2_character',
            'murmur_s2_radiation',
            'abdominal_palpation',
            'extremity_appearance',
            'edema_location'
        ];

        for (const col of varcharsToText) {
            try {
                await db.query(`ALTER TABLE historia_examen_fisico MODIFY COLUMN ${col} TEXT NULL`);
            } catch (err) {
                console.log(`Could not modify ${col}:`, err.message);
            }
        }

        // Now set ROW_FORMAT=DYNAMIC
        await db.query(`ALTER TABLE historia_examen_fisico ROW_FORMAT=DYNAMIC`);
        console.log('Successfully set ROW_FORMAT=DYNAMIC!');

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
