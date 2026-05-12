/**
 * SSWAP - Seed de base de datos
 * Ejecutar: npm run seed
 */
const bcrypt = require('bcryptjs');
const pool   = require('./db');
const fs     = require('fs');
const path   = require('path');

async function seed() {
    const client = await pool.connect();
    try {
        console.log('\n SSWAP - Inicializando base de datos...\n');

        // Leer schema y reemplazar placeholder del admin
        let sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        const adminHash = await bcrypt.hash('Admin@SSWAP2026', 10);
        sql = sql.replace('$2b$10$PLACEHOLDER_REPLACED_BY_SEED', adminHash);

        await client.query(sql);
        console.log('[OK] Schema y seed base ejecutados');

        // Usuarios adicionales de prueba
        const users = [
            { nombre: 'Tecnico Demo',      email: 'tecnico@sswap.com',   password: 'Tecnico@2026',   rol: 'tecnico'       },
            { nombre: 'Recepcionista Demo',email: 'recepcion@sswap.com', password: 'Recepcion@2026', rol: 'recepcionista' },
            { nombre: 'Cliente Demo',      email: 'cliente@sswap.com',   password: 'Cliente@2026',   rol: 'cliente'       },
        ];

        for (const u of users) {
            const hash = await bcrypt.hash(u.password, 10);
            await client.query(
                `INSERT INTO usuarios (nombre, email, password, rol)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (email) DO NOTHING`,
                [u.nombre, u.email, hash, u.rol]
            );
        }
        console.log('[OK] Usuarios de prueba creados');

        console.log('\n Seed completado exitosamente.\n');
        console.log('Usuarios disponibles:');
        console.log('  admin@sswap.com       | Admin@SSWAP2026    | administrador');
        console.log('  tecnico@sswap.com     | Tecnico@2026       | tecnico');
        console.log('  recepcion@sswap.com   | Recepcion@2026     | recepcionista');
        console.log('  cliente@sswap.com     | Cliente@2026       | cliente\n');

    } catch (err) {
        console.error('Error en seed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
}

seed();
