const db = require('../config/db');

async function testEvoluciones() {
    try {
        console.log('--- TEST DE INTEGRACIÓN: EVOLUCIÓN CLÍNICA DIARIA ---');

        // 1. Verificar tabla en DB
        const [tables] = await db.query("SHOW TABLES LIKE 'evolucion_diaria'");
        console.log('1. Tabla evolucion_diaria existe:', tables.length > 0);

        // 2. Contar registros
        const [count] = await db.query('SELECT COUNT(*) as total FROM evolucion_diaria');
        console.log('2. Total de registros en evolucion_diaria:', count[0].total);

        // 3. Probar inserción directa
        const [sol] = await db.query('SELECT id, paciente_id FROM registro_solicitud LIMIT 1');
        if (sol.length > 0) {
            const solicitudId = sol[0].id;
            console.log('3. Usando registro_solicitud_id:', solicitudId);

            const testNoteId = 'TEST-NOTE-' + Date.now();
            const [insert] = await db.query(`
                INSERT INTO evolucion_diaria (
                    registro_solicitud_id, daily_note_id, evolution_date, evolution_time,
                    care_location, service, hospital_day, postoperative_day, clinical_course_since_previous,
                    general_condition, consciousness_status, weight_kg, height_cm, bmi, bsa,
                    heart_rate, respiratory_rate, oxygen_saturation, bp_systolic, bp_diastolic,
                    hemodynamic_status, intake_24h_ml, output_24h_ml, fluid_balance_24h_ml, urine_output_ml_kg_h,
                    estatus_nota, audit_usu_id, audit_ip, audit_dep_id
                ) VALUES (
                    ?, ?, CURDATE(), '09:00:00',
                    'UCIP', 'Cardiología', 2, 1, 'Mejoría',
                    'Delicada', 'Alerta', 12.0, 85.0, 16.61, 0.53,
                    110, 24, 98, 95, 60,
                    'Estable', 1000.0, 850.0, 150.0, 2.95,
                    'Borrador', '1', '127.0.0.1', '1'
                )
            `, [solicitudId, testNoteId]);

            console.log('4. Inserción de prueba exitosa, ID:', insert.insertId);

            // 4. Consultar y verificar datos
            const [read] = await db.query('SELECT * FROM evolucion_diaria WHERE id = ?', [insert.insertId]);
            console.log('5. Lectura exitosa. Note UUID:', read[0].daily_note_id, 'IMC:', read[0].bmi, 'ASC:', read[0].bsa, 'Balance:', read[0].fluid_balance_24h_ml);

            // 5. Limpiar nota de prueba
            await db.query('DELETE FROM evolucion_diaria WHERE id = ?', [insert.insertId]);
            console.log('6. Eliminación de prueba exitosa.');
        } else {
            console.log('No hay solicitudes disponibles para probar.');
        }

        console.log('✓ TEST COMPLETADO CON ÉXITO.');
        process.exit(0);
    } catch (err) {
        console.error('Error durante el test:', err);
        process.exit(1);
    }
}

testEvoluciones();
