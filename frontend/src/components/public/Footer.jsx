import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

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
    { label: 'Iniciar Sesion',    to: '/auth'       },
];

export default function Footer() {
    const [email, setEmail] = useState('');

    const handleNewsletter = (e) => {
        e.preventDefault();
        if (!email.trim() || !email.includes('@')) {
            toast.error('Ingresa un correo valido');
            return;
        }
        toast.success('Gracias! Te avisaremos de nuestras novedades.');
        setEmail('');
    };

    return (
        <footer style={{ background: '#0c0f14', borderTop: '1px solid rgba(127,171,206,.14)', color: 'rgba(255,255,255,.65)', fontFamily: "'Outfit', sans-serif" }}>

            {/* Newsletter */}
            <div style={{ borderBottom: '1px solid rgba(127,171,206,.14)', background: 'linear-gradient(90deg, rgba(27,58,87,.25), rgba(59,123,171,.08))' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: '1rem', color: '#fff', marginBottom: 4 }}>Mantente al tanto de SSWAP</p>
                        <p style={{ fontSize: '.82rem', fontWeight: 300, color: 'rgba(255,255,255,.5)' }}>Promociones, mantenimiento estacional y novedades del taller.</p>
                    </div>
                    <form onSubmit={handleNewsletter} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="tu@correo.com"
                            style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 999, padding: '11px 18px', color: '#fff', fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none', minWidth: 220 }}
                        />
                        <button type="submit" style={{ background: 'linear-gradient(135deg, #1b3a57, #2b5c85 60%, #3b7bab)', border: 'none', borderRadius: 999, padding: '11px 22px', color: '#fff', fontFamily: "'Sora'", fontWeight: 600, fontSize: '.85rem', cursor: 'pointer' }}>
                            Suscribirme
                        </button>
                    </form>
                </div>
            </div>


            {/* Main footer */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40 }}>

                {/* Marca */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #1b3a57, #2b5c85 55%, #3b7bab)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px -4px rgba(43,92,133,.7)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: '1.05rem', letterSpacing: '.02em', color: '#fff', lineHeight: 1 }}>SSWAP</p>
                            <p style={{ fontWeight: 300, fontSize: '.65rem', color: 'rgba(255,255,255,.4)', lineHeight: 1.3 }}>Mecanica Automotriz</p>
                        </div>
                    </div>
                    <p style={{ fontWeight: 300, fontSize: '.85rem', lineHeight: 1.7, color: 'rgba(255,255,255,.5)', marginBottom: 20 }}>
                        Taller automotriz ubicado en Ponciano Alto, Quito. Mas de 10 anos brindando servicio tecnico de calidad con tecnologia de diagnostico avanzada.
                    </p>
                    {/* Horario */}
                    <div style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.4)' }}>
                        <p style={{ fontWeight: 600, color: 'rgba(255,255,255,.6)', marginBottom: 6 }}>Horario de Atencion</p>
                        <p>Lunes - Viernes: 8:00 - 18:00</p>
                        <p>Sabado: 8:00 - 14:00</p>
                        <p>Domingo: Cerrado</p>
                    </div>
                </div>

                {/* Servicios */}
                <div>
                    <p style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#7fabce', marginBottom: 16 }}>SERVICIOS</p>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {SERVICIOS.map(s => (
                            <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#7fabce', flexShrink: 0 }} />
                                <span style={{ fontSize: '.85rem', fontWeight: 300 }}>{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Links rapidos */}
                <div>
                    <p style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#7fabce', marginBottom: 16 }}>NAVEGACION</p>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {LINKS_RAPIDOS.map(l => (
                            <li key={l.to}>
                                <Link to={l.to} style={{ fontSize: '.85rem', fontWeight: 300, color: 'rgba(255,255,255,.55)', textDecoration: 'none', transition: 'color .2s' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#7fabce'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.55)'}>
                                    {l.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Contacto */}
                <div>
                    <p style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: '.68rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#7fabce', marginBottom: 16 }}>CONTACTO</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[
                            { icon: <IconPin />,   text: 'Ponciano Alto, Quito, Ecuador', href: 'https://www.google.com/maps/search/?api=1&query=Ponciano+Alto+Quito+Ecuador' },
                            { icon: <IconPhone />, text: '+593 99 XXX XXXX', href: 'tel:+59399XXXXXXX' },
                            { icon: <IconMail />,  text: 'contacto@sswap.com', href: 'mailto:contacto@sswap.com' },
                        ].map((item, i) => (
                            <a key={i} href={item.href} target={item.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                               style={{ display: 'flex', alignItems: 'flex-start', gap: 10, textDecoration: 'none', color: 'inherit', transition: 'color .2s' }}
                               onMouseEnter={e => e.currentTarget.style.color = '#7fabce'}
                               onMouseLeave={e => e.currentTarget.style.color = 'inherit'}>
                                <span style={{ color: '#7fabce', flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                                <span style={{ fontSize: '.85rem', fontWeight: 300, lineHeight: 1.5 }}>{item.text}</span>
                            </a>
                        ))}
                    </div>

                    {/* Redes sociales */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                        {[
                            { icon: <IconFacebook />, href: 'https://facebook.com', label: 'Facebook' },
                            { icon: <IconInstagram />, href: 'https://instagram.com', label: 'Instagram' },
                            { icon: <IconWhatsapp />, href: 'https://wa.me/593999999999', label: 'WhatsApp' },
                        ].map((s, i) => (
                            <a key={i} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}
                               style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.14)', color: 'rgba(255,255,255,.65)', transition: 'all .2s' }}
                               onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b7bab'; e.currentTarget.style.color = '#7fabce'; e.currentTarget.style.background = 'rgba(59,123,171,.1)'; }}
                               onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.14)'; e.currentTarget.style.color = 'rgba(255,255,255,.65)'; e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}>
                                {s.icon}
                            </a>
                        ))}
                    </div>

                    {/* CTA */}
                    <Link to="/auth?modo=registro" style={{ display: 'inline-block', marginTop: 24, padding: '11px 24px', background: 'linear-gradient(135deg, #1b3a57, #2b5c85 60%, #3b7bab)', color: '#fff', fontFamily: "'Sora'", fontWeight: 600, fontSize: '.85rem', borderRadius: 8, textDecoration: 'none', transition: 'all .2s', boxShadow: '0 6px 18px -8px rgba(43,92,133,.6)' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 24px -8px rgba(43,92,133,.75)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 18px -8px rgba(43,92,133,.6)'; }}>
                        Crear cuenta gratis
                    </Link>
                </div>
            </div>

            {/* Bottom bar */}
            <div style={{ borderTop: '1px solid rgba(127,171,206,.14)', padding: '18px 24px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <p style={{ fontSize: '.78rem', fontWeight: 300, color: 'rgba(255,255,255,.3)' }}>
                        &copy; {new Date().getFullYear()} Mecanica Automotriz SSWAP. Todos los derechos reservados.
                    </p>
                    <p style={{ fontSize: '.78rem', fontWeight: 300, color: 'rgba(255,255,255,.25)' }}>
                        Sistema desarrollado por Banda J, Sarango R, Vela D · PUCE TEC 2026
                    </p>
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
