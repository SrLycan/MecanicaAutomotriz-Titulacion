/**
 * SS SWAP - Catálogo Público de Servicios Mecánicos
 * Lista servicios activos con precios referenciales y duraciones estimadas,
 * búsqueda instantánea y acceso directo a la reserva de citas en línea.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AgendarCitaModal from '../../components/public/AgendarCitaModal';
import { resolveImagenSrc } from '../../utils/imagen';
import mascotaImg from '../../assets/swapbot-mascot.png';
import './Servicios.css';

const GOLD = '#3b7bab';

const ICONOS = [
    { match: /aceite|mantenimiento|preventiv/i, icon: IconWrench, color: '#3b7bab' },
    { match: /freno|suspension|amortigu/i,       icon: IconShield, color: '#4a83b3' },
    { match: /diagnostic|computariz|escaner/i,   icon: IconCpu,    color: '#6f8ba3' },
    { match: /electric|bateria|alternador/i,      icon: IconZap,    color: '#57708a' },
    { match: /aliniac|alineac|balanceo/i,         icon: IconTarget, color: '#7fabce' },
    { match: /pintura|carroceria|latoneria/i,     icon: IconTool,   color: '#3a4149' },
];
function iconoPara(nombre = '') {
    const found = ICONOS.find(i => i.match.test(nombre));
    return found || { icon: IconWrench, color: GOLD };
}

export default function Servicios() {
    const { usuario } = useAuth();
    const [servicios, setServicios] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(null);
    const [q, setQ]                 = useState('');
    const [servicioAgendando, setServicioAgendando] = useState(null);

    useEffect(() => {
        api.get('/servicios', { params: { activo: 'true' } })
            .then(r => setServicios(r.data.servicios || []))
            .catch(() => setError('No se pudieron cargar los servicios en este momento.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const els = document.querySelectorAll('.reveal');
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
        }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
        els.forEach(el => io.observe(el));
        return () => io.disconnect();
    }, [servicios]);

    // "Como funciona": despliegue progresivo y reversible ligado al scroll (no a un trigger de una sola vez)
    useEffect(() => {
        let raf = null;

        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

        const actualizar = () => {
            raf = null;
            const cards = document.querySelectorAll('.hiw-card');
            if (!cards.length) return;

            const vh = window.innerHeight;
            const startZone = vh * 0.8;    // el progreso empieza justo cuando la tarjeta asoma por abajo (fin del bloque anterior)
            const endZone   = vh * 0.65;   // el progreso llega a 1 mas arriba, para que se note el recorrido completo

            let suma = 0;
            cards.forEach((card, i) => {
                const rect = card.getBoundingClientRect();
                // desfase por indice para que se desplieguen en cascada de izquierda a derecha
                // (se SUMA para que las tarjetas siguientes necesiten mas scroll, no menos)
                const top = rect.top + i * 55;
                const p = clamp((startZone - top) / (startZone - endZone), 0, 1);
                card.style.setProperty('--p', p.toFixed(3));
                suma += p;
            });

            const connector = document.querySelector('.hiw-connector');
            if (connector) connector.style.setProperty('--p', (suma / cards.length).toFixed(3));
        };

        const onScroll = () => { if (raf === null) raf = requestAnimationFrame(actualizar); };

        actualizar();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (raf !== null) cancelAnimationFrame(raf);
        };
    }, []);

    const filtrados = useMemo(() => {
        if (!q.trim()) return servicios;
        const term = q.toLowerCase();
        return servicios.filter(s => s.nombre?.toLowerCase().includes(term) || s.descripcion?.toLowerCase().includes(term));
    }, [servicios, q]);

    const ctaHref = usuario ? (usuario.rol === 'cliente' ? '/mi-panel' : '/dashboard') : '/auth?modo=registro';

    return (
        <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>
            <Navbar />

            {/* HERO */}
            <section className="sv-hero-pad" style={{ padding: '150px 28px 70px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top left, #0d1a24 0%, #0a0a0a 45%, #050505 100%)' }} />
                <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
                    <div className="sv-fade" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(59,123,171,.08)', border: '1px solid rgba(59,123,171,.25)', marginBottom: 22 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD }} />
                        <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.2em', color: GOLD, fontWeight: 500 }}>CATALOGO DE SERVICIOS</p>
                    </div>
                    <h1 className="sv-fade" style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.6rem, 6vw, 4.6rem)', letterSpacing: '.02em', lineHeight: 1, marginBottom: 20, animationDelay: '.05s' }}>
                        <span className="grad-text-rainbow">Servicios</span><span className="grad-text-white"> pensados </span>
                        <span className="grad-text-rainbow">para tu vehículo.</span>
                    </h1>
                    <p className="sv-fade" style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: 'clamp(.95rem,1.6vw,1.08rem)', color: 'rgba(255,255,255,.6)', maxWidth: 620, margin: '0 auto 34px', lineHeight: 1.75, animationDelay: '.1s' }}>
                        Consulta precios referenciales y tiempos estimados. Crea una cuenta para agendar tu cita y dar seguimiento en línea al estado de tu vehículo.
                    </p>
                </div>
            </section>

            {/* GRID DE SERVICIOS */}
            <section className="sv-pad" style={{ padding: '20px 28px 100px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    {loading && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 20 }}>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} style={{ height: 210, borderRadius: 18, background: 'linear-gradient(90deg, #111 0%, #161616 50%, #111 100%)', backgroundSize: '200% 100%', animation: 'svShimmer 1.4s ease-in-out infinite' }} />
                            ))}
                        </div>
                    )}

                    {!loading && error && (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <p style={{ fontFamily: "'Outfit'", color: 'rgba(255,255,255,.5)' }}>{error}</p>
                        </div>
                    )}

                    {!loading && !error && filtrados.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '80px 0' }}>
                            <p style={{ fontFamily: "'Outfit'", color: 'rgba(255,255,255,.4)', fontSize: '.95rem' }}>
                                {servicios.length === 0 ? 'Aún no hay servicios publicados.' : 'No encontramos servicios que coincidan con tu búsqueda.'}
                            </p>
                        </div>
                    )}

                    {!loading && !error && filtrados.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 20 }}>
                            {filtrados.map((s, i) => {
                                const { icon: Icon, color } = iconoPara(s.nombre);
                                return (
                                    <div key={s.id} className="sv-card reveal" style={{ transitionDelay: `${(i % 6) * 60}ms` }}>
                                        <div className="sv-photo">
                                            {s.imagen_url ? (
                                                <img src={resolveImagenSrc(s.imagen_url)} alt={s.nombre} loading="lazy" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.classList.add('sv-photo-fallback'); }} />
                                            ) : (
                                                <div className="sv-photo-fallback" style={{ color }}>
                                                    <Icon />
                                                </div>
                                            )}
                                        </div>
                                        <div className="sv-card-body">
                                        <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', letterSpacing: '.03em', color: '#fff', marginBottom: 8, lineHeight: 1.15 }}>{s.nombre}</h3>
                                        {s.descripcion && (
                                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.87rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.65, marginBottom: 20, minHeight: 44 }}>
                                                {s.descripcion}
                                            </p>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                                            <div>
                                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', color, lineHeight: 1 }}>
                                                    {Number(s.precio_base) > 0 ? `Desde $${parseFloat(s.precio_base).toFixed(2)}` : 'Cotizar'}
                                                </p>
                                                {s.duracion_estimada_min ? (
                                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: 'rgba(255,255,255,.4)', marginTop: 3 }}>
                                                        ~ {formatearDuracion(s.duracion_estimada_min)}
                                                    </p>
                                                ) : (
                                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: 'rgba(255,255,255,.4)', marginTop: 3 }}>Precio referencial</p>
                                                )}
                                            </div>
                                            {usuario?.rol === 'cliente' ? (
                                                <button onClick={() => setServicioAgendando(s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.8rem', color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                                    Agendar
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                                </button>
                                            ) : (
                                                <Link to={ctaHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.8rem', color, textDecoration: 'none' }}>
                                                    Agendar
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                                </Link>
                                            )}
                                        </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* COMO FUNCIONA */}
            <section className="sv-pad" style={{ padding: '90px 28px', background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)', borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 60 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// COMO FUNCIONA</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">De la </span><span className="grad-text-rainbow">cita</span><span className="grad-text-white"> a la entrega, </span>
                            <span className="grad-text-rainbow">sin sorpresas.</span>
                        </h2>
                    </div>
                    <div className="hiw-track">
                        <div className="hiw-connector">
                            <div className="hiw-connector-line" />
                            <div className="hiw-connector-fill" />
                        </div>
                        <div className="sv-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, position: 'relative' }}>
                            {[
                                { n: '01', t: 'Agenda tu cita', d: 'Crea tu cuenta y solicita el servicio que necesitas.', tag: 'Solo 2 minutos', icon: <IconCalendar /> },
                                { n: '02', t: 'Diagnóstico',    d: 'Revisamos tu vehículo con equipo computarizado.',     tag: 'Escáner OBD2',   icon: <IconSearchScan /> },
                                { n: '03', t: 'Reparación',     d: 'Técnicos certificados trabajan con repuestos garantizados.', tag: 'Garantía incluida', icon: <IconWrench /> },
                                { n: '04', t: 'Entrega',        d: 'Retiras tu vehículo y consultas el historial en tu panel.', tag: 'Seguimiento en línea', icon: <IconCheckCircle /> },
                            ].map((s, i) => (
                                <div key={s.n} className="hiw-card" data-hiw-index={i}>
                                    <div className="hiw-icon-ring">
                                        {s.icon}
                                        <span className="hiw-num">{s.n}</span>
                                    </div>
                                    <h3 className="hiw-title">{s.t}</h3>
                                    <p className="hiw-desc">{s.d}</p>
                                    <span className="hiw-tag">{s.tag}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="sv-pad" style={{ padding: '100px 28px' }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div className="reveal in-view" style={{
                        position: 'relative', overflow: 'hidden',
                        backgroundImage: `linear-gradient(135deg, rgba(13,26,36,.9) 0%, rgba(10,10,10,.88) 50%, rgba(6,20,28,.92) 100%), url(${mascotaImg})`,
                        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                        border: '1px solid rgba(59,123,171,.22)', borderRadius: 24,
                        padding: 'clamp(40px, 7vw, 70px) clamp(28px, 5vw, 56px)', textAlign: 'center',
                    }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 16, fontWeight: 500 }}>// LISTO CUANDO TU LO ESTES</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em', marginBottom: 18, lineHeight: 1.05 }}>
                            <span className="grad-text-white">¿No sabes </span><span className="grad-text-rainbow">qué servicio necesitas?</span>
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.58)', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
                            Chatea con nuestro ChatBot y te ayudaremos a identificar el servicio que tu vehículo necesita. Luego podrás agendar tu cita en línea y dar seguimiento al estado de tu vehículo desde tu panel.
                        </p>
                        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => window.dispatchEvent(new Event('swapbot:abrir'))} className="ps-btn-primary" style={{ border: 'none', cursor: 'pointer' }}>
                                Chatear con SWAPbot
                            </button>
                            <Link to="/nosotros" className="ps-btn-outline">Conocer el taller</Link>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />

            {servicioAgendando && (
                <AgendarCitaModal servicio={servicioAgendando} onClose={() => setServicioAgendando(null)} />
            )}
        </div>
    );
}

function formatearDuracion(min) {
    const m = Number(min);
    if (!m) return '';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
}

function IconWrench() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }
function IconShield() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function IconCalendar()   { return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function IconSearchScan() { return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>; }
function IconCheckCircle(){ return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>; }
function IconCpu()    { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>; }
function IconZap()    { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function IconTarget() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
function IconTool()   { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }