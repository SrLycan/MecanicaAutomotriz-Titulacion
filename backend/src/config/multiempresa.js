/**
 * SS SWAP - Definición del aislamiento multiempresa (Sprint 22)
 *
 * Fuente única de QUÉ tablas pertenecen a una empresa y de QUÉ relaciones
 * deben quedarse dentro de la misma empresa. migrations.sql (bloque
 * Sprint 22) contiene las sentencias generadas desde aquí; la prueba
 * multiempresa.test.js falla si alguien cambia esta lista sin regenerarlas:
 *
 *   node src/config/multiempresa.js
 *
 * Reglas:
 *  - TABLAS_EMPRESA: tienen empresa_id NOT NULL (usuarios: NULL solo para un
 *    superadministrador global), Row Level Security y se filtran solas.
 *  - TABLAS_GLOBALES: catálogos compartidos (solo lectura para la app) y
 *    tablas de la plataforma (solo el sistema / superadministrador).
 *  - RELACIONES_EMPRESA: llaves foráneas que además se validan como
 *    (columna, empresa_id) -> (id, empresa_id): un registro nunca puede
 *    apuntar a un registro de otra empresa, ni siquiera con un id adivinado.
 *    Las columnas de "quién lo hizo" (usuario_id del autor, anulado_por...)
 *    no se incluyen: un superadministrador en modo soporte no pertenece a la
 *    empresa y debe poder quedar registrado como autor.
 */

const TABLAS_EMPRESA = [
    'usuarios', 'usuario_permisos', 'auditoria_seguridad',
    'sucursales', 'tipos_servicio',
    'clientes', 'vehiculos', 'citas', 'ordenes_trabajo', 'ordenes_historial',
    'categorias_repuesto', 'repuestos', 'movimientos_inventario', 'solicitudes_producto',
    'proformas', 'proforma_items', 'proforma_zonas_danadas',
    'cuentas_cobrar', 'pagos_cliente',
    'proveedores', 'proveedores_contactos', 'gastos_proveedor', 'compras_proveedor',
    'compras_proveedor_items', 'movimientos_financieros_proveedor',
    'cuentas_dinero', 'caja_sesiones', 'caja_movimientos', 'movimientos_dinero',
    'empleados_perfil', 'pagos_empleados',
    'empresa_secuencias',
];

const TABLAS_GLOBALES = {
    // Catálogos: la app solo los lee.
    catalogos: ['cat_areas_inventario', 'cat_metodos_pago', 'cat_tipos_proforma', 'cat_origenes_movimiento',
        'cat_categorias_dinero', 'permisos_catalogo'],
    // Plataforma: la app (rol de empresa) no tiene acceso; solo el sistema.
    plataforma: ['migraciones_registro', 'accesos_soporte', 'respaldos_registro', 'errores_sistema'],
    // empresas: cada empresa solo ve (y, con permiso, edita) su propia fila.
};

// [tabla, columna, tabla_referenciada]
const RELACIONES_EMPRESA = [
    ['repuestos', 'categoria_id', 'categorias_repuesto'],
    ['movimientos_inventario', 'repuesto_id', 'repuestos'],
    ['movimientos_inventario', 'proforma_id', 'proformas'],
    ['movimientos_inventario', 'proforma_item_id', 'proforma_items'],
    ['movimientos_inventario', 'orden_id', 'ordenes_trabajo'],
    ['movimientos_inventario', 'compra_id', 'compras_proveedor'],
    ['movimientos_inventario', 'movimiento_revertido_id', 'movimientos_inventario'],
    ['vehiculos', 'cliente_id', 'clientes'],
    ['ordenes_trabajo', 'cliente_id', 'clientes'],
    ['ordenes_trabajo', 'vehiculo_id', 'vehiculos'],
    ['ordenes_trabajo', 'tecnico_id', 'usuarios'],
    ['citas', 'cliente_id', 'clientes'],
    ['citas', 'vehiculo_id', 'vehiculos'],
    ['citas', 'servicio_id', 'tipos_servicio'],
    ['citas', 'sucursal_id', 'sucursales'],
    ['citas', 'usuario_id', 'usuarios'],
    ['solicitudes_producto', 'cliente_id', 'clientes'],
    ['solicitudes_producto', 'usuario_id', 'usuarios'],
    ['solicitudes_producto', 'repuesto_id', 'repuestos'],
    ['solicitudes_producto', 'movimiento_id', 'movimientos_inventario'],
    ['solicitudes_producto', 'cobro_id', 'movimientos_dinero'],
    ['ordenes_historial', 'orden_id', 'ordenes_trabajo'],
    ['proveedores_contactos', 'proveedor_id', 'proveedores'],
    ['gastos_proveedor', 'proveedor_id', 'proveedores'],
    ['gastos_proveedor', 'cuenta_dinero_id', 'cuentas_dinero'],
    ['compras_proveedor', 'proveedor_id', 'proveedores'],
    ['compras_proveedor_items', 'compra_id', 'compras_proveedor'],
    ['compras_proveedor_items', 'repuesto_id', 'repuestos'],
    ['movimientos_financieros_proveedor', 'proveedor_id', 'proveedores'],
    ['movimientos_financieros_proveedor', 'gasto_id', 'gastos_proveedor'],
    ['movimientos_financieros_proveedor', 'compra_id', 'compras_proveedor'],
    ['movimientos_financieros_proveedor', 'cuenta_dinero_id', 'cuentas_dinero'],
    ['proformas', 'cliente_id', 'clientes'],
    ['proformas', 'vehiculo_id', 'vehiculos'],
    ['proformas', 'orden_id', 'ordenes_trabajo'],
    ['proformas', 'orden_generada_id', 'ordenes_trabajo'],
    ['proformas', 'sucursal_id', 'sucursales'],
    ['proforma_items', 'proforma_id', 'proformas'],
    ['proforma_zonas_danadas', 'proforma_id', 'proformas'],
    ['cuentas_cobrar', 'cliente_id', 'clientes'],
    ['cuentas_cobrar', 'vehiculo_id', 'vehiculos'],
    ['cuentas_cobrar', 'proforma_id', 'proformas'],
    ['cuentas_cobrar', 'orden_id', 'ordenes_trabajo'],
    ['pagos_cliente', 'cuenta_id', 'cuentas_cobrar'],
    ['pagos_cliente', 'cuenta_dinero_id', 'cuentas_dinero'],
    ['caja_sesiones', 'sucursal_id', 'sucursales'],
    ['caja_movimientos', 'caja_sesion_id', 'caja_sesiones'],
    ['caja_movimientos', 'cuenta_dinero_id', 'cuentas_dinero'],
    ['movimientos_dinero', 'cuenta_dinero_id', 'cuentas_dinero'],
    ['movimientos_dinero', 'caja_sesion_id', 'caja_sesiones'],
    ['empleados_perfil', 'usuario_id', 'usuarios'],
    ['pagos_empleados', 'usuario_id', 'usuarios'],
    ['pagos_empleados', 'cuenta_dinero_id', 'cuentas_dinero'],
    ['usuario_permisos', 'usuario_id', 'usuarios'],
];

