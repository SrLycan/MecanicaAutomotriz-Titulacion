/**
 * SS SWAP - Compras: piezas visuales compartidas (insignias, totales, indicadores)
 */
import React from 'react';
import { dinero } from '../../finanzas/tema';
import { cant } from './comunes';

export function Badge({ color, children, title }) {
    return <span className="prov-badge" title={title} style={{ background: `${color}18`, border: `1px solid ${color}44`, color, whiteSpace: 'nowrap' }}>{children}</span>;
}

/** Caja de totales como en los sistemas contables: Subtotal IVA / 0%, descuento, impuesto y total. */
export function TotalesCompra({ theme, totales }) {
    const { txt, mut, bdr, card, cardSh, SKY_DEEP, inputBg } = theme;
    const Celda = ({ etiqueta, valor, fuerte, color }) => (
        <div>
            <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', fontWeight: 600, color: color || SKY_DEEP, marginBottom: 4 }}>{etiqueta}</p>
            <p style={{ fontFamily: fuerte ? "'Bebas Neue'" : "'Outfit'", fontSize: fuerte ? '1.7rem' : '1.02rem', fontWeight: fuerte ? 400 : 600, letterSpacing: fuerte ? '.02em' : 0,
                color: fuerte ? '#dc2626' : txt, background: inputBg, border: `1px solid ${fuerte ? '#f59e0b88' : bdr}`, borderRadius: 9, padding: fuerte ? '6px 12px' : '8px 12px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {dinero(valor)}
            </p>
        </div>
    );
    return (
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Celda etiqueta={`Subtotal ${cant(totales.tarifa_iva ?? 15)}%`} valor={totales.subtotal_iva} />
                <Celda etiqueta="Subtotal 0%" valor={totales.subtotal_0} />
                <Celda etiqueta="Descuento" valor={totales.descuento} color={mut} />
                <Celda etiqueta={`Impuesto ${cant(totales.tarifa_iva ?? 15)}%`} valor={totales.iva} color={mut} />
            </div>
            <div style={{ marginTop: 12 }}>
                <Celda etiqueta="Total" valor={totales.total} fuerte color={mut} />
            </div>
        </div>
    );
}

/** Indicador grande (TOTAL / CANTIDAD) con ícono. */
export function Indicador({ theme, icono, etiqueta, valor, color }) {
    const { card, bdr, cardSh, mut, txt } = theme;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: '14px 18px', minWidth: 0 }}>
            <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 12, background: `${color}1a`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icono}</span>
            <div style={{ minWidth: 0, textAlign: 'right', flex: 1 }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.86rem', letterSpacing: '.14em', color: mut }}>{etiqueta}</p>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.02em', color: txt, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{valor}</p>
            </div>
        </div>
    );
}

export function IconCarrito() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>; }
export function IconCajas() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
export function IconOjo() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }
export function IconImpresora() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>; }
export function IconPapelera() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }
export function IconMas() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
export function IconUsuario() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
export function IconXml() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>; }
export function IconDinero() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>; }
