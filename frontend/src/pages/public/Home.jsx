/**
 * SS SWAP - Página de Inicio Institucional (Home)
 * Presenta la propuesta de valor del taller: video hero en vivo, servicios destacados,
 * reparación de colisiones, especialidades mecánicas, testimonios e integración de mapa.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import api from '../../services/api';
import { resolveImagenSrc } from '../../utils/imagen';
import colisionesImg from "../../assets/colisiones.png";
import bannerGrandeImg from "../../assets/bannergrande.png";
import './Home.css';
// MODIFICAR DIRECCIÓN AQUÍ: URL de embed de Google Maps para la sección de ubicaciones.
// Se genera desde Google Maps → Compartir → Insertar un mapa → copiar el "src" del iframe.
const MAPA_EMBED_SRC = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d953.2894989157679!2d-78.37253773829565!3d-0.21855914339467258!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91d5931de96a4297%3A0x456635055317eed8!2sInsignia%20Automotriz!5e1!3m2!1sen!2sec!4v1784479118759!5m2!1sen!2sec";

const STATS = [
    { valor: '30 min',   label: 'Respuesta por WhatsApp' },
    { valor: '5%',   label: 'Retrabajos(Máximo)' },
    { valor: '100%', label: 'Garantía por escrito' },
    { valor: '24/7',   label: 'Atención y servicio' },
];

// Las especialidades salen del catalogo de servicios (GET /api/servicios):
// al crear/editar/desactivar un servicio en el panel, el inicio se actualiza solo.
// Si el servicio no tiene imagen propia se usa una foto generica segun su nombre.
const COLORES_ESP = ['#3b7bab', '#4a83b3', '#6f8ba3', '#57708a', '#7fabce'];
const FOTOS_ESP = [
    { match: /motor|distribuc|correa/i,                  img: '/servicios/motor.png' },
    { match: /freno|disco|pastilla/i,                    img: '/servicios/frenos.png' },
    { match: /diagn|escaner|computari|obd/i,             img: '/servicios/diagnostico.png' },
    { match: /colisi|pintura|carrocer|latoner|enderez/i, img: '/servicios/colisiones.png' },
    { match: /aceite|lubric|filtro|mantenimiento/i,      img: '/servicios/aceite.png' },
    { match: /suspens|amortigu|rotula/i,                 img: '/servicios/suspension.png' },
    { match: /electr|bater|alternador|arranque/i,        img: '/servicios/electronica.png' },
    { match: /alinea|balanceo|neum|llanta/i,             img: '/servicios/alineacion.png' },
];
const fotoServicio = (s) => s.imagen_url
    ? resolveImagenSrc(s.imagen_url)
    : (FOTOS_ESP.find(f => f.match.test(s.nombre || ''))?.img || '');


export default function Home() {
    const [sucursales, setSucursales] = useState([]);
    const [servicios, setServicios]   = useState([]);
    const carruselRef = useRef(null);
    const [flechas, setFlechas] = useState({ izq: false, der: false });
    useEffect(() => {
        api.get('/sucursales/public').then(r => setSucursales(r.data.sucursales || [])).catch(() => {});
        api.get('/servicios', { params: { activo: 'true' } }).then(r => setServicios(r.data.servicios || [])).catch(() => {});
    }, []);

    // Habilita/deshabilita las flechas segun la posicion del carrusel.
    const actualizarFlechas = useCallback(() => {
        const el = carruselRef.current;
        if (!el) return;
        setFlechas({ izq: el.scrollLeft > 4, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    }, []);
    useEffect(() => {
        actualizarFlechas();
        window.addEventListener('resize', actualizarFlechas);
        return () => window.removeEventListener('resize', actualizarFlechas);
    }, [servicios, actualizarFlechas]);

    // Desplaza el carrusel casi el ancho visible (una "pagina" de tarjetas).
    const moverCarrusel = (dir) => {
        const el = carruselRef.current;
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
    };

    useEffect(() => {
        const els = document.querySelectorAll('.reveal');
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('in-view');
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
        els.forEach(el => io.observe(el));
        return () => io.disconnect();
    }, [sucursales, servicios]);

    return (
        <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>

            <Navbar />

            {/* ════════════════════════════════════════════════════════
                HERO — estilo PlayStation: gradiente dramático + auto 3D
            ════════════════════════════════════════════════════════ */}
            <section style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                <Particles count={20} />
                {/* Fondo dramático */}
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top right, #1a1408 0%, #0a0a0a 45%, #050505 100%)' }} />
                <div className="grid-pattern" style={{ position: 'absolute', inset: 0, opacity: .5, maskImage: 'radial-gradient(ellipse 80% 50% at 50% 40%, black, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 40%, black, transparent 75%)' }} />

                {/* Orbes flotantes */}
                <div className="glow-orb" style={{ top: '15%', right: '10%', width: 380, height: 380, background: 'radial-gradient(closest-side, rgba(59,123,171,.35), transparent)', animation: 'pubOrb 8s ease-in-out infinite' }} />
                <div className="glow-orb" style={{ bottom: '10%', left: '5%', width: 320, height: 320, background: 'radial-gradient(closest-side, rgba(74,131,179,.18), transparent)', animation: 'pubOrb 9s ease-in-out infinite 2s' }} />

                {/* Líneas decorativas verticales */}
                <div style={{ position: 'absolute', top: '8%', right: '8%', width: 1, height: '50%', background: 'linear-gradient(to bottom, transparent, rgba(59,123,171,.3), transparent)' }} />
                <div style={{ position: 'absolute', top: '20%', right: '12%', width: 1, height: '35%', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,.1), transparent)' }} />

                <div className="hero-section-pad" style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1, width: '100%' }}>
                    <div className="hero-grid">
                        {/* Izquierda: copy */}
                        <div className="pub-section">
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(59,123,171,.08)', border: '1px solid rgba(59,123,171,.25)', marginBottom: 24, backdropFilter: 'blur(8px)' }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b7bab', boxShadow: '0 0 10px #3b7bab', animation: 'pubPulse 2s ease-in-out infinite' }} />
                                <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.2em', color: '#3b7bab', fontWeight: 500 }}>PONCIANO ALTO · QUITO · EC</p>
                            </div>

                            <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(3.2rem, 7.5vw, 6.2rem)', letterSpacing: '.02em', lineHeight: .92, marginBottom: 22 }}>
                                <span className="grad-text-rainbow">RESTAURAMOS</span><span className="grad-text-white"> VEHÍCULOS</span><br />
                                <span className="grad-text-rainbow">REFORZAMOS</span><br />
                                <span className="grad-text-white">CONFIANZA.</span>
                            </h1>

                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: 'clamp(.95rem, 1.6vw, 1.1rem)', color: 'rgba(255,255,255,.62)', lineHeight: 1.75, marginBottom: 36, maxWidth: 540 }}>
                                Taller automotriz especializado con más de <strong style={{ color: '#fff', fontWeight: 600 }}>10 años de experiencia</strong>. Diagnóstico computarizado, repuestos certificados y técnicos en constante capacitación.
                            </p>

                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                <Link to="/servicios" className="ps-btn-primary">
                                    Agendar Servicio
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </Link>
                                <Link to="/nosotros" className="ps-btn-outline">
                                    Conocer Más
                                </Link>
                            </div>

                            {/* Mini chips */}
                            <div style={{ display: 'flex', gap: 10, marginTop: 36, flexWrap: 'wrap' }}>
                                {['Diagnóstico OBD2', 'Repuestos OEM', 'Garantía escrita'].map(t => (
                                    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', fontFamily: "'Outfit'", fontSize: '.78rem', color: 'rgba(255,255,255,.75)' }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3b7bab" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Derecha: video hero */}
                        <div className="pub-section hero-media reveal in-view" style={{ position: 'relative' }}>
                            <div className="hero-video-frame">
                                <video
                                    className="hero-video"
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    poster="https://images.pexels.com/videos/14514792/pexels-photo-14514792.jpeg?auto=compress&cs=tinysrgb&h=900&fit=crop&w=1200"
                                >
                                    <source src="https://videos.pexels.com/video-files/14514792/14514792-uhd_2560_1440_25fps.mp4" type="video/mp4" />
                                </video>
                                <div className="hero-video-overlay" />
                                <div className="hero-video-scan" />

                                {/* Badge flotante superior (glass) */}
                                <div className="hero-glass-badge hero-glass-badge--top">
                                    <span className="hero-glass-dot" />
                                    <div>
                                        <p className="hero-glass-badge-title">Diagnóstico en Tiempo Real</p>
                                        <p className="hero-glass-badge-sub">Equipo OBD2 certificado</p>
                                    </div>
                                </div>

                                {/* Badge flotante inferior (glass) */}
                                <div className="hero-glass-badge hero-glass-badge--bottom">
                                    <div className="hero-glass-icon">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                                    </div>
                                    <div>
                                        <p className="hero-glass-badge-title">Técnicos certificados</p>
                                    </div>
                                </div>
                            </div>
                            {/* Halo decorativo detrás del panel */}
                            <div className="hero-video-halo" />
                        </div>
                    </div>

                    {/* Badges de confianza */}
                    <div className="hero-trust-bar reveal in-view">
                        {[
                            { icon: <IconAward />, k: '10+ años', v: 'de experiencia' },
                            { icon: <IconShieldCheck />, k: 'Técnicos', v: 'certificados' },
                            { icon: <IconPackage />, k: 'Repuestos', v: 'garantizados' },
                            { icon: <IconGauge />, k: 'Equipos', v: 'última generación' },
                        ].map((b, i) => (
                            <div key={i} className="hero-trust-item">
                                <div className="hero-trust-icon">{b.icon}</div>
                                <div>
                                    <p className="hero-trust-k">{b.k}</p>
                                    <p className="hero-trust-v">{b.v}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Stats inline */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 0, marginTop: 44, maxWidth: 920, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 36 }}>
                        {STATS.map((s, i) => (
                            <div key={i} style={{ padding: '0 28px', borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
                                <p className="stat-num grad-text-gold" style={{ fontSize: '2.4rem', lineHeight: 1 }}>{s.valor}</p>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.78rem', color: 'rgba(255,255,255,.48)', marginTop: 6, lineHeight: 1.4 }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                BANNER — info rápida
            ════════════════════════════════════════════════════════ */}
            <div style={{ background: 'linear-gradient(90deg, #1b3a57 0%, #2b5c85 55%, #3b7bab 100%)', padding: '20px 28px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, opacity: .12, backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 12px, rgba(255,255,255,.35) 12px 14px)' }} />
                <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, position: 'relative' }}>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.92rem', color: '#fff' }}>
                        Lun-Vie 8:00 - 17:00 · Sab 8:00 - 13:00 · Ponciano Alto, Quito
                    </p>
                    <Link to="/servicios" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.88rem', color: '#fff', textDecoration: 'none', borderBottom: '2px solid rgba(255,255,255,.4)' }}>
                        Agenda tu cita ahora
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </Link>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                COLISIONES — servicio mas popular (spotlight)
            ════════════════════════════════════════════════════════ */}
            <section className="pub-section-pad reveal" style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
                <div className="glow-orb" style={{ top: '10%', right: '-8%', width: 420, height: 420, background: 'radial-gradient(closest-side, rgba(59,123,171,.16), transparent)', animation: 'pubOrb 11s ease-in-out infinite' }} />
                <div className="col-spotlight" style={{ position: 'relative' }}>
                    <div className="col-media reveal">
                        <div className="col-badge">
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
                            SERVICIO MÁS POPULAR
                        </div>
                            <img
                            src={colisionesImg}
                            alt="Reparación de colisiones y carrocería"
                            loading="lazy"
                            onError={e => { e.currentTarget.style.opacity = 0; }}
                            />

                        <div className="col-media-overlay" />
                    </div>

                    <div className="reveal" style={{ transitionDelay: '80ms' }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: '#3b7bab', marginBottom: 14, fontWeight: 500 }}>// COLISIONES</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)', letterSpacing: '.02em', marginBottom: 18, lineHeight: 1.05 }}>
                            <span className="grad-text-white">Tu auto, </span><span className="grad-text-rainbow">como si fuera NUEVO.</span>
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.6)', lineHeight: 1.75, marginBottom: 28, maxWidth: 480 }}>
                            Enderezada de carrocería, masilla y pintura con acabado de fábrica. Te entregamos un vehículo que luce y se conduce como nuevo.
                        </p>
                        <div style={{ marginBottom: 32 }}>
                            {[
                                { t: 'Evaluación sin costo', d: 'Inspeccionamos el daño y te damos un presupuesto claro.' },
                                { t: 'Pintura de fábrica', d: 'Cabina de pintura y mezcla exacta de color por computadora.' },
                                { t: 'Gestión con aseguradoras', d: 'Te ayudamos con el papeleo del siniestro paso a paso.' },
                            ].map((b, i) => (
                                <div key={i} className="col-benefit">
                                    <div className="col-benefit-icon"><IconCheckSmall /></div>
                                    <div>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.92rem', color: '#fff', marginBottom: 2 }}>{b.t}</p>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.6 }}>{b.d}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Link to="/servicios" className="ps-btn-primary"><span>Agenda ahora</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                ESPECIALIDADES — tarjetas con fotografías reales
            ════════════════════════════════════════════════════════ */}
            <section className="pub-section-pad" style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
                <div className="glow-orb" style={{ top: '20%', left: '-10%', width: 400, height: 400, background: 'radial-gradient(closest-side, rgba(74,131,179,.12), transparent)', animation: 'pubOrb 10s ease-in-out infinite' }} />

                <div style={{ textAlign: 'center', marginBottom: 60, position: 'relative' }}>
                    <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: '#3b7bab', marginBottom: 14, fontWeight: 500 }}>// ESPECIALIDADES</p>
                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.4rem, 5vw, 4rem)', letterSpacing: '.02em', marginBottom: 16, lineHeight: 1 }}>
                        <span className="grad-text-rainbow">Trabajamos</span><span className="grad-text-white"> cada pieza </span><span className="grad-text-rainbow">con precisión.</span>
                    </h2>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.55)', maxWidth: 580, margin: '0 auto', lineHeight: 1.7 }}>
                        Desde el motor hasta los frenos, cada componente recibe atención experta con herramientas certificadas.
                    </p>
                </div>

                {servicios.length === 0 ? (
                    <p style={{ textAlign: 'center', fontFamily: "'Outfit'", color: 'rgba(255,255,255,.45)' }}>Pronto publicaremos nuestros servicios.</p>
                ) : (
                    <div className="sp-carrusel">
                        <button type="button" className="sp-flecha sp-flecha-izq" aria-label="Servicios anteriores" disabled={!flechas.izq} onClick={() => moverCarrusel(-1)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <div className="sp-track" ref={carruselRef} onScroll={actualizarFlechas}>
                            {servicios.map((s, i) => {
                                const color = COLORES_ESP[i % COLORES_ESP.length];
                                const img = fotoServicio(s);
                                return (
                                    <div key={s.id} className="sp-card">
                                        {img && (
                                            <img
                                                className="sp-card-img"
                                                src={img}
                                                alt={s.nombre}
                                                loading="lazy"
                                                onError={e => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        )}
                                        <div className="sp-card-overlay" />
                                        <div className="sp-card-body">
                                            <h3 className="sp-card-title">{s.nombre}</h3>
                                            {s.descripcion && <p className="sp-card-desc">{s.descripcion}</p>}
                                            <Link to="/servicios" className="sp-card-more" style={{ color, textDecoration: 'none' }}>
                                                Ver mas
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button type="button" className="sp-flecha sp-flecha-der" aria-label="Servicios siguientes" disabled={!flechas.der} onClick={() => moverCarrusel(1)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                )}
            </section>

            {/* ════════════════════════════════════════════════════════
                POR QUE ELEGIRNOS — asimétrico estilo Spotify
            ════════════════════════════════════════════════════════ */}
            <section className="pub-section-pad" style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
                <div className="why-grid">
                    <div>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: '#3b7bab', marginBottom: 14, fontWeight: 500 }}>// POR QUÉ SS SWAP</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 3.6vw, 3.2rem)', letterSpacing: '.03em', lineHeight: 1.02, marginBottom: 24 }}>
                            <span className="grad-text-white">Servicio Técnico con<br/></span><span className="grad-text-rainbow">Estándares Profesionales.</span>
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.98rem', color: 'rgba(255,255,255,.55)', lineHeight: 1.85, marginBottom: 36 }}>
                            En SS SWAP combinamos experiencia humana con tecnología de punta. Cada vehículo que entra a nuestro taller recibe un diagnóstico riguroso y un trabajo con garantía escrita.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                'Diagnóstico computarizado en cada revisión',
                                'Repuestos originales o equivalentes certificados',
                                'Garantía en mano de obra y materiales',
                                'Historial digital de tu vehículo',
                                'Transparencia total en presupuestos',
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 12, borderRadius: 10, transition: 'background .2s' }}
                                     onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,123,171,.04)'}
                                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(59,123,171,.15)', border: '1px solid rgba(59,123,171,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3b7bab" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.92rem', color: 'rgba(255,255,255,.78)', lineHeight: 1.55 }}>{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Datos visuales con engranaje 3D */}
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-8%', right: '-8%', width: 220, height: 220, opacity: .25, animation: 'pubFloat 6s ease-in-out infinite' }}>
                            <Gear3D color="#3b7bab" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, position: 'relative' }}>
                            {[
                                { val: '30 MIN',  lab: 'Respuesta por WhatsApp',    color: '#3b7bab' },
                                { val: '5%',  lab: 'Retrabajos (Máximo)',      color: '#4a83b3' },
                                { val: '100%',lab: 'Garantía por escrito',      color: '#3b7bab' },
                                { val: '24/7', lab: 'Atención y seguimiento',   color: '#fff'    },
                            ].map((item, i) => (
                                <div key={i} style={{ background: 'linear-gradient(180deg, #141414 0%, #0c0c0c 100%)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '28px 22px', position: 'relative', overflow: 'hidden', transition: 'all .3s' }}
                                     onMouseEnter={e => { e.currentTarget.style.borderColor = item.color + '60'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                                     onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'; e.currentTarget.style.transform = 'none'; }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: '100%', background: `linear-gradient(180deg, ${item.color}, transparent)` }} />
                                    <p className="stat-num" style={{ fontSize: '2.6rem', color: item.color, lineHeight: 1 }}>{item.val}</p>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.8rem', color: 'rgba(255,255,255,.48)', marginTop: 10, lineHeight: 1.4 }}>{item.lab}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                SUCURSALES — estilo GitHub (clean grid)
            ════════════════════════════════════════════════════════ */}
            {sucursales.length > 0 && (
                <section className="pub-section-pad" style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 100%)', borderTop: '1px solid rgba(255,255,255,.04)', position: 'relative', overflow: 'hidden' }}>
                    <Particles count={14} />
                    <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
                        <div style={{ textAlign: 'center', marginBottom: 60 }}>
                            <p className="mono section-tag-underline" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: '#3b7bab', marginBottom: 14, fontWeight: 500, position: 'relative', display: 'inline-block', paddingBottom: 10 }}>// UBICACIÓN</p>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)', letterSpacing: '.04em', lineHeight: 1, marginBottom: 18 }}>
                                <span className="grad-text-white">Visítanos en </span>
                                <span className="grad-text-rainbow">Nuestra Matriz.</span>
                            </h2>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.55)', maxWidth: 580, margin: '0 auto', lineHeight: 1.7 }}>
                                Equipo técnico, infraestructura y atención profesional en cada ubicación.
                            </p>
                        </div>

                        {/* Tarjeta unificada: el mapa y los datos de la sucursal PRINCIPAL viven dentro del mismo cuadro */}
                        {sucursales.filter(s => s.es_principal).map(principal => (
                            <div key={principal.id} className="gh-card reveal" style={{ padding: 0, overflow: 'hidden', marginBottom: 40 }}>
                                {/* Mapa interactivo — ubicación provisional. Ver MODIFICAR DIRECCIÓN AQUÍ junto a MAPA_EMBED_SRC al inicio de este archivo. */}
                                <div style={{ position: 'relative' }}>
                                    <iframe
                                        title="Ubicación de SS SWAP"
                                        src={MAPA_EMBED_SRC}
                                        width="100%"
                                        height="360"
                                        style={{ border: 0, display: 'block', filter: 'grayscale(.15) contrast(1.05)' }}
                                        allowFullScreen=""
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                    />
                                    <span style={{ position: 'absolute', top: 16, right: 16, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 999, background: 'rgba(10,12,15,.72)', border: '1px solid rgba(59,123,171,.4)', color: '#3b7bab', fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.22em', backdropFilter: 'blur(8px)' }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                        PRINCIPAL
                                    </span>
                                </div>

                                <div style={{ padding: '30px 30px 34px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                                        <div className="icon-wrap" style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59,123,171,.12)', border: '1px solid rgba(59,123,171,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b7bab', flexShrink: 0 }}>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                        </div>
                                        <div>
                                            <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', letterSpacing: '.04em', color: '#fff' }}>{principal.nombre}</h3>
                                            {principal.ciudad && <p className="mono" style={{ fontWeight: 400, fontSize: '.74rem', color: '#3b7bab', letterSpacing: '.08em', marginTop: 2 }}>{principal.ciudad.toUpperCase()}</p>}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {principal.direccion && <SucLine icon={<IconPin />} text={principal.direccion} />}
                                        {principal.telefono && <SucLine icon={<IconPhone />} text={<a href={`tel:${principal.telefono}`} style={{ color: 'inherit', textDecoration: 'none' }}>{principal.telefono}</a>} />}
                                        {principal.horario  && <SucLine icon={<IconClock />} text={principal.horario} />}
                                    </div>

                                    {principal.descripcion && (
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.7, marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                                            {principal.descripcion}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Resto de sucursales (no principales) como tarjetas independientes */}
                        {sucursales.filter(s => !s.es_principal).length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 20 }}>
                                {sucursales.filter(s => !s.es_principal).map((s, i) => (
                                    <div key={s.id} className="gh-card reveal" style={{ paddingTop: 36, transitionDelay: `${i * 70}ms` }}>
                                        <div className="icon-wrap" style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59,123,171,.12)', border: '1px solid rgba(59,123,171,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b7bab', marginBottom: 18 }}>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                        </div>
                                        <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.35rem', letterSpacing: '.04em', color: '#fff', marginBottom: 4 }}>{s.nombre}</h3>
                                        {s.ciudad && <p className="mono" style={{ fontWeight: 400, fontSize: '.74rem', color: '#3b7bab', letterSpacing: '.08em', marginBottom: 16 }}>{s.ciudad.toUpperCase()}</p>}

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {s.direccion && <SucLine icon={<IconPin />} text={s.direccion} />}
                                            {s.telefono && <SucLine icon={<IconPhone />} text={<a href={`tel:${s.telefono}`} style={{ color: 'inherit', textDecoration: 'none' }}>{s.telefono}</a>} />}
                                            {s.horario  && <SucLine icon={<IconClock />} text={s.horario} />}
                                        </div>

                                        {s.descripcion && (
                                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.7, marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                                                {s.descripcion}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ════════════════════════════════════════════════════════
                CTA REGISTRO — estilo PlayStation (banner dramático)
            ════════════════════════════════════════════════════════ */}
            <section className="pub-section-pad" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
                    <div className="cta-account-card" style={{
                        position: 'relative', overflow: 'hidden',
                        backgroundImage: `linear-gradient(135deg, rgba(13,26,36,.88) 0%, rgba(10,10,10,.86) 50%, rgba(6,20,28,.9) 100%), url(${bannerGrandeImg})`,
                        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                        border: '1px solid rgba(59,123,171,.22)',
                        borderRadius: 24, padding: 'clamp(40px, 8vw, 80px) clamp(28px, 5vw, 60px)',
                        textAlign: 'center',
                    }}>
                        <div className="glow-orb" style={{ top: '-20%', left: '15%', width: 360, height: 360, background: 'radial-gradient(closest-side, rgba(59,123,171,.32), transparent)', animation: 'pubOrb 7s ease-in-out infinite' }} />
                        <div className="glow-orb" style={{ bottom: '-30%', right: '10%', width: 320, height: 320, background: 'radial-gradient(closest-side, rgba(74,131,179,.18), transparent)', animation: 'pubOrb 9s ease-in-out infinite 1.5s' }} />

                        <div style={{ position: 'relative' }}>
                            <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: '#3b7bab', marginBottom: 18, fontWeight: 500 }}>// PORTAL DE CLIENTES</p>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', letterSpacing: '.03em', marginBottom: 20, lineHeight: 1.02 }}>
                                <span className="grad-text-rainbow">Crea tu cuenta</span><span className="grad-text-white"> y controla todo.</span>
                            </h2>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1.02rem', color: 'rgba(255,255,255,.58)', maxWidth: 580, margin: '0 auto 40px', lineHeight: 1.7 }}>
                                Consulta el estado de tu reparación, agenda citas y revisa el historial completo de servicios de tu vehículo.
                            </p>
                            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Link to="/auth?modo=registro" className="ps-btn-primary">Crear cuenta gratis</Link>
                                <Link to="/auth" className="ps-btn-outline">Ya tengo cuenta</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   SUBCOMPONENTES
   ═══════════════════════════════════════════════════════════════ */
function SucLine({ icon, text }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: 'rgba(255,255,255,.35)', flexShrink: 0, marginTop: 2 }}>{icon}</span>
            <span style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.86rem', color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>{text}</span>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   ENGRANAJE 3D — Gear (decorativo, seccion "Por que elegirnos")
   ═══════════════════════════════════════════════════════════════ */
function Gear3D({ color = '#3b7bab' }) {
    return (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', perspective: 800 }}>
            <svg viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                                                animation: 'pubSpin 14s linear infinite', transformOrigin: 'center',
                                                filter: `drop-shadow(0 10px 20px ${color}55)` }}>
                <defs>
                    <radialGradient id={`gearBody-${color}`} cx=".5" cy=".4" r=".6">
                        <stop offset="0%"   stopColor="#ffffff" stopOpacity=".6" />
                        <stop offset="35%"  stopColor={color} />
                        <stop offset="100%" stopColor="#1a1a1a" />
                    </radialGradient>
                    <radialGradient id={`gearInner-${color}`} cx=".5" cy=".5" r=".5">
                        <stop offset="0%"   stopColor="#0a0a0a" />
                        <stop offset="80%"  stopColor="#1a1a1a" />
                        <stop offset="100%" stopColor="#050505" />
                    </radialGradient>
                </defs>
                {Array.from({ length: 12 }).map((_, i) => {
                    const deg = (i * 360) / 12;
                    return (
                        <rect key={i} x="92" y="6" width="16" height="28" rx="2"
                              fill={`url(#gearBody-${color})`} stroke="#000" strokeWidth=".5"
                              transform={`rotate(${deg} 100 100)`} />
                    );
                })}
                <circle cx="100" cy="100" r="72" fill={`url(#gearBody-${color})`} stroke="#000" strokeWidth="1" />
                <circle cx="100" cy="100" r="55" fill="none" stroke="#0a0a0a" strokeWidth="2" opacity=".55" />
                <circle cx="100" cy="100" r="34" fill={`url(#gearInner-${color})`} stroke={color} strokeWidth="2" />
                {[0, 60, 120, 180, 240, 300].map(deg => (
                    <rect key={deg} x="98" y="65" width="4" height="70" rx="2"
                          fill={color} opacity=".5"
                          transform={`rotate(${deg} 100 100)`} />
                ))}
                <circle cx="100" cy="100" r="10" fill={color} stroke="#000" strokeWidth="1.2" />
                <circle cx="100" cy="100" r="4" fill="#0a0a0a" />
            </svg>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   PARTICULAS — campo de particulas flotantes ambientales
   ═══════════════════════════════════════════════════════════════ */
function Particles({ count = 16 }) {
    const dots = Array.from({ length: count }).map((_, i) => {
        const size    = 2 + Math.random() * 3;
        const left    = Math.random() * 100;
        const bottom  = Math.random() * 20;
        const duration= 6 + Math.random() * 8;
        const delay   = Math.random() * 8;
        return (
            <span key={i} className="particle-dot" style={{
                width: size, height: size, left: `${left}%`, bottom: `${bottom}%`,
                animationDuration: `${duration}s`, animationDelay: `${delay}s`,
            }} />
        );
    });
    return <div className="particles-field">{dots}</div>;
}

function IconAward()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></svg>; }
function IconShieldCheck(){ return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>; }
function IconPackage()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>; }
function IconGauge()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>; }
function IconPin()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function IconPhone()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>; }
function IconClock()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconCheckSmall() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }