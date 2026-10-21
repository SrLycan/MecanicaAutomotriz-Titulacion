/**
 * SS SWAP - Secciones del reporte de caja (Sprint 29)
 * Se usan en el reporte (ver caja) y en la ventana de cierre, para que al
 * cerrar se vea lo mismo que despues sale en el PDF: con cuanto y como se
 * abrio, ingresos y egresos, lo cobrado por forma de pago, lo que queda por
 * cobrar, documentos y movimientos manuales.
 */
import React from 'react';
import { dinero, VERDE, ROJO, AMBAR } from '../finanzas/tema';
import { Badge } from '../finanzas/Modales';
import { fechaHora, NOMBRE_FORMA } from './comunes';

const der = { textAlign: 'right', whiteSpace: 'nowrap' };
// Tablas de 2-4 columnas: sin el ancho minimo de las tablas grandes del panel.
const compacta = { minWidth: 0 };
const etiquetaBillete = (v) => (v >= 1 ? `$${v}` : `${Math.round(v * 100)}¢`);

/** Tarjeta con titulo para cada seccion. */
export function Seccion({ theme, titulo, extra, children, color }) {
    const { bdr, card, SKY_DEEP } = theme;
    return (
        <div style={{ border: `1px solid ${color ? `${color}66` : bdr}`, borderRadius: 12, overflow: 'hidden', background: card, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 16px 8px', flexWrap: 'wrap' }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.18em', color: color || SKY_DEEP }}>{titulo}</p>
                {extra}
            </div>
            {children}
        </div>
    );
}

function Cabecera({ theme, cols }) {
    const { SKY_PALE, SKY_DEEP } = theme;
    return <thead><tr style={{ background: SKY_PALE }}>{cols.map(([h, d]) => <th key={h} style={{ color: SKY_DEEP, textAlign: d ? 'right' : 'left' }}>{h}</th>)}</tr></thead>;
}
const Vacio = ({ theme, n, texto }) => <tr><td colSpan={n} style={{ color: theme.mut, fontStyle: 'italic', textAlign: 'center' }}>{texto}</td></tr>;
const FilaTotal = ({ theme, n, et, valor, color }) => (
    <tr style={{ background: theme.SKY_PALE }}>
        <td colSpan={n - 1} style={{ color: theme.txt, fontWeight: 700, textAlign: 'right' }}>{et}</td>
        <td style={{ ...der, color: color || theme.txt, fontWeight: 700 }}>{valor}</td>
    </tr>
);
const TipoMov = ({ tipo, anulado, mut }) => (anulado
    ? <Badge color={mut}>ANULADO</Badge>
    : <Badge color={tipo === 'ingreso' ? VERDE : ROJO}>{tipo === 'ingreso' ? 'INGRESO' : 'EGRESO'}</Badge>);

