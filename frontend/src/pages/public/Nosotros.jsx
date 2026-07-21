import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import api from '../../services/api';

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
        foto: 'https://images.unsplash.com/photo-1602233158242-3ba0ac4d2167?q=80&w=600&auto=format&fit=crop',
    },
    {
        nombre: 'Ayudante de Taller', cargo: 'Apoyo mecánico y de pintura', badge: 'Equipo de apoyo',
        especialidad: 'Preparación de vehículos y orden del taller', frase: 'Aprendiendo cada día para crecer junto al taller.',
        foto: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=600&auto=format&fit=crop',
    },
];

const GALERIA = [
    { url: 'https://images.unsplash.com/photo-1632823469850-1b7b1e8b7692?q=80&w=900&auto=format&fit=crop', cap: 'Nuestro taller', big: true },
    { url: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?q=80&w=700&auto=format&fit=crop', cap: 'Motor en revisión' },
    { url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=700&auto=format&fit=crop', cap: 'Herramientas de precisión', tall: true },
    { url: 'https://images.unsplash.com/photo-1600661653561-629509216228?q=80&w=700&auto=format&fit=crop', cap: 'Cabina de pintura' },
    { url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=700&auto=format&fit=crop', cap: 'Técnicos en acción', tall: true },
    { url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=700&auto=format&fit=crop', cap: 'Vehículo listo para entrega' },
];

const TESTIMONIOS = [
    { nombre: 'Maria Fernanda Lopez', rol: 'Cliente de SS SWAP Garage', texto: 'Me explicaron con claridad qué necesitaba mi auto y cuánto iba a costar antes de tocarlo. Se siente honesto.', foto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop' },
    { nombre: 'Juan Pablo Rios',      rol: 'Cliente de SS SWAP Garage', texto: 'Respondieron mi WhatsApp en minutos y me mandaron fotos del avance. Se nota que quieren hacer las cosas bien.',        foto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=200&auto=format&fit=crop' },
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

    return (
        <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
                * { box-sizing: border-box; }
                body { background: #050505; }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: rgba(59,123,171,.3); border-radius: 8px; }

                @keyframes nsFadeUp   { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
                @keyframes nsOrb      { 0%, 100% { opacity: .4; transform: scale(1); } 50% { opacity: .7; transform: scale(1.1); } }
                @keyframes nsKenBurns { 0% { transform: scale(1.08); } 100% { transform: scale(1.18); } }
                @keyframes nsBounce   { 0%, 100% { transform: translateY(0); opacity: .5; } 50% { transform: translateY(8px); opacity: 1; } }
                .ns-fade { animation: nsFadeUp .6s cubic-bezier(.4,0,.2,1) both; }
                .reveal { opacity: 0; transform: translateY(24px); transition: opacity .6s cubic-bezier(.4,0,.2,1), transform .6s cubic-bezier(.4,0,.2,1); }
                .reveal.in-view { opacity: 1; transform: none; }
                .glow-orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(60px); }

                .mono { font-family: 'JetBrains Mono', monospace; }
                .grad-text-gold  { background: linear-gradient(135deg, #3b7bab 0%, #7fabce 50%, #3b7bab 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
                .grad-text-white { background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,.65) 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

                .ns-card { background: linear-gradient(180deg, rgba(255,255,255,.045) 0%, rgba(255,255,255,.015) 100%); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 28px 24px; transition: all .3s cubic-bezier(.4,0,.2,1); }
                .ns-card:hover { border-color: rgba(59,123,171,.4); transform: translateY(-5px); box-shadow: 0 20px 40px -18px rgba(0,0,0,.6); }
                .ns-card:hover .ns-icon { transform: scale(1.08) rotate(-4deg); }
                .ns-icon { transition: transform .3s; }

                .ns-mv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
                .ns-pad { padding: 120px 28px; }

                .ps-btn-primary { display: inline-flex; align-items: center; gap: 10px; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: .92rem; color: #0a0a0a; background: #3b7bab; border: none; border-radius: 999px; padding: 15px 32px; cursor: pointer; text-decoration: none; transition: all .25s cubic-bezier(.4,0,.2,1); box-shadow: 0 8px 24px -6px rgba(59,123,171,.5); }
                .ps-btn-primary:hover { background: #5a93c4; transform: translateY(-2px); box-shadow: 0 14px 36px -8px rgba(59,123,171,.7); }
                .ps-btn-outline { display: inline-flex; align-items: center; gap: 10px; font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .92rem; color: #fff; background: rgba(255,255,255,.05); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.2); border-radius: 999px; padding: 14px 32px; cursor: pointer; text-decoration: none; transition: all .25s; }
                .ps-btn-outline:hover { border-color: #3b7bab; color: #3b7bab; background: rgba(59,123,171,.08); transform: translateY(-2px); }

                @media (max-width: 900px) {
                    .ns-pad { padding: 76px 20px; }
                    .ns-mv-grid { grid-template-columns: 1fr; }
                }
                @media (max-width: 560px) {
                    .ns-pad { padding: 60px 16px; }
                }

                /* ── Hero ── */
                .ns-hero { min-height: auto; display: flex; align-items: center; }
                .ns-hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 60px; align-items: center; max-width: 1240px; margin: 0 auto; width: 100%; }
                .ns-hero-eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; background: rgba(59,123,171,.08); border: 1px solid rgba(59,123,171,.25); backdrop-filter: blur(6px); }
                .ns-hero-photo-wrap { position: relative; border-radius: 26px; overflow: hidden; aspect-ratio: 4 / 5; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 40px 90px -28px rgba(0,0,0,.75), 0 0 60px -30px rgba(59,123,171,.5); }
                .ns-hero-photo-wrap img { position: absolute; inset: -4%; width: 108%; height: 108%; object-fit: cover; animation: nsKenBurns 20s ease-in-out infinite alternate; }
                .ns-hero-photo-wrap::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(5,5,5,.75) 100%); }
                .ns-hero-photo-badge { position: absolute; left: 20px; bottom: 20px; right: 20px; z-index: 2; display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 14px; background: rgba(6,8,10,.55); border: 1px solid rgba(59,123,171,.3); backdrop-filter: blur(10px); }
                .ns-scroll-ind { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; opacity: .6; }
                .ns-scroll-ind span { width: 1px; height: 30px; background: linear-gradient(180deg, ${GOLD}, transparent); }
                .ns-scroll-ind svg { animation: nsBounce 1.8s ease-in-out infinite; }
                @media (max-width: 960px) {
                    .ns-hero-grid { grid-template-columns: 1fr; gap: 40px; }
                    .ns-hero-photo-wrap { aspect-ratio: 16 / 10; order: -1; }
                }
                @media (max-width: 700px) { .ns-hero { min-height: auto; } }

                /* ── Equipo de mecanicos (tarjetas con foto) ── */
                .ns-team-card {
                    position: relative; border-radius: 20px; overflow: hidden;
                    background: linear-gradient(180deg, rgba(255,255,255,.035) 0%, rgba(255,255,255,.012) 100%);
                    border: 1px solid rgba(255,255,255,.08);
                    backdrop-filter: blur(6px);
                    transition: transform .35s cubic-bezier(.4,0,.2,1), border-color .35s, box-shadow .35s;
                }
                .ns-team-card:hover { transform: translateY(-8px); border-color: rgba(59,123,171,.4); box-shadow: 0 24px 50px -20px rgba(0,0,0,.7), 0 0 40px -18px rgba(59,123,171,.5); }
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
                .ns-team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 22px; }
                .ns-team-body { padding: 20px 20px 24px; }
                .ns-scroll-hint { display: none; align-items: center; gap: 6px; font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .74rem; color: rgba(255,255,255,.4); margin-top: 8px; }
                .ns-team-tag {
                    display: inline-block; margin-top: 10px; padding: 4px 10px; border-radius: 999px;
                    background: rgba(59,123,171,.1); border: 1px solid rgba(59,123,171,.25);
                    font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .7rem; color: #9ec3e0;
                }
                .ns-team-quote {
                    font-family: 'Outfit', sans-serif; font-weight: 300; font-style: italic; font-size: .84rem;
                    color: rgba(255,255,255,.55); line-height: 1.6; margin-top: 12px; padding-top: 12px;
                    border-top: 1px solid rgba(255,255,255,.07);
                }

                /* ── Diferenciales ── */
                .ns-diff-card { display: flex; gap: 16px; align-items: flex-start; }
                .ns-diff-icon { flex: none; width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(59,123,171,.1); border: 1px solid rgba(59,123,171,.3); color: #7fabce; }

                /* ── Enderezada y pintura (especialidad) ── */
                .ns-spec-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 44px; align-items: center; margin-bottom: 44px; }
                .ns-spec-photo-main { position: relative; border-radius: 22px; overflow: hidden; aspect-ratio: 4 / 3; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 30px 70px -26px rgba(0,0,0,.7); }
                .ns-spec-photo-main img { width: 100%; height: 100%; object-fit: cover; }
                .ns-spec-photo-tag { position: absolute; left: 16px; bottom: 16px; padding: 6px 14px; border-radius: 999px; background: rgba(6,8,10,.6); border: 1px solid rgba(59,123,171,.4); backdrop-filter: blur(8px); font-family: 'JetBrains Mono', monospace; font-size: .66rem; letter-spacing: .08em; color: #7fabce; }
                .ns-spec-chip { display: inline-block; padding: 7px 14px; border-radius: 999px; background: rgba(59,123,171,.1); border: 1px solid rgba(59,123,171,.28); font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .78rem; color: #9ec3e0; }
                .ns-spec-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr)); gap: 20px; }
                .ns-spec-step-photo { border-radius: 14px; overflow: hidden; aspect-ratio: 16 / 10; margin-bottom: 14px; }
                .ns-spec-step-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s cubic-bezier(.4,0,.2,1); }
                .ns-spec-step:hover .ns-spec-step-photo img { transform: scale(1.06); }
                @media (max-width: 860px) {
                    .ns-spec-grid { grid-template-columns: 1fr; gap: 28px; }
                    .ns-spec-photo-main { order: -1; aspect-ratio: 16 / 10; }
                }

                /* ── Linea de tiempo premium ── */
                .ns-timeline-v2 { position: relative; }
                .ns-timeline-v2::before { content: ''; position: absolute; left: 20px; top: 8px; bottom: 8px; width: 1px; background: linear-gradient(180deg, rgba(59,123,171,.65), rgba(59,123,171,.05)); }
                @media (min-width: 720px) { .ns-timeline-v2::before { left: 50%; transform: translateX(-50%); } }
                .ns-tl-row { position: relative; display: flex; margin-bottom: 22px; }
                .ns-tl-dot { position: absolute; left: 20px; top: 26px; transform: translate(-50%, -50%); width: 12px; height: 12px; border-radius: 50%; background: ${GOLD}; box-shadow: 0 0 0 5px rgba(59,123,171,.15); z-index: 2; }
                @media (min-width: 720px) { .ns-tl-dot { left: 50%; } }
                .ns-tl-card { margin-left: 46px; width: 100%; }
                @media (min-width: 720px) {
                    .ns-tl-row { justify-content: flex-start; }
                    .ns-tl-row.right { justify-content: flex-end; }
                    .ns-tl-card { width: calc(50% - 46px); margin-left: 46px; }
                    .ns-tl-row.right .ns-tl-card { margin-left: 0; margin-right: 46px; text-align: right; }
                }
                .ns-tl-year { font-family: 'Bebas Neue', sans-serif; font-size: 1.4rem; letter-spacing: .04em; color: ${GOLD}; }

                /* Animacion lateral (solo linea de tiempo): las tarjetas entran desde los lados al hacer scroll */
                .ns-timeline-v2 .ns-tl-row.reveal { opacity: 0; transform: translateX(-90px); transition: opacity .8s cubic-bezier(.4,0,.2,1), transform .8s cubic-bezier(.4,0,.2,1); }
                .ns-timeline-v2 .ns-tl-row.reveal.right { transform: translateX(90px); }
                .ns-timeline-v2 .ns-tl-row.reveal.in-view { opacity: 1; transform: translateX(0); }
                @media (max-width: 719px) {
                    .ns-timeline-v2 .ns-tl-row.reveal,
                    .ns-timeline-v2 .ns-tl-row.reveal.right { transform: translateX(-60px); }
                }

                /* ── Galeria — carrusel horizontal (desktop y mobile) ── */
                .ns-gallery {
                    display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory;
                    padding-bottom: 16px; -webkit-overflow-scrolling: touch;
                    scrollbar-width: thin; scrollbar-color: rgba(59,123,171,.4) transparent;
                }
                .ns-gallery::-webkit-scrollbar { height: 8px; }
                .ns-gallery::-webkit-scrollbar-track { background: transparent; }
                .ns-gallery::-webkit-scrollbar-thumb { background: rgba(59,123,171,.35); border-radius: 8px; }
                .ns-gallery-item { position: relative; flex: 0 0 auto; width: 320px; height: 400px; border-radius: 14px; overflow: hidden; cursor: pointer; scroll-snap-align: start; }
                .ns-gallery-item.big  { width: 460px; }
                .ns-gallery-item.tall { width: 300px; }
                .ns-gallery-item img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform .55s cubic-bezier(.4,0,.2,1), filter .4s; }
                .ns-gallery-item:hover img { transform: scale(1.08); filter: brightness(.5); }
                .ns-gallery-overlay {
                    position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; justify-content: flex-end; padding: 16px;
                    opacity: 0; transition: opacity .35s;
                }
                .ns-gallery-item:hover .ns-gallery-overlay { opacity: 1; }
                .ns-gallery-expand {
                    position: absolute; top: 14px; right: 14px; width: 30px; height: 30px; border-radius: 50%;
                    background: rgba(5,5,5,.55); border: 1px solid rgba(255,255,255,.25); backdrop-filter: blur(6px);
                    display: flex; align-items: center; justify-content: center; color: #fff;
                    transform: scale(.7); transition: transform .3s;
                }
                .ns-gallery-item:hover .ns-gallery-expand { transform: scale(1); }
                .ns-gallery-caption { font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .8rem; color: #fff; }
                @media (max-width: 720px) {
                    .ns-gallery-item        { width: 78vw; height: 300px; }
                    .ns-gallery-item.big    { width: 82vw; }
                    .ns-gallery-item.tall   { width: 74vw; }
                }

                /* ── Carrusel horizontal en mobile (Equipo) ── */
                @media (max-width: 720px) {
                    .ns-scroll-hint { display: inline-flex; }

                    .ns-team-grid { display: flex; overflow-x: auto; gap: 16px; padding-bottom: 10px; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
                    .ns-team-grid::-webkit-scrollbar { display: none; }
                    .ns-team-grid .ns-team-card { flex: 0 0 76%; max-width: 300px; scroll-snap-align: start; }
                }

                .ns-scroll-hint-gallery { display: inline-flex; align-items: center; gap: 6px; font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .74rem; color: rgba(255,255,255,.4); margin-top: 8px; }

                /* ── Lightbox ── */
                .ns-lightbox { position: fixed; inset: 0; z-index: 200; background: rgba(3,4,6,.92); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 40px; animation: nsFadeUp .25s ease both; }
                .ns-lightbox img { max-width: min(92vw, 1100px); max-height: 84vh; border-radius: 14px; box-shadow: 0 40px 90px -20px rgba(0,0,0,.8); }
                .ns-lightbox-close { position: absolute; top: 26px; right: 26px; width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.2); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }

                /* ── Video institucional ── */
                .ns-video-frame {
                    position: relative; width: 100%; aspect-ratio: 16 / 8; border-radius: 22px; overflow: hidden;
                    border: 1px solid rgba(255,255,255,.1); box-shadow: 0 30px 70px -24px rgba(0,0,0,.7);
                    background: #000;
                }
                .ns-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }

                /* ── Estadisticas animadas ── */
                .ns-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; border-radius: 20px; overflow: hidden; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); }
                .ns-stat-cell { background: linear-gradient(180deg, rgba(255,255,255,.035) 0%, rgba(255,255,255,.01) 100%); backdrop-filter: blur(8px); padding: 40px 20px; text-align: center; }
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

                /* ── CTA final ── */
                .ns-cta-box { position: relative; overflow: hidden; background: linear-gradient(135deg, #0d1a24 0%, #0a0a0a 50%, #06141c 100%); border: 1px solid rgba(59,123,171,.22); border-radius: 24px; padding: clamp(40px, 7vw, 70px) clamp(28px, 5vw, 56px); text-align: center; }
            `}</style>

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
                            <span className="grad-text-gold">construido con calidad y confianza.</span>
                        </h1>
                        <p className="ns-fade" style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: 'clamp(.95rem,1.3vw,1.05rem)', color: 'rgba(255,255,255,.6)', maxWidth: 520, marginBottom: 34, lineHeight: 1.8, animationDelay: '.1s' }}>
                            SS SWAP Garage nace en Tola Chica – La Morita combinando mecánica general y colisiones bajo un mismo techo, con diagnóstico claro, garantía por escrito y atención directa por WhatsApp.
                        </p>
                        <div className="ns-fade" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animationDelay: '.15s' }}>
                            <Link to="/servicios" className="ps-btn-primary">Conocer nuestros servicios
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </Link>
                            <Link to="/servicios" className="ps-btn-outline">Agendar servicio</Link>
                        </div>
                    </div>
                    <div className="ns-hero-photo-wrap reveal">
                        <img
                            src="https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?q=80&w=1200&auto=format&fit=crop"
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
                            <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.25em', color: GOLD, marginBottom: 14 }}>MISION</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.75)', lineHeight: 1.8 }}>
                                Brindar servicios confiables, rápidos y garantizados para vehículos livianos — mecánica general y colisiones — generando fidelización real y un crecimiento sostenible del taller.
                            </p>
                        </div>
                        <div className="reveal ns-card" style={{ transitionDelay: '90ms', borderColor: 'rgba(74,131,179,.2)' }}>
                            <p className="mono" style={{ fontSize: '.68rem', letterSpacing: '.25em', color: '#4a83b3', marginBottom: 14 }}>VISION</p>
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
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// HACIA DONDE VAMOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Un crecimiento </span>
                            <span className="grad-text-gold">planificado, paso a paso.</span>
                        </h2>
                    </div>
                    <div className="ns-timeline-v2">
                        {HITOS.map((h, i) => (
                            <div key={h.anio} className={`ns-tl-row reveal${i % 2 === 1 ? ' right' : ''}`} style={{ transitionDelay: `${i * 70}ms` }}>
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
                            <span className="grad-text-white">¿Por que elegir </span>
                            <span className="grad-text-gold">SS SWAP?</span>
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

            {/* EQUIPO DE MECANICOS */}
            <section className="ns-pad">
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// NUESTRO EQUIPO</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Personas detras de </span>
                            <span className="grad-text-gold">cada reparacion.</span>
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
                            <span className="grad-text-gold">el fuerte de SS SWAP.</span>
                        </h2>
                    </div>

                    <div className="ns-spec-grid reveal">
                        <div className="ns-spec-photo-main">
                            <img
                                src="https://images.unsplash.com/photo-1632823469850-1b7b1e8b7692?q=80&w=1200&auto=format&fit=crop"
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
                            { titulo: 'Lijado y preparación', desc: 'Superficie lista y sin defectos antes de aplicar una sola gota de pintura.', foto: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=700&auto=format&fit=crop' },
                            { titulo: 'Pintura por capas',    desc: 'Color uniforme, sin burbujas ni rayas visibles, capa por capa en cabina.',   foto: 'https://images.unsplash.com/photo-1600661653561-629509216228?q=80&w=700&auto=format&fit=crop' },
                            { titulo: 'Pulido y acabado',     desc: 'Terminación limpia y brillo parejo antes de la entrega del vehículo.',        foto: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=700&auto=format&fit=crop' },
                        ].map((s, i) => (
                            <div key={s.titulo} className="ns-card ns-spec-step reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                                <div className="ns-spec-step-photo">
                                    <img src={s.foto} alt={s.titulo} loading="lazy" onError={e => { e.currentTarget.style.opacity = 0; }} />
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
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// GALERIA</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Un vistazo a </span>
                            <span className="grad-text-gold">nuestro taller.</span>
                        </h2>
                        <p className="ns-scroll-hint-gallery" style={{ justifyContent: 'center', width: '100%' }}>
                            Desliza para ver mas fotos
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
                        <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 12, fontWeight: 500 }}>// CONOCENOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '.03em' }}>
                            <span className="grad-text-white">Un recorrido por </span>
                            <span className="grad-text-gold">SS SWAP.</span>
                        </h2>
                    </div>
                    <div className="ns-video-frame reveal">
                        <iframe
                            src="https://www.youtube.com/embed/iv4M8trjXrE"
                            title="Video institucional SS SWAP"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
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
                    <div className="reveal in-view ns-cta-box">
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', letterSpacing: '.03em', marginBottom: 18, lineHeight: 1.05 }}>
                            <span className="grad-text-white">¿Listo para devolverle la vida a </span>
                            <span className="grad-text-gold">tu vehículo?</span>
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.58)', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
                            Revisa nuestro catálogo de servicios o crea tu cuenta para llevar el control de tu historial automotriz.
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