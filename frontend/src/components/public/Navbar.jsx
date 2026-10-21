/**
 * SS SWAP - Barra de Navegación Principal (Navbar)
 * Incluye navegación responsive, menú móvil, control de scroll con efecto glassmorphism
 * y accesos dinámicos según estado de autenticación (visitante, cliente o staff administrativo).
 * Los estilos (pub-nav, nav-link, hamburger, etc.) viven en Navbar.css.
 */
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, ROLES_STAFF } from '../../context/AuthContext';
import logoImg from '../../assets/logo.png';
import '../../styles/web-publica.css';
import './Navbar.css';

// Secciones del sitio público mostradas en desktop y móvil.
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
        onScroll();
        // passive: el navegador no espera a este listener para desplazar la pagina.
        window.addEventListener('scroll', onScroll, { passive: true });
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
    const esAdmin   = usuario && ROLES_STAFF.includes(usuario.rol);

    return (
        <>

            {menuOpen && <div className="nav-menu-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
            <nav className={`w-nav pub-nav ${scrolled ? 'scrolled' : 'top'}`} aria-label="Navegación principal">
                <div className="pub-nav-inner">
                    {/* Logo */}
                    <Link to="/" className="nav-marca" aria-label="SS SWAP, ir al inicio">
                        <span className="nav-logo-wrap">
                            <img className="nav-logo-img" src={logoImg} alt="SS SWAP" width="138" height="58" />
                        </span>
                        <p className="nav-tagline">RESTAURAMOS VEHÍCULOS<br />REFORZAMOS CONFIANZA.</p>
                    </Link>

                    {/* Links desktop */}
                    <div className="nav-links-desktop nav-enlaces">
                        {NAV_LINKS.map(l => (
                            <Link key={l.href} to={l.href} className={`nav-link${location.pathname === l.href ? ' active' : ''}`} aria-current={location.pathname === l.href ? 'page' : undefined}>
                                {l.label}
                            </Link>
                        ))}
                    </div>

                    {/* Auth desktop */}
                    <div className="nav-links-desktop nav-cuenta">
                        {!usuario && (
                            <>
                                <Link to="/auth" className="nav-btn-outline">Iniciar Sesión</Link>
                                <Link to="/auth?modo=registro" className="nav-btn-gold">Registrarse</Link>
                            </>
                        )}
                        {esCliente && (
                            <>
                                <Link to="/mi-panel" className="nav-btn-outline">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    Mi Panel
                                </Link>
                                <button onClick={handleLogout} className="nav-btn-outline">Salir</button>
                            </>
                        )}
                        {esAdmin && (
                            <>
                                <Link to="/dashboard" className="nav-btn-outline">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                                    Admin
                                </Link>
                                <button onClick={handleLogout} className="nav-btn-outline">Salir</button>
                            </>
                        )}
                    </div>

                    {/* Hamburger */}
                    <button className={`hamburger${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="menu-movil">
                        <span />
                        <span />
                        <span />
                    </button>
                </div>

                {/* Mobile menu */}
                {menuOpen && (
                    <div id="menu-movil" className="nav-mobile">
                        {NAV_LINKS.map(l => <Link key={l.href} to={l.href} className={location.pathname === l.href ? 'nav-mobile-activo' : ''} aria-current={location.pathname === l.href ? 'page' : undefined}>{l.label}</Link>)}
                        <div className="nav-mobile-sep" />
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