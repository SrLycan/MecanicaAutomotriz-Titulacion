import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

function IconRegMov() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/><polyline points="5 12 12 5 19 12"/></svg>; }

const NAV_ITEMS = [
    { to: '/dashboard',             label: 'Dashboard',   icon: IconDash,   roles: ['administrador','tecnico','recepcionista'] },
    { to: '/dashboard/inventario',  label: 'Inventario',  icon: IconInv,    roles: ['administrador','tecnico','recepcionista'] },
    { to: '/dashboard/registrar',   label: 'Registrar',   icon: IconRegMov, roles: ['administrador','tecnico','recepcionista'] },
    { to: '/dashboard/movimientos', label: 'Movimientos', icon: IconMov,    roles: ['administrador','tecnico','recepcionista'] },
    { to: '/dashboard/usuarios',    label: 'Usuarios',    icon: IconUsers,  roles: ['administrador'] },
    { to: '/dashboard/vehiculos',   label: 'Vehiculos',   icon: IconCar,    roles: ['administrador','tecnico','recepcionista'] },
    { to: '/dashboard/ordenes',     label: 'Ordenes',     icon: IconOrden,  roles: ['administrador','tecnico','recepcionista'] },
    { to: '/dashboard/sucursales',  label: 'Sucursales',  icon: IconBranch, roles: ['administrador'] },
];

const ROL_COLOR = { administrador: '#0ea5e9', tecnico: '#10b981', recepcionista: '#f59e0b' };
const ROL_LABEL = { administrador: 'ADMIN', tecnico: 'TECNICO', recepcionista: 'RECEPCION' };

