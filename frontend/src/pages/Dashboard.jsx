/**
 * SS SWAP - Panel de Control Administrativo (Dashboard)
 * Vista principal del staff autenticado. Muestra KPIs de inventario y taller,
 * alertas de stock bajo, movimientos recientes y accesos rápidos a módulos clave.
 * Las métricas se adaptan al rol del usuario: administrador, técnico o recepcionista.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import adminImg from '../assets/admin.png';
import techImg from '../assets/tecnico.png';
import './Dashboard.css';

const ROL_META = {
    administrador: { label: 'Administracion', sub: 'Inventario, ordenes, clientes y usuarios del taller' },
    tecnico:       { label: 'Taller',          sub: 'Reparaciones, progreso de vehiculos e inventario' },
    recepcionista: { label: 'Recepcion',       sub: 'Clientes, vehiculos y ordenes de trabajo' },
};

function IconBox()    { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconAlert()  { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function IconIn()     { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>; }
function IconOut()    { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>; }
function IconArrowR() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>; }
function IconClock()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconBolt()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function IconWrench() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }
function IconUsers()  { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconCar()    { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.5l2-3h7l2 3H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/></svg>; }
function IconOrden()  { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>; }

export default function Dashboard() {
    const { usuario, tieneRol } = useAuth();
    const { isDark }  = useTheme();
    const [stats,   setStats]   = useState({ total: 0, bajo_stock: 0, entradas: 0, salidas: 0, valor: 0 });
    const [taller,  setTaller]  = useState({ clientes: 0, vehiculos: 0, pendientes: 0, progreso: 0 });
    const [alertas, setAlertas] = useState([]);
    const [movRecientes, setMovRecientes] = useState([]);
    const puedeVerMovimientos = tieneRol('administrador', 'tecnico', 'recepcionista');
    const [loading, setLoading] = useState(true);

    // ── Fase 5: KPIs adicionales de negocio (Proveedores + Graficas) ──
    // Estado y fetch completamente separados de los de arriba, para no
    // tocar la logica ni el loading existente del Dashboard.
    const [negocio, setNegocio] = useState(null);
    const [loadingNegocio, setLoadingNegocio] = useState(true);

    const SKY      = '#0ea5e9';
    const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.18)';

    const GOLD     = '#c9a227';
    const txt    = isDark ? '#f1f5f9' : '#020617';
    const txtSf  = isDark ? '#cbd5e1' : '#0f172a';
    const mut    = isDark ? 'rgba(241,245,249,0.55)' : '#111827';
    const faint  = isDark ? 'rgba(241,245,249,0.38)' : '#2d3748';
    const bdr    = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)';
    const card   = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';

    useEffect(() => {
        const cargar = async () => {
            setLoading(true);
            try {
                const [repRes, bajRes, ordRes, cliRes, vehRes] = await Promise.all([
                    api.get('/inventory/repuestos'),
                    api.get('/inventory/repuestos?bajo_stock=true'),
                    api.get('/ordenes/ordenes').catch(() => ({ data: { ordenes: [] } })),
                    api.get('/ordenes/clientes').catch(() => ({ data: { clientes: [] } })),
                    api.get('/ordenes/vehiculos').catch(() => ({ data: { vehiculos: [] } })),
                ]);
                const ordenes = ordRes.data.ordenes || [];
                setTaller({
                    clientes: cliRes.data.clientes?.length || 0,
                    vehiculos: vehRes.data.vehiculos?.length || 0,
                    pendientes: ordenes.filter(o => o.estado === 'pendiente').length,
                    progreso: ordenes.filter(o => o.estado === 'en_progreso').length,
                });

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
                const valor = (repRes.data.repuestos || []).reduce((s, r) => s + (r.stock_actual * parseFloat(r.precio_venta || 0)), 0);
                setStats({
                    total: repRes.data.total,
                    bajo_stock: bajRes.data.total,
                    entradas: movHoy.filter(m => m.tipo === 'entrada').length,
                    salidas: movHoy.filter(m => m.tipo === 'salida').length,
                    valor,
                });
                setAlertas(bajRes.data.repuestos.slice(0, 6));
                setMovRecientes(movimientos.slice(0, 5));
            } catch {}
            finally { setLoading(false); }
        };
        cargar();
    }, [puedeVerMovimientos]);

    // Fase 5: KPIs de negocio (solo administrador, fetch aislado y silencioso
    // ante errores — nunca debe romper ni retrasar el resto del Dashboard).
    useEffect(() => {
        if (usuario?.rol !== 'administrador') { setLoadingNegocio(false); return; }
        (async () => {
            setLoadingNegocio(true);
            try {
                const [resumenRes, prodRes, servRes] = await Promise.all([
                    api.get('/proveedores/resumen?periodo=mes').catch(() => ({ data: null })),
                    api.get('/estadisticas/productos-mas-vendidos?periodo=mes&limit=1').catch(() => ({ data: null })),
                    api.get('/estadisticas/servicios-mas-solicitados?periodo=mes&limit=1').catch(() => ({ data: null })),
                ]);
                setNegocio({
                    resumen: resumenRes.data,
                    productoTop: prodRes.data?.productos?.[0] || null,
                    servicioTop: servRes.data?.servicios?.[0] || null,
                });
            } catch { setNegocio(null); }
            finally { setLoadingNegocio(false); }
        })();
    }, [usuario?.rol]);

    const meta = ROL_META[usuario?.rol] || ROL_META.recepcionista;
    const esAdmin     = usuario?.rol === 'administrador';
    const esTecnico   = usuario?.rol === 'tecnico';
    const esRecepcion = usuario?.rol === 'recepcionista';

    const greet = (() => {
        const h = new Date().getHours();
        if (h < 12) return 'Buenos dias';
        if (h < 19) return 'Buenas tardes';
        return 'Buenas noches';
    })();

    const CARDS = [
        { key: 'pendientes', label: 'Ordenes Pendientes', val: taller.pendientes, color: '#f59e0b',  icon: <IconOrden />, roles: ['administrador','tecnico','recepcionista'] },
        { key: 'progreso',   label: 'En Reparacion',      val: taller.progreso,   color: SKY,        icon: <IconWrench />, roles: ['administrador','tecnico','recepcionista'] },
        { key: 'clientes',   label: 'Clientes',           val: taller.clientes,   color: GOLD,       icon: <IconUsers />, roles: ['administrador','recepcionista'] },
        { key: 'vehiculos',  label: 'Vehiculos',          val: taller.vehiculos,  color: '#10b981',  icon: <IconCar />,   roles: ['administrador','tecnico','recepcionista'] },
        { key: 'total',      label: 'Repuestos',          val: stats.total,       color: '#6366f1',  icon: <IconBox />,   roles: ['administrador','tecnico','recepcionista'] },
        { key: 'bajo_stock', label: 'Bajo Stock',         val: stats.bajo_stock,  color: '#ef4444',  icon: <IconAlert />, roles: ['administrador','tecnico','recepcionista'], alert: true },
        { key: 'entradas',   label: 'Entradas Hoy',       val: stats.entradas,    color: '#10b981',  icon: <IconIn />,    roles: ['administrador','tecnico'] },
        { key: 'salidas',    label: 'Salidas Hoy',        val: stats.salidas,     color: '#f59e0b',  icon: <IconOut />,   roles: ['administrador','tecnico'] },
    ].filter(c => c.roles.includes(usuario?.rol)).slice(0, 4);

    const fechaHoy = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div style={{
            animation: 'fadeIn .35s ease', maxWidth: 1400,
            '--sky-bdr': SKY_BDR,
            '--dash-cards-count': CARDS.length,
            '--dash-bottom-cols': alertas.length > 0 ? '1.4fr 1fr' : '1fr',
        }}>

            {/* ── HERO CARD con auto 3D ── */}
            <div className="dash-hero-grid" style={{
                position: 'relative', marginBottom: 28,
                background: isDark
                    ? 'linear-gradient(135deg, #0a0f1c 0%, #0c2237 50%, #0a0f1c 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 60%, #e0f2fe 100%)',
                border: `1px solid ${isDark ? 'rgba(56,189,248,0.18)' : 'rgba(14,165,233,0.18)'}`,
                borderRadius: 22, padding: '32px 36px',
                overflow: 'hidden', boxShadow: cardSh,
                minHeight: 220,
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
                    <div className="SS SWAP-chip" style={{ marginBottom: 12 }}>
                        <span className="dot" />
                        <span>SS SWAP · {meta.label.toUpperCase()}</span>
                    </div>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '1.08rem', color: SKY_DEEP, marginBottom: 4 }}>
                        {greet},
                    </p>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '3.5rem', letterSpacing: '.02em', color: txt, lineHeight: 1 }}>
                        {usuario?.nombre || 'Usuario'}
                    </h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '1.02rem', color: mut, marginTop: 10, maxWidth: 380 }}>
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
                        <span style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.9rem', color: txtSf, textTransform: 'capitalize' }}>{fechaHoy}</span>
                    </div>
                </div>

                {/* Lado derecho: Imagen de rol */}
                <div className="dash-hero-car" style={{ position: 'relative', zIndex: 1, overflow: 'hidden', borderRadius: 16, minHeight: 200 }}>
                    {esAdmin ? (
                        <img src={adminImg} alt="Administrador" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} />
                    ) : esTecnico ? (
                        <img src={techImg} alt="Técnico" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} />
                    ) : (
                        <RoleIllustration isDark={isDark} />
                    )}
                </div>
            </div>

            {/* ── Stat cards ── */}
            {loading ? (
                <div className="dash-stats-grid">
                    {Array(CARDS.length).fill(0).map((_, i) => (
                        <div key={i} className="sk-pulse" style={{ height: 130, background: card, border: `1px solid ${bdr}`, borderRadius: 16 }} />
                    ))}
                </div>
            ) : (
                <div className="dash-stats-grid">
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
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.68rem', letterSpacing: '.22em', color: mut }}>{c.label.toUpperCase()}</p>
                            </div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '3rem', letterSpacing: '.02em', color: c.color, lineHeight: 1 }}>
                                {c.val}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Fase 5: Resumen del Negocio (solo admin) — seccion NUEVA, ── */}
            {/* no reemplaza ni modifica las tarjetas de arriba.             */}
            {esAdmin && (
                <div style={{ marginBottom: 28 }}>
                    <div className="dash-section-header" style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>
                            Resumen del Negocio · Este mes
                        </h2>
                        <div className="separator" style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(14,165,233,0.2), transparent)' }} />
                        <Link to="/dashboard/graficas" style={{ fontFamily: "'Bebas Neue'", fontSize: '.68rem', letterSpacing: '.14em', color: SKY, textDecoration: 'none' }}>VER GRÁFICAS</Link>
                    </div>

                    {loadingNegocio ? (
                        <div className="dash-stats-grid">
                            {Array(6).fill(0).map((_, i) => (
                                <div key={i} className="sk-pulse" style={{ height: 110, background: card, border: `1px solid ${bdr}`, borderRadius: 16 }} />
                            ))}
                        </div>
                    ) : !negocio ? (
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>No se pudo cargar el resumen de negocio en este momento.</p>
                    ) : (
                        <div className="dash-stats-grid">
                            {[
                                { key: 'compras',   label: 'Compras a Proveedores', val: `$${Number(negocio.resumen?.total_comprado || 0).toFixed(2)}`,  color: SKY_DEEP },
                                { key: 'gastos',    label: 'Gastos del Periodo',     val: `$${Number(negocio.resumen?.total_gastos || 0).toFixed(2)}`,   color: '#ef4444' },
                                { key: 'deudas',    label: 'Deudas con Proveedores', val: `$${Number(negocio.resumen?.total_pendiente || 0).toFixed(2)}`, color: '#f59e0b' },
                                { key: 'proveed',   label: 'Proveedores Activos',    val: negocio.resumen?.proveedores_activos ?? 0,                       color: '#8b5cf6' },
                                { key: 'prodTop',   label: 'Producto Más Vendido',   val: negocio.productoTop ? negocio.productoTop.nombre : 'Sin datos',  color: '#6366f1', small: true },
                                { key: 'servTop',   label: 'Servicio Más Solicitado', val: negocio.servicioTop ? negocio.servicioTop.nombre : 'Sin datos', color: '#10b981', small: true },
                            ].map((c, i) => (
                                <div key={c.key} className="dash-card"
                                    style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: '22px 24px 20px', boxShadow: cardSh, animationDelay: `${i * 70}ms` }}>
                                    <div className="glow" style={{ background: `radial-gradient(closest-side, ${c.color}, transparent)` }} />
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(180deg, ${c.color}, transparent)` }} />
                                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.68rem', letterSpacing: '.22em', color: mut, marginBottom: 14 }}>{c.label.toUpperCase()}</p>
                                    <p style={{ fontFamily: c.small ? "'Outfit'" : "'Bebas Neue'", fontWeight: c.small ? 700 : 400, fontSize: c.small ? '1.15rem' : '2rem', letterSpacing: '.02em', color: c.color, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {c.val}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Acciones rapidas + Valor inventario ── */}
            <div className="dash-middle-grid">
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: 22, boxShadow: cardSh }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, color: SKY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconBolt />
                        </div>
                        <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', letterSpacing: '.05em', color: txt }}>Acciones Rapidas</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
                        <Link to="/dashboard/inventario" className="quick-action" style={qaStyle(card, bdr, txt, mut)}>
                            <span style={{ color: SKY }}><IconBox /></span>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.94rem', color: txt }}>Ver inventario</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>Catalogo completo</p>
                            </div>
                            <span className="qa-arrow" style={{ color: faint }}><IconArrowR /></span>
                        </Link>
                        {(esRecepcion || esAdmin) && (
                            <Link to="/dashboard/clientes" className="quick-action" style={qaStyle(card, bdr, txt, mut)}>
                                <span style={{ color: GOLD }}><IconUsers /></span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.94rem', color: txt }}>Gestionar clientes</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>Registro e historial</p>
                                </div>
                                <span className="qa-arrow" style={{ color: faint }}><IconArrowR /></span>
                            </Link>
                        )}
                        <Link to="/dashboard/ordenes" className="quick-action" style={qaStyle(card, bdr, txt, mut)}>
                            <span style={{ color: SKY }}><IconOrden /></span>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.94rem', color: txt }}>Ordenes de trabajo</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>{taller.pendientes} pendientes</p>
                            </div>
                            <span className="qa-arrow" style={{ color: faint }}><IconArrowR /></span>
                        </Link>
                        {(esRecepcion || esAdmin || esTecnico) && (
                            <Link to="/dashboard/vehiculos" className="quick-action" style={qaStyle(card, bdr, txt, mut)}>
                                <span style={{ color: '#10b981' }}><IconCar /></span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.94rem', color: txt }}>Vehiculos</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>Asociar y consultar</p>
                                </div>
                                <span className="qa-arrow" style={{ color: faint }}><IconArrowR /></span>
                            </Link>
                        )}
                        {(esAdmin || esTecnico) && (
                            <Link to="/dashboard/movimientos" className="quick-action" style={qaStyle(card, bdr, txt, mut)}>
                                <span style={{ color: '#10b981' }}><IconIn /></span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.94rem', color: txt }}>Movimientos</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>Trazabilidad</p>
                                </div>
                                <span className="qa-arrow" style={{ color: faint }}><IconArrowR /></span>
                            </Link>
                        )}
                        {stats.bajo_stock > 0 && (
                            <Link to="/dashboard/inventario" className="quick-action" style={{ ...qaStyle(card, bdr, txt, mut), borderColor: 'rgba(239,68,68,0.2)' }}>
                                <span style={{ color: '#ef4444' }}><IconAlert /></span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.94rem', color: txt }}>Atender alertas</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: '#ef4444' }}>{stats.bajo_stock} con bajo stock</p>
                                </div>
                                <span className="qa-arrow" style={{ color: faint }}><IconArrowR /></span>
                            </Link>
                        )}
                        {esAdmin && (
                            <Link to="/dashboard/inventario" className="quick-action" style={qaStyle(card, bdr, txt, mut)}>
                                <span style={{ color: SKY_DEEP }}><IconWrench /></span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.94rem', color: txt }}>Crear repuesto</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>Agregar al catalogo</p>
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
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.24em', color: 'rgba(255,255,255,0.85)', position: 'relative' }}>VALOR DE INVENTARIO</p>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.8rem', letterSpacing: '.02em', color: '#fff', lineHeight: 1, marginTop: 6, position: 'relative' }}>
                        ${stats.valor.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: 'rgba(255,255,255,0.78)', marginTop: 8, position: 'relative' }}>
                        Estimado a precio de venta · {stats.total} repuestos
                    </p>
                </div>
            </div>

            {/* ── Bloque inferior: Alertas + Movimientos recientes ── */}
            <div className="dash-bottom-grid">
                {alertas.length > 0 && (
                    <div style={{ animation: 'fadeIn .5s ease both', animationDelay: '.2s' }}>
                        <div className="dash-section-header" style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 7,
                                padding: '4px 11px', borderRadius: 999,
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                                fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.24em', color: '#ef4444',
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'alertPulse 1.6s ease-in-out infinite' }} />
                                ATENCION
                            </span>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>
                                Stock Bajo
                            </h2>
                            <div className="separator" style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(239,68,68,0.25), transparent)' }} />
                            <Link to="/dashboard/inventario" style={{ fontFamily: "'Bebas Neue'", fontSize: '.75rem', letterSpacing: '.16em', color: SKY, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                VER TODO <IconArrowR />
                            </Link>
                        </div>

                        <div style={{ background: card, border: `1px solid rgba(239,68,68,0.15)`, borderRadius: 14, overflow: 'hidden', boxShadow: cardSh }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: `1px solid ${bdr}`, background: 'rgba(239,68,68,0.03)' }}>
                                            {['Codigo', 'Repuesto', 'Stock', 'Min'].map(h => (
                                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.22em', color: '#ef4444', whiteSpace: 'nowrap' }}>{h}</th>
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
                                                        fontFamily: 'monospace', fontSize: '.84rem', fontWeight: 600,
                                                        background: SKY_PALE, padding: '3px 9px', borderRadius: 6,
                                                        color: SKY_DEEP, border: `1px solid ${SKY_BDR}`,
                                                    }}>{r.codigo}</code>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.94rem', color: txt, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', letterSpacing: '.04em', color: '#ef4444' }}>{r.stock_actual}</span>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.9rem', color: mut }}>{r.stock_minimo}</td>
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
                        <div className="dash-section-header" style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>
                                Actividad Reciente
                            </h2>
                            <div className="separator" style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(14,165,233,0.2), transparent)' }} />
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
                                            <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.9rem', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.repuesto_nombre}</p>
                                            <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginTop: 1 }}>
                                                {new Date(m.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })} · {m.usuario_nombre}
                                            </p>
                                        </div>
                                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.02em', color, whiteSpace: 'nowrap' }}>
                                            {ent ? '+' : '−'}{m.cantidad}
                                        </span>
                                    </div>
                                );
                            })}
                            <Link to="/dashboard/movimientos" style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '10px', marginTop: 4,
                                fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.16em', color: SKY,
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
   Ilustracion SVG para el rol recepcionista, que todavia no tiene
   foto propia como admin/tecnico (ver adminImg/techImg mas arriba).
   ───────────────────────────────────────────────────────────── */
function RoleIllustration({ isDark }) {
    const bg1 = isDark ? '#0c4a6e' : '#e0f2fe';
    const bg2 = isDark ? '#0284c7' : '#bae6fd';
    const accent = '#0ea5e9';
    const mid = isDark ? '#94a3b8' : '#475569';

    return (
        <svg viewBox="0 0 240 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 300 }}>
            <circle cx="120" cy="100" r="88" fill={bg1} opacity=".5" />
            <circle cx="120" cy="100" r="64" fill={bg2} opacity=".4" />
            {/* Person silhouette */}
            <circle cx="120" cy="68" r="18" fill={accent} opacity=".25" stroke={accent} strokeWidth="2" />
            <path d="M88 130 Q88 108 120 104 Q152 108 152 130" fill={accent} opacity=".18" stroke={accent} strokeWidth="2" strokeLinecap="round" />
            {/* Headset */}
            <path d="M100 62 Q100 44 120 44 Q140 44 140 62" stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" />
            <rect x="95" y="58" width="10" height="14" rx="4" fill={accent} opacity=".6" />
            <rect x="135" y="58" width="10" height="14" rx="4" fill={accent} opacity=".6" />
            {/* Clipboard small */}
            <g transform="translate(155, 85)">
                <rect x="0" y="0" width="36" height="46" rx="5" fill={isDark ? '#1e293b' : '#fff'} stroke={mid} strokeWidth="1.5" />
                <rect x="10" y="-4" width="16" height="10" rx="4" fill={accent} opacity=".5" />
                <rect x="7" y="14" width="22" height="3" rx="1.5" fill={mid} opacity=".4" />
                <rect x="7" y="22" width="18" height="3" rx="1.5" fill={mid} opacity=".3" />
                <rect x="7" y="30" width="20" height="3" rx="1.5" fill={mid} opacity=".4" />
            </g>
            {/* Chat bubble */}
            <g transform="translate(62, 90)">
                <rect x="0" y="0" width="38" height="26" rx="8" fill={accent} opacity=".18" stroke={accent} strokeWidth="1.5" />
                <circle cx="11" cy="13" r="2.5" fill={accent} opacity=".5" />
                <circle cx="19" cy="13" r="2.5" fill={accent} opacity=".5" />
                <circle cx="27" cy="13" r="2.5" fill={accent} opacity=".5" />
            </g>
        </svg>
    );
}

