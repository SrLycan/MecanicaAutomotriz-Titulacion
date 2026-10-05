/**
 * SS SWAP - Crear / Editar Proforma
 * /dashboard/proformas/nueva            -> crear
 * /dashboard/proformas/nueva?desde_orden=25  -> crear prellenada desde una orden
 * /dashboard/proformas/:id/editar       -> editar
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import ItemsEditor from '../components/proformas/ItemsEditor';
import PictogramaColisiones from '../components/proformas/PictogramaColisiones';
import './Proformas.css';

const EMPTY = {
    tipo: 'mecanica', cliente_id: '', vehiculo_id: '', sucursal_id: '', orden_id: null,
    cliente_nombre: '', cliente_ruc: '', cliente_direccion: '', cliente_telefono: '', cliente_email: '',
    vehiculo_marca: '', vehiculo_modelo: '', vehiculo_anio: '', vehiculo_color: '', vehiculo_placa: '', vehiculo_vin: '', vehiculo_tipo: '',
    fecha_emision: new Date().toISOString().slice(0, 10), fecha_validez: '',
    observaciones: '', condiciones: '', garantia: '', tiempo_estimado: '',
    descuento: 0, iva_porcentaje: 0, anticipo: 0,
    // Sprint 14: pictograma de colisiones (solo tipo 'pintura' = Colisiones / Pintura)
    carroceria_tipo: '', carroceria_puertas: null, zonas_danadas: [], danos_observaciones: '',
};

function calcularTotalesPreview(items, descuento, ivaPorcentaje, anticipo) {
    const subtotal = items.reduce((s, it) => s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0), 0);
    const desc = Math.max(0, parseFloat(descuento) || 0);
    const base = Math.max(0, subtotal - desc);
    const iva = base * (parseFloat(ivaPorcentaje) || 0) / 100;
    const total = base + iva;
    const ant = Math.max(0, parseFloat(anticipo) || 0);
    return { subtotal, iva, total, saldo: total - ant };
}

export default function ProformaForm() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const desdeOrden = searchParams.get('desde_orden');
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const esEdicion = Boolean(id);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.07)';
    const card = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const cardSh = isDark ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)' : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.86rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.2em', color: SKY_DEEP };
    const theme = { txt, txtSf: txt, mut, bdr, inputSt, labelSt, SKY, SKY_DEEP, SKY_PALE };

    const [form, setForm] = useState(EMPTY);
    const [items, setItems] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [vehiculos, setVehiculos] = useState([]);
    const [sucursales, setSucursales] = useState([]);
    const [repuestos, setRepuestos] = useState([]);
    const [servicios, setServicios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // ── Carga inicial: catalogos + (edicion | desde-orden) ──
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [clientesRes, sucursalesRes, repuestosRes, serviciosRes] = await Promise.all([
                    api.get('/ordenes/clientes'),
                    api.get('/sucursales/public'),
                    api.get('/inventory/repuestos?limit=500'),
                    api.get('/servicios'),
                ]);
                setClientes(clientesRes.data.clientes || []);
                setSucursales(sucursalesRes.data.sucursales || []);
                setRepuestos((repuestosRes.data.repuestos || []).map(r => ({
                    id: r.id, nombre: r.nombre, precio: r.precio_venta, area: r.area || 'mecanica',
                    stock: Number(r.stock_actual), unidad: r.unidad_medida,
                })));
                setServicios((serviciosRes.data.servicios || []).map(s => ({ id: s.id, nombre: s.nombre, precio: s.precio_base })));

                if (esEdicion) {
                    const { data } = await api.get(`/proformas/${id}`);
                    const p = data.proforma;
                    if (p.inventario_descontado_at) {
                        toast.error('Esta proforma ya descontó inventario y no se puede editar.');
                        navigate(`/dashboard/proformas/${id}`, { replace: true });
                        return;
                    }
                    setForm({
                        tipo: p.tipo, cliente_id: p.cliente_id || '', vehiculo_id: p.vehiculo_id || '', sucursal_id: p.sucursal_id || '', orden_id: p.orden_id,
                        cliente_nombre: p.cliente_nombre || '', cliente_ruc: p.cliente_ruc || '', cliente_direccion: p.cliente_direccion || '',
                        cliente_telefono: p.cliente_telefono || '', cliente_email: p.cliente_email || '',
                        vehiculo_marca: p.vehiculo_marca || '', vehiculo_modelo: p.vehiculo_modelo || '', vehiculo_anio: p.vehiculo_anio || '',
                        vehiculo_color: p.vehiculo_color || '', vehiculo_placa: p.vehiculo_placa || '', vehiculo_vin: p.vehiculo_vin || '', vehiculo_tipo: p.vehiculo_tipo || '',
                        fecha_emision: p.fecha_emision, fecha_validez: p.fecha_validez || '',
                        observaciones: p.observaciones || '', condiciones: p.condiciones || '', garantia: p.garantia || '', tiempo_estimado: p.tiempo_estimado || '',
                        descuento: p.descuento, iva_porcentaje: p.iva_porcentaje, anticipo: p.anticipo,
                        carroceria_tipo: p.carroceria_tipo || '', carroceria_puertas: p.carroceria_puertas || null,
                        zonas_danadas: p.zonas_danadas || [], danos_observaciones: p.danos_observaciones || '',
                    });
                    setItems(p.items.map(it => ({
                        categoria: it.categoria, descripcion: it.descripcion, referencia_tipo: it.referencia_tipo, referencia_id: it.referencia_id,
                        cantidad: Number(it.cantidad), precio_unitario: Number(it.precio_unitario),
                    })));
                    if (p.cliente_id) {
                        const { data: vData } = await api.get(`/ordenes/vehiculos?cliente_id=${p.cliente_id}`);
                        setVehiculos(vData.vehiculos || []);
                    }
                } else if (desdeOrden) {
                    const { data } = await api.get(`/proformas/desde-orden/${desdeOrden}`);
                    const b = data.borrador;
                    setForm(f => ({ ...f, ...b, vehiculo_anio: b.vehiculo_anio || '' }));
                    setItems(b.items.map(it => ({ ...it, referencia_id: null, referencia_tipo: null })));
                    if (b.cliente_id) {
                        const { data: vData } = await api.get(`/ordenes/vehiculos?cliente_id=${b.cliente_id}`);
                        setVehiculos(vData.vehiculos || []);
                    }
                    toast.success('Datos de la orden cargados. Revisa y ajusta antes de guardar.');
                }
            } catch (err) {
                toast.error('Error al cargar los datos del formulario.');
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line
    }, [id, desdeOrden]);

    const onChangeCliente = async (clienteId) => {
        const cliente = clientes.find(c => String(c.id) === String(clienteId));
        setForm(f => ({
            ...f, cliente_id: clienteId, vehiculo_id: '',
            cliente_nombre: cliente?.nombre || '', cliente_ruc: cliente?.cedula || '', cliente_direccion: cliente?.direccion || '',
            cliente_telefono: cliente?.telefono || '', cliente_email: cliente?.email || '',
            vehiculo_marca: '', vehiculo_modelo: '', vehiculo_anio: '', vehiculo_color: '', vehiculo_placa: '', vehiculo_vin: '',
        }));
        setVehiculos([]);
        if (!clienteId) return;
        try {
            const { data } = await api.get(`/ordenes/vehiculos?cliente_id=${clienteId}`);
            setVehiculos(data.vehiculos || []);
        } catch { toast.error('Error al cargar los vehículos del cliente.'); }
    };

    const onChangeVehiculo = (vehiculoId) => {
        const v = vehiculos.find(x => String(x.id) === String(vehiculoId));
        setForm(f => ({
            ...f, vehiculo_id: vehiculoId,
            vehiculo_marca: v?.marca || '', vehiculo_modelo: v?.modelo || '', vehiculo_anio: v?.anio || '',
            vehiculo_color: v?.color || '', vehiculo_placa: v?.placa || '', vehiculo_vin: v?.vin || '',
        }));
    };

    const onField = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const totales = useMemo(() => calcularTotalesPreview(items, form.descuento, form.iva_porcentaje, form.anticipo), [items, form.descuento, form.iva_porcentaje, form.anticipo]);

    const guardar = async (e) => {
        e.preventDefault();
        if (!form.cliente_id) return toast.error('Selecciona un cliente.');
        if (!form.vehiculo_id) return toast.error('Selecciona un vehículo.');
        const itemsValidos = items.filter(it => it.descripcion.trim() && parseFloat(it.precio_unitario) >= 0 && parseFloat(it.cantidad) > 0);
        if (itemsValidos.length === 0) return toast.error('Agrega al menos un ítem.');

        setSaving(true);
        const payload = { ...form, items: itemsValidos, carroceria_tipo: form.carroceria_tipo || null };
        try {
            if (esEdicion) {
                await api.put(`/proformas/${id}`, payload);
                toast.success('Proforma actualizada.');
                navigate(`/dashboard/proformas/${id}`);
            } else {
                const { data } = await api.post('/proformas', payload);
                toast.success(`Proforma ${data.proforma.numero} creada.`);
                navigate(`/dashboard/proformas/${data.proforma.id}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al guardar la proforma.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p style={{ fontFamily: "'Outfit'", color: mut, padding: 60, textAlign: 'center' }}>Cargando...</p>;

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1100 }}>
            <div className="SS SWAP-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>SS SWAP · PROFORMAS</span></div>
            <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.04em', color: txt, lineHeight: 1, marginBottom: 22 }}>
                {esEdicion ? 'Editar Proforma' : 'Nueva Proforma'}
            </h1>

            <form onSubmit={guardar}>
                {/* ── Tipo ── */}
                {!esEdicion && (
                    <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
                        {[{ v: 'mecanica', t: 'Proforma Mecánica', d: 'Productos y servicios' }, { v: 'pintura', t: 'Colisiones / Pintura', d: 'Pictograma de daños, mano de obra, pintura, repuestos, insumos' }].map(op => (
                            <button key={op.v} type="button" onClick={() => setForm({ ...form, tipo: op.v })}
                                className={`pf-tipo-card ${form.tipo === op.v ? 'activo' : ''}`}
                                style={{ background: form.tipo === op.v ? SKY_PALE : card, color: txt, '--pf-bdr': bdr, '--pf-sky': SKY_DEEP }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1rem', letterSpacing: '.04em', color: form.tipo === op.v ? SKY_DEEP : txt }}>{op.t}</p>
                                <p style={{ fontSize: '.78rem', color: mut, marginTop: 4 }}>{op.d}</p>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Cliente / Vehiculo ── */}
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 20, marginBottom: 18, boxShadow: cardSh }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                            <label style={labelSt}>CLIENTE *</label>
                            <select value={form.cliente_id} onChange={e => onChangeCliente(e.target.value)} style={inputSt} required>
                                <option value="">Seleccionar...</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>VEHÍCULO *</label>
                            <select value={form.vehiculo_id} onChange={e => onChangeVehiculo(e.target.value)} style={inputSt} required disabled={!form.cliente_id}>
                                <option value="">{form.cliente_id ? 'Seleccionar...' : 'Primero selecciona un cliente'}</option>
                                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo} — {v.placa}</option>)}
                            </select>
                        </div>
                    </div>

                    {form.cliente_id && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                            <input placeholder="RUC / CI" name="cliente_ruc" value={form.cliente_ruc} onChange={onField} style={inputSt} />
                            <input placeholder="Teléfono" name="cliente_telefono" value={form.cliente_telefono} onChange={onField} style={inputSt} />
                            <input placeholder="Email" name="cliente_email" value={form.cliente_email} onChange={onField} style={inputSt} />
                            <input placeholder="Dirección" name="cliente_direccion" value={form.cliente_direccion} onChange={onField} style={inputSt} />
                        </div>
                    )}
                    {form.vehiculo_id && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
                            <input placeholder="Tipo de vehículo (camioneta, sedán...)" name="vehiculo_tipo" value={form.vehiculo_tipo} onChange={onField} style={inputSt} />
                            <input placeholder="Color" name="vehiculo_color" value={form.vehiculo_color} onChange={onField} style={inputSt} />
                            <input placeholder="VIN / Chasis" name="vehiculo_vin" value={form.vehiculo_vin} onChange={onField} style={inputSt} />
                        </div>
                    )}
                </div>

                {/* ── Fechas + Sucursal ── */}
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 20, marginBottom: 18, boxShadow: cardSh, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    <div>
                        <label style={labelSt}>FECHA DE EMISIÓN *</label>
                        <input type="date" name="fecha_emision" value={form.fecha_emision} onChange={onField} style={inputSt} required />
                    </div>
                    <div>
                        <label style={labelSt}>VÁLIDA HASTA</label>
                        <input type="date" name="fecha_validez" value={form.fecha_validez} onChange={onField} style={inputSt} />
                    </div>
                    <div>
                        <label style={labelSt}>SUCURSAL (encabezado del documento)</label>
                        <select name="sucursal_id" value={form.sucursal_id} onChange={onField} style={inputSt}>
                            <option value="">SS SWAP (genérico)</option>
                            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                    </div>
                </div>

                {/* ── Colisiones: tipo de vehiculo + pictograma de daños ── */}
                {form.tipo === 'pintura' && (
                    <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 20, marginBottom: 18, boxShadow: cardSh }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.05rem', letterSpacing: '.08em', color: txt, marginBottom: 12 }}>DAÑOS DEL VEHÍCULO</p>
                        <PictogramaColisiones theme={theme} isDark={isDark}
                            valor={{ carroceria_tipo: form.carroceria_tipo, carroceria_puertas: form.carroceria_puertas, zonas_danadas: form.zonas_danadas, danos_observaciones: form.danos_observaciones }}
                            onChange={(v) => setForm(f => ({ ...f, ...v }))} />
                    </div>
                )}

                {/* ── Items segun tipo ── */}
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 20, marginBottom: 18, boxShadow: cardSh }}>
                    {form.tipo === 'mecanica' ? (
                        <>
                            <ItemsEditor theme={theme} categoria="producto" titulo="Productos / Repuestos" items={items} onChange={setItems} catalogo={repuestos} areaPreferida="mecanica" />
                            <ItemsEditor theme={theme} categoria="servicio" titulo="Servicios / Mano de obra" items={items} onChange={setItems} catalogo={servicios} />
                        </>
                    ) : (
                        <>
                            <ItemsEditor theme={theme} categoria="mano_obra" titulo="Mano de obra / Enderezado" items={items} onChange={setItems} modoSimple />
                            <ItemsEditor theme={theme} categoria="pintura" titulo="Pintura" items={items} onChange={setItems} modoSimple />
                            <ItemsEditor theme={theme} categoria="repuesto" titulo="Repuestos" items={items} onChange={setItems} catalogo={repuestos} areaPreferida="mecanica" />
                            <ItemsEditor theme={theme} categoria="insumo" titulo="Insumos / Materiales (pintura, masilla, lijas, primer...)" items={items} onChange={setItems} catalogo={repuestos} areaPreferida="colisiones" />
                        </>
                    )}
                    {items.some(it => it.referencia_tipo === 'repuesto' && it.referencia_id) && (
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, borderTop: `1px solid ${bdr}`, paddingTop: 12 }}>
                            Los ítems vinculados al inventario se descontarán del stock cuando la proforma esté aprobada y se pulse <strong>“Confirmar uso de materiales”</strong>. Guardar la proforma no mueve el inventario.
                        </p>
                    )}
                </div>

                {/* ── Condiciones (pintura) ── */}
                {form.tipo === 'pintura' && (
                    <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 20, marginBottom: 18, boxShadow: cardSh, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                            <label style={labelSt}>GARANTÍA</label>
                            <input name="garantia" value={form.garantia} onChange={onField} placeholder="Ej: 5 años en pintura" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>TIEMPO ESTIMADO DE TRABAJO</label>
                            <input name="tiempo_estimado" value={form.tiempo_estimado} onChange={onField} placeholder="Ej: 7 días laborables" style={inputSt} />
                        </div>
                    </div>
                )}

                {/* ── Totales ── */}
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 20, marginBottom: 18, boxShadow: cardSh }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
                        <div>
                            <label style={labelSt}>DESCUENTO ($)</label>
                            <input type="number" min="0" step="0.01" name="descuento" value={form.descuento} onChange={onField} style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>IVA (%) — no hay tasa fija configurada en el sistema</label>
                            <input type="number" min="0" step="0.01" name="iva_porcentaje" value={form.iva_porcentaje} onChange={onField} style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>ANTICIPO ($)</label>
                            <input type="number" min="0" step="0.01" name="anticipo" value={form.anticipo} onChange={onField} style={inputSt} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 22, fontFamily: "'Outfit'", fontSize: '.88rem', color: txt, flexWrap: 'wrap' }}>
                        <span>Subtotal: <strong>${totales.subtotal.toFixed(2)}</strong></span>
                        <span>IVA: <strong>${totales.iva.toFixed(2)}</strong></span>
                        <span>Total: <strong style={{ color: SKY_DEEP }}>${totales.total.toFixed(2)}</strong></span>
                        <span>Saldo: <strong>${totales.saldo.toFixed(2)}</strong></span>
                    </div>
                </div>

                {/* ── Observaciones / condiciones ── */}
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 20, marginBottom: 22, boxShadow: cardSh, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                        <label style={labelSt}>OBSERVACIONES</label>
                        <textarea name="observaciones" value={form.observaciones} onChange={onField} rows={3} style={{ ...inputSt, resize: 'vertical' }} />
                    </div>
                    <div>
                        <label style={labelSt}>FORMA DE PAGO / CONDICIONES</label>
                        <textarea name="condiciones" value={form.condiciones} onChange={onField} rows={3} style={{ ...inputSt, resize: 'vertical' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => navigate('/dashboard/proformas')}
                        style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 11, padding: '12px 22px', cursor: 'pointer', color: mut }}>
                        CANCELAR
                    </button>
                    <button type="submit" disabled={saving}
                        style={{ fontFamily: "'Bebas Neue'", fontSize: '.84rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '12px 26px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>
                        {saving ? 'GUARDANDO...' : esEdicion ? 'GUARDAR CAMBIOS' : 'CREAR PROFORMA'}
                    </button>
                </div>
            </form>
        </div>
    );
}
