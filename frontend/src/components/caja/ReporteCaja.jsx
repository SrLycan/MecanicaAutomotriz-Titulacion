/**
 * SS SWAP - Reporte completo de una caja (Sprint 29)
 * Cuadre de efectivo, ingresos del sistema por forma de pago, cuadre contra
 * lo declarado por el cajero, documentos, vendedores, movimientos manuales,
 * ventas, ventas a crédito, recaudaciones, anticipos y reaperturas.
 * Botones para descargar el PDF o imprimirlo.
 */
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { dinero, VERDE, ROJO, AMBAR } from '../finanzas/tema';
import { Badge, Modal } from '../finanzas/Modales';
import { descargarArchivo, imprimirPdfCaja } from './archivos';
import { fechaHora, NOMBRE_FORMA, Diferencia } from './comunes';
import { SeccionApertura, SeccionIngresosSistema, SeccionEfectivo, SeccionDocumentos, SeccionPorCobrar, SeccionManuales, SeccionIngresosEgresos } from './Secciones';

export default function ReporteCaja({ theme, sesionId, onClose }) {
    const { txt, txtSf, mut, bdr, card, SKY_PALE, SKY_DEEP, btnPrim, btnSec } = theme;
    const [r, setR] = useState(null);
    const cerrar = useRef(onClose);
    cerrar.current = onClose;

    useEffect(() => {
        api.get(`/caja/sesiones/${sesionId}/reporte`)
            .then(({ data }) => setR(data))
            .catch(err => { toast.error(err.response?.data?.error || 'No se pudo cargar el reporte.'); cerrar.current(); });
    }, [sesionId]);

    const seccion = { border: `1px solid ${bdr}`, borderRadius: 12, overflow: 'hidden', background: card, marginBottom: 16 };
    const titulo = (t, extra) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 16px 8px', flexWrap: 'wrap' }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.18em', color: SKY_DEEP }}>{t}</p>
            {extra}
        </div>
    );
    const th = (cols) => <thead><tr style={{ background: SKY_PALE }}>{cols.map(([h, der]) => <th key={h} style={{ color: SKY_DEEP, textAlign: der ? 'right' : 'left' }}>{h}</th>)}</tr></thead>;
    const vacio = (n, texto) => <tr><td colSpan={n} style={{ color: mut, fontStyle: 'italic', textAlign: 'center' }}>{texto}</td></tr>;
    const totalFila = (n, et, valor) => (
        <tr style={{ background: SKY_PALE }}><td colSpan={n - 1} style={{ color: txt, fontWeight: 700, textAlign: 'right' }}>{et}</td><td style={{ color: txt, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{valor}</td></tr>
    );
    const der = { textAlign: 'right', whiteSpace: 'nowrap' };
    // Tablas de 2-3 columnas: sin el ancho minimo de las tablas grandes del panel.
    const compacta = { minWidth: 0 };

    if (!r) {
        return (
            <Modal theme={theme} etiqueta="CAJA · REPORTE" titulo={`Caja #${sesionId}`} onClose={onClose} ancho={1100}>
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 30, textAlign: 'center' }}>Cargando reporte...</p>
            </Modal>
        );
    }
    const s = r.sesion;

    return (
        <Modal theme={theme} etiqueta={`CAJA · ${r.cerrada ? 'REPORTE DE CIERRE' : 'REPORTE PRELIMINAR'}`} titulo={`Caja #${s.id}`} onClose={onClose} ancho={1100}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: txtSf, display: 'flex', gap: '4px 18px', flexWrap: 'wrap' }}>
                    <span><Badge color={r.cerrada ? VERDE : AMBAR}>{r.cerrada ? 'CERRADA' : 'ABIERTA'}</Badge></span>
                    <span>Sucursal: <strong style={{ color: txt }}>{s.sucursal_nombre || 'General'}</strong></span>
                    <span>Cajero: <strong style={{ color: txt }}>{s.cajero_nombre}</strong></span>
                    <span>Apertura: {fechaHora(s.fecha_apertura)} · {s.usuario_apertura_nombre}</span>
                    {r.cerrada && <span>Cierre: {fechaHora(s.fecha_cierre)} · {s.usuario_cierre_nombre}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={btnSec} onClick={() => imprimirPdfCaja(s.id)}>IMPRIMIR</button>
                    <button type="button" style={btnPrim} onClick={() => descargarArchivo(`/caja/sesiones/${s.id}/pdf`, `cierre-caja-${s.id}.pdf`)}>DESCARGAR PDF</button>
                </div>
            </div>

            <SeccionApertura theme={theme} r={r} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
                <SeccionIngresosSistema theme={theme} r={r} />
                <SeccionEfectivo theme={theme} r={r} Diferencia={Diferencia} />
            </div>

            <div style={seccion}>
                {titulo('CUADRE POR FORMA DE PAGO (SISTEMA vs. CAJERO)')}
                <div className="prov-table-wrap"><table className="prov-table">
                    {th([['Forma'], ['Sistema', 1], ['Declarado por el cajero', 1], ['Diferencia', 1]])}
                    <tbody>
                        {r.formas.filter(f => f.codigo === 'efectivo' || f.sistema || f.declarado).map(f => (
                            <tr key={f.codigo}>
                                <td style={{ color: txt }}>{f.nombre}</td>
                                <td style={{ ...der, color: txtSf }}>{dinero(f.sistema)}</td>
                                <td style={{ ...der, color: txt, fontWeight: 600 }}>{r.cerrada ? dinero(f.declarado) : '—'}</td>
                                <td style={der}>{r.cerrada ? <Diferencia valor={f.diferencia} /> : '—'}</td>
                            </tr>
                        ))}
                        {r.retenciones.filter(x => x.declarado).map(x => (
                            <tr key={x.codigo}><td style={{ color: txt }}>{x.nombre}</td><td style={{ ...der, color: mut }}>—</td><td style={{ ...der, color: txt, fontWeight: 600 }}>{dinero(x.declarado)}</td><td style={{ ...der, color: mut, fontSize: '.78rem' }}>Documento recibido</td></tr>
                        ))}
                    </tbody>
                </table></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
                <SeccionDocumentos theme={theme} r={r} />
                <div style={seccion}>
                    {titulo('RESUMEN POR VENDEDOR')}
                    <table className="prov-table" style={compacta}>
                        {th([['Vendedor'], ['Ventas', 1], ['Valor', 1]])}
                        <tbody>
                            {r.por_vendedor.length === 0 && vacio(3, 'No hubo ventas en esta caja.')}
                            {r.por_vendedor.map(v => <tr key={v.vendedor}><td style={{ color: txt }}>{v.vendedor}</td><td style={{ ...der, color: mut }}>{v.cantidad}</td><td style={{ ...der, color: txt, fontWeight: 600 }}>{dinero(v.total)}</td></tr>)}
                        </tbody>
                    </table>
                </div>
            </div>

            <SeccionPorCobrar theme={theme} r={r} />
            <SeccionManuales theme={theme} r={r} />
            <SeccionIngresosEgresos theme={theme} r={r} />

            <div style={seccion}>
                {titulo('VENTAS DE LA CAJA', <Badge color={SKY_DEEP}>{dinero(r.totales.ventas)} FACTURADO</Badge>)}
                <div className="prov-table-wrap"><table className="prov-table">
                    {th([['Fecha'], ['Cliente'], ['Documento'], ['Total', 1], ['Pagos / pendiente'], ['Vendedor']])}
                    <tbody>
                        {r.ventas.length === 0 && vacio(6, 'No hubo ventas en esta caja.')}
                        {r.ventas.map((v, i) => (
                            <tr key={`${v.tipo}${v.cuenta_id || v.factura_id}${i}`}>
                                <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(v.momento)}</td>
                                <td style={{ color: txt }}>{v.cliente}</td>
                                <td style={{ color: txt }}>{v.tipo}<div style={{ fontSize: '.72rem', color: mut }}>{v.numero}{v.referencia ? ` · ${v.referencia}` : ''}</div></td>
                                <td style={{ ...der, fontWeight: 700, color: v.total < 0 ? ROJO : txt }}>{dinero(v.total)}</td>
                                <td style={{ fontSize: '.8rem', color: txtSf }}>
                                    {v.pagos.map((p, k) => <div key={k}>• {NOMBRE_FORMA[p.forma] || p.forma}: {dinero(p.monto)}</div>)}
                                    {v.pendiente > 0 && <div style={{ color: ROJO, fontWeight: 600 }}>Pendiente: {dinero(v.pendiente)}</div>}
                                    {v.pendiente === 0 && v.pagos.length > 0 && <div style={{ color: VERDE }}>Pagado</div>}
                                    {v.pendiente === null && <span style={{ color: mut }}>—</span>}
                                </td>
                                <td style={{ color: mut, fontSize: '.8rem' }}>{v.vendedor}</td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            </div>

            <div style={seccion}>
                {titulo('VENTAS 100 % A CRÉDITO (SIN ABONO)')}
                <div className="prov-table-wrap"><table className="prov-table">
                    {th([['Fecha'], ['Vence'], ['Cliente'], ['Documento'], ['Vendedor'], ['Total', 1]])}
                    <tbody>
                        {r.ventas_credito.length === 0 && vacio(6, 'No hubo ventas a crédito puro.')}
                        {r.ventas_credito.map(v => (
                            <tr key={v.cuenta_id}><td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(v.momento)}</td><td style={{ color: txtSf }}>{v.vencimiento || '—'}</td><td style={{ color: txt }}>{v.cliente}</td><td style={{ color: txt }}>{v.numero}</td><td style={{ color: mut, fontSize: '.8rem' }}>{v.vendedor}</td><td style={{ ...der, fontWeight: 600, color: txt }}>{dinero(v.total)}</td></tr>
                        ))}
                        {r.ventas_credito.length > 0 && totalFila(6, 'SUBTOTAL CRÉDITO PURO', dinero(r.totales.credito_puro))}
                    </tbody>
                </table></div>
            </div>

            <div style={seccion}>
                {titulo('RECAUDACIONES (COBROS DE DEUDAS ANTERIORES)')}
                <div className="prov-table-wrap"><table className="prov-table">
                    {th([['Fecha cobro'], ['Cliente'], ['Documento'], ['Total doc.', 1], ['Forma'], ['Cobrado', 1]])}
                    <tbody>
                        {r.recaudaciones.length === 0 && vacio(6, 'No hubo recaudaciones de deudas anteriores.')}
                        {r.recaudaciones.map(x => (
                            <tr key={x.id}><td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(x.momento)}</td><td style={{ color: txt }}>{x.cliente}</td><td style={{ color: txt }}>{x.documento}</td><td style={{ ...der, color: txtSf }}>{dinero(x.total_documento)}</td><td style={{ color: txtSf }}>{NOMBRE_FORMA[x.forma] || x.forma}</td><td style={{ ...der, fontWeight: 600, color: VERDE }}>{dinero(x.cobrado)}</td></tr>
                        ))}
                        {r.recaudaciones.length > 0 && totalFila(6, 'TOTAL RECAUDADO', dinero(r.totales.recaudado))}
                    </tbody>
                </table></div>
            </div>

            <div style={seccion}>
                {titulo('ANTICIPOS DE CLIENTES')}
                <div className="prov-table-wrap"><table className="prov-table">
                    {th([['Fecha'], ['Detalle'], ['Forma'], ['Registró'], ['Valor', 1]])}
                    <tbody>
                        {r.anticipos.length === 0 && vacio(5, 'No hubo anticipos registrados en esta caja.')}
                        {r.anticipos.map(a => (
                            <tr key={a.id}><td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(a.momento)}</td><td style={{ color: txt }}>{a.descripcion}</td><td style={{ color: txtSf }}>{NOMBRE_FORMA[a.forma] || a.forma}</td><td style={{ color: mut, fontSize: '.8rem' }}>{a.registrado_por}</td><td style={{ ...der, fontWeight: 600, color: VERDE }}>{dinero(a.monto)}</td></tr>
                        ))}
                        {r.anticipos.length > 0 && totalFila(5, 'TOTAL ANTICIPOS', dinero(r.totales.anticipos))}
                    </tbody>
                </table></div>
            </div>

            {r.reaperturas.length > 0 && (
                <div style={{ ...seccion, borderColor: `${AMBAR}66` }}>
                    {titulo('REAPERTURAS')}
                    <div className="prov-table-wrap"><table className="prov-table">
                        {th([['Reabierta'], ['Por'], ['Motivo'], ['Cierre anterior', 1]])}
                        <tbody>
                            {r.reaperturas.map((x, i) => (
                                <tr key={i}><td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(x.reabierta_at)}</td><td style={{ color: txt }}>{x.reabierta_por_nombre || `Usuario #${x.reabierta_por}`}</td><td style={{ color: txtSf }}>{x.motivo}</td>
                                    <td style={der}>{dinero(x.cierre?.monto_cierre_real)} · <Diferencia valor={x.cierre?.diferencia} /></td></tr>
                            ))}
                        </tbody>
                    </table></div>
                </div>
            )}

            {(s.notas_apertura || s.notas_cierre) && (
                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf }}>
                    {s.notas_apertura && <>Notas de apertura: {s.notas_apertura}<br /></>}
                    {s.notas_cierre && <>Notas de cierre: {s.notas_cierre}</>}
                </p>
            )}
        </Modal>
    );
}
