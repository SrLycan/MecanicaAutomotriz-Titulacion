/**
 * SS SWAP - Pestaña "Facturas de compra" (Proveedores)
 *
 * 1. Se ingresa la clave de acceso (o se carga el XML del proveedor): el
 *    servidor consulta al SRI y trae cabecera y artículos. CONSULTAR NO
 *    TOCA EL INVENTARIO.
 * 2. Se revisa cada artículo: producto existente (sugerido por código),
 *    producto nuevo (se le asigna el código interno al confirmar) u omitir
 *    (servicios, fletes), con el inventario de destino y la cantidad recibida.
 * 3. Al confirmar, el servidor registra en UNA transacción la compra, las
 *    entradas de inventario y la deuda/pago. Una factura registrada no se
 *    puede volver a sumar.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Paginador from './Paginador';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../common/ConfirmDialog';
import { dinero } from '../finanzas/tema';
import { nuevaClaveIdempotencia, conClave } from '../../utils/idempotencia';

function IconX() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconPlus() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }

const AREAS = [{ id: 'mecanica', label: 'Mecánica' }, { id: 'colisiones', label: 'Colisiones / Pintura' }];
const AREA_LABEL = Object.fromEntries(AREAS.map(a => [a.id, a.label]));
const METODOS = ['transferencia', 'efectivo', 'tarjeta', 'cheque', 'otro'];
const ESTADO = {
    pendiente_confirmacion: { label: 'PENDIENTE DE CONFIRMAR', color: '#f59e0b' },
    registrada: { label: 'COMPRA REGISTRADA', color: '#10b981' },
    no_registrable: { label: 'NO REGISTRABLE', color: '#ef4444' },
    error: { label: 'ERROR', color: '#ef4444' },
};
const SRI = {
    AUTORIZADO: { label: 'AUTORIZADA EN EL SRI', color: '#10b981' },
    'NO AUTORIZADO': { label: 'NO AUTORIZADA', color: '#ef4444' },
    ANULADO: { label: 'ANULADA EN EL SRI', color: '#ef4444' },
    'PENDIENTE DE ANULAR': { label: 'PENDIENTE DE ANULAR', color: '#ef4444' },
    NO_ENCONTRADO: { label: 'NO ENCONTRADA EN EL SRI', color: '#ef4444' },
    SIN_VERIFICAR: { label: 'SIN VERIFICAR CON EL SRI', color: '#f59e0b' },
};
const ORIGEN = { sri: 'Datos descargados del SRI', xml: 'XML cargado por el usuario', manual: 'Ingreso manual (no verificado)' };
const fecha = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'; };
const cant = (n) => (Number(n) % 1 === 0 ? String(Number(n)) : String(Number(Number(n).toFixed(4))));

function Badge({ color, children }) {
    return <span className="prov-badge" style={{ background: `${color}18`, border: `1px solid ${color}44`, color, whiteSpace: 'nowrap' }}>{children}</span>;
}

export default function FacturasCompraTab({ theme, proveedores, onCambio }) {
    const { puede } = useAuth();
    const { txt, txtSf, mut, bdr, card, cardSh, SKY_DEEP, SKY_PALE, labelSt, inputSt, btnPrim } = theme;
    const [facturas, setFacturas] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filtros, setFiltros] = useState({ q: '', estado: '', desde: '', hasta: '' });
    const [pagina, setPagina] = useState(1);
    const [ingreso, setIngreso] = useState(false);
    const [abierta, setAbierta] = useState(null);
    const POR_PAGINA = 20;

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams();
            Object.entries(filtros).forEach(([k, v]) => { if (v) p.set(k, v); });
            p.set('page', String(pagina)); p.set('limit', String(POR_PAGINA));
            const { data } = await api.get(`/proveedores/facturas-compra?${p}`);
            setFacturas(data.facturas || []);
            setTotal(data.total || 0);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cargar las facturas de compra.'); }
        finally { setLoading(false); }
    }, [filtros, pagina]);
    useEffect(() => { setPagina(1); }, [filtros]);
    useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

    const filtroSt = { ...inputSt, padding: '8px 10px', fontSize: '.8rem' };
    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 14 }}>
                <div style={{ flex: '1 1 240px' }}>
                    <label style={labelSt}>BUSCAR</label>
                    <input style={filtroSt} value={filtros.q} placeholder="Proveedor, RUC, número o clave de acceso" onChange={e => setFiltros({ ...filtros, q: e.target.value })} />
                </div>
                <div>
                    <label style={labelSt}>ESTADO</label>
                    <select style={filtroSt} value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
                        <option value="">Todos</option>
                        <option value="pendiente_confirmacion">Pendientes de confirmar</option>
                        <option value="registrada">Compras registradas</option>
                        <option value="no_registrable">No registrables</option>
                    </select>
                </div>
                <div><label style={labelSt}>DESDE</label><input type="date" style={filtroSt} value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} /></div>
                <div><label style={labelSt}>HASTA</label><input type="date" style={filtroSt} value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} /></div>
                {puede('proveedores', 'crear') && (
                    <button onClick={() => setIngreso(true)} style={{ ...btnPrim, marginLeft: 'auto', height: 38 }}><IconPlus /> REGISTRAR FACTURA DE COMPRA</button>
                )}
            </div>
            <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginBottom: 12 }}>
                {total} factura{total !== 1 ? 's' : ''} · Consultar una factura no cambia el inventario: solo al confirmarla se suman las existencias, una única vez.
            </p>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando facturas...</p>
            ) : facturas.length === 0 ? (
                <div style={{ padding: 50, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>Sin facturas de compra</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginTop: 4 }}>Registre la primera con la clave de acceso de la factura electrónica del proveedor.</p>
                </div>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table">
                        <thead><tr style={{ background: SKY_PALE }}>
                            {['Fecha', 'Proveedor', 'Factura', 'Artículos', 'Total', 'SRI', 'Estado'].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {facturas.map(f => (
                                <tr key={f.id} style={{ borderColor: bdr, cursor: 'pointer' }} onClick={() => setAbierta(f.id)} title="Ver detalle">
                                    <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fecha(f.fecha_emision)}</td>
                                    <td>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: txt }}>{f.proveedor_nombre || f.emisor_razon_social || '—'}</p>
                                        <p style={{ fontSize: '.74rem', color: mut }}>RUC {f.emisor_ruc}</p>
                                    </td>
                                    <td style={{ color: txtSf }}>{f.numero}{Number(f.ambiente) === 1 && <div style={{ fontSize: '.7rem', color: '#f59e0b' }}>ambiente de pruebas</div>}</td>
                                    <td style={{ color: txtSf }}>{f.articulos}</td>
                                    <td style={{ color: txt, fontWeight: 600 }}>{dinero(f.importe_total)}</td>
                                    <td><Badge color={(SRI[f.estado_sri] || SRI.SIN_VERIFICAR).color}>{(SRI[f.estado_sri] || SRI.SIN_VERIFICAR).label}</Badge></td>
                                    <td><Badge color={(ESTADO[f.estado] || ESTADO.error).color}>{(ESTADO[f.estado] || ESTADO.error).label}</Badge></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Paginador pagina={pagina} setPagina={setPagina} total={total} porPagina={POR_PAGINA} theme={theme} />

            {ingreso && <ModalIngreso theme={theme} onClose={() => setIngreso(false)} onFactura={(f) => { setIngreso(false); setAbierta(f.id); cargar(); }} />}
            {abierta && <ModalFactura theme={theme} id={abierta} proveedores={proveedores}
                onClose={() => { setAbierta(null); cargar(); }} onCambio={() => { cargar(); onCambio?.(); }} />}
        </div>
    );
}

// ───────────────────────── Ingreso: clave, XML o manual ─────────────────────────

function ModalIngreso({ theme, onClose, onFactura }) {
    const { txt, mut, bdr, boxBg, labelSt, inputSt, btnPrim, btnSec, SKY_DEEP } = theme;
    const [clave, setClave] = useState('');
    const [trabajando, setTrabajando] = useState(false);
    const [problema, setProblema] = useState(null); // { codigo, error }
    const [manual, setManual] = useState(false);
    const archivo = useRef(null);
    const limpia = clave.replace(/\s+/g, '');

    const consultar = async () => {
        if (!/^\d{49}$/.test(limpia)) return toast.error('La clave de acceso debe tener 49 dígitos.');
        setTrabajando(true); setProblema(null);
        try {
            const { data } = await api.post('/proveedores/facturas-compra/consultar', { clave_acceso: limpia });
            if (data.existente) toast(data.factura.estado === 'registrada' ? 'Esta factura ya está registrada: no se volverá a sumar al inventario.' : 'Esta factura ya había sido consultada.', { icon: 'ℹ️' });
            else toast.success('Factura obtenida del SRI.');
            onFactura(data.factura);
        } catch (err) {
            const d = err.response?.data || {};
            setProblema({ codigo: d.codigo, error: d.error || 'No se pudo consultar la factura.' });
        } finally { setTrabajando(false); }
    };

    const cargarArchivo = async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        if (!/\.xml$/i.test(f.name)) return toast.error('Seleccione el archivo .xml de la factura.');
        if (f.size > 2 * 1024 * 1024) return toast.error('El XML supera 2 MB.');
        setTrabajando(true); setProblema(null);
        try {
            const xml = await f.text();
            const { data } = await api.post('/proveedores/facturas-compra/xml', { xml });
            if (data.existente && data.factura.estado === 'registrada') toast('Esta factura ya está registrada: no se volverá a sumar al inventario.', { icon: 'ℹ️' });
            else if (data.sri_disponible === false) toast('El SRI no respondió: los datos del XML quedan SIN VERIFICAR.', { icon: '⚠️', duration: 7000 });
            else toast.success('XML leído y verificado con el SRI.');
            onFactura(data.factura);
        } catch (err) {
            const d = err.response?.data || {};
            setProblema({ codigo: d.codigo, error: d.error || 'No se pudo leer el XML.' });
        } finally { setTrabajando(false); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !trabajando && onClose()}>
            <div className="modal-box" style={{ maxWidth: manual ? 880 : 600, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>FACTURAS DE COMPRA</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt }}>Registrar factura del proveedor</h2>
                    </div>
                    <button onClick={onClose} disabled={trabajando} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                </div>

                {!manual && (
                    <>
                        <label style={labelSt}>CLAVE DE ACCESO (49 DÍGITOS, ESTÁ EN EL RIDE O EN EL CORREO DEL PROVEEDOR)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input value={clave} onChange={e => setClave(e.target.value)} inputMode="numeric" maxLength={60} placeholder="0000000000000000000000000000000000000000000000000"
                                onKeyDown={e => e.key === 'Enter' && consultar()} style={{ ...inputSt, fontFamily: 'monospace', letterSpacing: '.02em' }} autoFocus />
                            <button onClick={consultar} disabled={trabajando} style={{ ...btnPrim, opacity: trabajando ? .6 : 1, whiteSpace: 'nowrap' }}>{trabajando ? 'CONSULTANDO...' : 'CONSULTAR EN EL SRI'}</button>
                        </div>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.76rem', color: limpia.length === 49 ? '#10b981' : mut, marginTop: 6 }}>{limpia.length}/49 dígitos</p>

                        <div style={{ borderTop: `1px solid ${bdr}`, marginTop: 16, paddingTop: 14 }}>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: txt, marginBottom: 8 }}>¿Tiene el archivo XML que le envió el proveedor? Se valida y se vuelve a comprobar con el SRI.</p>
                            <input ref={archivo} type="file" accept=".xml,application/xml,text/xml" onChange={cargarArchivo} style={{ display: 'none' }} aria-label="Archivo XML de la factura" />
                            <button onClick={() => archivo.current?.click()} disabled={trabajando} style={btnSec}>CARGAR XML DEL PROVEEDOR</button>
                        </div>
                    </>
                )}

                {problema && !manual && (
                    <div role="alert" style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: '#f59e0b14', border: '1px solid #f59e0b55', fontFamily: "'Outfit'", fontSize: '.84rem', color: txt }}>
                        {problema.error}
                        {problema.codigo === 'SRI_NO_DISPONIBLE' && /^\d{49}$/.test(limpia) && (
                            <div style={{ marginTop: 10 }}>
                                <button onClick={() => setManual(true)} style={{ ...btnSec, padding: '7px 12px' }}>INGRESAR LOS ARTÍCULOS A MANO (NO VERIFICADO)</button>
                            </div>
                        )}
                    </div>
                )}

                {manual && <IngresoManual theme={theme} clave={limpia} onVolver={() => setManual(false)} onFactura={onFactura} />}
            </div>
        </div>
    );
}

function IngresoManual({ theme, clave, onVolver, onFactura }) {
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
            toast(data.sri_disponible === false ? 'Guardada SIN VERIFICAR: revise los datos antes de confirmar.' : 'El SRI respondió: se usaron sus datos.', { icon: 'ℹ️', duration: 6000 });
            onFactura(data.factura);
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo guardar.'); }
        finally { setGuardando(false); }
    };
    const st = { ...inputSt, padding: '7px 9px', fontSize: '.82rem' };
    return (
        <div>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f59e0b14', border: '1px solid #f59e0b55', fontFamily: "'Outfit'", fontSize: '.82rem', color: txt, marginBottom: 14 }}>
                Úselo solo si el SRI no responde y no tiene el XML. Los datos quedan como <strong>no verificados</strong> y al confirmar deberá aceptarlo expresamente.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={labelSt}>RAZÓN SOCIAL DEL PROVEEDOR</label><input style={st} value={razon} onChange={e => setRazon(e.target.value)} /></div>
                <div><label style={labelSt}>IVA TOTAL DE LA FACTURA</label><input style={st} type="number" min="0" step="0.01" value={iva} onChange={e => setIva(e.target.value)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.4fr .7fr .9fr .8fr auto', gap: 6, alignItems: 'end' }}>
                {['CÓDIGO PROV.', 'DESCRIPCIÓN *', 'CANT. *', 'P. UNIT. *', 'DESC.', ''].map(h => <span key={h} style={{ ...labelSt, marginBottom: 0 }}>{h}</span>)}
                {lineas.map((l, i) => (
                    <React.Fragment key={i}>
                        <input style={st} value={l.codigo} onChange={e => set(i, 'codigo', e.target.value)} />
                        <input style={st} value={l.descripcion} onChange={e => set(i, 'descripcion', e.target.value)} />
                        <input style={st} type="number" min="0.01" step="0.01" value={l.cantidad} onChange={e => set(i, 'cantidad', e.target.value)} />
                        <input style={st} type="number" min="0" step="0.0001" value={l.precio_unitario} onChange={e => set(i, 'precio_unitario', e.target.value)} />
                        <input style={st} type="number" min="0" step="0.01" value={l.descuento} onChange={e => set(i, 'descuento', e.target.value)} />
                        <button onClick={() => setLineas(lineas.filter((_, j) => j !== i))} disabled={lineas.length === 1} style={{ ...btnSec, padding: '6px 9px' }} title="Quitar">✕</button>
                    </React.Fragment>
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
                <button onClick={() => setLineas([...lineas, { codigo: '', descripcion: '', cantidad: 1, precio_unitario: '', descuento: '' }])} style={btnSec}>+ ARTÍCULO</button>
                <span style={{ fontFamily: "'Outfit'", color: mut, fontSize: '.85rem' }}>Subtotal {dinero(subtotal)} · Total {dinero(subtotal + (Number(iva) || 0))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, borderTop: `1px solid ${bdr}`, paddingTop: 14 }}>
                <button onClick={onVolver} style={btnSec}>VOLVER</button>
                <button onClick={guardar} disabled={guardando} style={{ ...btnPrim, opacity: guardando ? .6 : 1 }}>{guardando ? 'GUARDANDO...' : 'GUARDAR PARA REVISAR'}</button>
            </div>
        </div>
    );
}

// ───────────────────────── Detalle / revisión / confirmación ─────────────────────────

function BuscadorProducto({ theme, valor, onElegir, area }) {
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
            <button type="button" onClick={() => setAbierto(!abierto)} style={{ ...inputSt, padding: '7px 9px', fontSize: '.8rem', textAlign: 'left', cursor: 'pointer' }}>
                {valor ? `${valor.codigo} · ${valor.nombre}` : 'Elegir producto…'}
            </button>
            {abierto && (
                <div style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, minWidth: 260, background: boxBg, border: `1px solid ${bdr}`, borderRadius: 10, padding: 6, boxShadow: '0 12px 30px -10px rgba(0,0,0,.35)' }}>
                    <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre, código interno o del proveedor" style={{ ...inputSt, padding: '6px 8px', fontSize: '.8rem', marginBottom: 4 }} />
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {lista.length === 0 && <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, padding: 6 }}>Sin resultados</p>}
                        {lista.map(r => (
                            <button key={r.id} type="button" onClick={() => { onElegir(r); setAbierto(false); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '6px 8px', cursor: 'pointer', color: txt, fontFamily: "'Outfit'", fontSize: '.8rem', borderRadius: 6 }}>
                                <strong>{r.codigo}</strong> · {r.nombre} <span style={{ color: mut }}>({AREA_LABEL[r.area] || r.area} · stock {cant(r.stock_actual)}{r.codigo_proveedor ? ` · prov. ${r.codigo_proveedor}` : ''})</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ModalFactura({ theme, id, proveedores, onClose, onCambio }) {
    const { puede } = useAuth();
    const confirm = useConfirm();
    const { txt, txtSf, mut, bdr, boxBg, SKY_DEEP, SKY_PALE, labelSt, inputSt, btnPrim, btnSec } = theme;
    const [f, setF] = useState(null);
    const [categorias, setCategorias] = useState([]);
    const [dec, setDec] = useState({});                 // detalle_id -> decisión
    const [prov, setProv] = useState('crear');
    const [pago, setPago] = useState({ forma_pago: 'credito', metodo_pago: 'transferencia', referencia_pago: '' });
    const [acepto, setAcepto] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const clave = useRef(nuevaClaveIdempotencia());

    const cargar = useCallback(async () => {
        try {
            const { data } = await api.get(`/proveedores/facturas-compra/${id}`);
            const fa = data.factura;
            setF(fa);
            setProv(fa.proveedor_id ? String(fa.proveedor_id) : 'crear');
            // Decisión inicial: producto sugerido POR CÓDIGO; si no hay, producto nuevo (el usuario lo revisa).
            setDec(Object.fromEntries(fa.detalles.map(d => {
                const s = fa.sugerencias?.[d.id];
                const sug = s?.sugerido;
                return [d.id, sug
                    ? { accion: 'existente', repuesto: sug, area: sug.area, cantidad_recibida: cant(d.cantidad) }
                    : { accion: 'nuevo', area: 'mecanica', cantidad_recibida: cant(d.cantidad), nuevo: { nombre: d.descripcion, categoria_id: '', precio_venta: '', stock_minimo: '', unidad_medida: d.unidad_medida || 'unidad' } }];
            })));
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo abrir la factura.'); onClose(); }
    }, [id, onClose]);
    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => { api.get('/inventory/categorias').then(({ data }) => setCategorias(data.categorias || [])).catch(() => {}); }, []);

    if (!f) return <div className="modal-backdrop"><div className="modal-box" style={{ background: boxBg, padding: 40, color: mut }}>Cargando…</div></div>;

    const setLinea = (did, cambios) => setDec(prev => ({ ...prev, [did]: { ...prev[did], ...cambios } }));
    const pendiente = f.estado === 'pendiente_confirmacion';
    const confirmables = (f.advertencias || []).filter(a => a.confirmar);
    const sriInfo = SRI[f.estado_sri] || SRI.SIN_VERIFICAR;

    const confirmar = async (extra = {}) => {
        if (confirmables.length && !acepto) return toast.error('Revise y acepte las advertencias de la factura.');
        const lineas = f.detalles.map(d => {
            const x = dec[d.id];
            const base = { detalle_id: d.id, accion: x.accion, cantidad_recibida: x.cantidad_recibida, confirmar_nuevo: extra[d.id] === true || undefined };
            if (x.accion === 'existente') return { ...base, repuesto_id: x.repuesto?.id };
            if (x.accion === 'nuevo') return { ...base, area: x.area, nuevo: x.nuevo };
            return base;
        });
        const sinProducto = lineas.find(l => l.accion === 'existente' && !l.repuesto_id);
        if (sinProducto) return toast.error('Elija el producto existente en todas las líneas marcadas así.');
        setEnviando(true);
        try {
            const body = { ...(prov === 'crear' ? { crear_proveedor: true } : { proveedor_id: Number(prov) }), ...pago, aceptar_advertencias: acepto, lineas };
            const { data } = await api.post(`/proveedores/facturas-compra/${f.id}/confirmar`, body, conClave(clave.current));
            const entradas = data.resultado.lineas.filter(l => l.movimiento).length;
            const nuevos = data.resultado.lineas.filter(l => l.creado).length;
            toast.success(`Compra registrada: ${entradas} entrada(s) al inventario${nuevos ? `, ${nuevos} producto(s) nuevo(s)` : ''}.`, { duration: 6000 });
            setF(data.factura);
            onCambio?.();
        } catch (err) {
            const d = err.response?.data || {};
            if (d.codigo === 'POSIBLE_DUPLICADO' && d.linea) {
                const det = f.detalles.find(x => x.linea === d.linea);
                if (det && await confirm({ title: 'Posible producto repetido', message: `${d.error} ¿Crear de todas formas un producto nuevo?`, confirmLabel: 'Crear nuevo', danger: false })) {
                    setEnviando(false);
                    return confirmar({ ...extra, [det.id]: true });
                }
            } else if (d.codigo === 'YA_REGISTRADA') {
                toast(d.error, { icon: 'ℹ️' });
                cargar();
            } else toast.error(d.error || 'No se pudo registrar la compra.', { duration: 7000 });
            clave.current = nuevaClaveIdempotencia();
        } finally { setEnviando(false); }
    };

    const reconsultar = async () => {
        try {
            const { data } = await api.post('/proveedores/facturas-compra/consultar', { clave_acceso: f.clave_acceso, reconsultar: true });
            toast.success('Estado actualizado con el SRI.');
            setF(null); setTimeout(() => cargar(), 0);
            return data;
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo consultar al SRI.'); return null; }
    };
    const descartar = async () => {
        if (!(await confirm({ title: 'Descartar factura', message: 'Se borra esta factura consultada (no se registró ninguna compra ni movimiento). ¿Continuar?', confirmLabel: 'Descartar' }))) return;
        try { await api.delete(`/proveedores/facturas-compra/${f.id}`); toast.success('Factura descartada.'); onClose(); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudo descartar.'); }
    };
    // PDF generado en el servidor (diseño propio, no la ventana del navegador).
    const pdf = async (descargar) => {
        const ventana = descargar ? null : window.open('', '_blank');   // se abre ya (evita el bloqueo de ventanas emergentes)
        try {
            const { data } = await api.get(`/proveedores/facturas-compra/${f.id}/pdf`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
            if (ventana) { ventana.location.href = url; }
            else {
                const a = document.createElement('a'); a.href = url; a.download = `Factura-compra-${f.numero}.pdf`;
                document.body.appendChild(a); a.click(); a.remove();
            }
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch {
            if (ventana) ventana.close();
            toast.error('No se pudo generar el PDF de la factura.');
        }
    };
    const descargarXml = async () => {
        try {
            const { data } = await api.get(`/proveedores/facturas-compra/${f.id}/xml`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([data], { type: 'application/xml' }));
            const a = document.createElement('a'); a.href = url; a.download = `factura-${f.numero}.xml`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        } catch { toast.error('No se pudo descargar el XML.'); }
    };

    const st = { ...inputSt, padding: '7px 9px', fontSize: '.8rem' };
    const proveedorCoincide = proveedores.filter(p => !p.ruc || p.ruc.replace(/\s+/g, '').toUpperCase() === f.emisor_ruc);
    const Dato = ({ k, v }) => (<div><p style={{ ...labelSt, marginBottom: 2 }}>{k}</p><p style={{ fontFamily: "'Outfit'", fontSize: '.86rem', color: txt, wordBreak: 'break-all' }}>{v || '—'}</p></div>);

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !enviando && onClose()}>
            <div className="modal-box" style={{ maxWidth: 1180, width: '96vw', background: boxBg, border: `1px solid ${bdr}`, padding: 26 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>FACTURA DE COMPRA {f.numero}</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.55rem', letterSpacing: '.04em', color: txt }}>{f.emisor_razon_social || f.emisor_ruc}</h2>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            <Badge color={sriInfo.color}>{sriInfo.label}</Badge>
                            <Badge color={(ESTADO[f.estado] || ESTADO.error).color}>{(ESTADO[f.estado] || ESTADO.error).label}</Badge>
                            <Badge color={f.origen_datos === 'sri' ? '#10b981' : '#f59e0b'}>{ORIGEN[f.origen_datos]}</Badge>
                            {f.firma_valida === true && <Badge color="#10b981">FIRMA ELECTRÓNICA VÁLIDA</Badge>}
                            {Number(f.ambiente) === 1 && <Badge color="#f59e0b">AMBIENTE DE PRUEBAS</Badge>}
                        </div>
                    </div>
                    <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button onClick={() => pdf(true)} style={{ ...btnPrim, padding: '7px 12px' }} title="Descargar la factura en PDF">DESCARGAR PDF</button>
                        <button onClick={() => pdf(false)} style={{ ...btnSec, padding: '7px 12px' }} title="Abrir el PDF para imprimirlo">IMPRIMIR</button>
                        {f.tiene_xml && <button onClick={descargarXml} style={{ ...btnSec, padding: '7px 12px' }}>XML</button>}
                        <button onClick={onClose} disabled={enviando} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, padding: 14, borderRadius: 12, background: SKY_PALE, marginBottom: 14 }}>
                    <Dato k="RUC PROVEEDOR" v={f.emisor_ruc} />
                    <Dato k="FECHA DE EMISIÓN" v={fecha(f.fecha_emision)} />
                    <Dato k="COMPRADOR" v={f.comprador_identificacion ? `${f.comprador_razon_social || ''} (${f.comprador_identificacion})` : null} />
                    <Dato k="AUTORIZACIÓN" v={f.fecha_autorizacion ? new Date(f.fecha_autorizacion).toLocaleString('es-EC') : null} />
                    <Dato k="SUBTOTAL" v={dinero(f.total_sin_impuestos)} />
                    <Dato k="DESCUENTO" v={dinero(f.total_descuento)} />
                    <Dato k="IVA" v={dinero(f.total_iva)} />
                    <Dato k="TOTAL" v={dinero(f.importe_total)} />
                    <div style={{ gridColumn: '1/-1' }}><Dato k="CLAVE DE ACCESO" v={f.clave_acceso} /></div>
                </div>

                {(f.advertencias || []).length > 0 && (
                    <div role="alert" style={{ padding: '10px 14px', borderRadius: 10, background: '#f59e0b14', border: '1px solid #f59e0b55', marginBottom: 14 }}>
                        {f.advertencias.map(a => <p key={a.codigo} style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: txt }}>⚠️ {a.mensaje}</p>)}
                        {pendiente && confirmables.length > 0 && (
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontFamily: "'Outfit'", fontSize: '.84rem', color: txt, cursor: 'pointer' }}>
                                <input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)} /> Revisé estas advertencias y quiero registrar la compra igualmente.
                            </label>
                        )}
                    </div>
                )}
                {pendiente && f.ultimo_error && (
                    <p role="alert" style={{ padding: '8px 12px', borderRadius: 10, background: '#ef444414', border: '1px solid #ef444455', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.84rem', marginBottom: 14 }}>
                        Último intento sin registrar: {f.ultimo_error} (no se cambió el inventario).
                    </p>
                )}

                {/* Artículos */}
                <div className="prov-table-wrap" style={{ border: `1px solid ${bdr}`, overflow: 'visible' }}>
                    <table className="prov-table">
                        <thead><tr style={{ background: SKY_PALE }}>
                            {['#', 'Artículo del proveedor', 'Cant.', 'Costo unit.', pendiente ? 'Qué hacer' : 'Producto interno', pendiente ? 'Detalle' : 'Entrada al inventario'].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}
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
                                            <p style={{ fontSize: '.72rem', color: mut }}>{[d.codigo_principal && `Cód. ${d.codigo_principal}`, d.codigo_auxiliar && `Aux. ${d.codigo_auxiliar}`, d.unidad_medida].filter(Boolean).join(' · ') || 'Sin código del proveedor'}</p>
                                            {Number(d.descuento) > 0 && <p style={{ fontSize: '.72rem', color: mut }}>Descuento {dinero(d.descuento)}</p>}
                                        </td>
                                        <td style={{ color: txtSf }}>{cant(d.cantidad)}</td>
                                        <td style={{ color: txtSf }}>{dinero(costo)}<div style={{ fontSize: '.7rem', color: mut }}>sin IVA</div></td>
                                        {pendiente ? (
                                            <>
                                                <td style={{ minWidth: 170 }}>
                                                    <select style={st} value={x.accion} onChange={e => setLinea(d.id, { accion: e.target.value })}>
                                                        <option value="existente">Producto existente</option>
                                                        <option value="nuevo">Producto nuevo</option>
                                                        <option value="omitir">No va al inventario</option>
                                                    </select>
                                                    {sug?.motivo === 'codigo_proveedor_registrado' && <p style={{ fontSize: '.7rem', color: '#10b981', marginTop: 4 }}>Reconocido por el código de este proveedor</p>}
                                                    {sug?.motivo === 'codigo' && <p style={{ fontSize: '.7rem', color: '#10b981', marginTop: 4 }}>Sugerido por código</p>}
                                                    {sug?.motivo === 'varios_por_codigo' && <p style={{ fontSize: '.7rem', color: '#f59e0b', marginTop: 4 }}>Varios productos con ese código: elija uno</p>}
                                                </td>
                                                <td style={{ minWidth: 330 }}>
                                                    {x.accion === 'existente' && (
                                                        <div style={{ display: 'grid', gap: 6 }}>
                                                            <BuscadorProducto theme={theme} valor={x.repuesto} onElegir={(r) => setLinea(d.id, { repuesto: r, area: r.area })} />
                                                            {!x.repuesto && sug?.candidatos?.length > 0 && (
                                                                <p style={{ fontSize: '.72rem', color: mut }}>Parecidos: {sug.candidatos.slice(0, 3).map(c => (
                                                                    <button key={c.id} type="button" onClick={() => setLinea(d.id, { repuesto: c, area: c.area })} style={{ background: 'none', border: 'none', color: SKY_DEEP, cursor: 'pointer', textDecoration: 'underline', fontSize: '.72rem' }}>{c.codigo}</button>
                                                                ))}</p>
                                                            )}
                                                            {x.repuesto && <p style={{ fontSize: '.72rem', color: mut }}>Inventario: {AREA_LABEL[x.repuesto.area] || x.repuesto.area} · stock actual {cant(x.repuesto.stock_actual)}</p>}
                                                            <label style={{ fontSize: '.72rem', color: mut }}>Cantidad recibida <input style={{ ...st, width: 90, display: 'inline-block', marginLeft: 6 }} type="number" min="0.01" step="0.01" max={d.cantidad} value={x.cantidad_recibida} onChange={e => setLinea(d.id, { cantidad_recibida: e.target.value })} /></label>
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
                                                            <input style={{ ...st, gridColumn: '1/-1' }} value={x.nuevo?.nombre || ''} placeholder="Nombre del producto" onChange={e => setLinea(d.id, { nuevo: { ...x.nuevo, nombre: e.target.value } })} />
                                                            <input style={st} type="number" min="0" step="0.01" placeholder="Precio de venta" value={x.nuevo?.precio_venta || ''} onChange={e => setLinea(d.id, { nuevo: { ...x.nuevo, precio_venta: e.target.value } })} />
                                                            <input style={st} type="number" min="0" step="0.01" placeholder="Stock mínimo" value={x.nuevo?.stock_minimo || ''} onChange={e => setLinea(d.id, { nuevo: { ...x.nuevo, stock_minimo: e.target.value } })} />
                                                            <input style={st} placeholder="Unidad" value={x.nuevo?.unidad_medida || ''} onChange={e => setLinea(d.id, { nuevo: { ...x.nuevo, unidad_medida: e.target.value } })} />
                                                            <input style={st} type="number" min="0.01" step="0.01" max={d.cantidad} title="Cantidad recibida" value={x.cantidad_recibida} onChange={e => setLinea(d.id, { cantidad_recibida: e.target.value })} />
                                                            <p style={{ gridColumn: '1/-1', fontSize: '.7rem', color: mut }}>El código interno ({x.area === 'colisiones' ? 'COL' : 'MEC'}-000000) lo asigna el sistema al confirmar.</p>
                                                        </div>
                                                    )}
                                                    {x.accion === 'omitir' && <p style={{ fontSize: '.78rem', color: mut }}>Se registra en la compra (servicio, flete…) pero no suma existencias.</p>}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={{ color: txtSf }}>
                                                    {d.repuesto_id ? <><strong>{d.repuesto_codigo}</strong> · {d.repuesto_nombre}<div style={{ fontSize: '.72rem', color: mut }}>{AREA_LABEL[d.area] || d.area}</div></> : (d.accion === 'omitir' ? 'No va al inventario' : '—')}
                                                </td>
                                                <td style={{ color: txtSf }}>
                                                    {d.movimiento_id ? <>+{cant(d.movimiento_cantidad)} · stock {cant(d.stock_anterior)} → {cant(d.stock_nuevo)}
                                                        <div><a href={`/dashboard/movimientos?repuesto_id=${d.repuesto_id}`} style={{ fontSize: '.72rem', color: SKY_DEEP }}>Historial del producto</a></div></> : '—'}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {pendiente && puede('proveedores', 'crear') && (
                    <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: 12, marginTop: 16 }}>
                        <div>
                            <label style={labelSt}>PROVEEDOR</label>
                            <select style={inputSt} value={prov} onChange={e => setProv(e.target.value)}>
                                <option value="crear">{f.proveedor_id ? 'Usar el de la factura' : 'Crear con los datos de la factura'} (RUC {f.emisor_ruc})</option>
                                {proveedorCoincide.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}{p.ruc ? ` · ${p.ruc}` : ' · sin RUC'}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>FORMA DE PAGO</label>
                            <select style={inputSt} value={pago.forma_pago} onChange={e => setPago({ ...pago, forma_pago: e.target.value })}>
                                <option value="credito">Crédito (15 días, queda por pagar)</option>
                                <option value="contado">Contado (se registra el pago ahora)</option>
                            </select>
                        </div>
                        {pago.forma_pago === 'contado' && (
                            <>
                                <div><label style={labelSt}>MÉTODO</label>
                                    <select style={inputSt} value={pago.metodo_pago} onChange={e => setPago({ ...pago, metodo_pago: e.target.value })}>{METODOS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                                <div><label style={labelSt}>REFERENCIA</label><input style={inputSt} value={pago.referencia_pago} onChange={e => setPago({ ...pago, referencia_pago: e.target.value })} placeholder="N° de transferencia" /></div>
                            </>
                        )}
                    </div>
                )}

                {!pendiente && f.compra_id && (
                    <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: `1px solid ${bdr}` }}>
                        <p style={{ ...labelSt }}>COMPRA #{f.compra_id} · {f.forma_pago === 'contado' ? 'CONTADO' : `CRÉDITO · VENCE ${fecha(f.fecha_vencimiento)}`} · SALDO {dinero(f.saldo)}</p>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>
                            Registrada por {f.registrada_por_nombre || '—'} el {f.registrada_at ? new Date(f.registrada_at).toLocaleString('es-EC') : '—'} · proveedor {f.proveedor_nombre}. Los pagos se registran en Compras o en el Historial financiero.
                        </p>
                        {f.pagos.length > 0 && (
                            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontFamily: "'Outfit'", fontSize: '.8rem', color: txtSf }}>
                                {f.pagos.map(p => <li key={p.id}>{p.tipo.toUpperCase()} · {p.descripcion} · {dinero(p.monto)} · {p.estado}</li>)}
                            </ul>
                        )}
                    </div>
                )}

                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${bdr}`, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {f.estado !== 'registrada' && puede('proveedores', 'eliminar') && <button onClick={descartar} style={{ ...btnSec, color: '#ef4444' }}>DESCARTAR</button>}
                        {f.estado !== 'registrada' && puede('proveedores', 'crear') && <button onClick={reconsultar} style={btnSec}>VOLVER A CONSULTAR AL SRI</button>}
                    </div>
                    {pendiente && puede('proveedores', 'crear') && (
                        <button onClick={() => confirmar()} disabled={enviando} style={{ ...btnPrim, background: 'linear-gradient(135deg, #059669, #10b981)', opacity: enviando ? .6 : 1 }}>
                            {enviando ? 'REGISTRANDO...' : 'CONFIRMAR COMPRA Y SUMAR AL INVENTARIO'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
