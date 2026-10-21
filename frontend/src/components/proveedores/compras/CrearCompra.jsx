/**
 * SS SWAP - Compras: "Crear compra" (Sprint 26)
 *
 * Paso 1 (cabecera, como en los sistemas contables): inventario de destino,
 * documento, proveedor (buscar o crear), fechas de emisión y vencimiento,
 * establecimiento / punto / número, autorización (clave de acceso o XML),
 * tipo de registro y sustento tributario.
 *  - FACTURA electrónica: al completar los 49 dígitos de la autorización se
 *    consulta al SRI y se llenan los datos solos. "Continuar" abre la
 *    revisión de artículos (¿a dónde va cada uno?) y luego se registra.
 *  - NOTA DE VENTA / OTRO COMPROBANTE / ORDEN DE COMPRA: "Continuar" verifica
 *    que el documento no exista y pasa a cargar los artículos a mano.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { nuevaClaveIdempotencia, conClave } from '../../../utils/idempotencia';
import { ModalProveedor } from '../ProveedoresTab';
import {
    AREAS, DOCUMENTOS, TIPOS_REGISTRO, SUSTENTOS, SUSTENTO_POR_REGISTRO, METODOS, DIAS_CREDITO,
    hoy, sumarDias, fechaIso, numeroDocumento, AREA_LABEL, DOCUMENTO_CORTO, TIPO_REGISTRO_LABEL, fechaCorta,
} from './comunes';
import { IngresoManual, BuscadorProducto } from './RevisionFactura';
import { TotalesCompra, IconMas, IconXml, IconUsuario, IconPapelera } from './piezas';

const ESTADO_SRI_TEXTO = {
    'NO AUTORIZADO': 'El SRI indica que la factura NO está autorizada.',
    ANULADO: 'La factura fue ANULADA en el SRI.',
    'PENDIENTE DE ANULAR': 'La factura está PENDIENTE DE ANULAR en el SRI.',
    NO_ENCONTRADO: 'El SRI no tiene una factura autorizada con esa clave.',
};
const rucLimpio = (v) => String(v || '').replace(/\s+/g, '').toUpperCase();

/** Buscador de proveedor con botón "Crear" (como en la captura: "Nombre | ID: RUC"). */
function BuscarProveedor({ theme, valor, onElegir, onCrear, textoInicial, puedeCrear }) {
    const { inputSt, bdr, boxBg, txt, mut, SKY_DEEP } = theme;
    const [q, setQ] = useState('');
    const [lista, setLista] = useState([]);
    const [abierto, setAbierto] = useState(false);
    useEffect(() => { if (textoInicial) { setQ(textoInicial); setAbierto(true); } }, [textoInicial]);
    useEffect(() => {
        if (!abierto) return undefined;
        const t = setTimeout(async () => {
            try {
                const p = new URLSearchParams({ limit: '8', activo: 'true' });
                if (q.trim()) p.set('q', q.trim());
                const { data } = await api.get(`/proveedores/proveedores?${p}`);
                setLista(data.proveedores || []);
            } catch { setLista([]); }
        }, 250);
        return () => clearTimeout(t);
    }, [q, abierto]);
    return (
        <div style={{ display: 'flex', position: 'relative', minWidth: 0 }}>
            {puedeCrear && (
                <button type="button" onClick={onCrear} title="Crear un proveedor nuevo"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, border: 'none', borderRadius: '10px 0 0 10px', padding: '0 14px', cursor: 'pointer', color: '#fff', background: '#0f766e', fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem' }}>
                    <IconUsuario /> Crear
                </button>
            )}
            {valor ? (
                <div style={{ ...inputSt, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: puedeCrear ? '0 10px 10px 0' : 10, minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: txt }}>{valor.nombre_comercial}{valor.ruc ? ` | ID: ${valor.ruc}` : ''}</span>
                    <button type="button" onClick={() => { onElegir(null); setQ(''); setAbierto(true); }} aria-label="Cambiar proveedor" style={{ background: 'none', border: 'none', cursor: 'pointer', color: mut, fontSize: '1rem', lineHeight: 1 }}>✕</button>
                </div>
            ) : (
                <input value={q} onChange={e => { setQ(e.target.value); setAbierto(true); }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 180)}
                    placeholder="Buscar proveedor existente (nombre o RUC)" aria-label="Buscar proveedor" style={{ ...inputSt, borderRadius: puedeCrear ? '0 10px 10px 0' : 10 }} />
            )}
            {abierto && !valor && (
                <div role="listbox" style={{ position: 'absolute', zIndex: 40, top: '100%', left: 0, right: 0, background: boxBg, border: `1px solid ${bdr}`, borderRadius: 10, marginTop: 2, boxShadow: '0 12px 30px -10px rgba(0,0,0,.35)', maxHeight: 260, overflowY: 'auto' }}>
                    {lista.length === 0
                        ? <p style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: mut, padding: '9px 12px' }}>Sin coincidencias{puedeCrear ? ': use "Crear".' : '.'}</p>
                        : lista.map(p => (
                            <button key={p.id} type="button" role="option" aria-selected="false" onMouseDown={e => e.preventDefault()} onClick={() => { onElegir(p); setAbierto(false); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${bdr}`, padding: '9px 12px', cursor: 'pointer', color: txt, fontFamily: "'Outfit'", fontSize: '.88rem' }}>
                                <strong>{p.nombre_comercial}</strong>{p.ruc ? <span style={{ color: SKY_DEEP }}> | ID: {p.ruc}</span> : <span style={{ color: mut }}> · sin RUC</span>}
                            </button>
                        ))}
                </div>
            )}
        </div>
    );
}

const ITEM_VACIO = { repuesto: null, descripcion: '', cantidad: 1, precio_unitario: '', iva_porcentaje: 15 };

/** Paso 2 para documentos sin autorización electrónica: artículos a mano. */
function ItemsCompra({ theme, datos, onVolver, onCreada }) {
    const { txt, mut, bdr, card, cardSh, SKY_DEEP, SKY_PALE, labelSt, inputSt, btnPrim, btnSec } = theme;
    const ivaInicial = datos.tipo_documento === 'nota_venta' ? 0 : 15;
    const [items, setItems] = useState([{ ...ITEM_VACIO, iva_porcentaje: ivaInicial }]);
    const [notas, setNotas] = useState('');
    const [pago, setPago] = useState({ metodo_pago: 'efectivo', referencia_pago: '' });
    const [guardando, setGuardando] = useState(false);
    const enviando = useRef(false);
    const [clave] = useState(nuevaClaveIdempotencia);
    const esOrden = datos.tipo_documento === 'orden';

    const set = (i, cambios) => setItems(prev => prev.map((it, j) => (j === i ? { ...it, ...cambios } : it)));
    const sub = (it) => (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0);
    const conIva = items.filter(it => Number(it.iva_porcentaje) > 0);
    const totales = {
        subtotal_iva: conIva.reduce((s, it) => s + sub(it), 0),
        subtotal_0: items.filter(it => Number(it.iva_porcentaje) === 0).reduce((s, it) => s + sub(it), 0),
        tarifa_iva: 15, descuento: 0,
        iva: items.reduce((s, it) => s + Math.round(sub(it) * Number(it.iva_porcentaje)) / 100, 0),
    };
    totales.total = totales.subtotal_iva + totales.subtotal_0 + totales.iva;
    const alInventario = datos.tipo_registro === 'inventario' ? items.filter(it => it.repuesto).length : 0;

    const guardar = async () => {
        const validos = items.filter(it => String(it.descripcion).trim() && Number(it.cantidad) > 0);
        if (!validos.length) return toast.error('Agregue al menos un artículo con descripción y cantidad.');
        if (validos.some(it => it.precio_unitario === '' || !(Number(it.precio_unitario) >= 0))) return toast.error('Revise el costo de cada artículo.');
        if (enviando.current) return;
        enviando.current = true; setGuardando(true);
        try {
            const { data } = await api.post('/proveedores/compras', {
                proveedor_id: datos.proveedor.id, fecha_solicitud: datos.fecha_emision, notas: notas || undefined,
                forma_pago: datos.forma_pago, fecha_vencimiento: datos.forma_pago === 'credito' ? datos.fecha_vencimiento : undefined,
                ...(datos.forma_pago === 'contado' ? pago : {}),
                tipo_documento: datos.tipo_documento, numero_documento: datos.numero_documento || undefined,
                area: datos.area, tipo_registro: datos.tipo_registro, sustento_tributario: datos.sustento_tributario || undefined,
                recibir_ahora: !esOrden,
                items: validos.map(it => ({
                    repuesto_id: it.repuesto?.id || undefined, descripcion: String(it.descripcion).trim(),
                    cantidad: Number(it.cantidad), precio_unitario: Number(it.precio_unitario), iva_porcentaje: Number(it.iva_porcentaje),
                })),
            }, conClave(clave));
            const entradas = (data.stock_actualizado || []).filter(s => !s.omitido).length;
            toast.success(esOrden ? 'Orden de compra creada. Se sumará al inventario cuando la marque como recibida.'
                : `Compra registrada${entradas ? `: ${entradas} producto(s) sumados al inventario` : ''}.`, { duration: 6000 });
            onCreada(data.compra.id);
        } catch (err) {
            const d = err.response?.data || {};
            toast.error(d.error || 'No se pudo registrar la compra.', { duration: 7000 });
        } finally { enviando.current = false; setGuardando(false); }
    };

    const st = { ...inputSt, padding: '8px 10px', fontSize: '.86rem' };
    return (
        <div>
            <button type="button" onClick={onVolver} style={{ ...btnSec, padding: '6px 12px', marginBottom: 12 }}>← CAMBIAR DATOS DE LA COMPRA</button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 12, padding: 14, borderRadius: 12, background: SKY_PALE, marginBottom: 14, fontFamily: "'Outfit'", fontSize: '.88rem', color: txt }}>
                <div><p style={{ ...labelSt, marginBottom: 2 }}>DOCUMENTO</p>{DOCUMENTO_CORTO[datos.tipo_documento]} {datos.numero_documento || ''}</div>
                <div><p style={{ ...labelSt, marginBottom: 2 }}>PROVEEDOR</p>{datos.proveedor.nombre_comercial}</div>
                <div><p style={{ ...labelSt, marginBottom: 2 }}>F. EMISIÓN</p>{fechaCorta(datos.fecha_emision)}</div>
                <div><p style={{ ...labelSt, marginBottom: 2 }}>PAGO</p>{datos.forma_pago === 'credito' ? `Crédito · vence ${fechaCorta(datos.fecha_vencimiento)}` : 'Contado'}</div>
                <div><p style={{ ...labelSt, marginBottom: 2 }}>INVENTARIO</p>{AREA_LABEL[datos.area]}</div>
                <div><p style={{ ...labelSt, marginBottom: 2 }}>REGISTRO</p>{TIPO_REGISTRO_LABEL[datos.tipo_registro]}{datos.sustento_tributario ? ` · sustento ${datos.sustento_tributario}` : ''}</div>
            </div>

            <div className="compra-layout apilado">
                <div style={{ minWidth: 0 }}>
                    <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh, overflow: 'visible' }}>
                        <table className="prov-table" style={{ minWidth: 820 }}>
                            <thead><tr style={{ background: SKY_PALE }}>
                                {['Producto del inventario', 'Descripción *', 'Cantidad *', 'Costo unit. *', 'IVA', 'Total', ''].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {items.map((it, i) => (
                                    <tr key={i} style={{ borderColor: bdr, verticalAlign: 'top' }}>
                                        <td style={{ minWidth: 230 }}>
                                            <BuscadorProducto theme={theme} valor={it.repuesto} area={datos.area} placeholder="Sin producto (no suma stock)"
                                                onElegir={(r) => set(i, { repuesto: r, descripcion: it.descripcion || r.nombre, precio_unitario: it.precio_unitario === '' ? (r.precio_compra ?? '') : it.precio_unitario })} />
                                            {it.repuesto && <button type="button" onClick={() => set(i, { repuesto: null })} style={{ background: 'none', border: 'none', color: mut, cursor: 'pointer', fontSize: '.76rem', padding: '4px 0' }}>Quitar producto</button>}
                                        </td>
                                        <td style={{ minWidth: 200 }}><input style={st} aria-label={`Descripción ${i + 1}`} value={it.descripcion} onChange={e => set(i, { descripcion: e.target.value })} /></td>
                                        <td style={{ width: 100 }}><input style={st} aria-label={`Cantidad ${i + 1}`} type="number" min="0.01" step="0.01" value={it.cantidad} onChange={e => set(i, { cantidad: e.target.value })} /></td>
                                        <td style={{ width: 120 }}><input style={st} aria-label={`Costo ${i + 1}`} type="number" min="0" step="0.0001" value={it.precio_unitario} onChange={e => set(i, { precio_unitario: e.target.value })} /></td>
                                        <td style={{ width: 90 }}>
                                            <select style={st} aria-label={`IVA ${i + 1}`} value={it.iva_porcentaje} onChange={e => set(i, { iva_porcentaje: Number(e.target.value) })}>
                                                <option value={15}>15%</option><option value={0}>0%</option>
                                            </select>
                                        </td>
                                        <td style={{ color: txt, fontWeight: 600, whiteSpace: 'nowrap' }}>${sub(it).toFixed(2)}</td>
                                        <td><button type="button" className="prov-icon-btn" aria-label={`Quitar artículo ${i + 1}`} disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ color: '#ef4444', opacity: items.length === 1 ? .4 : 1 }}><IconPapelera /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" onClick={() => setItems([...items, { ...ITEM_VACIO, iva_porcentaje: ivaInicial }])}
                        style={{ ...btnSec, marginTop: 10, borderStyle: 'dashed' }}><IconMas /> AGREGAR ARTÍCULO</button>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: mut, marginTop: 10 }}>
                        {datos.tipo_registro !== 'inventario'
                            ? `Compra registrada como ${TIPO_REGISTRO_LABEL[datos.tipo_registro]}: no suma existencias al inventario.`
                            : esOrden
                                ? 'Es un pedido: las existencias se suman cuando la orden se marque como recibida.'
                                : `Los artículos vinculados a un producto se suman al inventario al registrar (${alInventario} de ${items.length}).`}
                    </p>
                    <div style={{ marginTop: 12 }}>
                        <label style={labelSt}>NOTAS</label>
                        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
                    </div>
                </div>
                <aside className="compra-aside">
                    <TotalesCompra theme={theme} totales={totales} />
                    {datos.forma_pago === 'contado' && (
                        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                            <div><label style={labelSt}>MÉTODO DE PAGO</label>
                                <select style={inputSt} value={pago.metodo_pago} onChange={e => setPago({ ...pago, metodo_pago: e.target.value })}>{METODOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
                            <div><label style={labelSt}>REFERENCIA</label><input style={inputSt} value={pago.referencia_pago} onChange={e => setPago({ ...pago, referencia_pago: e.target.value })} placeholder="N° de comprobante" /></div>
                        </div>
                    )}
                    <button type="button" onClick={guardar} disabled={guardando}
                        style={{ ...btnPrim, width: '100%', justifyContent: 'center', marginTop: 14, padding: '12px 14px', background: 'linear-gradient(135deg, #059669, #10b981)', opacity: guardando ? .6 : 1 }}>
                        {guardando ? 'GUARDANDO...' : esOrden ? 'CREAR ORDEN DE COMPRA' : alInventario ? 'REGISTRAR COMPRA Y SUMAR AL INVENTARIO' : 'REGISTRAR COMPRA'}
                    </button>
                </aside>
            </div>
        </div>
    );
}

/**
 * Formulario "Crear compra". Props:
 *  onRevisarFactura({ facturaId, datos }), onCreada(compraId), onAbrirCompra(compraId), onVolver(),
 *  facturaInicial (id de una factura consultada sin terminar, para continuarla).
 */
export default function CrearCompra({ theme, onRevisarFactura, onCreada, onAbrirCompra, onVolver, facturaInicial, datosIniciales }) {
    const { puede } = useAuth();
    const { txt, mut, bdr, card, cardSh, SKY_DEEP, labelSt, inputSt, btnPrim, btnSec } = theme;
    const areasPermitidas = AREAS.filter(a => puede(a.id === 'colisiones' ? 'inventario_colisiones' : 'inventario_mecanica', 'ver'));
    const d0 = datosIniciales || {};
    const [area, setArea] = useState(d0.area || areasPermitidas[0]?.id || 'mecanica');
    const [documento, setDocumento] = useState(d0.tipo_documento || 'factura');
    const [proveedor, setProveedor] = useState(d0.proveedor || null);
    const [fechaEmision, setFechaEmision] = useState(d0.fecha_emision || hoy());
    const [formaPago, setFormaPago] = useState(d0.forma_pago || 'credito');
    const [fechaVence, setFechaVence] = useState(d0.fecha_vencimiento || sumarDias(hoy(), DIAS_CREDITO));
    const venceTocada = useRef(Boolean(d0.fecha_vencimiento));
    const [doc, setDoc] = useState(() => {
        const [e, p, s] = String(d0.numero_documento || '').split('-');
        return { est: e || '001', pto: p || '001', sec: s ? String(Number(s)) : '' };
    });
    const [claveAcceso, setClaveAcceso] = useState(d0.clave_acceso || '');
    const [tipoRegistro, setTipoRegistro] = useState(d0.tipo_registro || 'inventario');
    const [sustento, setSustento] = useState(d0.sustento_tributario || '06');
    const [sustentos, setSustentos] = useState(SUSTENTOS);
    const [factura, setFactura] = useState(null);
    const [consultando, setConsultando] = useState(false);
    const [problema, setProblema] = useState(null);
    const [duplicada, setDuplicada] = useState(null);
    const [manual, setManual] = useState(false);
    const [modalProv, setModalProv] = useState(null);
    const [rucBuscado, setRucBuscado] = useState('');
    const [paso2, setPaso2] = useState(null);
    const [verificando, setVerificando] = useState(false);
    const ultimaClave = useRef('');
    const archivo = useRef(null);
    const esFactura = documento === 'factura';
    const limpia = claveAcceso.replace(/\s+/g, '');

    useEffect(() => {
        api.get('/proveedores/compras/catalogos').then(({ data }) => { if (data.sustentos?.length) setSustentos(data.sustentos); }).catch(() => {});
    }, []);

    // El sustento sugerido cambia con el tipo de registro (el usuario puede elegir otro).
    const cambiarRegistro = (t) => { setTipoRegistro(t); setSustento(SUSTENTO_POR_REGISTRO[t] || '01'); };
    const cambiarEmision = (f) => { setFechaEmision(f); if (!venceTocada.current) setFechaVence(sumarDias(f, DIAS_CREDITO)); };

    /** Aplica a la cabecera los datos de una factura consultada (SRI / XML / manual). */
    const aplicarFactura = useCallback(async (fa) => {
        setFactura(fa); setProblema(null); setManual(false); setDuplicada(null);
        ultimaClave.current = fa.clave_acceso;
        setClaveAcceso(fa.clave_acceso);
        const emision = fechaIso(fa.fecha_emision);
        if (emision) { setFechaEmision(emision); if (!venceTocada.current) setFechaVence(sumarDias(emision, DIAS_CREDITO)); }
        const [e, p, s] = String(fa.numero || '').split('-');
        if (s) setDoc({ est: e, pto: p, sec: String(Number(s)) });
        if (fa.estado === 'registrada') {
            setDuplicada({ compra_id: fa.compra_id });
            toast.error('Ya existe un registro con esta información: esta factura ya fue registrada como compra.', { duration: 7000 });
        } else if (fa.estado === 'no_registrable') {
            setProblema({ error: ESTADO_SRI_TEXTO[fa.estado_sri] || `No se puede registrar: estado en el SRI ${fa.estado_sri}.` });
        }
        // Proveedor: el que coincide con el RUC del emisor, o se ofrece crearlo.
        let prov = null;
        try {
            if (fa.proveedor_id) {
                const { data } = await api.get(`/proveedores/proveedores/${fa.proveedor_id}`);
                prov = data.proveedor;
            } else {
                const { data } = await api.get(`/proveedores/proveedores?q=${encodeURIComponent(fa.emisor_ruc)}&limit=5`);
                prov = (data.proveedores || []).find(p => rucLimpio(p.ruc) === rucLimpio(fa.emisor_ruc)) || null;
            }
        } catch { prov = null; }
        setProveedor(prov);
        if (!prov) setRucBuscado(fa.emisor_ruc);
    }, []);

    const consultar = useCallback(async (clave) => {
        if (!/^\d{49}$/.test(clave)) return;
        ultimaClave.current = clave;
        setConsultando(true); setProblema(null); setDuplicada(null); setFactura(null);
        const id = toast.loading('Espere: consultando en el SRI…');
        try {
            const { data } = await api.post('/proveedores/facturas-compra/consultar', { clave_acceso: clave });
            if (data.factura.estado === 'registrada') toast.dismiss(id);   // el aviso de "ya existe" lo da aplicarFactura
            else toast.success(data.existente ? 'Comprobante encontrado (ya consultado antes).' : 'Completo: comprobante encontrado.', { id });
            await aplicarFactura(data.factura);
        } catch (err) {
            toast.dismiss(id);
            const d = err.response?.data || {};
            setProblema({ codigo: d.codigo, error: d.error || 'No se pudo consultar la factura.' });
        } finally { setConsultando(false); }
    }, [aplicarFactura]);

    // Al completar los 49 dígitos se consulta sola (como en el video).
    useEffect(() => {
        if (esFactura && /^\d{49}$/.test(limpia) && limpia !== ultimaClave.current && !consultando) consultar(limpia);
    }, [limpia, esFactura, consultando, consultar]);

    // Continuar una factura consultada que quedó sin registrar.
    useEffect(() => {
        if (!facturaInicial) return;
        api.get(`/proveedores/facturas-compra/${facturaInicial}`).then(({ data }) => aplicarFactura(data.factura))
            .catch(err => toast.error(err.response?.data?.error || 'No se pudo abrir la factura.'));
    }, [facturaInicial, aplicarFactura]);

    const cargarXml = async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        if (!/\.xml$/i.test(f.name)) return toast.error('Seleccione el archivo .xml de la factura.');
        if (f.size > 2 * 1024 * 1024) return toast.error('El XML supera 2 MB.');
        setConsultando(true); setProblema(null);
        const id = toast.loading('Leyendo el XML y verificando con el SRI…');
        try {
            const { data } = await api.post('/proveedores/facturas-compra/xml', { xml: await f.text() });
            if (data.factura.estado === 'registrada') toast.dismiss(id);
            else if (data.sri_disponible === false) toast('El SRI no respondió: los datos del XML quedan SIN VERIFICAR.', { id, icon: '⚠️', duration: 7000 });
            else toast.success('Completo: comprobante encontrado.', { id });
            await aplicarFactura(data.factura);
        } catch (err) {
            toast.dismiss(id);
            const d = err.response?.data || {};
            setProblema({ codigo: d.codigo, error: d.error || 'No se pudo leer el XML.' });
        } finally { setConsultando(false); }
    };

    const guardarProveedor = async (datos, clave) => {
        try {
            let r;
            try { r = await api.post('/proveedores/proveedores', datos, conClave(clave)); }
            catch (err) {
                if (err.response?.data?.codigo !== 'POSIBLE_DUPLICADO') throw err;
                r = await api.post('/proveedores/proveedores', { ...datos, confirmar_duplicado: true }, conClave(nuevaClaveIdempotencia()));
            }
            toast.success('Proveedor creado.');
            setProveedor(r.data.proveedor); setModalProv(null); setRucBuscado('');
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo crear el proveedor.'); }
    };
    const abrirCrearProveedor = () => setModalProv(factura && !proveedor ? {
        nombre_comercial: String(factura.emisor_nombre_comercial || factura.emisor_razon_social || '').slice(0, 150),
        razon_social: factura.emisor_razon_social || '', ruc: factura.emisor_ruc || '', direccion: factura.emisor_direccion || '', categoria: 'Repuestos',
    } : {});

    const cambiarDocumento = (d) => {
        setDocumento(d); setProblema(null); setFactura(null); setDuplicada(null); setManual(false); ultimaClave.current = '';
        if (d === 'orden') setSustento('');
        else if (!sustento) setSustento(SUSTENTO_POR_REGISTRO[tipoRegistro]);
    };

    const datosCabecera = () => ({
        area, tipo_documento: documento, proveedor, fecha_emision: fechaEmision, forma_pago: formaPago,
        fecha_vencimiento: formaPago === 'credito' ? fechaVence : null, tipo_registro: tipoRegistro,
        sustento_tributario: documento === 'orden' ? (sustento || null) : sustento, clave_acceso: esFactura ? limpia : '',
        numero_documento: documento === 'orden' ? null : numeroDocumento(doc.est, doc.pto, doc.sec),
    });

    const continuar = async () => {
        if (!proveedor) return toast.error(factura ? 'El proveedor de la factura no está registrado: use "Crear" (se llena con los datos de la factura).' : 'Seleccione o cree el proveedor.');
        if (formaPago === 'credito' && (!fechaVence || fechaVence < fechaEmision)) return toast.error('La fecha de vencimiento no puede ser anterior a la de emisión.');
        if (documento !== 'orden' && !sustento) return toast.error('Seleccione el sustento tributario.');
        if (esFactura) {
            if (!factura) return toast.error(/^\d{49}$/.test(limpia) ? 'Espere la respuesta del SRI o cargue el XML.' : 'Ingrese la autorización (clave de acceso de 49 dígitos) o cargue el XML.');
            if (duplicada) return toast.error('Ya existe un registro con esta información: esta factura ya fue registrada.');
            if (factura.estado !== 'pendiente_confirmacion') return toast.error('Esta factura no se puede registrar (revise su estado en el SRI).');
            if (proveedor.ruc && rucLimpio(proveedor.ruc) !== rucLimpio(factura.emisor_ruc)) {
                return toast.error(`El proveedor elegido tiene otro RUC (${proveedor.ruc}); la factura la emitió ${factura.emisor_ruc}.`);
            }
            return onRevisarFactura({ facturaId: factura.id, datos: datosCabecera() });
        }
        const cab = datosCabecera();
        if (documento !== 'orden' && !cab.numero_documento) return toast.error('Ingrese establecimiento, punto y número del documento.');
        if (cab.numero_documento) {
            setVerificando(true);
            try {
                const p = new URLSearchParams({ proveedor_id: proveedor.id, tipo_documento: documento, numero_documento: cab.numero_documento });
                const { data } = await api.get(`/proveedores/compras/documento?${p}`);
                if (data.existe) { setDuplicada({ compra_id: data.compra_id }); return toast.error('Ya existe un registro con esta información.'); }
            } catch (err) { return toast.error(err.response?.data?.error || 'No se pudo verificar el documento.'); }
            finally { setVerificando(false); }
        }
        setDuplicada(null);
        setPaso2(cab);
    };

    if (paso2) return <ItemsCompra theme={theme} datos={paso2} onVolver={() => setPaso2(null)} onCreada={onCreada} />;

    const st = { ...inputSt, height: 42 };
    const etiqueta = (t, req) => <label style={{ ...labelSt, letterSpacing: '.12em' }}>{t}{req && ' *'}</label>;
    return (
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, boxShadow: cardSh, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                <div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.2em', color: SKY_DEEP }}>COMPRAS</p>
                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>Crear compra</h2>
                </div>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.86rem', color: mut, maxWidth: 520 }}>
                    {esFactura ? 'Pegue la autorización (clave de acceso de 49 dígitos) o cargue el XML: los datos se llenan solos desde el SRI.' : 'Complete los datos del documento y continúe para cargar los artículos.'}
                </p>
            </div>

            <div className="crear-compra-grid">
                <div>{etiqueta('INVENTARIO (ALMACÉN)')}
                    <select style={st} value={area} onChange={e => setArea(e.target.value)}>{areasPermitidas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
                <div>{etiqueta('DOCUMENTO')}
                    <select style={st} value={documento} onChange={e => cambiarDocumento(e.target.value)}>{DOCUMENTOS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></div>
                <div className="span-2">{etiqueta('PROVEEDOR', true)}
                    <BuscarProveedor theme={theme} valor={proveedor} onElegir={setProveedor} onCrear={abrirCrearProveedor} textoInicial={rucBuscado} puedeCrear={puede('proveedores', 'crear')} />
                    {factura && !proveedor && <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: '#f59e0b', marginTop: 4 }}>Proveedor no registrado: {factura.emisor_razon_social} (RUC {factura.emisor_ruc}). Use "Crear": se llena con los datos de la factura.</p>}
                </div>

                <div>{etiqueta('F. EMISIÓN', true)}
                    <input type="date" style={st} value={fechaEmision} max={hoy()} disabled={Boolean(factura)} onChange={e => cambiarEmision(e.target.value)} /></div>
                <div>{etiqueta('FORMA DE PAGO', true)}
                    <select style={st} value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                        <option value="credito">Crédito (queda por pagar)</option>
                        <option value="contado">Contado (se paga ahora)</option>
                    </select></div>
                <div>{etiqueta('F. VENCIMIENTO', formaPago === 'credito')}
                    <input type="date" style={st} value={formaPago === 'credito' ? fechaVence : fechaEmision} min={fechaEmision} disabled={formaPago !== 'credito'}
                        onChange={e => { venceTocada.current = true; setFechaVence(e.target.value); }} /></div>
                <div className="doc-num">
                    <div>{etiqueta('EST')}<input style={st} inputMode="numeric" maxLength={3} value={doc.est} disabled={esFactura || documento === 'orden'} onChange={e => setDoc({ ...doc, est: e.target.value.replace(/\D/g, '') })} aria-label="Establecimiento" /></div>
                    <div>{etiqueta('PTO')}<input style={st} inputMode="numeric" maxLength={3} value={doc.pto} disabled={esFactura || documento === 'orden'} onChange={e => setDoc({ ...doc, pto: e.target.value.replace(/\D/g, '') })} aria-label="Punto de emisión" /></div>
                    <div>{etiqueta('N. DOCUMENTO', documento !== 'orden')}<input style={st} inputMode="numeric" maxLength={9} value={doc.sec} disabled={esFactura || documento === 'orden'} onChange={e => setDoc({ ...doc, sec: e.target.value.replace(/\D/g, '') })} aria-label="Número del documento" /></div>
                </div>

                {esFactura && (
                    <div className="span-full">{etiqueta('AUTORIZACIÓN (CLAVE DE ACCESO)', true)}
                        <div style={{ display: 'flex', minWidth: 0 }}>
                            <input ref={archivo} type="file" accept=".xml,application/xml,text/xml" onChange={cargarXml} style={{ display: 'none' }} aria-label="Archivo XML de la factura" />
                            <button type="button" onClick={() => archivo.current?.click()} disabled={consultando} title="Cargar el XML que envió el proveedor"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, border: 'none', borderRadius: '10px 0 0 10px', padding: '0 16px', cursor: 'pointer', color: '#fff', background: '#1d4ed8', fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem' }}>
                                <IconXml /> XML
                            </button>
                            <input value={claveAcceso} onChange={e => setClaveAcceso(e.target.value)} inputMode="numeric" maxLength={60} disabled={consultando}
                                placeholder="Pegue aquí los 49 dígitos de la autorización" aria-label="Autorización (clave de acceso)"
                                style={{ ...st, borderRadius: '0 10px 10px 0', fontFamily: 'monospace', fontSize: '.92rem', letterSpacing: '.02em' }} />
                        </div>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: limpia.length === 49 ? '#10b981' : mut, marginTop: 4 }}>
                            {consultando ? 'Consultando en el SRI…' : factura ? `Comprobante encontrado: factura ${factura.numero} de ${factura.emisor_razon_social || factura.emisor_ruc} · ${factura.detalles?.length ?? '—'} artículo(s) · total $${Number(factura.importe_total).toFixed(2)}` : `${limpia.length}/49 dígitos`}
                        </p>
                    </div>
                )}

                <div>{etiqueta('TIPO REGISTRO')}
                    <select style={st} value={tipoRegistro} onChange={e => cambiarRegistro(e.target.value)}>{TIPOS_REGISTRO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                <div className="span-3">{etiqueta('SUSTENTO TRIBUTARIO', documento !== 'orden')}
                    <select style={st} value={sustento} onChange={e => setSustento(e.target.value)}>
                        {documento === 'orden' && <option value="">Se indica al recibir la factura</option>}
                        {sustentos.map(s => <option key={s.codigo} value={s.codigo}>{s.codigo} {s.texto}</option>)}
                    </select></div>
            </div>

            {problema && (
                <div role="alert" style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: '#f59e0b14', border: '1px solid #f59e0b55', fontFamily: "'Outfit'", fontSize: '.88rem', color: txt }}>
                    {problema.error}
                    {problema.codigo === 'SRI_NO_DISPONIBLE' && /^\d{49}$/.test(limpia) && !manual && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => consultar(limpia)} style={{ ...btnSec, padding: '7px 12px' }}>REINTENTAR</button>
                            <button type="button" onClick={() => archivo.current?.click()} style={{ ...btnSec, padding: '7px 12px' }}>CARGAR XML</button>
                            <button type="button" onClick={() => setManual(true)} style={{ ...btnSec, padding: '7px 12px' }}>INGRESAR ARTÍCULOS A MANO (NO VERIFICADO)</button>
                        </div>
                    )}
                </div>
            )}
            {duplicada && (
                <div role="alert" style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: '#ef444414', border: '1px solid #ef444455', fontFamily: "'Outfit'", fontSize: '.88rem', color: txt, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span><strong>Ya existe un registro con esta información.</strong> Este documento ya fue ingresado{duplicada.compra_id ? ` (compra #${duplicada.compra_id})` : ''}: no se volverá a sumar al inventario.</span>
                    {duplicada.compra_id && <button type="button" onClick={() => onAbrirCompra(duplicada.compra_id)} style={{ ...btnSec, padding: '6px 12px' }}>VER COMPRA</button>}
                </div>
            )}
            {manual && <IngresoManual theme={theme} clave={limpia} onVolver={() => setManual(false)} onFactura={aplicarFactura} />}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22, paddingTop: 18, borderTop: `1px solid ${bdr}`, flexWrap: 'wrap' }}>
                <button type="button" onClick={continuar} disabled={consultando || verificando} style={{ ...btnPrim, padding: '11px 26px', background: 'linear-gradient(135deg, #0f766e, #0d9488)', opacity: consultando || verificando ? .6 : 1 }}>▶ CONTINUAR</button>
                <button type="button" onClick={onVolver} style={{ ...btnPrim, padding: '11px 22px', background: 'linear-gradient(135deg, #b45309, #c2410c)' }}>← VOLVER</button>
            </div>

            {modalProv && <ModalProveedor theme={theme} data={modalProv} etiqueta="CREAR COMPRA" onClose={() => setModalProv(null)} onGuardar={guardarProveedor} />}
        </div>
    );
}
