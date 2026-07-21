import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ESTADO_ORDEN_MAP, ESTADO_PROGRESO_MAP } from '../../constants/ordenes';
import { SWAPBOT_OPCIONES, SWAPBOT_SALUDO, SWAPBOT_MAX_CHARS } from '../../constants/chatbot';
import AgendarCitaModal from '../public/AgendarCitaModal';
// Coloca aqui tu imagen (la del robot mascota) con este nombre exacto:
// frontend/src/assets/swapbot-mascot.png
import mascotaImg from '../../assets/swapbot-mascot.png';

// Si el mensaje libre del cliente ya suena a que quiere agendar, lo mandamos
// directo al flujo de citas (gratis) en vez de gastar una llamada a Gemini.
const INTENCION_CITA = /agend|\bcita\b|turno|reservar|disponib|qu[eé]\s+d[ií]a/i;

let idSeq = 0;
const siguienteId = () => `sb-${Date.now()}-${idSeq++}`;

const formatearDuracion = (min) => {
    const m = Number(min);
    if (!m) return '';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const resto = m % 60;
    return resto ? `${h}h ${resto}min` : `${h}h`;
};

/**
 * SWAPBot — widget flotante del taller.
 *
 * Arbol de opciones predefinidas primero (precios, horarios, estado del
 * vehiculo, citas): esas se resuelven contra endpoints publicos que YA
 * existian en la API y no consumen cuota de IA. Solo la opcion
 * "Otra pregunta" llama a POST /api/chatbot/mensaje, que es el unico
 * punto que usa Gemini — asi se cuida al maximo la cuota gratuita.
 *
 * Se monta una sola vez en App.jsx, fuera de <Routes>, para conservar el
 * historial de la conversacion mientras el visitante navega el sitio.
 */