/** Con cuanto se abrio y en que (billetes y monedas). */
export function SeccionApertura({ theme, r }) {
    const { txt, txtSf, mut } = theme;
    const a = r.apertura;
    const cierre = r.conteo_cierre || [];
    const ap = new Map(a.conteo.map(c => [c.valor, c]));
    const ci = new Map(cierre.map(c => [c.valor, c]));
    const valores = [...new Set([...ap.keys(), ...ci.keys()])].sort((x, y) => y - x);
    return (
        <Seccion theme={theme} titulo={cierre.length ? 'APERTURA Y CONTEO DE EFECTIVO' : 'APERTURA DE LA CAJA'} extra={<Badge color={theme.SKY_DEEP}>{dinero(a.monto)} EN EFECTIVO</Badge>}>
            <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf, padding: '0 16px 10px' }}>
                Abierta el {fechaHora(r.sesion.fecha_apertura)} por <strong style={{ color: txt }}>{a.usuario}</strong>
                {a.contada ? ' · contada por billetes y monedas.' : ' · monto escrito a mano (sin conteo de billetes y monedas).'}
                {a.notas ? ` Nota: ${a.notas}` : ''}
            </p>
            {(a.conteo.length > 0 || cierre.length > 0) && (
                <div className="prov-table-wrap" style={{ borderRadius: 0 }}><table className="prov-table" style={compacta}>
                    <Cabecera theme={theme} cols={[['Billete / moneda'], ['Apertura (cant.)', 1], ['Apertura', 1], ...(cierre.length ? [['Cierre (cant.)', 1], ['Cierre', 1]] : [])]} />
                    <tbody>
                        {valores.map(v => {
                            const x = ap.get(v); const c = ci.get(v);
                            return (
                                <tr key={v}>
                                    <td style={{ color: txt }}>{etiquetaBillete(v)}</td>
                                    <td style={{ ...der, color: mut }}>{x ? x.cantidad : '—'}</td>
                                    <td style={{ ...der, color: txt, fontWeight: 600 }}>{x ? dinero(x.subtotal) : '—'}</td>
                                    {cierre.length > 0 && <td style={{ ...der, color: mut }}>{c ? c.cantidad : '—'}</td>}
                                    {cierre.length > 0 && <td style={{ ...der, color: txt, fontWeight: 600 }}>{c ? dinero(c.subtotal) : '—'}</td>}
                                </tr>
                            );
                        })}
                        <tr style={{ background: theme.SKY_PALE }}>
                            <td style={{ color: txt, fontWeight: 700 }}>TOTAL</td><td />
                            <td style={{ ...der, color: txt, fontWeight: 700 }}>{dinero(a.monto)}</td>
                            {cierre.length > 0 && <><td /><td style={{ ...der, color: txt, fontWeight: 700 }}>{dinero(r.efectivo.contado)}</td></>}
                        </tr>
                    </tbody>
                </table></div>
            )}
        </Seccion>
    );
}

/** Cobros + anticipos por forma de pago y lo que quedo por cobrar (credito). */
export function SeccionIngresosSistema({ theme, r }) {
    const { txt, mut } = theme;
    const total = r.ingresos_sistema.reduce((a, f) => a + f.total, 0);
    return (
        <Seccion theme={theme} titulo="INGRESOS DEL SISTEMA (PAGOS + ANTICIPOS)" extra={<Badge color={VERDE}>{dinero(r.totales.dinero_recibido)} RECIBIDO</Badge>}>
            <table className="prov-table" style={compacta}>
                <Cabecera theme={theme} cols={[['Forma de pago'], ['Cant.', 1], ['Valor', 1]]} />
                <tbody>
                    {r.ingresos_sistema.map(f => {
                        const credito = f.forma === 'credito';
                        return (
                            <tr key={f.forma}>
                                <td style={{ color: credito ? ROJO : txt, fontWeight: credito ? 600 : 400 }}>{f.nombre}</td>
                                <td style={{ ...der, color: mut }}>{f.cantidad}</td>
                                <td style={{ ...der, color: credito ? ROJO : txt, fontWeight: 600 }}>{dinero(f.total)}</td>
                            </tr>
                        );
                    })}
                    <FilaTotal theme={theme} n={3} et="TOTAL" valor={dinero(total)} />
                </tbody>
            </table>
        </Seccion>
    );
}

/** Documentos de venta de la caja. */
export function SeccionDocumentos({ theme, r }) {
    const { txt, mut } = theme;
    return (
        <Seccion theme={theme} titulo="RESUMEN POR DOCUMENTOS">
            <table className="prov-table" style={compacta}>
                <Cabecera theme={theme} cols={[['Documento'], ['Cant.', 1], ['Valor', 1]]} />
                <tbody>
                    {r.documentos.length === 0 && <Vacio theme={theme} n={3} texto="No hubo ventas en esta caja." />}
                    {r.documentos.map(d => <tr key={d.tipo}><td style={{ color: txt }}>{d.tipo}</td><td style={{ ...der, color: mut }}>{d.cantidad}</td><td style={{ ...der, color: txt, fontWeight: 600 }}>{dinero(d.total)}</td></tr>)}
                    {r.documentos.length > 0 && <FilaTotal theme={theme} n={3} et="TOTAL VENTAS" valor={dinero(r.totales.ventas)} />}
                </tbody>
            </table>
        </Seccion>
    );
}

