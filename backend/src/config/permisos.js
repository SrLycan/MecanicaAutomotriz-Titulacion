/**
 * SS SWAP - Catálogo de módulos y permisos del panel administrativo
 *
 * Fuente única de verdad de QUÉ se puede autorizar. Cada módulo declara las
 * acciones que realmente soporta el sistema (no todos tienen "eliminar" o
 * "exportar"). El backend valida contra este catálogo y la migración copia
 * las mismas filas a la tabla `permisos_catalogo` (integridad referencial de
 * `usuario_permisos`). Al arrancar, el servidor sincroniza el catálogo, así
 * que agregar un módulo futuro = agregarlo aquí y protegerlo con
 * requierePermiso() en su router.
 *
 * Roles:
 *  - superadministrador: administra la PLATAFORMA (empresas, respaldos,
 *    auditoría global). Dentro de su empresa propia (si tiene una) o de una
 *    empresa a la que entró con un acceso de soporte autorizado tiene acceso
 *    total implícito. Solo se concede con el script `npm run superadmin`.
 *  - administrador, tecnico, recepcionista, interno: el acceso real lo dan las
 *    filas de `usuario_permisos`. El rol queda como etiqueta y como plantilla
 *    de permisos sugeridos al crear la cuenta.
 *  - cliente: portal público; nunca entra al panel.
 */

const ROL_SUPERADMIN = 'superadministrador';
const ROLES_STAFF = [ROL_SUPERADMIN, 'administrador', 'tecnico', 'recepcionista', 'interno'];
// Roles que el superadministrador puede asignar desde el panel (nunca superadmin).
const ROLES_ASIGNABLES = ['administrador', 'tecnico', 'recepcionista', 'interno', 'cliente'];
const ROLES_TODOS = [ROL_SUPERADMIN, ...ROLES_ASIGNABLES];

const A = {
    ver:      { codigo: 'ver',      nombre: 'Ver' },
    crear:    { codigo: 'crear',    nombre: 'Crear' },
    editar:   { codigo: 'editar',   nombre: 'Editar' },
    eliminar: { codigo: 'eliminar', nombre: 'Eliminar' },
    exportar: { codigo: 'exportar', nombre: 'Exportar / descargar' },
    aprobar:  { codigo: 'aprobar',  nombre: 'Aprobar / confirmar' },
};
/** Acción con una etiqueta más precisa para el módulo (mismo código). */
const acc = (base, nombre) => ({ ...A[base], nombre });
/** Acción propia de un módulo (código distinto de los estándar). */
const propia = (codigo, nombre) => ({ codigo, nombre });

const CRUD = [A.ver, A.crear, A.editar, A.eliminar];

