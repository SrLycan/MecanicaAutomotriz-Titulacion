import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import api from '../../services/api';

const SERVICIOS = [
    { titulo: 'Mantenimiento Preventivo', desc: 'Cambio de aceite, filtros, bujias y revision general de fluidos.',                  icon: <IconWrench />, color: '#c9a227' },
    { titulo: 'Frenos y Suspension',      desc: 'Pastillas, discos, amortiguadores y rotulas. Tu seguridad es lo primero.',          icon: <IconShield />, color: '#38bdf8' },
    { titulo: 'Diagnostico Computarizado',desc: 'Lectura de codigos de falla con equipo certificado. Sin suposiciones.',             icon: <IconCpu />,    color: '#a78bfa' },
    { titulo: 'Sistema Electrico',        desc: 'Bateria, alternador, arranque, cableado y sensores. Fallas complejas resueltas.',   icon: <IconZap />,    color: '#f59e0b' },
    { titulo: 'Alineacion y Balanceo',    desc: 'Alineacion laser de precision y balanceo de ruedas.',                                icon: <IconTarget />, color: '#10b981' },
    { titulo: 'Correccion de Carroceria', desc: 'Enderezada, masilla y pintura con acabados de calidad.',                             icon: <IconTool />,   color: '#ef4444' },
];

const STATS = [
    { valor: '10+',   label: 'Anos de experiencia' },
    { valor: '80+',   label: 'Vehiculos al mes' },
    { valor: '1000+', label: 'Clientes registrados' },
    { valor: '24h',   label: 'Diagnostico rapido' },
];