/** Ventas de esta caja que todavia tienen saldo (proformas aprobadas sin pagar, pagares con abono parcial...). */
export function SeccionPorCobrar({ theme, r }) {
    const { txt, txtSf, mut } = theme;
    return (
        <Seccion theme={theme} titulo="POR COBRAR (VENTAS DE ESTA CAJA CON SALDO)" color={r.por_cobrar.length ? ROJO : undefined}
            extra={<Badge color={r.totales.por_cobrar > 0 ? ROJO : VERDE}>{dinero(r.totales.por_cobrar)} PENDIENTE</Badge>}>
            <div className="prov-table-wrap"><table className="prov-table">
                <Cabecera theme={theme} cols={[['Fecha'], ['Cliente'], ['Documento'], ['Total', 1], ['Abonado', 1], ['Por cobrar', 1]]} />
                <tbody>
                    {r.por_cobrar.length === 0 && <Vacio theme={theme} n={6} texto="Todo lo vendido en esta caja está cobrado." />}
                    {r.por_cobrar.map((v, i) => (
                        <tr key={`${v.tipo}${v.cuenta_id || v.proforma_id}${i}`}>
                            <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(v.momento)}</td>
                            <td style={{ color: txt }}>{v.cliente}</td>
                            <td style={{ color: txt }}>{v.numero}<div style={{ fontSize: '.72rem', color: mut }}>{v.referencia}</div></td>
                            <td style={{ ...der, color: txtSf }}>{dinero(v.total)}</td>
                            <td style={{ ...der, color: v.pagado > 0 ? VERDE : mut }}>{dinero(v.pagado || 0)}</td>
                            <td style={{ ...der, color: ROJO, fontWeight: 700 }}>{dinero(v.pendiente)}</td>
                        </tr>
                    ))}
                    {r.por_cobrar.length > 0 && <FilaTotal theme={theme} n={6} et="TOTAL POR COBRAR" valor={dinero(r.totales.por_cobrar)} color={ROJO} />}
                </tbody>
            </table></div>
        </Seccion>
    );
}

/** Entradas y salidas manuales de la caja, diciendo si fueron ingreso o egreso. */
export function SeccionManuales({ theme, r, onAnular }) {
    const { txt, txtSf, mut } = theme;
    return (
        <Seccion theme={theme} titulo="MOVIMIENTOS MANUALES" extra={<span style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: txtSf }}>
            Ingresos <strong style={{ color: VERDE }}>{dinero(r.totales.manuales_ingresos)}</strong> · Egresos <strong style={{ color: ROJO }}>{dinero(r.totales.manuales_egresos)}</strong></span>}>
            <div className="prov-table-wrap"><table className="prov-table">
                <Cabecera theme={theme} cols={[['Fecha'], ['Tipo'], ['Detalle'], ['Registró'], ['Valor', 1], ...(onAnular ? [['']] : [])]} />
                <tbody>
                    {r.movimientos_manuales.length === 0 && <Vacio theme={theme} n={onAnular ? 6 : 5} texto="No hubo entradas ni salidas manuales." />}
                    {r.movimientos_manuales.map(m => (
                        <tr key={m.id} style={{ opacity: m.anulado_at ? .6 : 1 }}>
                            <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(m.created_at)}</td>
                            <td><TipoMov tipo={m.tipo} anulado={m.anulado_at} mut={mut} /></td>
                            <td style={{ color: txt }}>{m.concepto}{m.anulado_at && <div style={{ fontSize: '.72rem', color: mut }}>Anulado por {m.anulado_por_nombre}: {m.motivo_anulacion}</div>}</td>
                            <td style={{ color: mut, fontSize: '.8rem' }}>{m.usuario_nombre}</td>
                            <td style={{ ...der, fontWeight: 600, color: m.anulado_at ? mut : m.tipo === 'ingreso' ? VERDE : ROJO, textDecoration: m.anulado_at ? 'line-through' : 'none' }}>{m.tipo === 'ingreso' ? '+' : '−'}{dinero(m.monto)}</td>
                            {onAnular && <td style={{ textAlign: 'right' }}>{!m.anulado_at && (
                                <button type="button" onClick={() => onAnular(m)} style={{ fontFamily: "'Bebas Neue'", fontSize: '.66rem', letterSpacing: '.12em', background: 'none', border: `1px solid ${ROJO}55`, color: ROJO, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>ANULAR</button>
                            )}</td>}
                        </tr>
                    ))}
                </tbody>
            </table></div>
        </Seccion>
    );
}

