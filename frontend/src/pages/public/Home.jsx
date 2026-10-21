/**
 * SS SWAP - Página de Inicio Institucional (Home)
 * Presenta la propuesta de valor del taller: portada con video, servicio de colisiones,
 * especialidades (desde el catálogo), por qué elegirnos, sucursales con mapa y portal de clientes.
 * Estilos en Home.css + styles/web-publica.css (todo bajo .web, no afecta al panel).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import FondoVivo from '../../components/public/FondoVivo';
import api from '../../services/api';
import fotoServicio from '../../components/public/fotoServicio';
import useRevelar from '../../hooks/useRevelar';
import colisionesImg from "../../assets/colisiones.jpg";
import bannerGrandeImg from "../../assets/bannergrande.jpg";
import '../../styles/web-publica.css';
import './Home.css';
// MODIFICAR DIRECCIÓN AQUÍ: URL de embed de Google Maps para la sección de ubicaciones.
// Se genera desde Google Maps → Compartir → Insertar un mapa → copiar el "src" del iframe.
const MAPA_EMBED_SRC = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d953.2894989157679!2d-78.37253773829565!3d-0.21855914339467258!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91d5931de96a4297%3A0x456635055317eed8!2sInsignia%20Automotriz!5e1!3m2!1sen!2sec!4v1784479118759!5m2!1sen!2sec";

const STATS = [
    { valor: '30 min', label: 'Respuesta por WhatsApp' },
    { valor: '5%',     label: 'Retrabajos (máximo)' },
    { valor: '100%',   label: 'Garantía por escrito' },
    { valor: '24/7',   label: 'Atención y seguimiento' },
];

// Las especialidades salen del catalogo de servicios (GET /api/servicios):
// al crear/editar/desactivar un servicio en el panel, el inicio se actualiza solo.

const reduceMovimiento = () => typeof window !== 'undefined' && !!window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Home() {
    const [sucursales, setSucursales] = useState([]);
    const [servicios, setServicios]   = useState([]);
    const raiz = useRef(null);
    const carruselRef = useRef(null);
    const [flechas, setFlechas] = useState({ izq: false, der: false });
    // Con "reducir movimiento" el video no se reproduce solo: queda la imagen de portada.
    const [sinMovimiento] = useState(reduceMovimiento);

    useEffect(() => {
        api.get('/sucursales/public').then(r => setSucursales(r.data.sucursales || [])).catch(() => {});
        api.get('/servicios', { params: { activo: 'true' } }).then(r => setServicios(r.data.servicios || [])).catch(() => {});
    }, []);

    useRevelar(raiz, [sucursales, servicios]);

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
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: sinMovimiento ? 'auto' : 'smooth' });
    };

    const principales = sucursales.filter(s => s.es_principal);
    const otras = sucursales.filter(s => !s.es_principal);

    return (
        <div className="web" ref={raiz}>
            <Navbar />
            <FondoVivo />

            {/* ═══ PORTADA ═══ */}
            <header className="w-hero">
                <div className="w-hero-media" aria-hidden="true" data-w-parallax="0.3">
                    <video
                        className="w-hero-video"
                        autoPlay={!sinMovimiento}
                        muted
                        loop
                        playsInline
                        preload={sinMovimiento ? 'none' : 'auto'}
                        poster="https://images.pexels.com/videos/14514792/pexels-photo-14514792.jpeg?auto=compress&cs=tinysrgb&h=900&fit=crop&w=1200"
                    >
                        <source src="https://videos.pexels.com/video-files/14514792/14514792-uhd_2560_1440_25fps.mp4" type="video/mp4" />
                    </video>
                </div>
                <div className="w-hero-velo" aria-hidden="true" />

                <div className="w-contenedor w-hero-contenido">
                    <div className="w-hero-copy" data-w-parallax="-0.08">
                        <p className="w-hero-ubicacion w-entrada">
                            <span className="w-punto-vivo" aria-hidden="true" />
                            Ponciano Alto · Quito · Ecuador
                        </p>
                        <h1 className="w-hero-titulo w-entrada" style={{ '--w-retraso': '80ms' }}>
                            Restauramos vehículos.<br />
                            <span className="w-acento">Reforzamos confianza.</span>
                        </h1>
                        <p className="w-lead w-hero-lead w-entrada" style={{ '--w-retraso': '160ms' }}>
                            Taller automotriz especializado con más de <strong>10 años de experiencia</strong>. Diagnóstico computarizado, repuestos certificados y técnicos en constante capacitación.
                        </p>
                        <div className="w-acciones w-entrada" style={{ '--w-retraso': '240ms' }}>
                            <Link to="/servicios" className="w-btn w-btn--primario">
                                Agendar Servicio <IconFlecha />
                            </Link>
                            <Link to="/nosotros" className="w-btn w-btn--claro">Conocer Más</Link>
                        </div>
                        <ul className="w-hero-chips w-entrada" style={{ '--w-retraso': '320ms' }} aria-label="Lo que incluye cada servicio">
                            {['Diagnóstico OBD2', 'Repuestos OEM', 'Garantía escrita'].map(t => (
                                <li key={t} className="w-chip"><IconCheckSmall /> {t}</li>
                            ))}
                        </ul>
                    </div>

                    <aside className="w-hero-panel w-entrada" style={{ '--w-retraso': '420ms' }}>
                        <span className="w-punto-vivo" aria-hidden="true" />
                        <div>
                            <p className="w-hero-panel-t">Diagnóstico en Tiempo Real</p>
                            <p className="w-hero-panel-s">Equipo OBD2 certificado · Técnicos certificados</p>
                        </div>
                    </aside>
                </div>

                {/* Badges de confianza */}
                <div className="w-contenedor">
                    <ul className="w-hero-confianza w-entrada" style={{ '--w-retraso': '480ms' }}>
                        {[
                            { icon: <IconAward />, k: '10+ años', v: 'de experiencia' },
                            { icon: <IconShieldCheck />, k: 'Técnicos', v: 'certificados' },
                            { icon: <IconPackage />, k: 'Repuestos', v: 'garantizados' },
                            { icon: <IconGauge />, k: 'Equipos', v: 'de última generación' },
                        ].map(b => (
                            <li key={b.k} className="w-hero-confianza-item">
                                <span className="w-icono">{b.icon}</span>
                                <span>
                                    <strong>{b.k}</strong>
                                    <small>{b.v}</small>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </header>

            {/* ═══ FRANJA DE HORARIO ═══ */}
            <div className="w-franja">
                <div className="w-contenedor w-franja-in">
                    <p><IconClock /> Lun-Vie 8:00 - 17:00 · Sáb 8:00 - 13:00 · Ponciano Alto, Quito</p>
                    <Link to="/servicios" className="w-enlace-flecha">Agenda tu cita ahora <IconFlecha /></Link>
                </div>
            </div>

            {/* ═══ COLISIONES — servicio más popular ═══ */}
            <section className="w-seccion w-claro" aria-labelledby="titulo-colisiones">
                <div className="w-contenedor w-col">
                    <div className="w-col-media w-rev w-rev-img">
                        <img src={colisionesImg} alt="Reparación de colisiones y carrocería" loading="lazy" width="1200" height="960"
                             onError={e => { e.currentTarget.style.opacity = 0; }} />
                        <span className="w-col-badge"><span className="w-punto-vivo" aria-hidden="true" /> Servicio más popular</span>
                    </div>
                    <div className="w-rev" style={{ '--w-retraso': '100ms' }}>
                        <p className="w-eyebrow">Colisiones</p>
                        <h2 id="titulo-colisiones" className="w-titulo">Tu auto, <span className="w-acento">como si fuera nuevo.</span></h2>
                        <p className="w-lead">
                            Enderezada de carrocería, masilla y pintura con acabado de fábrica. Te entregamos un vehículo que luce y se conduce como nuevo.
                        </p>
                        <ul className="w-col-beneficios">
                            {[
                                { t: 'Evaluación sin costo', d: 'Inspeccionamos el daño y te damos un presupuesto claro.' },
                                { t: 'Pintura de fábrica', d: 'Cabina de pintura y mezcla exacta de color por computadora.' },
                                { t: 'Gestión con aseguradoras', d: 'Te ayudamos con el papeleo del siniestro paso a paso.' },
                            ].map(b => (
                                <li key={b.t}>
                                    <span className="w-icono"><IconCheckSmall /></span>
                                    <span>
                                        <strong className="w-h3">{b.t}</strong>
                                        <span className="w-texto">{b.d}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <Link to="/servicios" className="w-btn w-btn--oscuro">Agenda ahora <IconFlecha /></Link>
                    </div>
                </div>
            </section>

            {/* ═══ ESPECIALIDADES (catálogo de servicios) ═══ */}
            <section className="w-seccion w-niebla" aria-labelledby="titulo-especialidades">
                <div className="w-contenedor">
                    <div className="w-esp-cabeza">
                        <div className="w-encabezado w-rev">
                            <p className="w-eyebrow">Especialidades</p>
                            <h2 id="titulo-especialidades" className="w-titulo">Trabajamos cada pieza <span className="w-acento">con precisión.</span></h2>
                            <p className="w-lead">Desde el motor hasta los frenos, cada componente recibe atención experta con herramientas certificadas.</p>
                        </div>
                        {servicios.length > 0 && (
                            <div className="w-esp-flechas">
                                <button type="button" className="w-flecha" aria-label="Servicios anteriores" disabled={!flechas.izq} onClick={() => moverCarrusel(-1)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
                                </button>
                                <button type="button" className="w-flecha" aria-label="Servicios siguientes" disabled={!flechas.der} onClick={() => moverCarrusel(1)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                                </button>
                            </div>
                        )}
                    </div>

                    {servicios.length === 0 ? (
                        <p className="w-texto" style={{ textAlign: 'center' }}>Pronto publicaremos nuestros servicios.</p>
                    ) : (
                        <div className="w-esp-track" ref={carruselRef} onScroll={actualizarFlechas} tabIndex={0} aria-label="Carrusel de especialidades">
                            {servicios.map(s => {
                                const img = fotoServicio(s);
                                return (
                                    <article key={s.id} className="w-esp-card w-vidrio w-vidrio--interactivo">
                                        <div className="w-esp-foto">
                                            {img && (
                                                <img src={img} alt={s.nombre} loading="lazy" width="400" height="300"
                                                     onError={e => { e.currentTarget.style.display = 'none'; }} />
                                            )}
                                        </div>
                                        <div className="w-esp-cuerpo">
                                            <h3 className="w-h3">{s.nombre}</h3>
                                            {s.descripcion && <p className="w-texto w-esp-desc">{s.descripcion}</p>}
                                            <Link to="/servicios" className="w-enlace-flecha" aria-label={`Ver más sobre ${s.nombre}`}>
                                                Ver más <IconFlecha />
                                            </Link>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* ═══ POR QUÉ SS SWAP ═══ */}
            <section className="w-seccion w-grafito" aria-labelledby="titulo-porque">
                <div className="w-contenedor w-porque">
                    <div className="w-rev">
                        <p className="w-eyebrow">Por qué SS SWAP</p>
                        <h2 id="titulo-porque" className="w-titulo">Servicio técnico con <span className="w-acento">estándares profesionales.</span></h2>
                        <p className="w-lead" style={{ marginBottom: 28 }}>
                            En SS SWAP combinamos experiencia humana con tecnología de punta. Cada vehículo que entra a nuestro taller recibe un diagnóstico riguroso y un trabajo con garantía escrita.
                        </p>
                        <ul className="w-porque-lista">
                            {[
                                'Diagnóstico computarizado en cada revisión',
                                'Repuestos originales o equivalentes certificados',
                                'Garantía en mano de obra y materiales',
                                'Historial digital de tu vehículo',
                                'Transparencia total en presupuestos',
                            ].map(item => (
                                <li key={item}><IconCheckSmall /> {item}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="w-cifras">
                        {STATS.map((s, i) => (
                            <div key={s.label} className="w-cifra w-vidrio w-vidrio--interactivo w-rev" style={{ '--w-retraso': `${i * 80}ms` }}>
                                <p className="w-cifra-valor">{s.valor}</p>
                                <p className="w-cifra-label">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ SUCURSALES ═══ */}
            {sucursales.length > 0 && (
                <section className="w-seccion w-claro" aria-labelledby="titulo-ubicacion">
                    <div className="w-contenedor">
                        <div className="w-encabezado w-encabezado--centro w-rev">
                            <p className="w-eyebrow">Ubicación</p>
                            <h2 id="titulo-ubicacion" className="w-titulo">Visítanos en <span className="w-acento">nuestra matriz.</span></h2>
                            <p className="w-lead">Equipo técnico, infraestructura y atención profesional en cada ubicación.</p>
                        </div>

                        {/* Tarjeta unificada: mapa + datos de la sucursal PRINCIPAL */}
                        {principales.map(principal => (
                            <div key={principal.id} className="w-matriz w-rev">
                                {/* Mapa — ver MODIFICAR DIRECCIÓN AQUÍ junto a MAPA_EMBED_SRC al inicio de este archivo. */}
                                <div className="w-matriz-mapa">
                                    <iframe
                                        title="Ubicación de SS SWAP"
                                        src={MAPA_EMBED_SRC}
                                        allowFullScreen=""
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                    />
                                </div>
                                <div className="w-matriz-datos">
                                    <span className="w-matriz-tag"><IconStar /> Principal</span>
                                    <h3 className="w-matriz-nombre">{principal.nombre}</h3>
                                    {principal.ciudad && <p className="w-matriz-ciudad">{principal.ciudad}</p>}
                                    <div className="w-suc-lineas">
                                        {principal.direccion && <SucLine icon={<IconPin />} text={principal.direccion} />}
                                        {principal.telefono && <SucLine icon={<IconPhone />} text={<a href={`tel:${principal.telefono}`}>{principal.telefono}</a>} />}
                                        {principal.horario  && <SucLine icon={<IconClock />} text={principal.horario} />}
                                    </div>
                                    {principal.descripcion && <p className="w-texto w-suc-desc">{principal.descripcion}</p>}
                                </div>
                            </div>
                        ))}

                        {/* Resto de sucursales */}
                        {otras.length > 0 && (
                            <div className="w-grid w-grid--auto w-suc-otras">
                                {otras.map((s, i) => (
                                    <div key={s.id} className="w-tarjeta w-rev" style={{ '--w-retraso': `${i * 70}ms` }}>
                                        <span className="w-icono w-suc-icono"><IconPin /></span>
                                        <h3 className="w-h3">{s.nombre}</h3>
                                        {s.ciudad && <p className="w-matriz-ciudad">{s.ciudad}</p>}
                                        <div className="w-suc-lineas">
                                            {s.direccion && <SucLine icon={<IconPin />} text={s.direccion} />}
                                            {s.telefono && <SucLine icon={<IconPhone />} text={<a href={`tel:${s.telefono}`}>{s.telefono}</a>} />}
                                            {s.horario  && <SucLine icon={<IconClock />} text={s.horario} />}
                                        </div>
                                        {s.descripcion && <p className="w-texto w-suc-desc">{s.descripcion}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ═══ PORTAL DE CLIENTES ═══ */}
            <section className="w-seccion w-niebla" aria-labelledby="titulo-portal">
                <div className="w-contenedor">
                    <div className="w-cta w-rev">
                        <img className="w-cta-fondo" src={bannerGrandeImg} alt="" loading="lazy" aria-hidden="true" />
                        <p className="w-eyebrow">Portal de clientes</p>
                        <h2 id="titulo-portal" className="w-titulo">Crea tu cuenta <span className="w-acento">y controla todo.</span></h2>
                        <p className="w-lead">
                            Consulta el estado de tu reparación, agenda citas y revisa el historial completo de servicios de tu vehículo.
                        </p>
                        <div className="w-acciones">
                            <Link to="/auth?modo=registro" className="w-btn w-btn--primario">Crear cuenta gratis <IconFlecha /></Link>
                            <Link to="/auth" className="w-btn w-btn--claro">Ya tengo cuenta</Link>
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
        <div className="w-suc-linea">
            <span aria-hidden="true">{icon}</span>
            <span>{text}</span>
        </div>
    );
}

function IconFlecha()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>; }
function IconStar()       { return <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function IconAward()      { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></svg>; }
function IconShieldCheck(){ return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>; }
function IconPackage()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>; }
function IconGauge()      { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>; }
function IconPin()        { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function IconPhone()      { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>; }
function IconClock()      { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconCheckSmall() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>; }
