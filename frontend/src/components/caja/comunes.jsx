/**
 * SS SWAP - Piezas compartidas de Caja: formato de fechas, nombres de las
 * formas de pago y la diferencia de cuadre (sobrante / faltante / cuadra).
 */
import React from 'react';
import { dinero, VERDE, ROJO, AMBAR } from '../finanzas/tema';
import { Badge } from '../finanzas/Modales';

export const fechaHora = (iso) => (iso
    ? new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—');
export const hora = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

export const NOMBRE_FORMA = {
    efectivo: 'Efectivo', cheque: 'Cheque', transferencia: 'Transferencia',
    tarjeta_credito: 'Tarjeta de crédito', tarjeta_debito: 'Tarjeta de débito', otro: 'Otro', credito: 'Crédito (por cobrar)',
};

/** Diferencia de cuadre: sobrante en ámbar, faltante en rojo, cuadra en verde. */
export function Diferencia({ valor }) {
    if (valor === null || valor === undefined) return <span>—</span>;
    const v = Number(valor) || 0;
    if (Math.abs(v) < 0.005) return <Badge color={VERDE}>CUADRA</Badge>;
    return <strong style={{ color: v > 0 ? AMBAR : ROJO, whiteSpace: 'nowrap' }}>{v > 0 ? 'Sobrante ' : 'Faltante '}{dinero(Math.abs(v))}</strong>;
}
