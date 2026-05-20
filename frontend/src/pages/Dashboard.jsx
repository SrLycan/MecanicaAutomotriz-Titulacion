import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

const ROL_META = {
    administrador: { label: 'Administracion', sub: 'Vista completa del sistema' },
    tecnico:       { label: 'Taller',          sub: 'Gestion de stock y trabajo' },
    recepcionista: { label: 'Recepcion',       sub: 'Consulta de inventario'     },
};

const dateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const ultimos7Dias = () => {
    const hoy = new Date();
    return Array.from({ length: 7 }, (_, index) => {
        const fecha = new Date(hoy);
        fecha.setHours(0, 0, 0, 0);
        fecha.setDate(hoy.getDate() - (6 - index));
        return {
            key: dateKey(fecha),
            label: fecha.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', ''),
            fecha: fecha.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit' }),
            entradas: 0,
            salidas: 0,
        };
    });
};

export default function Dashboard() {
    const { usuario } = useAuth();
    const { isDark }  = useTheme();
    const [stats,   setStats]   = useState({ total: 0, bajo_stock: 0, entradas: 0, salidas: 0 });
    const [alertas, setAlertas] = useState([]);
    const [mov7d, setMov7d] = useState(() => ultimos7Dias());
    const [loading, setLoading] = useState(true);

    const txt = isDark ? '#e2dff0' : '#160830';
    const mut = isDark ? 'rgba(226,223,240,0.42)' : 'rgba(55,10,120,0.55)';
    const bdr = isDark ? 'rgba(147,51,234,0.13)'  : 'rgba(100,30,180,0.16)';
    const card = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.92)';
    const puedeVerMovimientos = ['administrador', 'tecnico'].includes(usuario?.rol);

    useEffect(() => {
        const cargar = async () => {
            setLoading(true);
            try {
                const [repRes, bajRes] = await Promise.all([
                    api.get('/inventory/repuestos'),
                    api.get('/inventory/repuestos?bajo_stock=true'),
                ]);

                let movimientos = [];
                if (puedeVerMovimientos) {
                    try {
                        const movRes = await api.get('/inventory/movimientos?limit=500');
                        movimientos = movRes.data.movimientos || [];
                    } catch {
                        movimientos = [];
                    }
                }

                const hoy = new Date().toDateString();
                const movHoy = movimientos.filter(m => new Date(m.created_at).toDateString() === hoy);
                const dias = ultimos7Dias();
                const porDia = Object.fromEntries(dias.map(d => [d.key, d]));

                movimientos.forEach(m => {
                    const key = dateKey(new Date(m.created_at));
                    if (!porDia[key]) return;
                    const cantidad = Number(m.cantidad) || 1;
                    if (m.tipo === 'entrada') porDia[key].entradas += cantidad;
                    if (m.tipo === 'salida') porDia[key].salidas += cantidad;
                });

                setStats({
                    total: repRes.data.total,
                    bajo_stock: bajRes.data.total,
                    entradas: movHoy.filter(m => m.tipo === 'entrada').length,
                    salidas: movHoy.filter(m => m.tipo === 'salida').length,
                });
                setAlertas((bajRes.data.repuestos || []).slice(0, 8));
                setMov7d(dias);
            } catch {}
            finally { setLoading(false); }
        };
        cargar();
    }, [puedeVerMovimientos]);

    const meta = ROL_META[usuario?.rol] || ROL_META.recepcionista;
    const maxMov7d = useMemo(() => Math.max(1, ...mov7d.flatMap(d => [d.entradas, d.salidas])), [mov7d]);

    const CARDS = [
        { key: 'total',      label: 'Total Repuestos', val: stats.total,      color: '#a855f7', roles: ['administrador','tecnico','recepcionista'] },
        { key: 'bajo_stock', label: 'Bajo Stock',       val: stats.bajo_stock, color: '#ef4444', roles: ['administrador','tecnico','recepcionista'] },
        { key: 'entradas',   label: 'Entradas Hoy',    val: stats.entradas,   color: '#22c55e', roles: ['administrador','tecnico'] },
        { key: 'salidas',    label: 'Salidas Hoy',     val: stats.salidas,    color: '#f59e0b', roles: ['administrador','tecnico'] },
    ].filter(c => c.roles.includes(usuario?.rol));

    return (
        <div>
            {/* ── Page header ── */}
            <div style={{ marginBottom: 28 }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.28em', color: isDark ? 'rgba(168,85,247,.5)' : 'rgba(124,58,237,.55)', marginBottom: 4 }}>
                    SSWAP · {meta.label}
                </p>
                <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.06em', color: txt, lineHeight: 1 }}>
                    Dashboard
                </h1>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, marginTop: 4 }}>
                    Bienvenido, <strong style={{ fontWeight: 500 }}>{usuario?.nombre}</strong> — {meta.sub}
                </p>
            </div>
            <div style={{ height: 1, marginBottom: 28, background: `linear-gradient(90deg, ${isDark ? 'rgba(168,85,247,.25)' : 'rgba(124,58,237,.2)'}, transparent)` }} />

            {/* ── Stat cards ── */}
            {loading ? (
                <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
                    {[1,2,3,4].slice(0, CARDS.length).map(i => (
                        <div key={i} style={{ flex: 1, height: 110, background: card, border: `1px solid ${bdr}`, borderRadius: 16, animation: 'pulse 1.5s infinite' }} />
                    ))}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CARDS.length}, 1fr)`, gap: 16, marginBottom: 28 }}>
                    {CARDS.map(c => (
                        <div key={c.key} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${c.color}55, transparent)` }} />
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.04em', color: c.color, lineHeight: 1 }}>{c.val}</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.78rem', color: mut, marginTop: 6 }}>{c.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Grafica movimientos 7 dias ── */}
            {puedeVerMovimientos && !loading && (
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: '18px 20px', marginBottom: 28 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                        <div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.22em', color: isDark ? 'rgba(168,85,247,.5)' : 'rgba(124,58,237,.55)', marginBottom: 2 }}>MOVIMIENTOS</p>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.35rem', letterSpacing: '.06em', color: txt, lineHeight: 1 }}>Ultimos 7 Dias</h2>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: "'Outfit'", fontSize: '.75rem', color: mut }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: '#22c55e', display: 'inline-block' }} /> Entradas</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: '#ef4444', display: 'inline-block' }} /> Salidas</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(46px, 1fr))', gap: 12, alignItems: 'end', minHeight: 170 }}>
                        {mov7d.map(d => {
                            const hEntrada = d.entradas ? Math.max(8, (d.entradas / maxMov7d) * 118) : 3;
                            const hSalida = d.salidas ? Math.max(8, (d.salidas / maxMov7d) * 118) : 3;
                            return (
                                <div key={d.key} style={{ textAlign: 'center' }}>
                                    <div style={{ height: 128, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 5, padding: '0 4px', borderBottom: `1px solid ${bdr}` }}>
                                        <div title={`${d.entradas} entradas`} style={{ width: 13, height: hEntrada, borderRadius: '7px 7px 2px 2px', background: d.entradas ? 'linear-gradient(180deg, #22c55e, rgba(34,197,94,.45))' : (isDark ? 'rgba(255,255,255,.08)' : 'rgba(124,58,237,.08)') }} />
                                        <div title={`${d.salidas} salidas`} style={{ width: 13, height: hSalida, borderRadius: '7px 7px 2px 2px', background: d.salidas ? 'linear-gradient(180deg, #ef4444, rgba(239,68,68,.45))' : (isDark ? 'rgba(255,255,255,.08)' : 'rgba(124,58,237,.08)') }} />
                                    </div>
                                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.08em', color: txt, marginTop: 8, textTransform: 'uppercase' }}>{d.label}</p>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.68rem', color: mut, marginTop: 1 }}>{d.fecha}</p>
                                </div>
                            );
                        })}
                    </div>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.72rem', color: mut, marginTop: 12 }}>
                        Las barras suman cantidades movidas por dia; las tarjetas superiores siguen contando movimientos registrados hoy.
                    </p>
                </div>
            )}

            {/* ── Alertas bajo stock ── */}
            {alertas.length > 0 && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 16, gap: 8 }}>
                        <div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.22em', color: '#ef4444', opacity: .7, marginBottom: 2 }}>ATENCION</p>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.35rem', letterSpacing: '.06em', color: txt, lineHeight: 1 }}>Repuestos con Stock Bajo</h2>
                        </div>
                        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, rgba(239,68,68,.3), transparent)`, marginBottom: 4 }} />
                    </div>

                    <div style={{ background: card, border: `1px solid rgba(239,68,68,0.18)`, borderRadius: 14, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${bdr}`, background: isDark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.03)' }}>
                                    {['Codigo', 'Repuesto', 'Categoria', 'Stock Actual', 'Stock Minimo'].map(h => (
                                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.18em', color: isDark ? 'rgba(239,68,68,.55)' : 'rgba(185,28,28,.6)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {alertas.map(r => (
                                    <tr key={r.id} style={{ borderBottom: `1px solid ${bdr}`, transition: 'background .12s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '10px 16px' }}>
                                            <code style={{ fontFamily: 'monospace', fontSize: '.78rem', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(100,30,180,0.07)', padding: '2px 7px', borderRadius: 5, color: isDark ? 'rgba(168,85,247,.8)' : 'rgba(124,58,237,.8)' }}>{r.codigo}</code>
                                        </td>
                                        <td style={{ padding: '10px 16px', fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.85rem', color: txt }}>{r.nombre}</td>
                                        <td style={{ padding: '10px 16px', fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut }}>{r.categoria_nombre || '—'}</td>
                                        <td style={{ padding: '10px 16px' }}>
                                            <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.04em', color: '#ef4444' }}>{r.stock_actual}</span>
                                        </td>
                                        <td style={{ padding: '10px 16px', fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut }}>{r.stock_minimo}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
