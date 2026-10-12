/**
 * SS SWAP - Portal del cliente: comprobantes electrónicos y documentos legales
 *
 *  - MisComprobantes: solo comprobantes AUTORIZADOS (o anulados) del propio
 *    cliente; RIDE y XML se descargan con la sesión (el backend comprueba que
 *    el comprobante sea suyo).
 *  - MisDocumentos: documentos por aceptar (nuevas versiones con cambios
 *    materiales), aceptaciones con su constancia y retiro de autorizaciones
 *    opcionales.
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LectorDocumento from '../legal/LectorDocumento';
import { descargar, dinero, fechaCorta, fechaHora } from '../../pages/facturacion/comun';

const txt = 'rgba(241,245,249,1)';
const mut = 'rgba(241,245,249,.55)';
const card = 'rgba(255,255,255,.04)';
const bdr = 'rgba(255,255,255,.08)';
const ACCENT = '#3b7bab';
const boton = { background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: '6px 12px', color: '#93c5fd', cursor: 'pointer', fontFamily: "'Outfit'", fontSize: '.8rem', fontWeight: 600 };

export function MisComprobantes() {
    const [lista, setLista] = useState(null);
    useEffect(() => { api.get('/panel/facturas').then(({ data }) => setLista(data.comprobantes)).catch(() => setLista([])); }, []);
    if (!lista) return <p style={{ color: mut }}>Cargando...</p>;
    if (!lista.length) return <p style={{ color: mut, padding: 30, textAlign: 'center' }}>Aún no tiene comprobantes electrónicos autorizados.</p>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 16px', background: card, border: `1px solid ${bdr}`, borderRadius: 12 }}>
                    <div>
                        <p style={{ color: txt, fontWeight: 600 }}>{c.cod_doc === '04' ? 'Nota de crédito' : 'Factura'} {c.numero}</p>
                        <p style={{ color: mut, fontSize: '.8rem' }}>
                            {fechaCorta(c.fecha_emision)} · {dinero(c.importe_total)}
                            {c.estado === 'anulado' && <span style={{ color: '#f87171' }}> · ANULADA</span>}
                            {Number(c.ambiente) === 1 && <span style={{ color: '#fbbf24' }}> · PRUEBAS (sin validez)</span>}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" style={boton} onClick={() => descargar(`/panel/facturas/${c.id}/ride`, `${c.numero}.pdf`)}>PDF (RIDE)</button>
                        <button type="button" style={boton} onClick={() => descargar(`/panel/facturas/${c.id}/xml`, `${c.numero}.xml`)}>XML</button>
                    </div>
                </div>
            ))}
            <p style={{ color: mut, fontSize: '.75rem', marginTop: 6 }}>Puede verificar la validez de cada comprobante en el portal del SRI con su clave de acceso.</p>
        </div>
    );
}

/** Documentos que el cliente debe volver a aceptar (para el aviso del portal). */
export function usePendientesLegales() {
    const [pend, setPend] = useState([]);
    const recargar = useCallback(() => api.get('/legal/pendientes').then(({ data }) => setPend(data.documentos || [])).catch(() => setPend([])), []);
    useEffect(() => { recargar(); }, [recargar]);
    return [pend, recargar];
}

export function MisDocumentos({ pendientes, onCambio }) {
    const [historial, setHistorial] = useState([]);
    const [marcados, setMarcados] = useState({});
    const [leyendo, setLeyendo] = useState(null);
    const cargar = useCallback(() => api.get('/legal/mis-aceptaciones').then(({ data }) => setHistorial(data.aceptaciones)).catch(() => {}), []);
    useEffect(() => { cargar(); }, [cargar]);

    const aceptar = async () => {
        const version_ids = pendientes.filter(d => marcados[d.version_id]).map(d => d.version_id);
        try {
            await api.post('/legal/aceptar', { version_ids, acepto: true });
            toast.success('Aceptación registrada.');
            setMarcados({});
            onCambio(); cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo registrar.'); }
    };
    const revocar = async (documento_id) => {
        try { await api.post('/legal/revocar', { documento_id }); toast.success('Autorización retirada.'); onCambio(); cargar(); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudo retirar.'); }
    };
    // Última acción por documento (para ofrecer retirar autorizaciones opcionales vigentes).
    const ultimos = [...new Map([...historial].reverse().map(h => [h.documento_id, h])).values()];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pendientes.length > 0 && (
                <div style={{ padding: 16, background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.35)', borderRadius: 12 }}>
                    <p style={{ color: txt, fontWeight: 600, marginBottom: 8 }}>Documentos actualizados que requieren su aceptación</p>
                    {pendientes.map(d => (
                        <label key={d.version_id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: txt, fontSize: '.86rem', marginBottom: 8, cursor: 'pointer' }}>
                            <input type="checkbox" checked={Boolean(marcados[d.version_id])} onChange={e => setMarcados({ ...marcados, [d.version_id]: e.target.checked })} style={{ marginTop: 3 }} />
                            <span>He leído y acepto <button type="button" onClick={(e) => { e.preventDefault(); setLeyendo(d); }} style={{ ...boton, padding: '0 4px', border: 'none' }}>{d.titulo}</button> (versión {d.version}){d.obligatorio ? '' : ' — opcional'}</span>
                        </label>
                    ))}
                    <button type="button" onClick={aceptar} disabled={!pendientes.some(d => marcados[d.version_id])}
                        style={{ ...boton, background: ACCENT, color: '#fff', border: 'none', padding: '9px 16px', opacity: pendientes.some(d => marcados[d.version_id]) ? 1 : 0.5 }}>REGISTRAR ACEPTACIÓN</button>
                </div>
            )}
            <div>
                <p style={{ color: txt, fontWeight: 600, marginBottom: 8 }}>Mis aceptaciones</p>
                {historial.length === 0 ? <p style={{ color: mut, fontSize: '.85rem' }}>Sin registros.</p> : historial.map((h, i) => (
                    <div key={`${h.transaccion_id}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: `1px solid ${bdr}`, fontSize: '.84rem', color: mut, flexWrap: 'wrap' }}>
                        <span><span style={{ color: txt }}>{h.titulo}</span> v{h.version} · {h.evento === 'revocacion' ? 'retirada' : 'aceptada'} el {fechaHora(h.aceptado_at)}</span>
                        <button type="button" style={boton} onClick={() => descargar(`/legal/constancias/${h.transaccion_id}`, 'constancia.pdf')}>Constancia</button>
                    </div>
                ))}
            </div>
            {ultimos.filter(h => h.tipo === 'autorizacion_datos' && !h.obligatorio && h.evento === 'aceptacion').map(h => (
                <div key={h.documento_id} style={{ fontSize: '.84rem', color: mut }}>
                    Autorizó: {h.titulo}. <button type="button" style={{ ...boton, color: '#f87171' }} onClick={() => revocar(h.documento_id)}>Retirar autorización</button>
                </div>
            ))}
            {leyendo && <LectorDocumento doc={leyendo} onClose={() => setLeyendo(null)} />}
        </div>
    );
}
