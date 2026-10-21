/**
 * SS SWAP - Pestaña "Compras" (dentro de la sección Proveedores) · Sprint 26
 *
 * Un solo lugar para las compras, como en los sistemas contables:
 *  - Lista con CREAR, filtros Desde / Hasta / Estado, indicadores TOTAL y
 *    CANTIDAD, Excel y acciones (ver, imprimir, eliminar).
 *  - "Crear compra": la factura electrónica se trae del SRI con su
 *    autorización (o el XML); se revisa a dónde va cada artículo y al
 *    registrar se suma al inventario. Notas de venta, otros comprobantes y
 *    órdenes de compra se cargan a mano.
 *  - Detalle de cada compra con pagos, impresión y totales por tarifa.
 * La URL guarda la vista (?tab=compras&crear=1 o &compra=ID) para que el
 * botón "atrás" del navegador funcione.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Paginador from './Paginador';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../common/ConfirmDialog';
import { dinero } from '../finanzas/tema';
import CrearCompra from './compras/CrearCompra';
import RevisionFactura from './compras/RevisionFactura';
import DetalleCompra, { ImprimirCompra, ModalEditar, tituloCompra } from './compras/DetalleCompra';
import {
    AREAS, AREA_LABEL, DOCUMENTO_CORTO, TIPO_REGISTRO_LABEL, ESTADOS_COMPRA,
    inicioMes, finMes, fechaCorta, descargarCsv, numExcel,
} from './compras/comunes';
import { Badge, Indicador, IconCarrito, IconCajas, IconOjo, IconImpresora, IconPapelera, IconMas } from './compras/piezas';
import RegistradoPor from '../common/RegistradoPor';

function IconEngranaje() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>; }

/** Texto corto del vencimiento: "vence hoy", "vence en 2 dias", "vencida hace 1 dia" */
export function textoVencimiento(dias) {
    const d = Number(dias);
    if (d === 0) return 'vence hoy';
    if (d > 0) return `vence en ${d} día${d !== 1 ? 's' : ''}`;
    return `vencida hace ${-d} día${d !== -1 ? 's' : ''}`;
}

/** Estado del pago: CONTADO / PAGADA / saldo y vencimiento. */
function EstadoPago({ c }) {
    const saldo = Number(c.saldo);
    if (c.estado === 'cancelada') return <span style={{ color: '#94a3b8' }}>—</span>;
    if (saldo <= 0.005) return <Badge color="#10b981">{c.forma_pago === 'contado' ? 'CONTADO · PAGADA' : 'CRÉDITO · PAGADA'}</Badge>;
    const dias = Number(c.dias_para_vencer);
    const color = dias < 0 ? '#ef4444' : dias <= 3 ? '#f59e0b' : '#0ea5e9';
    return (
        <div>
            <Badge color={color}>SALDO {dinero(saldo)}</Badge>
            {c.fecha_vencimiento && <div style={{ fontSize: '.76rem', color, marginTop: 3, fontWeight: dias <= 3 ? 600 : 400 }}>{fechaCorta(c.fecha_vencimiento)} · {textoVencimiento(dias)}</div>}
        </div>
    );
}