export default function Home() {
    const [sucursales, setSucursales] = useState([]);
    useEffect(() => {
        api.get('/sucursales/public').then(r => setSucursales(r.data.sucursales || [])).catch(() => {});
    }, []);

    return (
        <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #050505; color: #fff; }

                /* ── Animaciones ── */
                @keyframes pubFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
                @keyframes pubFloat  { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
                @keyframes pubOrb    { 0%, 100% { opacity: .45; transform: scale(1); } 50% { opacity: .75; transform: scale(1.12); } }
                @keyframes pubSpin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pubSpinRev{ from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
                @keyframes pubScan   { 0% { transform: translateY(-100%); } 100% { transform: translateY(200%); } }
                @keyframes pubGlow   { 0%, 100% { box-shadow: 0 0 30px rgba(201,162,39,.3); } 50% { box-shadow: 0 0 60px rgba(201,162,39,.55); } }
                @keyframes pubLine   { from { background-position: 0 0; } to { background-position: 60px 0; } }
                @keyframes pubPulse  { 0%, 100% { opacity: .9; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }

                /* ── Botones ── */
                .ps-btn-primary {
                    display: inline-flex; align-items: center; gap: 10px;
                    font-family: 'Outfit', sans-serif; font-weight: 700; font-size: .92rem;
                    color: #0a0a0a; background: #c9a227; border: none; border-radius: 999px;
                    padding: 15px 32px; cursor: pointer; text-decoration: none;
                    transition: all .25s cubic-bezier(.4,0,.2,1);
                    position: relative; overflow: hidden;
                    box-shadow: 0 8px 24px -6px rgba(201,162,39,.5);
                }
                .ps-btn-primary::before {
                    content: ''; position: absolute; inset: 0;
                    background: linear-gradient(135deg, #e0b830, #f4c93a);
                    opacity: 0; transition: opacity .25s;
                }
                .ps-btn-primary > * { position: relative; z-index: 1; }
                .ps-btn-primary:hover::before { opacity: 1; }
                .ps-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 36px -8px rgba(201,162,39,.7); }
                .ps-btn-outline {
                    display: inline-flex; align-items: center; gap: 10px;
                    font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .92rem;
                    color: #fff; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.18);
                    border-radius: 999px; padding: 14px 32px; cursor: pointer; text-decoration: none;
                    transition: all .25s cubic-bezier(.4,0,.2,1); backdrop-filter: blur(8px);
                }
                .ps-btn-outline:hover { border-color: #c9a227; color: #c9a227; background: rgba(201,162,39,.08); transform: translateY(-2px); }

                /* ── Cards ── */
                .gh-card {
                    background: linear-gradient(180deg, #141414 0%, #0e0e0e 100%);
                    border: 1px solid rgba(255,255,255,.07);
                    border-radius: 16px;
                    padding: 30px 26px;
                    transition: all .35s cubic-bezier(.4,0,.2,1);
                    position: relative; overflow: hidden;
                }
                .gh-card::before {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(201,162,39,.6), transparent);
                    opacity: 0; transition: opacity .35s;
                }
                .gh-card:hover { border-color: rgba(201,162,39,.45); transform: translateY(-6px); box-shadow: 0 24px 60px -20px rgba(0,0,0,.8), 0 0 0 1px rgba(201,162,39,.1); }
                .gh-card:hover::before { opacity: 1; }
                .gh-card .icon-wrap { transition: transform .35s, background .35s; }
                .gh-card:hover .icon-wrap { transform: scale(1.1) rotate(-5deg); }

                /* ── Tipografia con gradiente ── */
                .grad-text-gold {
                    background: linear-gradient(135deg, #c9a227 0%, #f4c93a 50%, #c9a227 100%);
                    -webkit-background-clip: text; background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .grad-text-white {
                    background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,.65) 100%);
                    -webkit-background-clip: text; background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                /* ── Helpers ── */
                .pub-section { animation: pubFadeUp .7s cubic-bezier(.4,0,.2,1) both; }
                .glow-orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(60px); }
                .grid-pattern {
                    background-image:
                        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
                    background-size: 48px 48px;
                }
                .scan-line {
                    position: absolute; left: 0; right: 0; height: 2px;
                    background: linear-gradient(90deg, transparent, rgba(56,189,248,.55), transparent);
                    animation: pubScan 4s linear infinite;
                }
                .mech-card { transition: transform .35s, border-color .35s, box-shadow .35s; }
                .mech-card:hover { transform: translateY(-5px); border-color: rgba(255,255,255,.18); }
                .stat-num { font-family: 'Bebas Neue', sans-serif; letter-spacing: .03em; }
                .mono { font-family: 'JetBrains Mono', monospace; }

                /* ── Scrollbar ── */
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: rgba(201,162,39,.3); border-radius: 8px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(201,162,39,.6); }
            `}</style>

            <Navbar />

            {/* ════════════════════════════════════════════════════════
                HERO — estilo PlayStation: gradiente dramático + auto 3D
            ════════════════════════════════════════════════════════ */}
            <section style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                {/* Fondo dramático */}
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top right, #1a1408 0%, #0a0a0a 45%, #050505 100%)' }} />
                <div className="grid-pattern" style={{ position: 'absolute', inset: 0, opacity: .5, maskImage: 'radial-gradient(ellipse 80% 50% at 50% 40%, black, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 40%, black, transparent 75%)' }} />

                {/* Orbes flotantes */}
                <div className="glow-orb" style={{ top: '15%', right: '10%', width: 380, height: 380, background: 'radial-gradient(closest-side, rgba(201,162,39,.35), transparent)', animation: 'pubOrb 8s ease-in-out infinite' }} />
                <div className="glow-orb" style={{ bottom: '10%', left: '5%', width: 320, height: 320, background: 'radial-gradient(closest-side, rgba(56,189,248,.18), transparent)', animation: 'pubOrb 9s ease-in-out infinite 2s' }} />

                {/* Líneas decorativas verticales */}
                <div style={{ position: 'absolute', top: '8%', right: '8%', width: 1, height: '50%', background: 'linear-gradient(to bottom, transparent, rgba(201,162,39,.3), transparent)' }} />
                <div style={{ position: 'absolute', top: '20%', right: '12%', width: 1, height: '35%', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,.1), transparent)' }} />

                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '120px 28px 80px', position: 'relative', zIndex: 1, width: '100%' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 40, alignItems: 'center' }}>
                        {/* Izquierda: copy */}
                        <div className="pub-section">
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(201,162,39,.08)', border: '1px solid rgba(201,162,39,.25)', marginBottom: 24, backdropFilter: 'blur(8px)' }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c9a227', boxShadow: '0 0 10px #c9a227', animation: 'pubPulse 2s ease-in-out infinite' }} />
                                <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.2em', color: '#c9a227', fontWeight: 500 }}>PONCIANO ALTO · QUITO · EC</p>
                            </div>

                            <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(3.2rem, 7.5vw, 6.2rem)', letterSpacing: '.02em', lineHeight: .92, marginBottom: 22 }}>
                                <span className="grad-text-white">TU VEHICULO</span><br />
                                <span className="grad-text-gold">EN MANOS</span><br />
                                <span className="grad-text-white">EXPERTAS.</span>
                            </h1>

                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: 'clamp(.95rem, 1.6vw, 1.1rem)', color: 'rgba(255,255,255,.62)', lineHeight: 1.75, marginBottom: 36, maxWidth: 540 }}>
                                Taller automotriz especializado con mas de <strong style={{ color: '#fff', fontWeight: 600 }}>10 anos de experiencia</strong>. Diagnostico computarizado, repuestos certificados y tecnicos en constante capacitacion.
                            </p>

                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                <Link to="/servicios" className="ps-btn-primary">
                                    Agendar Servicio
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </Link>
                                <Link to="/nosotros" className="ps-btn-outline">
                                    Conocer Mas
                                </Link>
                            </div>

                            {/* Mini chips */}
                            <div style={{ display: 'flex', gap: 10, marginTop: 36, flexWrap: 'wrap' }}>
                                {['Diagnostico OBD2', 'Repuestos OEM', 'Garantia escrita'].map(t => (
                                    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', fontFamily: "'Outfit'", fontSize: '.78rem', color: 'rgba(255,255,255,.75)' }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Derecha: auto 3D */}
                        <div className="pub-section" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
                            <Car3DGold />
                        </div>
                    </div>

                    {/* Stats inline */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 0, marginTop: 80, maxWidth: 920, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 36 }}>
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
            <div style={{ background: 'linear-gradient(90deg, #c9a227 0%, #e0b830 100%)', padding: '20px 28px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, opacity: .12, backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 12px, rgba(0,0,0,.4) 12px 14px)' }} />
                <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, position: 'relative' }}>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.92rem', color: '#0a0a0a' }}>
                        Lun-Vie 8:00 - 18:00 · Sab 8:00 - 14:00 · Ponciano Alto, Quito
                    </p>
                    <Link to="/servicios" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.88rem', color: '#0a0a0a', textDecoration: 'none', borderBottom: '2px solid rgba(0,0,0,.3)' }}>
                        Agenda tu cita ahora
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </Link>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                MECHANICAL SHOWCASE — 3D parts (estilo Spotify)
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding: '120px 28px', maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
                <div className="glow-orb" style={{ top: '20%', left: '-10%', width: 400, height: 400, background: 'radial-gradient(closest-side, rgba(56,189,248,.12), transparent)', animation: 'pubOrb 10s ease-in-out infinite' }} />

                <div style={{ textAlign: 'center', marginBottom: 80, position: 'relative' }}>
                    <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: '#c9a227', marginBottom: 14, fontWeight: 500 }}>// ESPECIALIDADES</p>
                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.4rem, 5vw, 4rem)', letterSpacing: '.02em', marginBottom: 16, lineHeight: 1 }}>
                        <span className="grad-text-white">Trabajamos cada </span>
                        <span className="grad-text-gold">pieza</span>
                        <span className="grad-text-white"> con precision.</span>
                    </h2>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.55)', maxWidth: 580, margin: '0 auto', lineHeight: 1.7 }}>
                        Desde el motor hasta los frenos, cada componente recibe atencion experta con herramientas certificadas.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22 }}>
                    <MechCard
                        title="Motor y Distribucion"
                        subtitle="Reconstruccion · Diagnostico"
                        bg="linear-gradient(135deg, #1e1408 0%, #0a0a0a 100%)"
                        accent="#c9a227"
                        illustration={<Gear3D color="#c9a227" />}
                        stats={[{ k: '500+', v: 'motores' }, { k: '12 mo', v: 'garantia' }]}
                    />
                    <MechCard
                        title="Frenos y Discos"
                        subtitle="Pastillas · Hidraulico · ABS"
                        bg="linear-gradient(135deg, #061a25 0%, #0a0a0a 100%)"
                        accent="#38bdf8"
                        illustration={<BrakeDisc3D />}
                        stats={[{ k: '< 2h', v: 'instalacion' }, { k: 'OEM', v: 'repuestos' }]}
                    />
                    <MechCard
                        title="Herramientas Pro"
                        subtitle="Escaner OBD2 · Bancos · Torque"
                        bg="linear-gradient(135deg, #1a0a25 0%, #0a0a0a 100%)"
                        accent="#a78bfa"
                        illustration={<Wrench3D />}
                        stats={[{ k: '100%', v: 'certificadas' }, { k: 'Bosch', v: 'aliados' }]}
                    />
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                SERVICIOS — grid completo
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding: '120px 28px', background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 50%, #050505 100%)', borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)', position: 'relative', overflow: 'hidden' }}>
                <div className="grid-pattern" style={{ position: 'absolute', inset: 0, opacity: .25, maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)' }} />

                <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20, marginBottom: 60 }}>
                        <div>
                            <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: '#c9a227', marginBottom: 12, fontWeight: 500 }}>// SERVICIOS</p>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.4rem, 4.5vw, 3.4rem)', letterSpacing: '.04em', lineHeight: 1, maxWidth: 600 }}>
                                <span className="grad-text-white">Todo lo que tu </span>
                                <span className="grad-text-gold">auto necesita.</span>
                            </h2>
                        </div>
                        <Link to="/servicios" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', color: 'rgba(255,255,255,.6)', textDecoration: 'none', transition: 'color .2s' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#c9a227'}
                              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.6)'}>
                            Ver todos
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </Link>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
                        {SERVICIOS.map((s, i) => (
                            <div key={i} className="gh-card">
                                <div className="icon-wrap" style={{ width: 52, height: 52, borderRadius: 12, background: `${s.color}14`, border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, marginBottom: 22 }}>
                                    {s.icon}
                                </div>
                                <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.25rem', letterSpacing: '.04em', color: '#fff', marginBottom: 10 }}>{s.titulo}</h3>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.88rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.7, marginBottom: 18 }}>{s.desc}</p>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.78rem', color: s.color }}>
                                    Saber mas
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════
                POR QUE ELEGIRNOS — asimétrico estilo Spotify
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding: '120px 28px', maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
                    <div>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: '#c9a227', marginBottom: 14, fontWeight: 500 }}>// POR QUE SSWAP</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 3.6vw, 3.2rem)', letterSpacing: '.03em', lineHeight: 1.02, marginBottom: 24 }}>
                            <span className="grad-text-white">Servicio Tecnico con<br />Estandares </span>
                            <span className="grad-text-gold">Profesionales.</span>
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.98rem', color: 'rgba(255,255,255,.55)', lineHeight: 1.85, marginBottom: 36 }}>
                            En SSWAP combinamos experiencia humana con tecnologia de punta. Cada vehiculo que entra a nuestro taller recibe un diagnostico riguroso y un trabajo con garantia escrita.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                'Diagnostico computarizado en cada revision',
                                'Repuestos originales o equivalentes certificados',
                                'Garantia en mano de obra y materiales',
                                'Historial digital de tu vehiculo',
                                'Transparencia total en presupuestos',
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 12, borderRadius: 10, transition: 'background .2s' }}
                                     onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,162,39,.04)'}
                                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(201,162,39,.15)', border: '1px solid rgba(201,162,39,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.92rem', color: 'rgba(255,255,255,.78)', lineHeight: 1.55 }}>{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Datos visuales con engranaje 3D */}
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-8%', right: '-8%', width: 220, height: 220, opacity: .25, animation: 'pubFloat 6s ease-in-out infinite' }}>
                            <Gear3D color="#c9a227" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, position: 'relative' }}>
                            {[
                                { val: '10+',  lab: 'Anos en el mercado',    color: '#c9a227' },
                                { val: '80+',  lab: 'Vehiculos al mes',      color: '#38bdf8' },
                                { val: '1000+',lab: 'Clientes en base',      color: '#c9a227' },
                                { val: '100%', lab: 'Diagnostico digital',   color: '#fff'    },
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
                <section style={{ padding: '120px 28px', background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 100%)', borderTop: '1px solid rgba(255,255,255,.04)', position: 'relative', overflow: 'hidden' }}>
                    <div className="scan-line" />
                    <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
                        <div style={{ textAlign: 'center', marginBottom: 60 }}>
                            <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: '#c9a227', marginBottom: 14, fontWeight: 500 }}>// UBICACIONES</p>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)', letterSpacing: '.04em', lineHeight: 1, marginBottom: 18 }}>
                                <span className="grad-text-white">Visitanos en </span>
                                <span className="grad-text-gold">cualquier sucursal.</span>
                            </h2>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.55)', maxWidth: 580, margin: '0 auto', lineHeight: 1.7 }}>
                                Equipo tecnico, infraestructura y atencion profesional en cada ubicacion.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
                            {sucursales.map(s => (
                                <div key={s.id} className="gh-card" style={{ paddingTop: 36 }}>
                                    {s.es_principal && (
                                        <span style={{ position: 'absolute', top: 16, right: 16, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 999, background: 'rgba(201,162,39,.12)', border: '1px solid rgba(201,162,39,.32)', color: '#c9a227', fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.22em' }}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                            PRINCIPAL
                                        </span>
                                    )}
                                    <div className="icon-wrap" style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(201,162,39,.12)', border: '1px solid rgba(201,162,39,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a227', marginBottom: 18 }}>
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    </div>
                                    <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.35rem', letterSpacing: '.04em', color: '#fff', marginBottom: 4 }}>{s.nombre}</h3>
                                    {s.ciudad && <p className="mono" style={{ fontWeight: 400, fontSize: '.74rem', color: '#c9a227', letterSpacing: '.08em', marginBottom: 16 }}>{s.ciudad.toUpperCase()}</p>}

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
                    </div>
                </section>
            )}

            {/* ════════════════════════════════════════════════════════
                CTA REGISTRO — estilo PlayStation (banner dramático)
            ════════════════════════════════════════════════════════ */}
            <section style={{ padding: '120px 28px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
                    <div style={{
                        position: 'relative', overflow: 'hidden',
                        background: 'linear-gradient(135deg, #1e1408 0%, #0a0a0a 50%, #06141c 100%)',
                        border: '1px solid rgba(201,162,39,.22)',
                        borderRadius: 24, padding: 'clamp(40px, 8vw, 80px) clamp(28px, 5vw, 60px)',
                        textAlign: 'center',
                    }}>
                        <div className="glow-orb" style={{ top: '-20%', left: '15%', width: 360, height: 360, background: 'radial-gradient(closest-side, rgba(201,162,39,.32), transparent)', animation: 'pubOrb 7s ease-in-out infinite' }} />
                        <div className="glow-orb" style={{ bottom: '-30%', right: '10%', width: 320, height: 320, background: 'radial-gradient(closest-side, rgba(56,189,248,.18), transparent)', animation: 'pubOrb 9s ease-in-out infinite 1.5s' }} />

                        <div style={{ position: 'relative' }}>
                            <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: '#c9a227', marginBottom: 18, fontWeight: 500 }}>// PORTAL DE CLIENTES</p>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', letterSpacing: '.03em', marginBottom: 20, lineHeight: 1.02 }}>
                                <span className="grad-text-white">Crea tu cuenta y </span>
                                <span className="grad-text-gold">controla todo.</span>
                            </h2>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1.02rem', color: 'rgba(255,255,255,.58)', maxWidth: 580, margin: '0 auto 40px', lineHeight: 1.7 }}>
                                Consulta el estado de tu reparacion, agenda citas y revisa el historial completo de servicios de tu vehiculo.
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

function MechCard({ title, subtitle, bg, accent, illustration, stats }) {
    return (
        <div className="mech-card" style={{
            background: bg, border: `1px solid rgba(255,255,255,.07)`,
            borderRadius: 18, padding: 28, position: 'relative', overflow: 'hidden',
            minHeight: 360,
        }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: .7 }} />
            <div style={{ position: 'absolute', bottom: -40, right: -40, width: 180, height: 180, opacity: .9 }}>
                {illustration}
            </div>
            <div style={{ position: 'relative' }}>
                <p className="mono" style={{ fontSize: '.66rem', letterSpacing: '.22em', color: accent, marginBottom: 12, fontWeight: 500 }}>{subtitle.toUpperCase()}</p>
                <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: '#fff', lineHeight: 1, maxWidth: 220 }}>{title}</h3>

                <div style={{ display: 'flex', gap: 22, marginTop: 'auto', position: 'relative', paddingTop: 90 }}>
                    {stats.map((s, i) => (
                        <div key={i}>
                            <p className="stat-num" style={{ fontSize: '1.5rem', color: accent, lineHeight: 1 }}>{s.k}</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.72rem', color: 'rgba(255,255,255,.5)', marginTop: 4 }}>{s.v}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   AUTO 3D (versión gold para hero)
   ═══════════════════════════════════════════════════════════════ */
function Car3DGold() {
    const stageRef = useRef(null);
    const handleMouseMove = (e) => {
        const stage = stageRef.current; if (!stage) return;
        const w = stage.closest('[data-car]'); if (!w) return;
        const r = w.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top)  / r.height - 0.5;
        stage.style.transform = `rotateX(${8 - y * 12}deg) rotateY(${-14 + x * 22}deg)`;
    };
    const handleLeave = () => { if (stageRef.current) stageRef.current.style.transform = 'rotateX(8deg) rotateY(-14deg)'; };

    return (
        <div data-car onMouseMove={handleMouseMove} onMouseLeave={handleLeave}
             style={{ position: 'relative', width: '100%', maxWidth: 540, aspectRatio: '5 / 3', perspective: '1400px', perspectiveOrigin: '50% 40%' }}>
            {/* Carretera */}
            <div style={{ position: 'absolute', bottom: '10%', left: '14%', right: '14%', height: 2,
                          backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0 18px, transparent 18px 36px)',
                          animation: 'pubLine 0.55s linear infinite', opacity: .35 }} />
            {/* Sombra debajo */}
            <div style={{ position: 'absolute', bottom: '6%', left: '10%', right: '10%', height: 30, borderRadius: '50%',
                          background: 'radial-gradient(ellipse, rgba(201,162,39,.45), rgba(201,162,39,0) 65%)',
                          filter: 'blur(12px)' }} />
            <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
                <div ref={stageRef} style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: 'rotateX(8deg) rotateY(-14deg)', transition: 'transform .35s cubic-bezier(.4,0,.2,1)' }}>
                    <CarSVGGold />
                </div>
            </div>
        </div>
    );
}

function CarSVGGold() {
    return (
        <svg viewBox="0 0 500 250" xmlns="http://www.w3.org/2000/svg"
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                      filter: 'drop-shadow(0 14px 26px rgba(201,162,39,0.40)) drop-shadow(0 6px 10px rgba(0,0,0,0.6))' }}>
            <defs>
                <linearGradient id="goldBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#fef3c7" />
                    <stop offset="22%"  stopColor="#fde68a" />
                    <stop offset="45%"  stopColor="#f4c93a" />
                    <stop offset="65%"  stopColor="#c9a227" />
                    <stop offset="85%"  stopColor="#92710a" />
                    <stop offset="100%" stopColor="#3d2c00" />
                </linearGradient>
                <linearGradient id="goldRoof" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#fef9c3" />
                    <stop offset="50%"  stopColor="#f4c93a" />
                    <stop offset="100%" stopColor="#a87a14" />
                </linearGradient>
                <linearGradient id="darkGlass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#1f2937" />
                    <stop offset="50%" stopColor="#0a0a0a" />
                    <stop offset="100%" stopColor="#020617" />
                </linearGradient>
                <radialGradient id="tireGold" cx=".5" cy=".5" r=".55">
                    <stop offset="0%"   stopColor="#374151" />
                    <stop offset="55%"  stopColor="#111827" />
                    <stop offset="100%" stopColor="#020617" />
                </radialGradient>
                <radialGradient id="rimGold" cx=".4" cy=".35" r=".75">
                    <stop offset="0%"   stopColor="#fef3c7" />
                    <stop offset="40%"  stopColor="#f4c93a" />
                    <stop offset="75%"  stopColor="#92710a" />
                    <stop offset="100%" stopColor="#1f2937" />
                </radialGradient>
                <radialGradient id="lampGold" cx=".4" cy=".4" r=".6">
                    <stop offset="0%"   stopColor="#ffffff" />
                    <stop offset="40%"  stopColor="#fef9c3" />
                    <stop offset="100%" stopColor="#a87a14" />
                </radialGradient>
                <linearGradient id="goldSpec" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"  stopColor="white" stopOpacity="0" />
                    <stop offset="48%" stopColor="white" stopOpacity="0" />
                    <stop offset="50%" stopColor="white" stopOpacity="0.7" />
                    <stop offset="52%" stopColor="white" stopOpacity="0" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                    <animate attributeName="x1" values="-1;1.5" dur="4s" repeatCount="indefinite" />
                    <animate attributeName="x2" values="0;2.5" dur="4s" repeatCount="indefinite" />
                </linearGradient>
                <path id="bodyG"
                      d="M 32 178 Q 32 162 50 158 L 82 152 Q 132 138 168 128 L 192 88
                         Q 200 76 217 74 L 335 74 Q 352 76 362 92 L 388 130 L 426 138
                         Q 462 145 467 168 L 467 186 L 32 186 Z" />
            </defs>

            <ellipse cx="250" cy="194" rx="210" ry="6" fill="rgba(0,0,0,0.5)" />
            <use href="#bodyG" fill="url(#goldBody)" stroke="#3d2c00" strokeWidth="1.3" />
            <path d="M 178 126 L 199 86 Q 205 76 220 74 L 332 74 Q 345 76 354 90 L 374 126 Z" fill="url(#goldRoof)" stroke="#3d2c00" strokeWidth=".9" />
            <path d="M 188 122 L 207 88 Q 211 80 220 80 L 252 80 L 252 122 Z" fill="url(#darkGlass)" opacity=".95" />
            <path d="M 257 80 L 328 80 Q 340 82 348 92 L 365 122 L 257 122 Z" fill="url(#darkGlass)" opacity=".95" />
            <path d="M 194 118 L 213 88 L 222 88 L 202 118 Z" fill="rgba(255,255,255,0.30)" />
            <path d="M 268 86 L 295 86 L 287 102 L 263 102 Z" fill="rgba(255,255,255,0.18)" />
            <line x1="255" y1="80" x2="255" y2="122" stroke="#3d2c00" strokeWidth="3" />
            <rect x="50" y="142" width="375" height="3" fill="rgba(255,255,255,0.45)" opacity=".85" />
            <path d="M 50 176 L 450 178 L 446 186 L 54 186 Z" fill="#3d2c00" opacity=".85" />
            <line x1="255" y1="125" x2="255" y2="180" stroke="#3d2c00" strokeWidth="1" opacity=".55" />
            <rect x="218" y="148" width="22" height="3.5" rx="1.5" fill="#3d2c00" />
            <rect x="268" y="148" width="22" height="3.5" rx="1.5" fill="#3d2c00" />
            <path d="M 198 86 L 191 96 Q 188 102 195 104 L 204 104 L 204 86 Z" fill="url(#goldBody)" stroke="#3d2c00" strokeWidth=".8" />
            <ellipse cx="196" cy="98" rx="3" ry="2" fill="#111827" />
            <ellipse cx="455" cy="152" rx="12" ry="8" fill="url(#lampGold)" />
            <ellipse cx="455" cy="152" rx="5" ry="3.5" fill="rgba(255,255,255,0.95)" />
            <circle cx="448" cy="172" r="4.5" fill="#fde68a" opacity=".95" stroke="#3d2c00" strokeWidth=".8" />
            <path d="M 405 142 L 442 148 L 440 153 L 403 147 Z" fill="#3d2c00" />
            <path d="M 407 150 L 440 156 L 438 160 L 405 154 Z" fill="#3d2c00" opacity=".65" />
            <rect x="34" y="146" width="16" height="14" rx="2.5" fill="#7f1d1d" stroke="#3d2c00" strokeWidth="1" />
            <rect x="36" y="148" width="4" height="10" rx="1" fill="rgba(255,255,255,0.5)" />
            <rect x="20" y="168" width="20" height="16" rx="3.5" fill="#3d2c00" />
            <rect x="458" y="164" width="22" height="18" rx="3.5" fill="#3d2c00" />
            <text x="195" y="168" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="11" letterSpacing="3" fill="rgba(0,0,0,0.65)">SSWAP</text>
            <use href="#bodyG" fill="url(#goldSpec)" pointerEvents="none" />
            <ellipse cx="110" cy="186" rx="38" ry="10" fill="#3d2c00" opacity=".55" />
            <ellipse cx="390" cy="186" rx="38" ry="10" fill="#3d2c00" opacity=".55" />
            {[110, 390].map((cx, i) => (
                <g key={cx}>
                    <circle cx={cx} cy="188" r="33" fill="url(#tireGold)" stroke="#020617" strokeWidth="1.5" />
                    <circle cx={cx} cy="188" r="29" fill="#0f172a" />
                    <circle cx={cx} cy="188" r="24" fill="none" stroke="#1e293b" strokeWidth="2" />
                    <g style={{ transformOrigin: `${cx}px 188px`, animation: `pubSpin 1.8s linear infinite ${i ? '-0.5s' : '0s'}` }}>
                        <circle cx={cx} cy="188" r="21" fill="url(#rimGold)" stroke="#92710a" strokeWidth="1" />
                        {[0, 60, 120, 180, 240, 300].map(deg => (
                            <g key={deg} transform={`rotate(${deg} ${cx} 188)`}>
                                <rect x={cx - 3} y="170" width="6" height="36" rx="2.5" fill="#fde68a" stroke="#92710a" strokeWidth=".4" />
                            </g>
                        ))}
                        <circle cx={cx} cy="188" r="7" fill="#3d2c00" stroke="#0f172a" strokeWidth="1" />
                        <circle cx={cx} cy="188" r="2" fill="#020617" />
                    </g>
                </g>
            ))}
            {/* Herramientas mecanicas */}
            <g transform="translate(360, 42)">
                <circle cx="0" cy="0" r="30" fill="rgba(201,162,39,0.12)" stroke="rgba(201,162,39,0.5)" strokeWidth="1.5" />
                <g transform="rotate(-30)">
                    <path d="M -5 -20 L 5 -20 L 6 -8 Q 16 0 16 12 Q 16 24 0 24 Q -16 24 -16 12 Q -16 0 -6 -8 Z"
                          fill="#fde68a" stroke="#c9a227" strokeWidth="1.2" />
                    <circle cx="0" cy="12" r="6" fill="#1f2937" stroke="#c9a227" strokeWidth="1" />
                </g>
            </g>
            <g transform="translate(398, 78)">
                <circle cx="0" cy="0" r="17" fill="#1f2937" stroke="#c9a227" strokeWidth="1.5" />
                {[0, 60, 120, 180, 240, 300].map(deg => (
                    <rect key={deg} x="-3" y="-19" width="6" height="9" rx="1" fill="#c9a227" transform={`rotate(${deg})`} />
                ))}
                <circle cx="0" cy="0" r="5" fill="#0a0a0a" />
            </g>
        </svg>
    );
}

/* ═══════════════════════════════════════════════════════════════
   ENGRANAJE 3D — Gear
   ═══════════════════════════════════════════════════════════════ */
function Gear3D({ color = '#c9a227' }) {
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
                {/* 12 dientes externos */}
                {Array.from({ length: 12 }).map((_, i) => {
                    const deg = (i * 360) / 12;
                    return (
                        <rect key={i} x="92" y="6" width="16" height="28" rx="2"
                              fill={`url(#gearBody-${color})`} stroke="#000" strokeWidth=".5"
                              transform={`rotate(${deg} 100 100)`} />
                    );
                })}
                {/* Cuerpo */}
                <circle cx="100" cy="100" r="72" fill={`url(#gearBody-${color})`} stroke="#000" strokeWidth="1" />
                {/* Anillo interno */}
                <circle cx="100" cy="100" r="55" fill="none" stroke="#0a0a0a" strokeWidth="2" opacity=".55" />
                {/* Centro */}
                <circle cx="100" cy="100" r="34" fill={`url(#gearInner-${color})`} stroke={color} strokeWidth="2" />
                {/* Radios internos */}
                {[0, 60, 120, 180, 240, 300].map(deg => (
                    <rect key={deg} x="98" y="65" width="4" height="70" rx="2"
                          fill={color} opacity=".5"
                          transform={`rotate(${deg} 100 100)`} />
                ))}
                {/* Hub central */}
                <circle cx="100" cy="100" r="10" fill={color} stroke="#000" strokeWidth="1.2" />
                <circle cx="100" cy="100" r="4" fill="#0a0a0a" />
            </svg>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   DISCO DE FRENO 3D
   ═══════════════════════════════════════════════════════════════ */
function BrakeDisc3D() {
    return (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', perspective: 800 }}>
            <svg viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                                                transform: 'rotateX(58deg) rotateZ(-15deg)', transformOrigin: 'center',
                                                filter: 'drop-shadow(0 16px 22px rgba(56,189,248,.35)) drop-shadow(0 6px 10px rgba(0,0,0,.5))' }}>
                <defs>
                    <radialGradient id="discMetal" cx=".5" cy=".5" r=".5">
                        <stop offset="0%"   stopColor="#cbd5e1" />
                        <stop offset="55%"  stopColor="#64748b" />
                        <stop offset="100%" stopColor="#1e293b" />
                    </radialGradient>
                    <radialGradient id="discCenter" cx=".5" cy=".5" r=".5">
                        <stop offset="0%"   stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#020617" />
                    </radialGradient>
                </defs>
                {/* Disco exterior */}
                <circle cx="100" cy="100" r="90" fill="url(#discMetal)" stroke="#020617" strokeWidth="1" />
                {/* Ventilación: agujeros */}
                <g style={{ animation: 'pubSpin 8s linear infinite', transformOrigin: '100px 100px' }}>
                    {Array.from({ length: 16 }).map((_, i) => {
                        const deg = (i * 360) / 16;
                        return <circle key={i} cx="100" cy="40" r="4.5" fill="#0a0a0a"
                                       transform={`rotate(${deg} 100 100)`} />;
                    })}
                    {/* Líneas radiales */}
                    {Array.from({ length: 24 }).map((_, i) => {
                        const deg = (i * 360) / 24;
                        return <rect key={i} x="99" y="20" width="2" height="20" rx="1"
                                     fill="#1e293b" opacity=".6"
                                     transform={`rotate(${deg} 100 100)`} />;
                    })}
                </g>
                {/* Anillo interior */}
                <circle cx="100" cy="100" r="42" fill="url(#discCenter)" stroke="#38bdf8" strokeWidth="1.5" opacity=".85" />
                {/* Tornillos centrales */}
                {[0, 72, 144, 216, 288].map(deg => (
                    <g key={deg} transform={`rotate(${deg} 100 100)`}>
                        <circle cx="100" cy="76" r="5" fill="#475569" stroke="#020617" strokeWidth=".8" />
                        <circle cx="100" cy="76" r="2" fill="#0a0a0a" />
                    </g>
                ))}
                {/* Centro */}
                <circle cx="100" cy="100" r="14" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                <circle cx="100" cy="100" r="4" fill="#020617" />
            </svg>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   LLAVE INGLESA 3D
   ═══════════════════════════════════════════════════════════════ */
function Wrench3D() {
    return (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', perspective: 800 }}>
            <svg viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                                                transform: 'rotate(-32deg)', transformOrigin: 'center',
                                                animation: 'pubFloat 4s ease-in-out infinite',
                                                filter: 'drop-shadow(0 14px 20px rgba(167,139,250,.4)) drop-shadow(0 6px 10px rgba(0,0,0,.5))' }}>
                <defs>
                    <linearGradient id="wrenchMetal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#e2e8f0" />
                        <stop offset="40%"  stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#5b21b6" />
                    </linearGradient>
                    <linearGradient id="wrenchEdge" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"  stopColor="rgba(255,255,255,0.65)" />
                        <stop offset="50%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                </defs>
                {/* Cabeza superior (boca abierta) */}
                <path d="M 90 20
                         Q 80 18 76 28
                         L 76 50
                         Q 80 58 88 58
                         L 108 58
                         L 108 48
                         L 96 48
                         L 96 30
                         L 108 30
                         L 108 20 Z"
                      fill="url(#wrenchMetal)" stroke="#1a0e3a" strokeWidth="1.5" />
                {/* Mango central */}
                <path d="M 92 56 L 108 56 L 130 158 L 110 168 L 88 168 L 78 158 Z"
                      fill="url(#wrenchMetal)" stroke="#1a0e3a" strokeWidth="1.5" />
                {/* Cabeza inferior (boca cerrada / box) */}
                <ellipse cx="100" cy="174" rx="22" ry="18" fill="url(#wrenchMetal)" stroke="#1a0e3a" strokeWidth="1.5" />
                <ellipse cx="100" cy="174" rx="11" ry="9" fill="#0a0a0a" stroke="#1a0e3a" strokeWidth="1" />
                {/* Highlight central */}
                <rect x="92" y="60" width="4" height="100" fill="rgba(255,255,255,0.45)" />
                {/* Grip lines en el mango */}
                {Array.from({ length: 5 }).map((_, i) => (
                    <rect key={i} x="86" y={90 + i * 12} width="28" height="2.5" rx="1" fill="rgba(0,0,0,.45)" />
                ))}
                {/* Edge highlight superior */}
                <rect x="78" y="22" width="3" height="32" fill="rgba(255,255,255,0.55)" />
            </svg>
        </div>
    );
}

function IconWrench() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }
function IconShield() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function IconCpu()    { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>; }
function IconZap()    { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function IconTarget() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>; }
function IconTool()   { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }
function IconPin()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function IconPhone()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>; }
function IconClock()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
