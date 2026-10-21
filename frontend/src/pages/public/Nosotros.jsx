/**
 * SS SWAP - Página Institucional "Nosotros"
 * Muestra la historia, misión, visión, línea de tiempo de crecimiento,
 * principios corporativos y el equipo técnico responsable del taller.
 * Estilos en Nosotros.css + styles/web-publica.css (todo bajo .web).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import FondoVivo from '../../components/public/FondoVivo';
import api from '../../services/api';
import useRevelar from '../../hooks/useRevelar';
import '../../styles/web-publica.css';
import './Nosotros.css';

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
    const raiz = useRef(null);
    const [sinMovimiento] = useState(() => !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    useEffect(() => {
        api.get('/sucursales/public').then(r => setSucursales(r.data.sucursales || [])).catch(() => {});
    }, []);

    useRevelar(raiz, [sucursales]);

    /* Linea de tiempo "Un crecimiento planificado, paso a paso." — despliegue en tiempo real
       ligado al scroll (igual mecanismo que "Como funciona" en Servicios): reversible, no es
       un disparo unico como el resto de bloques .w-rev de esta pagina. */
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
        <div className="web" ref={raiz}>
            <Navbar />
            <FondoVivo />

            {/* CABECERA */}
            <header className="w-cabecera ns-cabecera">
                <div className="w-contenedor ns-hero-grid">
                    <div>
                        <p className="w-eyebrow w-entrada">SS SWAP Garage</p>
                        <h1 className="w-entrada" style={{ '--w-retraso': '80ms' }}>
                            Un taller pensado para durar, <span className="w-acento">construido con calidad y confianza.</span>
                        </h1>
                        <p className="w-lead w-entrada" style={{ '--w-retraso': '160ms', marginBottom: 32 }}>
                            SS SWAP Garage nace en Tola Chica – La Morita combinando mecánica general y colisiones bajo un mismo techo, con diagnóstico claro, garantía por escrito y atención directa por WhatsApp.
                        </p>
                        <div className="w-acciones w-entrada" style={{ '--w-retraso': '240ms' }}>
                            <Link to="/servicios" className="w-btn w-btn--primario">Conocer nuestros servicios <IconFlecha /></Link>
                            <Link to="/servicios" className="w-btn w-btn--claro">Agendar servicio</Link>
                        </div>
                    </div>
                    <div className="ns-hero-foto w-entrada" style={{ '--w-retraso': '200ms' }}>
                        <img src="/nosotros/hero-taller.jpeg" alt="Mecánico de SS SWAP reparando un vehículo en el taller" width="900" height="1125"
                             onError={e => { e.currentTarget.style.opacity = 0; }} />
                        <div className="ns-hero-sello">
                            <span>100%</span>
                            <span>Garantía por escrito<br />en cada trabajo</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ESTADISTICAS */}
            <section className="ns-cifras-seccion" aria-label="Nuestros compromisos en cifras">
                <div className="w-contenedor">
                    <div className="ns-stats-grid w-rev">
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
            <section className="w-seccion w-claro" style={{ paddingTop: 0 }} aria-label="Misión y visión">
                <div className="w-contenedor ns-mv-grid">
                    <article className="w-tarjeta ns-mv w-rev">
                        <span className="w-icono"><IconTarget /></span>
                        <h2 className="ns-mv-titulo">Misión</h2>
                        <p className="w-texto">
                            Brindar servicios confiables, rápidos y garantizados para vehículos livianos — mecánica general y colisiones — generando fidelización real y un crecimiento sostenible del taller.
                        </p>
                    </article>
                    <article className="w-tarjeta ns-mv w-rev" style={{ '--w-retraso': '90ms' }}>
                        <span className="w-icono"><IconEye /></span>
                        <h2 className="ns-mv-titulo">Visión</h2>
                        <p className="w-texto">
                            Convertirnos en uno de los talleres de referencia en Tola Chica – La Morita por calidad, honestidad y tecnología.
                        </p>
                    </article>
                </div>
            </section>

            {/* LINEA DE TIEMPO */}
            <section className="w-seccion w-niebla" aria-labelledby="titulo-hitos">
                <div className="w-contenedor" style={{ maxWidth: 920 }}>
                    <div className="w-encabezado w-encabezado--centro">
                        <p className="w-eyebrow">Hacia dónde vamos</p>
                        <h2 id="titulo-hitos" className="w-titulo">Un crecimiento <span className="w-acento">planificado, paso a paso.</span></h2>
                    </div>
                    <ol className="ns-timeline-v2">
                        <li className="ns-tl-fill" aria-hidden="true" />
                        {HITOS.map((h, i) => (
                            <li key={h.anio} className={`ns-tl-row${i % 2 === 1 ? ' right' : ''}`}>
                                <span className="ns-tl-dot" aria-hidden="true" />
                                <div className="ns-tl-card w-tarjeta w-rev" style={{ '--w-retraso': '80ms' }}>
                                    <p className="ns-tl-year">{h.anio}</p>
                                    <p className="w-texto">{h.texto}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* DIFERENCIALES */}
            <section className="w-seccion w-grafito" aria-labelledby="titulo-diferenciales">
                <div className="w-contenedor">
                    <div className="w-encabezado w-encabezado--centro w-rev">
                        <p className="w-eyebrow">Diferenciales</p>
                        <h2 id="titulo-diferenciales" className="w-titulo">¿Por qué elegir <span className="w-acento">SS SWAP?</span></h2>
                    </div>
                    <div className="w-grid w-grid--3">
                        {DIFERENCIALES.map((d, i) => (
                            <article key={d.titulo} className="w-tarjeta ns-diff-card w-rev" style={{ '--w-retraso': `${(i % 3) * 70}ms` }}>
                                <span className="w-icono"><d.icon /></span>
                                <div>
                                    <h3 className="w-h3">{d.titulo}</h3>
                                    <p className="w-texto">{d.desc}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* VALORES */}
            <section className="w-seccion w-claro" aria-labelledby="titulo-valores">
                <div className="w-contenedor">
                    <div className="w-encabezado w-encabezado--centro w-rev">
                        <p className="w-eyebrow">Nuestros valores</p>
                        <h2 id="titulo-valores" className="w-titulo">Lo que guía cada <span className="w-acento">trabajo que hacemos.</span></h2>
                    </div>
                    <div className="w-grid w-grid--4">
                        {VALORES.map((v, i) => (
                            <article key={v.titulo} className="w-tarjeta w-rev" style={{ '--w-retraso': `${i * 70}ms` }}>
                                <span className="w-icono ns-valor-icono"><v.icon /></span>
                                <h3 className="w-h3">{v.titulo}</h3>
                                <p className="w-texto">{v.desc}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* EQUIPO DE MECANICOS */}
            <section className="w-seccion w-niebla" aria-labelledby="titulo-equipo">
                <div className="w-contenedor">
                    <div className="w-encabezado w-encabezado--centro w-rev">
                        <p className="w-eyebrow">Nuestro equipo</p>
                        <h2 id="titulo-equipo" className="w-titulo">Personas detrás de <span className="w-acento">cada reparación.</span></h2>
                        <p className="ns-scroll-hint">
                            Desliza para ver al equipo
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </p>
                    </div>
                    <div className="ns-team-grid">
                        {MECANICOS.map((m, i) => (
                            <article key={m.nombre} className="ns-team-card w-vidrio w-vidrio--interactivo w-rev" style={{ '--w-retraso': `${i * 80}ms` }}>
                                <div className="ns-team-photo">
                                    <img src={m.foto} alt={m.nombre} loading="lazy" width="600" height="600" onError={e => { e.currentTarget.style.opacity = 0; }} />
                                    <span className="ns-team-exp">{m.badge}</span>
                                </div>
                                <div className="ns-team-body">
                                    <h3 className="w-h3">{m.nombre}</h3>
                                    <p className="ns-team-cargo">{m.cargo}</p>
                                    <span className="ns-team-tag">{m.especialidad}</span>
                                    <p className="ns-team-quote">&ldquo;{m.frase}&rdquo;</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ENDEREZADA Y PINTURA */}
            <section className="w-seccion w-oscuro" aria-labelledby="titulo-especialidad">
                <div className="w-contenedor">
                    <div className="ns-spec-grid">
                        <div className="ns-spec-photo-main w-rev w-rev-img">
                            <img src="/nosotros/pintura4.jpeg" alt="Área de enderezada y pintura de SS SWAP" loading="lazy" width="1200" height="900"
                                 onError={e => { e.currentTarget.style.opacity = 0; }} />
                            <span className="ns-spec-photo-tag">Colisiones</span>
                        </div>
                        <div className="w-rev" style={{ '--w-retraso': '100ms' }}>
                            <p className="w-eyebrow">Nuestra especialidad</p>
                            <h2 id="titulo-especialidad" className="w-titulo">Enderezada y pintura: <span className="w-acento">el fuerte de SS SWAP.</span></h2>
                            <p className="w-lead" style={{ marginBottom: 24 }}>
                                En colisiones no improvisamos: seguimos un proceso completo de enderezada, templado, soldadura, pintura por capas, pulido y cuadratura de paneles, para que el golpe no se note ni en el color ni en la carrocería.
                            </p>
                            <ul className="ns-spec-chips">
                                {['Enderezada', 'Templado', 'Soldadura', 'Pintura por capas', 'Pulido', 'Cuadratura de paneles'].map(tag => (
                                    <li key={tag} className="w-chip">{tag}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="w-grid w-grid--3">
                        {[
                            { titulo: 'Aplicación de pintura', desc: 'Pintura aplicada por capas, de forma uniforme y sin defectos, dentro de la cabina.', foto: '/nosotros/pintura2.jpeg' },
                            { titulo: 'Control de calidad',    desc: 'Revisamos cada detalle antes de la entrega: acabado, brillo y funcionamiento.',      video: '/nosotros/video2.mp4' },
                            { titulo: 'Detalle en llantas',    desc: 'También pintamos y renovamos llantas para que combinen con la carrocería.',          foto: '/nosotros/pintura3.jpeg' },
                        ].map((st, i) => (
                            <article key={st.titulo} className="w-tarjeta ns-spec-step w-rev" style={{ '--w-retraso': `${i * 80}ms` }}>
                                <div className="ns-spec-step-photo">
                                    {st.video ? (
                                        <video muted loop playsInline autoPlay={!sinMovimiento} preload="metadata" aria-label={st.titulo}>
                                            <source src={st.video} type="video/mp4" />
                                        </video>
                                    ) : (
                                        <img src={st.foto} alt={st.titulo} loading="lazy" width="640" height="400" onError={e => { e.currentTarget.style.opacity = 0; }} />
                                    )}
                                </div>
                                <h3 className="w-h3">{st.titulo}</h3>
                                <p className="w-texto">{st.desc}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* GALERIA */}
            <section className="w-seccion w-claro" aria-labelledby="titulo-galeria">
                <div className="w-contenedor">
                    <div className="w-encabezado w-encabezado--centro w-rev">
                        <p className="w-eyebrow">Galería</p>
                        <h2 id="titulo-galeria" className="w-titulo">Un vistazo a <span className="w-acento">nuestro taller.</span></h2>
                        <p className="ns-scroll-hint-gallery">
                            Desliza para ver más fotos
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </p>
                    </div>
                    <Galeria items={GALERIA} />
                </div>
            </section>

            {/* VIDEO INSTITUCIONAL */}
            <section className="w-seccion w-grafito" aria-labelledby="titulo-video">
                <div className="w-contenedor" style={{ maxWidth: 1040 }}>
                    <div className="w-encabezado w-encabezado--centro w-rev">
                        <p className="w-eyebrow">Conócenos</p>
                        <h2 id="titulo-video" className="w-titulo">Un recorrido por <span className="w-acento">SS SWAP.</span></h2>
                    </div>
                    <div className="ns-video-frame w-rev">
                        <video controls preload="metadata" poster="/nosotros/pintura1.jpeg">
                            <source src="/nosotros/video1.mp4" type="video/mp4" />
                            Tu navegador no soporta reproducción de video.
                        </video>
                    </div>
                </div>
            </section>

            {/* TESTIMONIOS */}
            <section className="w-seccion w-niebla" aria-labelledby="titulo-testimonios">
                <div className="w-contenedor">
                    <div className="w-encabezado w-encabezado--centro w-rev">
                        <p className="w-eyebrow">Testimonios</p>
                        <h2 id="titulo-testimonios" className="w-titulo">Lo que dicen <span className="w-acento">nuestros clientes.</span></h2>
                    </div>
                    <div className="w-grid w-grid--3">
                        {TESTIMONIOS.map((t, i) => (
                            <figure key={t.nombre} className="w-tarjeta ns-testi-card w-rev" style={{ '--w-retraso': `${i * 80}ms` }}>
                                <div className="ns-testi-stars" aria-label="5 de 5 estrellas">
                                    {Array.from({ length: 5 }).map((_, j) => <IconStar key={j} />)}
                                </div>
                                <blockquote className="ns-testi-text">&ldquo;{t.texto}&rdquo;</blockquote>
                                <figcaption className="ns-testi-person">
                                    <img className="ns-testi-avatar" src={t.foto} alt="" width="44" height="44" loading="lazy" onError={e => { e.currentTarget.style.opacity = 0; }} />
                                    <div>
                                        <p className="ns-testi-name">{t.nombre}</p>
                                        <p className="ns-testi-role">{t.rol}</p>
                                    </div>
                                </figcaption>
                            </figure>
                        ))}
                    </div>
                </div>
            </section>

            {/* SUCURSALES (si existen) */}
            {sucursales.length > 0 && (
                <section className="w-seccion w-claro" aria-labelledby="titulo-sucursales">
                    <div className="w-contenedor">
                        <div className="w-encabezado w-encabezado--centro w-rev">
                            <p className="w-eyebrow">Dónde estamos</p>
                            <h2 id="titulo-sucursales" className="w-titulo">Visítanos en <span className="w-acento">nuestra matriz.</span></h2>
                        </div>
                        <div className="w-grid w-grid--auto">
                            {sucursales.map((s, i) => (
                                <article key={s.id} className="w-tarjeta w-rev" style={{ '--w-retraso': `${i * 70}ms` }}>
                                    <h3 className="w-h3">{s.nombre}</h3>
                                    {s.ciudad && <p className="ns-ciudad">{s.ciudad}</p>}
                                    {s.direccion && <p className="w-texto">{s.direccion}</p>}
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* CTA */}
            <section className="w-seccion w-niebla">
                <div className="w-contenedor">
                    <div className="w-cta w-rev">
                        <h2 className="w-titulo">¿Listo para devolverle la vida a <span className="w-acento">tu vehículo?</span></h2>
                        <p className="w-lead">
                            Revisa nuestro catálogo de servicios o crea tu cuenta para llevar el control de tu historial automotriz.
                        </p>
                        <div className="w-acciones">
                            <Link to="/servicios" className="w-btn w-btn--primario">Agenda tu cita <IconFlecha /></Link>
                            <Link to="/auth?modo=registro" className="w-btn w-btn--claro">Crear cuenta gratis</Link>
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
            <div className="ns-gallery w-rev">
                {items.map((g, i) => (
                    <div
                        key={i}
                        className={`ns-gallery-item${g.big ? ' big' : ''}${g.tall ? ' tall' : ''}`}
                        onClick={() => setActivo(i)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ampliar foto: ${g.cap}`}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActivo(i); } }}
                    >
                        <img src={g.url} alt={g.cap} loading="lazy" width="460" height="400" onError={e => { e.currentTarget.style.opacity = 0; }} />
                        <span className="ns-gallery-expand" aria-hidden="true"><IconExpand /></span>
                        <div className="ns-gallery-overlay">
                            <p className="ns-gallery-caption">{g.cap}</p>
                        </div>
                    </div>
                ))}
            </div>
            {activo !== null && (
                <div className="ns-lightbox" role="dialog" aria-modal="true" aria-label={items[activo].cap} onClick={() => setActivo(null)}>
                    <button type="button" className="ns-lightbox-close" onClick={() => setActivo(null)} aria-label="Cerrar" autoFocus>
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
}function IconFlecha() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>; }