export default function ComprasTab({ theme, proveedores, onCambio }) {
    const { puede } = useAuth();
    const confirm = useConfirm();
    const { txt, txtSf, mut, bdr, card, cardSh, SKY_DEEP, SKY_PALE, labelSt, inputSt, btnPrim, btnSec } = theme;
    const [params, setParams] = useSearchParams();
    const compraUrl = /^\d+$/.test(params.get('compra') || '') ? Number(params.get('compra')) : null;
    const crearUrl = params.get('crear') === '1';
    const [revision, setRevision] = useState(null);     // { facturaId, datos }
    const [crearDesde, setCrearDesde] = useState(null);  // { facturaInicial?, datos? } al volver de la revisión

    const [compras, setCompras] = useState([]);
    const [total, setTotal] = useState(0);
    const [resumen, setResumen] = useState({ valor: 0, cantidad: 0 });
    const [loading, setLoading] = useState(true);
    const [filtros, setFiltros] = useState({ desde: inicioMes(), hasta: finMes(), estado: '', proveedor_id: '', area: '', q: '' });
    const [pagina, setPagina] = useState(1);
    const [pendientes, setPendientes] = useState([]);
    const [imprimir, setImprimir] = useState(null);
    const [editar, setEditar] = useState(null);
    const [exportando, setExportando] = useState(false);
    const POR_PAGINA = 20;

    const irA = useCallback((cambios) => {
        const p = new URLSearchParams(params);
        ['crear', 'compra'].forEach(k => p.delete(k));
        Object.entries(cambios).forEach(([k, v]) => { if (v !== null && v !== undefined) p.set(k, String(v)); });
        setParams(p);
    }, [params, setParams]);
    const volverLista = useCallback(() => { setRevision(null); setCrearDesde(null); irA({}); }, [irA]);
    const abrirCompra = useCallback((id) => { setRevision(null); setCrearDesde(null); irA({ compra: id }); }, [irA]);

    const consulta = useCallback((pag, lim) => {
        const p = new URLSearchParams();
        Object.entries(filtros).forEach(([k, v]) => { if (v) p.set(k, v); });
        p.set('page', String(pag)); p.set('limit', String(lim));
        return p;
    }, [filtros]);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/proveedores/compras?${consulta(pagina, POR_PAGINA)}`);
            setCompras(data.compras || []);
            setTotal(data.total || 0);
            setResumen(data.resumen || { valor: 0, cantidad: 0 });
        } catch { toast.error('Error al cargar compras.'); }
        finally { setLoading(false); }
    }, [consulta, pagina]);
    const cargarPendientes = useCallback(() => {
        api.get('/proveedores/facturas-compra?estado=pendiente_confirmacion&limit=5')
            .then(({ data }) => setPendientes(data.facturas || [])).catch(() => setPendientes([]));
    }, []);

    const enLista = !compraUrl && !crearUrl && !revision;
    useEffect(() => { setPagina(1); }, [filtros]);
    useEffect(() => { if (enLista) { const t = setTimeout(cargar, 200); return () => clearTimeout(t); } return undefined; }, [cargar, enLista]);
    useEffect(() => { if (enLista) cargarPendientes(); }, [enLista, cargarPendientes]);

    const exportar = async () => {
        setExportando(true);
        try {
            const todas = [];
            for (let pag = 1; pag <= 50; pag++) {
                const { data } = await api.get(`/proveedores/compras?${consulta(pag, 100)}`);
                todas.push(...(data.compras || []));
                if (todas.length >= (data.total || 0) || !(data.compras || []).length) break;
            }
            descargarCsv(`compras_${filtros.desde || 'inicio'}_${filtros.hasta || 'hoy'}.csv`, [
                ['Inventario', 'F. emisión', 'Proveedor', 'RUC', 'Estado', 'Documento', 'Número', 'Tipo registro', 'Sustento', 'Pago', 'Vence', 'Subtotal', 'IVA', 'Total', 'Pagado', 'Saldo'],
                ...todas.map(c => [AREA_LABEL[c.area] || 'General', fechaCorta(c.fecha_solicitud), c.proveedor_nombre, c.proveedor_ruc || '', (ESTADOS_COMPRA[c.estado] || {}).label || c.estado,
                    DOCUMENTO_CORTO[c.tipo_documento] || '', c.numero_documento || `#${c.id}`, TIPO_REGISTRO_LABEL[c.tipo_registro] || '', c.sustento_tributario || '',
                    c.forma_pago === 'contado' ? 'Contado' : 'Crédito', c.forma_pago === 'credito' ? fechaCorta(c.fecha_vencimiento) : '',
                    numExcel(c.subtotal), numExcel(c.iva), numExcel(c.total), numExcel(c.pagado), numExcel(c.saldo)]),
            ]);
            toast.success(`${todas.length} compra(s) exportadas.`);
        } catch { toast.error('No se pudo exportar.'); }
        finally { setExportando(false); }
    };

    const verImpresion = async (c) => {
        try { const { data } = await api.get(`/proveedores/compras/${c.id}`); setImprimir(data.compra); }
        catch { toast.error('No se pudo preparar la impresión.'); }
    };
    const abrirEditar = async (c) => {
        try { const { data } = await api.get(`/proveedores/compras/${c.id}`); setEditar(data.compra); }
        catch { toast.error('No se pudo abrir la compra.'); }
    };
    const eliminar = async (c) => {
        if (!(await confirm({ title: 'Eliminar compra', message: `¿Eliminar ${tituloCompra(c).toLowerCase()} de ${c.proveedor_nombre}? Solo se puede porque sigue pendiente (no sumó inventario ni tiene pagos).`, confirmLabel: 'Eliminar' }))) return;
        try { await api.delete(`/proveedores/compras/${c.id}`); toast.success('Compra eliminada.'); cargar(); onCambio?.(); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudo eliminar.'); }
    };

    // ── Vistas ──
    if (compraUrl) return <DetalleCompra theme={theme} compraId={compraUrl} onVolver={volverLista} onCambio={onCambio} />;
    if (revision) {
        return <RevisionFactura theme={theme} facturaId={revision.facturaId} datos={revision.datos}
            onVolver={() => { setCrearDesde({ facturaInicial: revision.facturaId, datos: revision.datos }); setRevision(null); }}
            onRegistrada={(id) => { onCambio?.(); abrirCompra(id); }} onAbrirCompra={abrirCompra} />;
    }
    if (crearUrl) {
        return <CrearCompra key={crearDesde?.facturaInicial || 'nueva'} theme={theme} facturaInicial={crearDesde?.facturaInicial} datosIniciales={crearDesde?.datos}
            onRevisarFactura={(r) => setRevision(r)} onCreada={(id) => { onCambio?.(); abrirCompra(id); }} onAbrirCompra={abrirCompra} onVolver={volverLista} />;
    }

    const f = { ...inputSt, padding: '9px 11px', fontSize: '.86rem' };
    return (
        <div>
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, boxShadow: cardSh, padding: 18, marginBottom: 16 }}>
                <div className="compras-filtros">
                    {puede('proveedores', 'crear') && (
                        <button type="button" onClick={() => irA({ crear: 1 })} style={{ ...btnPrim, height: 42, alignSelf: 'end', background: 'linear-gradient(135deg, #0f766e, #0d9488)' }}>
                            <IconCarrito /> CREAR
                        </button>
                    )}
                    <div><label style={labelSt}>DESDE</label><input type="date" style={f} value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} /></div>
                    <div><label style={labelSt}>HASTA</label><input type="date" style={f} value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} /></div>
                    <div><label style={labelSt}>ESTADO</label>
                        <select style={f} value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
                            <option value="">Mostrar todos</option>
                            {Object.entries(ESTADOS_COMPRA).map(([k, v]) => <option key={k} value={k}>{k === 'recibida' ? 'Registradas / recibidas' : v.label.charAt(0) + v.label.slice(1).toLowerCase()}</option>)}
                        </select></div>
                    <div><label style={labelSt}>PROVEEDOR</label>
                        <select style={f} value={filtros.proveedor_id} onChange={e => setFiltros({ ...filtros, proveedor_id: e.target.value })}>
                            <option value="">Todos</option>
                            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                        </select></div>
                    <div><label style={labelSt}>INVENTARIO</label>
                        <select style={f} value={filtros.area} onChange={e => setFiltros({ ...filtros, area: e.target.value })}>
                            <option value="">Todos</option>
                            {AREAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                        </select></div>
                </div>
                <div className="compras-indicadores">
                    <Indicador theme={theme} icono={<IconCarrito />} etiqueta="TOTAL" valor={dinero(resumen.valor)} color="#0d9488" />
                    <Indicador theme={theme} icono={<IconCajas />} etiqueta="CANTIDAD" valor={resumen.cantidad} color="#db2777" />
                </div>
            </div>

            {pendientes.length > 0 && (
                <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 12, background: '#f59e0b14', border: '1px solid #f59e0b55', marginBottom: 14, fontFamily: "'Outfit'", fontSize: '.88rem', color: txt }}>
                    <strong>{pendientes.length} factura(s) consultada(s) sin registrar:</strong>
                    {pendientes.map(p => (
                        <button key={p.id} type="button" onClick={() => { setCrearDesde({ facturaInicial: p.id }); irA({ crear: 1 }); }}
                            style={{ ...btnSec, padding: '5px 10px' }} title="Continuar el registro">
                            {p.numero} · {p.proveedor_nombre || p.emisor_razon_social} · {dinero(p.importe_total)}
                        </button>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button type="button" onClick={exportar} disabled={exportando || !total} style={{ ...btnSec, padding: '8px 14px' }}>{exportando ? 'EXPORTANDO…' : 'EXCEL'}</button>
                    <span style={{ fontFamily: "'Outfit'", fontSize: '.86rem', color: mut }}>{total} compra{total !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ flex: '0 1 320px', minWidth: 200 }}>
                    <label style={labelSt}>BUSCAR</label>
                    <input style={f} value={filtros.q} placeholder="Proveedor, RUC o número de documento" aria-label="Buscar compras" onChange={e => setFiltros({ ...filtros, q: e.target.value })} />
                </div>
            </div>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando compras...</p>
            ) : compras.length === 0 ? (
                <div style={{ padding: 50, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', color: txt }}>No hay compras para estos filtros</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: mut, marginTop: 4 }}>Revise el rango de fechas (por defecto, el mes actual) o cree una compra.</p>
                    {puede('proveedores', 'crear') && <button type="button" onClick={() => irA({ crear: 1 })} style={{ ...btnPrim, marginTop: 14 }}><IconMas /> CREAR COMPRA</button>}
                </div>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table" style={{ minWidth: 980 }}>
                        <thead>
                            <tr style={{ background: SKY_PALE }}>
                                {['Inventario', 'F. emisión', 'Proveedor', 'Estado', 'Documento', 'Pago', 'Valor', 'Acciones'].map(h => (
                                    <th key={h} style={{ color: SKY_DEEP, textAlign: h === 'Valor' ? 'right' : h === 'Acciones' ? 'center' : 'left' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {compras.map(c => {
                                const est = ESTADOS_COMPRA[c.estado] || ESTADOS_COMPRA.pendiente;
                                return (
                                    <tr key={c.id} style={{ borderColor: bdr }}>
                                        <td style={{ color: txtSf }}>{AREA_LABEL[c.area] || 'General'}</td>
                                        <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>
                                            {fechaCorta(c.fecha_solicitud)}
                                            <RegistradoPor nombre={c.usuario_nombre} prefijo="Registrada por" sinNombre="Sin usuario" color={mut} />
                                        </td>
                                        <td style={{ maxWidth: 240 }}>
                                            <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: txt }}>{c.proveedor_nombre}</p>
                                            {c.proveedor_ruc && <p style={{ fontSize: '.78rem', color: mut }}>RUC {c.proveedor_ruc}</p>}
                                        </td>
                                        <td><Badge color={est.color}>{est.label}</Badge></td>
                                        <td>
                                            <p style={{ fontFamily: "'Outfit'", color: txt, fontSize: '.86rem' }}>{DOCUMENTO_CORTO[c.tipo_documento] || 'COMPRA'}</p>
                                            <button type="button" onClick={() => abrirCompra(c.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: SKY_DEEP, fontFamily: "'Outfit'", fontSize: '.86rem', textDecoration: 'underline', textUnderlineOffset: 2, whiteSpace: 'nowrap' }}>
                                                {c.numero_documento || `#${c.id}`}
                                            </button>
                                        </td>
                                        <td><EstadoPago c={c} /></td>
                                        <td style={{ color: txt, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>{dinero(c.total)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                {puede('proveedores', 'editar') && c.estado !== 'cancelada' && (
                                                    <button type="button" className="prov-icon-btn" title="Editar sustento y notas" aria-label={`Editar ${tituloCompra(c)}`} onClick={() => abrirEditar(c)} style={{ color: '#7c3aed' }}><IconEngranaje /></button>
                                                )}
                                                <button type="button" className="prov-icon-btn" title="Ver detalle" aria-label={`Ver ${tituloCompra(c)}`} onClick={() => abrirCompra(c.id)} style={{ color: '#0d9488' }}><IconOjo /></button>
                                                <button type="button" className="prov-icon-btn" title="Imprimir" aria-label={`Imprimir ${tituloCompra(c)}`} onClick={() => verImpresion(c)} style={{ color: SKY_DEEP }}><IconImpresora /></button>
                                                {puede('proveedores', 'eliminar') && c.estado === 'pendiente' && (
                                                    <button type="button" className="prov-icon-btn" title="Eliminar (solo pendientes)" aria-label={`Eliminar ${tituloCompra(c)}`} onClick={() => eliminar(c)} style={{ color: '#ef4444' }}><IconPapelera /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Paginador pagina={pagina} setPagina={setPagina} total={total} porPagina={POR_PAGINA} theme={theme} />

            {imprimir && <ImprimirCompra compra={imprimir} onClose={() => setImprimir(null)} />}
            {editar && <ModalEditar theme={theme} compra={editar} onClose={() => setEditar(null)} onActualizado={() => { setEditar(null); cargar(); }} />}
        </div>
    );
}