/** Tablas referenciadas: necesitan UNIQUE (id, empresa_id). */
const tablasReferenciadas = (relaciones = RELACIONES_EMPRESA) => [...new Set(relaciones.map(r => r[2]))].sort();

/** Sentencias SQL idempotentes de las llaves compuestas. */
function sqlRelaciones(relaciones = RELACIONES_EMPRESA) {
    const uniques = tablasReferenciadas(relaciones).map(t =>
        `    PERFORM agregar_constraint_si_falta('${t}', 'uq_${t}_id_empresa', 'UNIQUE (id, empresa_id)');`);
    const fks = relaciones.map(([t, c, ref]) =>
        `    PERFORM agregar_constraint_si_falta('${t}', 'fk_emp_${t}_${c}', 'FOREIGN KEY (${c}, empresa_id) REFERENCES ${ref}(id, empresa_id)');`);
    return [...uniques, ...fks].join('\n');
}

// ── Sprint 23: facturación electrónica y documentos legales ──
// Mismas reglas que las del Sprint 22 (empresa_id NOT NULL + RLS), en su
// propio bloque de la migración (marcas RELACIONES23_INICIO/FIN).
const TABLAS_EMPRESA_SPRINT23 = [
    'sri_configuracion', 'sri_puntos_emision',
    'comprobantes_electronicos', 'comprobante_detalles', 'comprobante_eventos',
    'contratos_empresa', 'aceptaciones_legales', 'notificaciones_legales',
];
// Documentos legales: empresa_id NULL = documento de la PLATAFORMA (lo
// redacta el superadministrador y lo aceptan las empresas); con empresa =
// documento propio de esa empresa para los clientes de su portal. Cada
// empresa LEE los de la plataforma y los suyos, y solo ESCRIBE los suyos.
const TABLAS_LEGALES_COMPARTIDAS = ['documentos_legales', 'documento_legal_versiones'];

const RELACIONES_SPRINT23 = [
    ['sri_puntos_emision', 'sucursal_id', 'sucursales'],
    ['comprobantes_electronicos', 'punto_emision_id', 'sri_puntos_emision'],
    ['comprobantes_electronicos', 'cliente_id', 'clientes'],
    ['comprobantes_electronicos', 'proforma_id', 'proformas'],
    ['comprobantes_electronicos', 'orden_id', 'ordenes_trabajo'],
    ['comprobantes_electronicos', 'cuenta_cobrar_id', 'cuentas_cobrar'],
    ['comprobantes_electronicos', 'comprobante_modificado_id', 'comprobantes_electronicos'],
    ['comprobante_detalles', 'comprobante_id', 'comprobantes_electronicos'],
    ['comprobante_detalles', 'proforma_item_id', 'proforma_items'],
    ['comprobante_eventos', 'comprobante_id', 'comprobantes_electronicos'],
    ['aceptaciones_legales', 'contrato_id', 'contratos_empresa'],
    ['aceptaciones_legales', 'cliente_id', 'clientes'],
    ['aceptaciones_legales', 'usuario_id', 'usuarios'],
    ['notificaciones_legales', 'usuario_id', 'usuarios'],
    ['notificaciones_legales', 'cliente_id', 'clientes'],
];

/** Todas las tablas aisladas por empresa (las del Sprint 23 primero: dependen de las anteriores). */
const TODAS_TABLAS_EMPRESA = [...TABLAS_EMPRESA_SPRINT23, ...TABLAS_EMPRESA];

if (require.main === module) {
    console.log('-- Sprint 22\n' + sqlRelaciones() + '\n\n-- Sprint 23\n' + sqlRelaciones(RELACIONES_SPRINT23));
}

module.exports = {
    TABLAS_EMPRESA, TABLAS_GLOBALES, RELACIONES_EMPRESA, tablasReferenciadas, sqlRelaciones,
    TABLAS_EMPRESA_SPRINT23, TABLAS_LEGALES_COMPARTIDAS, RELACIONES_SPRINT23, TODAS_TABLAS_EMPRESA,
};
