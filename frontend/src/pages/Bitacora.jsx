/**
 * SS SWAP - Bitácora General (solo Administradores)
 * Consulta en un solo lugar la auditoría de dos fuentes almacenadas en MongoDB:
 * el historial de cambios de las órdenes de trabajo y las conversaciones
 * del chatbot. Soporta paginación, filtros y pestañas por tipo de registro.
 */
import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { ESTADO_ORDEN_MAP, ESTADO_PROGRESO_MAP } from '../constants/ordenes';
import './Bitacora.css';

// Acento propio para esta seccion (distinto del celeste de Inventario/Movimientos)
// para que se note a simple vista que estos datos vienen de MongoDB, no de Postgres.
const ACCENT      = '#6366f1';
const ACCENT_DEEP = '#4338ca';
const POR_PAGINA  = 20;

function IconChat()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>; }
function IconClock()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconChevron({ open }) { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}><polyline points="9 18 15 12 9 6"/></svg>; }
function IconLeaf()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 11 13.5 11 11"/></svg>; }
function IconTruck()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>; }

export default function Bitacora() {
    const { isDark } = useTheme();
    const [tab, setTab] = useState('conversaciones'); // 'conversaciones' | 'ordenes'

    const txt   = isDark ? '#f1f5f9' : '#0f172a';
    const mut   = isDark ? 'rgba(241,245,249,0.72)' : '#526075';
    const bdr   = isDark ? 'rgba(148,163,184,0.28)' : '#b6c3d3';
    const card  = isDark ? 'rgba(255,255,255,0.045)' : '#ffffff';
    const pale  = isDark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.06)';

    const estilos = { isDark, txt, mut, bdr, card, pale };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1400 }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: 20 }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '4px 11px', borderRadius: 999,
                    background: pale, border: `1px solid ${ACCENT}55`,
                    fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '.76rem',
                    letterSpacing: '.06em', textTransform: 'uppercase', color: ACCENT,
                    marginBottom: 8,
                }}>
                    <IconLeaf /> MongoDB Atlas
                </div>
                <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Bitácora</h1>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                    Conversaciones de SWAPBot e historial de cambios de órdenes — datos persistidos en MongoDB
                </p>
            </div>

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: `1px solid ${bdr}`, overflowX: 'auto' }}>
                <TabButton active={tab === 'conversaciones'} onClick={() => setTab('conversaciones')} icon={<IconChat />} label="Conversaciones" txt={txt} mut={mut} />
                <TabButton active={tab === 'ordenes'}        onClick={() => setTab('ordenes')}        icon={<IconClock />} label="Historial de Órdenes" txt={txt} mut={mut} />
                <TabButton active={tab === 'otras'}          onClick={() => setTab('otras')}          icon={<IconTruck />} label="Otras acciones" txt={txt} mut={mut} />
            </div>

            {tab === 'conversaciones' && <PanelConversaciones {...estilos} />}
            {tab === 'ordenes'        && <PanelHistorialOrdenes {...estilos} />}
            {tab === 'otras'          && <PanelOtrasAcciones {...estilos} />}
        </div>
    );
}

function TabButton({ active, onClick, icon, label, txt, mut }) {
    return (
        <button className="bit-tab" onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
            color: active ? ACCENT : mut,
            fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.86rem',
            marginBottom: -1,
        }}>
            {icon} {label}
        </button>
    );
}

function Paginador({ pagina, setPagina, total, porPagina, mut, txt, bdr }) {
    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    if (totalPaginas <= 1) return null;
    const btnStyle = (disabled) => ({
        padding: '6px 12px', borderRadius: 8, border: `1px solid ${bdr}`,
        background: 'none', color: disabled ? mut : txt, cursor: disabled ? 'default' : 'pointer',
        fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.78rem', opacity: disabled ? .4 : 1,
    });
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 18 }}>
            <button style={btnStyle(pagina <= 1)} disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>← Anterior</button>
            <span style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut }}>Página {pagina} de {totalPaginas} · {total} registros</span>
            <button style={btnStyle(pagina >= totalPaginas)} disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>Siguiente →</button>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   TAB 1 — Conversaciones del chatbot (GET /chatbot/conversaciones)
   ══════════════════════════════════════════════════════════════ */
function PanelConversaciones({ isDark, txt, mut, bdr, card, pale }) {
    const [conversaciones, setConversaciones] = useState([]);
    const [total, setTotal]     = useState(0);
    const [pagina, setPagina]   = useState(1);
    const [loading, setLoading] = useState(true);
    const [abierta, setAbierta] = useState(null);

    useEffect(() => {
        setLoading(true);
        api.get(`/chatbot/conversaciones?pagina=${pagina}&porPagina=${POR_PAGINA}`)
            .then(r => { setConversaciones(r.data.conversaciones || []); setTotal(r.data.total || 0); })
            .catch(() => { setConversaciones([]); setTotal(0); })
            .finally(() => setLoading(false));
    }, [pagina]);

    if (loading) return <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Cargando conversaciones…</p>;

    if (!conversaciones.length) {
        return (
            <div style={{ padding: '40px 24px', textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: mut }}>
                    Todavía no hay conversaciones guardadas. Se registran automáticamente cuando alguien usa SWAPBot en el sitio público.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {conversaciones.map((c, i) => {
                    const expandida = abierta === c.id;
                    const ultimoMsg = c.mensajes?.[c.mensajes.length - 1];
                    return (
                        <div key={c.id} className="bit-row" style={{ animationDelay: `${i * 30}ms`, background: card, border: `1px solid ${bdr}`, borderRadius: 12, overflow: 'hidden' }}>
                            <button onClick={() => setAbierta(expandida ? null : c.id)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: '13px 16px', textAlign: 'left' }}>
                                <IconChevron open={expandida} />
                                <span style={{
                                    fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.1em',
                                    padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
                                    background: c.canal === 'panel_cliente' ? 'rgba(16,185,129,.10)' : pale,
                                    color: c.canal === 'panel_cliente' ? '#10b981' : ACCENT,
                                    border: `1px solid ${c.canal === 'panel_cliente' ? 'rgba(16,185,129,.28)' : ACCENT + '40'}`,
                                }}>
                                    {c.canal === 'panel_cliente' ? 'CLIENTE' : 'VISITANTE'}
                                </span>
                                {c.cliente_nombre && (
                                    <span style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.78rem', color: '#10b981', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                        {c.cliente_nombre}
                                    </span>
                                )}
                                <span style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.82rem', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                    {ultimoMsg ? ultimoMsg.texto : '(sin mensajes)'}
                                </span>
                                <span style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut, flexShrink: 0 }}>
                                    {c.mensajes?.length || 0} mensajes
                                </span>
                                <span style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut, flexShrink: 0, minWidth: 130, textAlign: 'right' }}>
                                    {c.actualizado_en ? new Date(c.actualizado_en).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                </span>
                            </button>
                            {expandida && (
                                <div style={{ padding: '4px 16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${bdr}` }}>
                                    {(c.mensajes || []).map((m, idx) => (
                                        <div key={idx} style={{
                                            alignSelf: m.rol === 'user' ? 'flex-start' : 'flex-end',
                                            maxWidth: '75%', marginTop: 8,
                                            background: m.rol === 'user' ? (isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)') : pale,
                                            border: `1px solid ${m.rol === 'user' ? bdr : ACCENT + '30'}`,
                                            borderRadius: 10, padding: '8px 12px',
                                        }}>
                                            <p style={{ fontFamily: "'Outfit'", fontSize: '.76rem', fontWeight: 700, letterSpacing: '.05em', color: m.rol === 'user' ? mut : ACCENT, marginBottom: 3 }}>
                                                {m.rol === 'user' ? 'VISITANTE' : 'SWAPBOT'}
                                            </p>
                                            <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: txt }}>{m.texto}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <Paginador pagina={pagina} setPagina={setPagina} total={total} porPagina={POR_PAGINA} mut={mut} txt={txt} bdr={bdr} />
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   TAB 2 — Historial general de ordenes (GET /ordenes/ordenes/historial/general)
   ══════════════════════════════════════════════════════════════ */
function PanelHistorialOrdenes({ txt, mut, bdr, card }) {
    const [registros, setRegistros] = useState([]);
    const [total, setTotal]     = useState(0);
    const [pagina, setPagina]   = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.get(`/ordenes/ordenes/historial/general?pagina=${pagina}&porPagina=${POR_PAGINA}`)
            .then(r => { setRegistros(r.data.registros || []); setTotal(r.data.total || 0); })
            .catch(() => { setRegistros([]); setTotal(0); })
            .finally(() => setLoading(false));
    }, [pagina]);

    if (loading) return <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Cargando historial…</p>;

    if (!registros.length) {
        return (
            <div style={{ padding: '40px 24px', textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: mut }}>
                    Todavía no hay cambios de estado registrados en ninguna orden.
                </p>
            </div>
        );
    }

    const etiqueta = (map, val, fallback) => (val ? (map[val]?.label || val) : fallback);

    return (
        <div>
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                            {['Fecha', 'Orden', 'Cliente', 'Cambio', 'Realizado por', 'Notas'].map(h => (
                                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.12em', color: mut }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {registros.map((h, i) => {
                            const pasoAnterior = h.progreso_anterior ? etiqueta(ESTADO_PROGRESO_MAP, h.progreso_anterior) : etiqueta(ESTADO_ORDEN_MAP, h.estado_anterior, 'Inicio');
                            const pasoNuevo    = h.progreso_nuevo    ? etiqueta(ESTADO_PROGRESO_MAP, h.progreso_nuevo)    : etiqueta(ESTADO_ORDEN_MAP, h.estado_nuevo, '—');
                            const colorNuevo   = ESTADO_PROGRESO_MAP[h.progreso_nuevo]?.color || ESTADO_ORDEN_MAP[h.estado_nuevo]?.color || ACCENT_DEEP;
                            return (
                                <tr key={h.id} className="bit-row" style={{ animationDelay: `${i * 25}ms`, borderBottom: `1px solid ${bdr}` }}>
                                    <td style={{ padding: '11px 16px', fontFamily: "'Outfit'", fontSize: '.76rem', color: mut, whiteSpace: 'nowrap' }}>
                                        {h.created_at ? new Date(h.created_at).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </td>
                                    <td style={{ padding: '11px 16px', fontFamily: "'Bebas Neue'", fontSize: '1rem', color: txt }}>#{h.orden_id}</td>
                                    <td style={{ padding: '11px 16px' }}>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.8rem', color: txt }}>{h.cliente_nombre || '—'}</p>
                                        {h.placa && <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: mut }}>{h.placa}</p>}
                                    </td>
                                    <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                                        <span style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut }}>{pasoAnterior}</span>
                                        <span style={{ margin: '0 6px', color: colorNuevo }}>→</span>
                                        <span style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.8rem', color: colorNuevo }}>{pasoNuevo}</span>
                                    </td>
                                    <td style={{ padding: '11px 16px', fontFamily: "'Outfit'", fontSize: '.78rem', color: mut }}>{h.usuario_nombre || 'Sistema'}</td>
                                    <td style={{ padding: '11px 16px', fontFamily: "'Outfit'", fontSize: '.76rem', color: txt, maxWidth: 220 }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{h.notas || '—'}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <Paginador pagina={pagina} setPagina={setPagina} total={total} porPagina={POR_PAGINA} mut={mut} txt={txt} bdr={bdr} />
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   TAB 3 — Otras acciones: Proveedores, Compras, Gastos, Pagos
   (GET /ordenes/ordenes/historial/general?tipo=otras) — misma
   coleccion de Mongo que el historial de ordenes, filtrada por
   entidad_tipo != 'orden'. No es una bitacora paralela.
   ══════════════════════════════════════════════════════════════ */
const ENTIDAD_LABEL = {
    proveedor: { label: 'Proveedor', color: '#0284c7' },
    compra: { label: 'Compra', color: '#0ea5e9' },
    gasto: { label: 'Gasto', color: '#f59e0b' },
    movimiento_financiero: { label: 'Pago/Abono', color: '#10b981' },
    // Sprint 14
    proforma: { label: 'Proforma', color: '#8b5cf6' },
    inventario: { label: 'Inventario', color: '#f97316' },
    cuenta_cobrar: { label: 'Pagaré / Cuenta', color: '#c9a227' },
    pago: { label: 'Pago de cliente', color: '#10b981' },
    orden_eliminada: { label: 'Orden eliminada', color: '#ef4444' },
};

function PanelOtrasAcciones({ txt, mut, bdr, card }) {
    const [registros, setRegistros] = useState([]);
    const [total, setTotal]     = useState(0);
    const [pagina, setPagina]   = useState(1);
    const [loading, setLoading] = useState(true);
    const [entidad, setEntidad] = useState('');

    useEffect(() => {
        setLoading(true);
        api.get(`/ordenes/ordenes/historial/general?tipo=otras&pagina=${pagina}&porPagina=${POR_PAGINA}${entidad ? `&entidad=${entidad}` : ''}`)
            .then(r => { setRegistros(r.data.registros || []); setTotal(r.data.total || 0); })
            .catch(() => { setRegistros([]); setTotal(0); })
            .finally(() => setLoading(false));
    }, [pagina, entidad]);

    const filtro = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.74rem', letterSpacing: '.16em', color: mut }}>ENTIDAD</span>
            <select value={entidad} onChange={e => { setEntidad(e.target.value); setPagina(1); }}
                style={{ padding: '7px 10px', borderRadius: 9, border: `1px solid ${bdr}`, background: card, color: txt, fontFamily: "'Outfit'", fontSize: '.8rem' }}>
                <option value="">Todas</option>
                {Object.entries(ENTIDAD_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
        </div>
    );

    if (loading) return <div>{filtro}<p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Cargando historial…</p></div>;

    if (!registros.length) {
        return (
            <div>
                {filtro}
                <div style={{ padding: '40px 24px', textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: mut }}>
                        Todavía no hay acciones registradas{entidad ? ` para "${ENTIDAD_LABEL[entidad]?.label || entidad}"` : ' sobre proformas, inventario, pagarés, pagos, proveedores, compras o gastos'}.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {filtro}
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${bdr}` }}>
                            {['Fecha', 'Entidad', 'Acción', 'Detalle', 'Realizado por'].map(h => (
                                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.12em', color: mut }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {registros.map((h, i) => {
                            const info = ENTIDAD_LABEL[h.entidad_tipo] || { label: h.entidad_tipo, color: ACCENT_DEEP };
                            return (
                                <tr key={h.id} className="bit-row" style={{ animationDelay: `${i * 25}ms`, borderBottom: `1px solid ${bdr}` }}>
                                    <td style={{ padding: '11px 16px', fontFamily: "'Outfit'", fontSize: '.76rem', color: mut, whiteSpace: 'nowrap' }}>
                                        {h.created_at ? new Date(h.created_at).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </td>
                                    <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.74rem', letterSpacing: '.1em', padding: '3px 9px', borderRadius: 999, background: `${info.color}18`, border: `1px solid ${info.color}44`, color: info.color }}>
                                            {info.label.toUpperCase()} #{h.entidad_id}
                                        </span>
                                    </td>
                                    <td style={{ padding: '11px 16px', fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.8rem', color: txt, textTransform: 'capitalize' }}>
                                        {(h.accion || '').replace(/_/g, ' ')}
                                    </td>
                                    <td style={{ padding: '11px 16px', fontFamily: "'Outfit'", fontSize: '.76rem', color: mut, maxWidth: 460, lineHeight: 1.45 }}>
                                        <span style={{ display: 'block', whiteSpace: 'normal' }}>{h.detalle || '—'}</span>
                                    </td>
                                    <td style={{ padding: '11px 16px', fontFamily: "'Outfit'", fontSize: '.78rem', color: mut }}>{h.usuario_nombre || 'Sistema'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <Paginador pagina={pagina} setPagina={setPagina} total={total} porPagina={POR_PAGINA} mut={mut} txt={txt} bdr={bdr} />
        </div>
    );
}
