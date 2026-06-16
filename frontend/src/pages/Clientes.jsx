import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ESTADO_ORDEN_MAP, ESTADO_PROGRESO_MAP } from '../constants/ordenes';

function IconPlus()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconSearch(){ return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconX()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconUser()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function IconCar()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.5l2-3h7l2 3H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/></svg>; }
function IconStar()  { return <svg width="12" height="12" viewBox="0 0 24 24" fill="#c9a227" stroke="#f4c93a" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }

function validarClienteForm(form) {
    if (!form.nombre?.trim()) return 'El nombre es obligatorio.';
    if (!form.cedula?.trim()) return 'La cedula es obligatoria.';
    if (!form.telefono?.trim() && !form.email?.trim()) return 'Debe indicar telefono o email.';
    return null;
}

export default function Clientes() {
    const { isDark } = useTheme();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [modal, setModal] = useState({ open: false, data: null });
    const [detalle, setDetalle] = useState(null);
    const [modalVehiculo, setModalVehiculo] = useState(false);
    const debounceRef = useRef(null);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.18)';
    const txt    = isDark ? '#f1f5f9' : '#020617';
    const txtSf  = isDark ? '#cbd5e1' : '#0f172a';
    const mut    = isDark ? 'rgba(241,245,249,0.55)' : '#475569';
    const bdr    = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.07)';
    const card   = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';
    const inputBg = isDark ? '#0b1220' : '#fafcff';

    const cargar = async (q = busqueda) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            const { data } = await api.get(`/ordenes/clientes?${params}`);
            setClientes(data.clientes);
        } catch { toast.error('Error al cargar clientes.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { cargar(''); }, []);

    const handleBusqueda = (e) => {
        const v = e.target.value;
        setBusqueda(v);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => cargar(v), 300);
    };

    const guardarCliente = async (form) => {
        try {
            if (modal.data) {
                await api.put(`/ordenes/clientes/${modal.data.id}`, form);
                toast.success('Cliente actualizado.');
            } else {
                await api.post('/ordenes/clientes', form);
                toast.success('Cliente registrado.');
            }
            setModal({ open: false, data: null });
            cargar(busqueda);
            if (detalle?.cliente?.id === modal.data?.id) {
                verDetalle(modal.data.id);
            }
        } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar.'); }
    };

    const verDetalle = async (id) => {
        try {
            const { data } = await api.get(`/ordenes/clientes/${id}`);
            setDetalle(data);
        } catch { toast.error('Error al cargar detalle.'); }
    };

    const guardarVehiculo = async (form) => {
        try {
            await api.post('/ordenes/vehiculos', { ...form, cliente_id: detalle.cliente.id });
            toast.success('Vehiculo registrado.');
            setModalVehiculo(false);
            verDetalle(detalle.cliente.id);
        } catch (err) { toast.error(err.response?.data?.error || 'Error.'); }
    };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500 }}>
            <style>{`@keyframes fadeIn { from { opacity:0;transform:translateY(6px) } to { opacity:1;transform:none } }`}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="sswap-chip" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        <span>SSWAP · TALLER · CLIENTES</span>
                    </div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Clientes</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        Registro de clientes, vehiculos e historial de servicios
                    </p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <IconStar /> Clientes con estrella tienen cuenta vinculada en la web (registro online)
                    </p>
                </div>
                <button onClick={() => setModal({ open: true, data: null })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                        fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em',
                        color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`,
                        border: 'none', borderRadius: 11, padding: '11px 22px', cursor: 'pointer',
                        boxShadow: `0 6px 18px -6px ${SKY}` }}>
                    <IconPlus /> NUEVO CLIENTE
                </button>
            </div>

            <div style={{ padding: 16, marginBottom: 16, background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: mut, display: 'flex' }}><IconSearch /></span>
                    <input placeholder="Buscar por nombre, cedula o telefono..."
                           value={busqueda} onChange={handleBusqueda}
                           style={{ padding: '10px 12px 10px 32px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 80, textAlign: 'center' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: SKY, animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Cargando clientes...</p>
                </div>
            ) : clientes.length === 0 ? (
                <div style={{ padding: 80, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
                    <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: 18, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKY }}><IconUser /></div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.06em', color: txt }}>Sin clientes registrados</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginTop: 4 }}>Registra el primer cliente del taller.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: detalle ? '1fr 1.1fr' : '1fr', gap: 16, alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {clientes.map((c, i) => (
                            <div key={c.id} onClick={() => verDetalle(c.id)}
                                style={{
                                    padding: '14px 18px',
                                    background: detalle?.cliente?.id === c.id ? SKY_PALE : card,
                                    border: `1px solid ${detalle?.cliente?.id === c.id ? SKY_BDR : bdr}`,
                                    borderRadius: 12, boxShadow: cardSh, cursor: 'pointer', transition: 'all .15s',
                                    animation: 'fadeIn .3s ease both', animationDelay: `${i * 25}ms`,
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${SKY}14`, border: `1px solid ${SKY}30`, color: SKY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <IconUser />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.9rem', color: txt, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {c.nombre}
                                            {c.cuenta_web && (
                                                <span title="Registrado en la web (cuenta vinculada)" style={{ display: 'inline-flex', alignItems: 'center' }}><IconStar /></span>
                                            )}
                                        </p>
                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginTop: 2 }}>
                                            {[c.telefono, c.cedula].filter(Boolean).join(' · ') || c.email || 'Sin contacto'}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.68rem', color: mut }}>
                                            {new Date(c.created_at).toLocaleDateString('es-EC')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {detalle && (
                        <PanelDetalle
                            detalle={detalle}
                            onEditar={() => setModal({ open: true, data: detalle.cliente })}
                            onNuevoVehiculo={() => setModalVehiculo(true)}
                            onCerrar={() => setDetalle(null)}
                            isDark={isDark}
                            card={card}
                            bdr={bdr}
                            mut={mut}
                            txt={txt}
                            txtSf={txtSf}
                            SKY={SKY}
                            SKY_DEEP={SKY_DEEP}
                            SKY_PALE={SKY_PALE}
                            cardSh={cardSh}
                        />
                    )}
                </div>
            )}

            {modal.open && (
                <ModalCliente
                    data={modal.data}
                    onClose={() => setModal({ open: false, data: null })}
                    onGuardar={guardarCliente}
                    isDark={isDark}
                />
            )}

            {modalVehiculo && detalle && (
                <ModalVehiculoRapido
                    onClose={() => setModalVehiculo(false)}
                    onGuardar={guardarVehiculo}
                    isDark={isDark}
                />
            )}
        </div>
    );
}

