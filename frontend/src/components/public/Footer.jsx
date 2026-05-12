import React from 'react';
import { Link } from 'react-router-dom';

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
    return (
        <footer style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,.06)', color: 'rgba(255,255,255,.65)', fontFamily: "'Outfit', sans-serif" }}>

            {/* Main footer */}
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40 }}>

                {/* Marca */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 36, height: 36, background: '#c9a227', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', letterSpacing: '.1em', color: '#fff', lineHeight: 1 }}>SSWAP</p>
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
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.2em', color: '#c9a227', marginBottom: 16 }}>SERVICIOS</p>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {SERVICIOS.map(s => (
                            <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#c9a227', flexShrink: 0 }} />
                                <span style={{ fontSize: '.85rem', fontWeight: 300 }}>{s}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Links rapidos */}
                <div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.2em', color: '#c9a227', marginBottom: 16 }}>NAVEGACION</p>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {LINKS_RAPIDOS.map(l => (
                            <li key={l.to}>
                                <Link to={l.to} style={{ fontSize: '.85rem', fontWeight: 300, color: 'rgba(255,255,255,.55)', textDecoration: 'none', transition: 'color .2s' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#c9a227'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.55)'}>
                                    {l.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Contacto */}
                <div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.2em', color: '#c9a227', marginBottom: 16 }}>CONTACTO</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[
                            { icon: <IconPin />,   text: 'Ponciano Alto, Quito, Ecuador' },
                            { icon: <IconPhone />, text: '+593 99 XXX XXXX' },
                            { icon: <IconMail />,  text: 'contacto@sswap.com' },
                        ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <span style={{ color: '#c9a227', flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                                <span style={{ fontSize: '.85rem', fontWeight: 300, lineHeight: 1.5 }}>{item.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <Link to="/auth?modo=registro" style={{ display: 'inline-block', marginTop: 24, padding: '10px 22px', background: '#c9a227', color: '#0d0d0d', fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.85rem', borderRadius: 6, textDecoration: 'none', transition: 'background .2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#e0b830'}
                        onMouseLeave={e => e.currentTarget.style.background = '#c9a227'}>
                        Crear cuenta gratis
                    </Link>
                </div>
            </div>

            {/* Bottom bar */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '18px 24px' }}>
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
