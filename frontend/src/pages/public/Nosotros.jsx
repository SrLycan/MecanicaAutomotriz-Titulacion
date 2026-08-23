import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import api from '../../services/api';
import './Nosotros.css';

const GOLD = '#3b7bab';

const VALORES = [
    { titulo: 'Honestidad',    desc: 'Diagnóstico claro antes de reparar. No cambiamos piezas que el vehículo no necesita.', icon: IconEye,    color: '#3b7bab' },
    { titulo: 'Calidad',       desc: 'Trabajo bien hecho a la primera, con prueba de funcionamiento antes de la entrega.',    icon: IconShield, color: '#4a83b3' },
    { titulo: 'Rapidez',       desc: 'Respuesta por WhatsApp en menos de 30 minutos y cotización el mismo día.',             icon: IconTarget, color: '#7fabce' },
    { titulo: 'Responsabilidad ambiental', desc: 'Manejo controlado de aceites, pinturas y residuos del taller.',           icon: IconTrend,  color: '#6f8ba3' },
];

const DIFERENCIALES = [
    { titulo: 'Garantía por escrito',       desc: 'Toda mano de obra y repuesto instalado queda respaldado en tu orden de trabajo.', icon: IconCertificate },
    { titulo: 'Fotos y video del proceso',  desc: 'Te mostramos el avance real de tu vehículo, no solo la promesa.',                  icon: IconCamera },
    { titulo: 'Atención por WhatsApp',      desc: 'Cotización, diagnóstico y seguimiento directo, sin necesidad de llamar.',          icon: IconChat },
    { titulo: 'Repuestos originales y alternativos', desc: 'Tú eliges: piezas originales o alternativas de calidad, sin sorpresas.',  icon: IconPackage },
    { titulo: 'Servicio a domicilio',       desc: 'Retiro y entrega de tu vehículo cuando el trabajo lo permite.',                    icon: IconTruck },
    { titulo: 'Entrega puntual',            desc: 'Tiempos de trabajo definidos y cumplidos, con aviso si algo cambia.',              icon: IconClock },
];

const HITOS = [
    { anio: 'Fase 1', texto: 'Supervivencia: mecánica rápida, frenos, scanner y atención directa por WhatsApp para generar flujo de caja.' },
    { anio: 'Fase 2', texto: 'Estabilización: taller organizado por áreas, procesos definidos y primeras colisiones ligeras.' },
    { anio: 'Fase 3', texto: 'Expansión: pintura más profesional, mejor equipo y clientes recurrentes.' },
    { anio: 'Fase 4', texto: 'Empresa formal: equipo ampliado, convenios con aseguradoras y marca reconocida en la zona.' },
    { anio: 'Fase 5', texto: 'Taller grande: mecánica avanzada, colisiones completas y atención a flotas empresariales.' },
];

const MECANICOS = [
    {
        nombre: 'Técnico Principal', cargo: 'Fundador y responsable técnico', badge: 'Responsable técnico',
        especialidad: 'Diagnóstico y reparaciones críticas', frase: 'Reviso personalmente cada vehículo antes de que salga del taller.',
        foto: '/nosotros/giovanny1.jpeg',
    },
    {
        nombre: 'Ayudante de Taller', cargo: 'Apoyo mecánico y de pintura', badge: 'Equipo de apoyo',
        especialidad: 'Preparación de vehículos y orden del taller', frase: 'Aprendiendo cada día para crecer junto al taller.',
        foto: '/nosotros/llantas-pintura.jpeg',
    },
];

const GALERIA = [
    { url: '/nosotros/pintura1.jpeg', cap: 'Nuestro taller', big: true },
    { url: '/nosotros/pintura2.jpeg', cap: 'Aplicando pintura' },
    { url: '/nosotros/pintura3.jpeg', cap: 'Detalle en llantas', tall: true },
    { url: '/nosotros/pintura4.jpeg', cap: 'Cabina de pintura' },
    { url: '/nosotros/pintura5.jpeg', cap: 'Equipo en acción', tall: true },
    { url: '/nosotros/pintura6.jpeg', cap: 'Preparación de carrocería' },
];

