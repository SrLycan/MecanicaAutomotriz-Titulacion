import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import api from '../../services/api';

const GOLD = '#3b7bab';

const VALORES = [
    { titulo: 'Transparencia',   desc: 'Presupuestos claros antes de iniciar cualquier trabajo. Sin cargos ocultos.',        icon: IconEye,    color: '#3b7bab' },
    { titulo: 'Precision',       desc: 'Diagnostico computarizado en cada revision, sin adivinar la falla.',                 icon: IconTarget, color: '#4a83b3' },
    { titulo: 'Compromiso',      desc: 'Garantia escrita en mano de obra y repuestos en todos nuestros servicios.',          icon: IconShield, color: '#7fabce' },
    { titulo: 'Mejora continua', desc: 'Tecnicos en capacitacion constante y equipo actualizado ano tras ano.',              icon: IconTrend,  color: '#6f8ba3' },
];

const HITOS = [
    { anio: '2015', texto: 'Apertura del primer taller en Ponciano Alto, Quito, con dos elevadores y un equipo pequeno.' },
    { anio: '2018', texto: 'Incorporacion de diagnostico computarizado (OBD2) y ampliacion del area de electromecanica.' },
    { anio: '2021', texto: 'Se supera la barrera de los 1000 clientes registrados en el sistema del taller.' },
    { anio: '2024', texto: 'Digitalizacion completa del historial de vehiculos y ordenes de trabajo.' },
    { anio: '2026', texto: 'Lanzamiento de SSWAP: portal en linea para clientes con seguimiento de servicios en tiempo real.' },
];

const MECANICOS = [
    {
        nombre: 'Carlos Mendoza', cargo: 'Especialista en Motores', anios: 12,
        especialidad: 'Reconstruccion de motores', frase: 'Experto en reconstruccion de motores y diagnostico avanzado.',
        foto: 'https://images.unsplash.com/photo-1602233158242-3ba0ac4d2167?q=80&w=600&auto=format&fit=crop',
    },
    {
        nombre: 'Andres Salazar', cargo: 'Tecnico en Frenos y Suspension', anios: 9,
        especialidad: 'Sistemas de frenado ABS', frase: 'Cada auto sale del taller frenando como nuevo, sin excepciones.',
        foto: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=600&auto=format&fit=crop',
    },
    {
        nombre: 'Diego Herrera', cargo: 'Tecnico en Diagnostico Computarizado', anios: 7,
        especialidad: 'Escaner OBD2 y electronica', frase: 'La tecnologia no miente: el escaner nos dice la falla real.',
        foto: 'https://images.unsplash.com/photo-1622674707722-8ce2a8250c5c?q=80&w=600&auto=format&fit=crop',
    },
    {
        nombre: 'Mateo Vasquez', cargo: 'Especialista en Carroceria y Pintura', anios: 10,
        especialidad: 'Enderezada y pintura de fabrica', frase: 'Que el auto salga como si el golpe nunca hubiera pasado.',
        foto: 'https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?q=80&w=600&auto=format&fit=crop',
    },
];

const GALERIA = [
    { url: 'https://images.unsplash.com/photo-1632823469850-1b7b1e8b7692?q=80&w=900&auto=format&fit=crop', cap: 'Nuestro taller', tall: true },
    { url: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?q=80&w=700&auto=format&fit=crop', cap: 'Motor en revision' },
    { url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=700&auto=format&fit=crop', cap: 'Herramientas de precision' },
    { url: 'https://images.unsplash.com/photo-1600661653561-629509216228?q=80&w=700&auto=format&fit=crop', cap: 'Cabina de pintura' },
    { url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=700&auto=format&fit=crop', cap: 'Tecnicos en accion' },
    { url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=700&auto=format&fit=crop', cap: 'Vehiculo listo para entrega' },
];

const TESTIMONIOS = [
    { nombre: 'Maria Fernanda Lopez', rol: 'Cliente desde 2021', texto: 'Llevo mi auto hace anos y siempre me explican con claridad que necesita y cuanto cuesta. Nunca me han cobrado de mas.', foto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop' },
    { nombre: 'Juan Pablo Rios',      rol: 'Cliente desde 2022', texto: 'El sistema en linea para ver el estado de mi carro es excelente. Se siente un taller moderno y serio.',        foto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=200&auto=format&fit=crop' },
    { nombre: 'Gabriela Torres',      rol: 'Cliente desde 2019', texto: 'Tuve un choque y ellos gestionaron todo con el seguro. El auto quedo perfecto, ni se nota el golpe.',          foto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop' },
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

    return (
        <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
                * { box-sizing: border-box; }
                body { background: #050505; }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: rgba(59,123,171,.3); border-radius: 8px; }

                @keyframes nsFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
                @keyframes nsOrb    { 0%, 100% { opacity: .4; transform: scale(1); } 50% { opacity: .7; transform: scale(1.1); } }
                .ns-fade { animation: nsFadeUp .6s cubic-bezier(.4,0,.2,1) both; }
                .reveal { opacity: 0; transform: translateY(24px); transition: opacity .6s cubic-bezier(.4,0,.2,1), transform .6s cubic-bezier(.4,0,.2,1); }
                .reveal.in-view { opacity: 1; transform: none; }
                .glow-orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(60px); }

                .mono { font-family: 'JetBrains Mono', monospace; }
                .grad-text-gold  { background: linear-gradient(135deg, #3b7bab 0%, #7fabce 50%, #3b7bab 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
                .grad-text-white { background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,.65) 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

                .ns-card { background: linear-gradient(180deg, #141414 0%, #0e0e0e 100%); border: 1px solid rgba(255,255,255,.07); border-radius: 16px; padding: 28px 24px; transition: all .3s cubic-bezier(.4,0,.2,1); }
                .ns-card:hover { border-color: rgba(59,123,171,.4); transform: translateY(-5px); }
                .ns-card:hover .ns-icon { transform: scale(1.08) rotate(-4deg); }
                .ns-icon { transition: transform .3s; }

                .ns-timeline { position: relative; padding-left: 34px; }
                .ns-timeline::before { content: ''; position: absolute; left: 7px; top: 6px; bottom: 6px; width: 2px; background: linear-gradient(180deg, rgba(59,123,171,.7), rgba(59,123,171,.05)); }
                .ns-dot { position: absolute; left: 0; width: 14px; height: 14px; border-radius: 50%; background: #3b7bab; box-shadow: 0 0 0 4px rgba(59,123,171,.15); }

                .ns-mv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
                .ns-pad { padding: 120px 28px; }

                .ps-btn-primary { display: inline-flex; align-items: center; gap: 10px; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: .92rem; color: #0a0a0a; background: #3b7bab; border: none; border-radius: 999px; padding: 15px 32px; cursor: pointer; text-decoration: none; transition: all .25s cubic-bezier(.4,0,.2,1); box-shadow: 0 8px 24px -6px rgba(59,123,171,.5); }
                .ps-btn-primary:hover { background: #5a93c4; transform: translateY(-2px); box-shadow: 0 14px 36px -8px rgba(59,123,171,.7); }
                .ps-btn-outline { display: inline-flex; align-items: center; gap: 10px; font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .92rem; color: #fff; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.18); border-radius: 999px; padding: 14px 32px; cursor: pointer; text-decoration: none; transition: all .25s; }
                .ps-btn-outline:hover { border-color: #3b7bab; color: #3b7bab; background: rgba(59,123,171,.08); transform: translateY(-2px); }

                @media (max-width: 900px) {
                    .ns-pad { padding: 76px 20px; }
                    .ns-mv-grid { grid-template-columns: 1fr; }
                }
                @media (max-width: 560px) {
                    .ns-pad { padding: 60px 16px; }
                }

                /* ── Hero background ── */
                .ns-hero-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .55; transition: opacity .6s; }

                /* ── Equipo de mecanicos (tarjetas con foto) ── */
                .ns-team-card {
                    position: relative; border-radius: 20px; overflow: hidden;
                    background: linear-gradient(180deg, rgba(255,255,255,.035) 0%, rgba(255,255,255,.012) 100%);
                    border: 1px solid rgba(255,255,255,.08);
                    backdrop-filter: blur(6px);
                    transition: transform .35s cubic-bezier(.4,0,.2,1), border-color .35s, box-shadow .35s;
                }
                .ns-team-card:hover { transform: translateY(-8px); border-color: rgba(59,123,171,.4); box-shadow: 0 24px 50px -20px rgba(0,0,0,.7); }
                .ns-team-photo { position: relative; width: 100%; aspect-ratio: 1 / 1; overflow: hidden; }
                .ns-team-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s cubic-bezier(.4,0,.2,1); filter: grayscale(.15) contrast(1.02); }
                .ns-team-card:hover .ns-team-photo img { transform: scale(1.08); filter: grayscale(0) contrast(1.05); }
                .ns-team-photo::after { content: ''; position: absolute; inset: 0; background: linear-gradient(0deg, rgba(10,10,10,.9) 0%, transparent 55%); }
                .ns-team-exp {
                    position: absolute; top: 12px; right: 12px; z-index: 2;
                    display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 999px;
                    background: rgba(10,12,15,.65); border: 1px solid rgba(59,123,171,.4); backdrop-filter: blur(8px);
                    font-family: 'JetBrains Mono', monospace; font-size: .62rem; letter-spacing: .04em; color: #7fabce;
                }
                .ns-team-body { padding: 20px 20px 24px; }
                .ns-team-quote {
                    font-family: 'Outfit', sans-serif; font-weight: 300; font-style: italic; font-size: .84rem;
                    color: rgba(255,255,255,.55); line-height: 1.6; margin-top: 12px; padding-top: 12px;
                    border-top: 1px solid rgba(255,255,255,.07);
                }

                /* ── Galeria ── */
                .ns-gallery { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 140px; gap: 12px; }
                .ns-gallery-item { position: relative; border-radius: 14px; overflow: hidden; cursor: pointer; }
                .ns-gallery-item.tall { grid-row: span 2; }
                .ns-gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s cubic-bezier(.4,0,.2,1), filter .4s; display: block; }
                .ns-gallery-item:hover img { transform: scale(1.12); filter: brightness(.55); }
                .ns-gallery-caption {
                    position: absolute; left: 0; right: 0; bottom: 0; padding: 12px 14px; z-index: 2;
                    background: linear-gradient(0deg, rgba(5,5,5,.85), transparent);
                    font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .75rem; color: #fff;
                    opacity: 0; transform: translateY(8px); transition: opacity .35s, transform .35s;
                }
                .ns-gallery-item:hover .ns-gallery-caption { opacity: 1; transform: none; }
                @media (max-width: 900px) { .ns-gallery { grid-template-columns: repeat(2, 1fr); } .ns-gallery-item.tall { grid-row: span 2; } }

                /* ── Video institucional ── */
                .ns-video-frame {
                    position: relative; width: 100%; aspect-ratio: 16 / 8; border-radius: 22px; overflow: hidden;
                    border: 1px solid rgba(255,255,255,.1); box-shadow: 0 30px 70px -24px rgba(0,0,0,.7);
                    background: #000;
                }
                .ns-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }

                /* ── Estadisticas animadas ── */
                .ns-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; border-radius: 20px; overflow: hidden; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); }
                .ns-stat-cell { background: linear-gradient(180deg, #111 0%, #0b0b0b 100%); padding: 40px 20px; text-align: center; }
                .ns-stat-num { font-family: 'Bebas Neue', sans-serif; font-size: clamp(2.2rem, 4vw, 3rem); letter-spacing: .02em; color: ${GOLD}; line-height: 1; }
                .ns-stat-lab { font-family: 'Outfit', sans-serif; font-weight: 400; font-size: .8rem; color: rgba(255,255,255,.55); margin-top: 8px; }
                @media (max-width: 900px) { .ns-stats-grid { grid-template-columns: repeat(2, 1fr); } }

                /* ── Testimonios ── */
                .ns-testi-card { padding: 26px 24px; }
                .ns-testi-stars { display: flex; gap: 3px; margin-bottom: 14px; color: #f5b32e; }
                .ns-testi-text { font-family: 'Outfit', sans-serif; font-weight: 300; font-size: .92rem; color: rgba(255,255,255,.72); line-height: 1.7; margin-bottom: 20px; }
                .ns-testi-person { display: flex; align-items: center; gap: 12px; }
                .ns-testi-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,.15); }
                .ns-testi-name { font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .86rem; color: #fff; }
                .ns-testi-role { font-family: 'Outfit', sans-serif; font-weight: 300; font-size: .74rem; color: rgba(255,255,255,.45); }
            `}</style>

            <Navbar />

            {/* HERO */}
            <section className="ns-pad ns-hero" style={{ paddingTop: 150, position: 'relative', overflow: 'hidden' }}>
                <img
                    className="ns-hero-bg"
                    src="https://images.unsplash.com/photo-1632823469850-1b7b1e8b7692?q=80&w=1800&auto=format&fit=crop"
                    alt="Interior del taller SSWAP"
                    onError={e => { e.currentTarget.style.opacity = 0; }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top right, rgba(13,26,36,.75) 0%, rgba(10,10,10,.88) 45%, #050505 100%)' }} />
                <div className="glow-orb" style={{ top: '10%', right: '8%', width: 340, height: 340, background: 'radial-gradient(closest-side, rgba(59,123,171,.3), transparent)', animation: 'nsOrb 8s ease-in-out infinite' }} />
                <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
                    <div className="ns-fade" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(59,123,171,.08)', border: '1px solid rgba(59,123,171,.25)', marginBottom: 22 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD }} />
                        <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.2em', color: GOLD, fontWeight: 500 }}>NUESTRA HISTORIA</p>
                    </div>
                    <h1 className="ns-fade" style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.6rem, 6vw, 4.6rem)', letterSpacing: '.02em', lineHeight: 1, marginBottom: 22, animationDelay: '.05s' }}>
                        <span className="grad-text-white">Mecanica hecha con </span>
                        <span className="grad-text-gold">experiencia real.</span>
                    </h1>
                    <p className="ns-fade" style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: 'clamp(.95rem,1.6vw,1.08rem)', color: 'rgba(255,255,255,.6)', maxWidth: 660, margin: '0 auto 34px', lineHeight: 1.8, animationDelay: '.1s' }}>
                        Mas de una decada cuidando cada vehiculo como si fuera nuestro. SSWAP nacio como un taller de barrio en Ponciano Alto, Quito, y hoy combina experiencia mecanica real con un sistema digital que da seguimiento a cada vehiculo, cada repuesto y cada cita.
                    </p>
                    <div className="ns-fade" style={{ animationDelay: '.15s' }}>
                        <Link to="/servicios" className="ps-btn-primary">Conoce nuestros servicios
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </Link>
                    </div>
                </div>
            </section>

            {/* MISION Y VISION */}
            <section className="ns-pad">
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div className="ns-mv-grid">
                        <div className="reveal ns-card" style={{ borderColor: 'rgba(59,123,171,.25)' }}>
                            <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.25em', color: GOLD, marginBottom: 14 }}>MISION</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.75)', lineHeight: 1.8 }}>
                                Brindar mantenimiento y reparacion automotriz confiable, con diagnostico tecnico preciso y comunicacion honesta, para que cada cliente recupere su vehiculo con la certeza de un trabajo bien hecho.
                            </p>
                        </div>
                        <div className="reveal ns-card" style={{ transitionDelay: '90ms', borderColor: 'rgba(74,131,179,.2)' }}>
                            <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.25em', color: '#4a83b3', marginBottom: 14 }}>VISION</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.75)', lineHeight: 1.8 }}>
                                Ser el taller automotriz de referencia en Quito por su digitalizacion, transparencia y calidad tecnica, expandiendo nuestras sucursales sin perder la cercania con cada cliente.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* VALORES */}
            <section className="ns-pad" style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)', borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// NUESTROS VALORES</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Lo que guia cada </span>
                            <span className="grad-text-gold">trabajo que hacemos.</span>
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

            {/* LINEA DE TIEMPO */}
            <section className="ns-pad">
                <div style={{ maxWidth: 760, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// TRAYECTORIA</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Una decada </span>
                            <span className="grad-text-gold">construyendo confianza.</span>
                        </h2>
                    </div>
                    <div className="ns-timeline">
                        {HITOS.map((h, i) => (
                            <div key={h.anio} className="reveal" style={{ position: 'relative', paddingBottom: i < HITOS.length - 1 ? 36 : 0, transitionDelay: `${i * 70}ms` }}>
                                <span className="ns-dot" />
                                <p className="mono" style={{ color: GOLD, fontWeight: 600, fontSize: '.85rem', marginBottom: 6 }}>{h.anio}</p>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.92rem', color: 'rgba(255,255,255,.65)', lineHeight: 1.65 }}>{h.texto}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* EQUIPO DE MECANICOS */}
            <section className="ns-pad" style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)', borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// NUESTRO EQUIPO</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Personas detras de </span>
                            <span className="grad-text-gold">cada reparacion.</span>
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 22 }}>
                        {MECANICOS.map((m, i) => (
                            <div key={m.nombre} className="ns-team-card reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                                <div className="ns-team-photo">
                                    <img src={m.foto} alt={m.nombre} loading="lazy" onError={e => { e.currentTarget.style.opacity = 0; }} />
                                    <span className="ns-team-exp">{m.anios} anos de experiencia</span>
                                </div>
                                <div className="ns-team-body">
                                    <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.25rem', letterSpacing: '.03em', color: '#fff', marginBottom: 4 }}>{m.nombre}</h3>
                                    <p className="mono" style={{ fontSize: '.66rem', letterSpacing: '.08em', color: GOLD, marginBottom: 4 }}>{m.cargo.toUpperCase()}</p>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.78rem', color: 'rgba(255,255,255,.5)' }}>Especialidad: {m.especialidad}</p>
                                    <p className="ns-team-quote">&ldquo;{m.frase}&rdquo;</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* GALERIA */}
            <section className="ns-pad">
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 48 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// GALERIA</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Un vistazo a </span>
                            <span className="grad-text-gold">nuestro taller.</span>
                        </h2>
                    </div>
                    <div className="ns-gallery reveal">
                        {GALERIA.map((g, i) => (
                            <div key={i} className={`ns-gallery-item${g.tall ? ' tall' : ''}`}>
                                <img src={g.url} alt={g.cap} loading="lazy" onError={e => { e.currentTarget.style.opacity = 0; }} />
                                <div className="ns-gallery-caption">{g.cap}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* VIDEO INSTITUCIONAL */}
            <section className="ns-pad" style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)', borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// CONOCENOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Un recorrido por </span>
                            <span className="grad-text-gold">SSWAP.</span>
                        </h2>
                    </div>
                    <div className="ns-video-frame reveal">
                        <iframe
                            src="https://www.youtube.com/embed/iv4M8trjXrE"
                            title="Video institucional SSWAP"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                    <p style={{ textAlign: 'center', fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.78rem', color: 'rgba(255,255,255,.4)', marginTop: 16 }}>
                     
                    </p>
                </div>
            </section>

            {/* ESTADISTICAS */}
            <section className="ns-pad">
                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div className="ns-stats-grid reveal">
                        {[
                            { valor: 1500, sufijo: '+', label: 'Vehiculos reparados' },
                            { valor: 15,   sufijo: ' anos', label: 'De experiencia' },
                            { valor: 98,   sufijo: '%', label: 'Clientes satisfechos' },
                            { valor: 24, sufijo: '/7', label: 'Atencion y seguimiento' },
                        ].map((s, i) => (
                            <div key={i} className="ns-stat-cell">
                                <AnimatedStat valor={s.valor} sufijo={s.sufijo} />
                                <p className="ns-stat-lab">{s.label}</p>
                            </div>
                        ))}
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
                            <span className="grad-text-gold">nuestros clientes.</span>
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
                            <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// DONDE ESTAMOS</p>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '.03em' }}>
                                <span className="grad-text-white">Visitanos en </span>
                                <span className="grad-text-gold">Nuestra Matriz.</span>
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
                    <div className="reveal in-view" style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #0d1a24 0%, #0a0a0a 50%, #06141c 100%)', border: '1px solid rgba(59,123,171,.22)', borderRadius: 24, padding: 'clamp(40px, 7vw, 70px) clamp(28px, 5vw, 56px)', textAlign: 'center' }}>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em', marginBottom: 18, lineHeight: 1.05 }}>
                            <span className="grad-text-white">Listo para darle el mejor cuidado a </span>
                            <span className="grad-text-gold">tu vehiculo?</span>
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.58)', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
                            Revisa nuestro catalogo de servicios o crea tu cuenta para llevar el control de tu historial automotriz.
                        </p>
                        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link to="/servicios" className="ps-btn-primary">Agenda tu cita</Link>
                            <Link to="/auth?modo=registro" className="ps-btn-outline">Crear cuenta gratis</Link>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}

function IconEye()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }
function IconTarget()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
function IconShield()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function IconTrend()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function IconStar() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }

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
