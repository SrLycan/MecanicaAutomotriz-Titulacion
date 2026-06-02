import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

const ROL_META = {
    administrador: { label: 'Administracion', sub: 'Vista completa del sistema' },
    tecnico:       { label: 'Taller',          sub: 'Gestion de stock y trabajo' },
    recepcionista: { label: 'Recepcion',       sub: 'Consulta de inventario'     },
};

function IconBox()    { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconAlert()  { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function IconIn()     { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>; }
function IconOut()    { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>; }
function IconArrowR() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>; }
function IconClock()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconBolt()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function IconWrench() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }

export default function Dashboard() {
    const { usuario } = useAuth();
    const { isDark }  = useTheme();
    const [stats,   setStats]   = useState({ total: 0, bajo_stock: 0, entradas: 0, salidas: 0, valor: 0 });
    const [alertas, setAlertas] = useState([]);
    const [movRecientes, setMovRecientes] = useState([]);
    const [loading, setLoading] = useState(true);

    const SKY      = '#0ea5e9';
    const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.18)';

    const txt    = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf  = isDark ? '#cbd5e1' : '#334155';
    const mut    = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const faint  = isDark ? 'rgba(241,245,249,0.38)' : '#94a3b8';
    const bdr    = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)';
    const card   = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';

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
                const valor = (repRes.data.repuestos || []).reduce((s, r) => s + (r.stock_actual * parseFloat(r.precio_venta || 0)), 0);
                setStats({
                    total: repRes.data.total,
                    bajo_stock: bajRes.data.total,
                    entradas: movHoy.filter(m => m.tipo === 'entrada').length,
                    salidas: movHoy.filter(m => m.tipo === 'salida').length,
                    valor,
                });
                setAlertas(bajRes.data.repuestos.slice(0, 6));
                setMovRecientes(movRes.data.movimientos.slice(0, 5));
            } catch {}
            finally { setLoading(false); }
        };
        cargar();
    }, []);

    const meta = ROL_META[usuario?.rol] || ROL_META.recepcionista;
    const esAdmin   = usuario?.rol === 'administrador';
    const esTecnico = usuario?.rol === 'tecnico';

    const greet = (() => {
        const h = new Date().getHours();
        if (h < 12) return 'Buenos dias';
        if (h < 19) return 'Buenas tardes';
        return 'Buenas noches';
    })();

    const CARDS = [
        { key: 'total',      label: 'Total Repuestos', val: stats.total,      color: SKY,        icon: <IconBox />,   roles: ['administrador','tecnico','recepcionista'] },
        { key: 'bajo_stock', label: 'Bajo Stock',      val: stats.bajo_stock, color: '#ef4444',  icon: <IconAlert />, roles: ['administrador','tecnico','recepcionista'], alert: true },
        { key: 'entradas',   label: 'Entradas Hoy',    val: stats.entradas,   color: '#10b981',  icon: <IconIn />,    roles: ['administrador','tecnico'] },
        { key: 'salidas',    label: 'Salidas Hoy',     val: stats.salidas,    color: '#f59e0b',  icon: <IconOut />,   roles: ['administrador','tecnico'] },
    ].filter(c => c.roles.includes(usuario?.rol));

    const fechaHoy = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1400 }}>
            <style>{`
                @keyframes dashCardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
                @keyframes alertPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,.35); } 50% { box-shadow: 0 0 0 5px rgba(239,68,68,0); } }
                @keyframes carFloat { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-8px) rotate(1deg); } }
                @keyframes carShadow { 0%, 100% { transform: scale(1); opacity: .35; } 50% { transform: scale(.88); opacity: .22; } }
                @keyframes wheelSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes headlightGlow { 0%, 100% { opacity: .9; } 50% { opacity: 1; filter: drop-shadow(0 0 8px #fde68a); } }
                @keyframes roadFlow { from { background-position: 0 0; } to { background-position: -80px 0; } }
                @keyframes orbGlow { 0%, 100% { opacity: .35; transform: scale(1); } 50% { opacity: .55; transform: scale(1.08); } }
                .dash-card { animation: dashCardIn .4s cubic-bezier(.4,0,.2,1) both; transition: transform .25s, box-shadow .25s, border-color .25s; position: relative; overflow: hidden; }
                .dash-card:hover { transform: translateY(-3px); border-color: ${SKY_BDR}; box-shadow: 0 12px 36px -12px rgba(15,23,42,0.12); }
                .dash-card .glow { position: absolute; top: -40px; right: -40px; width: 160px; height: 160px; border-radius: 50%; opacity: 0; transition: opacity .3s; pointer-events: none; }
                .dash-card:hover .glow { opacity: .14; }
                .alert-row { animation: dashCardIn .3s ease both; }
                .quick-action { transition: all .22s cubic-bezier(.4,0,.2,1); }
                .quick-action:hover { transform: translateY(-2px); border-color: ${SKY_BDR}; box-shadow: 0 12px 28px -12px rgba(14,165,233,0.25); }
                .quick-action:hover .qa-arrow { transform: translateX(4px); color: ${SKY}; }
                .qa-arrow { transition: transform .22s, color .22s; }
                .mov-mini { animation: dashCardIn .3s ease both; }
                .car-3d { animation: carFloat 4.5s ease-in-out infinite; transform-origin: center; will-change: transform; }
                .car-shadow { animation: carShadow 4.5s ease-in-out infinite; transform-origin: center; }
                .car-wheel { animation: wheelSpin 1.8s linear infinite; transform-origin: center; transform-box: fill-box; }
                .car-headlight { animation: headlightGlow 2.2s ease-in-out infinite; }
                .hero-orb-1 { animation: orbGlow 5s ease-in-out infinite; }
                .hero-orb-2 { animation: orbGlow 6s ease-in-out infinite 1s; }
            `}</style>

            {/* ── HERO CARD con auto 3D ── */}
            <div style={{
                position: 'relative', marginBottom: 28,
                background: isDark
                    ? 'linear-gradient(135deg, #0a0f1c 0%, #0c2237 50%, #0a0f1c 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 60%, #e0f2fe 100%)',
                border: `1px solid ${isDark ? 'rgba(56,189,248,0.18)' : 'rgba(14,165,233,0.18)'}`,
                borderRadius: 22, padding: '32px 36px',
                overflow: 'hidden', boxShadow: cardSh,
                minHeight: 220,
                display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(280px, 1fr)',
                gap: 24, alignItems: 'center',
            }}>
                {/* Orbes decorativos */}
                <div className="hero-orb-1" style={{
                    position: 'absolute', top: '-80px', right: '-40px',
                    width: 280, height: 280, borderRadius: '50%',
                    background: 'radial-gradient(closest-side, rgba(14,165,233,0.30), transparent)',
                    pointerEvents: 'none',
                }} />
                <div className="hero-orb-2" style={{
                    position: 'absolute', bottom: '-120px', left: '20%',
                    width: 320, height: 320, borderRadius: '50%',
                    background: 'radial-gradient(closest-side, rgba(56,189,248,0.18), transparent)',
                    pointerEvents: 'none',
                }} />
                {/* Grid pattern sutil */}
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', opacity: isDark ? .25 : .35,
                    backgroundImage: `linear-gradient(${isDark ? 'rgba(56,189,248,0.06)' : 'rgba(14,165,233,0.06)'} 1px, transparent 1px),
                                      linear-gradient(90deg, ${isDark ? 'rgba(56,189,248,0.06)' : 'rgba(14,165,233,0.06)'} 1px, transparent 1px)`,
                    backgroundSize: '32px 32px',
                    maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
                    WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
                }} />

                {/* Lado izquierdo: texto */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div className="sswap-chip" style={{ marginBottom: 12 }}>
                        <span className="dot" />
                        <span>SSWAP · {meta.label.toUpperCase()}</span>
                    </div>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '1rem', color: SKY_DEEP, marginBottom: 4 }}>
                        {greet},
                    </p>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '3.2rem', letterSpacing: '.02em', color: txt, lineHeight: 1 }}>
                        {usuario?.nombre || 'Usuario'}
                    </h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.95rem', color: mut, marginTop: 10, maxWidth: 380 }}>
                        {meta.sub}. Tu taller en marcha — revisa el estado, atiende alertas y registra movimientos.
                    </p>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16,
                        padding: '8px 14px', borderRadius: 999,
                        background: isDark ? 'rgba(14,165,233,0.10)' : 'rgba(255,255,255,0.85)',
                        border: `1px solid ${SKY_BDR}`,
                        backdropFilter: 'blur(8px)',
                    }}>
                        <IconClock />
                        <span style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.82rem', color: txtSf, textTransform: 'capitalize' }}>{fechaHoy}</span>
                    </div>
                </div>

                {/* Lado derecho: auto 3D */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                    <Car3D />
                </div>
            </div>

            {/* ── Stat cards ── */}
            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CARDS.length}, 1fr)`, gap: 18, marginBottom: 32 }}>
                    {Array(CARDS.length).fill(0).map((_, i) => (
                        <div key={i} className="sk-pulse" style={{ height: 130, background: card, border: `1px solid ${bdr}`, borderRadius: 16 }} />
                    ))}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CARDS.length}, 1fr)`, gap: 18, marginBottom: 32 }}>
                    {CARDS.map((c, i) => (
                        <div key={c.key} className="dash-card"
                            style={{
                                background: card, border: `1px solid ${bdr}`,
                                borderRadius: 16, padding: '22px 24px 20px',
                                boxShadow: cardSh, animationDelay: `${i * 70}ms`,
                            }}>
                            <div className="glow" style={{ background: `radial-gradient(closest-side, ${c.color}, transparent)` }} />
                            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(180deg, ${c.color}, transparent)` }} />

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div style={{
                                    width: 46, height: 46, borderRadius: 12,
                                    background: `${c.color}12`, border: `1px solid ${c.color}28`,
                                    color: c.color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    animation: c.alert && c.val > 0 ? 'alertPulse 2s ease-in-out infinite' : 'none',
                                }}>{c.icon}</div>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.22em', color: mut }}>{c.label.toUpperCase()}</p>
                            </div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.8rem', letterSpacing: '.02em', color: c.color, lineHeight: 1 }}>
                                {c.val}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Acciones rapidas + Valor inventario ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 32, alignItems: 'stretch' }}>
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: 22, boxShadow: cardSh }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, color: SKY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconBolt />
                        </div>
                        <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.05em', color: txt }}>Acciones Rapidas</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                        <Link to="/dashboard/inventario" className="quick-action" style={qaStyle(card, bdr, txt, mut)}>
                            <span style={{ color: SKY }}><IconBox /></span>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt }}>Ver inventario</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>Catalogo completo</p>
                            </div>
                            <span className="qa-arrow" style={{ color: faint }}><IconArrowR /></span>
                        </Link>
                        {(esAdmin || esTecnico) && (
                            <Link to="/dashboard/movimientos" className="quick-action" style={qaStyle(card, bdr, txt, mut)}>
                                <span style={{ color: '#10b981' }}><IconIn /></span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt }}>Movimientos</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>Trazabilidad</p>
                                </div>
                                <span className="qa-arrow" style={{ color: faint }}><IconArrowR /></span>
                            </Link>
                        )}
                        {stats.bajo_stock > 0 && (
                            <Link to="/dashboard/inventario" className="quick-action" style={{ ...qaStyle(card, bdr, txt, mut), borderColor: 'rgba(239,68,68,0.2)' }}>
                                <span style={{ color: '#ef4444' }}><IconAlert /></span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt }}>Atender alertas</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: '#ef4444' }}>{stats.bajo_stock} con bajo stock</p>
                                </div>
                                <span className="qa-arrow" style={{ color: faint }}><IconArrowR /></span>
                            </Link>
                        )}
                        {esAdmin && (
                            <Link to="/dashboard/inventario" className="quick-action" style={qaStyle(card, bdr, txt, mut)}>
                                <span style={{ color: SKY_DEEP }}><IconWrench /></span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt }}>Crear repuesto</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>Agregar al catalogo</p>
                                </div>
                                <span className="qa-arrow" style={{ color: faint }}><IconArrowR /></span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Valor inventario */}
                <div style={{
                    background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`,
                    border: 'none', borderRadius: 16, padding: 22,
                    color: '#fff', position: 'relative', overflow: 'hidden',
                    boxShadow: '0 14px 36px -12px rgba(14,165,233,0.55)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}>
                    <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: -70, left: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.24em', color: 'rgba(255,255,255,0.85)', position: 'relative' }}>VALOR DE INVENTARIO</p>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.02em', color: '#fff', lineHeight: 1, marginTop: 6, position: 'relative' }}>
                        ${stats.valor.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: 'rgba(255,255,255,0.78)', marginTop: 8, position: 'relative' }}>
                        Estimado a precio de venta · {stats.total} repuestos
                    </p>
                </div>
            </div>

            {/* ── Bloque inferior: Alertas + Movimientos recientes ── */}
            <div style={{ display: 'grid', gridTemplateColumns: alertas.length > 0 ? '1.4fr 1fr' : '1fr', gap: 18 }}>
                {alertas.length > 0 && (
                    <div style={{ animation: 'fadeIn .5s ease both', animationDelay: '.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 7,
                                padding: '4px 11px', borderRadius: 999,
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                                fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.24em', color: '#ef4444',
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'alertPulse 1.6s ease-in-out infinite' }} />
                                ATENCION
                            </span>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>
                                Stock Bajo
                            </h2>
                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(239,68,68,0.25), transparent)' }} />
                            <Link to="/dashboard/inventario" style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.16em', color: SKY, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                VER TODO <IconArrowR />
                            </Link>
                        </div>

                        <div style={{ background: card, border: `1px solid rgba(239,68,68,0.15)`, borderRadius: 14, overflow: 'hidden', boxShadow: cardSh }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: `1px solid ${bdr}`, background: 'rgba(239,68,68,0.03)' }}>
                                            {['Codigo', 'Repuesto', 'Stock', 'Min'].map(h => (
                                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.22em', color: '#ef4444', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {alertas.map((r, i) => (
                                            <tr key={r.id} className="alert-row"
                                                style={{ borderBottom: `1px solid ${bdr}`, transition: 'background .15s', animationDelay: `${i * 40}ms` }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.03)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <code style={{
                                                        fontFamily: 'monospace', fontSize: '.74rem', fontWeight: 600,
                                                        background: SKY_PALE, padding: '3px 9px', borderRadius: 6,
                                                        color: SKY_DEEP, border: `1px solid ${SKY_BDR}`,
                                                    }}>{r.codigo}</code>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.86rem', color: txt, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', letterSpacing: '.04em', color: '#ef4444' }}>{r.stock_actual}</span>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.82rem', color: mut }}>{r.stock_minimo}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {(esAdmin || esTecnico) && movRecientes.length > 0 && (
                    <div style={{ animation: 'fadeIn .5s ease both', animationDelay: '.3s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>
                                Actividad Reciente
                            </h2>
                            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(14,165,233,0.2), transparent)' }} />
                        </div>
                        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: 6 }}>
                            {movRecientes.map((m, i) => {
                                const ent = m.tipo === 'entrada';
                                const color = ent ? '#10b981' : '#ef4444';
                                return (
                                    <div key={m.id} className="mov-mini"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '11px 12px', borderRadius: 10,
                                            transition: 'background .15s', animationDelay: `${i * 50}ms`,
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = SKY_PALE}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 9,
                                            background: color + '14', border: `1px solid ${color}30`,
                                            color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            {ent ? <IconIn /> : <IconOut />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.82rem', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.repuesto_nombre}</p>
                                            <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut, marginTop: 1 }}>
                                                {new Date(m.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })} · {m.usuario_nombre}
                                            </p>
                                        </div>
                                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1rem', letterSpacing: '.02em', color, whiteSpace: 'nowrap' }}>
                                            {ent ? '+' : '−'}{m.cantidad}
                                        </span>
                                    </div>
                                );
                            })}
                            <Link to="/dashboard/movimientos" style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '10px', marginTop: 4,
                                fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.16em', color: SKY,
                                textDecoration: 'none', borderTop: `1px solid ${bdr}`,
                            }}>
                                VER HISTORIAL COMPLETO <IconArrowR />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function qaStyle(card, bdr, txt, mut) {
    return {
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '12px 14px', borderRadius: 12,
        background: card, border: `1px solid ${bdr}`,
        textDecoration: 'none', color: txt,
    };
}