const MODULOS = [
    { codigo: 'dashboard', nombre: 'Panel principal', grupo: 'Panel',
      descripcion: 'Resumen del taller. Cada tarjeta solo muestra datos de los módulos que el usuario tiene permitidos.',
      acciones: [A.ver] },

    // ── Inventario ──
    { codigo: 'inventario_mecanica', nombre: 'Inventario de mecánica', grupo: 'Inventario',
      acciones: CRUD },
    { codigo: 'inventario_colisiones', nombre: 'Inventario de colisiones / pintura', grupo: 'Inventario',
      acciones: CRUD },
    { codigo: 'registros_inventario', nombre: 'Entradas y salidas de inventario', grupo: 'Inventario',
      descripcion: 'Solo sobre las áreas de inventario que el usuario puede ver.',
      acciones: [acc('ver', 'Ver registros'), acc('crear', 'Registrar entradas / salidas'), acc('aprobar', 'Devolver salidas al inventario')] },
    { codigo: 'pedidos_tienda', nombre: 'Pedidos de la tienda', grupo: 'Inventario',
      acciones: [A.ver, acc('editar', 'Atender / cancelar')] },

    // ── Taller ──
    { codigo: 'ordenes', nombre: 'Órdenes de trabajo', grupo: 'Taller',
      descripcion: 'Sin "Cambiar estado", un usuario solo actualiza el avance de las órdenes que tiene asignadas como técnico.',
      acciones: [...CRUD, propia('asignar', 'Asignar técnico'), acc('aprobar', 'Cambiar estado de cualquier orden')] },
    { codigo: 'proformas_mecanica', nombre: 'Proformas de mecánica', grupo: 'Taller',
      acciones: [...CRUD, acc('exportar', 'Descargar PDF / Excel'), acc('aprobar', 'Aprobar, rechazar, convertir en OT y confirmar materiales')] },
    { codigo: 'proformas_colisiones', nombre: 'Proformas de colisiones / pintura', grupo: 'Taller',
      acciones: [...CRUD, acc('exportar', 'Descargar PDF / Excel'), acc('aprobar', 'Aprobar, rechazar, convertir en OT y confirmar materiales')] },
    { codigo: 'citas', nombre: 'Citas', grupo: 'Taller',
      acciones: [A.ver, acc('editar', 'Confirmar / cambiar estado')] },

    // ── Clientes ──
    { codigo: 'clientes', nombre: 'Clientes', grupo: 'Clientes', acciones: CRUD },
    { codigo: 'vehiculos', nombre: 'Vehículos', grupo: 'Clientes', acciones: CRUD },
    { codigo: 'cuentas_cobrar', nombre: 'Pagarés y cuentas por cobrar', grupo: 'Clientes',
      acciones: [A.ver, A.crear, acc('editar', 'Editar (vencimiento, datos)'), acc('eliminar', 'Eliminar / anular / reabrir')] },
    { codigo: 'pagos_clientes', nombre: 'Registro de pagos de clientes', grupo: 'Clientes',
      descripcion: 'Requiere además ver Pagarés para llegar a la cuenta.',
      acciones: [acc('crear', 'Registrar pagos'), acc('eliminar', 'Anular pagos')] },

    // ── Dinero ──
    { codigo: 'caja', nombre: 'Caja diaria', grupo: 'Finanzas',
      acciones: [A.ver, acc('crear', 'Registrar movimientos de caja'), acc('aprobar', 'Abrir y cerrar caja')] },
    { codigo: 'finanzas', nombre: 'Finanzas, cuentas y nómina', grupo: 'Finanzas',
      acciones: [A.ver, A.crear, A.editar, acc('eliminar', 'Anular movimientos / pagos')] },
    { codigo: 'proveedores', nombre: 'Proveedores, compras y gastos', grupo: 'Proveedores', acciones: CRUD },

    // ── Reportes ──
    { codigo: 'estadisticas', nombre: 'Reportes y estadísticas', grupo: 'Reportes', acciones: [A.ver] },

    // ── Ajustes ──
    { codigo: 'servicios', nombre: 'Servicios del taller', grupo: 'Ajustes', acciones: CRUD },
    { codigo: 'sucursales', nombre: 'Sucursales', grupo: 'Ajustes', acciones: CRUD },
    { codigo: 'bitacora', nombre: 'Bitácora de operaciones', grupo: 'Ajustes',
      descripcion: 'Historial de órdenes y conversaciones del chatbot.',
      acciones: [A.ver] },

    // ── Administración de la empresa ──
    // Quien gestiona usuarios solo puede conceder permisos que él mismo tiene.
    { codigo: 'usuarios', nombre: 'Usuarios y permisos de la empresa', grupo: 'Empresa',
      descripcion: 'Solo puede conceder los permisos que la propia persona tiene.',
      acciones: [A.ver, A.crear, acc('editar', 'Editar, activar/desactivar, permisos y restablecer acceso'), A.eliminar] },
    { codigo: 'auditoria', nombre: 'Auditoría de la empresa', grupo: 'Empresa', acciones: [A.ver] },
    { codigo: 'empresa', nombre: 'Configuración de la empresa', grupo: 'Empresa',
      descripcion: 'Datos comerciales que aparecen en proformas, PDF y Excel.',
      acciones: [A.ver, A.editar] },
];

const MAPA = new Map(MODULOS.map(m => [m.codigo, m]));

/** true si (modulo, accion) existe en el catálogo. */
function existe(modulo, accion) {
    const m = MAPA.get(modulo);
    return Boolean(m && m.acciones.some(a => a.codigo === accion));
}

/** true si el permiso puede asignarse a un usuario (excluye los de superadmin). */
function esAsignable(modulo, accion) {
    return existe(modulo, accion) && !MAPA.get(modulo).soloSuperadmin;
}

/** Lista plana de todos los permisos asignables como 'modulo:accion'. */
function todosAsignables() {
    return MODULOS.filter(m => !m.soloSuperadmin)
        .flatMap(m => m.acciones.map(a => `${m.codigo}:${a.codigo}`));
}