function IconDash() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }
function IconInv()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconMov()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>; }
function IconUsers(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconBranch(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function IconCar()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.5l2-3h7l2 3H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/></svg>; }
function IconOrden(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>; }

export default function Layout() {
    const { usuario, logout, tieneRol } = useAuth();
    const { isDark, toggle } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [bajoStockCount, setBajoStockCount] = useState(0);

    // Fetch low stock count for sidebar badge
    useEffect(() => {
        api.get('/inventory/repuestos?bajo_stock=true')
            .then(r => setBajoStockCount(r.data.total || 0))
            .catch(() => {});
        const interval = setInterval(() => {
            api.get('/inventory/repuestos?bajo_stock=true')
                .then(r => setBajoStockCount(r.data.total || 0))
                .catch(() => {});
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // ── Paleta celeste / blanco / negro ──
    const SKY      = '#0ea5e9';
    const SKY_DEEP = '#0284c7';
    const SKY_SOFT = '#7dd3fc';

    const sbBg    = isDark ? '#050a14' : '#0a0f1c';
    const sbBdr   = 'rgba(56,189,248,0.14)';
    const mainBg  = isDark ? '#050a14' : '#ffffff';
    const hdrBg   = isDark ? 'rgba(10,15,28,0.78)' : 'rgba(255,255,255,0.92)';
    const hdrBdr  = isDark ? 'rgba(56,189,248,0.14)' : 'rgba(15,23,42,0.06)';
    const txt     = isDark ? '#f1f5f9' : '#0f172a';
    const mut     = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const navMut  = 'rgba(203,213,225,0.55)';

    const handleLogout = () => { logout(); toast.success('Sesion cerrada'); navigate('/login'); };
    const items = NAV_ITEMS.filter(item => tieneRol(...item.roles));

    // Breadcrumb dinámico
    const crumb = (() => {
        if (location.pathname.endsWith('/inventario'))   return 'Inventario';
        if (location.pathname.endsWith('/movimientos'))  return 'Movimientos';
        if (location.pathname.endsWith('/usuarios'))     return 'Usuarios';
        if (location.pathname.endsWith('/ordenes'))      return 'Ordenes';
        if (location.pathname.endsWith('/sucursales'))   return 'Sucursales';
        return 'Dashboard';
    })();

    return (
        <div style={{ display: 'flex', height: '100vh', background: mainBg, overflow: 'hidden' }}>
            <style>{`
                @keyframes sbItemIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
                .sb-item { animation: sbItemIn .3s ease both; position: relative; }
                .sb-item::after {
                    content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
                    width: 3px; height: 0; background: linear-gradient(180deg, ${SKY}, ${SKY_DEEP});
                    border-radius: 0 3px 3px 0; transition: height .25s cubic-bezier(.4,0,.2,1);
                }
                .sb-item.is-active::after { height: 22px; box-shadow: 0 0 12px ${SKY}; }
                .sb-item:hover .sb-icon { transform: scale(1.08); color: ${SKY_SOFT}; }
                .sb-icon { transition: transform .2s, color .2s; }
                .hdr-pill { transition: border-color .2s, background .2s; }
                .hdr-pill:hover { border-color: rgba(56,189,248,.45); }
            `}</style>

            {/* ── Sidebar ── */}
            <aside style={{
                width: collapsed ? 68 : 232,
                background: sbBg,
                display: 'flex', flexDirection: 'column',
                transition: 'width .28s cubic-bezier(.4,0,.2,1)',
                flexShrink: 0,
                borderRight: `1px solid ${sbBdr}`,
                overflow: 'hidden',
                position: 'relative', zIndex: 10,
            }}>
                {/* Glow superior */}
                <div style={{ position: 'absolute', top: -120, left: -40, right: -40, height: 240, background: `radial-gradient(closest-side, rgba(14,165,233,0.22), transparent)`, pointerEvents: 'none' }} />

                {/* Logo */}
                <div style={{
                    padding: collapsed ? '22px 0' : '22px 22px',
                    borderBottom: `1px solid ${sbBdr}`,
                    display: 'flex', alignItems: 'center', gap: 11,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    minHeight: 70, position: 'relative', zIndex: 1,
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, boxShadow: `0 6px 20px -6px ${SKY}`,
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                        </svg>
                    </div>
                    {!collapsed && (
                        <div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', letterSpacing: '.12em', color: '#fff', lineHeight: 1 }}>SSWAP</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.6rem', color: SKY_SOFT, marginTop: 2, letterSpacing: '.18em' }}>ADMIN PANEL</p>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, paddingTop: 14, paddingBottom: 12, position: 'relative', zIndex: 1 }}>
                    {!collapsed && (
                        <p style={{ padding: '0 24px 8px', fontFamily: "'Bebas Neue'", fontSize: '.56rem', letterSpacing: '.26em', color: 'rgba(125,211,252,0.45)' }}>MENU</p>
                    )}
                    {items.map((item, idx) => (
                        <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'}
                            className={({ isActive }) => `sb-item${isActive ? ' is-active' : ''}`}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: 13,
                                padding: collapsed ? '12px 0' : '12px 22px',
                                margin: '2px 0',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                color: isActive ? '#fff' : navMut,
                                textDecoration: 'none',
                                position: 'relative',
                                background: isActive ? 'linear-gradient(90deg, rgba(14,165,233,0.18), rgba(14,165,233,0.02))' : 'transparent',
                                transition: 'all .2s cubic-bezier(.4,0,.2,1)',
                                fontSize: '.85rem', fontFamily: "'Outfit'", fontWeight: 500,
                                animationDelay: `${idx * 50}ms`,
                            })}>
                            <span className="sb-icon" style={{ flexShrink: 0, display: 'flex', color: 'inherit', position: 'relative' }}>
                                <item.icon />
                                {/* Low stock badge on Inventario */}
                                {item.to === '/dashboard/inventario' && bajoStockCount > 0 && (
                                    <span style={{
                                        position: 'absolute', top: -6, right: -8,
                                        minWidth: 16, height: 16, borderRadius: 999,
                                        background: '#ef4444', color: '#fff',
                                        fontSize: '.5rem', fontFamily: "'Bebas Neue'",
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        padding: '0 4px',
                                        boxShadow: '0 2px 6px rgba(239,68,68,.55)',
                                    }}>{bajoStockCount}</span>
                                )}
                            </span>
                            {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                            {/* Low stock badge text on Inventario */}
                            {!collapsed && item.to === '/dashboard/inventario' && bajoStockCount > 0 && (
                                <span style={{
                                    marginLeft: 'auto',
                                    fontFamily: "'Bebas Neue'", fontSize: '.5rem', letterSpacing: '.08em',
                                    color: '#ef4444', background: 'rgba(239,68,68,.15)',
                                    padding: '2px 7px', borderRadius: 999,
                                }}>
                                    {bajoStockCount} alert{bajoStockCount !== 1 ? 'as' : 'a'}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Toggle collapse */}
                <button onClick={() => setCollapsed(c => !c)}
                    style={{
                        margin: '0 14px 16px', padding: '10px',
                        borderRadius: 10, border: `1px solid ${sbBdr}`,
                        background: 'rgba(14,165,233,0.04)', color: SKY_SOFT,
                        cursor: 'pointer', fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.14em',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        transition: 'all .2s', position: 'relative', zIndex: 1,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.55)'; e.currentTarget.style.background = 'rgba(14,165,233,0.10)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = sbBdr; e.currentTarget.style.background = 'rgba(14,165,233,0.04)'; }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        {collapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
                    </svg>
                    {!collapsed && <span>COLAPSAR</span>}
                </button>
            </aside>

            {/* ── Main ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Header */}
                <header style={{
                    background: hdrBg,
                    borderBottom: `1px solid ${hdrBdr}`,
                    padding: '0 32px', height: 64,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0, backdropFilter: 'blur(14px)', position: 'relative', zIndex: 5,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.28em', color: SKY_DEEP }}>ADMIN</p>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={mut} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt }}>{crumb}</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Theme toggle */}
                        <button onClick={toggle} className="btn-icon" title={isDark ? 'Modo claro' : 'Modo oscuro'} style={{ color: mut }}>
                            {isDark
                                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            }
                        </button>

                        {/* User pill */}
                        <div className="hdr-pill" style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '6px 12px 6px 6px',
                            border: `1px solid ${isDark ? 'rgba(56,189,248,0.18)' : 'rgba(15,23,42,0.10)'}`,
                            borderRadius: 999,
                            background: isDark ? 'rgba(14,165,233,0.05)' : '#ffffff',
                        }}>
                            <div style={{
                                width: 30, height: 30, borderRadius: '50%',
                                background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `0 4px 12px -4px ${SKY}`,
                            }}>
                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', color: '#fff' }}>{usuario?.nombre?.[0]?.toUpperCase()}</span>
                            </div>
                            <div>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.8rem', color: txt, lineHeight: 1 }}>{usuario?.nombre}</p>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.54rem', letterSpacing: '.16em', color: ROL_COLOR[usuario?.rol] || SKY, lineHeight: 1.5 }}>{ROL_LABEL[usuario?.rol] || usuario?.rol}</p>
                            </div>
                        </div>

                        {/* Logout */}
                        <button onClick={handleLogout} className="btn-icon"
                            style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                            title="Cerrar sesion"
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.45)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main style={{ flex: 1, overflowY: 'auto', padding: '32px 36px', animation: 'fadeIn .35s ease', background: mainBg }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
