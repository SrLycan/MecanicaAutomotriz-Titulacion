/**
 * SS SWAP - Registros / Historial de Movimientos de Inventario
 * Registro auditado de todas las entradas y salidas de stock del taller.
 *
 * Sprint 14: los filtros se aplican en el SERVIDOR (antes se traian 200
 * filas y se filtraba en el navegador) y cada movimiento muestra su ORIGEN
 * (entrada manual, salida manual, salida por proforma, entrada por compra,
 * ajuste, devolucion) con la proforma, OT, cliente y vehiculo relacionados.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import './Movimientos.css';

function IconDownload() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }
function IconSearch()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }

const POR_PAGINA = 25;
const FILTROS_VACIOS = { q: '', tipo: '', origen: '', area: '', usuario_id: '', proforma: '', orden_id: '', fecha_inicio: '', fecha_fin: '' };

/** Etiqueta legible de tipo + origen (los 6 casos que pide el negocio). */
export function clasificarMovimiento(m) {
    if (m.origen === 'proforma') return { label: 'SALIDA POR PROFORMA', color: '#f97316' };
    if (m.origen === 'compra') return { label: 'ENTRADA POR COMPRA', color: '#10b981' };
    if (m.origen === 'ajuste') return { label: m.tipo === 'entrada' ? 'AJUSTE (+)' : 'AJUSTE (−)', color: '#8b5cf6' };
    if (m.origen === 'devolucion') return { label: 'DEVOLUCIÓN', color: '#0ea5e9' };
    if (m.origen === 'venta') return { label: 'VENTA A CLIENTE', color: '#e11d48' };
    return m.tipo === 'entrada' ? { label: 'ENTRADA MANUAL', color: '#10b981' } : { label: 'SALIDA MANUAL', color: '#ef4444' };
}
const fmtCant = (n) => (Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(2));
const AREA_LABEL = { mecanica: 'Mecánica', colisiones: 'Colisiones / Pintura' };