// ── Plantillas por rol ─────────────────────────────────────────
// Reproducen EXACTAMENTE lo que cada rol podía hacer antes de este sistema,
// para que la migración no quite ni agregue acceso a las cuentas existentes.
// El superadministrador luego ajusta cada persona por separado.
const p = (modulo, ...acciones) => acciones.map(a => `${modulo}:${a}`);
const PLANTILLAS = {
    administrador: [
        ...p('dashboard', 'ver'),
        ...p('inventario_mecanica', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('inventario_colisiones', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('registros_inventario', 'ver', 'crear', 'aprobar'),
        ...p('pedidos_tienda', 'ver', 'editar'),
        ...p('ordenes', 'ver', 'crear', 'editar', 'eliminar', 'asignar', 'aprobar'),
        ...p('proformas_mecanica', 'ver', 'crear', 'editar', 'eliminar', 'exportar', 'aprobar'),
        ...p('proformas_colisiones', 'ver', 'crear', 'editar', 'eliminar', 'exportar', 'aprobar'),
        ...p('citas', 'ver', 'editar'),
        ...p('clientes', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('vehiculos', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('cuentas_cobrar', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('pagos_clientes', 'crear', 'eliminar'),
        ...p('caja', 'ver', 'crear', 'aprobar'),
        ...p('finanzas', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('proveedores', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('estadisticas', 'ver'),
        ...p('servicios', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('sucursales', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('bitacora', 'ver'),
        // Sprint 22: el administrador de cada mecánica gestiona su personal.
        ...p('usuarios', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('auditoria', 'ver'),
        ...p('empresa', 'ver', 'editar'),
    ],
    recepcionista: [
        ...p('dashboard', 'ver'),
        ...p('inventario_mecanica', 'ver'),
        ...p('inventario_colisiones', 'ver'),
        ...p('registros_inventario', 'ver', 'crear'),
        ...p('pedidos_tienda', 'ver', 'editar'),
        // Recepcion creaba, editaba y asignaba ordenes; eliminar era solo del admin.
        ...p('ordenes', 'ver', 'crear', 'editar', 'asignar'),
        ...p('proformas_mecanica', 'ver', 'crear', 'editar', 'exportar', 'aprobar'),
        ...p('proformas_colisiones', 'ver', 'crear', 'editar', 'exportar', 'aprobar'),
        ...p('citas', 'ver', 'editar'),
        ...p('clientes', 'ver', 'crear', 'editar', 'eliminar'),
        ...p('vehiculos', 'ver', 'crear', 'editar'),
        ...p('cuentas_cobrar', 'ver', 'crear', 'editar'),
        ...p('pagos_clientes', 'crear'),
        ...p('caja', 'ver', 'crear', 'aprobar'),
    ],
    tecnico: [
        ...p('dashboard', 'ver'),
        ...p('inventario_mecanica', 'ver', 'crear', 'editar'),
        ...p('inventario_colisiones', 'ver', 'crear', 'editar'),
        ...p('registros_inventario', 'ver', 'crear'),
        ...p('pedidos_tienda', 'ver', 'editar'),
        // El tecnico actualiza el avance de las ordenes que tiene asignadas.
        ...p('ordenes', 'ver', 'editar'),
        ...p('proformas_mecanica', 'ver', 'crear', 'editar', 'exportar', 'aprobar'),
        ...p('proformas_colisiones', 'ver', 'crear', 'editar', 'exportar', 'aprobar'),
        ...p('citas', 'ver', 'editar'),
        // El tecnico no veia la pagina de Clientes; solo los registraba
        // desde el formulario de la orden de trabajo.
        ...p('clientes', 'crear'),
        ...p('vehiculos', 'ver', 'crear', 'editar'),
    ],
    // Personal con acceso a medida: empieza sin nada.
    interno: [],
};

/** Módulo de proformas que corresponde a un tipo de proforma. */
const moduloProforma = (tipo) => (tipo === 'pintura' ? 'proformas_colisiones' : 'proformas_mecanica');
/** Módulo de inventario que corresponde a un área de inventario. */
const moduloInventario = (area) => (area === 'colisiones' ? 'inventario_colisiones' : 'inventario_mecanica');
const AREAS_INVENTARIO = ['mecanica', 'colisiones'];

module.exports = {
    ROL_SUPERADMIN, ROLES_STAFF, ROLES_ASIGNABLES, ROLES_TODOS,
    MODULOS, PLANTILLAS, AREAS_INVENTARIO,
    existe, esAsignable, todosAsignables, moduloProforma, moduloInventario,
};