function PanelDetalle({ detalle, onEditar, onNuevoVehiculo, onCerrar, isDark, card, bdr, mut, txt, txtSf, SKY, SKY_DEEP, SKY_PALE, cardSh }) {
    const { cliente, vehiculos, ordenes } = detalle;

    return (
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: 20, position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: SKY_DEEP, marginBottom: 4 }}>FICHA DE CLIENTE</p>
                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {cliente.nombre}
                        {cliente.cuenta_web && (
                            <span title="Cliente con cuenta en la web" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'rgba(201,162,39,.12)', border: '1px solid rgba(201,162,39,.35)' }}>
                                <IconStar />
                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.45rem', letterSpacing: '.14em', color: '#c9a227' }}>WEB</span>
                            </span>
                        )}
                    </h2>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginTop: 4 }}>
                        Registrado el {new Date(cliente.created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <button onClick={onCerrar} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, padding: 12, borderRadius: 10, background: SKY_PALE }}>
                {cliente.telefono && <Info label="TELEFONO" value={cliente.telefono} mut={mut} txt={txt} />}
                {cliente.email && <Info label="EMAIL" value={cliente.email} mut={mut} txt={txt} />}
                {cliente.cedula && <Info label="CEDULA" value={cliente.cedula} mut={mut} txt={txt} />}
                {cliente.direccion && <Info label="DIRECCION" value={cliente.direccion} mut={mut} txt={txt} />}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                <button onClick={onEditar}
                    style={{ fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.14em', padding: '7px 14px', borderRadius: 8, background: `${SKY}14`, border: `1px solid ${SKY}35`, color: SKY_DEEP, cursor: 'pointer' }}>
                    EDITAR CLIENTE
                </button>
                <button onClick={onNuevoVehiculo}
                    style={{ fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.14em', padding: '7px 14px', borderRadius: 8, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', color: '#10b981', cursor: 'pointer' }}>
                    + VEHICULO
                </button>
            </div>

            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.2em', color: SKY_DEEP, marginBottom: 8 }}>VEHICULOS ({vehiculos.length})</p>
            {vehiculos.length === 0 ? (
                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginBottom: 16 }}>Sin vehiculos asociados.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                    {vehiculos.map(v => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: `1px solid ${bdr}` }}>
                            <span style={{ color: SKY, display: 'flex' }}><IconCar /></span>
                            <div>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.85rem', letterSpacing: '.06em', color: txt }}>{v.placa}</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>{[v.marca, v.modelo, v.anio, v.color].filter(Boolean).join(' · ')}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.2em', color: SKY_DEEP, marginBottom: 8 }}>HISTORIAL DE SERVICIOS ({ordenes.length})</p>
            {ordenes.length === 0 ? (
                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>Sin ordenes de trabajo registradas.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                    {ordenes.map(o => {
                        const est = ESTADO_ORDEN_MAP[o.estado] || { label: o.estado, color: '#64748b' };
                        const prog = o.estado_progreso ? ESTADO_PROGRESO_MAP[o.estado_progreso] : null;
                        return (
                            <div key={o.id} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${bdr}`, background: isDark ? 'rgba(255,255,255,.015)' : 'rgba(14,165,233,.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.85rem', color: txt }}>#{String(o.id).padStart(4, '0')}</span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <Badge label={est.label} color={est.color} />
                                        {prog && <Badge label={prog.label} color={prog.color} />}
                                    </div>
                                </div>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: txtSf, lineHeight: 1.4 }}>{o.descripcion}</p>
                                {o.placa && <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: mut, marginTop: 3 }}>{o.placa} · {o.marca}</p>}
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.65rem', color: mut, marginTop: 4 }}>
                                    {new Date(o.created_at).toLocaleDateString('es-EC')} · {o.usuario_nombre}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function Info({ label, value, mut, txt }) {
    return (
        <div>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.5rem', letterSpacing: '.18em', color: mut }}>{label}</p>
            <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: txt, marginTop: 2 }}>{value}</p>
        </div>
    );
}

function Badge({ label, color }) {
    return (
        <span style={{ padding: '2px 8px', borderRadius: 999, background: `${color}14`, border: `1px solid ${color}35`, color, fontFamily: "'Bebas Neue'", fontSize: '.5rem', letterSpacing: '.14em' }}>
            {label.toUpperCase()}
        </span>
    );
}

function ModalCliente({ data, onClose, onGuardar, isDark }) {
    const [form, setForm] = useState({
        nombre: data?.nombre || '',
        email: data?.email || '',
        telefono: data?.telefono || '',
        cedula: data?.cedula || '',
        direccion: data?.direccion || '',
    });
    const [saving, setSaving] = useState(false);
    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP };

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const onSubmit = async (e) => {
        e.preventDefault();
        const err = validarClienteForm(form);
        if (err) { toast.error(err); return; }
        setSaving(true);
        await onGuardar(form);
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 540, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY}, ${SKY_DEEP}, ${SKY}, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>TALLER · CLIENTES</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>{data ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
                </div>
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>NOMBRE *</label>
                            <input name="nombre" value={form.nombre} onChange={onChange} required style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>CEDULA / RUC *</label>
                            <input name="cedula" value={form.cedula} onChange={onChange} required style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>EMAIL (tel. o email obligatorio)</label>
                            <input type="email" name="email" value={form.email} onChange={onChange} style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>TELEFONO (tel. o email obligatorio)</label>
                            <input name="telefono" value={form.telefono} onChange={onChange} placeholder="+593..." style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>DIRECCION (opcional)</label>
                            <input name="direccion" value={form.direccion} onChange={onChange} style={inputSt} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}` }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>
                            {saving ? 'GUARDANDO...' : data ? 'ACTUALIZAR' : 'REGISTRAR CLIENTE'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ModalVehiculoRapido({ onClose, onGuardar, isDark }) {
    const [form, setForm] = useState({ placa: '', marca: '', modelo: '', anio: '', color: '' });
    const [saving, setSaving] = useState(false);
    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP };

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const onSubmit = async (e) => {
        e.preventDefault();
        if (!form.placa || !form.marca) { toast.error('Placa y marca son obligatorios.'); return; }
        setSaving(true);
        await onGuardar(form);
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 480, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', color: txt }}>Nuevo Vehiculo</h2>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
                </div>
                <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={labelSt}>PLACA *</label><input name="placa" value={form.placa} onChange={onChange} required style={inputSt} /></div>
                    <div><label style={labelSt}>MARCA *</label><input name="marca" value={form.marca} onChange={onChange} required style={inputSt} /></div>
                    <div><label style={labelSt}>MODELO</label><input name="modelo" value={form.modelo} onChange={onChange} style={inputSt} /></div>
                    <div><label style={labelSt}>AÑO</label><input name="anio" value={form.anio} onChange={onChange} type="number" style={inputSt} /></div>
                    <div style={{ gridColumn: '1/-1' }}><label style={labelSt}>COLOR</label><input name="color" value={form.color} onChange={onChange} style={inputSt} /></div>
                    <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', color: '#fff', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', borderRadius: 10, padding: '10px 22px', cursor: 'pointer' }}>
                            {saving ? 'GUARDANDO...' : 'REGISTRAR'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
