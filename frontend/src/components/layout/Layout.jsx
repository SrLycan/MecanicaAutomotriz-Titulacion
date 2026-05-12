import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
    { to: '/dashboard',            label: 'Dashboard',   icon: IconDash,  roles: ['administrador','tecnico','recepcionista'] },
    { to: '/dashboard/inventario', label: 'Inventario',  icon: IconInv,   roles: ['administrador','tecnico','recepcionista'] },
    { to: '/dashboard/movimientos',label: 'Movimientos', icon: IconMov,   roles: ['administrador','tecnico'] },
];

const ROL_COLOR = { administrador: '#a855f7', tecnico: '#22c55e', recepcionista: '#f59e0b' };

function IconDash() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }
function IconInv()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>; }
function IconMov()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>; }

export default function Layout() {
    const { usuario, logout, tieneRol } = useAuth();
    const { isDark, toggle } = useTheme();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

    const sbBg  = isDark ? '#050309' : '#160830';
    const bdr   = isDark ? 'rgba(168,85,247,0.10)' : 'rgba(168,85,247,0.16)';
    const mainBg = isDark ? '#09060f' : '#f5f0ff';
    const hdrBg  = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.85)';
    const txt    = isDark ? '#e2dff0' : '#160830';
    const mut    = isDark ? 'rgba(226,223,240,0.38)' : 'rgba(55,10,120,0.5)';

    const handleLogout = () => { logout(); toast.success('Sesion cerrada'); navigate('/login'); };
    const items = NAV_ITEMS.filter(item => tieneRol(...item.roles));

    return (
        <div style={{ display: 'flex', height: '100vh', background: mainBg, overflow: 'hidden' }}>

            {/* ── Sidebar ── */}
            <aside style={{ width: collapsed ? 64 : 220, background: sbBg, display: 'flex', flexDirection: 'column', transition: 'width .25s cubic-bezier(.4,0,.2,1)', flexShrink: 0, borderRight: `1px solid ${bdr}`, overflow: 'hidden', position: 'relative', zIndex: 10 }}>

                {/* Logo */}
                <div style={{ padding: collapsed ? '22px 0' : '22px 20px', borderBottom: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', minHeight: 68 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    </div>
                    {!collapsed && (
                        <div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.15rem', letterSpacing: '.1em', color: '#fff', lineHeight: 1 }}>SSWAP</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.6rem', color: 'rgba(168,85,247,.6)', marginTop: 1 }}>Admin Panel</p>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, paddingTop: 12, paddingBottom: 12 }}>
                    {items.map(item => (
                        <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: collapsed ? '11px 0' : '11px 20px',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                color: isActive ? '#a855f7' : 'rgba(226,223,240,0.4)',
                                textDecoration: 'none',
                                background: isActive ? 'rgba(168,85,247,0.1)' : 'transparent',
                                borderLeft: isActive ? '2px solid #a855f7' : '2px solid transparent',
                                transition: 'all .15s',
                                fontSize: '.82rem', fontFamily: "'Outfit'", fontWeight: 500,
                            })}>
                            <span style={{ flexShrink: 0, display: 'flex' }}><item.icon /></span>
                            {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* Toggle collapse */}
                <button onClick={() => setCollapsed(c => !c)}
                    style={{ margin: '0 12px 14px', padding: '9px', borderRadius: 9, border: `1px solid ${bdr}`, background: 'none', color: 'rgba(168,85,247,.45)', cursor: 'pointer', fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.12em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .18s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(168,85,247,.4)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = bdr}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        {collapsed ? <><polyline points="9 18 15 12 9 6"/></> : <><polyline points="15 18 9 12 15 6"/></>}
                    </svg>
                    {!collapsed && <span>Colapsar</span>}
                </button>
            </aside>

            {/* ── Main ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Header */}
                <header style={{ background: hdrBg, borderBottom: `1px solid ${isDark ? 'rgba(147,51,234,0.12)' : 'rgba(100,30,180,0.12)'}`, padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.28em', color: isDark ? 'rgba(168,85,247,.45)' : 'rgba(124,58,237,.5)' }}>ADMIN</p>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(168,85,247,.35)' : 'rgba(124,58,237,.4)'} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.82rem', color: txt }}>Panel Principal</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Theme toggle */}
                        <button onClick={toggle} className="btn-icon"
                            style={{ color: mut }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(168,85,247,.4)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                            {isDark
                                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            }
                        </button>

                        {/* User pill */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', border: `1px solid ${isDark ? 'rgba(147,51,234,0.14)' : 'rgba(100,30,180,0.18)'}`, borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(124,58,237,0.03)' }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', color: '#fff' }}>{usuario?.nombre?.[0]?.toUpperCase()}</span>
                            </div>
                            <div>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.78rem', color: txt, lineHeight: 1 }}>{usuario?.nombre}</p>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.52rem', letterSpacing: '.12em', color: ROL_COLOR[usuario?.rol] || '#a855f7', lineHeight: 1.4 }}>{usuario?.rol}</p>
                            </div>
                        </div>

                        {/* Logout */}
                        <button onClick={handleLogout} className="btn-icon"
                            style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
