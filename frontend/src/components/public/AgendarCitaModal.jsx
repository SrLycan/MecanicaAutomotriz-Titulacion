import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import './AgendarCitaModal.css';

const GOLD = '#3b7bab';
const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PASOS = [
    { n: 1, label: 'Sucursal' },
    { n: 2, label: 'Fecha' },
    { n: 3, label: 'Hora' },
    { n: 4, label: 'Detalles' },
];

function toISODate(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function esMismoDia(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function buildMonthGrid(year, month) {
    const primero  = new Date(year, month, 1);
    const inicioSem = primero.getDay();
    const diasMes  = new Date(year, month + 1, 0).getDate();
    const celdas   = [];
    for (let i = 0; i < inicioSem; i++) celdas.push(null);
    for (let d = 1; d <= diasMes; d++) celdas.push(new Date(year, month, d));
    while (celdas.length % 7 !== 0) celdas.push(null);
    return celdas;
}
function formatearFechaLarga(d) {
    const s = d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AgendarCitaModal({ servicio, onClose }) {
    const navigate = useNavigate();
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const mesMinimo = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const mesMaximo = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 1);

    const [paso, setPaso]                     = useState(1);
    const [cargandoInicial, setCargandoInicial] = useState(true);
    const [sinVinculo, setSinVinculo]         = useState(false);
    const [vehiculos, setVehiculos]           = useState([]);
    const [sucursales, setSucursales]         = useState([]);

    const [sucursalId, setSucursalId]         = useState(null);
    const [mesCursor, setMesCursor]           = useState(mesMinimo);
    const [fecha, setFecha]                   = useState(null);
    const [slots, setSlots]                   = useState([]);
    const [cargandoSlots, setCargandoSlots]   = useState(false);
    const [mensajeSlots, setMensajeSlots]     = useState('');
    const [horaElegida, setHoraElegida]       = useState(null);
    const [vehiculoId, setVehiculoId]         = useState('');
    const [notas, setNotas]                   = useState('');
    const [enviando, setEnviando]             = useState(false);
    const [citaCreada, setCitaCreada]         = useState(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onEsc);
        return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onEsc); };
    }, [onClose]);

    useEffect(() => {
        Promise.all([api.get('/panel/mi-actividad'), api.get('/sucursales/public')])
            .then(([panelRes, sucRes]) => {
                const data = panelRes.data;
                if (!data.cliente) setSinVinculo(true);
                else setVehiculos(data.vehiculos || []);
                const sucs = sucRes.data.sucursales || [];
                setSucursales(sucs);
                if (sucs.length === 1) setSucursalId(sucs[0].id);
            })
            .catch(() => toast.error('No se pudo cargar la informacion para agendar.'))
            .finally(() => setCargandoInicial(false));
    }, []);

    useEffect(() => {
        if (!cargandoInicial && sucursales.length === 1 && paso === 1) setPaso(2);
    }, [cargandoInicial, sucursales, paso]);

    useEffect(() => {
        if (paso !== 3 || !sucursalId || !fecha) return;
        setCargandoSlots(true);
        setMensajeSlots('');
        setHoraElegida(null);
        api.get('/citas/disponibilidad', { params: { sucursal_id: sucursalId, servicio_id: servicio.id, fecha: toISODate(fecha) } })
            .then(r => {
                if (!r.data.abierto) { setSlots([]); setMensajeSlots(r.data.mensaje || 'El taller no atiende ese dia.'); return; }
                const s = r.data.slots || [];
                setSlots(s);
                if (!s.some(x => x.disponible)) setMensajeSlots('No hay cupos disponibles ese dia. Prueba con otra fecha.');
            })
            .catch(err => { setMensajeSlots(err.response?.data?.error || 'Error al consultar disponibilidad.'); setSlots([]); })
            .finally(() => setCargandoSlots(false));
    }, [paso, sucursalId, fecha, servicio.id]);

    // Mantiene la agenda actualizada si otro cliente toma un turno.
    useEffect(() => {
        if (paso !== 3 || !sucursalId || !fecha) return;
        const id = setInterval(() => api.get('/citas/disponibilidad', { params: { sucursal_id: sucursalId, servicio_id: servicio.id, fecha: toISODate(fecha) } })
            .then(r => { setSlots(r.data.slots || []); if (horaElegida && !(r.data.slots || []).some(s => s.hora_inicio === horaElegida.hora_inicio && s.disponible)) setHoraElegida(null); }).catch(() => {}), 15000);
        return () => clearInterval(id);
    }, [paso, sucursalId, fecha, servicio.id, horaElegida]);

    const confirmar = async () => {
        setEnviando(true);
        try {
            const { data } = await api.post('/citas', {
                servicio_id: servicio.id,
                sucursal_id: sucursalId,
                vehiculo_id: vehiculoId || null,
                fecha: toISODate(fecha),
                hora_inicio: horaElegida.hora_inicio,
                notas: notas.trim() || null,
            });
            setCitaCreada(data.cita);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo agendar la cita.');
            if (err.response?.status === 409) setPaso(3);
        } finally {
            setEnviando(false);
        }
    };

    const sucursalElegida = sucursales.find(s => s.id === sucursalId);
    const puedeAvanzarDeFecha = Boolean(fecha);
    const puedeAvanzarDeHora  = Boolean(horaElegida);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
             onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>

            <div className="acm-backdrop" />
            <div className="acm-panel" onMouseDown={(e) => e.stopPropagation()}>
                <button className="acm-close" onClick={onClose} aria-label="Cerrar"><CerrarIcon /></button>

                <div style={{ padding: '30px 30px 26px' }}>
                    {/* Encabezado */}
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '.66rem', letterSpacing: '.2em', color: GOLD, marginBottom: 6 }}>AGENDAR SERVICIO</p>
                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.02em', color: '#fff', marginBottom: 18, lineHeight: 1.1 }}>{servicio.nombre}</h2>

                    {citaCreada ? (
                        <PantallaExito sucursal={sucursalElegida} fecha={fecha} hora={horaElegida}
                            onCerrar={onClose} onVerCitas={() => navigate('/mi-panel', { state: { tab: 'citas' } })} />
                    ) : cargandoInicial ? (
                        <div style={{ padding: '50px 0', textAlign: 'center', color: 'rgba(255,255,255,.4)', fontFamily: "'Outfit'" }}>Cargando…</div>
                    ) : sinVinculo ? (
                        <div style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 14, padding: '24px 22px', textAlign: 'center' }}>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: '#57708a', marginBottom: 8 }}>Cuenta aun no vinculada</p>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.87rem', color: 'rgba(255,255,255,.55)', lineHeight: 1.6 }}>
                                Tu cuenta todavia no esta vinculada a un cliente del taller, asi que no podemos agendar tu cita en linea todavia. Visita cualquiera de nuestras sucursales para completar tu registro.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Step indicator */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26, flexWrap: 'wrap' }}>
                                {PASOS.map(p => (
                                    <div key={p.n} className={`acm-step ${paso === p.n ? 'active' : paso > p.n ? 'done' : ''}`}>
                                        <span className="acm-dot">{paso > p.n ? '✓' : p.n}</span>{p.label}
                                    </div>
                                ))}
                            </div>

                            {/* PASO 1: Sucursal */}
                            {paso === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {sucursales.map(s => (
                                        <div key={s.id} className={`acm-radio ${sucursalId === s.id ? 'selected' : ''}`} onClick={() => setSucursalId(s.id)}>
                                            <span style={{ color: GOLD }}><PinIcon /></span>
                                            <div>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: '#fff', fontSize: '.9rem' }}>{s.nombre}</p>
                                                {s.direccion && <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: 'rgba(255,255,255,.45)' }}>{s.direccion}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* PASO 2: Fecha */}
                            {paso === 2 && (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                        <button className="acm-navbtn" disabled={mesCursor.getTime() <= mesMinimo.getTime()}
                                            onClick={() => setMesCursor(new Date(mesCursor.getFullYear(), mesCursor.getMonth() - 1, 1))}><ChevronIcon dir="left" /></button>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: '#fff', fontSize: '.9rem' }}>{MESES[mesCursor.getMonth()]} {mesCursor.getFullYear()}</p>
                                        <button className="acm-navbtn" disabled={mesCursor.getTime() >= mesMaximo.getTime()}
                                            onClick={() => setMesCursor(new Date(mesCursor.getFullYear(), mesCursor.getMonth() + 1, 1))}><ChevronIcon dir="right" /></button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 5 }}>
                                        {DIAS_SEMANA.map((d, i) => (
                                            <p key={i} style={{ textAlign: 'center', fontFamily: "'Outfit'", fontSize: '.68rem', color: 'rgba(255,255,255,.35)', fontWeight: 600 }}>{d}</p>
                                        ))}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
                                        {buildMonthGrid(mesCursor.getFullYear(), mesCursor.getMonth()).map((d, i) => {
                                            if (!d) return <div key={i} />;
                                            const esPasado  = d < hoy;
                                            const esDomingo = d.getDay() === 0;
                                            return (
                                                <button key={i} disabled={esPasado || esDomingo}
                                                    className={`acm-daybtn ${esMismoDia(d, fecha) ? 'selected' : ''} ${esMismoDia(d, hoy) ? 'today' : ''}`}
                                                    onClick={() => setFecha(d)}>
                                                    {d.getDate()}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: 'rgba(255,255,255,.3)', marginTop: 12 }}>Cerramos los domingos. Puedes agendar hasta con 2 meses de anticipacion.</p>
                                </div>
                            )}

                            {/* PASO 3: Hora */}
                            {paso === 3 && (
                                <div>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: 'rgba(255,255,255,.6)', marginBottom: 14 }}>{fecha && formatearFechaLarga(fecha)}</p>
                                    {cargandoSlots ? (
                                        <div style={{ padding: '30px 0', textAlign: 'center', color: 'rgba(255,255,255,.4)', fontFamily: "'Outfit'", fontSize: '.85rem' }}>Consultando horarios disponibles…</div>
                                    ) : mensajeSlots && !slots.some(s => s.disponible) ? (
                                        <div style={{ padding: '20px 0', textAlign: 'center' }}>
                                            <p style={{ fontFamily: "'Outfit'", color: 'rgba(255,255,255,.5)', fontSize: '.87rem', marginBottom: 14 }}>{mensajeSlots}</p>
                                            <button className="acm-btn-ghost" onClick={() => setPaso(2)}>Elegir otra fecha</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8 }}>
                                            {slots.map(s => (
                                                <button key={s.hora_inicio} disabled={!s.disponible}
                                                    className={`acm-slot ${horaElegida?.hora_inicio === s.hora_inicio ? 'selected' : ''}`}
                                                    onClick={() => setHoraElegida(s)}>
                                                    {s.hora_inicio}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PASO 4: Detalles y confirmacion */}
                            {paso === 4 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    {vehiculos.length > 0 && (
                                        <div>
                                            <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.78rem', color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Vehiculo (opcional)</p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {vehiculos.map(v => (
                                                    <div key={v.id} className={`acm-radio ${vehiculoId === String(v.id) ? 'selected' : ''}`} onClick={() => setVehiculoId(String(v.id))}>
                                                        <span style={{ color: GOLD }}><CarIcon /></span>
                                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.87rem', color: '#fff' }}>{v.marca} {v.modelo} {v.anio ? `· ${v.anio}` : ''} <code style={{ color: 'rgba(255,255,255,.4)' }}>({v.placa})</code></p>
                                                    </div>
                                                ))}
                                                <div className={`acm-radio ${vehiculoId === '' ? 'selected' : ''}`} onClick={() => setVehiculoId('')}>
                                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: 'rgba(255,255,255,.55)' }}>Lo indicare directamente en el taller</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.78rem', color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Notas para el taller (opcional)</p>
                                        <textarea className="acm-textarea" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej. ruido al frenar, revisar antes de viaje, etc." maxLength={400} />
                                    </div>

                                    <div style={{ background: 'rgba(201,162,39,.06)', border: '1px solid rgba(201,162,39,.2)', borderRadius: 14, padding: '18px 20px' }}>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.78rem', color: GOLD, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Resumen de tu cita</p>
                                        <ResumenLinea label="Servicio" valor={`${servicio.nombre}${Number(servicio.precio_base) > 0 ? ` · desde $${parseFloat(servicio.precio_base).toFixed(2)}` : ''}`} />
                                        <ResumenLinea label="Sucursal" valor={sucursalElegida?.nombre || '—'} />
                                        <ResumenLinea label="Fecha"    valor={fecha ? formatearFechaLarga(fecha) : '—'} />
                                        <ResumenLinea label="Hora"     valor={horaElegida ? `${horaElegida.hora_inicio} — ${horaElegida.hora_fin}` : '—'} />
                                    </div>
                                </div>
                            )}

                            {/* Navegacion */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 26 }}>
                                {paso > (sucursales.length === 1 ? 2 : 1) ? (
                                    <button className="acm-btn-ghost" onClick={() => setPaso(p => p - 1)}>Atras</button>
                                ) : <span />}

                                {paso < 4 && (
                                    <button className="acm-btn-primary"
                                        disabled={(paso === 1 && !sucursalId) || (paso === 2 && !puedeAvanzarDeFecha) || (paso === 3 && !puedeAvanzarDeHora)}
                                        onClick={() => setPaso(p => p + 1)}>
                                        Continuar
                                    </button>
                                )}
                                {paso === 4 && (
                                    <button className="acm-btn-primary" disabled={enviando} onClick={confirmar}>
                                        {enviando ? 'Agendando…' : 'Confirmar cita'}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ResumenLinea({ label, valor }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <span style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: 'rgba(255,255,255,.45)' }}>{label}</span>
            <span style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.82rem', color: '#fff', textAlign: 'right' }}>{valor}</span>
        </div>
    );
}

function PantallaExito({ sucursal, fecha, hora, onCerrar, onVerCitas }) {
    return (
        <div style={{ textAlign: 'center', padding: '20px 0 6px' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 40, animation: 'acmCheck .5s ease .1s both' }} />
                </svg>
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', letterSpacing: '.03em', color: '#fff', marginBottom: 10 }}>Cita agendada</h3>
            <p style={{ fontFamily: "'Outfit'", fontSize: '.87rem', color: 'rgba(255,255,255,.55)', lineHeight: 1.7, marginBottom: 26, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
                Tu solicitud quedó pendiente de confirmación. Te avisaremos en tu panel cuando recepción o un técnico la acepte o la cancele. Horario solicitado: {fecha && formatearFechaLarga(fecha)} a las {hora?.hora_inicio} en {sucursal?.nombre}.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="acm-btn-ghost" onClick={onCerrar}>Cerrar</button>
                <button className="acm-btn-primary" onClick={onVerCitas}>Ver mis citas</button>
            </div>
        </div>
    );
}

function CerrarIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function PinIcon()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function CarIcon()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.5l2-3h7l2 3H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/></svg>; }
function ChevronIcon({ dir }) { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'}/></svg>; }
