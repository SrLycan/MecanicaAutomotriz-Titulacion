import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/logo.png';

const NAV_LINKS = [
    { label: 'Inicio',            href: '/'          },
    { label: 'Productos',         href: '/productos'  },
    { label: 'Agendar Servicio',  href: '/servicios'  },
    { label: 'Nosotros',          href: '/nosotros'   },
];

export default function Navbar() {
    const location  = useLocation();
    const navigate  = useNavigate();
    const { usuario, logout } = useAuth();
    const [scrolled,  setScrolled]  = useState(false);
    const [menuOpen,  setMenuOpen]  = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => { setMenuOpen(false); }, [location]);

    useEffect(() => {
        const onKeyDown = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const handleLogout = () => { logout(); navigate('/'); };

    const esCliente = usuario && usuario.rol === 'cliente';
    const esAdmin   = usuario && ['administrador','tecnico','recepcionista'].includes(usuario.rol);

    return (
        <>
            <style>{`
                .pub-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; transition: background .35s ease, box-shadow .35s ease, backdrop-filter .35s ease, border-color .35s ease; border-bottom: 1px solid transparent; }
                .pub-nav.scrolled { background: rgba(12,15,20,.86); backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); box-shadow: 0 8px 30px -12px rgba(0,0,0,.55); border-bottom-color: rgba(127,171,206,.14); }
                .pub-nav.top      { background: linear-gradient(180deg, rgba(8,10,14,.55), rgba(8,10,14,0)); }
                .nav-link { position: relative; font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .9rem; color: rgba(255,255,255,.72); text-decoration: none; padding: 8px 14px; border-radius: 999px; transition: color .2s, background .25s; }
                .nav-link::after { content: ''; position: absolute; left: 14px; right: calc(100% - 14px); bottom: 2px; height: 2px; background: linear-gradient(90deg, #7fabce, #3b7bab); transition: right .25s cubic-bezier(.4,0,.2,1); border-radius: 2px; }
                .nav-link:hover { color: #fff; background: rgba(255,255,255,.05); }
                .nav-link.active { color: #fff; background: rgba(59,123,171,.14); }
                .nav-link:hover::after, .nav-link.active::after { right: 14px; }
                .nav-btn-outline { font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .85rem; color: #fff; background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.28); border-radius: 8px; padding: 7px 18px; cursor: pointer; text-decoration: none; transition: all .2s; }
                .nav-btn-outline:hover { border-color: #7fabce; color: #cfe3f3; background: rgba(127,171,206,.1); }
                .nav-btn-gold { font-family: 'Sora', sans-serif; font-weight: 600; font-size: .85rem; color: #fff; background: linear-gradient(135deg, #1b3a57, #2b5c85 60%, #3b7bab); border: none; border-radius: 8px; padding: 8px 20px; cursor: pointer; text-decoration: none; transition: all .2s; box-shadow: 0 4px 16px -6px rgba(43,92,133,.6); }
                .nav-btn-gold:hover { box-shadow: 0 8px 22px -6px rgba(43,92,133,.75); transform: translateY(-1px); }
                .hamburger { display: none; align-items: center; justify-content: center; flex-direction: column; gap: 5px; cursor: pointer; width: 44px; height: 44px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.16); border-radius: 12px; padding: 0; box-shadow: 0 6px 18px -10px rgba(0,0,0,.7); transition: background .2s, border-color .2s, transform .2s; }
                .hamburger:hover, .hamburger.is-open { background: rgba(59,123,171,.18); border-color: rgba(127,171,206,.58); transform: translateY(-1px); }
                .hamburger span { display: block; width: 22px; height: 2px; background: #fff; border-radius: 9px; transition: all .25s; }
                @media (max-width: 768px) {
                    .nav-links-desktop { display: none !important; }
                    .hamburger { display: flex; }
                    .pub-nav-inner { padding: 0 16px !important; height: 64px !important; }
                    .nav-mobile { display: flex !important; }
                }
                .nav-mobile { display: none; flex-direction: column; gap: 4px; position: absolute; top: 72px; left: 12px; right: 12px; padding: 10px; background: rgba(12,15,20,.98); border: 1px solid rgba(127,171,206,.27); border-radius: 18px; box-shadow: 0 22px 50px -18px rgba(0,0,0,.78); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); animation: navMenuIn .25s cubic-bezier(.2,.8,.2,1) both; overflow: hidden; z-index: 101; }
                .nav-mobile::before { content: ''; position: absolute; top: 0; left: 12%; right: 12%; height: 1px; background: linear-gradient(90deg, transparent, #7fabce, transparent); }
                .nav-mobile a, .nav-mobile button { position: relative; font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .92rem; color: rgba(255,255,255,.85); text-decoration: none; padding: 13px 14px; border: none; border-radius: 10px; background: none; cursor: pointer; text-align: left; width: 100%; transition: color .2s, background .2s, transform .2s; }
                .nav-mobile a:hover, .nav-mobile a:active, .nav-mobile button:hover, .nav-mobile button:active { color: #fff; background: rgba(59,123,171,.16); transform: translateX(3px); }
                .nav-mobile .nav-mobile-primary { background: linear-gradient(135deg, #2b5c85, #3b7bab); color: #fff; text-align: center; box-shadow: 0 8px 18px -10px rgba(59,123,171,.8); }
                .nav-mobile .nav-mobile-primary:hover { background: linear-gradient(135deg, #3b7bab, #548fbd); }
                .nav-menu-overlay { position: fixed; inset: 0; z-index: 99; background: rgba(0,0,0,.42); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); animation: navOverlayIn .2s ease both; }
                @keyframes navMenuIn { from { opacity: 0; transform: translateY(-10px) scale(.98); } to { opacity: 1; transform: none; } }
                @keyframes navOverlayIn { from { opacity: 0; } to { opacity: 1; } }

                /* ── Logo con destello (titilando, difuminado, sin marcar el borde) ── */
                .nav-logo-wrap { position: relative; }
                .nav-logo-wrap::before {
                    content: '';
                    position: absolute;
                    inset: 10px;
                    border-radius: 16px;
                    filter: blur(18px);
                    z-index: 0;
                    animation: logoGlowPulse 2.6s ease-in-out infinite;
                }
                @keyframes logoGlowPulse {
                    0%, 100% { background: rgba(59,123,171,.16); }
                    50%      { background: rgba(127,171,206,.5); }
                }
                .nav-logo-img { position: relative; z-index: 1; }
                .nav-tagline {
                    font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .62rem;
                    letter-spacing: .1em; line-height: 1.35; color: rgba(255,255,255,.55);
                    text-transform: uppercase; white-space: nowrap;
                    background: linear-gradient(90deg, #7fabce 0%, #cfe3f3 25%, #7fabce 50%, #3b7bab 75%, #7fabce 100%);
                    background-size: 260% auto;
                    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
                    animation: shimmerSweepNav 6s linear infinite;
                }
                @keyframes shimmerSweepNav { 0% { background-position: -260% center; } 100% { background-position: 260% center; } }
                @media (max-width: 1100px) {
                    .nav-tagline { display: none !important; }
                }
            `}</style>

            {menuOpen && <div className="nav-menu-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
            <nav className={`pub-nav ${scrolled ? 'scrolled' : 'top'}`}>
                <div className="pub-nav-inner" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Logo */}
                    <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div className="nav-logo-wrap" style={{ width: 138, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img className="nav-logo-img" src={logoImg} alt="SS SWAP" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <p className="nav-tagline">RESTAURAMOS VEHÍCULOS<br />REFORZAMOS CONFIANZA.</p>
                    </Link>

                    {/* Links desktop */}
                    <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {NAV_LINKS.map(l => (
                            <Link key={l.href} to={l.href} className={`nav-link${location.pathname === l.href ? ' active' : ''}`}>
                                {l.label}
                            </Link>
                        ))}
                    </div>

                    {/* Auth desktop */}
                    <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {!usuario && (
                            <>
                                <Link to="/auth" className="nav-btn-outline">Iniciar Sesión</Link>
                                <Link to="/auth?modo=registro" className="nav-btn-gold">Registrarse</Link>
                            </>
                        )}
                        {esCliente && (
                            <>
                                <Link to="/mi-panel" className="nav-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    Mi Panel
                                </Link>
                                <button onClick={handleLogout} className="nav-btn-outline">Salir</button>
                            </>
                        )}
                        {esAdmin && (
                            <>
                                <Link to="/dashboard" className="nav-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                                    Admin
                                </Link>
                                <button onClick={handleLogout} className="nav-btn-outline">Salir</button>
                            </>
                        )}
                    </div>

                    {/* Hamburger */}
                    <button className={`hamburger${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="menu-movil">
                        <span style={{ transform: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none' }} />
                        <span style={{ opacity: menuOpen ? 0 : 1 }} />
                        <span style={{ transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' }} />
                    </button>
                </div>

                {/* Mobile menu */}
                {menuOpen && (
                    <div id="menu-movil" className="nav-mobile">
                        {NAV_LINKS.map(l => <Link key={l.href} to={l.href} className={location.pathname === l.href ? 'nav-mobile-primary' : ''}>{l.label}</Link>)}
                        <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '8px 0' }} />
                        {!usuario && (
                            <>
                                <Link to="/auth">Iniciar Sesión</Link>
                                <Link to="/auth?modo=registro" className="nav-mobile-primary">Registrarse</Link>
                            </>
                        )}
                        {esCliente && (
                            <>
                                <Link to="/mi-panel">Mi Panel</Link>
                                <button onClick={handleLogout}>Cerrar Sesión</button>
                            </>
                        )}
                        {esAdmin && (
                            <>
                                <Link to="/dashboard">Panel Admin</Link>
                                <button onClick={handleLogout}>Cerrar Sesión</button>
                            </>
                        )}
                    </div>
                )}
            </nav>
        </>
    );
}