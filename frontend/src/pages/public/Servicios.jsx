/**
 * SS SWAP - Catálogo Público de Servicios Mecánicos
 * Lista servicios activos con precios referenciales y duraciones estimadas,
 * búsqueda instantánea y acceso directo a la reserva de citas en línea.
 * Estilos en Servicios.css + styles/web-publica.css (todo bajo .web).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import FondoVivo from '../../components/public/FondoVivo';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AgendarCitaModal from '../../components/public/AgendarCitaModal';
import fotoServicio from '../../components/public/fotoServicio';
import mascotaImg from '../../assets/swapbot-mascot.png';
import useRevelar from '../../hooks/useRevelar';
import '../../styles/web-publica.css';
import './Servicios.css';

const ICONOS = [
    { match: /aceite|mantenimiento|preventiv/i, icon: IconWrench },
    { match: /freno|suspension|amortigu/i,       icon: IconShield },
    { match: /diagnostic|computariz|escaner/i,   icon: IconCpu },
    { match: /electric|bateria|alternador/i,      icon: IconZap },
    { match: /aliniac|alineac|balanceo/i,         icon: IconTarget },
    { match: /pintura|carroceria|latoneria/i,     icon: IconTool },
];
function iconoPara(nombre = '') {
    return ICONOS.find(i => i.match.test(nombre)) || { icon: IconWrench };
}

export default function Servicios() {
    const { usuario } = useAuth();
    const [servicios, setServicios] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(null);
    const [q, setQ]                 = useState('');
    const [servicioAgendando, setServicioAgendando] = useState(null);
    const raiz = useRef(null);

    useEffect(() => {
        api.get('/servicios', { params: { activo: 'true' } })
            .then(r => setServicios(r.data.servicios || []))
            .catch(() => setError('No se pudieron cargar los servicios en este momento.'))
            .finally(() => setLoading(false));
    }, []);

    useRevelar(raiz, [servicios, loading, q]);

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
        <div className="web" ref={raiz}>
            <Navbar />
            <FondoVivo />

            {/* CABECERA */}
            <header className="w-cabecera">
                <div className="w-contenedor sv-cabecera">
                    <div>
                        <p className="w-eyebrow w-entrada">Catálogo de servicios</p>
                        <h1 className="w-entrada" style={{ '--w-retraso': '80ms' }}>
                            Servicios pensados <span className="w-acento">para tu vehículo.</span>
                        </h1>
                        <p className="w-lead w-entrada" style={{ '--w-retraso': '160ms' }}>
                            Consulta precios referenciales y tiempos estimados. Crea una cuenta para agendar tu cita y dar seguimiento en línea al estado de tu vehículo.
                        </p>
                    </div>
                    <div className="sv-buscador w-entrada" style={{ '--w-retraso': '240ms' }}>
                        <label htmlFor="sv-buscar" className="w-sr">Buscar servicio</label>
                        <IconSearch />
                        <input id="sv-buscar" type="search" className="sv-search" placeholder="Buscar servicio…" value={q} onChange={e => setQ(e.target.value)} />
                    </div>
                </div>
            </header>

            {/* GRID DE SERVICIOS */}
            <section className="w-seccion w-niebla" aria-label="Servicios disponibles">
                <div className="w-contenedor">
                    {loading && (
                        <div className="w-grid w-grid--auto">
                            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="sv-esqueleto" />)}
                        </div>
                    )}

                    {!loading && error && (
                        <p className="w-texto sv-vacio" role="alert">{error}</p>
                    )}

                    {!loading && !error && filtrados.length === 0 && (
                        <p className="w-texto sv-vacio">
                            {servicios.length === 0 ? 'Aún no hay servicios publicados.' : 'No encontramos servicios que coincidan con tu búsqueda.'}
                        </p>
                    )}

                    {!loading && !error && filtrados.length > 0 && (
                        <div className="w-grid w-grid--auto">
                            {filtrados.map((s, i) => {
                                const { icon: Icon } = iconoPara(s.nombre);
                                const foto = fotoServicio(s);
                                return (
                                    <article key={s.id} className="sv-card w-vidrio w-vidrio--interactivo w-rev" style={{ '--w-retraso': `${(i % 6) * 60}ms` }}>
                                        <div className="sv-photo">
                                            {foto ? (
                                                <img src={foto} alt={s.nombre} loading="lazy" width="480" height="270" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.classList.add('sv-photo-fallback'); }} />
                                            ) : (
                                                <div className="sv-photo-fallback"><Icon /></div>
                                            )}
                                        </div>
                                        <div className="sv-card-body">
                                            <h2 className="w-h3">{s.nombre}</h2>
                                            {s.descripcion && <p className="w-texto sv-desc">{s.descripcion}</p>}
                                            <div className="sv-pie">
                                                <div>
                                                    <p className="sv-precio">
                                                        {Number(s.precio_base) > 0 ? `Desde $${parseFloat(s.precio_base).toFixed(2)}` : 'Cotizar'}
                                                    </p>
                                                    <p className="sv-nota">
                                                        {s.duracion_estimada_min ? `~ ${formatearDuracion(s.duracion_estimada_min)}` : 'Precio referencial'}
                                                    </p>
                                                </div>
                                                {usuario?.rol === 'cliente' ? (
                                                    <button type="button" onClick={() => setServicioAgendando(s)} className="w-btn w-btn--primario sv-agendar" aria-label={`Agendar ${s.nombre}`}>
                                                        Agendar <IconFlecha />
                                                    </button>
                                                ) : (
                                                    <Link to={ctaHref} className="w-btn w-btn--primario sv-agendar" aria-label={`Agendar ${s.nombre}`}>
                                                        Agendar <IconFlecha />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* COMO FUNCIONA */}
            <section className="w-seccion w-grafito" aria-labelledby="titulo-como">
                <div className="w-contenedor">
                    <div className="w-encabezado w-encabezado--centro">
                        <p className="w-eyebrow">Cómo funciona</p>
                        <h2 id="titulo-como" className="w-titulo">De la cita a la entrega, <span className="w-acento">sin sorpresas.</span></h2>
                    </div>
                    <div className="hiw-track">
                        <div className="hiw-connector" aria-hidden="true">
                            <div className="hiw-connector-line" />
                            <div className="hiw-connector-fill" />
                        </div>
                        <ol className="sv-steps">
                            {[
                                { n: '01', t: 'Agenda tu cita', d: 'Crea tu cuenta y solicita el servicio que necesitas.', tag: 'Solo 2 minutos', icon: <IconCalendar /> },
                                { n: '02', t: 'Diagnóstico',    d: 'Revisamos tu vehículo con equipo computarizado.',     tag: 'Escáner OBD2',   icon: <IconSearchScan /> },
                                { n: '03', t: 'Reparación',     d: 'Técnicos certificados trabajan con repuestos garantizados.', tag: 'Garantía incluida', icon: <IconWrench /> },
                                { n: '04', t: 'Entrega',        d: 'Retiras tu vehículo y consultas el historial en tu panel.', tag: 'Seguimiento en línea', icon: <IconCheckCircle /> },
                            ].map((s, i) => (
                                <li key={s.n} className="hiw-card w-rev" data-hiw-index={i} style={{ '--w-retraso': `${i * 110}ms` }}>
                                    <div className="hiw-icon-ring">
                                        {s.icon}
                                        <span className="hiw-num">{s.n}</span>
                                    </div>
                                    <h3 className="hiw-title">{s.t}</h3>
                                    <p className="hiw-desc">{s.d}</p>
                                    <span className="hiw-tag">{s.tag}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="w-seccion w-oscuro">
                <div className="w-contenedor">
                    <div className="w-cta w-rev">
                        <img className="w-cta-fondo" src={mascotaImg} alt="" loading="lazy" aria-hidden="true" />
                        <p className="w-eyebrow">Listo cuando tú lo estés</p>
                        <h2 className="w-titulo">¿No sabes <span className="w-acento">qué servicio necesitas?</span></h2>
                        <p className="w-lead">
                            Chatea con nuestro ChatBot y te ayudaremos a identificar el servicio que tu vehículo necesita. Luego podrás agendar tu cita en línea y dar seguimiento al estado de tu vehículo desde tu panel.
                        </p>
                        <div className="w-acciones">
                            <button type="button" onClick={() => window.dispatchEvent(new Event('swapbot:abrir'))} className="w-btn w-btn--primario">
                                Chatear con SWAPbot <IconFlecha />
                            </button>
                            <Link to="/nosotros" className="w-btn w-btn--claro">Conocer el taller</Link>
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
function IconTool()   { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }function IconSearch() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconFlecha() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>; }