const TESTIMONIOS = [
    { nombre: 'María Fernanda López', rol: 'Cliente de SS SWAP Garage', texto: 'Me explicaron con claridad qué necesitaba mi auto y cuánto iba a costar antes de tocarlo. Se siente honesto.', foto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop' },
    { nombre: 'Juan Pablo Ríos',      rol: 'Cliente de SS SWAP Garage', texto: 'Respondieron mi WhatsApp en minutos y me mandaron fotos del avance. Se nota que quieren hacer las cosas bien.',        foto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=200&auto=format&fit=crop' },
    { nombre: 'Gabriela Torres',      rol: 'Cliente de SS SWAP Garage', texto: 'Llevé mi auto por un golpe y me dieron garantía por escrito. El trabajo quedó como esperaba.',          foto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop' },
];



export default function Nosotros() {
    const [sucursales, setSucursales] = useState([]);
    useEffect(() => {
        api.get('/sucursales/public').then(r => setSucursales(r.data.sucursales || [])).catch(() => {});
    }, []);

    useEffect(() => {
        const els = document.querySelectorAll('.reveal');
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
        }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
        els.forEach(el => io.observe(el));
        return () => io.disconnect();
    }, [sucursales]);

    /* Linea de tiempo "Un crecimiento planificado, paso a paso." — despliegue en tiempo real
       ligado al scroll (igual mecanismo que "Como funciona" en Servicios): reversible, no es
       un disparo unico como el resto de .reveal de esta pagina. */
    useEffect(() => {
        let raf = null;
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

        const actualizar = () => {
            raf = null;
            const rows = document.querySelectorAll('.ns-tl-row');
            if (!rows.length) return;

            const vh = window.innerHeight;
            const startZone = vh * 0.85;
            const endZone   = vh * 0.55;

            let suma = 0;
            rows.forEach((row, i) => {
                const rect = row.getBoundingClientRect();
                const top = rect.top + i * 26;
                const p = clamp((startZone - top) / (startZone - endZone), 0, 1);
                row.style.setProperty('--p', p.toFixed(3));
                suma += p;
            });

            const track = document.querySelector('.ns-timeline-v2');
            if (track) track.style.setProperty('--p', (suma / rows.length).toFixed(3));
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

    return (
        <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>

            <Navbar />

            {/* HERO */}
            <section className="ns-pad ns-hero" style={{ paddingTop: 150, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top left, rgba(13,26,36,.55) 0%, #050505 60%)' }} />
                <div className="glow-orb" style={{ top: '6%', right: '2%', width: 380, height: 380, background: 'radial-gradient(closest-side, rgba(59,123,171,.28), transparent)', animation: 'nsOrb 8s ease-in-out infinite' }} />
                <div className="ns-hero-grid" style={{ position: 'relative' }}>
                    <div>
                        <div className="ns-fade ns-hero-eyebrow" style={{ marginBottom: 22 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD }} />
                            <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.2em', color: GOLD, fontWeight: 500 }}>SS SWAP GARAGE</p>
                        </div>
                        <h1 className="ns-fade" style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.3rem, 4.6vw, 3.8rem)', letterSpacing: '.02em', lineHeight: 1.08, marginBottom: 22, animationDelay: '.05s' }}>
                            <span className="grad-text-white">Un taller pensado para durar, </span>
                            <span className="grad-text-rainbow">construido con calidad y confianza.</span>
                        </h1>
                        <p className="ns-fade" style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: 'clamp(.95rem,1.3vw,1.05rem)', color: 'rgba(255,255,255,.6)', maxWidth: 520, marginBottom: 34, lineHeight: 1.8, animationDelay: '.1s' }}>
                            SS SWAP Garage nace en Tola Chica – La Morita combinando mecánica general y colisiones bajo un mismo techo, con diagnóstico claro, garantía por escrito y atención directa por WhatsApp.
                        </p>
                        <div className="ns-fade" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animationDelay: '.15s' }}>
                            <Link to="/servicios" className="ps-btn-primary"><span>Conocer nuestros servicios</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </Link>
                            <Link to="/servicios" className="ps-btn-outline">Agendar servicio</Link>
                        </div>
                    </div>
                    <div className="ns-hero-photo-wrap reveal">
                        <img
                            src="/nosotros/hero-taller.jpeg"
                            alt="Mecánico de SS SWAP reparando un vehículo en el taller"
                            onError={e => { e.currentTarget.style.opacity = 0; }}
                        />
                        <div className="ns-hero-photo-badge">
                            <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', color: GOLD, lineHeight: 1 }}>100%</span>
                            <span style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.78rem', color: 'rgba(255,255,255,.75)', lineHeight: 1.3 }}>Garantía por escrito<br/>en cada trabajo</span>
                        </div>
                    </div>
                </div>
                <div className="ns-scroll-ind">
                    <span />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            </section>

            {/* ESTADISTICAS */}
            <section className="ns-pad" style={{ paddingTop: 64, paddingBottom: 64 }}>
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div className="ns-stats-grid reveal">
                        {[
                            { valor: 30, sufijo: ' min', label: 'Respuesta por WhatsApp' },
                            { valor: 5,   sufijo: '%', label: 'Retrabajos (máximo)' },
                            { valor: 100, sufijo: '%', label: 'Garantía por escrito' },
                            { valor: 24, sufijo: '/7', label: 'Atención y seguimiento' },
                        ].map((s, i) => (
                            <div key={i} className="ns-stat-cell">
                                <AnimatedStat valor={s.valor} sufijo={s.sufijo} />
                                <p className="ns-stat-lab">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* MISION Y VISION */}
            <section className="ns-pad">
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div className="ns-mv-grid">
                        <div className="reveal ns-card" style={{ borderColor: 'rgba(59,123,171,.25)' }}>
                            <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.25em', color: GOLD, marginBottom: 14 }}>MISIÓN</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.75)', lineHeight: 1.8 }}>
                                Brindar servicios confiables, rápidos y garantizados para vehículos livianos — mecánica general y colisiones — generando fidelización real y un crecimiento sostenible del taller.
                            </p>
                        </div>
                        <div className="reveal ns-card" style={{ transitionDelay: '90ms', borderColor: 'rgba(74,131,179,.2)' }}>
                            <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.25em', color: '#4a83b3', marginBottom: 14 }}>VISIÓN</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.75)', lineHeight: 1.8 }}>
                                Convertirnos en uno de los talleres de referencia en Tola Chica – La Morita por calidad, honestidad y tecnología.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* LINEA DE TIEMPO */}
            <section className="ns-pad">
                <div style={{ maxWidth: 880, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// HACIA DÓNDE VAMOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Un crecimiento </span>
                            <span className="grad-text-rainbow">planificado, paso a paso.</span>
                        </h2>
                    </div>
                    <div className="ns-timeline-v2">
                        <div className="ns-tl-fill" />
                        {HITOS.map((h, i) => (
                            <div key={h.anio} className={`ns-tl-row${i % 2 === 1 ? ' right' : ''}`}>
                                <span className="ns-tl-dot" />
                                <div className="ns-tl-card ns-card">
                                    <p className="mono ns-tl-year" style={{ marginBottom: 8 }}>{h.anio}</p>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.92rem', color: 'rgba(255,255,255,.65)', lineHeight: 1.65 }}>{h.texto}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* DIFERENCIALES */}
            <section className="ns-pad" style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)', borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// DIFERENCIALES</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">¿Por qué elegir </span>
                            <span className="grad-text-rainbow">SS SWAP?</span>
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 18 }}>
                        {DIFERENCIALES.map((d, i) => (
                            <div key={d.titulo} className="ns-card ns-diff-card reveal" style={{ transitionDelay: `${i * 60}ms` }}>
                                <div className="ns-diff-icon ns-icon"><d.icon /></div>
                                <div>
                                    <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.03em', color: '#fff', marginBottom: 6 }}>{d.titulo}</h3>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.83rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.6 }}>{d.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* VALORES */}
            <section className="ns-pad" style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)', borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// NUESTROS VALORES</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Lo que guía cada </span>
                            <span className="grad-text-rainbow">trabajo que hacemos.</span>
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 18 }}>
                        {VALORES.map((v, i) => (
                            <div key={v.titulo} className="ns-card reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                                <div className="ns-icon" style={{ width: 48, height: 48, borderRadius: 12, background: `${v.color}14`, border: `1px solid ${v.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: v.color, marginBottom: 18 }}>
                                    <v.icon />
                                </div>
                                <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.15rem', letterSpacing: '.03em', color: '#fff', marginBottom: 8 }}>{v.titulo}</h3>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.65 }}>{v.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* EQUIPO DE MECANICOS */}
            <section className="ns-pad">
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// NUESTRO EQUIPO</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Personas detrás de </span>
                            <span className="grad-text-rainbow">cada reparación.</span>
                        </h2>
                        <p className="ns-scroll-hint" style={{ justifyContent: 'center', width: '100%' }}>
                            Desliza para ver al equipo
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </p>
                    </div>
                    <div className="ns-team-grid" style={{ maxWidth: 720, margin: '0 auto' }}>
                        {MECANICOS.map((m, i) => (
                            <div key={m.nombre} className="ns-team-card reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                                <div className="ns-team-photo">
                                    <img src={m.foto} alt={m.nombre} loading="lazy" onError={e => { e.currentTarget.style.opacity = 0; }} />
                                    <span className="ns-team-exp">{m.badge}</span>
                                </div>
                                <div className="ns-team-body">
                                    <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.25rem', letterSpacing: '.03em', color: '#fff', marginBottom: 4 }}>{m.nombre}</h3>
                                    <p className="mono" style={{ fontSize: '.66rem', letterSpacing: '.08em', color: GOLD }}>{m.cargo.toUpperCase()}</p>
                                    <span className="ns-team-tag">{m.especialidad}</span>
                                    <p className="ns-team-quote">&ldquo;{m.frase}&rdquo;</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ENDEREZADA Y PINTURA */}
            <section className="ns-pad">
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 48 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// NUESTRA ESPECIALIDAD</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Enderezada y pintura: </span>
                            <span className="grad-text-rainbow">el fuerte de SS SWAP.</span>
                        </h2>
                    </div>

                    <div className="ns-spec-grid reveal">
                        <div className="ns-spec-photo-main">
                            <img
                                src="/nosotros/pintura4.jpeg"
                                alt="Área de enderezada y pintura de SS SWAP"
                                onError={e => { e.currentTarget.style.opacity = 0; }}
                            />
                            <span className="ns-spec-photo-tag">Colisiones</span>
                        </div>
                        <div>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.65)', lineHeight: 1.8, marginBottom: 22 }}>
                                En colisiones no improvisamos: seguimos un proceso completo de enderezada, templado, soldadura, pintura por capas, pulido y cuadratura de paneles, para que el golpe no se note ni en el color ni en la carrocería.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                {['Enderezada', 'Templado', 'Soldadura', 'Pintura por capas', 'Pulido', 'Cuadratura de paneles'].map(tag => (
                                    <span key={tag} className="ns-spec-chip">{tag}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="ns-spec-steps">
                        {[
                            { titulo: 'Aplicación de pintura', desc: 'Pintura aplicada por capas, de forma uniforme y sin defectos, dentro de la cabina.', foto: '/nosotros/pintura2.jpeg' },
                            { titulo: 'Control de calidad',    desc: 'Revisamos cada detalle antes de la entrega: acabado, brillo y funcionamiento.',      video: '/nosotros/video2.mp4' },
                            { titulo: 'Detalle en llantas',    desc: 'También pintamos y renovamos llantas para que combinen con la carrocería.',          foto: '/nosotros/pintura3.jpeg' },
                        ].map((s, i) => (
                            <div key={s.titulo} className="ns-card ns-spec-step reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                                <div className="ns-spec-step-photo">
                                    {s.video ? (
                                        <video muted loop playsInline autoPlay>
                                            <source src={s.video} type="video/mp4" />
                                        </video>
                                    ) : (
                                        <img src={s.foto} alt={s.titulo} loading="lazy" onError={e => { e.currentTarget.style.opacity = 0; }} />
                                    )}
                                </div>
                                <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.03em', color: '#fff', marginBottom: 6 }}>{s.titulo}</h3>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.83rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.6 }}>{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* GALERIA */}
            <section className="ns-pad" style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)', borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 48 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// GALERÍA</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Un vistazo a </span>
                            <span className="grad-text-rainbow">nuestro taller.</span>
                        </h2>
                        <p className="ns-scroll-hint-gallery" style={{ justifyContent: 'center', width: '100%' }}>
                            Desliza para ver más fotos
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </p>
                    </div>
                    <Galeria items={GALERIA} />
                </div>
            </section>

            {/* VIDEO INSTITUCIONAL */}
            <section className="ns-pad">
                <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// CONÓCENOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Un recorrido por </span>
                            <span className="grad-text-rainbow">SS SWAP.</span>
                        </h2>
                    </div>
                    <div className="ns-video-frame reveal">
                        <video controls poster="/nosotros/pintura1.jpeg">
                            <source src="/nosotros/video1.mp4" type="video/mp4" />
                            Tu navegador no soporta reproducción de video.
                        </video>
                    </div>
                </div>
            </section>

            {/* TESTIMONIOS */}
            <section className="ns-pad" style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)', borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 48 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// TESTIMONIOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Lo que dicen </span>
                            <span className="grad-text-rainbow">nuestros clientes.</span>
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 20 }}>
                        {TESTIMONIOS.map((t, i) => (
                            <div key={t.nombre} className="ns-card ns-testi-card reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                                <div className="ns-testi-stars">
                                    {Array.from({ length: 5 }).map((_, j) => <IconStar key={j} />)}
                                </div>
                                <p className="ns-testi-text">&ldquo;{t.texto}&rdquo;</p>
                                <div className="ns-testi-person">
                                    <img className="ns-testi-avatar" src={t.foto} alt={t.nombre} loading="lazy" onError={e => { e.currentTarget.style.opacity = 0; }} />
                                    <div>
                                        <p className="ns-testi-name">{t.nombre}</p>
                                        <p className="ns-testi-role">{t.rol}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SUCURSALES (si existen) */}
            {sucursales.length > 0 && (
                <section className="ns-pad">
                    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                        <div style={{ textAlign: 'center', marginBottom: 44 }}>
                            <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// DÓNDE ESTAMOS</p>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '.03em' }}>
                                <span className="grad-text-white">Visítanos en </span>
                                <span className="grad-text-rainbow">Nuestra Matriz.</span>
                            </h2>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 16 }}>
                            {sucursales.map((s, i) => (
                                <div key={s.id} className="ns-card reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                                    <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.15rem', letterSpacing: '.03em', color: '#fff', marginBottom: 4 }}>{s.nombre}</h3>
                                    {s.ciudad && <p className="mono" style={{ fontSize: '.72rem', color: GOLD, marginBottom: 10 }}>{s.ciudad.toUpperCase()}</p>}
                                    {s.direccion && <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: 'rgba(255,255,255,.55)', lineHeight: 1.6 }}>{s.direccion}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* CTA */}
            <section className="ns-pad">
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div className="reveal in-view ns-cta-box">
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em', marginBottom: 18, lineHeight: 1.05 }}>
                            <span className="grad-text-white">¿Listo para devolverle la vida a </span>
                            <span className="grad-text-rainbow">tu vehículo?</span>
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.58)', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
                            Revisa nuestro catálogo de servicios o crea tu cuenta para llevar el control de tu historial automotriz.
                        </p>
                        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link to="/servicios" className="ps-btn-primary"><span>Agenda tu cita</span></Link>
                            <Link to="/auth?modo=registro" className="ps-btn-outline">Crear cuenta gratis</Link>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}

function Galeria({ items }) {
    const [activo, setActivo] = useState(null);

    useEffect(() => {
        if (activo === null) return;
        const onKey = (e) => { if (e.key === 'Escape') setActivo(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [activo]);

    return (
        <>
            <div className="ns-gallery reveal">
                {items.map((g, i) => (
                    <div
                        key={i}
                        className={`ns-gallery-item${g.big ? ' big' : ''}${g.tall ? ' tall' : ''}`}
                        onClick={() => setActivo(i)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') setActivo(i); }}
                    >
                        <img src={g.url} alt={g.cap} loading="lazy" onError={e => { e.currentTarget.style.opacity = 0; }} />
                        <span className="ns-gallery-expand"><IconExpand /></span>
                        <div className="ns-gallery-overlay">
                            <p className="ns-gallery-caption">{g.cap}</p>
                        </div>
                    </div>
                ))}
            </div>
            {activo !== null && (
                <div className="ns-lightbox" onClick={() => setActivo(null)}>
                    <button className="ns-lightbox-close" onClick={() => setActivo(null)} aria-label="Cerrar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <img src={items[activo].url} alt={items[activo].cap} onClick={e => e.stopPropagation()} />
                </div>
            )}
        </>
    );
}

function IconEye()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }
function IconTarget()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
function IconShield()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function IconTrend()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function IconStar()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }

function IconCertificate() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M9 13.5 7 22l5-3 5 3-2-8.5"/></svg>; }
function IconCamera()      { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>; }
function IconChat()        { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>; }
function IconPackage()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>; }
function IconTruck()       { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="14" height="10" rx="1"/><path d="M15 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/></svg>; }
function IconClock()       { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>; }
function IconExpand()      { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>; }

function AnimatedStat({ valor, sufijo = '' }) {
    const [n, setN] = useState(0);
    const ref = useRef(null);
    const done = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting && !done.current) {
                    done.current = true;
                    const duration = 1400;
                    const start = performance.now();
                    const tick = (now) => {
                        const progress = Math.min((now - start) / duration, 1);
                        const eased = 1 - Math.pow(1 - progress, 3);
                        setN(Math.round(valor * eased));
                        if (progress < 1) requestAnimationFrame(tick);
                    };
                    requestAnimationFrame(tick);
                    io.unobserve(el);
                }
            });
        }, { threshold: 0.4 });
        io.observe(el);
        return () => io.disconnect();
    }, [valor]);

    return <p ref={ref} className="ns-stat-num">{n}{sufijo}</p>;
}