export default function Movimientos() {
    const { isDark } = useTheme();
    const [movimientos, setMovimientos] = useState([]);
    const [loading, setLoading]         = useState(true);
    const [filtros, setFiltros]         = useState(FILTROS_VACIOS);
    const [page, setPage]               = useState(1);
    const [total, setTotal]             = useState(0);
    const [totalPages, setTotalPages]   = useState(1);
    const [usuarios, setUsuarios]       = useState([]);
    const debounceRef = useRef(null);
    const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIOS);

    const SKY      = '#0ea5e9';
    const SKY_DEEP = '#0284c7';
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

    const construirParams = (f, pg, limit = POR_PAGINA) => {
        const params = new URLSearchParams();
        Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
        params.set('page', pg);
        params.set('limit', limit);
        return params;
    };

    const cargar = useCallback(async (f, pg) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/inventory/movimientos?${construirParams(f, pg)}`);
            setMovimientos(data.movimientos || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            setPage(pg);
        } catch { toast.error('Error al cargar los registros.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        cargar(FILTROS_VACIOS, 1);
        api.get('/inventory/movimientos/filtros').then(r => setUsuarios(r.data.usuarios || [])).catch(() => {});
    }, [cargar]);

    // Texto libre / proforma / OT con debounce; selects y fechas al instante
    const cambiarFiltro = (campo, valor, inmediato = false) => {
        const nuevos = { ...filtros, [campo]: valor };
        setFiltros(nuevos);
        clearTimeout(debounceRef.current);
        const aplicar = () => { setFiltrosAplicados(nuevos); cargar(nuevos, 1); };
        if (inmediato) aplicar(); else debounceRef.current = setTimeout(aplicar, 350);
    };
    const limpiarFiltros = () => { setFiltros(FILTROS_VACIOS); setFiltrosAplicados(FILTROS_VACIOS); cargar(FILTROS_VACIOS, 1); };
    const hayFiltros = Object.values(filtrosAplicados).some(Boolean);

    // Stats de la pagina visible
    const stats = useMemo(() => {
        const ent = movimientos.filter(m => m.tipo === 'entrada');
        const sal = movimientos.filter(m => m.tipo === 'salida');
        const porProforma = sal.filter(m => m.origen === 'proforma');
        const suma = (l) => Math.round(l.reduce((s, m) => s + (Number(m.cantidad) || 0), 0) * 100) / 100;
        return { entradas: ent.length, salidas: sal.length, proforma: porProforma.length, unidadesIn: suma(ent), unidadesOut: suma(sal) };
    }, [movimientos]);

    const exportCSV = async () => {
        try {
            const { data } = await api.get(`/inventory/movimientos?${construirParams(filtrosAplicados, 1, 500)}`);
            const rows = [['Fecha','Tipo','Origen','Inventario','Codigo','Producto','Cantidad','Stock Anterior','Stock Nuevo','Usuario','Proforma','Orden de trabajo','Cliente','Vehiculo','Motivo','Referencia']];
            (data.movimientos || []).forEach(m => rows.push([
                new Date(m.created_at).toLocaleString('es-EC'), m.tipo, clasificarMovimiento(m).label, AREA_LABEL[m.area] || '', m.repuesto_codigo, m.repuesto_nombre,
                m.cantidad, m.stock_anterior, m.stock_nuevo, m.usuario_nombre, m.proforma_numero || '', m.orden_numero || '',
                m.cliente_nombre || '', [m.vehiculo_descripcion, m.vehiculo_placa].filter(Boolean).join(' '), m.motivo || '', m.referencia || '',
            ]));
            const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
            a.download = `registros_inventario_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
        } catch { toast.error('Error al exportar.'); }
    };

    const inputStyle = { padding: '10px 12px 10px 32px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none', width: 260 };
    const selStyle   = { padding: '10px 12px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' };
    const etiq = { fontFamily: "'Bebas Neue'", fontSize: '.56rem', letterSpacing: '.2em', color: mut, display: 'block', marginBottom: 4 };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>SS SWAP · TRAZABILIDAD</span></div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Registros de inventario</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        Qué pasó con cada producto: entradas, salidas, compras, ajustes, devoluciones y salidas por proforma
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 18 }}>
                <MiniStat label="Registros" value={total} sub={hayFiltros ? 'con los filtros actuales' : 'en total'} color={SKY} bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} />
                <MiniStat label="Entradas (página)" value={stats.entradas} sub={`+${fmtCant(stats.unidadesIn)} und`} color="#10b981" bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} />
                <MiniStat label="Salidas (página)" value={stats.salidas} sub={`-${fmtCant(stats.unidadesOut)} und`} color="#ef4444" bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} />
                <MiniStat label="Por proforma (página)" value={stats.proforma} color="#f97316" bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} />
            </div>

            {/* ── Filtros ── */}
            <div style={{ padding: 16, marginBottom: 16, background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <span style={etiq}>PRODUCTO / CLIENTE / PLACA</span>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: faint, display: 'flex' }}><IconSearch /></span>
                            <input className="mov-input" placeholder="Nombre, código, cliente, placa..." value={filtros.q} onChange={e => cambiarFiltro('q', e.target.value)} style={inputStyle} />
                        </div>
                    </div>
                    <div>
                        <span style={etiq}>TIPO DE MOVIMIENTO</span>
                        <select className="mov-input" value={`${filtros.tipo}|${filtros.origen}`} style={selStyle}
                            onChange={e => { const [tipo, origen] = e.target.value.split('|'); const n = { ...filtros, tipo, origen }; setFiltros(n); setFiltrosAplicados(n); cargar(n, 1); }}>
                            <option value="|">Todos</option>
                            <option value="entrada|manual">Entrada manual</option>
                            <option value="salida|manual">Salida manual</option>
                            <option value="salida|proforma">Salida por proforma</option>
                            <option value="salida|venta">Venta a cliente (tienda)</option>
                            <option value="entrada|compra">Entrada por compra</option>
                            <option value="|ajuste">Ajuste de inventario</option>
                            <option value="entrada|devolucion">Devolución</option>
                            <option value="entrada|">Todas las entradas</option>
                            <option value="salida|">Todas las salidas</option>
                        </select>
                    </div>
                    <div>
                        <span style={etiq}>TIPO DE INVENTARIO</span>
                        <select className="mov-input" value={filtros.area} onChange={e => cambiarFiltro('area', e.target.value, true)} style={selStyle}>
                            <option value="">Ambos</option>
                            <option value="mecanica">Mecánica</option>
                            <option value="colisiones">Colisiones / Pintura</option>
                        </select>
                    </div>
                    <div>
                        <span style={etiq}>USUARIO</span>
                        <select className="mov-input" value={filtros.usuario_id} onChange={e => cambiarFiltro('usuario_id', e.target.value, true)} style={selStyle}>
                            <option value="">Todos</option>
                            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <span style={etiq}>PROFORMA</span>
                        <input className="mov-input" placeholder="PROFORMA-000123" value={filtros.proforma} onChange={e => cambiarFiltro('proforma', e.target.value.trim())} style={{ ...selStyle, width: 160 }} />
                    </div>
                    <div>
                        <span style={etiq}>ORDEN DE TRABAJO</span>
                        <input className="mov-input" placeholder="OT-000045" value={filtros.orden_id} onChange={e => cambiarFiltro('orden_id', e.target.value.trim())} style={{ ...selStyle, width: 130 }} />
                    </div>
                    <div>
                        <span style={etiq}>DESDE</span>
                        <input type="date" className="mov-input" value={filtros.fecha_inicio} onChange={e => cambiarFiltro('fecha_inicio', e.target.value, true)} style={selStyle} />
                    </div>
                    <div>
                        <span style={etiq}>HASTA</span>
                        <input type="date" className="mov-input" value={filtros.fecha_fin} onChange={e => cambiarFiltro('fecha_fin', e.target.value, true)} style={selStyle} />
                    </div>
                    <div style={{ flex: 1 }} />
                    {hayFiltros && <button onClick={limpiarFiltros} className="btn-ghost">LIMPIAR</button>}
                    <button onClick={exportCSV} className="btn-ghost"><IconDownload /> EXPORTAR CSV</button>
                </div>
            </div>

            {/* ── Registros ── */}
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden', boxShadow: cardSh }}>
                {loading ? (
                    <div style={{ padding: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: SKY, animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: mut }}>Cargando registros...</p>
                    </div>
                ) : movimientos.length === 0 ? (
                    <div style={{ padding: 80, textAlign: 'center' }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.06em', color: txt }}>Sin registros</p>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, marginTop: 4 }}>No hay movimientos para los filtros seleccionados</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${bdr}`, background: headBg }}>
                                    {['Fecha', 'Movimiento', 'Producto', 'Cant.', 'Stock', 'Usuario', 'Origen / relación', 'Motivo'].map(h => (
                                        <th key={h} style={{ padding: '13px 14px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.2em', color: SKY_DEEP, whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {movimientos.map((m, idx) => {
                                    const cls = clasificarMovimiento(m);
                                    const fecha = new Date(m.created_at);
                                    return (
                                        <tr key={m.id} className="mov-row" style={{ borderBottom: `1px solid ${bdr}`, animationDelay: `${Math.min(idx, 20) * 15}ms`, opacity: m.revertido_at ? 0.6 : 1 }}>
                                            <td style={{ padding: '12px 14px', fontFamily: "'Outfit'", fontSize: '.8rem', color: txtSf, whiteSpace: 'nowrap' }}>
                                                {fecha.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                <span style={{ display: 'block', fontSize: '.72rem', color: mut }}>{fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <span className="mov-pill" style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: 999, background: `${cls.color}18`, border: `1px solid ${cls.color}55`, color: cls.color, fontFamily: "'Bebas Neue'", fontSize: '.66rem', letterSpacing: '.1em', whiteSpace: 'nowrap' }}>{cls.label}</span>
                                                {m.revertido_at && <span style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.7rem', color: mut, marginTop: 3 }}>Devuelta al inventario</span>}
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.86rem', color: txt }}>{m.repuesto_nombre}</p>
                                                <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>{m.repuesto_codigo} · {AREA_LABEL[m.area] || '—'}</p>
                                            </td>
                                            <td style={{ padding: '12px 14px', fontFamily: "'Bebas Neue'", fontSize: '1.1rem', color: m.tipo === 'entrada' ? '#10b981' : '#ef4444', whiteSpace: 'nowrap' }}>
                                                {m.tipo === 'entrada' ? '+' : '−'}{fmtCant(m.cantidad)} <span style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: mut }}>{m.unidad_medida}</span>
                                            </td>
                                            <td style={{ padding: '12px 14px', fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf, whiteSpace: 'nowrap' }}>{fmtCant(m.stock_anterior)} → <strong style={{ color: txt }}>{fmtCant(m.stock_nuevo)}</strong></td>
                                            <td style={{ padding: '12px 14px', fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf }}>{m.usuario_nombre}</td>
                                            <td style={{ padding: '12px 14px', fontFamily: "'Outfit'", fontSize: '.78rem', color: txtSf, lineHeight: 1.45 }}>
                                                {m.proforma_numero && <div>Proforma: <Link to={`/dashboard/proformas/${m.proforma_id}`} style={{ color: SKY_DEEP, fontWeight: 600 }}>{m.proforma_numero}</Link></div>}
                                                {m.orden_numero && <div>Orden de trabajo: <strong style={{ color: txt }}>{m.orden_numero}</strong></div>}
                                                {m.cliente_nombre && <div>Cliente: {m.cliente_nombre}</div>}
                                                {(m.vehiculo_descripcion || m.vehiculo_placa) && <div>Vehículo: {[m.vehiculo_descripcion, m.vehiculo_placa].filter(Boolean).join(' · ')}</div>}
                                                {m.origen === 'compra' && m.referencia && <div>Compra: {m.referencia}</div>}
                                                {!m.proforma_numero && !m.orden_numero && m.origen !== 'compra' && <span style={{ color: faint }}>—</span>}
                                            </td>
                                            <td style={{ padding: '12px 14px', fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, maxWidth: 240 }}>
                                                {m.motivo || '—'}
                                                {m.referencia && m.origen !== 'compra' && m.referencia !== m.proforma_numero && <span style={{ display: 'block' }}>Ref: {m.referencia}</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 14 }}>
                    <button className="btn-ghost" disabled={page <= 1 || loading} onClick={() => cargar(filtrosAplicados, page - 1)}>‹ ANTERIOR</button>
                    <span style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>Página {page} de {totalPages}</span>
                    <button className="btn-ghost" disabled={page >= totalPages || loading} onClick={() => cargar(filtrosAplicados, page + 1)}>SIGUIENTE ›</button>
                </div>
            )}
        </div>
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
