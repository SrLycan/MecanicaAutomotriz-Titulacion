import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

function IconPlus() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>; }
function IconSearch() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>; }
function IconEdit() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>; }
function IconTrash() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>; }
function IconUser() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>; }

function Kpi({ label, value, color, card, bdr, mut, txt, sh }) {
    return (
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 16, boxShadow: sh }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.56rem', letterSpacing: '.18em', color, marginBottom: 6 }}>{label}</p>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', color: txt, lineHeight: 1 }}>{value}</p>
            <p style={{ fontFamily: "'Outfit'", fontSize: '.74rem', color: mut, marginTop: 4 }}>Clientes registrados</p>
        </div>
    );
}

function ModalCliente({ open, data, onClose, onGuardar, isDark }) {
    const [form, setForm] = useState({ nombre: '', email: '', telefono: '', cedula: '', direccion: '' });

    useEffect(() => {
        if (open) {
            setForm({
                nombre: data?.nombre || '',
                email: data?.email || '',
                telefono: data?.telefono || '',
                cedula: data?.cedula || '',
                direccion: data?.direccion || '',
            });
        }
    }, [open, data]);

    if (!open) return null;

    const card = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const inputBg = isDark ? '#0b1220' : '#fafcff';

    const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 560, background: card, border: `1px solid ${bdr}`, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", letterSpacing: '.14em', color: '#c9a227', marginBottom: 4 }}>{data ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'}</p>
                        <h3 style={{ fontFamily: "'Outfit'", fontSize: '1.1rem', color: txt, margin: 0 }}>{data ? 'Actualizar información' : 'Registrar cliente'}</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: mut, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                    <div>
                        <label style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginBottom: 6 }}>Nombre</label>
                        <input name="nombre" value={form.nombre} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, outline: 'none' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginBottom: 6 }}>Correo</label>
                            <input name="email" value={form.email} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, outline: 'none' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginBottom: 6 }}>Teléfono</label>
                            <input name="telefono" value={form.telefono} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, outline: 'none' }} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginBottom: 6 }}>Cédula</label>
                            <input name="cedula" value={form.cedula} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, outline: 'none' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginBottom: 6 }}>Dirección</label>
                            <input name="direccion" value={form.direccion} onChange={handleChange} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, outline: 'none' }} />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                    <button onClick={onClose} style={{ border: `1px solid ${bdr}`, background: 'transparent', color: mut, borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={() => onGuardar(form)} style={{ border: 'none', background: 'linear-gradient(135deg, #a87a14, #c9a227)', color: '#fff', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>{data ? 'Guardar cambios' : 'Crear cliente'}</button>
                </div>
            </div>
        </div>
    );
}

export default function Clientes() {
    const { isDark } = useTheme();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [modal, setModal] = useState({ open: false, data: null });

    const SKY = '#c9a227';
    const SKY_DEEP = '#a87a14';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf = isDark ? '#cbd5e1' : '#334155';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)';
    const card = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh = isDark ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)' : '0 4px 16px -4px rgba(15,23,42,0.08)';
    const inputBg = isDark ? '#0b1220' : '#fafcff';

    const cargarClientes = useCallback(async (q = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            const { data } = await api.get(`/ordenes/clientes?${params}`);
            setClientes(data.clientes || []);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al cargar clientes.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargarClientes(); }, [cargarClientes]);

    const handleBusqueda = (e) => {
        const value = e.target.value;
        setBusqueda(value);
        setTimeout(() => cargarClientes(value), 300);
    };

    const guardarCliente = async (form) => {
        try {
            if (modal.data) {
                await api.put(`/ordenes/clientes/${modal.data.id}`, form);
                toast.success('Cliente actualizado.');
            } else {
                await api.post('/ordenes/clientes', form);
                toast.success('Cliente creado.');
            }
            setModal({ open: false, data: null });
            cargarClientes(busqueda);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al guardar cliente.');
        }
    };

    const eliminarCliente = async (cliente) => {
        if (!window.confirm(`Eliminar a ${cliente.nombre}?`)) return;
        try {
            await api.delete(`/ordenes/clientes/${cliente.id}`);
            toast.success('Cliente eliminado.');
            cargarClientes(busqueda);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al eliminar cliente.');
        }
    };

    const stats = useMemo(() => ({
        total: clientes.length,
        conEmail: clientes.filter((c) => c.email).length,
        conTelefono: clientes.filter((c) => c.telefono).length,
    }), [clientes]);

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1400 }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="sswap-chip" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        <span>SSWAP · TALLER · CLIENTES</span>
                    </div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Clientes</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        Gestiona la base de clientes del taller, sus datos y contacto.
                    </p>
                </div>
                <button onClick={() => setModal({ open: true, data: null })} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '11px 22px', cursor: 'pointer' }}>
                    <IconPlus /> NUEVO CLIENTE
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 20 }}>
                <Kpi label="Total" value={stats.total} color={SKY} card={card} bdr={bdr} mut={mut} txt={txt} sh={cardSh} />
                <Kpi label="Con correo" value={stats.conEmail} color="#10b981" card={card} bdr={bdr} mut={mut} txt={txt} sh={cardSh} />
                <Kpi label="Con teléfono" value={stats.conTelefono} color="#0ea5e9" card={card} bdr={bdr} mut={mut} txt={txt} sh={cardSh} />
            </div>

            <div style={{ padding: 16, marginBottom: 16, background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
                <div style={{ position: 'relative', maxWidth: 320 }}>
                    <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: mut, display: 'flex' }}><IconSearch /></span>
                    <input value={busqueda} onChange={handleBusqueda} placeholder="Buscar por nombre, cédula o teléfono..." style={{ width: '100%', padding: '10px 12px 10px 36px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' }} />
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 70, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: SKY, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ fontFamily: "'Outfit'", color: mut }}>Cargando clientes...</p>
                </div>
            ) : clientes.length === 0 ? (
                <div style={{ padding: 70, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
                    <div style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: 18, background: isDark ? 'rgba(201,162,39,0.12)' : 'rgba(201,162,39,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKY }}><IconUser /></div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', letterSpacing: '.06em', color: txt }}>No hay clientes todavía</p>
                    <p style={{ fontFamily: "'Outfit'", color: mut, marginTop: 4 }}>Crea el primer cliente para comenzar a registrar órdenes y vehículos.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                    {clientes.map((cliente) => (
                        <div key={cliente.id} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 240 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: isDark ? 'rgba(201,162,39,0.16)' : 'rgba(201,162,39,0.1)', color: SKY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconUser /></div>
                                <div>
                                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', letterSpacing: '.04em', color: txt, marginBottom: 4 }}>{cliente.nombre}</p>
                                    <div style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf, lineHeight: 1.6 }}>
                                        {cliente.email && <div>✉ {cliente.email}</div>}
                                        {cliente.telefono && <div>☎ {cliente.telefono}</div>}
                                        {cliente.cedula && <div>🪪 {cliente.cedula}</div>}
                                        {cliente.direccion && <div>📍 {cliente.direccion}</div>}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button onClick={() => setModal({ open: true, data: cliente })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${bdr}`, background: 'transparent', color: SKY_DEEP, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontFamily: "'Bebas Neue'", letterSpacing: '.12em' }}><IconEdit /> Editar</button>
                                <button onClick={() => eliminarCliente(cliente)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${bdr}`, background: 'transparent', color: '#ef4444', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontFamily: "'Bebas Neue'", letterSpacing: '.12em' }}><IconTrash /> Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal.open && <ModalCliente open={modal.open} data={modal.data} onClose={() => setModal({ open: false, data: null })} onGuardar={guardarCliente} isDark={isDark} />}
        </div>
    );
}