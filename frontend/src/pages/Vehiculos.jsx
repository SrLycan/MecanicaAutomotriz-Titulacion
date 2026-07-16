import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ESTADO_ORDEN_MAP, ESTADO_PROGRESO_MAP } from '../constants/ordenes';
import { useConfirm } from '../components/common/ConfirmDialog';

function IconSearch() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconPlus()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconEdit()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }
function IconX()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconCar()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.5l2-3h7l2 3H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/></svg>; }
function IconHistory(){return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }

export default function Vehiculos() {
    const confirm = useConfirm();
    const { tieneRol } = useAuth();
    const { isDark } = useTheme();
    const esRecepcion = tieneRol('recepcionista');
    const puedeEliminar = tieneRol('administrador');
    const [vehiculos, setVehiculos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [modal, setModal] = useState({ open: false, data: null });
    const [modalOrdenes, setModalOrdenes] = useState(null);
    const [ordenesVehiculo, setOrdenesVehiculo] = useState([]);
    const debounceRef = useRef(null);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.18)';
    const txt    = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf  = isDark ? '#cbd5e1' : '#334155';
    const mut    = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
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
            const { data } = await api.get(`/ordenes/vehiculos?${params}`);
            setVehiculos(data.vehiculos);
        } catch { toast.error('Error al cargar vehiculos.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { cargar(''); }, []);

    const handleBusqueda = (e) => {
        const v = e.target.value;
        setBusqueda(v);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => cargar(v), 300);
    };

    const guardar = async (form) => {
        try {
            if (modal.data) {
                await api.put(`/ordenes/vehiculos/${modal.data.id}`, form);
                toast.success('Vehiculo actualizado.');
            } else {
                await api.post('/ordenes/vehiculos', form);
                toast.success('Vehiculo registrado.');
            }
            setModal({ open: false, data: null });
            cargar(busqueda);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar.'); }
    };

    const eliminar = async (v) => {
        if (!(await confirm({ message: `Eliminar vehiculo ${v.placa} (${v.marca})?` }))) return;
        try {
            await api.delete(`/ordenes/vehiculos/${v.id}`);
            toast.success('Vehiculo eliminado.');
            cargar(busqueda);
        } catch (err) { toast.error(err.response?.data?.error || 'Error.'); }
    };

    const verHistorial = async (v) => {
        try {
            const { data } = await api.get(`/ordenes/ordenes?cliente_id=${v.cliente_id}`);
            setOrdenesVehiculo(data.ordenes.filter(o => o.vehiculo_id === v.id));
            setModalOrdenes(v);
        } catch { toast.error('Error al cargar historial.'); }
    };

    const clientesUnicos = [...new Set(vehiculos.map(v => v.cliente_nombre).filter(Boolean))];

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500 }}>
            <style>{`
                @keyframes vRowIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
                .v-row { animation: vRowIn .28s ease both; }
                .v-row:hover { background: ${SKY_PALE}; }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="sswap-chip" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        <span>SSWAP · TALLER · VEHICULOS</span>
                    </div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Vehiculos</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        {clientesUnicos.length} clientes · {vehiculos.length} vehiculos registrados
                        {esRecepcion && ' · Asociacion y consulta de datos'}
                    </p>
                </div>
                <button onClick={() => setModal({ open: true, data: null })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                        fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em',
                        color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`,
                        border: 'none', borderRadius: 11, padding: '11px 22px', cursor: 'pointer',
                        boxShadow: `0 6px 18px -6px ${SKY}` }}>
                    <IconPlus /> NUEVO VEHICULO
                </button>
            </div>

            {/* Search */}
            <div style={{ padding: 16, marginBottom: 16, background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: mut, display: 'flex' }}><IconSearch /></span>
                    <input placeholder="Buscar por placa, marca, modelo o cliente..."
                           value={busqueda} onChange={handleBusqueda}
                           style={{ padding: '10px 12px 10px 32px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div style={{ padding: 80, textAlign: 'center' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: SKY, animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Cargando vehiculos...</p>
                </div>
            ) : vehiculos.length === 0 ? (
                <div style={{ padding: 80, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
                    <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: 18, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKY }}><IconCar /></div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.06em', color: txt }}>Sin vehiculos registrados</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginTop: 4 }}>Registra el primer vehiculo para empezar.</p>
                </div>
            ) : (
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden', boxShadow: cardSh }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${bdr}`, background: SKY_PALE }}>
                                    {['Placa', 'Marca', 'Modelo', 'Año', 'Color', 'Propietario', 'Acciones'].map(h => (
                                        <th key={h} style={{ padding: '13px 18px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP, whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {vehiculos.map((v, idx) => (
                                    <tr key={v.id} className="v-row"
                                        style={{ borderBottom: `1px solid ${bdr}`, animationDelay: `${Math.min(idx * 20, 200)}ms` }}>
                                        <td style={{ padding: '13px 18px' }}>
                                            <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.08em', color: txt }}>{v.placa}</span>
                                        </td>
                                        <td style={{ padding: '13px 18px', fontFamily: "'Outfit'", fontSize: '.85rem', color: txtSf }}>{v.marca}</td>
                                        <td style={{ padding: '13px 18px', fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>{v.modelo || '—'}</td>
                                        <td style={{ padding: '13px 18px', fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>{v.anio || '—'}</td>
                                        <td style={{ padding: '13px 18px' }}>
                                            {v.color ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: v.color.toLowerCase(), border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }} />
                                                    <span style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>{v.color}</span>
                                                </span>
                                            ) : <span style={{ color: mut, fontSize: '.82rem' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '13px 18px' }}>
                                            <span style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.82rem', color: txt }}>{v.cliente_nombre}</span>
                                        </td>
                                        <td style={{ padding: '13px 18px' }}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <ActionBtn title="Historial de ordenes" color={SKY_DEEP} bdr={bdr} onClick={() => verHistorial(v)}><IconHistory /></ActionBtn>
                                                <ActionBtn title="Asociar / Editar datos" color={SKY_DEEP} bdr={bdr} onClick={() => setModal({ open: true, data: v })}><IconEdit /></ActionBtn>
                                                {puedeEliminar && (
                                                    <ActionBtn title="Eliminar" color="#ef4444" bdr={bdr} onClick={() => eliminar(v)}><IconTrash /></ActionBtn>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal vehiculo */}
            {modal.open && (
                <ModalVehiculo
                    data={modal.data}
                    onClose={() => setModal({ open: false, data: null })}
                    onGuardar={guardar}
                    isDark={isDark}
                />
            )}

            {/* Modal historial ordenes */}
            {modalOrdenes && (
                <ModalHistorial
                    vehiculo={modalOrdenes}
                    ordenes={ordenesVehiculo}
                    onClose={() => { setModalOrdenes(null); setOrdenesVehiculo([]); }}
                    isDark={isDark}
                />
            )}
        </div>
    );
}

function ActionBtn({ color, bdr, title, onClick, children }) {
    return (
        <button onClick={onClick} title={title}
            style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: 6, cursor: 'pointer', color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = color + '14'; e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = bdr; e.currentTarget.style.transform = 'none'; }}>
            {children}
        </button>
    );
}

function ModalHistorial({ vehiculo, ordenes, onClose, isDark }) {
    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 560, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY}, ${SKY_DEEP}, ${SKY}, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 4 }}>TALLER · HISTORIAL</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', letterSpacing: '.04em', color: txt }}>{vehiculo.placa}</h2>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>{vehiculo.marca} {vehiculo.modelo || ''} · {vehiculo.cliente_nombre}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
                </div>

                {ordenes.length === 0 ? (
                    <div style={{ padding: '30px 0', textAlign: 'center' }}>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Este vehiculo no tiene ordenes de trabajo registradas.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {ordenes.map(o => {
                            const est = ESTADO_ORDEN_MAP[o.estado] || { label: o.estado, color: '#64748b' };
                            const prog = o.estado_progreso ? ESTADO_PROGRESO_MAP[o.estado_progreso] : null;
                            return (
                                <div key={o.id} style={{ padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(255,255,255,.015)' : 'rgba(14,165,233,.02)', border: `1px solid ${bdr}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.9rem', letterSpacing: '.03em', color: txt }}>#{String(o.id).padStart(4, '0')}</span>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <span style={{ padding: '2px 9px', borderRadius: 999, background: `${est.color}14`, border: `1px solid ${est.color}35`, color: est.color, fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.16em' }}>{est.label.toUpperCase()}</span>
                                            {prog && (
                                                <span style={{ padding: '2px 9px', borderRadius: 999, background: `${prog.color}14`, border: `1px solid ${prog.color}35`, color: prog.color, fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.16em' }}>{prog.label.toUpperCase()}</span>
                                            )}
                                        </div>
                                    </div>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.descripcion}</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.68rem', color: mut, marginTop: 4 }}>{new Date(o.created_at).toLocaleDateString('es-EC')} · {o.usuario_nombre}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function ModalVehiculo({ data, onClose, onGuardar, isDark }) {
    const [clientes, setClientes] = useState([]);
    const [form, setForm] = useState({
        cliente_id: data?.cliente_id || '',
        placa: data?.placa || '',
        marca: data?.marca || '',
        modelo: data?.modelo || '',
        anio: data?.anio || '',
        color: data?.color || '',
        vin: data?.vin || '',
    });
    const [saving, setSaving] = useState(false);
    const esEdicion = Boolean(data);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP };

    useEffect(() => {
        api.get('/ordenes/clientes').then(r => setClientes(r.data.clientes)).catch(() => {});
    }, []);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!form.cliente_id) { toast.error('Selecciona un cliente propietario.'); return; }
        if (!form.placa || !form.marca) { toast.error('Placa y marca son obligatorios.'); return; }
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
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>TALLER · VEHICULOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>{esEdicion ? 'Asociar / Editar Vehiculo' : 'Nuevo Vehiculo'}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
                </div>
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>PROPIETARIO *</label>
                            <select name="cliente_id" value={form.cliente_id} onChange={onChange} required style={inputSt}>
                                <option value="">Seleccionar cliente...</option>
                                {clientes.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre} {c.cedula ? `· ${c.cedula}` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>PLACA *</label>
                            <input name="placa" value={form.placa} onChange={onChange} required placeholder="PCC-1234" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>MARCA *</label>
                            <input name="marca" value={form.marca} onChange={onChange} required placeholder="Toyota" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>MODELO</label>
                            <input name="modelo" value={form.modelo} onChange={onChange} placeholder="Hilux" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>AÑO</label>
                            <input type="number" name="anio" value={form.anio} onChange={onChange} placeholder="2024" min="1990" max="2030" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>COLOR</label>
                            <input name="color" value={form.color} onChange={onChange} placeholder="Blanco" style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>VIN (Numero de chasis)</label>
                            <input name="vin" value={form.vin} onChange={onChange} placeholder="1HGCM82633A004352" maxLength={17} style={inputSt} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}` }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1, boxShadow: `0 6px 18px -6px ${SKY}` }}>
                            {saving ? 'GUARDANDO...' : esEdicion ? 'ACTUALIZAR VEHICULO' : 'REGISTRAR VEHICULO'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
