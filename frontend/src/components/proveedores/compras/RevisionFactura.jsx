/**
 * SS SWAP - Compras: revisión de una factura electrónica antes de registrarla
 *
 * Segundo paso de "Crear compra" cuando el documento es una factura del SRI.
 * Cada artículo se manda a un producto existente (sugerido por código), a un
 * producto nuevo (en el inventario elegido; el código interno lo asigna el
 * sistema) o "no va al inventario" (servicios, fletes). Al registrar, el
 * servidor crea en UNA transacción la compra, las entradas de inventario y
 * la deuda/pago; una factura registrada no se vuelve a sumar.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useConfirm } from '../../common/ConfirmDialog';
import { dinero } from '../../finanzas/tema';
import { nuevaClaveIdempotencia, conClave } from '../../../utils/idempotencia';
import { AREAS, AREA_LABEL, TIPO_REGISTRO_LABEL, METODOS, fechaCorta, cant, tarifaIva } from './comunes';
import { TotalesCompra, Badge } from './piezas';

const SRI = {
    AUTORIZADO: { label: 'AUTORIZADA EN EL SRI', color: '#10b981' },
    'NO AUTORIZADO': { label: 'NO AUTORIZADA', color: '#ef4444' },
    ANULADO: { label: 'ANULADA EN EL SRI', color: '#ef4444' },
    'PENDIENTE DE ANULAR': { label: 'PENDIENTE DE ANULAR', color: '#ef4444' },
    NO_ENCONTRADO: { label: 'NO ENCONTRADA EN EL SRI', color: '#ef4444' },
    SIN_VERIFICAR: { label: 'SIN VERIFICAR CON EL SRI', color: '#f59e0b' },
};
const ORIGEN = { sri: 'Datos descargados del SRI', xml: 'XML cargado por el usuario', manual: 'Ingreso manual (no verificado)' };

/** Buscador de productos del inventario (nombre, código interno o del proveedor). */
export function BuscadorProducto({ theme, valor, onElegir, area, placeholder = 'Elegir producto…' }) {
    const { inputSt, bdr, boxBg, txt, mut } = theme;
    const [q, setQ] = useState('');
    const [lista, setLista] = useState([]);
    const [abierto, setAbierto] = useState(false);
    useEffect(() => {
        if (!abierto) return undefined;
        const t = setTimeout(async () => {
            try {
                const p = new URLSearchParams({ limit: '15' });
                if (q.trim()) p.set('q', q.trim());
                if (area) p.set('area', area);
                const { data } = await api.get(`/inventory/repuestos?${p}`);
                setLista(data.repuestos || []);
            } catch { setLista([]); }
        }, 250);
        return () => clearTimeout(t);
    }, [q, abierto, area]);
    return (
        <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}
                style={{ ...inputSt, padding: '7px 9px', fontSize: '.82rem', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {valor ? `${valor.codigo} · ${valor.nombre}` : placeholder}
            </button>
            {abierto && (
                <div style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, minWidth: 280, background: boxBg, border: `1px solid ${bdr}`, borderRadius: 10, padding: 6, boxShadow: '0 12px 30px -10px rgba(0,0,0,.35)' }}>
                    <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre, código interno o del proveedor" aria-label="Buscar producto"
                        style={{ ...inputSt, padding: '6px 8px', fontSize: '.82rem', marginBottom: 4 }} />
                    <div style={{ maxHeight: 230, overflowY: 'auto' }}>
                        {lista.length === 0 && <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, padding: 6 }}>Sin resultados</p>}
                        {lista.map(r => (
                            <button key={r.id} type="button" onClick={() => { onElegir(r); setAbierto(false); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '6px 8px', cursor: 'pointer', color: txt, fontFamily: "'Outfit'", fontSize: '.82rem', borderRadius: 6 }}>
                                <strong>{r.codigo}</strong> · {r.nombre} <span style={{ color: mut }}>({AREA_LABEL[r.area] || r.area} · stock {cant(r.stock_actual)}{r.codigo_proveedor ? ` · prov. ${r.codigo_proveedor}` : ''})</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Ingreso a mano de los artículos (solo si el SRI no responde y no hay XML). */
export function IngresoManual({ theme, clave, onVolver, onFactura }) {
    const { txt, mut, bdr, labelSt, inputSt, btnPrim, btnSec } = theme;
    const [razon, setRazon] = useState('');
    const [iva, setIva] = useState('');
    const [lineas, setLineas] = useState([{ codigo: '', descripcion: '', cantidad: 1, precio_unitario: '', descuento: '' }]);
    const [guardando, setGuardando] = useState(false);
    const set = (i, k, v) => setLineas(lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
    const subtotal = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0) - (Number(l.descuento) || 0), 0);

    const guardar = async () => {
        setGuardando(true);
        try {
            const { data } = await api.post('/proveedores/facturas-compra/manual', { clave_acceso: clave, razon_social: razon, total_iva: iva || 0, lineas });
            toast(data.sri_disponible === false ? 'Guardada SIN VERIFICAR: revise los datos antes de registrar.' : 'El SRI respondió: se usaron sus datos.', { icon: 'ℹ️', duration: 6000 });
            onFactura(data.factura);
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo guardar.'); }
        finally { setGuardando(false); }
    };
    const st = { ...inputSt, padding: '7px 9px', fontSize: '.84rem' };
    return (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${bdr}` }}>
            <div role="note" style={{ padding: '10px 12px', borderRadius: 10, background: '#f59e0b14', border: '1px solid #f59e0b55', fontFamily: "'Outfit'", fontSize: '.86rem', color: txt, marginBottom: 14 }}>
                Úselo solo si el SRI no responde y no tiene el XML. Los datos quedan como <strong>no verificados</strong> y al registrar deberá aceptarlo expresamente.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10, marginBottom: 12 }}>
                <div><label style={labelSt}>RAZÓN SOCIAL DEL PROVEEDOR</label><input style={st} value={razon} onChange={e => setRazon(e.target.value)} /></div>
                <div><label style={labelSt}>IVA TOTAL DE LA FACTURA</label><input style={st} type="number" min="0" step="0.01" value={iva} onChange={e => setIva(e.target.value)} /></div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.4fr .7fr .9fr .8fr auto', gap: 6, alignItems: 'end', minWidth: 620 }}>
                    {['CÓDIGO PROV.', 'DESCRIPCIÓN *', 'CANT. *', 'P. UNIT. *', 'DESC.', ''].map(h => <span key={h} style={{ ...labelSt, marginBottom: 0 }}>{h}</span>)}
                    {lineas.map((l, i) => (
                        <React.Fragment key={i}>
                            <input style={st} aria-label={`Código del artículo ${i + 1}`} value={l.codigo} onChange={e => set(i, 'codigo', e.target.value)} />
                            <input style={st} aria-label={`Descripción del artículo ${i + 1}`} value={l.descripcion} onChange={e => set(i, 'descripcion', e.target.value)} />
                            <input style={st} aria-label={`Cantidad del artículo ${i + 1}`} type="number" min="0.01" step="0.01" value={l.cantidad} onChange={e => set(i, 'cantidad', e.target.value)} />
                            <input style={st} aria-label={`Precio del artículo ${i + 1}`} type="number" min="0" step="0.0001" value={l.precio_unitario} onChange={e => set(i, 'precio_unitario', e.target.value)} />
                            <input style={st} aria-label={`Descuento del artículo ${i + 1}`} type="number" min="0" step="0.01" value={l.descuento} onChange={e => set(i, 'descuento', e.target.value)} />
                            <button type="button" onClick={() => setLineas(lineas.filter((_, j) => j !== i))} disabled={lineas.length === 1} style={{ ...btnSec, padding: '6px 9px' }} aria-label={`Quitar artículo ${i + 1}`}>✕</button>
                        </React.Fragment>
                    ))}
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
                <button type="button" onClick={() => setLineas([...lineas, { codigo: '', descripcion: '', cantidad: 1, precio_unitario: '', descuento: '' }])} style={btnSec}>+ ARTÍCULO</button>
                <span style={{ fontFamily: "'Outfit'", color: mut, fontSize: '.86rem' }}>Subtotal {dinero(subtotal)} · Total {dinero(subtotal + (Number(iva) || 0))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" onClick={onVolver} style={btnSec}>VOLVER</button>
                <button type="button" onClick={guardar} disabled={guardando} style={{ ...btnPrim, opacity: guardando ? .6 : 1 }}>{guardando ? 'GUARDANDO...' : 'GUARDAR Y CONTINUAR'}</button>
            </div>
        </div>
    );
}

/** Decisión inicial de cada artículo. */
function decisionInicial(d, sug, datos) {
    const cantidad = cant(d.cantidad);
    if (datos.tipo_registro !== 'inventario') return { accion: 'omitir', area: datos.area || 'mecanica', cantidad_recibida: cantidad };
    if (sug?.sugerido) return { accion: 'existente', repuesto: sug.sugerido, area: sug.sugerido.area, cantidad_recibida: cantidad };
    return { accion: 'nuevo', area: datos.area || 'mecanica', cantidad_recibida: cantidad,
        nuevo: { nombre: d.descripcion, categoria_id: '', precio_venta: '', stock_minimo: '', unidad_medida: d.unidad_medida || 'unidad' } };
}

/**
 * Página de revisión. `datos`: lo elegido en "Crear compra"
 * { proveedor (obj) | null, area, tipo_registro, sustento_tributario, forma_pago, fecha_vencimiento }.
 */
export default function RevisionFactura({ theme, facturaId, datos, onVolver, onRegistrada, onAbrirCompra }) {
    const { puede } = useAuth();
    const confirm = useConfirm();
    const { txt, txtSf, mut, bdr, card, cardSh, SKY_DEEP, SKY_PALE, labelSt, inputSt, btnPrim, btnSec } = theme;
    const [f, setF] = useState(null);
    const [categorias, setCategorias] = useState([]);
    const [dec, setDec] = useState({});
    const [pago, setPago] = useState({ metodo_pago: 'transferencia', referencia_pago: '' });
    const [acepto, setAcepto] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const clave = useRef(nuevaClaveIdempotencia());
    // Referencias estables: el padre recrea estos valores en cada render.
    const datosRef = useRef(datos); datosRef.current = datos;
    const volverRef = useRef(onVolver); volverRef.current = onVolver;

    const cargar = useCallback(async () => {
        try {
            const { data } = await api.get(`/proveedores/facturas-compra/${facturaId}`);
            const fa = data.factura;
            setF(fa);
            setDec(Object.fromEntries(fa.detalles.map(d => [d.id, decisionInicial(d, fa.sugerencias?.[d.id], datosRef.current)])));
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo abrir la factura.'); volverRef.current(); }
    }, [facturaId]);
    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => { api.get('/inventory/categorias').then(({ data }) => setCategorias(data.categorias || [])).catch(() => {}); }, []);

    if (!f) return <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando la factura…</p>;

    const setLinea = (did, cambios) => setDec(prev => ({ ...prev, [did]: { ...prev[did], ...cambios } }));
    const pendiente = f.estado === 'pendiente_confirmacion';
    const confirmables = (f.advertencias || []).filter(a => a.confirmar);
    const sriInfo = SRI[f.estado_sri] || SRI.SIN_VERIFICAR;
    const conIva = f.detalles.filter(d => tarifaIva(d.impuestos) > 0);
    const totales = {
        subtotal_iva: conIva.reduce((s, d) => s + Number(d.precio_total_sin_impuesto), 0),
        subtotal_0: f.detalles.filter(d => tarifaIva(d.impuestos) === 0).reduce((s, d) => s + Number(d.precio_total_sin_impuesto), 0),
        tarifa_iva: conIva.length ? Math.max(...conIva.map(d => tarifaIva(d.impuestos))) : 15,
        descuento: Number(f.total_descuento || 0),
        iva: Number(f.total_iva || 0),
        total: Number(f.importe_total || 0),
        articulos: f.detalles.reduce((s, d) => s + Number(d.cantidad), 0),
        filas: f.detalles.length,
    };
    const alInventario = f.detalles.filter(d => dec[d.id]?.accion !== 'omitir').length;

    const registrar = async (extra = {}) => {
        if (confirmables.length && !acepto) {
            document.getElementById('advertencias-factura')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return toast.error('Revise y acepte las advertencias de la factura (arriba).');
        }
        const lineas = f.detalles.map(d => {
            const x = dec[d.id];
            const base = { detalle_id: d.id, accion: x.accion, cantidad_recibida: x.cantidad_recibida, confirmar_nuevo: extra[d.id] === true || undefined };
            if (x.accion === 'existente') return { ...base, repuesto_id: x.repuesto?.id };
            if (x.accion === 'nuevo') return { ...base, area: x.area, nuevo: x.nuevo };
            return base;
        });
        if (lineas.find(l => l.accion === 'existente' && !l.repuesto_id)) return toast.error('Elija el producto existente en todas las líneas marcadas así.');
        setEnviando(true);
        try {
            const body = {
                ...(datos.proveedor?.id ? { proveedor_id: datos.proveedor.id } : { crear_proveedor: true }),
                forma_pago: datos.forma_pago, fecha_vencimiento: datos.forma_pago === 'credito' ? datos.fecha_vencimiento : undefined,
                ...(datos.forma_pago === 'contado' ? pago : {}),
                area: datos.area, tipo_registro: datos.tipo_registro, sustento_tributario: datos.sustento_tributario,
                aceptar_advertencias: acepto, lineas,
            };
            const { data } = await api.post(`/proveedores/facturas-compra/${f.id}/confirmar`, body, conClave(clave.current));
            const entradas = data.resultado.lineas.filter(l => l.movimiento).length;
            const nuevos = data.resultado.lineas.filter(l => l.creado).length;
            toast.success(`Compra registrada: ${entradas} entrada(s) al inventario${nuevos ? `, ${nuevos} producto(s) nuevo(s)` : ''}.`, { duration: 6000 });
            onRegistrada(data.resultado.compra_id);
        } catch (err) {
            const d = err.response?.data || {};
            if (d.codigo === 'POSIBLE_DUPLICADO' && d.linea) {
                const det = f.detalles.find(x => x.linea === d.linea);
                if (det && await confirm({ title: 'Posible producto repetido', message: `${d.error} ¿Crear de todas formas un producto nuevo?`, confirmLabel: 'Crear nuevo', danger: false })) {
                    setEnviando(false);
                    return registrar({ ...extra, [det.id]: true });
                }
            } else if (d.codigo === 'DOCUMENTO_DUPLICADO' && d.compra_id) {
                toast.error(d.error, { duration: 7000 });
                onAbrirCompra?.(d.compra_id);
            } else if (d.codigo === 'YA_REGISTRADA') {
                toast(d.error, { icon: 'ℹ️' });
                if (d.compra_id) onAbrirCompra?.(d.compra_id); else cargar();
            } else toast.error(d.error || 'No se pudo registrar la compra.', { duration: 7000 });
            clave.current = nuevaClaveIdempotencia();
        } finally { setEnviando(false); }
    };

    const pdf = async (descargar) => {
        const ventana = descargar ? null : window.open('', '_blank');
        try {
            const { data } = await api.get(`/proveedores/facturas-compra/${f.id}/pdf`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
            if (ventana) ventana.location.href = url;
            else { const a = document.createElement('a'); a.href = url; a.download = `Factura-compra-${f.numero}.pdf`; document.body.appendChild(a); a.click(); a.remove(); }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch { if (ventana) ventana.close(); toast.error('No se pudo generar el PDF de la factura.'); }
    };

    const st = { ...inputSt, padding: '7px 9px', fontSize: '.82rem' };
    const Dato = ({ k, v }) => (<div style={{ minWidth: 0 }}><p style={{ ...labelSt, marginBottom: 2 }}>{k}</p><p style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: txt, overflowWrap: 'anywhere' }}>{v || '—'}</p></div>);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                <div style={{ minWidth: 0 }}>
                    <button type="button" onClick={onVolver} style={{ ...btnSec, padding: '6px 12px', marginBottom: 10 }}>← CAMBIAR DATOS DE LA COMPRA</button>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.2em', color: SKY_DEEP }}>FACTURA {f.numero}</p>
                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt }}>{f.emisor_razon_social || f.emisor_ruc}</h2>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        <Badge color={sriInfo.color}>{sriInfo.label}</Badge>
                        <Badge color={f.origen_datos === 'sri' ? '#10b981' : '#f59e0b'}>{ORIGEN[f.origen_datos]}</Badge>
                        {f.firma_valida === true && <Badge color="#10b981">FIRMA ELECTRÓNICA VÁLIDA</Badge>}
                        {Number(f.ambiente) === 1 && <Badge color="#f59e0b">AMBIENTE DE PRUEBAS</Badge>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => pdf(false)} style={{ ...btnSec, padding: '7px 12px' }}>VER FACTURA (PDF)</button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 12, padding: 14, borderRadius: 12, background: SKY_PALE, marginBottom: 14 }}>
                <Dato k="PROVEEDOR" v={datos.proveedor ? `${datos.proveedor.nombre_comercial} (${f.emisor_ruc})` : `Se creará con los datos de la factura (RUC ${f.emisor_ruc})`} />
                <Dato k="F. EMISIÓN" v={fechaCorta(f.fecha_emision)} />
                <Dato k="PAGO" v={datos.forma_pago === 'credito' ? `Crédito · vence ${fechaCorta(datos.fecha_vencimiento)}` : 'Contado'} />
                <Dato k="INVENTARIO" v={AREA_LABEL[datos.area] || '—'} />
                <Dato k="TIPO DE REGISTRO" v={TIPO_REGISTRO_LABEL[datos.tipo_registro]} />
                <Dato k="SUSTENTO TRIBUTARIO" v={datos.sustento_tributario} />
                <div style={{ gridColumn: '1/-1' }}><Dato k="AUTORIZACIÓN (CLAVE DE ACCESO)" v={f.clave_acceso} /></div>
            </div>

            {(f.advertencias || []).length > 0 && (
                <div id="advertencias-factura" role="alert" style={{ padding: '10px 14px', borderRadius: 10, background: '#f59e0b14', border: '1px solid #f59e0b55', marginBottom: 14 }}>
                    {f.advertencias.map(a => <p key={a.codigo} style={{ fontFamily: "'Outfit'", fontSize: '.86rem', color: txt }}>⚠️ {a.mensaje}</p>)}
                    {pendiente && confirmables.length > 0 && (
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontFamily: "'Outfit'", fontSize: '.86rem', color: txt, cursor: 'pointer' }}>
                            <input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)} /> Revisé estas advertencias y quiero registrar la compra igualmente.
                        </label>
                    )}
                </div>
            )}
            {pendiente && f.ultimo_error && (
                <p role="alert" style={{ padding: '8px 12px', borderRadius: 10, background: '#ef444414', border: '1px solid #ef444455', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.86rem', marginBottom: 14 }}>
                    Último intento sin registrar: {f.ultimo_error} (no se cambió el inventario).
                </p>
            )}
            {datos.tipo_registro !== 'inventario' && (
                <p role="note" style={{ padding: '8px 12px', borderRadius: 10, background: SKY_PALE, fontFamily: "'Outfit'", fontSize: '.86rem', color: txtSf, marginBottom: 14 }}>
                    Compra registrada como <strong>{TIPO_REGISTRO_LABEL[datos.tipo_registro]}</strong>: los artículos quedan como "No va al inventario". Si alguno sí debe entrar al stock, cámbielo en su fila.
                </p>
            )}

            <div className="compra-layout apilado">
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <Badge color={SKY_DEEP}>FILAS: {totales.filas}</Badge>
                        <Badge color="#f59e0b">ARTÍCULOS: {cant(totales.articulos)}</Badge>
                        <Badge color="#10b981">VAN AL INVENTARIO: {alInventario}</Badge>
                    </div>
                    <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                        <table className="prov-table" style={{ minWidth: 860 }}>
                            <thead><tr style={{ background: SKY_PALE }}>
                                {['#', 'Producto / servicio del proveedor', 'Cant.', 'Costo unit.', '¿A dónde va?', 'Detalle'].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {f.detalles.map(d => {
                                    const costo = Number(d.precio_total_sin_impuesto) / Number(d.cantidad);
                                    const x = dec[d.id] || {};
                                    const sug = f.sugerencias?.[d.id];
                                    return (
                                        <tr key={d.id} style={{ borderColor: bdr, verticalAlign: 'top' }}>
                                            <td style={{ color: mut }}>{d.linea}</td>
                                            <td style={{ maxWidth: 280 }}>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: txt }}>{d.descripcion}</p>
                                                <p style={{ fontSize: '.76rem', color: mut }}>{[d.codigo_principal && `Cód. ${d.codigo_principal}`, d.codigo_auxiliar && `Aux. ${d.codigo_auxiliar}`, d.unidad_medida].filter(Boolean).join(' · ') || 'Sin código del proveedor'}</p>
                                                <p style={{ fontSize: '.76rem', color: mut }}>IVA {tarifaIva(d.impuestos)}%{Number(d.descuento) > 0 ? ` · Descuento ${dinero(d.descuento)}` : ''}</p>
                                            </td>
                                            <td style={{ color: txtSf }}>{cant(d.cantidad)}</td>
                                            <td style={{ color: txtSf }}>{dinero(costo)}<div style={{ fontSize: '.74rem', color: mut }}>sin IVA</div></td>
                                            {pendiente ? (
                                                <>
                                                    <td style={{ minWidth: 180 }}>
                                                        <select style={st} value={x.accion} aria-label={`Destino del artículo ${d.linea}`}
                                                            onChange={e => setLinea(d.id, e.target.value === 'nuevo' && !x.nuevo
                                                                ? { accion: 'nuevo', area: x.area || datos.area || 'mecanica', nuevo: { nombre: d.descripcion, categoria_id: '', precio_venta: '', stock_minimo: '', unidad_medida: d.unidad_medida || 'unidad' } }
                                                                : { accion: e.target.value })}>
                                                            <option value="existente">Producto existente</option>
                                                            <option value="nuevo">Producto nuevo</option>
                                                            <option value="omitir">No va al inventario</option>
                                                        </select>
                                                        {sug?.motivo === 'codigo_proveedor_registrado' && <p style={{ fontSize: '.74rem', color: '#10b981', marginTop: 4 }}>Reconocido por el código de este proveedor</p>}
                                                        {sug?.motivo === 'codigo' && <p style={{ fontSize: '.74rem', color: '#10b981', marginTop: 4 }}>Sugerido por código</p>}
                                                        {sug?.motivo === 'varios_por_codigo' && <p style={{ fontSize: '.74rem', color: '#f59e0b', marginTop: 4 }}>Varios productos con ese código: elija uno</p>}
                                                    </td>
                                                    <td style={{ minWidth: 330 }}>
                                                        {x.accion === 'existente' && (
                                                            <div style={{ display: 'grid', gap: 6 }}>
                                                                <BuscadorProducto theme={theme} valor={x.repuesto} onElegir={(r) => setLinea(d.id, { repuesto: r, area: r.area })} />
                                                                {!x.repuesto && sug?.candidatos?.length > 0 && (
                                                                    <p style={{ fontSize: '.76rem', color: mut }}>Parecidos: {sug.candidatos.slice(0, 3).map(c => (
                                                                        <button key={c.id} type="button" onClick={() => setLinea(d.id, { repuesto: c, area: c.area })} style={{ background: 'none', border: 'none', color: SKY_DEEP, cursor: 'pointer', textDecoration: 'underline', fontSize: '.76rem' }}>{c.codigo}</button>
                                                                    ))}</p>
                                                                )}
                                                                {x.repuesto && <p style={{ fontSize: '.76rem', color: mut }}>Inventario: {AREA_LABEL[x.repuesto.area] || x.repuesto.area} · stock actual {cant(x.repuesto.stock_actual)} → {cant(Number(x.repuesto.stock_actual) + (Number(x.cantidad_recibida) || 0))}</p>}
                                                                <label style={{ fontSize: '.76rem', color: mut }}>Cantidad recibida <input style={{ ...st, width: 90, display: 'inline-block', marginLeft: 6 }} type="number" min="0.01" step="0.01" max={d.cantidad} value={x.cantidad_recibida} onChange={e => setLinea(d.id, { cantidad_recibida: e.target.value })} /></label>
                                                            </div>
                                                        )}
                                                        {x.accion === 'nuevo' && (
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                                                <select style={st} value={x.area} onChange={e => setLinea(d.id, { area: e.target.value, nuevo: { ...x.nuevo, categoria_id: '' } })} aria-label="Inventario de destino">
                                                                    {AREAS.filter(a => puede(a.id === 'colisiones' ? 'inventario_colisiones' : 'inventario_mecanica', 'crear')).map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                                                                </select>
                                                                <select style={st} value={x.nuevo?.categoria_id || ''} onChange={e => setLinea(d.id, { nuevo: { ...x.nuevo, categoria_id: e.target.value } })} aria-label="Categoría">
                                                                    <option value="">Sin categoría</option>
                                                                    {categorias.filter(c => !c.area || c.area === x.area).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                                                </select>
                                                                <input style={{ ...st, gridColumn: '1/-1' }} value={x.nuevo?.nombre || ''} placeholder="Nombre del producto" aria-label="Nombre del producto" onChange={e => setLinea(d.id, { nuevo: { ...x.nuevo, nombre: e.target.value } })} />
                                                                <input style={st} type="number" min="0" step="0.01" placeholder="Precio de venta" aria-label="Precio de venta" value={x.nuevo?.precio_venta || ''} onChange={e => setLinea(d.id, { nuevo: { ...x.nuevo, precio_venta: e.target.value } })} />
                                                                <input style={st} type="number" min="0" step="0.01" placeholder="Stock mínimo" aria-label="Stock mínimo" value={x.nuevo?.stock_minimo || ''} onChange={e => setLinea(d.id, { nuevo: { ...x.nuevo, stock_minimo: e.target.value } })} />
                                                                <input style={st} placeholder="Unidad" aria-label="Unidad de medida" value={x.nuevo?.unidad_medida || ''} onChange={e => setLinea(d.id, { nuevo: { ...x.nuevo, unidad_medida: e.target.value } })} />
                                                                <input style={st} type="number" min="0.01" step="0.01" max={d.cantidad} title="Cantidad recibida" aria-label="Cantidad recibida" value={x.cantidad_recibida} onChange={e => setLinea(d.id, { cantidad_recibida: e.target.value })} />
                                                                <p style={{ gridColumn: '1/-1', fontSize: '.74rem', color: mut }}>Entra al inventario de {AREA_LABEL[x.area]}; el código interno ({x.area === 'colisiones' ? 'COL' : 'MEC'}-000000) lo asigna el sistema al registrar.</p>
                                                            </div>
                                                        )}
                                                        {x.accion === 'omitir' && <p style={{ fontSize: '.8rem', color: mut }}>Se registra en la compra (servicio, flete, gasto…) pero no suma existencias.</p>}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={{ color: txtSf }}>{d.repuesto_id ? <><strong>{d.repuesto_codigo}</strong> · {d.repuesto_nombre}</> : (d.accion === 'omitir' ? 'No va al inventario' : '—')}</td>
                                                    <td style={{ color: txtSf }}>{d.movimiento_id ? `+${cant(d.movimiento_cantidad)} · stock ${cant(d.stock_anterior)} → ${cant(d.stock_nuevo)}` : '—'}</td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <aside className="compra-aside">
                    <TotalesCompra theme={theme} totales={totales} />
                    {pendiente && datos.forma_pago === 'contado' && (
                        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                            <div><label style={labelSt}>MÉTODO DE PAGO</label>
                                <select style={inputSt} value={pago.metodo_pago} onChange={e => setPago({ ...pago, metodo_pago: e.target.value })}>{METODOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
                            <div><label style={labelSt}>REFERENCIA</label><input style={inputSt} value={pago.referencia_pago} onChange={e => setPago({ ...pago, referencia_pago: e.target.value })} placeholder="N° de transferencia" /></div>
                        </div>
                    )}
                    {pendiente && puede('proveedores', 'crear') ? (
                        <button type="button" onClick={() => registrar()} disabled={enviando}
                            style={{ ...btnPrim, width: '100%', justifyContent: 'center', marginTop: 14, padding: '12px 14px', background: 'linear-gradient(135deg, #059669, #10b981)', opacity: enviando ? .6 : 1 }}>
                            {enviando ? 'REGISTRANDO...' : alInventario ? 'REGISTRAR COMPRA Y SUMAR AL INVENTARIO' : 'REGISTRAR COMPRA'}
                        </button>
                    ) : !pendiente && (
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.86rem', color: mut, marginTop: 12 }}>Esta factura ya no está pendiente ({f.estado === 'registrada' ? 'registrada' : 'no registrable'}).</p>
                    )}
                </aside>
            </div>
        </div>
    );
}
