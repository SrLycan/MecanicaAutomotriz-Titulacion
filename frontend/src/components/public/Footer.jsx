/**
 * SS SWAP - Pie de Página Institucional (Footer)
 * Presenta horarios de atención, accesos rápidos, enlaces a servicios,
 * canales de contacto, redes sociales y llamada a la acción de registro.
 * Los estilos (w-pie-*, footer-logo-link, footer-nav-link) viven en Footer.css.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../../assets/logo.png';
import '../../styles/web-publica.css';
import './Footer.css';

const SERVICIOS = [
    'Mantenimiento Preventivo',
    'Cambio de Aceite y Filtros',
    'Frenos y Suspension',
    'Sistema Electrico',
    'Diagnostico Computarizado',
    'Alineacion y Balanceo',
];

const LINKS_RAPIDOS = [
    { label: 'Inicio',            to: '/'          },
    { label: 'Productos',         to: '/productos'  },
    { label: 'Agendar Servicio',  to: '/servicios'  },
    { label: 'Nosotros',          to: '/nosotros'   },
    { label: 'Iniciar Sesión',    to: '/auth'       },
];

const CONTACTO = [
    { icon: <IconPin />,   text: 'Pasaje San Pedro S/N y, Av. Universitaria, 170184 Quito', href: 'https://maps.app.goo.gl/HfAkfW6noNjwu5vP9', label: 'Ver ubicación en Google Maps' },
    { icon: <IconPhone />, text: '0963863847', href: 'https://wa.me/593963863847', label: 'Escribir por WhatsApp al 0963863847' },
    { icon: <IconMail />,  text: 'contacto@ssswapcolisiones.com', href: 'mailto:contacto@ssswapcolisiones.com', label: 'Enviar un correo' },
];

const REDES = [
    { icon: <IconFacebook />,  href: 'https://www.facebook.com/profile.php?id=61592819312325', label: 'Facebook' },
    { icon: <IconInstagram />, href: 'https://www.instagram.com/ss_swap_01/', label: 'Instagram' },
    { icon: <IconTikTok />,    href: 'https://www.tiktok.com/@mecanica_ss_swap', label: 'TikTok' },
    { icon: <IconWhatsapp />,  href: 'https://wa.me/593963863847', label: 'WhatsApp' },
];

export default function Footer() {
    return (
        <footer className="w-pie">
            <div className="w-pie-grid">
                {/* Marca */}
                <div className="w-pie-marca">
                    <Link to="/" className="footer-logo-link" aria-label="SS SWAP, ir al inicio">
                        <img className="footer-logo-img" src={logoImg} alt="SS SWAP" width="120" height="50" />
                    </Link>
                    <p className="w-pie-desc">
                        Taller automotriz ubicado en Ponciano Alto, Quito. Más de 10 años brindando servicio técnico de calidad con tecnología de diagnóstico avanzada.
                    </p>
                    <div className="w-pie-horario">
                        <p className="w-pie-horario-t">Horario de Atención</p>
                        <p>Lunes - Viernes: 8:00am - 5:00pm</p>
                        <p>Sabado: 8:00am - 1:00pm</p>
                        <p>Domingo: Cerrado</p>
                    </div>
                </div>

                {/* Servicios */}
                <div>
                    <p className="w-pie-titulo">Servicios</p>
                    <ul className="w-pie-lista">
                        {SERVICIOS.map(s => <li key={s}>{s}</li>)}
                    </ul>
                </div>

                {/* Links rapidos */}
                <nav aria-label="Navegación del pie de página">
                    <p className="w-pie-titulo">Navegación</p>
                    <ul className="w-pie-lista w-pie-lista--enlaces">
                        {LINKS_RAPIDOS.map(l => (
                            <li key={l.to}>
                                <Link to={l.to} className="footer-nav-link">{l.label}</Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Contacto */}
                <div>
                    <p className="w-pie-titulo">Contacto</p>
                    <div className="w-pie-contacto">
                        {CONTACTO.map(item => (
                            <a key={item.href} href={item.href} aria-label={item.label}
                               target={item.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                                <span className="w-pie-contacto-ic">{item.icon}</span>
                                <span>{item.text}</span>
                            </a>
                        ))}
                    </div>

                    {/* Redes sociales */}
                    <div className="w-pie-redes">
                        {REDES.map(s => (
                            <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} title={s.label}>{s.icon}</a>
                        ))}
                    </div>

                    <Link to="/auth?modo=registro" className="w-pie-cta">Crear cuenta gratis</Link>
                </div>
            </div>

            {/* Barra inferior */}
            <div className="w-pie-base">
                <div className="w-pie-base-in">
                    <p>&copy; {new Date().getFullYear()} Mecánica Automotriz SS SWAP. Todos los derechos reservados.</p>
                    <p>Sistema desarrollado por Banda J, Sarango R, Vela D · PUCE TEC 2026</p>
                </div>
            </div>
        </footer>
    );
}

function IconPin()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function IconPhone() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 5.95 5.95l.87-.87a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16v.92z"/></svg>; }
function IconMail()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function IconFacebook()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>; }
function IconInstagram() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>; }
function IconWhatsapp()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>; }
function IconTikTok() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M9 3c.4 3.2 2.2 5.2 5.5 5.5V5.5c-1.5-.1-2.7-1-3.3-2.5H9z"/><path d="M14.5 5.5c.8.8 1.8 1.3 3 1.4V10c-1.2-.1-2.2-.4-3-1"/></svg>; }