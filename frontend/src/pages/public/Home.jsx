import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';

const SERVICIOS = [
    {
        titulo: 'Mantenimiento Preventivo',
        desc:   'Cambio de aceite, filtros, bujias y revision general de fluidos para mantener tu vehiculo en optimas condiciones.',
        icon:   <IconWrench />,
    },
    {
        titulo: 'Frenos y Suspension',
        desc:   'Revision, ajuste y reemplazo de pastillas, discos, amortiguadores y rotulas para garantizar tu seguridad.',
        icon:   <IconShield />,
    },
    {
        titulo: 'Diagnostico Computarizado',
        desc:   'Lecturas de codigos de falla con equipo de diagnostico moderno. Identificamos el problema sin suposiciones.',
        icon:   <IconCpu />,
    },
    {
        titulo: 'Sistema Electrico',
        desc:   'Revision de bateria, alternador, arranque, cableado y sensores. Solucionamos fallas electricas complejas.',
        icon:   <IconZap />,
    },
    {
        titulo: 'Alineacion y Balanceo',
        desc:   'Alineacion laser de precision y balanceo de ruedas para prolongar la vida de tus neumaticos.',
        icon:   <IconTarget />,
    },
    {
        titulo: 'Correccion de Carroceria',
        desc:   'Enderezada, masilla y pintura. Devolvemos el aspecto original a tu vehiculo con acabados de calidad.',
        icon:   <IconTool />,
    },
];

const STATS = [
    { valor: '10+',  label: 'Anos de experiencia' },
    { valor: '80+',  label: 'Vehiculos al mes'     },
    { valor: '100%', label: 'Clientes satisfechos' },
    { valor: '24h',  label: 'Diagnostico rapido'   },
];

