/**
 * SS SWAP - Historial de Movimientos de Inventario
 * Registro auditado de todas las entradas y salidas de stock del taller.
 * Soporta filtros por tipo, búsqueda por repuesto o usuario, exportación a CSV
 * y paginación del historial completo para trazabilidad administrativa.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import './Movimientos.css';

function IconDownload() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }
function IconSearch()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconIn()       { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>; }
function IconOut()      { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>; }

const TIPO_META = {
    entrada: { color: '#10b981', bg: 'rgba(16,185,129,.10)',  border: 'rgba(16,185,129,.28)', label: 'ENTRADA', icon: IconIn },
    salida:  { color: '#ef4444', bg: 'rgba(239,68,68,.10)',   border: 'rgba(239,68,68,.28)',  label: 'SALIDA',  icon: IconOut },
};

export default function Movimientos() {
    const { isDark } = useTheme();
    const [movimientos, setMovimientos] = useState([]);
    const [loading, setLoading]         = useState(true);
    const [filtroTipo, setFiltroTipo]   = useState('');
    const [busqueda, setBusqueda]       = useState('');

    // ── Paleta celeste / blanco / negro ──
    const SKY      = '#0ea5e9';
    const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.18)';

    const txt     = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf   = isDark ? '#cbd5e1' : '#334155';
    const mut     = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const faint   = isDark ? 'rgba(241,245,249,0.38)' : '#94a3b8';
    const bdr     = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.07)';
    const card    = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh  = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';
    const inputBg = isDark ? '#0b1220' : '#fafcff';
    const headBg  = isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.025)';
    const rowHov  = isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.04)';

    useEffect(() => {
        setLoading(true);
        const params = filtroTipo ? `?tipo=${filtroTipo}&limit=200` : '?limit=200';
        api.get(`/inventory/movimientos${params}`)
            .then(r => setMovimientos(r.data.movimientos))
            .finally(() => setLoading(false));
    }, [filtroTipo]);

    const filtrados = useMemo(() => movimientos.filter(m =>
        !busqueda ||
        m.repuesto_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.repuesto_codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.usuario_nombre?.toLowerCase().includes(busqueda.toLowerCase())
    ), [movimientos, busqueda]);

    // Stats rápidos
    const stats = useMemo(() => {
        const ent = filtrados.filter(m => m.tipo === 'entrada');
        const sal = filtrados.filter(m => m.tipo === 'salida');
        return {
            total:      filtrados.length,
            entradas:   ent.length,
            salidas:    sal.length,
            unidadesIn: ent.reduce((s, m) => s + (parseInt(m.cantidad) || 0), 0),
            unidadesOut:sal.reduce((s, m) => s + (parseInt(m.cantidad) || 0), 0),
        };
    }, [filtrados]);

    const exportCSV = () => {
        const rows = [['Fecha','Tipo','Codigo','Repuesto','Cantidad','Stock Anterior','Stock Nuevo','Motivo','Referencia','Usuario']];
        filtrados.forEach(m => rows.push([
            new Date(m.created_at).toLocaleString('es-EC'), m.tipo, m.repuesto_codigo, m.repuesto_nombre,
            m.cantidad, m.stock_anterior, m.stock_nuevo, m.motivo || '', m.referencia || '', m.usuario_nombre
        ]));
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `movimientos_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
    };

    const inputStyle = { padding: '10px 12px 10px 32px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none', width: 240, transition: 'border-color .18s, box-shadow .18s' };
    const selStyle   = { padding: '10px 12px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none', transition: 'border-color .18s, box-shadow .18s' };

    // Etiqueta relativa de fecha (Hoy / Ayer / etc.)
    const fechaLabel = (iso) => {
        const d = new Date(iso);
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        const dia = new Date(d); dia.setHours(0,0,0,0);
        const diff = Math.round((hoy - dia) / 86400000);
        if (diff === 0) return 'HOY';
        if (diff === 1) return 'AYER';
        if (diff < 7)   return 'ESTA SEMANA';
        if (diff < 30)  return 'ESTE MES';
        return 'ANTERIORES';
    };
    const hayFiltros = Boolean(busqueda || filtroTipo);
    const limpiarFiltros = () => { setBusqueda(''); setFiltroTipo(''); };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500 }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="SS SWAP-chip" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        <span>SS SWAP · TRAZABILIDAD</span>
                    </div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Movimientos</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        Historial completo de entradas y salidas de inventario
                    </p>
                </div>
            </div>

            {/* ── Mini KPIs ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
                <MiniStat label="Total" value={stats.total} color={SKY} bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} />
                <MiniStat label="Entradas" value={stats.entradas} sub={`+${stats.unidadesIn} und`} color="#10b981" bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} />
                <MiniStat label="Salidas" value={stats.salidas} sub={`-${stats.unidadesOut} und`} color="#ef4444" bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} />
                <MiniStat label="Balance neto" value={stats.unidadesIn - stats.unidadesOut} color={stats.unidadesIn - stats.unidadesOut >= 0 ? SKY_DEEP : '#ef4444'} bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} />
            </div>

            {/* ── Toolbar ── */}
            <div style={{
                padding: 16, marginBottom: 16,
                background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh,
            }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: faint, display: 'flex' }}><IconSearch /></span>
                        <input className="mov-input"
                            placeholder="Buscar repuesto, codigo o usuario..."
                            value={busqueda} onChange={e => setBusqueda(e.target.value)}
                            style={inputStyle} />
                    </div>
                    <select className="mov-input" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={selStyle}>
                        <option value="">Todos los tipos</option>
                        <option value="entrada">Solo entradas</option>
                        <option value="salida">Solo salidas</option>
                    </select>
                    <div style={{ flex: 1 }} />
                    <button onClick={exportCSV} className="btn-ghost"><IconDownload /> EXPORTAR CSV</button>
                </div>

                {hayFiltros && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${bdr}`, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.22em', color: mut }}>FILTROS ACTIVOS</span>
                        {busqueda && (
                            <Chip label={`"${busqueda}"`} onRemove={() => setBusqueda('')} color={SKY_DEEP} bg={SKY_PALE} bdr={SKY_BDR} />
                        )}
                        {filtroTipo && (
                            <Chip label={filtroTipo === 'entrada' ? 'Solo entradas' : 'Solo salidas'} onRemove={() => setFiltroTipo('')}
                                  color={filtroTipo === 'entrada' ? '#10b981' : '#ef4444'}
                                  bg={filtroTipo === 'entrada' ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)'}
                                  bdr={filtroTipo === 'entrada' ? 'rgba(16,185,129,.28)' : 'rgba(239,68,68,.28)'} />
                        )}
                        <button onClick={limpiarFiltros}
                            style={{
                                marginLeft: 'auto',
                                fontFamily: "'Bebas Neue'", fontSize: '.66rem', letterSpacing: '.16em',
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                color: mut, transition: 'color .15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={e => e.currentTarget.style.color = mut}>
                            LIMPIAR TODO ×
                        </button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 4 }}>
                <span style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.82rem', color: txtSf }}>
                    {filtrados.length} <span style={{ color: mut, fontWeight: 400 }}>movimiento{filtrados.length !== 1 ? 's' : ''}</span>
                </span>
                {hayFiltros && <span style={{ fontFamily: "'Outfit'", fontSize: '.76rem', color: faint }}>· filtrado</span>}
            </div>

            {/* ── Tabla ── */}
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden', boxShadow: cardSh }}>
                {loading ? (
                    <div style={{ padding: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: SKY, animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: mut }}>Cargando movimientos...</p>
                    </div>
                ) : filtrados.length === 0 ? (
                    <div style={{ padding: 90, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 64, height: 64, borderRadius: 18, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKY }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        </div>
                        <div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.06em', color: txt }}>Sin registros</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, marginTop: 4 }}>No hay movimientos para los filtros seleccionados</p>
                        </div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${bdr}`, background: headBg }}>
                                    {['Fecha','Tipo','Repuesto','Cant.','Stock Ant.','Stock Nuevo','Motivo','Referencia','Usuario'].map(h => (
                                        <th key={h} style={{
                                            padding: '13px 16px', textAlign: 'left',
                                            fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em',
                                            color: SKY_DEEP, whiteSpace: 'nowrap',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtrados.map((m, idx) => {
                                    const meta = TIPO_META[m.tipo] || TIPO_META.entrada;
                                    const TipoIcon = meta.icon;
                                    const lbl = fechaLabel(m.created_at);
                                    const prevLbl = idx > 0 ? fechaLabel(filtrados[idx - 1].created_at) : null;
                                    const mostrarSeparador = lbl !== prevLbl;
                                    return (
                                        <React.Fragment key={m.id}>
                                            {mostrarSeparador && (
                                                <tr>
                                                    <td colSpan={9} style={{ padding: '14px 16px 6px', background: isDark ? 'rgba(14,165,233,0.03)' : 'rgba(14,165,233,0.02)' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                                                padding: '3px 9px', borderRadius: 999,
                                                                background: SKY_PALE, border: `1px solid ${SKY_BDR}`,
                                                                fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.22em', color: SKY_DEEP,
                                                            }}>
                                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: SKY }} />
                                                                {lbl}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        <tr className="mov-row"
                                            style={{ borderBottom: `1px solid ${bdr}`, transition: 'background .15s', animationDelay: `${Math.min(idx * 14, 220)}ms` }}
                                            onMouseEnter={e => e.currentTarget.style.background = rowHov}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                                            {/* Fecha */}
                                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.82rem', color: txt }}>{new Date(m.created_at).toLocaleDateString('es-EC')}</p>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.72rem', color: mut }}>{new Date(m.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </td>

                                            {/* Tipo */}
                                            <td style={{ padding: '12px 16px' }}>
                                                <span className="mov-pill" style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em',
                                                    padding: '4px 9px', borderRadius: 999,
                                                    background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    <TipoIcon /> {meta.label}
                                                </span>
                                            </td>

                                            {/* Repuesto */}
                                            <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.repuesto_nombre}</p>
                                                <code style={{
                                                    display: 'inline-block', marginTop: 2,
                                                    fontFamily: 'monospace', fontSize: '.7rem', fontWeight: 600,
                                                    background: SKY_PALE, padding: '1px 7px', borderRadius: 5,
                                                    color: SKY_DEEP, border: `1px solid ${SKY_BDR}`,
                                                }}>{m.repuesto_codigo}</code>
                                            </td>

                                            {/* Cantidad */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.25rem', letterSpacing: '.02em', color: meta.color }}>
                                                    {m.tipo === 'entrada' ? '+' : '−'}{m.cantidad}
                                                </span>
                                            </td>

                                            {/* Stock anterior */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: "'Bebas Neue'", fontSize: '1rem', letterSpacing: '.04em', color: mut }}>
                                                {m.stock_anterior}
                                            </td>

                                            {/* Stock nuevo */}
                                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.05rem', letterSpacing: '.02em', color: m.stock_nuevo < 5 ? '#ef4444' : SKY_DEEP }}>
                                                    {m.stock_nuevo}
                                                </span>
                                            </td>

                                            {/* Motivo */}
                                            <td style={{ padding: '12px 16px', fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.8rem', color: txtSf, maxWidth: 160 }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{m.motivo || <span style={{ color: mut }}>—</span>}</span>
                                            </td>

                                            {/* Referencia */}
                                            <td style={{ padding: '12px 16px' }}>
                                                {m.referencia
                                                    ? <code style={{ fontFamily: 'monospace', fontSize: '.74rem', fontWeight: 500, background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.05)', padding: '2px 7px', borderRadius: 5, color: txtSf, border: `1px solid ${bdr}` }}>{m.referencia}</code>
                                                    : <span style={{ color: mut, fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.8rem' }}>—</span>}
                                            </td>

                                            {/* Usuario */}
                                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.62rem', color: '#fff' }}>{m.usuario_nombre?.[0]?.toUpperCase()}</span>
                                                    </div>
                                                    <span style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.8rem', color: txtSf }}>{m.usuario_nombre}</span>
                                                </div>
                                            </td>
                                        </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function Chip({ label, onRemove, color, bg, bdr }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 4px 4px 11px', borderRadius: 999,
            background: bg, border: `1px solid ${bdr}`, color,
            fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.74rem',
            animation: 'bounceIn .25s ease',
        }}>
            {label}
            <button onClick={onRemove}
                style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
                    color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </span>
    );
}

function MiniStat({ label, value, sub, color, bg, bdr, mut, txt, shadow }) {
    return (
        <div style={{
            padding: '14px 16px', background: bg, border: `1px solid ${bdr}`,
            borderRadius: 12, position: 'relative', overflow: 'hidden',
            boxShadow: shadow, transition: 'transform .25s, border-color .25s',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = color + '55'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = bdr; }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(180deg, ${color}, transparent)` }} />
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.56rem', letterSpacing: '.22em', color: mut }}>{label.toUpperCase()}</p>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.02em', color, lineHeight: 1, marginTop: 4 }}>{value}</p>
            {sub && <p style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.72rem', color, marginTop: 4, opacity: .85 }}>{sub}</p>}
        </div>
    );
}
