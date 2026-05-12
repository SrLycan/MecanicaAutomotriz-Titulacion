import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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

    const handleLogout = () => { logout(); navigate('/'); };

    const esCliente = usuario && usuario.rol === 'cliente';
    const esAdmin   = usuario && ['administrador','tecnico','recepcionista'].includes(usuario.rol);

    return (
        <>
            <style>{`
                .pub-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; transition: background .3s, box-shadow .3s; }
                .pub-nav.scrolled { background: #0d0d0d; box-shadow: 0 2px 20px rgba(0,0,0,.6); }
                .pub-nav.top      { background: transparent; }
                .nav-link { font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .9rem; color: rgba(255,255,255,.75); text-decoration: none; padding: 6px 0; border-bottom: 2px solid transparent; transition: color .2s, border-color .2s; }
                .nav-link:hover, .nav-link.active { color: #fff; border-bottom-color: #c9a227; }
                .nav-btn-outline { font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .85rem; color: #fff; background: none; border: 1.5px solid rgba(255,255,255,.4); border-radius: 6px; padding: 7px 18px; cursor: pointer; text-decoration: none; transition: all .2s; }
                .nav-btn-outline:hover { border-color: #c9a227; color: #c9a227; }
                .nav-btn-gold { font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .85rem; color: #0d0d0d; background: #c9a227; border: none; border-radius: 6px; padding: 8px 20px; cursor: pointer; text-decoration: none; transition: all .2s; }
                .nav-btn-gold:hover { background: #e0b830; }
                .hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; background: none; border: none; padding: 4px; }
                .hamburger span { display: block; width: 22px; height: 2px; background: #fff; transition: all .25s; }
                @media (max-width: 768px) {
                    .nav-links-desktop { display: none !important; }
                    .hamburger { display: flex; }
                    .nav-mobile { display: flex !important; }
                }
                .nav-mobile { display: none; flex-direction: column; gap: 0; background: #0d0d0d; border-top: 1px solid rgba(255,255,255,.08); padding: 12px 0; }
                .nav-mobile a, .nav-mobile button { font-family: 'Outfit', sans-serif; font-size: .9rem; color: rgba(255,255,255,.8); text-decoration: none; padding: 12px 24px; border: none; background: none; cursor: pointer; text-align: left; width: 100%; transition: color .2s; }
                .nav-mobile a:hover, .nav-mobile button:hover { color: #c9a227; }
            `}</style>

            <nav className={`pub-nav ${scrolled ? 'scrolled' : 'top'}`}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

                    {/* Logo */}
                    <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, background: '#c9a227', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', letterSpacing: '.1em', color: '#fff', lineHeight: 1 }}>SSWAP</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.6rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.2, letterSpacing: '.04em' }}>Mecanica Automotriz</p>
                        </div>
                    </Link>

                    {/* Links desktop */}
                    <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
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
                                <Link to="/auth" className="nav-btn-outline">Iniciar Sesion</Link>
                                <Link to="/auth?modo=registro" className="nav-btn-gold">Registrarse</Link>
                            </>
                        )}
                        {esCliente && (
                            <>
                                <span style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: 'rgba(255,255,255,.6)' }}>Hola, {usuario.nombre.split(' ')[0]}</span>
                                <button onClick={handleLogout} className="nav-btn-outline">Salir</button>
                            </>
                        )}
                        {esAdmin && (
                            <>
                                <Link to="/dashboard" className="nav-btn-outline">Panel Admin</Link>
                                <button onClick={handleLogout} className="nav-btn-outline">Salir</button>
                            </>
                        )}
                    </div>

                    {/* Hamburger */}
                    <button className="hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
                        <span style={{ transform: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none' }} />
                        <span style={{ opacity: menuOpen ? 0 : 1 }} />
                        <span style={{ transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' }} />
                    </button>
                </div>

                {/* Mobile menu */}
                {menuOpen && (
                    <div className="nav-mobile">
                        {NAV_LINKS.map(l => <Link key={l.href} to={l.href}>{l.label}</Link>)}
                        <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '8px 0' }} />
                        {!usuario && (
                            <>
                                <Link to="/auth">Iniciar Sesion</Link>
                                <Link to="/auth?modo=registro">Registrarse</Link>
                            </>
                        )}
                        {usuario && <button onClick={handleLogout}>Cerrar Sesion</button>}
                    </div>
                )}
            </nav>
        </>
    );
}