/** Todo el dinero que entro y salio en el periodo, por forma de pago y en detalle. */
export function SeccionIngresosEgresos({ theme, r, detalle = true }) {
    const { txt, txtSf, mut, bdr } = theme;
    return (
        <Seccion theme={theme} titulo="INGRESOS Y EGRESOS DEL PERIODO (TODAS LAS FORMAS DE PAGO)" extra={<span style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: txtSf }}>
            Ingresos <strong style={{ color: VERDE }}>{dinero(r.totales.ingresos_periodo)}</strong> · Egresos <strong style={{ color: ROJO }}>{dinero(r.totales.egresos_periodo)}</strong></span>}>
            <table className="prov-table" style={compacta}>
                <Cabecera theme={theme} cols={[['Forma de pago'], ['Ingresos', 1], ['Egresos', 1], ['Neto', 1]]} />
                <tbody>
                    {r.resumen_dinero.length === 0 && <Vacio theme={theme} n={4} texto="No entró ni salió dinero en este periodo." />}
                    {r.resumen_dinero.map(f => (
                        <tr key={f.forma}>
                            <td style={{ color: txt }}>{f.nombre}</td>
                            <td style={{ ...der, color: f.ingresos ? VERDE : mut }}>{f.ingresos ? '+' : ''}{dinero(f.ingresos)}</td>
                            <td style={{ ...der, color: f.egresos ? ROJO : mut }}>{f.egresos ? '−' : ''}{dinero(f.egresos)}</td>
                            <td style={{ ...der, color: txt, fontWeight: 600 }}>{dinero(f.ingresos - f.egresos)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {detalle && r.movimientos_dinero.length > 0 && (
                <div className="prov-table-wrap" style={{ borderTop: `1px solid ${bdr}`, borderRadius: 0 }}><table className="prov-table">
                    <Cabecera theme={theme} cols={[['Fecha'], ['Tipo'], ['Detalle'], ['Categoría'], ['Forma'], ['Valor', 1]]} />
                    <tbody>
                        {r.movimientos_dinero.map(m => (
                            <tr key={`${m.origen}${m.origen_id}`}>
                                <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(m.momento)}</td>
                                <td><TipoMov tipo={m.tipo} mut={mut} /></td>
                                <td style={{ color: txt }}>{m.descripcion}{m.tercero && <div style={{ fontSize: '.72rem', color: mut }}>{m.tercero}</div>}</td>
                                <td style={{ color: mut, fontSize: '.8rem' }}>{m.categoria}</td>
                                <td style={{ color: txtSf, fontSize: '.82rem' }}>{NOMBRE_FORMA[m.forma] || m.forma}</td>
                                <td style={{ ...der, fontWeight: 600, color: m.tipo === 'ingreso' ? VERDE : ROJO }}>{m.tipo === 'ingreso' ? '+' : '−'}{dinero(m.monto)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            )}
        </Seccion>
    );
}

/** Cuadre de efectivo: fondo + entradas - salidas = esperado, contra lo entregado. */
export function SeccionEfectivo({ theme, r, Diferencia }) {
    const { txt, txtSf } = theme;
    const e = r.efectivo;
    const linea = (et, v, color, fuerte) => (
        <tr><td style={{ color: fuerte ? txt : txtSf, fontWeight: fuerte ? 700 : 400 }}>{et}</td><td style={{ ...der, color: color || txt, fontWeight: 600 }}>{v}</td></tr>
    );
    return (
        <Seccion theme={theme} titulo="CIERRE FINAL (EFECTIVO)">
            <table className="prov-table" style={compacta}><tbody>
                {linea('Fondo inicial de caja', dinero(e.apertura))}
                {linea('(+) Entradas de efectivo', dinero(e.ingresos), VERDE)}
                {linea('(−) Salidas de efectivo', dinero(e.egresos), ROJO)}
                {linea('(=) Esperado en caja', dinero(e.esperado), AMBAR, true)}
                {linea('Efectivo entregado', r.cerrada ? dinero(e.contado) : 'Pendiente')}
                <tr><td style={{ color: txt, fontWeight: 700 }}>Diferencia (faltante / sobrante)</td><td style={der}>{r.cerrada ? <Diferencia valor={e.diferencia} /> : '—'}</td></tr>
            </tbody></table>
        </Seccion>
    );
}
