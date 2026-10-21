/**
 * SS SWAP - Cierre de caja (reporte de cuadre)
 * Izquierda: lo que dice el sistema (apertura + entradas - salidas) y la
 * declaración del cajero por cada forma de pago que no es efectivo
 * (cheques, transferencias, tarjetas) más las retenciones recibidas.
 * Derecha: conteo de billetes y monedas = efectivo entregado.
 * Arriba, el resumen de la caja (igual que el reporte): con cuanto y como se
 * abrio, ingresos del sistema con lo que queda por cobrar, documentos,
 * ventas con saldo, movimientos manuales (ingreso / egreso) e ingresos y
 * egresos del periodo por forma de pago.
 */
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { dinero, VERDE, ROJO, AMBAR } from '../finanzas/tema';
import { Modal } from '../finanzas/Modales';
import ConteoEfectivo, { totalConteo, conteoParaBackend, conteoVacio } from '../finanzas/ConteoEfectivo';
import { Diferencia } from './comunes';
import { SeccionApertura, SeccionIngresosSistema, SeccionDocumentos, SeccionPorCobrar, SeccionManuales, SeccionIngresosEgresos } from './Secciones';

const FORMAS = [
    { codigo: 'cheque', nombre: 'Cheques' },
    { codigo: 'transferencia', nombre: 'Transferencias' },
    { codigo: 'tarjeta_credito', nombre: 'Tarjeta de crédito' },
    { codigo: 'tarjeta_debito', nombre: 'Tarjeta de débito' },
    { codigo: 'otro', nombre: 'Otros medios' },
];
const RETENCIONES = [
    { codigo: 'retencion_fuente', nombre: 'Retención en la fuente (−)' },
    { codigo: 'retencion_iva', nombre: 'Retención del IVA (−)' },
];
const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100;

