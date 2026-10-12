/**
 * SS SWAP - Preparar una factura o nota de crédito electrónica
 *
 * Rutas:
 *  - /dashboard/facturacion/nueva?proforma_id=N | ?orden_id=N   factura desde lo aprobado
 *  - /dashboard/facturacion/nueva?nota_credito_de=N              nota de crédito de una factura autorizada
 *  - /dashboard/facturacion/:id/editar                           borrador, devuelta o no autorizada
 *
 * Aquí solo se GUARDA el borrador. Emitir (número, firma y envío al SRI) se
 * hace en el detalle, con confirmación expresa de los datos del comprador.
 * Los totales que se ven son una vista previa: el servidor los recalcula.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { usePaleta, bebas, outfit, BotonPrimario, BotonSecundario, Pildora } from '../../components/common/PanelUI';
import { dinero } from './comun';

const r2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const nuevaLinea = (iva) => ({ codigo: '', descripcion: '', cantidad: 1, precio_unitario: 0, descuento: 0, iva_codigo: iva || '4', proforma_item_id: null });
const claveIdempotencia = () => (window.crypto?.randomUUID ? window.crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`);

export default function FacturaEditor() {
    const p = usePaleta();
    const navigate = useNavigate();
    const { id } = useParams();
    const [params] = useSearchParams();
    const proformaId = params.get('proforma_id');
    const ordenId = params.get('orden_id');
    const ncDe = params.get('nota_credito_de');
    const idem = useRef(claveIdempotencia());

    const [cat, setCat] = useState(null);
    const [modo, setModo] = useState(ncDe ? 'nc' : 'factura');
    const [form, setForm] = useState(null);
    const [avisos, setAvisos] = useState([]);
    const [origen, setOrigen] = useState(null);
    const [factura, setFactura] = useState(null); // NC: factura que se modifica
    const [validacion, setValidacion] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);

    // Carga inicial según la ruta.
    useEffect(() => {
        (async () => {
            try {
                const { data: c } = await api.get('/facturacion/catalogos');
                setCat(c);
                const punto = c.puntos[0]?.id || '';
                if (id) {
                    const { data } = await api.get(`/facturacion/${id}`);
                    setModo(data.cod_doc === '04' ? 'nc' : 'factura');
                    if (data.cod_doc === '04' && data.comprobante_modificado_id) setFactura((await api.get(`/facturacion/${data.comprobante_modificado_id}`)).data);
                    setForm({
                        punto_emision_id: data.punto_emision_id, comprador: { ...data.comprador, cliente_id: data.cliente_id },
                        lineas: data.detalles.map(d => ({ codigo: d.codigo_principal || '', descripcion: d.descripcion, cantidad: d.cantidad, precio_unitario: d.precio_unitario,
                            descuento: d.descuento, iva_codigo: d.iva_codigo, proforma_item_id: d.proforma_item_id })),
                        descuento_global: 0, pagos: data.pagos?.length ? data.pagos : [{ formaPago: '01', total: null }],
                        info_adicional: (data.info_adicional || []).filter(x => !['Email', 'Teléfono', 'Orden de trabajo', 'Proforma', 'Placa', 'Vehículo', 'RUC Proveedor'].includes(x.nombre)),
                        motivo: data.motivo_nc || '', estado: data.estado, numero: data.numero,
                    });
                } else if (ncDe) {
                    const { data: f } = await api.get(`/facturacion/${ncDe}`);
                    setFactura(f);
                    setForm({ punto_emision_id: f.punto_emision_id, comprador: f.comprador, motivo: '',
                        lineas: f.detalles.map(d => ({ codigo: d.codigo_principal || '', descripcion: d.descripcion, cantidad: d.cantidad,
                            precio_unitario: d.precio_unitario, descuento: d.descuento, iva_codigo: d.iva_codigo })) });
                } else if (proformaId || ordenId) {
                    const { data } = await api.get(`/facturacion/propuesta?${proformaId ? `proforma_id=${proformaId}` : `orden_id=${ordenId}`}`);
                    setOrigen(data.origen);
                    setAvisos(data.avisos || []);
                    setForm({ punto_emision_id: punto, comprador: data.comprador, lineas: data.lineas, descuento_global: data.descuento_global,
                        pagos: data.pagos, info_adicional: [], vehiculo: data.vehiculo });
                } else {
                    setForm({ punto_emision_id: punto, comprador: { tipo_identificacion: '05', identificacion: '', razon_social: '', direccion: '', email: '', telefono: '' },
                        lineas: [nuevaLinea(c.iva_codigo_defecto)], descuento_global: 0, pagos: [{ formaPago: '01', total: null }], info_adicional: [] });
                }
            } catch (err) {
                setError(err.response?.data?.error || 'No se pudo preparar el comprobante.');
            }
        })();
    }, [id, proformaId, ordenId, ncDe]);

    // Validación de la identificación (formato; el SRI no publica consulta de datos).
    const comp = form?.comprador;
    useEffect(() => {
        if (!comp?.identificacion || !comp?.tipo_identificacion) { setValidacion(null); return undefined; }
        const t = setTimeout(() => {
            api.get(`/facturacion/validar-identificacion?tipo=${comp.tipo_identificacion}&valor=${encodeURIComponent(comp.identificacion)}`)
                .then(({ data }) => setValidacion(data)).catch(() => setValidacion(null));
        }, 350);
        return () => clearTimeout(t);
    }, [comp?.identificacion, comp?.tipo_identificacion]);

    // Vista previa de totales (el servidor recalcula con la misma regla).
    const vista = useMemo(() => {
        if (!form || !cat) return null;
        const tarifa = (cod) => cat.tarifas_iva.find(t => t.codigo === String(cod))?.tarifa ?? 0;
        const brutos = form.lineas.map(l => r2(Number(l.cantidad || 0) * Number(l.precio_unitario || 0)) - Number(l.descuento || 0));
        const neto = brutos.reduce((s, v) => s + v, 0);
        const global = Number(form.descuento_global || 0);
        const grupos = {};
        form.lineas.forEach((l, i) => {
            const base = neto > 0 ? brutos[i] - global * brutos[i] / neto : 0;
            const k = String(l.iva_codigo);
            grupos[k] = (grupos[k] || 0) + base;
        });
        const iva = Object.entries(grupos).reduce((s, [k, b]) => s + r2(b * tarifa(k) / 100), 0);
        const subtotal = r2(neto - global);
        return { subtotal, iva: r2(iva), total: r2(subtotal + iva), grupos };
    }, [form, cat]);

    if (error) return <div style={{ padding: 30, ...outfit('.95rem'), color: '#ef4444' }}>{error} <BotonSecundario onClick={() => navigate('/dashboard/facturacion')}>VOLVER</BotonSecundario></div>;
    if (!form || !cat) return <div className="sk-pulse" style={{ height: 300, borderRadius: 16, background: p.card }} />;

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const setComp = (k, v) => setForm(f => ({ ...f, comprador: { ...f.comprador, [k]: v } }));
    const setLinea = (i, k, v) => setForm(f => ({ ...f, lineas: f.lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
    const quitarLinea = (i) => setForm(f => ({ ...f, lineas: f.lineas.filter((_, j) => j !== i) }));

    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.85rem'), outline: 'none' };
    const label = (t, htmlFor) => <label htmlFor={htmlFor} style={{ display: 'block', marginBottom: 5, ...bebas('.6rem', '.2em'), color: p.SKY_DEEP }}>{t}</label>;
    const seccion = { background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, padding: 18, marginBottom: 16 };
    const esNc = modo === 'nc';
    const consumidorFinal = comp.tipo_identificacion === '07';

    const guardar = async () => {
        setGuardando(true);
        try {
            let data;
            if (esNc) {
                const cuerpo = { factura_id: factura?.id, motivo: form.motivo, lineas: form.lineas };
                data = id ? (await api.put(`/facturacion/${id}`, cuerpo)).data : (await api.post('/facturacion/notas-credito', cuerpo)).data;
            } else {
                const cuerpo = { ...form, proforma_id: origen?.proforma_id || undefined, comprador: { ...form.comprador } };
                data = id ? (await api.put(`/facturacion/${id}`, cuerpo)).data
                    : (await api.post('/facturacion', cuerpo, { headers: { 'Idempotency-Key': idem.current } })).data;
            }
            (data.advertencias || []).forEach(a => toast(a, { icon: '⚠️' }));
            toast.success('Borrador guardado. Revíselo y emítalo.');
            navigate(`/dashboard/facturacion/${data.id}`);
        } catch (err) {
            const d = err.response?.data;
            toast.error(d?.error || 'No se pudo guardar.');
        } finally { setGuardando(false); }
    };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1200 }}>
            <div style={{ marginBottom: 16 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>FACTURACIÓN · {esNc ? 'NOTA DE CRÉDITO' : 'FACTURA'}</span></div>
                <h1 style={{ ...bebas('2.3rem', '.04em'), color: p.txt, lineHeight: 1 }}>
                    {esNc ? `Nota de crédito${factura ? ` de la factura ${factura.numero}` : ''}` : id ? `Corregir ${form.numero || 'borrador'}` : 'Preparar factura'}
                </h1>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {cat.ambiente === 2 ? <Pildora color="#10b981">PRODUCCIÓN</Pildora> : <Pildora color="#f59e0b">PRUEBAS · SIN VALIDEZ TRIBUTARIA</Pildora>}
                    {origen?.proforma_numero && <Pildora color={p.SKY_DEEP}>PROFORMA {origen.proforma_numero}</Pildora>}
                    {origen?.orden_numero && <Pildora color={p.SKY_DEEP}>{origen.orden_numero}</Pildora>}
                    {form.numero && <Pildora color="#8b5cf6">NÚMERO {form.numero} (SE CONSERVA)</Pildora>}
                </div>
            </div>

            {[...avisos, ...(cat.faltantes || []).map(f => `Falta para emitir: ${f}`)].map(a => (
                <div key={a} role="status" style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #f59e0b55', background: '#f59e0b12', ...outfit('.84rem'), color: p.txtSf, marginBottom: 8 }}>{a}</div>
            ))}

            {/* Comprador */}
            <div style={seccion}>
                <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 12 }}>COMPRADOR {esNc && '(DE LA FACTURA ORIGINAL)'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div>
                        {label('TIPO DE IDENTIFICACIÓN', 'c-tipo')}
                        <select id="c-tipo" disabled={esNc} value={comp.tipo_identificacion} onChange={e => setComp('tipo_identificacion', e.target.value)} style={inputSt}>
                            {cat.tipos_identificacion.filter(t => !esNc || t.codigo !== '07').map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
                        </select>
                    </div>
                    {!consumidorFinal && <>
                        <div>
                            {label('IDENTIFICACIÓN *', 'c-id')}
                            <input id="c-id" disabled={esNc} value={comp.identificacion} maxLength={20} onChange={e => setComp('identificacion', e.target.value.trim())} style={inputSt} />
                            {validacion && (
                                <p style={{ ...outfit('.74rem'), marginTop: 4, color: validacion.valido ? (validacion.advertencias.length ? '#b45309' : '#10b981') : '#ef4444' }}>
                                    {validacion.valido ? (validacion.advertencias[0] || 'Formato correcto (no verificado en el SRI).') : validacion.errores[0]}
                                </p>
                            )}
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            {label('RAZÓN SOCIAL / NOMBRES Y APELLIDOS *', 'c-rs')}
                            <input id="c-rs" disabled={esNc} value={comp.razon_social} maxLength={300} onChange={e => setComp('razon_social', e.target.value)} style={inputSt} />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            {label('DIRECCIÓN', 'c-dir')}
                            <input id="c-dir" disabled={esNc} value={comp.direccion || ''} maxLength={300} onChange={e => setComp('direccion', e.target.value)} style={inputSt} />
                        </div>
                    </>}
                    <div>
                        {label('CORREO (ENVÍO DEL COMPROBANTE)', 'c-mail')}
                        <input id="c-mail" type="email" disabled={esNc} value={comp.email || ''} maxLength={300} onChange={e => setComp('email', e.target.value)} style={inputSt} />
                    </div>
                    <div>
                        {label('TELÉFONO', 'c-tel')}
                        <input id="c-tel" disabled={esNc} value={comp.telefono || ''} maxLength={50} onChange={e => setComp('telefono', e.target.value)} style={inputSt} />
                    </div>
                </div>
                {consumidorFinal && <p style={{ ...outfit('.8rem'), color: p.mut, marginTop: 10 }}>Consumidor final (9999999999999): solo hasta {dinero(cat.limite_consumidor_final)}. Por encima hay que identificar al comprador.</p>}
                {!esNc && !comp.confirmada && comp.cliente_id && <p style={{ ...outfit('.8rem'), color: '#b45309', marginTop: 10 }}>Los datos de este cliente aún no fueron confirmados. Al emitir se le pedirá confirmarlos.</p>}
            </div>

            {/* Líneas */}
            <div style={seccion}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <p style={{ ...bebas('.8rem', '.18em'), color: p.txt }}>{esNc ? 'CONCEPTOS QUE SE ACREDITAN' : 'PRODUCTOS Y SERVICIOS'}</p>
                    <BotonSecundario color={p.SKY_DEEP} onClick={() => set('lineas', [...form.lineas, nuevaLinea(esNc ? form.lineas[0]?.iva_codigo : cat.iva_codigo_defecto)])}>+ LÍNEA</BotonSecundario>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                        <thead>
                            <tr>{['Código', 'Descripción', 'Cant.', 'P. unitario', 'Descuento', 'IVA', 'Subtotal', ''].map(h => <th key={h} style={{ ...bebas('.6rem', '.18em'), color: p.SKY_DEEP, textAlign: 'left', padding: '6px 6px' }}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {form.lineas.map((l, i) => (
                                <tr key={i} style={{ borderTop: `1px solid ${p.bdr}` }}>
                                    <td style={{ padding: 5, width: 110 }}><input aria-label={`Código línea ${i + 1}`} value={l.codigo || ''} maxLength={25} onChange={e => setLinea(i, 'codigo', e.target.value)} style={inputSt} /></td>
                                    <td style={{ padding: 5 }}><input aria-label={`Descripción línea ${i + 1}`} value={l.descripcion} maxLength={300} onChange={e => setLinea(i, 'descripcion', e.target.value)} style={inputSt} /></td>
                                    <td style={{ padding: 5, width: 80 }}><input aria-label={`Cantidad línea ${i + 1}`} type="number" min="0" step="0.01" value={l.cantidad} onChange={e => setLinea(i, 'cantidad', e.target.value)} style={inputSt} /></td>
                                    <td style={{ padding: 5, width: 110 }}><input aria-label={`Precio línea ${i + 1}`} type="number" min="0" step="0.000001" value={l.precio_unitario} onChange={e => setLinea(i, 'precio_unitario', e.target.value)} style={inputSt} /></td>
                                    <td style={{ padding: 5, width: 90 }}><input aria-label={`Descuento línea ${i + 1}`} type="number" min="0" step="0.01" value={l.descuento} onChange={e => setLinea(i, 'descuento', e.target.value)} style={inputSt} /></td>
                                    <td style={{ padding: 5, width: 150 }}>
                                        <select aria-label={`IVA línea ${i + 1}`} value={l.iva_codigo} onChange={e => setLinea(i, 'iva_codigo', e.target.value)} style={inputSt}>
                                            {cat.tarifas_iva.map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
                                        </select>
                                    </td>
                                    <td style={{ padding: 5, ...outfit('.85rem', 600), color: p.txt, whiteSpace: 'nowrap' }}>{dinero(r2(Number(l.cantidad || 0) * Number(l.precio_unitario || 0)) - Number(l.descuento || 0))}</td>
                                    <td style={{ padding: 5 }}>{form.lineas.length > 1 && <button type="button" aria-label="Quitar línea" onClick={() => quitarLinea(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                <div style={seccion}>
                    {esNc ? (<>
                        <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 10 }}>MOTIVO *</p>
                        <textarea aria-label="Motivo de la nota de crédito" value={form.motivo} maxLength={300} rows={3} onChange={e => set('motivo', e.target.value)} style={{ ...inputSt, resize: 'vertical' }}
                            placeholder="Ej.: devolución de repuesto no utilizado" />
                        {factura && <p style={{ ...outfit('.78rem'), color: p.mut, marginTop: 8 }}>Factura {factura.numero} · total {dinero(factura.importe_total)}. La suma de notas de crédito no puede superarlo.</p>}
                    </>) : (<>
                        <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 10 }}>EMISIÓN Y PAGO</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                                {label('PUNTO DE EMISIÓN', 'f-punto')}
                                <select id="f-punto" value={form.punto_emision_id} disabled={Boolean(form.numero)} onChange={e => set('punto_emision_id', e.target.value)} style={inputSt}>
                                    {cat.puntos.length === 0 && <option value="">Sin puntos configurados</option>}
                                    {cat.puntos.map(pt => <option key={pt.id} value={pt.id}>{pt.establecimiento}-{pt.punto_emision} {pt.descripcion || ''}</option>)}
                                </select>
                            </div>
                            <div>
                                {label('DESCUENTO GENERAL ($)', 'f-desc')}
                                <input id="f-desc" type="number" min="0" step="0.01" value={form.descuento_global} onChange={e => set('descuento_global', e.target.value)} style={inputSt} />
                            </div>
                        </div>
                        <div style={{ marginTop: 12 }}>
                            {label('FORMA DE PAGO (TABLA 24 DEL SRI)', 'f-pago')}
                            {form.pagos.map((pg, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                    <select id={i === 0 ? 'f-pago' : undefined} aria-label="Forma de pago" value={pg.formaPago} onChange={e => set('pagos', form.pagos.map((x, j) => (j === i ? { ...x, formaPago: e.target.value } : x)))} style={{ ...inputSt, flex: 2 }}>
                                        {cat.formas_pago.map(f => <option key={f.codigo} value={f.codigo}>{f.codigo} · {f.nombre}</option>)}
                                    </select>
                                    {form.pagos.length > 1 && <input aria-label="Valor del pago" type="number" min="0" step="0.01" value={pg.total ?? ''} onChange={e => set('pagos', form.pagos.map((x, j) => (j === i ? { ...x, total: e.target.value } : x)))} style={{ ...inputSt, flex: 1 }} placeholder="Valor" />}
                                </div>
                            ))}
                            <button type="button" onClick={() => set('pagos', [...form.pagos.map(x => ({ ...x, total: x.total ?? '' })), { formaPago: '20', total: '' }])} style={{ background: 'none', border: 'none', color: p.SKY_DEEP, cursor: 'pointer', ...outfit('.78rem', 600) }}>+ dividir en otra forma de pago</button>
                            <p style={{ ...outfit('.74rem'), color: p.mut, marginTop: 4 }}>Es cómo se paga o se pagará. Registrar el cobro real se hace en el pagaré del cliente.</p>
                        </div>
                    </>)}
                </div>

                <div style={seccion}>
                    <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 10 }}>TOTALES (VISTA PREVIA)</p>
                    {vista && <>
                        {Object.entries(vista.grupos).map(([k, b]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', ...outfit('.85rem'), color: p.txtSf, padding: '3px 0' }}>
                                <span>Subtotal {cat.tarifas_iva.find(t => t.codigo === k)?.nombre || k}</span><span>{dinero(b)}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', ...outfit('.85rem'), color: p.txtSf, padding: '3px 0' }}><span>Subtotal sin impuestos</span><span>{dinero(vista.subtotal)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', ...outfit('.85rem'), color: p.txtSf, padding: '3px 0' }}><span>IVA</span><span>{dinero(vista.iva)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', ...bebas('1.4rem', '.04em'), color: p.txt, borderTop: `1px solid ${p.bdr}`, marginTop: 6, paddingTop: 8 }}><span>TOTAL</span><span>{dinero(vista.total)}</span></div>
                        {origen && Math.abs(vista.total - origen.total_proforma) > 0.009 && (
                            <p style={{ ...outfit('.78rem'), color: '#b45309', marginTop: 8 }}>El total difiere del de la proforma ({dinero(origen.total_proforma)}). Revise las tarifas o el pagaré del cliente.</p>
                        )}
                    </>}
                </div>
            </div>

            {!esNc && (
                <div style={seccion}>
                    <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 6 }}>INFORMACIÓN ADICIONAL</p>
                    <p style={{ ...outfit('.78rem'), color: p.mut, marginBottom: 10 }}>Se agregan solos: correo, teléfono, orden de trabajo, proforma, placa y vehículo. Máximo 15 campos en total.</p>
                    {(form.info_adicional || []).map((x, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                            <input aria-label="Nombre del campo" value={x.nombre} maxLength={300} placeholder="Nombre (ej. Kilometraje)" onChange={e => set('info_adicional', form.info_adicional.map((y, j) => (j === i ? { ...y, nombre: e.target.value } : y)))} style={{ ...inputSt, flex: 1 }} />
                            <input aria-label="Valor del campo" value={x.valor} maxLength={300} placeholder="Valor" onChange={e => set('info_adicional', form.info_adicional.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)))} style={{ ...inputSt, flex: 2 }} />
                            <button type="button" aria-label="Quitar campo" onClick={() => set('info_adicional', form.info_adicional.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
                        </div>
                    ))}
                    {(form.info_adicional || []).length < 8 && <button type="button" onClick={() => set('info_adicional', [...(form.info_adicional || []), { nombre: '', valor: '' }])} style={{ background: 'none', border: 'none', color: p.SKY_DEEP, cursor: 'pointer', ...outfit('.8rem', 600) }}>+ agregar campo</button>}
                </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: 30 }}>
                <BotonSecundario onClick={() => navigate(-1)}>CANCELAR</BotonSecundario>
                <BotonPrimario onClick={guardar} disabled={guardando || (!esNc && !form.punto_emision_id)}>{guardando ? 'GUARDANDO...' : 'GUARDAR BORRADOR'}</BotonPrimario>
            </div>
        </div>
    );
}
