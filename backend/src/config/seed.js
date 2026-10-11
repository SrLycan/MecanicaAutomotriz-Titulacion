/**
 * SS SWAP - Seed de base de datos
 * Ejecutar: npm run seed
 * 
 * Crea el schema completo, usuarios demo, categorias, repuestos y sucursales.
 */
const bcrypt = require('bcryptjs');
const pool   = require('./db');
const fs     = require('fs');
const path   = require('path');

async function seed() {
    const client = await pool.connect();
    try {
        console.log('\n⚙️ SS SWAP - Inicializando base de datos...\n');

        // ── 1. Ejecutar schema.sql (tablas + seed basico) ────
        let sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        const adminHash = await bcrypt.hash('AdminSS2026', 10);
        sql = sql.replace('$2b$10$PLACEHOLDER_REPLACED_BY_SEED', adminHash);

        await client.query(sql);
        console.log('[OK] Schema y seed base ejecutados');

        // ── 2. Ejecutar migrations.sql (cambios posteriores) ──
        const mig = fs.readFileSync(path.join(__dirname, 'migrations.sql'), 'utf-8');
        await client.query(mig);
        console.log('[OK] Migraciones ejecutadas');

        // Multiempresa: los datos de ejemplo son de SS SWAP. La sesion de este
        // cliente queda en esa empresa (las columnas empresa_id toman su valor).
        const { rows: emp } = await client.query("SELECT id FROM empresas WHERE slug = 'ss-swap'");
        await client.query("SELECT set_config('app.empresa_id', $1, false)", [String(emp[0].id)]);

        // ── 3. Sucursales demo ──────────────────────────────
        const sucursales = [
            {
                nombre: 'SS SWAP Ponciano Alto',
                direccion: 'Av. Real Audiencia y Manuel Cordova Galarza',
                ciudad: 'Quito',
                telefono: '+593 99 123 4567',
                email: 'contacto@ssswap.com',
                horario: 'Lun-Vie 8:00-18:00 · Sab 8:00-14:00',
                descripcion: 'Sucursal principal: diagnostico computarizado, mecanica general, alineacion y balanceo.',
                es_principal: true,
                activa: true,
            },
            {
                nombre: 'SS SWAP Norte',
                direccion: 'Av. 10 de Agosto y Naciones Unidas',
                ciudad: 'Quito',
                telefono: '+593 99 234 5678',
                email: 'norte@ssswap.com',
                horario: 'Lun-Vie 8:30-17:30',
                descripcion: 'Taller especializado en motores diesel y sistemas electronicos.',
                es_principal: false,
                activa: true,
            },
            {
                nombre: 'SS SWAP Sur',
                direccion: 'Av. Maldonado y Pedro Vicente Maldonado',
                ciudad: 'Quito',
                telefono: '+593 99 345 6789',
                email: 'sur@ssswap.com',
                horario: 'Lun-Vie 8:00-17:00 · Sab 9:00-13:00',
                descripcion: 'Servicio rapido: cambios de aceite, filtros, frenos y llantas.',
                es_principal: false,
                activa: true,
            },
        ];

        for (const s of sucursales) {
            // Solo inserta si no existe ninguna con ese nombre
            const { rows: existing } = await client.query(
                'SELECT id FROM sucursales WHERE nombre = $1', [s.nombre]
            );
            if (existing.length === 0) {
                if (s.es_principal) {
                    await client.query('UPDATE sucursales SET es_principal = FALSE');
                }
                await client.query(
                    `INSERT INTO sucursales (nombre, direccion, ciudad, telefono, email, horario, descripcion, es_principal, activa)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                    [s.nombre, s.direccion, s.ciudad, s.telefono, s.email, s.horario, s.descripcion, s.es_principal, s.activa]
                );
            }
        }
        console.log('[OK] Sucursales demo creadas');

        // ── 4. Usuarios adicionales de prueba ──────────────
        const users = [
            { nombre: 'Tecnico Demo',      email: 'tecnico@ssswap.com',   password: 'Tecnico@2026',   rol: 'tecnico'       },
            { nombre: 'Recepcionista Demo',email: 'recepcion@ssswap.com', password: 'Recepcion@2026', rol: 'recepcionista' },
            { nombre: 'Cliente Demo',      email: 'cliente@ssswap.com',   password: 'Cliente@2026',   rol: 'cliente'       },
        ];

        for (const u of users) {
            const hash = await bcrypt.hash(u.password, 10);
            await client.query(
                `INSERT INTO usuarios (nombre, email, password, rol, estado, activo)
                 VALUES ($1, $2, $3, $4, 'activo', TRUE)
                 ON CONFLICT (email) DO NOTHING`,
                [u.nombre, u.email, hash, u.rol]
            );
        }
        console.log('[OK] Usuarios de prueba creados');

        // ── 5. Repuestos adicionales de ejemplo ────────────
        const repuestosExtra = [
            { codigo: 'COR-DIST-001', nombre: 'Correa de Distribucion Std',     descripcion: 'Juego correa + tensor + guia',      categoria_id: 6, precio_compra: 32.00, precio_venta: 55.00, stock_actual: 6,  stock_minimo: 3,  unidad_medida: 'juego' },
            { codigo: 'ELC-BAT-001',  nombre: 'Bateria 12V 65Ah Std',           descripcion: 'Bateria libre mantenimiento',        categoria_id: 5, precio_compra: 55.00, precio_venta: 85.00, stock_actual: 3,  stock_minimo: 2,  unidad_medida: 'unidad' },
            { codigo: 'CONS-LIQ-001', nombre: 'Liquido Refrigerante 1L',        descripcion: 'Refrigerante concentrado verde',     categoria_id: 7, precio_compra: 3.50,  precio_venta: 6.00,  stock_actual: 20, stock_minimo: 10, unidad_medida: 'litro' },
        ];

        for (const r of repuestosExtra) {
            await client.query(
                `INSERT INTO repuestos (codigo, nombre, descripcion, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, unidad_medida)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 ON CONFLICT (empresa_id, codigo) DO NOTHING`,
                [r.codigo, r.nombre, r.descripcion, r.categoria_id, r.precio_compra, r.precio_venta, r.stock_actual, r.stock_minimo, r.unidad_medida]
            );
        }
        console.log('[OK] Repuestos adicionales creados');

        // ── 6. Clientes demo ────────────────────────────────
        const clientesDemo = [
            { nombre: 'Carlos Mendoza',   email: 'carlos@email.com',   telefono: '+593 99 123 4567', cedula: '1712345678', direccion: 'Av. Amazonas y Naciones Unidas' },
            { nombre: 'Maria Sanchez',    email: 'maria@email.com',   telefono: '+593 99 234 5678', cedula: '1723456789', direccion: 'Av. 6 de Diciembre y Eloy Alfaro' },
            { nombre: 'Pedro Jimenez',    email: 'pedro@email.com',   telefono: '+593 98 345 6789', cedula: '1734567890', direccion: 'Av. America y La Gasca' },
            { nombre: 'Ana Rodriguez',    email: 'ana@email.com',     telefono: '+593 99 456 7890', cedula: '1745678901', direccion: 'Calle De las Alondras y Av. El Inca' },
            { nombre: 'Luis Torres',      email: 'luis@email.com',    telefono: '+593 98 567 8901', cedula: '1756789012', direccion: 'Av. Patria y 12 de Octubre' },
        ];

        for (const c of clientesDemo) {
            await client.query(
                `INSERT INTO clientes (nombre, email, telefono, cedula, direccion)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (empresa_id, cedula) DO NOTHING`,
                [c.nombre, c.email, c.telefono, c.cedula, c.direccion]
            );
        }
        console.log('[OK] Clientes demo creados');

        // ── 7. Vehiculos demo ───────────────────────────────
        // Obtenemos los IDs de los clientes recien creados
        const { rows: clientesIds } = await client.query('SELECT id FROM clientes ORDER BY id');
        if (clientesIds.length >= 3) {
            const vehiculosDemo = [
                { cliente_id: clientesIds[0].id, placa: 'PCC-1234', marca: 'Toyota',  modelo: 'Hilux',         anio: 2022, color: 'Blanco'  },
                { cliente_id: clientesIds[0].id, placa: 'PBA-5678', marca: 'Kia',     modelo: 'Sportage',      anio: 2023, color: 'Negro'   },
                { cliente_id: clientesIds[1].id, placa: 'PCN-9012', marca: 'Chevrolet', modelo: 'Aveo',        anio: 2021, color: 'Plateado' },
                { cliente_id: clientesIds[2].id, placa: 'PCC-3456', marca: 'Mazda',   modelo: 'CX-5',          anio: 2024, color: 'Rojo'    },
                { cliente_id: clientesIds[3].id, placa: 'PBA-7890', marca: 'Hyundai',  modelo: 'Tucson',       anio: 2023, color: 'Azul'    },
            ];

            for (const v of vehiculosDemo) {
                await client.query(
                    `INSERT INTO vehiculos (cliente_id, placa, marca, modelo, anio, color)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT DO NOTHING`,
                    [v.cliente_id, v.placa, v.marca, v.modelo, v.anio, v.color]
                );
            }
            console.log('[OK] Vehiculos demo creados');
        }

        // ── Resumen final ──────────────────────────────────
        console.log('\n✅ Seed completado exitosamente.\n');
        console.log('📋 Usuarios disponibles:');
        console.log('   admin@ssswap.com        | AdminSS2026         | administrador');
        console.log('   tecnico@ssswap.com      | Tecnico@2026       | tecnico');
        console.log('   recepcion@ssswap.com    | Recepcion@2026     | recepcionista');
        console.log('   cliente@ssswap.com      | Cliente@2026       | cliente');
        console.log('\n🏪 Sucursales: SS SWAP Ponciano Alto, SS SWAP Norte, SS SWAP Sur');
        console.log('👥 Clientes demo: Carlos Mendoza, Maria Sanchez, Pedro Jimenez + 2 mas');
        console.log('🚗 Vehiculos demo: Toyota Hilux, Kia Sportage, Chevrolet Aveo + 2 mas');

    } catch (err) {
        console.error('❌ Error en seed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
}

seed();