export default function ModalCierre({ theme, estado, onClose, onGuardado }) {
    const { labelSt, inputSt, mut, bdr, txt, txtSf, btnPrim, SKY_PALE, SKY_DEEP, inputBg } = theme;
    const { sesion, totales, por_metodo: porMetodo = {} } = estado;
    const esperado = Number(totales.saldo) || 0;
    const [conteo, setConteo] = useState({});
    const [declaracion, setDeclaracion] = useState({});
    const [notas, setNotas] = useState('');
    const [saving, setSaving] = useState(false);
    const [reporte, setReporte] = useState(null);
    useEffect(() => {
        api.get(`/caja/sesiones/${sesion.id}/reporte`).then(({ data }) => setReporte(data))
            .catch(() => toast.error('No se pudo cargar el resumen de la caja; igual puedes cerrarla.'));
    }, [sesion.id]);
    const contado = totalConteo(conteo);
    const vacio = conteoVacio(conteo);
    const dif = centavos(contado - esperado);
    const sistemaDe = (codigo) => centavos(porMetodo[codigo]?.ingresos || 0);
    const difFormas = FORMAS.filter(f => declaracion[f.codigo] !== undefined && declaracion[f.codigo] !== '')
        .map(f => centavos(Number(declaracion[f.codigo]) - sistemaDe(f.codigo)))
        .filter(d => Math.abs(d) >= 0.005);
    const faltaDeclarar = FORMAS.filter(f => sistemaDe(f.codigo) > 0 && (declaracion[f.codigo] === undefined || declaracion[f.codigo] === ''));

    const submit = async (e) => {
        e.preventDefault();
        if (vacio && !window.confirm('No contaste ningún billete ni moneda. ¿Cerrar la caja con $0.00 en efectivo?')) return;
        if (faltaDeclarar.length && !window.confirm(`No declaraste: ${faltaDeclarar.map(f => f.nombre).join(', ')}. Se tomará como $0.00. ¿Cerrar de todas formas?`)) return;
        setSaving(true);
        try {
            const decl = Object.fromEntries(Object.entries(declaracion).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => [k, Number(v)]));
            await api.post('/caja/cierre', { monto_cierre_real: contado, denominaciones: conteoParaBackend(conteo), declaracion: decl, notas_cierre: notas });
            toast.success('Caja cerrada.');
            onGuardado(); onClose();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo cerrar la caja.'); }
        finally { setSaving(false); }
    };

    const th = { padding: '10px 12px', fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', color: SKY_DEEP, background: SKY_PALE, textAlign: 'left' };
    const td = { padding: '8px 12px', borderTop: `1px solid ${bdr}`, fontFamily: "'Outfit'", fontSize: '.86rem', color: txtSf };
    const val = { ...td, textAlign: 'right', fontWeight: 600, color: txt, whiteSpace: 'nowrap' };
    const input = { width: 96, boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.9rem', textAlign: 'right', outline: 'none' };
    const setDecl = (k, v) => setDeclaracion(d => ({ ...d, [k]: v.replace(/[^0-9.]/g, '') }));
    const filas = [
        { d: 'Monto apertura en efectivo (+)', v: Number(sesion.monto_apertura) },
        { d: 'Entradas en efectivo (+)', v: Number(totales.ingresos), color: VERDE },
        { d: 'Salidas en efectivo (−)', v: -Number(totales.egresos), color: ROJO },
    ];

    return (
        <Modal theme={theme} etiqueta="CAJA · REPORTE DE CUADRE" titulo={`Cerrar caja #${sesion.id}`} onClose={onClose} ancho={1040}>
            <form onSubmit={submit}>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf, marginBottom: 14 }}>
                    Cajero: <strong style={{ color: txt }}>{sesion.cajero_nombre}</strong>{sesion.sucursal_nombre ? ` · ${sesion.sucursal_nombre}` : ''}
                </p>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.95rem', letterSpacing: '.16em', color: SKY_DEEP, marginBottom: 10 }}>1 · RESUMEN DE LA CAJA</p>
                {!reporte ? (
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginBottom: 16 }}>Cargando resumen...</p>
                ) : (
                    <>
                        <SeccionApertura theme={theme} r={reporte} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
                            <SeccionIngresosSistema theme={theme} r={reporte} />
                            <SeccionDocumentos theme={theme} r={reporte} />
                        </div>
                        <SeccionPorCobrar theme={theme} r={reporte} />
                        <SeccionManuales theme={theme} r={reporte} />
                        <SeccionIngresosEgresos theme={theme} r={reporte} detalle={false} />
                    </>
                )}
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.95rem', letterSpacing: '.16em', color: SKY_DEEP, margin: '6px 0 10px' }}>2 · CUADRE Y CONTEO</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 18, alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Efectivo según el sistema */}
                        <div style={{ border: `1px solid ${bdr}`, borderRadius: 12, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr><th style={th}>Efectivo</th><th style={{ ...th, textAlign: 'right' }}>Valor</th></tr></thead>
                                <tbody>
                                    {filas.map(f => <tr key={f.d}><td style={td}>{f.d}</td><td style={{ ...val, color: f.color || txt }}>{dinero(f.v)}</td></tr>)}
                                    <tr>
                                        <td style={{ ...td, fontWeight: 700, color: txt, background: SKY_PALE }}>Debería haber en caja (=)</td>
                                        <td style={{ ...val, background: SKY_PALE, fontFamily: "'Bebas Neue'", fontSize: '1.35rem', color: AMBAR }}>{dinero(esperado)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Declaración por forma de pago */}
                        <div style={{ border: `1px solid ${bdr}`, borderRadius: 12, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr><th style={th}>Otras formas de pago</th><th style={{ ...th, textAlign: 'right' }}>Sistema</th><th style={{ ...th, textAlign: 'right' }}>Declarado</th><th style={{ ...th, textAlign: 'right' }}>Dif.</th></tr></thead>
                                <tbody>
                                    {FORMAS.map(f => {
                                        const sis = sistemaDe(f.codigo);
                                        const tiene = declaracion[f.codigo] !== undefined && declaracion[f.codigo] !== '';
                                        return (
                                            <tr key={f.codigo}>
                                                <td style={td}>{f.nombre} (+)</td>
                                                <td style={{ ...val, color: sis ? txt : mut }}>{dinero(sis)}</td>
                                                <td style={{ ...td, textAlign: 'right' }}>
                                                    <input inputMode="decimal" aria-label={`Declarado en ${f.nombre}`} placeholder="0.00" value={declaracion[f.codigo] ?? ''} onChange={e => setDecl(f.codigo, e.target.value)} style={input} />
                                                </td>
                                                <td style={{ ...td, textAlign: 'right', fontSize: '.8rem' }}>{tiene || sis ? <Diferencia valor={centavos((Number(declaracion[f.codigo]) || 0) - sis)} /> : '—'}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr><td colSpan={4} style={{ ...td, fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.14em', color: mut, paddingTop: 12 }}>RETENCIONES RECIBIDAS (DOCUMENTOS DEL CLIENTE)</td></tr>
                                    {RETENCIONES.map(r => (
                                        <tr key={r.codigo}>
                                            <td style={td} colSpan={2}>{r.nombre}</td>
                                            <td style={{ ...td, textAlign: 'right' }}>
                                                <input inputMode="decimal" aria-label={r.nombre} placeholder="0.00" value={declaracion[r.codigo] ?? ''} onChange={e => setDecl(r.codigo, e.target.value)} style={input} />
                                            </td>
                                            <td style={{ ...td, textAlign: 'right', color: mut, fontSize: '.74rem' }}>Informativo</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Lo que se cuenta */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <ConteoEfectivo theme={theme} conteo={conteo} onChange={setConteo} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', border: `1px solid ${bdr}`, borderRadius: 12, padding: '12px 14px' }}>
                            <div>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.16em', color: mut }}>EFECTIVO ENTREGADO</p>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2rem', lineHeight: 1, color: vacio ? mut : Math.abs(dif) < 0.005 ? VERDE : dif > 0 ? AMBAR : ROJO }}>{dinero(contado)}</p>
                            </div>
                            {!vacio && <div style={{ fontFamily: "'Outfit'", fontSize: '.9rem' }}><Diferencia valor={dif} /></div>}
                        </div>
                        {difFormas.length > 0 && (
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: AMBAR }}>
                                Hay diferencias en otras formas de pago: quedan registradas en el reporte (no generan ajuste de caja).
                            </p>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: 16 }}>
                    <label style={labelSt}>NOTAS</label>
                    <input value={notas} onChange={e => setNotas(e.target.value)} style={inputSt} placeholder={!vacio && Math.abs(dif) >= 0.005 ? 'Explica la diferencia (opcional)' : ''} />
                </div>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginTop: 10 }}>
                    Si el efectivo no cuadra, la diferencia se registra como ajuste y el saldo de caja queda igual a lo contado.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, marginTop: 10, borderTop: `1px solid ${bdr}` }}>
                    <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                    <button type="submit" disabled={saving} style={{ ...btnPrim, background: `linear-gradient(135deg, #dc2626, ${ROJO})`, opacity: saving ? .6 : 1 }}>{saving ? 'CERRANDO...' : 'CERRAR CAJA'}</button>
                </div>
            </form>
        </Modal>
    );
}
