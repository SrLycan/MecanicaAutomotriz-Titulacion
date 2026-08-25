/**
 * SS SWAP - SWAPBot: Asistente Virtual Flotante del Taller
 * Widget de chat con árbol de opciones predefinidas (sin costo de IA)
 * y fallback a Gemini solo para preguntas libres, cuidando la cuota.
 */
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ESTADO_ORDEN_MAP, ESTADO_PROGRESO_MAP } from '../../constants/ordenes';
import { SWAPBOT_OPCIONES, swapbotSaludo, SWAPBOT_MAX_CHARS } from '../../constants/chatbot';
import AgendarCitaModal from '../public/AgendarCitaModal';
// Coloca aqui tu imagen (la del robot mascota) con este nombre exacto:
// frontend/src/assets/swapbot-mascot.png
import mascotaImg from '../../assets/swapbot-mascot.png';
import './SwapBot.css';

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

    // sesion_id: identifica esta conversacion en MongoDB Atlas (coleccion
    // chatbot_conversaciones). Se genera una vez por pestaña/sesion del
    // navegador y se reutiliza en cada mensaje para que todos los turnos
    // queden agrupados en el mismo documento.
    const sesionIdRef = useRef(null);
    if (!sesionIdRef.current) {
        const guardado = sessionStorage.getItem('SS SWAP_chat_sesion');
        if (guardado) {
            sesionIdRef.current = guardado;
        } else {
            sesionIdRef.current = (crypto.randomUUID ? crypto.randomUUID() : `sb-${Date.now()}-${Math.random().toString(16).slice(2)}`);
            sessionStorage.setItem('SS SWAP_chat_sesion', sesionIdRef.current);
        }
    }

    // Este widget es para clientes/visitantes; en el panel interno del
    // taller (staff) y en el login de administracion no aplica.
    const ocultoEnEstaRuta = pathname.startsWith('/dashboard') || pathname === '/admin/login';

    useEffect(() => {
        if (abierto && mensajes.length === 0) {
            const nombreCliente = tieneRol('cliente') ? usuario?.nombre?.trim().split(' ')[0] : null;
            agregarBot({ tipo: 'texto', texto: swapbotSaludo(nombreCliente) });
        }
        // eslint-disable-next-line
    }, [abierto]);

    // Permite abrir el widget desde un boton en cualquier pagina:
    // window.dispatchEvent(new Event('swapbot:abrir'))
    useEffect(() => {
        const abrir = () => setAbierto(true);
        window.addEventListener('swapbot:abrir', abrir);
        return () => window.removeEventListener('swapbot:abrir', abrir);
    }, []);

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
                sesion_id: sesionIdRef.current,
                email: tieneRol('cliente') ? (usuario?.email || undefined) : undefined,
            });
            if (data.sesion_id && data.sesion_id !== sesionIdRef.current) {
                sesionIdRef.current = data.sesion_id;
                sessionStorage.setItem('SS SWAP_chat_sesion', data.sesion_id);
            }
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