export default function SwapBot() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { usuario, tieneRol } = useAuth();

    const [abierto, setAbierto]           = useState(false);
    const [mensajes, setMensajes]         = useState([]);
    const [modoIA, setModoIA]             = useState(false);
    const [cuotaAgotada, setCuotaAgotada] = useState(false);
    const [ocupado, setOcupado]           = useState(false);
    const [texto, setTexto]               = useState('');
    const [servicioAgendando, setServicioAgendando] = useState(null);

    const historialIA      = useRef([]);   // ultimos turnos {rol, texto} enviados a Gemini
    const sucursalCache     = useRef(null); // cache simple de la sucursal principal
    const finRef            = useRef(null);

    // Este widget es para clientes/visitantes; en el panel interno del
    // taller (staff) y en el login de administracion no aplica.
    const ocultoEnEstaRuta = pathname.startsWith('/dashboard') || pathname === '/admin/login';

    useEffect(() => {
        if (abierto && mensajes.length === 0) {
            agregarBot({ tipo: 'texto', texto: SWAPBOT_SALUDO });
        }
        // eslint-disable-next-line
    }, [abierto]);

    useEffect(() => {
        finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [mensajes]);

    const agregarUsuario = (texto) => {
        setMensajes(prev => [...prev, { id: siguienteId(), autor: 'user', tipo: 'texto', texto }]);
    };

    const agregarBot = (contenido) => {
        const id = siguienteId();
        setMensajes(prev => [...prev, { id, autor: 'bot', ...contenido }]);
        return id;
    };

    const actualizarMensaje = (id, contenido) => {
        setMensajes(prev => prev.map(m => (m.id === id ? { id, autor: 'bot', ...contenido } : m)));
    };

    const obtenerSucursalPrincipal = async () => {
        if (sucursalCache.current) return sucursalCache.current;
        try {
            const { data } = await api.get('/sucursales/public');
            const lista = data.sucursales || [];
            const principal = lista.find(s => s.es_principal) || lista[0] || null;
            sucursalCache.current = principal;
            return principal;
        } catch {
            return null;
        }
    };

    const mostrarContacto = async () => {
        const sucursal = await obtenerSucursalPrincipal();
        if (!sucursal) return;
        const partes = [sucursal.telefono, sucursal.email].filter(Boolean).join(' · ');
        if (partes) agregarBot({ tipo: 'texto', texto: `Mientras tanto puedes contactarnos directamente: ${partes}` });
    };

    // ── Opciones predefinidas (sin IA) ──────────────────────────

    const manejarPrecios = async () => {
        setOcupado(true);
        const idCarga = agregarBot({ tipo: 'cargando' });
        try {
            const { data } = await api.get('/servicios', { params: { activo: 'true' } });
            const servicios = data.servicios || [];
            actualizarMensaje(idCarga, servicios.length
                ? { tipo: 'servicios', items: servicios.slice(0, 8) }
                : { tipo: 'texto', texto: 'Por el momento no tengo servicios registrados para mostrarte.' });
        } catch {
            actualizarMensaje(idCarga, { tipo: 'texto', texto: 'No pude cargar los precios en este momento. Intenta de nuevo en un momento.' });
        } finally {
            setOcupado(false);
        }
    };

    const manejarHorarios = async () => {
        setOcupado(true);
        const idCarga = agregarBot({ tipo: 'cargando' });
        try {
            const { data } = await api.get('/sucursales/public');
            const sucursales = data.sucursales || [];
            actualizarMensaje(idCarga, sucursales.length
                ? { tipo: 'sucursales', items: sucursales }
                : { tipo: 'texto', texto: 'Por el momento no tengo sucursales registradas para mostrarte.' });
        } catch {
            actualizarMensaje(idCarga, { tipo: 'texto', texto: 'No pude cargar los horarios/ubicación en este momento.' });
        } finally {
            setOcupado(false);
        }
    };

    const manejarEstado = async () => {
        if (!usuario) {
            agregarBot({
                tipo: 'texto',
                texto: 'Para ver el estado de tu vehículo necesitas iniciar sesión con tu cuenta de cliente.',
                accion: { label: 'Iniciar sesión', ir: '/auth' },
            });
            return;
        }
        if (!tieneRol('cliente')) {
            agregarBot({ tipo: 'texto', texto: 'Esta opción está disponible solo para cuentas de cliente.' });
            return;
        }
        setOcupado(true);
        const idCarga = agregarBot({ tipo: 'cargando' });
        try {
            const { data } = await api.get('/panel/mi-actividad');
            const ordenes = data.ordenes || [];
            actualizarMensaje(idCarga, ordenes.length
                ? { tipo: 'ordenes', items: ordenes.slice(0, 3), accion: { label: 'Ver todo en Mi Panel', ir: '/mi-panel' } }
                : { tipo: 'texto', texto: 'No tienes órdenes de trabajo registradas en este momento.' });
        } catch {
            actualizarMensaje(idCarga, { tipo: 'texto', texto: 'No pude consultar el estado de tu vehículo en este momento.' });
        } finally {
            setOcupado(false);
        }
    };

    const manejarCita = async () => {
        if (!usuario) {
            agregarBot({
                tipo: 'texto',
                texto: 'Para agendar una cita primero necesitas iniciar sesión o crear una cuenta de cliente.',
                accion: { label: 'Crear cuenta / Iniciar sesión', ir: '/auth' },
            });
            return;
        }
        if (!tieneRol('cliente')) {
            agregarBot({ tipo: 'texto', texto: 'Agendar citas está disponible solo para cuentas de cliente.' });
            return;
        }
        setOcupado(true);
        const idCarga = agregarBot({ tipo: 'cargando' });
        try {
            const { data } = await api.get('/servicios', { params: { activo: 'true' } });
            const servicios = data.servicios || [];
            actualizarMensaje(idCarga, servicios.length
                ? { tipo: 'elegir-servicio', texto: '¿Para qué servicio te gustaría agendar?', items: servicios.slice(0, 10) }
                : { tipo: 'texto', texto: 'Por el momento no tengo servicios disponibles para agendar.' });
        } catch {
            actualizarMensaje(idCarga, { tipo: 'texto', texto: 'No pude cargar los servicios disponibles en este momento.' });
        } finally {
            setOcupado(false);
        }
    };

    const abrirAgendar = (servicio) => setServicioAgendando(servicio);

    const cerrarAgendar = () => {
        setServicioAgendando(null);
        agregarBot({ tipo: 'texto', texto: '¿Necesitas algo más?' });
    };

    const activarModoIA = () => {
        if (cuotaAgotada) {
            agregarBot({ tipo: 'texto', texto: 'SWAPBot alcanzó su límite de consultas con IA por hoy. Intenta de nuevo mañana.' });
            mostrarContacto();
            return;
        }
        setModoIA(true);
        agregarBot({ tipo: 'texto', texto: 'Cuéntame qué necesitas y te ayudo.' });
    };

    const manejarOpcion = (id) => {
        if (ocupado) return;
        const opcion = SWAPBOT_OPCIONES.find(o => o.id === id);
        if (!opcion) return;

        agregarUsuario(opcion.label);
        setModoIA(id === 'ia');

        if (id === 'precios')       manejarPrecios();
        else if (id === 'horarios') manejarHorarios();
        else if (id === 'estado')   manejarEstado();
        else if (id === 'cita')     manejarCita();
        else if (id === 'ia')       activarModoIA();
    };

    // ── Fallback de IA (unico punto que consume Gemini) ─────────

    const enviarLibre = async (e) => {
        e.preventDefault();
        const mensaje = texto.trim();
        if (!mensaje || ocupado) return;
        if (mensaje.length > SWAPBOT_MAX_CHARS) {
            agregarBot({ tipo: 'texto', texto: `Ese mensaje es muy largo (máximo ${SWAPBOT_MAX_CHARS} caracteres).` });
            return;
        }

        agregarUsuario(mensaje);
        setTexto('');

        // Si ya se nota que quiere agendar, lo resolvemos gratis con el
        // mismo flujo de citas en vez de gastar una llamada a Gemini.
        if (INTENCION_CITA.test(mensaje)) {
            manejarCita();
            return;
        }

        setOcupado(true);
        const idCarga = agregarBot({ tipo: 'cargando' });

        try {
            const { data } = await api.post('/chatbot/mensaje', {
                mensaje,
                historial: historialIA.current,
            });
            historialIA.current = [
                ...historialIA.current,
                { rol: 'user', texto: mensaje },
                { rol: 'bot',  texto: data.respuesta },
            ].slice(-6);
            actualizarMensaje(idCarga, { tipo: 'texto', texto: data.respuesta });
        } catch (err) {
            const mensajeError = err.response?.data?.error;
            if (err.response?.status === 429) {
                setCuotaAgotada(true);
                setModoIA(false);
                actualizarMensaje(idCarga, { tipo: 'texto', texto: mensajeError || 'SWAPBot alcanzó su límite de consultas con IA por hoy.' });
                mostrarContacto();
            } else {
                actualizarMensaje(idCarga, { tipo: 'texto', texto: mensajeError || 'No pude conectarme en este momento. Intenta de nuevo.' });
            }
        } finally {
            setOcupado(false);
        }
    };

    if (ocultoEnEstaRuta) return null;

    return (
        <>
            <button
                className="swapbot-launcher"
                onClick={() => setAbierto(v => !v)}
                aria-label={abierto ? 'Cerrar chat de SWAPBot' : 'Abrir chat de SWAPBot'}
            >
                {abierto ? <IconX /> : <img src={mascotaImg} alt="SWAPBot" className="swapbot-launcher-img" />}
            </button>

            {abierto && (
                <div className="swapbot-panel" role="dialog" aria-label="SWAPBot, asistente virtual">
                    <div className="swapbot-header">
                        <div>
                            <p className="swapbot-titulo">SWAPBot</p>
                            <p className="swapbot-subtitulo">Asistente virtual · SWAPBot</p>
                        </div>
                        <button className="swapbot-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar">
                            <IconX />
                        </button>
                    </div>

                    <div className="swapbot-mensajes" aria-live="polite">
                        {mensajes.map(m => (
                            <MensajeBurbuja
                                key={m.id}
                                mensaje={m}
                                onIr={(ruta) => { setAbierto(false); navigate(ruta); }}
                                onElegirServicio={abrirAgendar}
                            />
                        ))}
                        <div ref={finRef} />
                    </div>

                    <div className="swapbot-opciones">
                        {SWAPBOT_OPCIONES.map(o => (
                            <button
                                key={o.id}
                                className={`swapbot-chip ${modoIA && o.id === 'ia' ? 'is-activa' : ''}`}
                                onClick={() => manejarOpcion(o.id)}
                                disabled={ocupado}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>

                    {modoIA && !cuotaAgotada && (
                        <form className="swapbot-input-row" onSubmit={enviarLibre}>
                            <input
                                type="text"
                                value={texto}
                                onChange={e => setTexto(e.target.value)}
                                placeholder="Escribe tu pregunta..."
                                maxLength={SWAPBOT_MAX_CHARS}
                                disabled={ocupado}
                            />
                            <button type="submit" disabled={ocupado || !texto.trim()} aria-label="Enviar">
                                {ocupado ? <IconSpinner /> : <IconEnviar />}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {servicioAgendando && (
                <AgendarCitaModal servicio={servicioAgendando} onClose={cerrarAgendar} />
            )}

            <style>{`
                .swapbot-launcher {
                    position: fixed; right: 24px; bottom: 24px; z-index: 900;
                    width: 58px; height: 58px; border-radius: 50%; border: none;
                    display: flex; align-items: center; justify-content: center;
                    color: #fff; cursor: pointer;
                    background: linear-gradient(135deg, #1b3a57, #2b5c85 55%, #3b7bab);
                    box-shadow: var(--shadow-glow);
                    animation: swapbotPulse 2.6s ease-in-out infinite;
                    transition: transform .2s cubic-bezier(.4,0,.2,1), box-shadow .2s ease;
                }
                .swapbot-launcher:hover { transform: translateY(-2px) scale(1.05); }
                .swapbot-launcher:active { transform: translateY(0) scale(1); }
                .swapbot-launcher-img {
                    width: 100%; height: 100%; border-radius: 50%;
                    object-fit: cover; object-position: 50% 22%;
                }

                @keyframes swapbotPulse {
                    0%, 100% { box-shadow: var(--shadow-glow), 0 0 0 0 rgba(43,92,133,.35); }
                    50%      { box-shadow: var(--shadow-glow), 0 0 0 9px rgba(43,92,133,0); }
                }

                .swapbot-panel {
                    position: fixed; right: 24px; bottom: 94px; z-index: 900;
                    width: 376px; max-width: calc(100vw - 32px);
                    height: min(560px, 74vh);
                    display: flex; flex-direction: column;
                    background: var(--bg-deep);
                    border: 1px solid var(--border);
                    border-radius: 20px;
                    box-shadow: var(--shadow-lg);
                    overflow: hidden;
                    animation: fadeUp .26s cubic-bezier(.4,0,.2,1);
                }

                .swapbot-header {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 15px 16px;
                    background: linear-gradient(135deg, #1b3a57, #2b5c85 55%, #3b7bab);
                    flex-shrink: 0;
                }
                .swapbot-titulo {
                    font-family: 'Sora', sans-serif; font-weight: 700;
                    font-size: .95rem; color: #fff; letter-spacing: .01em;
                }
                .swapbot-subtitulo {
                    font-family: 'Outfit', sans-serif; font-size: .74rem;
                    color: rgba(255,255,255,.75); margin-top: 2px;
                }
                .swapbot-cerrar {
                    background: rgba(255,255,255,.12); border: none; border-radius: 8px;
                    width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
                    color: #fff; cursor: pointer; transition: background .18s;
                }
                .swapbot-cerrar:hover { background: rgba(255,255,255,.22); }

                .swapbot-mensajes {
                    flex: 1; overflow-y: auto; padding: 16px;
                    display: flex; flex-direction: column; gap: 10px;
                    background: var(--bg-soft);
                }

                .swapbot-burbuja {
                    max-width: 86%; padding: 10px 13px; border-radius: 14px;
                    font-family: 'Outfit', sans-serif; font-size: .87rem; line-height: 1.45;
                    animation: slideInUp .2s ease both;
                }
                .swapbot-burbuja p { margin: 0; }
                .swapbot-bot {
                    align-self: flex-start; border-bottom-left-radius: 4px;
                    background: var(--bg-card); border: 1px solid var(--border);
                    color: var(--text); box-shadow: var(--shadow-xs);
                }
                .swapbot-user {
                    align-self: flex-end; border-bottom-right-radius: 4px;
                    background: linear-gradient(135deg, var(--accent), var(--accent-2));
                    color: #fff;
                }

                .swapbot-typing { display: flex; gap: 4px; padding: 4px 0; }
                .swapbot-typing span {
                    width: 6px; height: 6px; border-radius: 50%; background: var(--text-faint);
                    animation: pulse 1s ease-in-out infinite;
                }
                .swapbot-typing span:nth-child(2) { animation-delay: .15s; }
                .swapbot-typing span:nth-child(3) { animation-delay: .3s; }

                .swapbot-lista { display: flex; flex-direction: column; gap: 8px; }
                .swapbot-lista-titulo { font-weight: 600; margin-bottom: 2px; }
                .swapbot-item {
                    display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
                    padding-bottom: 7px; border-bottom: 1px solid var(--border-soft);
                }
                .swapbot-item:last-child { border-bottom: none; padding-bottom: 0; }
                .swapbot-item strong { color: var(--accent); white-space: nowrap; font-weight: 700; }
                .swapbot-item-col { display: flex; flex-direction: column; gap: 2px; }
                .swapbot-item-col strong { color: var(--text); }
                .swapbot-item-col span { font-size: .8rem; color: var(--text-muted); }

                .swapbot-item-btn {
                    display: flex; justify-content: space-between; align-items: center; gap: 10px;
                    width: 100%; text-align: left; cursor: pointer;
                    padding: 9px 11px; border-radius: 10px;
                    border: 1px solid var(--border); background: var(--bg-soft);
                    font-family: 'Outfit', sans-serif; font-size: .85rem; color: var(--text);
                    transition: all .18s ease;
                }
                .swapbot-item-btn:hover { border-color: var(--accent-2); background: var(--accent-pale); }
                .swapbot-item-btn strong { color: var(--accent); white-space: nowrap; font-weight: 700; font-size: .8rem; }

                .swapbot-accion {
                    display: inline-block; margin-top: 9px;
                    font-family: 'Sora', sans-serif; font-weight: 600; font-size: .78rem;
                    color: var(--accent); background: var(--accent-pale);
                    border: 1px solid var(--accent-bdr); border-radius: 999px;
                    padding: 7px 14px; cursor: pointer; transition: all .18s ease;
                }
                .swapbot-accion:hover { background: var(--accent-bdr); transform: translateY(-1px); }

                .swapbot-opciones {
                    display: flex; flex-wrap: wrap; gap: 7px;
                    padding: 11px 14px; border-top: 1px solid var(--border);
                    background: var(--bg-card); flex-shrink: 0;
                }
                .swapbot-chip {
                    font-family: 'Sora', sans-serif; font-weight: 600; font-size: .74rem;
                    color: var(--accent); background: var(--accent-pale);
                    border: 1px solid var(--accent-bdr); border-radius: 999px;
                    padding: 6px 12px; cursor: pointer; transition: all .18s ease; white-space: nowrap;
                }
                .swapbot-chip:hover:not(:disabled) { background: var(--accent-bdr); transform: translateY(-1px); }
                .swapbot-chip:disabled { opacity: .5; cursor: not-allowed; }
                .swapbot-chip.is-activa { background: var(--accent); color: #fff; border-color: var(--accent); }

                .swapbot-input-row {
                    display: flex; gap: 8px; padding: 12px 14px;
                    border-top: 1px solid var(--border); background: var(--bg-card); flex-shrink: 0;
                }
                .swapbot-input-row input {
                    flex: 1; min-width: 0; padding: 10px 13px; border-radius: 10px;
                    border: 1px solid var(--border); background: var(--bg-input); color: var(--text);
                    font-family: 'Outfit', sans-serif; font-size: .87rem; outline: none;
                    transition: border-color .2s, box-shadow .2s;
                }
                .swapbot-input-row input:focus {
                    border-color: var(--accent-2); box-shadow: 0 0 0 3px var(--accent-pale);
                }
                .swapbot-input-row button {
                    width: 38px; height: 38px; border-radius: 10px; border: none; flex-shrink: 0;
                    display: flex; align-items: center; justify-content: center; cursor: pointer;
                    background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff;
                    transition: opacity .18s, transform .18s;
                }
                .swapbot-input-row button:disabled { opacity: .5; cursor: not-allowed; }
                .swapbot-input-row button:hover:not(:disabled) { transform: translateY(-1px); }

                @media (max-width: 480px) {
                    .swapbot-panel {
                        right: 12px; left: 12px; bottom: 90px;
                        width: auto; max-width: none; height: min(66vh, 520px);
                    }
                    .swapbot-launcher { right: 16px; bottom: 16px; width: 52px; height: 52px; }
                }
            `}</style>
        </>
    );
}

function MensajeBurbuja({ mensaje, onIr, onElegirServicio }) {
    const esBot = mensaje.autor === 'bot';

    return (
        <div className={`swapbot-burbuja ${esBot ? 'swapbot-bot' : 'swapbot-user'}`}>
            {mensaje.tipo === 'cargando' && (
                <div className="swapbot-typing"><span /><span /><span /></div>
            )}

            {mensaje.tipo === 'texto' && <p>{mensaje.texto}</p>}

            {mensaje.tipo === 'elegir-servicio' && (
                <div className="swapbot-lista">
                    <p className="swapbot-lista-titulo">{mensaje.texto}</p>
                    {mensaje.items.map((s, i) => (
                        <button key={s.id ?? i} className="swapbot-item-btn" onClick={() => onElegirServicio(s)}>
                            <span>{s.nombre}</span>
                            <strong>{Number(s.precio_base) > 0 ? `desde $${parseFloat(s.precio_base).toFixed(2)}` : 'Cotizar'}</strong>
                        </button>
                    ))}
                </div>
            )}

            {mensaje.tipo === 'servicios' && (
                <div className="swapbot-lista">
                    <p className="swapbot-lista-titulo">Estos son nuestros servicios:</p>
                    {mensaje.items.map((s, i) => (
                        <div key={s.id ?? i} className="swapbot-item">
                            <span>{s.nombre}{s.duracion_estimada_min ? ` (~${formatearDuracion(s.duracion_estimada_min)})` : ''}</span>
                            <strong>{Number(s.precio_base) > 0 ? `$${parseFloat(s.precio_base).toFixed(2)}` : 'Cotizar'}</strong>
                        </div>
                    ))}
                </div>
            )}

            {mensaje.tipo === 'sucursales' && (
                <div className="swapbot-lista">
                    {mensaje.items.map((s, i) => (
                        <div key={s.id ?? i} className="swapbot-item swapbot-item-col">
                            <strong>{s.nombre}</strong>
                            {s.direccion && <span>{s.direccion}{s.ciudad ? `, ${s.ciudad}` : ''}</span>}
                            {s.horario && <span>Horario: {s.horario}</span>}
                            {s.telefono && <span>Tel: {s.telefono}</span>}
                        </div>
                    ))}
                </div>
            )}

            {mensaje.tipo === 'ordenes' && (
                <div className="swapbot-lista">
                    {mensaje.items.map((o) => (
                        <div key={o.id} className="swapbot-item swapbot-item-col">
                            <strong>{[o.marca, o.modelo].filter(Boolean).join(' ')}{o.placa ? ` · ${o.placa}` : ''}</strong>
                            <span>Estado: {ESTADO_ORDEN_MAP[o.estado]?.label || o.estado}</span>
                            {o.estado_progreso && (
                                <span>Progreso: {ESTADO_PROGRESO_MAP[o.estado_progreso]?.label || o.estado_progreso}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {mensaje.accion && (
                <button className="swapbot-accion" onClick={() => onIr(mensaje.accion.ir)}>
                    {mensaje.accion.label}
                </button>
            )}
        </div>
    );
}

function IconX() {
    return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}
function IconEnviar() {
    return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    );
}
function IconSpinner() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-9-9" opacity="0.9" />
        </svg>
    );
}