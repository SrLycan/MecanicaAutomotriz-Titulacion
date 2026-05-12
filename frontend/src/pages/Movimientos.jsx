import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

function IconDownload() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }

const TIPO_META = {
    entrada: { color: '#22c55e', bg: 'rgba(34,197,94,.1)',  border: 'rgba(34,197,94,.2)',  label: 'ENTRADA' },
    salida:  { color: '#ef4444', bg: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.2)', label: 'SALIDA'  },
};

export default function Movimientos() {
    const { isDark } = useTheme();
    const [movimientos, setMovimientos] = useState([]);
    const [loading, setLoading]         = useState(true);
    const [filtroTipo, setFiltroTipo]   = useState('');
    const [busqueda, setBusqueda]       = useState('');

    const txt  = isDark ? '#e2dff0' : '#160830';
    const mut  = isDark ? 'rgba(226,223,240,0.42)' : 'rgba(55,10,120,0.55)';
    const bdr  = isDark ? 'rgba(147,51,234,0.13)'  : 'rgba(100,30,180,0.16)';
    const card = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.92)';
    const inputBg = isDark ? '#0a0a14' : '#f5f0ff';

    useEffect(() => {
        setLoading(true);
        const params = filtroTipo ? `?tipo=${filtroTipo}&limit=200` : '?limit=200';
        api.get(`/inventory/movimientos${params}`)
            .then(r => setMovimientos(r.data.movimientos))
            .finally(() => setLoading(false));
    }, [filtroTipo]);

    const filtrados = movimientos.filter(m =>
        !busqueda ||
        m.repuesto_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.repuesto_codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.usuario_nombre?.toLowerCase().includes(busqueda.toLowerCase())
    );

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

    const selStyle = { padding: '8px 12px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 9, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' };

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.28em', color: isDark ? 'rgba(168,85,247,.5)' : 'rgba(124,58,237,.55)', marginBottom: 4 }}>
                        SSWAP · Trazabilidad
                    </p>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.06em', color: txt, lineHeight: 1 }}>
                        Movimientos
                    </h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, marginTop: 4 }}>
                        {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Busqueda */}
                    <div style={{ position: 'relative' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={mut} strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input
                            placeholder="Buscar repuesto o usuario..."
                            value={busqueda} onChange={e => setBusqueda(e.target.value)}
                            style={{ ...selStyle, paddingLeft: 32, width: 220 }}
                            onFocus={e => e.target.style.borderColor = '#a855f7'}
                            onBlur={e => e.target.style.borderColor = bdr}
                        />
                    </div>

                    <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={selStyle}
                        onFocus={e => e.target.style.borderColor = '#a855f7'} onBlur={e => e.target.style.borderColor = bdr}>
                        <option value="">Todos los tipos</option>
                        <option value="entrada">Solo entradas</option>
                        <option value="salida">Solo salidas</option>
                    </select>

                    <button className="btn-ghost" onClick={exportCSV}><IconDownload /> Exportar CSV</button>
                </div>
            </div>
            <div style={{ height: 1, marginBottom: 24, background: `linear-gradient(90deg, ${isDark ? 'rgba(168,85,247,.25)' : 'rgba(124,58,237,.2)'}, transparent)` }} />

            {/* ── Tabla ── */}
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: '#a855f7', animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: mut }}>Cargando movimientos...</p>
                    </div>
                ) : filtrados.length === 0 ? (
                    <div style={{ padding: 80, textAlign: 'center' }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.06em', color: isDark ? 'rgba(168,85,247,.2)' : 'rgba(124,58,237,.2)' }}>Sin registros</p>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, marginTop: 8 }}>No hay movimientos para los filtros seleccionados.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${bdr}`, background: isDark ? 'rgba(168,85,247,.03)' : 'rgba(124,58,237,.025)' }}>
                                    {['Fecha','Tipo','Repuesto','Cant.','Stock Ant.','Stock Nuevo','Motivo','Referencia','Usuario'].map(h => (
                                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.18em', color: isDark ? 'rgba(168,85,247,.55)' : 'rgba(124,58,237,.6)', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtrados.map(m => {
                                    const meta = TIPO_META[m.tipo] || TIPO_META.entrada;
                                    return (
                                        <tr key={m.id} style={{ borderBottom: `1px solid ${bdr}`, transition: 'background .12s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(168,85,247,.04)' : 'rgba(124,58,237,.03)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                                            {/* Fecha */}
                                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.8rem', color: txt }}>{new Date(m.created_at).toLocaleDateString('es-EC')}</p>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.7rem', color: mut }}>{new Date(m.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </td>

                                            {/* Tipo */}
                                            <td style={{ padding: '10px 14px' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.1em', padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
                                                    {meta.label}
                                                </span>
                                            </td>

                                            {/* Repuesto */}
                                            <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.88rem', letterSpacing: '.04em', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.repuesto_nombre}</p>
                                                <code style={{ fontFamily: 'monospace', fontSize: '.7rem', background: isDark ? 'rgba(168,85,247,.1)' : 'rgba(124,58,237,.08)', padding: '1px 5px', borderRadius: 4, color: isDark ? 'rgba(168,85,247,.8)' : 'rgba(124,58,237,.8)' }}>{m.repuesto_codigo}</code>
                                            </td>

                                            {/* Cantidad */}
                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.15rem', letterSpacing: '.04em', color: meta.color }}>
                                                    {m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}
                                                </span>
                                            </td>

                                            {/* Stock anterior */}
                                            <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: "'Bebas Neue'", fontSize: '1rem', letterSpacing: '.04em', color: mut }}>
                                                {m.stock_anterior}
                                            </td>

                                            {/* Stock nuevo */}
                                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1rem', letterSpacing: '.04em', color: m.stock_nuevo < 5 ? '#ef4444' : '#22c55e' }}>
                                                    {m.stock_nuevo}
                                                </span>
                                            </td>

                                            {/* Motivo */}
                                            <td style={{ padding: '10px 14px', fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.8rem', color: mut, maxWidth: 160 }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{m.motivo || '—'}</span>
                                            </td>

                                            {/* Referencia */}
                                            <td style={{ padding: '10px 14px' }}>
                                                {m.referencia
                                                    ? <code style={{ fontFamily: 'monospace', fontSize: '.75rem', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(100,30,180,0.06)', padding: '2px 6px', borderRadius: 5, color: mut }}>{m.referencia}</code>
                                                    : <span style={{ color: mut, fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.8rem' }}>—</span>
                                                }
                                            </td>

                                            {/* Usuario */}
                                            <td style={{ padding: '10px 14px', fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.8rem', color: isDark ? 'rgba(168,85,247,.7)' : 'rgba(124,58,237,.75)', whiteSpace: 'nowrap' }}>
                                                {m.usuario_nombre}
                                            </td>
                                        </tr>
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