/* ─────────────────────────────────────────────────────────────
   Auto 3D — SVG en perspectiva real con:
   - CSS perspective + parallax al mover el mouse (rotación 3D real)
   - Cuerpo con gradiente de 6 stops (efecto curva metálica)
   - Brillo especular animado recorriendo la carrocería
   - Ruedas multicapa (neumático + sidewall + rin + 6 rayos + hub)
   - Faros con cristal, luces antiniebla, grille frontal
   - Sombra dinámica + carretera con líneas en movimiento
   - Logo SSWAP, espejo lateral, manijas, parachoques
   ───────────────────────────────────────────────────────────── */
function Car3D() {
    const stageRef = useRef(null);

    const handleMouseMove = (e) => {
        const stage = stageRef.current;
        if (!stage) return;
        const wrapper = stage.closest('[data-car3d]');
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        stage.style.transform = `rotateX(${10 - y * 14}deg) rotateY(${-16 + x * 22}deg)`;
    };
    const handleLeave = () => {
        if (stageRef.current) stageRef.current.style.transform = 'rotateX(10deg) rotateY(-16deg)';
    };

    return (
        <div data-car3d
             onMouseMove={handleMouseMove}
             onMouseLeave={handleLeave}
             style={{
                 position: 'relative', width: '100%', maxWidth: 540, aspectRatio: '5 / 3',
                 perspective: '1400px', perspectiveOrigin: '50% 40%',
             }}>
            {/* Carretera con líneas en movimiento */}
            <div style={{
                position: 'absolute', bottom: '8%', left: '8%', right: '8%', height: 3,
                background: 'linear-gradient(90deg, transparent, rgba(15,23,42,0.20), transparent)',
                borderRadius: 3,
            }} />
            <div style={{
                position: 'absolute', bottom: '8%', left: '14%', right: '14%', height: 2,
                backgroundImage: 'repeating-linear-gradient(90deg, rgba(15,23,42,0.45) 0 18px, transparent 18px 36px)',
                animation: 'roadFlow .55s linear infinite',
                opacity: .55,
            }} />
            {/* Sombra dinámica del suelo */}
            <div style={{
                position: 'absolute', bottom: '6%', left: '10%', right: '10%',
                height: 26, borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(2,132,199,0.55), rgba(2,132,199,0) 65%)',
                filter: 'blur(10px)',
                animation: 'carShadow 5s ease-in-out infinite',
            }} />

            {/* Float wrapper (movimiento vertical) */}
            <div style={{
                position: 'absolute', inset: 0,
                animation: 'carFloat 5s ease-in-out infinite',
                transformStyle: 'preserve-3d',
            }}>
                {/* 3D rotation stage (parallax del mouse) */}
                <div ref={stageRef}
                     style={{
                         position: 'absolute', inset: 0,
                         transformStyle: 'preserve-3d',
                         transform: 'rotateX(10deg) rotateY(-16deg)',
                         transition: 'transform .35s cubic-bezier(.4,0,.2,1)',
                     }}>
                    <CarSVG />
                </div>
            </div>
        </div>
    );
}

