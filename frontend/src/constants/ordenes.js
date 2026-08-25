/**
 * SS SWAP - Constantes de Órdenes de Trabajo
 * Estados, etapas de progreso, colores y filtros compartidos entre
 * el panel administrativo y el portal de clientes.
 */
export const ESTADOS_ORDEN = [
    { val: 'pendiente',    label: 'Pendiente',    color: '#f59e0b' },
    { val: 'en_progreso',  label: 'En Progreso',  color: '#0ea5e9' },
    { val: 'completado',   label: 'Entregado',    color: '#10b981' },
    { val: 'cancelado',    label: 'Cancelado',    color: '#ef4444' },
];

// NOTA: 'estado_progreso' (abajo) y 'estado' (arriba) son campos independientes.
// Que una orden llegue a 'listo_entrega' en su progreso NO cambia su estado a
// 'completado'/Entregado automaticamente — eso solo pasa cuando alguien pulsa
// la accion "Marcar entregado" explicitamente (ver OrdenesTrabajo.jsx).
export const ESTADOS_PROGRESO = [
    { val: 'en_revision',          label: 'En Revisión',          color: '#6366f1' },
    { val: 'deteccion_falla',      label: 'Detección de falla',   color: '#f59e0b' },
    { val: 'en_reparacion',        label: 'En Reparación',        color: '#0ea5e9' },
    { val: 'esperando_repuestos',  label: 'Esperando repuestos',  color: '#a855f7' },
    { val: 'pruebas_finales',      label: 'Pruebas finales',      color: '#14b8a6' },
    { val: 'listo_entrega',        label: 'Listo para entrega',   color: '#10b981' },
];

export const ESTADO_ORDEN_MAP = Object.fromEntries(ESTADOS_ORDEN.map(e => [e.val, e]));
export const ESTADO_PROGRESO_MAP = Object.fromEntries(ESTADOS_PROGRESO.map(e => [e.val, e]));

export const FILTROS_ORDEN = [
    { val: '',             label: 'Todas las Ordenes' },
    { val: 'pendiente',    label: 'Ordenes Pendientes' },
    { val: 'en_progreso',  label: 'Ordenes en Progreso' },
    { val: 'anteriores',   label: 'Ordenes Anteriores' },
];
