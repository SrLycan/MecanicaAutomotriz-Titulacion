import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

const ROL_META = {
    administrador: { label: 'Administracion', sub: 'Vista completa del sistema' },
    tecnico:       { label: 'Taller',          sub: 'Gestion de stock y trabajo' },
    recepcionista: { label: 'Recepcion',       sub: 'Consulta de inventario'     },
};

export default function Dashboard() {
    const { usuario } = useAuth();
    const { isDark }  = useTheme();
    const [stats,   setStats]   = useState({ total: 0, bajo_stock: 0, entradas: 0, salidas: 0 });
    const [alertas, setAlertas] = useState([]);
    const [loading, setLoading] = useState(true);

    const txt = isDark ? '#e2dff0' : '#160830';
    const mut = isDark ? 'rgba(226,223,240,0.42)' : 'rgba(55,10,120,0.55)';
    const bdr = isDark ? 'rgba(147,51,234,0.13)'  : 'rgba(100,30,180,0.16)';
    const card = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.92)';

    useEffect(() => {
        const cargar = async () => {
            try {
                const [repRes, bajRes, movRes] = await Promise.all([
                    api.get('/inventory/repuestos'),
                    api.get('/inventory/repuestos?bajo_stock=true'),
                    api.get('/inventory/movimientos?limit=200'),
                ]);
                const hoy = new Date().toDateString();
                const movHoy = movRes.data.movimientos.filter(m => new Date(m.created_at).toDateString() === hoy);
                setStats({ total: repRes.data.total, bajo_stock: bajRes.data.total, entradas: movHoy.filter(m => m.tipo === 'entrada').length, salidas: movHoy.filter(m => m.tipo === 'salida').length });
                setAlertas(bajRes.data.repuestos.slice(0, 8));
            } catch {}
            finally { setLoading(false); }
        };
        cargar();
    }, []);

    const meta = ROL_META[usuario?.rol] || ROL_META.recepcionista;

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