export default function Home() {
    return (
        <div style={{ background: '#0d0d0d', minHeight: '100vh' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #0d0d0d; }
                .hero-btn-gold { display: inline-flex; align-items: center; gap: 8px; font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .95rem; color: #0d0d0d; background: #c9a227; border: none; border-radius: 6px; padding: 14px 28px; cursor: pointer; text-decoration: none; transition: background .2s, transform .2s; }
                .hero-btn-gold:hover { background: #e0b830; transform: translateY(-1px); }
                .hero-btn-outline { display: inline-flex; align-items: center; gap: 8px; font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .95rem; color: #fff; background: none; border: 1.5px solid rgba(255,255,255,.35); border-radius: 6px; padding: 13px 28px; cursor: pointer; text-decoration: none; transition: border-color .2s, color .2s; }
                .hero-btn-outline:hover { border-color: #c9a227; color: #c9a227; }
                .service-card { background: #141414; border: 1px solid rgba(255,255,255,.07); border-radius: 10px; padding: 28px 24px; transition: border-color .25s, transform .25s; }
                .service-card:hover { border-color: rgba(201,162,39,.4); transform: translateY(-3px); }
                .cta-btn { display: inline-flex; align-items: center; gap: 8px; font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .9rem; color: #0d0d0d; background: #c9a227; border: none; border-radius: 6px; padding: 12px 26px; cursor: pointer; text-decoration: none; transition: background .2s; }
                .cta-btn:hover { background: #e0b830; }
            `}</style>

            <Navbar />

            {/* ── HERO ── */}
            <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                {/* Fondo con overlay */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a0a0a 0%, #111118 50%, #0a0a0a 100%)' }} />
                <div style={{ position: 'absolute', top: 0, right: 0, width: '55%', height: '100%', background: 'linear-gradient(135deg, transparent 0%, rgba(201,162,39,0.04) 100%)', borderLeft: '1px solid rgba(201,162,39,0.06)' }} />

                {/* Lineas decorativas */}
                <div style={{ position: 'absolute', top: '20%', right: '10%', width: 1, height: '40%', background: 'linear-gradient(to bottom, transparent, rgba(201,162,39,.15), transparent)' }} />
                <div style={{ position: 'absolute', bottom: '15%', left: '5%', width: '30%', height: 1, background: 'linear-gradient(to right, transparent, rgba(201,162,39,.1), transparent)' }} />

                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px 80px', position: 'relative', zIndex: 1, width: '100%' }}>
                    <div style={{ maxWidth: 680 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.35em', color: '#c9a227', marginBottom: 16 }}>
                            MECANICA AUTOMOTRIZ · PONCIANO ALTO · QUITO
                        </p>
                        <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(3.5rem, 8vw, 6rem)', letterSpacing: '.04em', color: '#fff', lineHeight: .95, marginBottom: 24 }}>
                            TU VEHICULO<br />
                            <span style={{ color: '#c9a227' }}>EN MANOS</span><br />
                            EXPERTAS
                        </h1>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: 'clamp(.9rem, 2vw, 1.05rem)', color: 'rgba(255,255,255,.6)', lineHeight: 1.75, marginBottom: 36, maxWidth: 520 }}>
                            Taller automotriz especializado con mas de 10 anos de experiencia en Quito. Diagnostico computarizado, repuestos genuinos y tecnicas certificadas para todo tipo de vehiculo.
                        </p>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            <Link to="/servicios" className="hero-btn-gold">Agendar Servicio</Link>
                            <Link to="/nosotros"  className="hero-btn-outline">Conocer Mas</Link>
                        </div>
                    </div>

                    {/* Stats inline */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginTop: 80, maxWidth: 640, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 40 }}>
                        {STATS.map((s, i) => (
                            <div key={i} style={{ paddingRight: 24, borderRight: i < 3 ? '1px solid rgba(255,255,255,.08)' : 'none', paddingLeft: i > 0 ? 24 : 0 }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2rem', letterSpacing: '.04em', color: '#c9a227', lineHeight: 1 }}>{s.valor}</p>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.75rem', color: 'rgba(255,255,255,.45)', marginTop: 4, lineHeight: 1.4 }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── BANNER RAPIDO ── */}
            <div style={{ background: '#c9a227', padding: '18px 24px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.9rem', color: '#0d0d0d' }}>
                        Atencion Lunes a Viernes 8:00 - 18:00 | Sabados 8:00 - 14:00 | Ponciano Alto, Quito
                    </p>
                    <Link to="/servicios" style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.85rem', color: '#0d0d0d', textDecoration: 'none', borderBottom: '1px solid rgba(0,0,0,.3)' }}>
                        Agenda tu cita ahora
                    </Link>
                </div>
            </div>

            {/* ── SERVICIOS ── */}
            <section style={{ padding: '100px 24px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 60 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.3em', color: '#c9a227', marginBottom: 12 }}>LO QUE HACEMOS</p>
                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '.05em', color: '#fff', marginBottom: 16 }}>
                        Nuestros Servicios
                    </h2>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.95rem', color: 'rgba(255,255,255,.5)', maxWidth: 560, margin: '0 auto' }}>
                        Contamos con equipamiento moderno y tecnicos certificados para brindar el mejor servicio a tu vehiculo.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                    {SERVICIOS.map((s, i) => (
                        <div key={i} className="service-card">
                            <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(201,162,39,.1)', border: '1px solid rgba(201,162,39,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a227', marginBottom: 18 }}>
                                {s.icon}
                            </div>
                            <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.05em', color: '#fff', marginBottom: 10 }}>{s.titulo}</h3>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.7 }}>{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── POR QUE ELEGIRNOS ── */}
            <section style={{ background: '#111', borderTop: '1px solid rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '100px 24px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.3em', color: '#c9a227', marginBottom: 12 }}>POR QUE ELEGIRNOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 3vw, 2.8rem)', letterSpacing: '.05em', color: '#fff', lineHeight: 1.05, marginBottom: 24 }}>
                            Servicio Tecnico con Estandares Profesionales
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.95rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.8, marginBottom: 36 }}>
                            En SSWAP trabajamos con repuestos de calidad, herramientas certificadas y un equipo tecnico en constante capacitacion. Tu seguridad y la de tu familia es nuestra prioridad.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {[
                                'Diagnostico computarizado incluido en cada revision',
                                'Repuestos originales o equivalentes certificados',
                                'Garantia en mano de obra y materiales',
                                'Historial digital de tu vehiculo en el sistema',
                                'Transparencia total en presupuestos antes de iniciar',
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(201,162,39,.15)', border: '1px solid rgba(201,162,39,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.88rem', color: 'rgba(255,255,255,.65)', lineHeight: 1.6 }}>{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Datos visuales */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {[
                            { val: '10+',  lab: 'Anos en el mercado automotriz de Quito',    color: '#c9a227' },
                            { val: '80+',  lab: 'Vehiculos atendidos mensualmente',           color: '#fff'    },
                            { val: '1000+',lab: 'Clientes en nuestra base de datos',          color: '#c9a227' },
                            { val: '100%', lab: 'Diagnostico con equipo computarizado',       color: '#fff'    },
                        ].map((item, i) => (
                            <div key={i} style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '28px 20px' }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.5rem', letterSpacing: '.04em', color: item.color, lineHeight: 1 }}>{item.val}</p>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.78rem', color: 'rgba(255,255,255,.45)', marginTop: 8, lineHeight: 1.5 }}>{item.lab}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA REGISTRO ── */}
            <section style={{ padding: '100px 24px', maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.3em', color: '#c9a227', marginBottom: 16 }}>PORTAL DE CLIENTES</p>
                <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '.05em', color: '#fff', marginBottom: 16 }}>
                    Accede al Seguimiento de tu Vehiculo
                </h2>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.95rem', color: 'rgba(255,255,255,.5)', maxWidth: 520, margin: '0 auto 36px' }}>
                    Crea tu cuenta gratuita para consultar el estado de tu reparacion, ver el historial de servicios y agendar citas en linea.
                </p>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link to="/auth?modo=registro" className="cta-btn">Crear Cuenta Gratis</Link>
                    <Link to="/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.9rem', color: 'rgba(255,255,255,.6)', textDecoration: 'none', padding: '12px 26px', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6, transition: 'all .2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,162,39,.4)'; e.currentTarget.style.color = '#c9a227'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'; e.currentTarget.style.color = 'rgba(255,255,255,.6)'; }}>
                        Ya tengo cuenta
                    </Link>
                </div>
            </section>

            <Footer />
        </div>
    );
}

function IconWrench() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }
function IconShield() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function IconCpu()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>; }
function IconZap()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function IconTarget() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
function IconTool()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }
