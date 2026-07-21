import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import api from '../../services/api';
import colisionesImg from "../../assets/colisiones.png";
import bannerGrandeImg from "../../assets/bannergrande.png";
const MAPA_EMBED_SRC = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d953.2894989157679!2d-78.37253773829565!3d-0.21855914339467258!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91d5931de96a4297%3A0x456635055317eed8!2sInsignia%20Automotriz!5e1!3m2!1sen!2sec!4v1784479118759!5m2!1sen!2sec";

const STATS = [
    { valor: '10+',   label: 'Años de experiencia' },
    { valor: '80+',   label: 'Vehículos al mes' },
    { valor: '1000+', label: 'Clientes registrados' },
    { valor: '24h',   label: 'Diagnóstico rápido' },
];

const ESPECIALIDADES = [
    { titulo: 'Motor y Distribución',      desc: 'Reconstrucción, cambio de correas y diagnóstico de fallas complejas del motor.', img: '/servicios/motor.png', color: '#3b7bab' },
    { titulo: 'Frenos y Discos',           desc: 'Pastillas, discos y sistema hidráulico revisados con precisión milimétrica.',    img: '/servicios/frenos.png', color: '#4a83b3' },
    { titulo: 'Diagnóstico Computarizado', desc: 'Escáner OBD2 de última generación para leer cada código de falla sin adivinar.',  img: '/servicios/diagnostico.png', color: '#6f8ba3' },
    { titulo: 'Colisiones',                desc: 'Enderezada de carrocería, masilla y pintura con acabado de fábrica.',              img: '/servicios/colisiones.png', color: '#57708a' },
    { titulo: 'Cambio de Aceite',          desc: 'Aceite, filtros y fluidos con productos certificados por el fabricante.',          img: '/servicios/aceite.png', color: '#7fabce' },
    { titulo: 'Suspensión',                desc: 'Amortiguadores, rótulas y terminales para un manejo suave y seguro.',              img: '/servicios/suspension.png', color: '#3a4149' },
    { titulo: 'Electricidad Automotriz',   desc: 'Batería, alternador, arranque y cableado. Fallas eléctricas resueltas a fondo.',    img: '/servicios/electronica.png', color: '#3b7bab' },
    { titulo: 'Alineación y Balanceo',     desc: 'Alineación láser y balanceo de ruedas para un desgaste uniforme del neumático.',    img: '/servicios/alineacion.png', color: '#4a83b3' },
];

export default function Home() {
    const [sucursales, setSucursales] = useState([]);
    useEffect(() => {
        api.get('/sucursales/public').then(r => setSucursales(r.data.sucursales || [])).catch(() => {});
    }, []);

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
    }, [sucursales]);

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
                @keyframes pubGlow   { 0%, 100% { box-shadow: 0 0 30px rgba(59,123,171,.3); } 50% { box-shadow: 0 0 60px rgba(59,123,171,.55); } }
                @keyframes pubLine   { from { background-position: 0 0; } to { background-position: 60px 0; } }
                @keyframes pubPulse  { 0%, 100% { opacity: .9; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }

                /* ── Botones ── */
                .ps-btn-primary {
                    display: inline-flex; align-items: center; gap: 10px;
                    font-family: 'Outfit', sans-serif; font-weight: 700; font-size: .92rem;
                    color: #fff; background: linear-gradient(135deg, #2b5c85, #3b7bab); border: none; border-radius: 999px;
                    padding: 15px 32px; cursor: pointer; text-decoration: none;
                    transition: all .25s cubic-bezier(.4,0,.2,1);
                    position: relative; overflow: hidden; isolation: isolate;
                    box-shadow: 0 8px 24px -6px rgba(59,123,171,.5);
                }
                .ps-btn-primary::before {
                    content: ''; position: absolute; inset: 0; z-index: -1;
                    background: linear-gradient(135deg, #5a93c4, #7fabce);
                    opacity: 0; transition: opacity .25s;
                }
                .ps-btn-primary > * { position: relative; z-index: 1; }
                .ps-btn-primary:hover::before { opacity: 1; }
                .ps-btn-primary:hover { color: #fff; transform: translateY(-2px); box-shadow: 0 14px 36px -8px rgba(59,123,171,.7); }
                .ps-btn-outline {
                    display: inline-flex; align-items: center; gap: 10px;
                    font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .92rem;
                    color: #fff; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.18);
                    border-radius: 999px; padding: 14px 32px; cursor: pointer; text-decoration: none;
                    transition: all .25s cubic-bezier(.4,0,.2,1); backdrop-filter: blur(8px);
                }
                .ps-btn-outline:hover { border-color: #3b7bab; color: #3b7bab; background: rgba(59,123,171,.08); transform: translateY(-2px); }

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
                    background: linear-gradient(90deg, transparent, rgba(59,123,171,.6), transparent);
                    opacity: 0; transition: opacity .35s;
                }
                .gh-card:hover { border-color: rgba(59,123,171,.45); transform: translateY(-6px); box-shadow: 0 24px 60px -20px rgba(0,0,0,.8), 0 0 0 1px rgba(59,123,171,.1); }
                .gh-card:hover::before { opacity: 1; }
                .gh-card .icon-wrap { transition: transform .35s, background .35s; }
                .gh-card:hover .icon-wrap { transform: scale(1.1) rotate(-5deg); }

                /* ── Tipografia con gradiente ── */
                .grad-text-gold {
                    background: linear-gradient(135deg, #3b7bab 0%, #7fabce 50%, #3b7bab 100%);
                    -webkit-background-clip: text; background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .grad-text-white {
                    background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,.65) 100%);
                    -webkit-background-clip: text; background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                /* ── Rainbow shimmer (destello que recorre el texto) ── */
                @keyframes shimmerSweep {
                    0%   { background-position: -300% center; }
                    100% { background-position:  300% center; }
                }
                .grad-text-rainbow {
                    background: linear-gradient(
                        90deg,
                        #3b7bab 0%, #7fabce 18%, #cfe3f3 34%, #7fabce 50%,
                        #3b7bab 66%, #4a83b3 82%, #3b7bab 100%
                    );
                    background-size: 280% auto;
                    -webkit-background-clip: text; background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: shimmerSweep 5s linear infinite;
                    filter: drop-shadow(0 0 18px rgba(59,123,171,.55)) drop-shadow(0 0 36px rgba(127,171,206,.3));
                }

                /* ── Particulas flotantes ambientales ── */
                @keyframes floatParticle {
                    0%   { transform: translateY(0) translateX(0); opacity: 0; }
                    10%  { opacity: 1; }
                    90%  { opacity: 1; }
                    100% { transform: translateY(-140px) translateX(18px); opacity: 0; }
                }
                @keyframes particleDrift {
                    0%, 100% { transform: translateY(0) translateX(0); }
                    50%      { transform: translateY(-14px) translateX(6px); }
                }
                .particles-field { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
                .particle-dot {
                    position: absolute; border-radius: 50%;
                    background: radial-gradient(circle, rgba(127,171,206,.95) 0%, rgba(59,123,171,.15) 70%, transparent 100%);
                    animation: floatParticle linear infinite;
                }
                .particle-ring {
                    position: absolute; border-radius: 50%;
                    border: 1.5px solid rgba(127,171,206,.28);
                    animation: particleDrift ease-in-out infinite;
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
                /* (Se retiró el separador ".scan-line" de UBICACIONES: su animación por porcentaje
                   quedaba limitada a los 2px de su propia altura, por eso se veía "atascada"
                   y se reiniciaba de forma abrupta en vez de recorrer la sección). */
                /* Separador azul inferior — se renderiza SIEMPRE detrás/debajo del texto que acompaña */
                .section-tag-underline { z-index: 2; }
                .section-tag-underline::after {
                    content: ''; position: absolute; left: 50%; bottom: 0;
                    transform: translateX(-50%);
                    width: 46px; height: 2px; border-radius: 2px;
                    background: linear-gradient(90deg, transparent, #3b7bab, transparent);
                    z-index: -1;
                }
                .mech-card { transition: transform .35s, border-color .35s, box-shadow .35s; }
                .mech-card:hover { transform: translateY(-5px); border-color: rgba(255,255,255,.18); }
                .stat-num { font-family: 'Bebas Neue', sans-serif; letter-spacing: .03em; }
                .mono { font-family: 'JetBrains Mono', monospace; }

                /* ── Scrollbar ── */
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: rgba(59,123,171,.3); border-radius: 8px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(59,123,171,.6); }

                /* ── Scroll reveal ── */
                .reveal { opacity: 0; transform: translateY(26px); transition: opacity .7s cubic-bezier(.4,0,.2,1), transform .7s cubic-bezier(.4,0,.2,1); }
                .reveal.in-view { opacity: 1; transform: none; }

                /* ── Layout responsivo ── */
                .hero-grid   { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 40px; align-items: center; }
                .why-grid    { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
                .pub-section-pad { padding: 120px 28px; }
                .hero-section-pad { padding: 150px 28px 70px; }
                @keyframes carFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .car-float { animation: carFloat 5s ease-in-out infinite; }

                @media (max-width: 900px) {
                    .hero-grid  { grid-template-columns: 1fr; gap: 56px; }
                    .why-grid   { grid-template-columns: 1fr; gap: 48px; }
                    .pub-section-pad  { padding: 76px 20px; }
                    .hero-section-pad { padding: 120px 20px 56px; }
                }
                @media (max-width: 560px) {
                    .pub-section-pad  { padding: 60px 16px; }
                    .hero-section-pad { padding: 108px 16px 48px; }
                    .ps-btn-primary, .ps-btn-outline { width: 100%; justify-content: center; }
                }

                /* ── Hero video panel ── */
                .hero-media { display: flex; align-items: center; justify-content: center; }
                .hero-video-frame {
                    position: relative; width: 100%; max-width: 540px; aspect-ratio: 5 / 4.4;
                    border-radius: 26px; overflow: hidden; isolation: isolate;
                    border: 1px solid rgba(255,255,255,.12);
                    box-shadow: 0 30px 70px -20px rgba(0,0,0,.7), 0 0 0 1px rgba(59,123,171,.08);
                    animation: pubFadeUp .9s cubic-bezier(.4,0,.2,1);
                }
                .hero-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
                .hero-video-overlay {
                    position: absolute; inset: 0; z-index: 1;
                    background:
                        linear-gradient(180deg, rgba(5,5,5,.05) 0%, rgba(5,5,5,.15) 55%, rgba(5,5,5,.75) 100%),
                        linear-gradient(90deg, rgba(5,5,5,.35) 0%, transparent 35%, transparent 65%, rgba(5,5,5,.35) 100%);
                }
                .hero-video-scan {
                    position: absolute; left: 0; right: 0; height: 40%; z-index: 1; pointer-events: none;
                    background: linear-gradient(180deg, rgba(59,123,171,.16), transparent);
                    animation: pubScan 4.5s ease-in-out infinite;
                }
                .hero-video-halo {
                    position: absolute; inset: -10%; z-index: -1; border-radius: 32px;
                    background: radial-gradient(closest-side, rgba(59,123,171,.28), transparent 70%);
                    filter: blur(30px); opacity: .8;
                }
                .hero-glass-badge {
                    position: absolute; z-index: 2; display: flex; align-items: center; gap: 10px;
                    padding: 12px 16px; border-radius: 14px;
                    background: rgba(10,12,15,.55); border: 1px solid rgba(255,255,255,.14);
                    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,.6);
                    animation: pubFloat 6s ease-in-out infinite;
                }
                .hero-glass-badge--top { top: 18px; left: 18px; animation-delay: .2s; }
                .hero-glass-badge--bottom { bottom: 18px; right: 18px; left: 18px; animation-delay: 1s; }
                .hero-glass-dot { width: 9px; height: 9px; min-width: 9px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 10px #4ade80; animation: pubPulse 1.8s ease-in-out infinite; }
                .hero-glass-icon { width: 30px; height: 30px; min-width: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: rgba(59,123,171,.18); color: #7fabce; }
                .hero-glass-badge-title { font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .8rem; color: #fff; line-height: 1.3; }
                .hero-glass-badge-sub { font-family: 'Outfit', sans-serif; font-weight: 300; font-size: .7rem; color: rgba(255,255,255,.6); margin-top: 1px; }

                .hero-trust-bar {
                    display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
                    margin-top: 56px; border-radius: 18px; overflow: hidden;
                    background: rgba(255,255,255,.06);
                    border: 1px solid rgba(255,255,255,.08);
                }
                .hero-trust-item {
                    display: flex; align-items: center; gap: 12px; padding: 18px 20px;
                    background: rgba(255,255,255,.02); transition: background .25s;
                }
                .hero-trust-item:hover { background: rgba(59,123,171,.07); }
                .hero-trust-icon {
                    width: 38px; height: 38px; min-width: 38px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(59,123,171,.12); border: 1px solid rgba(59,123,171,.28); color: #7fabce;
                }
                .hero-trust-k { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: .85rem; color: #fff; line-height: 1.3; text-transform: capitalize; }
                .hero-trust-v { font-family: 'Outfit', sans-serif; font-weight: 300; font-size: .72rem; color: rgba(255,255,255,.55); margin-top: 1px; text-transform: capitalize; }

                @media (max-width: 900px) {
                    .hero-trust-bar { grid-template-columns: repeat(2, 1fr); }
                    .hero-video-frame { max-width: 460px; margin: 0 auto; }
                }
                @media (max-width: 560px) {
                    .hero-trust-bar { grid-template-columns: 1fr; }
                }

                /* ── Colisiones spotlight ── */
                .col-spotlight {
                    display: grid; grid-template-columns: 1.05fr 1fr; gap: 56px; align-items: center;
                }
                .col-media {
                    position: relative; border-radius: 24px; overflow: hidden; aspect-ratio: 4 / 3.2;
                    border: 1px solid rgba(255,255,255,.1);
                    box-shadow: 0 30px 70px -24px rgba(0,0,0,.7);
                }
                .col-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s cubic-bezier(.4,0,.2,1); }
                .col-media:hover img { transform: scale(1.05); }
                .col-media-overlay {
                    position: absolute; inset: 0;
                    background: linear-gradient(0deg, rgba(5,5,5,.75) 0%, rgba(5,5,5,.05) 55%), linear-gradient(120deg, rgba(43,92,133,.25), transparent 60%);
                }
                .col-badge {
                    position: absolute; top: 20px; left: 20px; z-index: 2;
                    display: inline-flex; align-items: center; gap: 8px;
                    padding: 9px 16px; border-radius: 999px;
                    background: rgba(10,12,15,.6); border: 1px solid rgba(59,123,171,.5);
                    backdrop-filter: blur(10px);
                    font-family: 'JetBrains Mono', monospace; font-size: .66rem; letter-spacing: .18em; color: #7fabce;
                    box-shadow: 0 8px 24px -8px rgba(0,0,0,.6);
                }
                .col-benefit {
                    display: flex; align-items: flex-start; gap: 12px; padding: 14px 0;
                    border-top: 1px solid rgba(255,255,255,.07);
                }
                .col-benefit:first-of-type { border-top: none; }
                .col-benefit-icon {
                    width: 34px; height: 34px; min-width: 34px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(59,123,171,.14); border: 1px solid rgba(59,123,171,.3); color: #7fabce;
                }
                @media (max-width: 900px) {
                    .col-spotlight { grid-template-columns: 1fr; gap: 36px; }
                }

                /* ── Especialidades — tarjetas con foto ── */
                .sp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
                .sp-card {
                    position: relative; border-radius: 18px; overflow: hidden; aspect-ratio: 3 / 3.6;
                    border: 1px solid rgba(255,255,255,.08);
                    background: linear-gradient(160deg, #141414, #0a0a0a);
                    transition: transform .4s cubic-bezier(.4,0,.2,1), border-color .4s, box-shadow .4s;
                }
                .sp-card:hover { transform: translateY(-6px); border-color: rgba(59,123,171,.4); box-shadow: 0 24px 50px -20px rgba(0,0,0,.75); }
                .sp-card-img {
                    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
                    transition: transform .6s cubic-bezier(.4,0,.2,1), filter .5s;
                    filter: saturate(1.05) contrast(1.02);
                }
                .sp-card:hover .sp-card-img { transform: scale(1.1); filter: saturate(1.05) contrast(1.02) blur(1.5px); }
                .sp-card-overlay {
                    position: absolute; inset: 0;
                    background: linear-gradient(0deg, rgba(5,5,5,.95) 0%, rgba(5,5,5,.55) 42%, rgba(5,5,5,.12) 75%, rgba(5,5,5,.05) 100%);
                    transition: background .4s;
                }
                .sp-card:hover .sp-card-overlay { background: linear-gradient(0deg, rgba(5,5,5,.97) 0%, rgba(5,5,5,.75) 55%, rgba(5,5,5,.35) 100%); }
                .sp-card-body { position: absolute; left: 0; right: 0; bottom: 0; padding: 20px 18px; z-index: 2; }
                .sp-card-title { font-family: 'Bebas Neue'; font-size: 1.15rem; letter-spacing: .03em; color: #fff; line-height: 1.15; margin-bottom: 0; }
                .sp-card-desc {
                    font-family: 'Outfit', sans-serif; font-weight: 300; font-size: .8rem; color: rgba(255,255,255,.65); line-height: 1.55;
                    max-height: 0; opacity: 0; overflow: hidden; transition: max-height .4s cubic-bezier(.4,0,.2,1), opacity .3s, margin .4s;
                }
                .sp-card:hover .sp-card-desc { max-height: 90px; opacity: 1; margin-top: 8px; }
                .sp-card-more {
                    display: inline-flex; align-items: center; gap: 5px; margin-top: 12px;
                    font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .74rem;
                    opacity: 0; transform: translateY(6px); transition: opacity .35s, transform .35s;
                }
                .sp-card:hover .sp-card-more { opacity: 1; transform: none; }
                @media (max-width: 1100px) { .sp-grid { grid-template-columns: repeat(3, 1fr); } }
                @media (max-width: 720px)  { .sp-grid { grid-template-columns: repeat(2, 1fr); } }
                @media (max-width: 460px)  { .sp-grid { grid-template-columns: 1fr; } }
            `}</style>

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
                                        <p className="hero-glass-badge-title">Diagnóstico en vivo</p>
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
                                        <p className="hero-glass-badge-sub">Trabajando ahora mismo</p>
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

                <div className="sp-grid">
                    {ESPECIALIDADES.map((s, i) => (
                        <div key={s.titulo} className="sp-card reveal" style={{ transitionDelay: `${(i % 4) * 60}ms` }}>
                            <img
                                className="sp-card-img"
                                src={s.img}
                                alt={s.titulo}
                                loading="lazy"
                                onError={e => { e.currentTarget.style.display = 'none'; }}
                            />
                            <div className="sp-card-overlay" />
                            <div className="sp-card-body">
                                <h3 className="sp-card-title">{s.titulo}</h3>
                                <p className="sp-card-desc">{s.desc}</p>
                                <Link to="/servicios" className="sp-card-more" style={{ color: s.color, textDecoration: 'none' }}>
                                    Ver mas
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
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
                                { val: '10+',  lab: 'Años en el mercado',    color: '#3b7bab' },
                                { val: '80+',  lab: 'Vehículos al mes',      color: '#4a83b3' },
                                { val: '1000+',lab: 'Clientes en base',      color: '#3b7bab' },
                                { val: '100%', lab: 'Diagnóstico digital',   color: '#fff'    },
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
                                {/* Mapa interactivo — ubicación provisional. Ver comentario // MODIFICAR DIRECCIÓN AQUÍ junto a MAPA_EMBED_SRC al inicio de este archivo. */}
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
            <div className="car-float" style={{ position: 'absolute', bottom: '6%', left: '10%', right: '10%', height: 30, borderRadius: '50%',
                          background: 'radial-gradient(ellipse, rgba(59,123,171,.45), rgba(59,123,171,0) 65%)',
                          filter: 'blur(12px)', animationDelay: '0s' }} />
            <div className="car-float" style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
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
                      filter: 'drop-shadow(0 14px 26px rgba(59,123,171,0.40)) drop-shadow(0 6px 10px rgba(0,0,0,0.6))' }}>
            <defs>
                <linearGradient id="goldBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#e8eef3" />
                    <stop offset="22%"  stopColor="#c3d6e4" />
                    <stop offset="45%"  stopColor="#7fabce" />
                    <stop offset="65%"  stopColor="#3b7bab" />
                    <stop offset="85%"  stopColor="#244f70" />
                    <stop offset="100%" stopColor="#12283b" />
                </linearGradient>
                <linearGradient id="goldRoof" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#dce7f0" />
                    <stop offset="50%"  stopColor="#7fabce" />
                    <stop offset="100%" stopColor="#1b3a57" />
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
                    <stop offset="0%"   stopColor="#e8eef3" />
                    <stop offset="40%"  stopColor="#7fabce" />
                    <stop offset="75%"  stopColor="#244f70" />
                    <stop offset="100%" stopColor="#1f2937" />
                </radialGradient>
                <radialGradient id="lampGold" cx=".4" cy=".4" r=".6">
                    <stop offset="0%"   stopColor="#ffffff" />
                    <stop offset="40%"  stopColor="#dce7f0" />
                    <stop offset="100%" stopColor="#1b3a57" />
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
                <radialGradient id="headBeam" cx=".5" cy=".5" r=".5">
                    <stop offset="0%"  stopColor="#dce7f0" stopOpacity=".85" />
                    <stop offset="100%" stopColor="#dce7f0" stopOpacity="0" />
                </radialGradient>
                <path id="bodyG"
                      d="M 32 178 Q 32 162 50 158 L 82 152 Q 132 138 168 128 L 192 88
                         Q 200 76 217 74 L 335 74 Q 352 76 362 92 L 388 130 L 426 138
                         Q 462 145 467 168 L 467 186 L 32 186 Z" />
            </defs>

            <ellipse cx="250" cy="194" rx="210" ry="6" fill="rgba(0,0,0,0.5)" />

            {/* Haz de luz del faro delantero (pulso) */}
            <ellipse cx="478" cy="154" rx="46" ry="24" fill="url(#headBeam)" opacity=".8">
                <animate attributeName="opacity" values=".45;.85;.45" dur="2.6s" repeatCount="indefinite" />
            </ellipse>
            <use href="#bodyG" fill="url(#goldBody)" stroke="#12283b" strokeWidth="1.3" />
            <path d="M 178 126 L 199 86 Q 205 76 220 74 L 332 74 Q 345 76 354 90 L 374 126 Z" fill="url(#goldRoof)" stroke="#12283b" strokeWidth=".9" />
            <path d="M 188 122 L 207 88 Q 211 80 220 80 L 252 80 L 252 122 Z" fill="url(#darkGlass)" opacity=".95" />
            <path d="M 257 80 L 328 80 Q 340 82 348 92 L 365 122 L 257 122 Z" fill="url(#darkGlass)" opacity=".95" />
            <path d="M 194 118 L 213 88 L 222 88 L 202 118 Z" fill="rgba(255,255,255,0.30)" />
            <path d="M 268 86 L 295 86 L 287 102 L 263 102 Z" fill="rgba(255,255,255,0.18)" />
            <line x1="255" y1="80" x2="255" y2="122" stroke="#12283b" strokeWidth="3" />
            <rect x="50" y="142" width="375" height="3" fill="rgba(255,255,255,0.45)" opacity=".85" />
            <path d="M 50 176 L 450 178 L 446 186 L 54 186 Z" fill="#12283b" opacity=".85" />
            <line x1="255" y1="125" x2="255" y2="180" stroke="#12283b" strokeWidth="1" opacity=".55" />
            <rect x="218" y="148" width="22" height="3.5" rx="1.5" fill="#12283b" />
            <rect x="268" y="148" width="22" height="3.5" rx="1.5" fill="#12283b" />
            <path d="M 198 86 L 191 96 Q 188 102 195 104 L 204 104 L 204 86 Z" fill="url(#goldBody)" stroke="#12283b" strokeWidth=".8" />
            <ellipse cx="196" cy="98" rx="3" ry="2" fill="#111827" />
            <ellipse cx="455" cy="152" rx="12" ry="8" fill="url(#lampGold)" />
            <ellipse cx="455" cy="152" rx="5" ry="3.5" fill="rgba(255,255,255,0.95)" />
            <circle cx="448" cy="172" r="4.5" fill="#c3d6e4" opacity=".95" stroke="#12283b" strokeWidth=".8" />
            <path d="M 405 142 L 442 148 L 440 153 L 403 147 Z" fill="#12283b" />
            <path d="M 407 150 L 440 156 L 438 160 L 405 154 Z" fill="#12283b" opacity=".65" />
            <rect x="34" y="146" width="16" height="14" rx="2.5" fill="#7f1d1d" stroke="#12283b" strokeWidth="1">
                <animate attributeName="fill" values="#7f1d1d;#dc2626;#7f1d1d" dur="2.6s" repeatCount="indefinite" />
            </rect>
            <rect x="36" y="148" width="4" height="10" rx="1" fill="rgba(255,255,255,0.5)" />
            <rect x="20" y="168" width="20" height="16" rx="3.5" fill="#12283b" />
            <rect x="458" y="164" width="22" height="18" rx="3.5" fill="#12283b" />
            <text x="195" y="168" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="11" letterSpacing="3" fill="rgba(0,0,0,0.65)">SS SWAP</text>
            <use href="#bodyG" fill="url(#goldSpec)" pointerEvents="none" />

            {/* Alerón trasero (duck-tail) */}
            <path d="M 128 132 L 172 122 L 180 128 L 182 134 L 138 144 Z" fill="#12283b" opacity=".9" />
            <path d="M 132 133 L 170 124 L 174 128 L 140 138 Z" fill="url(#goldRoof)" opacity=".85" />

            {/* Splitter delantero (labio aerodinámico) */}
            <path d="M 420 183 L 467 178 L 470 188 L 424 191 Z" fill="#161010" opacity=".92" />
            <rect x="424" y="184" width="42" height="2" rx="1" fill="rgba(59,123,171,.6)" />

            {/* Pinstripe lateral */}
            <path d="M 60 160 Q 160 148 260 146 Q 360 146 452 155" fill="none" stroke="rgba(59,123,171,.65)" strokeWidth="1.4" opacity=".8" />

            <ellipse cx="110" cy="186" rx="38" ry="10" fill="#12283b" opacity=".55" />
            <ellipse cx="390" cy="186" rx="38" ry="10" fill="#12283b" opacity=".55" />
            {[110, 390].map((cx, i) => (
                <g key={cx}>
                    <circle cx={cx} cy="188" r="33" fill="url(#tireGold)" stroke="#020617" strokeWidth="1.5" />
                    <circle cx={cx} cy="188" r="29" fill="#0f172a" />
                    <circle cx={cx} cy="188" r="24" fill="none" stroke="#1e293b" strokeWidth="2" />
                    <g style={{ transformOrigin: `${cx}px 188px`, animation: `pubSpin 1.8s linear infinite ${i ? '-0.5s' : '0s'}` }}>
                        <circle cx={cx} cy="188" r="21" fill="url(#rimGold)" stroke="#244f70" strokeWidth="1" />
                        {[0, 60, 120, 180, 240, 300].map(deg => (
                            <g key={deg} transform={`rotate(${deg} ${cx} 188)`}>
                                <rect x={cx - 3} y="170" width="6" height="36" rx="2.5" fill="#c3d6e4" stroke="#244f70" strokeWidth=".4" />
                            </g>
                        ))}
                        <circle cx={cx} cy="188" r="7" fill="#12283b" stroke="#0f172a" strokeWidth="1" />
                        <circle cx={cx} cy="188" r="2" fill="#020617" />
                    </g>
                </g>
            ))}
            {/* Herramientas mecanicas */}
            <g transform="translate(360, 42)">
                <circle cx="0" cy="0" r="30" fill="rgba(59,123,171,0.12)" stroke="rgba(59,123,171,0.5)" strokeWidth="1.5" />
                <g transform="rotate(-30)">
                    <path d="M -5 -20 L 5 -20 L 6 -8 Q 16 0 16 12 Q 16 24 0 24 Q -16 24 -16 12 Q -16 0 -6 -8 Z"
                          fill="#c3d6e4" stroke="#3b7bab" strokeWidth="1.2" />
                    <circle cx="0" cy="12" r="6" fill="#1f2937" stroke="#3b7bab" strokeWidth="1" />
                </g>
            </g>
            <g transform="translate(398, 78)">
                <circle cx="0" cy="0" r="17" fill="#1f2937" stroke="#3b7bab" strokeWidth="1.5" />
                {[0, 60, 120, 180, 240, 300].map(deg => (
                    <rect key={deg} x="-3" y="-19" width="6" height="9" rx="1" fill="#3b7bab" transform={`rotate(${deg})`} />
                ))}
                <circle cx="0" cy="0" r="5" fill="#0a0a0a" />
            </g>
        </svg>
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