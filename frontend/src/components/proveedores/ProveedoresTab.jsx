/**
 * SS SWAP - Pestaña "Proveedores" (dentro de la seccion Proveedores)
 * CRUD de proveedores + gestion de sus contactos (subseccion "Usuarios" del
 * prompt: son contactos de referencia, no usuarios del sistema de login).
 */
import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from '../common/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { nuevaClaveIdempotencia, conClave } from '../../utils/idempotencia';
import RegistradoPor from '../common/RegistradoPor';

function IconPlus()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconEdit()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }
function IconUsers() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>; }
function IconX()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconStar()  { return <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }

const EMPTY_PROV = { nombre_comercial: '', razon_social: '', ruc: '', categoria: '', direccion: '', telefono: '', email: '', notas: '', activo: true };
const EMPTY_CONT = { nombre: '', cargo: '', telefono: '', email: '', es_principal: false };
const CATEGORIAS = ['Repuestos', 'Insumos', 'Herramientas', 'Servicios', 'Materiales', 'Otros'];

export default function ProveedoresTab({ theme, proveedores, loading, cargarProveedores, busqueda, setBusqueda }) {
    const { puede } = useAuth();
    const confirm = useConfirm();
    const { txt, txtSf, mut, bdr, card, cardSh, inputBg, SKY, SKY_DEEP, SKY_PALE, SKY_BDR } = theme;
    const [modal, setModal]         = useState({ open: false, data: null });
    const [modalCont, setModalCont] = useState({ open: false, proveedor: null });

    // Editar actualiza el registro existente por su id (PUT); crear usa una
    // clave de idempotencia por formulario para que un doble envio no duplique.
    const guardar = async (form, clave) => {
        const datos = {
            nombre_comercial: form.nombre_comercial, razon_social: form.razon_social, ruc: form.ruc, categoria: form.categoria,
            direccion: form.direccion, telefono: form.telefono, email: form.email, notas: form.notas, activo: form.activo,
        };
        try {
            if (modal.data) {
                await api.put(`/proveedores/proveedores/${modal.data.id}`, datos);
                toast.success('Proveedor actualizado.');
            } else {
                try {
                    await api.post('/proveedores/proveedores', datos, conClave(clave));
                } catch (err) {
                    // Mismo nombre sin RUC: puede ser otro proveedor real; se pide confirmacion.
                    if (err.response?.data?.codigo !== 'POSIBLE_DUPLICADO') throw err;
                    if (!(await confirm({ title: 'Posible proveedor repetido', message: `${err.response.data.error} ¿Crear de todas formas un proveedor nuevo con el mismo nombre?`, confirmLabel: 'Crear otro', danger: false }))) return;
                    await api.post('/proveedores/proveedores', { ...datos, confirmar_duplicado: true }, conClave(nuevaClaveIdempotencia()));
                }
                toast.success('Proveedor creado.');
            }
            setModal({ open: false, data: null });
            cargarProveedores();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar el proveedor.'); }
    };

    // Sin historial se elimina; con compras/gastos/pagos el servidor lo desactiva para conservarlos.
    const eliminar = async (p) => {
        if (!(await confirm({ title: 'Eliminar proveedor', danger: true, confirmLabel: 'Eliminar',
            message: `¿Eliminar al proveedor "${p.nombre_comercial}"? Si tiene compras, gastos o pagos registrados no se borra: se desactiva y su historial se conserva.` }))) return;
        try {
            const { data } = await api.delete(`/proveedores/proveedores/${p.id}`);
            if (data.accion === 'desactivado') toast(data.mensaje, { icon: 'ℹ️', duration: 7000 });
            else toast.success(data.mensaje || 'Proveedor eliminado.');
            cargarProveedores();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar el proveedor.'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <input
                    value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre, razon social o RUC..."
                    style={{ flex: 1, minWidth: 220, maxWidth: 340, padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' }}
                />
                {puede('proveedores', 'crear') && <button onClick={() => setModal({ open: true, data: null })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '10px 20px', cursor: 'pointer' }}>
                    <IconPlus /> NUEVO PROVEEDOR
                </button>}
            </div>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando proveedores...</p>
            ) : proveedores.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>Sin proveedores registrados</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginTop: 4 }}>Crea el primero para empezar a registrar compras y gastos.</p>
                </div>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table">
                        <thead>
                            <tr style={{ background: SKY_PALE }}>
                                {['Proveedor', 'RUC', 'Categoria', 'Contacto', 'Compras', 'Estado', ''].map(h => (
                                    <th key={h} style={{ color: SKY_DEEP }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {proveedores.map(p => (
                                <tr key={p.id} style={{ borderColor: bdr, opacity: p.activo ? 1 : .55 }}>
                                    <td>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: txt }}>{p.nombre_comercial}</p>
                                        {p.razon_social && <p style={{ fontSize: '.74rem', color: mut }}>{p.razon_social}</p>}
                                        <RegistradoPor nombre={p.creado_por_nombre} fechaRegistro={p.created_at} color={mut} />
                                    </td>
                                    <td style={{ color: txtSf }}>{p.ruc || '—'}</td>
                                    <td style={{ color: txtSf }}>{p.categoria || '—'}</td>
                                    <td style={{ color: txtSf }}>
                                        {p.telefono && <div>{p.telefono}</div>}
                                        {p.email && <div style={{ fontSize: '.78rem', color: mut }}>{p.email}</div>}
                                        {!p.telefono && !p.email && '—'}
                                    </td>
                                    <td style={{ color: txtSf }}>{p.total_compras ?? 0}</td>
                                    <td>
                                        <span className="prov-badge" style={{ background: p.activo ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.08)', border: `1px solid ${p.activo ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.25)'}`, color: p.activo ? '#10b981' : '#ef4444' }}>
                                            {p.activo ? 'ACTIVO' : 'INACTIVO'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                            <button className="prov-icon-btn" title="Contactos" style={{ color: SKY_DEEP }} onClick={() => setModalCont({ open: true, proveedor: p })}><IconUsers /></button>
                                            {puede('proveedores', 'editar') && <button className="prov-icon-btn" title="Editar" style={{ color: SKY_DEEP }} onClick={() => setModal({ open: true, data: p })}><IconEdit /></button>}
                                            {p.activo && (
                                                puede('proveedores', 'eliminar') && <button className="prov-icon-btn" title="Eliminar o desactivar" style={{ color: '#ef4444' }} onClick={() => eliminar(p)}><IconTrash /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modal.open && (
                <ModalProveedor theme={theme} data={modal.data} onClose={() => setModal({ open: false, data: null })} onGuardar={guardar} />
            )}
            {modalCont.open && (
                <ModalContactos theme={theme} proveedor={modalCont.proveedor} onClose={() => setModalCont({ open: false, proveedor: null })} />
            )}
        </div>
    );
}

export function ModalProveedor({ theme, data, onClose, onGuardar, etiqueta }) {
    const { txt, mut, bdr, inputBg, boxBg, SKY, SKY_DEEP, labelSt, inputSt } = theme;
    const [form, setForm] = useState(data ? { ...EMPTY_PROV, ...data } : EMPTY_PROV);
    const [saving, setSaving] = useState(false);
    const enviando = useRef(false);                       // bloquea el doble clic antes de re-renderizar
    const [clave] = useState(nuevaClaveIdempotencia);     // una clave por formulario abierto
    const esEdicion = Boolean(data?.id);   // sin id = alta con datos precargados (p. ej. de una factura)

    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
    };
    const onSubmit = async (e) => {
        e.preventDefault();
        if (enviando.current) return;
        enviando.current = true; setSaving(true);
        try { await onGuardar(form, clave); } finally { enviando.current = false; setSaving(false); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 640, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>{etiqueta || 'PROVEEDORES'}</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt }}>{esEdicion ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                </div>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>NOMBRE COMERCIAL *</label>
                            <input name="nombre_comercial" value={form.nombre_comercial} onChange={onChange} required placeholder="Ej: Repuestos El Motor" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>RAZON SOCIAL</label>
                            <input name="razon_social" value={form.razon_social || ''} onChange={onChange} style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>RUC</label>
                            <input name="ruc" value={form.ruc || ''} onChange={onChange} style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>CATEGORIA</label>
                            <select name="categoria" value={form.categoria || ''} onChange={onChange} style={inputSt}>
                                <option value="">Seleccionar...</option>
                                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>TELEFONO</label>
                            <input name="telefono" value={form.telefono || ''} onChange={onChange} style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>EMAIL</label>
                            <input type="email" name="email" value={form.email || ''} onChange={onChange} style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>DIRECCION</label>
                            <input name="direccion" value={form.direccion || ''} onChange={onChange} style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>NOTAS</label>
                            <textarea name="notas" value={form.notas || ''} onChange={onChange} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
                        </div>
                    </div>

                    {esEdicion && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: "'Outfit'", fontSize: '.85rem', color: txt }}>
                            <input type="checkbox" name="activo" checked={form.activo !== false} onChange={onChange} style={{ accentColor: '#10b981' }} />
                            Proveedor activo
                        </label>
                    )}

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}`, marginTop: 4 }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>
                            {saving ? 'GUARDANDO...' : esEdicion ? 'GUARDAR CAMBIOS' : 'CREAR PROVEEDOR'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ModalContactos({ theme, proveedor, onClose }) {
    const { puede } = useAuth();
    const { txt, txtSf, mut, bdr, inputBg, boxBg, SKY, SKY_DEEP, SKY_PALE, SKY_BDR, labelSt, inputSt } = theme;
    const confirm = useConfirm();
    const [contactos, setContactos] = useState(proveedor.contactos || []);
    const [cargando, setCargando]   = useState(!proveedor.contactos);
    const [form, setForm] = useState(EMPTY_CONT);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);

    const cargar = React.useCallback(async () => {
        setCargando(true);
        try {
            const { data } = await api.get(`/proveedores/contactos?proveedor_id=${proveedor.id}`);
            setContactos(data.contactos || []);
        } catch (err) { toast.error('Error al cargar contactos.'); }
        finally { setCargando(false); }
    }, [proveedor.id]);

    React.useEffect(() => { if (!proveedor.contactos) cargar(); }, [cargar, proveedor.contactos]);

    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
    };

    const guardar = async (e) => {
        e.preventDefault();
        if (!form.nombre.trim()) return toast.error('El nombre del contacto es requerido.');
        setSaving(true);
        try {
            if (editId) {
                await api.put(`/proveedores/contactos/${editId}`, form);
                toast.success('Contacto actualizado.');
            } else {
                await api.post('/proveedores/contactos', { ...form, proveedor_id: proveedor.id });
                toast.success('Contacto agregado.');
            }
            setForm(EMPTY_CONT); setEditId(null);
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar el contacto.'); }
        finally { setSaving(false); }
    };

    const editar = (c) => { setForm({ nombre: c.nombre, cargo: c.cargo || '', telefono: c.telefono || '', email: c.email || '', es_principal: c.es_principal }); setEditId(c.id); };
    const eliminar = async (c) => {
        if (!(await confirm({ message: `Eliminar el contacto "${c.nombre}"?` }))) return;
        try { await api.delete(`/proveedores/contactos/${c.id}`); toast.success('Contacto eliminado.'); cargar(); }
        catch (err) { toast.error('Error al eliminar el contacto.'); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 620, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>CONTACTOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', letterSpacing: '.04em', color: txt }}>{proveedor.nombre_comercial}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                </div>

                {cargando ? (
                    <p style={{ fontFamily: "'Outfit'", color: mut }}>Cargando...</p>
                ) : contactos.length === 0 ? (
                    <p style={{ fontFamily: "'Outfit'", color: mut, fontSize: '.85rem', marginBottom: 14 }}>Sin contactos registrados todavia.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                        {contactos.map(c => (
                            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: `1px solid ${bdr}`, background: SKY_PALE }}>
                                <div>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: txt, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {c.nombre} {c.es_principal && <span style={{ color: SKY_DEEP }}><IconStar /></span>}
                                    </p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: txtSf }}>
                                        {[c.cargo, c.telefono, c.email].filter(Boolean).join(' · ') || '—'}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {puede('proveedores', 'editar') && <button className="prov-icon-btn" style={{ color: SKY_DEEP }} onClick={() => editar(c)}><IconEdit /></button>}
                                    {puede('proveedores', 'eliminar') && <button className="prov-icon-btn" style={{ color: '#ef4444' }} onClick={() => eliminar(c)}><IconTrash /></button>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={guardar} style={{ borderTop: `1px solid ${bdr}`, paddingTop: 16 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 10 }}>
                        {editId ? 'EDITAR CONTACTO' : 'AGREGAR CONTACTO'}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <input name="nombre" value={form.nombre} onChange={onChange} placeholder="Nombre *" style={inputSt} />
                        <input name="cargo" value={form.cargo} onChange={onChange} placeholder="Cargo" style={inputSt} />
                        <input name="telefono" value={form.telefono} onChange={onChange} placeholder="Telefono" style={inputSt} />
                        <input name="email" value={form.email} onChange={onChange} placeholder="Email" style={inputSt} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: "'Outfit'", fontSize: '.82rem', color: txt }}>
                            <input type="checkbox" name="es_principal" checked={form.es_principal} onChange={onChange} style={{ accentColor: SKY }} />
                            Contacto principal
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {editId && (
                                <button type="button" onClick={() => { setForm(EMPTY_CONT); setEditId(null); }}
                                    style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.12em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: '8px 14px', cursor: 'pointer', color: mut }}>
                                    CANCELAR
                                </button>
                            )}
                            <button type="submit" disabled={saving}
                                style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.12em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 9, padding: '8px 16px', cursor: 'pointer' }}>
                                {editId ? 'GUARDAR' : 'AGREGAR'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