function CarSVG() {
    return (
        <svg viewBox="0 0 500 250" xmlns="http://www.w3.org/2000/svg"
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                      filter: 'drop-shadow(0 14px 26px rgba(2,132,199,0.45)) drop-shadow(0 6px 10px rgba(2,6,23,0.25))' }}>
            <defs>
                {/* Carrocería: gradiente metálico con 6 stops */}
                <linearGradient id="bodyMetal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#bae6fd" />
                    <stop offset="20%" stopColor="#7dd3fc" />
                    <stop offset="42%" stopColor="#38bdf8" />
                    <stop offset="60%" stopColor="#0ea5e9" />
                    <stop offset="82%" stopColor="#0369a1" />
                    <stop offset="100%" stopColor="#0c4a6e" />
                </linearGradient>
                {/* Techo (más luminoso, como zona pintada vista desde arriba) */}
                <linearGradient id="roofShine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#e0f2fe" />
                    <stop offset="45%" stopColor="#7dd3fc" />
                    <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
                {/* Vidrios oscuros con highlight */}
                <linearGradient id="glassDeep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#475569" />
                    <stop offset="50%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#020617" />
                </linearGradient>
                {/* Neumático */}
                <radialGradient id="tireGrad" cx=".5" cy=".45" r=".55">
                    <stop offset="0%"  stopColor="#475569" />
                    <stop offset="55%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#020617" />
                </radialGradient>
                {/* Rin metálico cromado */}
                <radialGradient id="rimGrad" cx=".4" cy=".35" r=".75">
                    <stop offset="0%"  stopColor="#f8fafc" />
                    <stop offset="40%" stopColor="#cbd5e1" />
                    <stop offset="75%" stopColor="#64748b" />
                    <stop offset="100%" stopColor="#1e293b" />
                </radialGradient>
                {/* Hub central del rin */}
                <radialGradient id="hubGrad" cx=".5" cy=".5" r=".5">
                    <stop offset="0%"  stopColor="#cbd5e1" />
                    <stop offset="60%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#0f172a" />
                </radialGradient>
                {/* Faro */}
                <radialGradient id="lampFront" cx=".4" cy=".4" r=".6">
                    <stop offset="0%"  stopColor="#ffffff" />
                    <stop offset="35%" stopColor="#fef3c7" />
                    <stop offset="75%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#b45309" />
                </radialGradient>
                {/* Luz trasera */}
                <linearGradient id="lampRear" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#fca5a5" />
                    <stop offset="60%" stopColor="#dc2626" />
                    <stop offset="100%" stopColor="#7f1d1d" />
                </linearGradient>
                {/* Banda de brillo especular ANIMADA (recorre la carrocería) */}
                <linearGradient id="specStrip" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="white" stopOpacity="0" />
                    <stop offset="48%" stopColor="white" stopOpacity="0" />
                    <stop offset="50%" stopColor="white" stopOpacity="0.65" />
                    <stop offset="52%" stopColor="white" stopOpacity="0" />
                    <stop offset="100%" stopColor="white" stopOpacity="0">
                        <animate attributeName="offset" values="0.5;1.5" dur="3.5s" repeatCount="indefinite" />
                    </stop>
                    <animate attributeName="x1" values="-1;1.5" dur="3.5s" repeatCount="indefinite" />
                    <animate attributeName="x2" values="0;2.5" dur="3.5s" repeatCount="indefinite" />
                </linearGradient>
                {/* Highlight horizontal medio (línea de carácter de la carrocería) */}
                <linearGradient id="charLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"  stopColor="rgba(255,255,255,0)" />
                    <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>

                {/* Path de la carrocería reusable para el reflejo de brillo */}
                <path id="carBodyPath"
                      d="M 32 178
                         Q 32 162 50 158
                         L 82 152
                         Q 132 138 168 128
                         L 192 88
                         Q 200 76 217 74
                         L 335 74
                         Q 352 76 362 92
                         L 388 130
                         L 426 138
                         Q 462 145 467 168
                         L 467 186
                         L 32 186 Z" />
            </defs>

            {/* Sombras debajo del chasis */}
            <ellipse cx="250" cy="194" rx="210" ry="6" fill="rgba(2,6,23,0.35)" opacity=".5" />

            {/* CUERPO PRINCIPAL */}
            <use href="#carBodyPath" fill="url(#bodyMetal)" stroke="#0c4a6e" strokeWidth="1.3" />

            {/* Techo / cabina más clara */}
            <path d="M 178 126
                     L 199 86
                     Q 205 76 220 74
                     L 332 74
                     Q 345 76 354 90
                     L 374 126 Z"
                  fill="url(#roofShine)" stroke="#0c4a6e" strokeWidth=".9" />

            {/* Vidrios — parabrisas delantero */}
            <path d="M 188 122
                     L 207 88
                     Q 211 80 220 80
                     L 252 80
                     L 252 122 Z"
                  fill="url(#glassDeep)" opacity=".95" />
            {/* Vidrios — ventana lateral / luneta */}
            <path d="M 257 80
                     L 328 80
                     Q 340 82 348 92
                     L 365 122
                     L 257 122 Z"
                  fill="url(#glassDeep)" opacity=".95" />

            {/* Reflejos sobre los vidrios */}
            <path d="M 194 118 L 213 88 L 222 88 L 202 118 Z" fill="rgba(255,255,255,0.28)" />
            <path d="M 268 86 L 295 86 L 287 102 L 263 102 Z" fill="rgba(255,255,255,0.16)" />

            {/* Marco vertical entre ventanillas (pilar B) */}
            <line x1="255" y1="80" x2="255" y2="122" stroke="#0c4a6e" strokeWidth="3" />

            {/* Línea de carácter horizontal (highlight medio) */}
            <rect x="50" y="142" width="375" height="3" fill="url(#charLine)" opacity=".85" />

            {/* Faldón inferior (más oscuro) */}
            <path d="M 50 176 L 450 178 L 446 186 L 54 186 Z" fill="#0c4a6e" opacity=".75" />

            {/* Líneas de puertas */}
            <line x1="60" y1="158" x2="430" y2="160" stroke="#0c4a6e" strokeWidth=".8" opacity=".35" />
            <line x1="255" y1="125" x2="255" y2="180" stroke="#0c4a6e" strokeWidth="1" opacity=".55" />

            {/* Manijas de puerta */}
            <rect x="218" y="148" width="22" height="3.5" rx="1.5" fill="#0c4a6e" />
            <rect x="268" y="148" width="22" height="3.5" rx="1.5" fill="#0c4a6e" />

            {/* Espejo retrovisor lateral */}
            <path d="M 198 86 L 191 96 Q 188 102 195 104 L 204 104 L 204 86 Z"
                  fill="url(#bodyMetal)" stroke="#0c4a6e" strokeWidth=".8" />
            <ellipse cx="196" cy="98" rx="3" ry="2" fill="#1e293b" />

            {/* FRENTE: faro, antiniebla y grille */}
            <ellipse cx="455" cy="152" rx="12" ry="8" fill="url(#lampFront)" />
            <ellipse cx="455" cy="152" rx="5" ry="3.5" fill="rgba(255,255,255,0.95)" />
            <ellipse cx="455" cy="152" rx="12" ry="8" fill="none" stroke="#0c4a6e" strokeWidth="1.2" />
            <circle cx="448" cy="172" r="4.5" fill="#fcd34d" opacity=".85" stroke="#0c4a6e" strokeWidth=".8" />
            {/* Grille */}
            <path d="M 405 142 L 442 148 L 440 153 L 403 147 Z" fill="#0c4a6e" />
            <path d="M 407 150 L 440 156 L 438 160 L 405 154 Z" fill="#0c4a6e" opacity=".65" />

            {/* TRASERA: luz trasera */}
            <rect x="34" y="146" width="16" height="14" rx="2.5" fill="url(#lampRear)" stroke="#0c4a6e" strokeWidth="1" />
            <rect x="36" y="148" width="4" height="10" rx="1" fill="rgba(255,255,255,0.5)" />

            {/* Parachoques */}
            <rect x="20" y="168" width="20" height="16" rx="3.5" fill="#0c4a6e" />
            <rect x="458" y="164" width="22" height="18" rx="3.5" fill="#0c4a6e" />

            {/* Logo SSWAP en la puerta */}
            <text x="195" y="168" textAnchor="middle"
                  fontFamily="'Bebas Neue', sans-serif" fontSize="11" letterSpacing="3"
                  fill="rgba(255,255,255,0.92)">SSWAP</text>

            {/* BANDA DE BRILLO ESPECULAR ANIMADA (recorre la carrocería) */}
            <use href="#carBodyPath" fill="url(#specStrip)" pointerEvents="none" />

            {/* Arcos de rueda (sombra recesada) */}
            <ellipse cx="110" cy="186" rx="38" ry="10" fill="#0c4a6e" opacity=".55" />
            <ellipse cx="390" cy="186" rx="38" ry="10" fill="#0c4a6e" opacity=".55" />

            {/* RUEDA TRASERA — multicapa */}
            <g>
                <circle cx="110" cy="188" r="33" fill="url(#tireGrad)" stroke="#020617" strokeWidth="1.5" />
                <circle cx="110" cy="188" r="29" fill="#0f172a" />
                <circle cx="110" cy="188" r="24" fill="none" stroke="#1e293b" strokeWidth="2" />
                <g className="car-wheel" style={{ transformOrigin: '110px 188px' }}>
                    <circle cx="110" cy="188" r="21" fill="url(#rimGrad)" stroke="#475569" strokeWidth="1" />
                    {/* 6 rayos del rin */}
                    {[0, 60, 120, 180, 240, 300].map(deg => (
                        <g key={deg} transform={`rotate(${deg} 110 188)`}>
                            <rect x="107" y="170" width="6" height="36" rx="2.5"
                                  fill="#e2e8f0" stroke="#94a3b8" strokeWidth=".4" />
                            <rect x="108" y="170" width="2" height="36" fill="rgba(255,255,255,0.5)" />
                        </g>
                    ))}
                    <circle cx="110" cy="188" r="7" fill="url(#hubGrad)" stroke="#0f172a" strokeWidth="1" />
                    <circle cx="110" cy="188" r="2" fill="#020617" />
                </g>
            </g>

            {/* RUEDA DELANTERA — multicapa */}
            <g>
                <circle cx="390" cy="188" r="33" fill="url(#tireGrad)" stroke="#020617" strokeWidth="1.5" />
                <circle cx="390" cy="188" r="29" fill="#0f172a" />
                <circle cx="390" cy="188" r="24" fill="none" stroke="#1e293b" strokeWidth="2" />
                <g className="car-wheel" style={{ transformOrigin: '390px 188px', animationDelay: '-0.5s' }}>
                    <circle cx="390" cy="188" r="21" fill="url(#rimGrad)" stroke="#475569" strokeWidth="1" />
                    {[0, 60, 120, 180, 240, 300].map(deg => (
                        <g key={deg} transform={`rotate(${deg} 390 188)`}>
                            <rect x="387" y="170" width="6" height="36" rx="2.5"
                                  fill="#e2e8f0" stroke="#94a3b8" strokeWidth=".4" />
                            <rect x="388" y="170" width="2" height="36" fill="rgba(255,255,255,0.5)" />
                        </g>
                    ))}
                    <circle cx="390" cy="188" r="7" fill="url(#hubGrad)" stroke="#0f172a" strokeWidth="1" />
                    <circle cx="390" cy="188" r="2" fill="#020617" />
                </g>
            </g>
        </svg>
    );
}
