/**
 * SS SWAP - Compras: constantes y utilidades compartidas (Sprint 26)
 */

export const AREAS = [{ id: 'mecanica', label: 'Mecánica' }, { id: 'colisiones', label: 'Colisiones / Pintura' }];
export const AREA_LABEL = Object.fromEntries(AREAS.map(a => [a.id, a.label]));

/** Documento del proveedor. "factura" se registra con su autorización del SRI. */
export const DOCUMENTOS = [
    { id: 'factura', label: 'FACTURA (electrónica, con autorización del SRI)', corto: 'FACTURA' },
    { id: 'nota_venta', label: 'NOTA DE VENTA', corto: 'NOTA DE VENTA' },
    { id: 'otro', label: 'OTRO COMPROBANTE (factura física, recibo)', corto: 'COMPROBANTE' },
    { id: 'orden', label: 'ORDEN DE COMPRA (pedido al proveedor, se recibe después)', corto: 'ORDEN DE COMPRA' },
];
export const DOCUMENTO_CORTO = Object.fromEntries(DOCUMENTOS.map(d => [d.id, d.corto]));

export const TIPOS_REGISTRO = [
    { id: 'inventario', label: 'Inventarios' },
    { id: 'gasto', label: 'Gastos / servicios' },
    { id: 'activo_fijo', label: 'Activos fijos' },
];
export const TIPO_REGISTRO_LABEL = Object.fromEntries(TIPOS_REGISTRO.map(t => [t.id, t.label]));
export const SUSTENTO_POR_REGISTRO = { inventario: '06', gasto: '01', activo_fijo: '03' };

/** Tabla de sustento tributario del SRI (respaldo si el servidor no responde el catálogo). */
export const SUSTENTOS = [
    ['01', 'Crédito Tributario para declaración de IVA (servicios y bienes distintos de inventarios y activos fijos)'],
    ['02', 'Costo o Gasto para declaración de IR (servicios y bienes distintos de inventarios y activos fijos)'],
    ['03', 'Activo Fijo - Crédito Tributario para declaración de IVA'],
    ['04', 'Activo Fijo - Costo o Gasto para declaración de IR'],
    ['05', 'Liquidación Gastos de Viaje, hospedaje y alimentación Gastos IR (a nombre de empleados y no de la empresa)'],
    ['06', 'Inventario - Crédito Tributario para declaración de IVA'],
    ['07', 'Inventario - Costo o Gasto para declaración de IR'],
    ['08', 'Valor pagado para solicitar Reembolso de Gasto (intermediario)'],
    ['09', 'Reembolso por Siniestros'],
    ['10', 'Distribución de Dividendos, Beneficios o Utilidades'],
    ['11', "Convenios de débito o recaudación para IFI's"],
    ['12', 'Impuestos y retenciones presuntivos'],
    ['13', 'Valores reconocidos por entidades del sector público a favor de sujetos pasivos'],
    ['14', 'Valores facturados por socios a operadoras de transporte (que no constituyen gasto de dicha operadora)'],
    ['15', 'Pagos efectuados por consumos propios y de terceros de servicios digitales'],
    ['00', 'Casos especiales cuyo sustento no aplica en las opciones anteriores'],
].map(([codigo, texto]) => ({ codigo, texto }));

export const ESTADOS_COMPRA = {
    pendiente: { label: 'PENDIENTE', color: '#f59e0b' },
    solicitada: { label: 'SOLICITADA', color: '#0ea5e9' },
    en_proceso: { label: 'EN PROCESO', color: '#8b5cf6' },
    recibida: { label: 'REGISTRADA', color: '#10b981' },
    cancelada: { label: 'CANCELADA', color: '#ef4444' },
};
export const SIG_ESTADO = { pendiente: 'solicitada', solicitada: 'en_proceso', en_proceso: 'recibida' };

export const METODOS = [
    { id: 'efectivo', label: 'Efectivo (sale de caja)' },
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'cheque', label: 'Cheque' },
    { id: 'otro', label: 'Otro' },
];
export const DIAS_CREDITO = 15;

/** Fecha local YYYY-MM-DD */
export const hoy = () => new Date().toLocaleDateString('sv-SE');
export const sumarDias = (fecha, dias) => {
    const d = new Date(`${fecha || hoy()}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toLocaleDateString('sv-SE');
};
export const inicioMes = () => `${hoy().slice(0, 8)}01`;
export const finMes = () => {
    const [a, m] = hoy().split('-').map(Number);
    return new Date(a, m, 0).toLocaleDateString('sv-SE');
};
/** 2026-10-05 (o Date ISO) -> 05/10/2026 */
export const fechaCorta = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'; };
export const fechaIso = (f) => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(f || '')); return m ? m[1] : ''; };
/** Cantidad sin ceros sobrantes (2, 2.5, 0.125). */
export const cant = (n) => (Number(n) % 1 === 0 ? String(Number(n)) : String(Number(Number(n).toFixed(4))));
export const precio4 = (n) => Number(n || 0).toFixed(4);

/** "001-002-000087124" a partir de sus partes; null si falta algo. */
export function numeroDocumento(est, pto, sec) {
    const e = String(est || '').trim(); const p = String(pto || '').trim(); const s = String(sec || '').trim();
    if (!/^\d{1,3}$/.test(e) || !/^\d{1,3}$/.test(p) || !/^\d{1,9}$/.test(s) || Number(s) === 0) return null;
    return `${e.padStart(3, '0')}-${p.padStart(3, '0')}-${s.padStart(9, '0')}`;
}

/** Tarifa de IVA de un artículo de factura electrónica (impuesto código 2). */
export function tarifaIva(impuestos) {
    const iva = (Array.isArray(impuestos) ? impuestos : []).filter(t => String(t.codigo) === '2');
    return iva.length ? Math.max(...iva.map(t => Number(t.tarifa) || 0)) : 0;
}

/** Descarga un CSV que Excel abre directamente (UTF-8 con BOM, separador ;). */
export function descargarCsv(nombre, filas) {
    const celda = (v) => {
        const t = v === null || v === undefined ? '' : String(v);
        return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const contenido = '﻿' + filas.map(f => f.map(celda).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Número con coma decimal para Excel en español: 1234.5 -> "1234,50" */
export const numExcel = (n) => Number(n || 0).toFixed(2).replace('.', ',');
