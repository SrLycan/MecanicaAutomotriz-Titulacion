/**
 * SS SWAP - Prepara la empresa de DEMOSTRACIÓN para las capturas de ayuda (Sprint 27)
 *
 *   AYUDA_SUPER_EMAIL=... AYUDA_SUPER_PASSWORD=... node scripts/ayuda/preparar-demo.mjs
 *
 * Crea (si no existe) la empresa "Taller Demo Ayuda" y la llena con datos
 * 100 % FICTICIOS a través de la API normal (mismas validaciones y permisos
 * que la interfaz). Así las capturas nunca muestran clientes, proveedores ni
 * usuarios reales. Solo funciona contra un backend en localhost (nunca
 * producción). Es idempotente: si la empresa ya tiene productos, no siembra
 * de nuevo.
 * Las credenciales del administrador demo se guardan en
 * scripts/ayuda/.demo-credenciales.json (ignorado por git).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.AYUDA_API || 'http://localhost:5001/api';
const CRED = path.join(DIR, '.demo-credenciales.json');

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(API + '/')) {
    console.error(`Solo se permite un backend local (AYUDA_API=${API}).`);
    process.exit(1);
}

async function api(metodo, ruta, { token, body } = {}) {
    const r = await fetch(`${API}${ruta}`, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const datos = (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text();
    if (!r.ok) throw new Error(`${metodo} ${ruta} -> ${r.status}: ${datos?.error || datos}`);
    return datos;
}
const login = async (email, password) => (await api('POST', '/auth/login', { body: { email, password, panel: 'staff' } })).token;
const hoy = () => new Date().toLocaleDateString('sv-SE');
const intentar = async (desc, fn) => { try { const r = await fn(); console.log(`  ✓ ${desc}`); return r; } catch (e) { console.log(`  · ${desc}: ${e.message}`); return null; } };

async function main() {
    const { AYUDA_SUPER_EMAIL: se, AYUDA_SUPER_PASSWORD: sp } = process.env;
    if (!se || !sp) throw new Error('Defina AYUDA_SUPER_EMAIL y AYUDA_SUPER_PASSWORD (superadministrador del entorno LOCAL).');
    const sup = await login(se, sp);

    let cred = fs.existsSync(CRED) ? JSON.parse(fs.readFileSync(CRED, 'utf8')) : null;
    const { empresas = [] } = await api('GET', '/plataforma/empresas', { token: sup });
    const existe = empresas.find(e => e.slug === 'demo-ayuda');
    if (!existe) {
        const r = await api('POST', '/plataforma/empresas', { token: sup, body: {
            nombre: 'Taller Demo Ayuda', slug: 'demo-ayuda', ruc: '1790099999001',
            admin: { nombre: 'Andrea Demo', email: 'admin@demo-ayuda.test' } } });
        cred = { email: 'admin@demo-ayuda.test', password: r.password_temporal };
        fs.writeFileSync(CRED, JSON.stringify(cred, null, 2));
        console.log('Empresa demo creada.');
    } else if (!cred) {
        throw new Error(`La empresa demo existe pero falta ${CRED}. Restablezca la contraseña de admin@demo-ayuda.test y guárdela en ese archivo.`);
    }
    const t = await login(cred.email, cred.password);

    const { total = 0 } = await api('GET', '/inventory/repuestos?limit=1', { token: t });
    if (total > 0) { console.log('La empresa demo ya tiene datos: no se siembra de nuevo.'); return; }
    console.log('Sembrando datos ficticios…');

    const cat = {};
    for (const [nombre, area] of [['Filtros', 'mecanica'], ['Frenos', 'mecanica'], ['Aceites y lubricantes', 'mecanica'], ['Pinturas', 'colisiones']]) {
        const r = await intentar(`categoría ${nombre}`, () => api('POST', '/inventory/categorias', { token: t, body: { nombre, area } }));
        cat[nombre] = (r?.categoria || r)?.id;
    }
    const rep = {};
    for (const p of [
        { nombre: 'Filtro de aceite FX-200', area: 'mecanica', categoria_id: cat.Filtros, stock_actual: 18, stock_minimo: 5, precio_compra: 3.2, precio_venta: 7.5, codigo_proveedor: 'DA-FX200' },
        { nombre: 'Pastillas de freno delanteras', area: 'mecanica', categoria_id: cat.Frenos, stock_actual: 3, stock_minimo: 4, precio_compra: 14, precio_venta: 28 },
        { nombre: 'Aceite sintético 5W-30 (litro)', area: 'mecanica', categoria_id: cat['Aceites y lubricantes'], stock_actual: 40, stock_minimo: 10, precio_compra: 6.5, precio_venta: 11, unidad_medida: 'litro' },
        { nombre: 'Bujía de iridio', area: 'mecanica', stock_actual: 24, stock_minimo: 8, precio_compra: 4.8, precio_venta: 9 },
        { nombre: 'Pintura base gris plata (litro)', area: 'colisiones', categoria_id: cat.Pinturas, stock_actual: 6, stock_minimo: 2, precio_compra: 21, precio_venta: 38, unidad_medida: 'litro' },
        { nombre: 'Masilla poliéster 1 kg', area: 'colisiones', stock_actual: 9, stock_minimo: 3, precio_compra: 7, precio_venta: 13 },
    ]) {
        const r = await intentar(`producto ${p.nombre}`, () => api('POST', '/inventory/repuestos', { token: t, body: p }));
        rep[p.nombre] = r?.id;
    }
    await intentar('entrada manual de bujías', () => api('POST', '/inventory/movimientos', { token: t, body: { repuesto_id: rep['Bujía de iridio'], tipo: 'entrada', cantidad: 6, motivo: 'Reposición de bodega', origen: 'manual' } }));

    const prov = {};
    for (const p of [{ nombre_comercial: 'Distribuidora Andina Demo', razon_social: 'DISTRIBUIDORA ANDINA DEMO S.A.', ruc: '1790088888001', categoria: 'Repuestos', telefono: '0990000101', email: 'ventas@andina-demo.test' },
                     { nombre_comercial: 'Pinturas del Valle Demo', ruc: '1790077777001', categoria: 'Pinturas', telefono: '0990000102' }]) {
        const r = await intentar(`proveedor ${p.nombre_comercial}`, () => api('POST', '/proveedores/proveedores', { token: t, body: p }));
        prov[p.nombre_comercial] = r?.proveedor?.id;
    }
    const cli = [];
    for (const c of [{ nombre: 'Juan Pérez (demo)', cedula: '1700000001', telefono: '0990000001', email: 'juan@cliente-demo.test', direccion: 'Av. Siempre Viva 123' },
                     { nombre: 'María López (demo)', cedula: '1700000002', telefono: '0990000002', email: 'maria@cliente-demo.test' },
                     { nombre: 'Transportes Demo Cía. Ltda.', cedula: '1790066666001', telefono: '0990000003' }]) {
        const r = await intentar(`cliente ${c.nombre}`, () => api('POST', '/ordenes/clientes', { token: t, body: c }));
        cli.push(r?.cliente?.id || r?.id);
    }
    const veh = [];
    for (const [i, v] of [[0, { placa: 'PDA-1234', marca: 'Chevrolet', modelo: 'Sail', anio: 2019, color: 'Gris' }],
                          [1, { placa: 'PDB-5678', marca: 'Kia', modelo: 'Rio', anio: 2021, color: 'Blanco' }],
                          [2, { placa: 'PDC-9012', marca: 'Hyundai', modelo: 'H1', anio: 2018, color: 'Plata' }]]) {
        const r = await intentar(`vehículo ${v.placa}`, () => api('POST', '/ordenes/vehiculos', { token: t, body: { ...v, cliente_id: cli[i] } }));
        veh.push(r?.vehiculo?.id || r?.id);
    }
    for (const s of [{ nombre: 'Cambio de aceite y filtro', precio_base: 15, duracion_estimada_min: 45, descripcion: 'Mano de obra del cambio de aceite.' },
                     { nombre: 'Alineación y balanceo', precio_base: 25, duracion_estimada_min: 60 },
                     { nombre: 'Pintura de puerta', precio_base: 120, duracion_estimada_min: 480 }]) {
        await intentar(`servicio ${s.nombre}`, () => api('POST', '/servicios', { token: t, body: s }));
    }
    await intentar('orden de trabajo 1', () => api('POST', '/ordenes/ordenes', { token: t, body: { cliente_id: cli[0], vehiculo_id: veh[0], descripcion: 'Ruido al frenar y cambio de aceite', diagnostico: 'Pastillas delanteras gastadas', kilometraje: 84500 } }));
    await intentar('orden de trabajo 2', () => api('POST', '/ordenes/ordenes', { token: t, body: { cliente_id: cli[1], vehiculo_id: veh[1], descripcion: 'Mantenimiento de 20.000 km', kilometraje: 20150 } }));
    await intentar('proforma mecánica', () => api('POST', '/proformas', { token: t, body: {
        tipo: 'mecanica', cliente_id: cli[0], vehiculo_id: veh[0], fecha_emision: hoy(), iva_porcentaje: 15, descuento: 0, anticipo: 0, estado: 'emitida',
        observaciones: 'Proforma de demostración.',
        items: [{ categoria: 'producto', descripcion: 'Pastillas de freno delanteras', cantidad: 1, precio_unitario: 28, referencia_tipo: 'repuesto', referencia_id: rep['Pastillas de freno delanteras'] },
                { categoria: 'servicio', descripcion: 'Cambio de pastillas', cantidad: 1, precio_unitario: 20 }] } }));
    await intentar('compra (nota de venta recibida)', () => api('POST', '/proveedores/compras', { token: t, body: {
        proveedor_id: prov['Distribuidora Andina Demo'], tipo_documento: 'nota_venta', numero_documento: '001-001-000001001', fecha_solicitud: hoy(),
        forma_pago: 'credito', area: 'mecanica', tipo_registro: 'inventario',
        items: [{ repuesto_id: rep['Filtro de aceite FX-200'], descripcion: 'Filtro de aceite FX-200', cantidad: 10, precio_unitario: 3.2 }] } }));
    await intentar('orden de compra pendiente', () => api('POST', '/proveedores/compras', { token: t, body: {
        proveedor_id: prov['Pinturas del Valle Demo'], forma_pago: 'contado', metodo_pago: 'transferencia',
        items: [{ repuesto_id: rep['Pintura base gris plata (litro)'], descripcion: 'Pintura base gris plata', cantidad: 4, precio_unitario: 21 }] } }));
    await intentar('gasto', () => api('POST', '/proveedores/gastos', { token: t, body: { proveedor_id: prov['Distribuidora Andina Demo'], categoria: 'servicios', descripcion: 'Envío de repuestos', monto: 12.5, fecha: hoy(), metodo_pago: 'efectivo', estado: 'pagado' } }));
    await intentar('pagaré de cliente', () => api('POST', '/cuentas-cobrar', { token: t, body: { cliente_id: cli[2], vehiculo_id: veh[2], concepto: 'Reparación de suspensión (demo)', monto_total: 240, fecha: hoy() } }));
    const cuentas = await intentar('cuentas de dinero', () => api('GET', '/finanzas/cuentas', { token: t }));
    // Saldo inicial realista en las cuentas por defecto (si no, el panel muestra dinero negativo).
    for (const k of cuentas?.cuentas || []) {
        await intentar(`saldo inicial ${k.nombre}`, () => api('PUT', `/finanzas/cuentas/${k.id}`, { token: t, body: {
            nombre: k.nombre, tipo: k.tipo, banco: k.banco, numero_cuenta: k.numero_cuenta, saldo_inicial: k.tipo === 'banco' ? 1500 : 400,
            fecha_saldo_inicial: k.fecha_saldo_inicial || undefined, predeterminada: k.predeterminada, activa: k.activa, notas: k.notas } }));
    }
    let cuenta = (cuentas?.cuentas || [])[0]?.id;
    if (!cuenta) cuenta = (await intentar('cuenta Caja general', () => api('POST', '/finanzas/cuentas', { token: t, body: { nombre: 'Caja general', tipo: 'caja', saldo_inicial: 300, predeterminada: true } })))?.cuenta?.id;
    if (cuenta) await intentar('ingreso de dinero', () => api('POST', '/finanzas/movimientos', { token: t, body: { tipo: 'ingreso', categoria: 'otros_ingresos', monto: 80, fecha: hoy(), cuenta_dinero_id: cuenta, descripcion: 'Venta de mostrador (demo)' } }));
    console.log('Listo.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
