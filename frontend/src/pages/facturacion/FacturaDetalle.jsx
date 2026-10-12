/**
 * SS SWAP - Detalle de un comprobante electrónico (/dashboard/facturacion/:id)
 *
 * Muestra el estado REAL según el SRI, sus mensajes y el historial
 * inmutable. Las acciones dependen del estado y de los permisos:
 *  - borrador / devuelta / no autorizada: corregir, emitir (con confirmación
 *    expresa de los datos del comprador), descartar (solo borradores sin número);
 *  - en curso: consultar ahora (el sistema también lo hace solo);
 *  - autorizada: RIDE, XML, correo, nota de crédito y registro de anulación.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePaleta, bebas, outfit, BotonPrimario, BotonSecundario, Pildora, Modal } from '../../components/common/PanelUI';
import { ESTADOS, TIPO_DOC, EDITABLES, EN_CURSO, dinero, fechaCorta, fechaHora, descargar, verPdf, mensajesSri } from './comun';

const TIPOS_ID = { '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte', '07': 'Consumidor final', '08': 'Exterior' };

export default function FacturaDetalle() {
    const p = usePaleta();
    const { id } = useParams();
    const navigate = useNavigate();
    const { puede } = useAuth();
    const [c, setC] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [modal, setModal] = useState(null); // 'emitir' | 'anular' | 'correo'

    const cargar = useCallback(async () => {
        try { setC((await api.get(`/facturacion/${id}`)).data); }
        catch (err) { toast.error(err.response?.data?.error || 'Comprobante no encontrado.'); navigate('/dashboard/facturacion'); }
    }, [id, navigate]);
    useEffect(() => { cargar(); }, [cargar]);

    // Mientras el SRI procesa, se refresca solo cada 20 s.
    useEffect(() => {
        if (!c || !EN_CURSO.includes(c.estado)) return undefined;
        const t = setInterval(cargar, 20000);
        return () => clearInterval(t);
    }, [c, cargar]);

    if (!c) return <div className="sk-pulse" style={{ height: 320, borderRadius: 16, background: p.card }} />;

    const est = ESTADOS[c.estado] || { etiqueta: c.estado, color: p.mut, ayuda: '' };
    const esFactura = c.cod_doc === '01';
    const accion = async (fn, exito) => {
        setOcupado(true);
        try { const r = await fn(); if (r?.data && r.data.id) setC(r.data); else await cargar(); if (exito) toast.success(exito); }
        catch (err) {
            const d = err.response?.data || {};
            toast.error(d.error || 'No se pudo completar la acción.');
            if (d.faltantes) d.faltantes.forEach(f => toast(f, { icon: '⚠️' }));
            if (d.errores_xsd) d.errores_xsd.slice(0, 3).forEach(f => toast(f, { icon: '📄' }));
            await cargar();
        } finally { setOcupado(false); setModal(null); }
    };

    const seccion = { background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, padding: 18, marginBottom: 16 };
    const fila = (et, val) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', ...outfit('.86rem') }}>
            <span style={{ color: p.mut }}>{et}</span><span style={{ color: p.txt, textAlign: 'right', wordBreak: 'break-all' }}>{val || '—'}</span>
        </div>
    );
    const mensajes = mensajesSri(c.ultimo_mensaje);

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>{TIPO_DOC[c.cod_doc]?.toUpperCase()} ELECTRÓNICA</span></div>
                    <h1 style={{ ...bebas('2.4rem', '.04em'), color: p.txt, lineHeight: 1 }}>{TIPO_DOC[c.cod_doc]} {c.numero || '(borrador)'}</h1>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <Pildora color={est.color} title={est.ayuda}>{est.etiqueta.toUpperCase()}</Pildora>
                        {Number(c.ambiente) === 1 ? <Pildora color="#f59e0b">PRUEBAS · SIN VALIDEZ TRIBUTARIA</Pildora> : <Pildora color="#10b981">PRODUCCIÓN</Pildora>}
                    </div>
                </div>
                <BotonSecundario onClick={() => navigate('/dashboard/facturacion')}>← COMPROBANTES</BotonSecundario>
            </div>

            <div role="status" style={{ ...seccion, borderLeft: `4px solid ${est.color}` }}>
                <p style={{ ...outfit('.9rem'), color: p.txtSf }}>{est.ayuda}</p>
                {mensajes.length > 0 && (
                    <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
                        {mensajes.map((m, i) => <li key={i} style={{ ...outfit('.84rem'), color: m.tipo === 'ERROR' ? '#ef4444' : p.txtSf }}><strong>{m.tipo}:</strong> {m.texto}</li>)}
                    </ul>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                    {EDITABLES.includes(c.estado) && puede('facturacion', esFactura ? 'crear' : 'anular') && (
                        <BotonSecundario color={p.SKY_DEEP} onClick={() => navigate(`/dashboard/facturacion/${c.id}/editar`)}>{c.estado === 'borrador' ? 'EDITAR' : 'CORREGIR DATOS'}</BotonSecundario>
                    )}
                    {EDITABLES.includes(c.estado) && puede('facturacion', 'aprobar') && (
                        <BotonPrimario disabled={ocupado} onClick={() => setModal('emitir')}>{c.estado === 'borrador' ? 'EMITIR Y ENVIAR AL SRI' : 'REENVIAR AL SRI'}</BotonPrimario>
                    )}
                    {c.estado === 'borrador' && !c.secuencial && puede('facturacion', 'eliminar') && (
                        <BotonSecundario color="#ef4444" disabled={ocupado} onClick={() => accion(() => api.post(`/facturacion/${c.id}/descartar`), 'Borrador descartado.')}>DESCARTAR</BotonSecundario>
                    )}
                    {EN_CURSO.includes(c.estado) && (
                        <BotonPrimario disabled={ocupado} onClick={() => accion(() => api.post(`/facturacion/${c.id}/procesar`))}>{ocupado ? 'CONSULTANDO...' : 'CONSULTAR EN EL SRI AHORA'}</BotonPrimario>
                    )}
                    {c.estado === 'anulacion_solicitada' && puede('facturacion', 'anular') && (
                        <BotonSecundario disabled={ocupado} onClick={() => accion(() => api.post(`/facturacion/${c.id}/anulacion/cancelar`), 'Registro de anulación cancelado.')}>CANCELAR REGISTRO DE ANULACIÓN</BotonSecundario>
                    )}
                    {c.xml_firmado && puede('facturacion', 'exportar') && <>
                        <BotonSecundario color={p.SKY_DEEP} onClick={() => verPdf(`/facturacion/${c.id}/ride`)}>VER RIDE</BotonSecundario>
                        <BotonSecundario color={p.SKY_DEEP} onClick={() => descargar(`/facturacion/${c.id}/ride?descargar=1`, `${c.numero}.pdf`)}>DESCARGAR RIDE</BotonSecundario>
                        <BotonSecundario color={p.SKY_DEEP} onClick={() => descargar(`/facturacion/${c.id}/xml`, `${c.numero}.xml`)}>{c.xml_autorizado ? 'XML AUTORIZADO' : 'XML FIRMADO'}</BotonSecundario>
                    </>}
                    {['autorizado', 'anulacion_solicitada'].includes(c.estado) && puede('facturacion', 'exportar') && (
                        <BotonSecundario color={p.SKY_DEEP} onClick={() => setModal('correo')}>ENVIAR POR CORREO</BotonSecundario>
                    )}
                    {c.estado === 'autorizado' && esFactura && c.comprador_tipo_identificacion !== '07' && puede('facturacion', 'anular') && (
                        <BotonSecundario color="#8b5cf6" onClick={() => navigate(`/dashboard/facturacion/nueva?nota_credito_de=${c.id}`)}>NOTA DE CRÉDITO</BotonSecundario>
                    )}
                    {c.estado === 'autorizado' && puede('facturacion', 'anular') && (
                        <BotonSecundario color="#ef4444" onClick={() => setModal('anular')}>REGISTRAR ANULACIÓN</BotonSecundario>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16 }}>
                <div style={seccion}>
                    <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 8 }}>COMPROBANTE</p>
                    {fila('Fecha de emisión', fechaCorta(c.fecha_emision))}
                    {fila('Clave de acceso / autorización', c.clave_acceso)}
                    {fila('Fecha de autorización', c.fecha_autorizacion ? fechaHora(c.fecha_autorizacion) : null)}
                    {fila('Emisor', c.emisor ? `${c.emisor.razonSocial} · RUC ${c.emisor.ruc}` : 'Se fija al emitir')}
                    {c.sustento && fila('Modifica a', <Link to={`/dashboard/facturacion/${c.sustento.id}`} style={{ color: p.SKY_DEEP }}>Factura {c.sustento.numero}</Link>)}
                    {c.motivo_nc && fila('Motivo', c.motivo_nc)}
                    {c.proforma_id && fila('Proforma', <Link to={`/dashboard/proformas/${c.proforma_id}`} style={{ color: p.SKY_DEEP }}>Ver proforma</Link>)}
                    {c.orden_id && fila('Orden de trabajo', `OT-${String(c.orden_id).padStart(6, '0')}`)}
                    {c.estado === 'autorizado' && fila('Correo', { enviado: `Enviado a ${c.correo_destinatarios || ''}`, error: `Error: ${c.correo_error || ''}`, sin_correo: c.correo_error || 'Sin correo', pendiente: 'Pendiente' }[c.correo_estado])}
                    {c.anulacion_motivo && fila('Motivo de anulación', c.anulacion_motivo)}
                    {c.notas_credito?.length > 0 && fila('Notas de crédito', c.notas_credito.map(n => (
                        <Link key={n.id} to={`/dashboard/facturacion/${n.id}`} style={{ color: p.SKY_DEEP, display: 'block' }}>{n.numero || 'borrador'} · {dinero(n.importe_total)} · {ESTADOS[n.estado]?.etiqueta}</Link>)))}
                </div>
                <div style={seccion}>
                    <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 8 }}>COMPRADOR</p>
                    {fila(TIPOS_ID[c.comprador_tipo_identificacion] || 'Identificación', c.comprador_identificacion)}
                    {fila('Razón social', c.comprador_razon_social)}
                    {fila('Dirección', c.comprador_direccion)}
                    {fila('Correo', c.comprador_email)}
                    {fila('Teléfono', c.comprador_telefono)}
                    {c.vehiculo?.placa && fila('Vehículo', [c.vehiculo.placa, c.vehiculo.marca, c.vehiculo.modelo].filter(Boolean).join(' · '))}
                </div>
            </div>

            <div style={seccion}>
                <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 8 }}>DETALLE</p>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                        <thead><tr>{['Código', 'Descripción', 'Cant.', 'P. unit.', 'Desc.', 'IVA', 'Total'].map(h => <th key={h} style={{ ...bebas('.6rem', '.18em'), color: p.SKY_DEEP, textAlign: 'left', padding: 6 }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {c.detalles.map(d => (
                                <tr key={d.id} style={{ borderTop: `1px solid ${p.bdr}`, ...outfit('.84rem'), color: p.txt }}>
                                    <td style={{ padding: 6 }}>{d.codigo_principal || '—'}</td><td style={{ padding: 6 }}>{d.descripcion}</td>
                                    <td style={{ padding: 6 }}>{d.cantidad}</td><td style={{ padding: 6 }}>{d.precio_unitario}</td>
                                    <td style={{ padding: 6 }}>{dinero(d.descuento)}</td><td style={{ padding: 6 }}>{d.iva_tarifa}%</td>
                                    <td style={{ padding: 6, fontWeight: 600 }}>{dinero(d.precio_total_sin_impuesto)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ maxWidth: 320, marginLeft: 'auto', marginTop: 12 }}>
                    {(c.totales_impuestos || []).map(g => fila(`Subtotal ${g.tarifa}%`, dinero(g.base)))}
                    {fila('Subtotal sin impuestos', dinero(c.total_sin_impuestos))}
                    {fila('Descuento', dinero(c.total_descuento))}
                    {fila('IVA', dinero(c.total_iva))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', ...bebas('1.4rem', '.04em'), color: p.txt, borderTop: `1px solid ${p.bdr}`, marginTop: 6, paddingTop: 6 }}>
                        <span>TOTAL</span><span>{dinero(c.importe_total)}</span>
                    </div>
                    {(c.pagos || []).map((pg, i) => <p key={i} style={{ ...outfit('.78rem'), color: p.mut, textAlign: 'right' }}>Forma de pago {pg.formaPago}: {dinero(pg.total)}</p>)}
                </div>
            </div>

            <div style={seccion}>
                <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 8 }}>HISTORIAL (NO SE PUEDE MODIFICAR)</p>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                    {c.eventos.map(e => (
                        <li key={e.id} style={{ ...outfit('.82rem'), color: p.txtSf, marginBottom: 4 }}>
                            <span style={{ color: p.mut }}>{fechaHora(e.created_at)}</span> · <strong>{e.tipo.replace(/_/g, ' ')}</strong>
                            {e.estado_nuevo && e.estado_nuevo !== e.estado_anterior && ` → ${ESTADOS[e.estado_nuevo]?.etiqueta || e.estado_nuevo}`}
                            {e.usuario_nombre && ` · ${e.usuario_nombre}`}
                        </li>
                    ))}
                </ol>
            </div>

            {modal === 'emitir' && <ModalEmitir c={c} ocupado={ocupado} onClose={() => setModal(null)}
                onConfirmar={() => accion(() => api.post(`/facturacion/${c.id}/emitir`, { confirmar_comprador: true }))} />}
            {modal === 'anular' && <ModalAnular c={c} ocupado={ocupado} onClose={() => setModal(null)}
                onConfirmar={(motivo) => accion(() => api.post(`/facturacion/${c.id}/anulacion`, { motivo }), 'Anulación registrada. Se verificará en el SRI.')} />}
            {modal === 'correo' && <ModalCorreo c={c} onClose={() => setModal(null)} onEnviado={cargar} />}
        </div>
    );
}

function ModalEmitir({ c, ocupado, onClose, onConfirmar }) {
    const p = usePaleta();
    const [confirmo, setConfirmo] = useState(false);
    const cf = c.comprador_tipo_identificacion === '07';
    return (
        <Modal titulo={c.estado === 'borrador' ? 'Emitir comprobante' : 'Reenviar al SRI'} etiqueta="FACTURACIÓN · EMISIÓN" onClose={onClose} ancho={560}
            subtitulo="Se asigna el número (o se conserva el que ya tiene), se firma con su certificado y se envía al SRI. El estado final lo decide el SRI.">
            <div style={{ ...outfit('.88rem'), color: p.txtSf, display: 'grid', gap: 6, marginBottom: 14 }}>
                <span><strong>Comprador:</strong> {c.comprador_razon_social}</span>
                <span><strong>Identificación:</strong> {c.comprador_identificacion}</span>
                <span><strong>Total:</strong> {dinero(c.importe_total)}</span>
                <span><strong>Ambiente:</strong> {Number(c.ambiente) === 1 ? 'PRUEBAS (sin validez tributaria)' : 'PRODUCCIÓN (con validez tributaria)'}</span>
            </div>
            {!cf && (
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', ...outfit('.86rem'), color: p.txt, marginBottom: 16, cursor: 'pointer' }}>
                    <input type="checkbox" checked={confirmo} onChange={e => setConfirmo(e.target.checked)} style={{ marginTop: 3 }} />
                    Confirmo que la identificación y la razón social del comprador son correctas (verificadas con el cliente o en el portal del SRI).
                </label>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                <BotonPrimario disabled={ocupado || (!cf && !confirmo)} onClick={onConfirmar}>{ocupado ? 'ENVIANDO AL SRI...' : 'EMITIR'}</BotonPrimario>
            </div>
        </Modal>
    );
}

function ModalAnular({ c, ocupado, onClose, onConfirmar }) {
    const p = usePaleta();
    const [motivo, setMotivo] = useState('');
    const [hecho, setHecho] = useState(false);
    const dias = Math.floor((Date.now() - new Date(`${c.fecha_emision}T00:00:00-05:00`).getTime()) / 86400000);
    return (
        <Modal titulo="Registrar anulación" etiqueta="FACTURACIÓN · ANULACIÓN" color="#ef4444" onClose={onClose} ancho={600}
            subtitulo="El SRI no ofrece un servicio web para anular: la anulación se solicita en SRI en Línea (Facturación Electrónica › Anulación de comprobantes).">
            <ol style={{ ...outfit('.86rem'), color: p.txtSf, paddingLeft: 18, margin: '0 0 12px' }}>
                <li>Ingrese a SRI en Línea con el usuario del emisor y solicite la anulación con la clave de acceso <strong style={{ wordBreak: 'break-all' }}>{c.clave_acceso}</strong>.</li>
                <li>Plazo: hasta 90 días desde la emisión (lleva {dias} día(s)). Después hay que solicitarlo en una oficina del SRI.</li>
                <li>Registre aquí la solicitud: el sistema consultará al SRI y la marcará <strong>anulada</strong> solo cuando el SRI lo confirme.</li>
                <li>Si lo que necesita es corregir valores, use una <strong>nota de crédito</strong>.</li>
            </ol>
            <textarea aria-label="Motivo de la anulación" value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} maxLength={300} placeholder="Motivo (mínimo 10 caracteres)"
                style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.86rem') }} />
            <label style={{ display: 'flex', gap: 10, ...outfit('.85rem'), color: p.txt, margin: '12px 0 16px', cursor: 'pointer' }}>
                <input type="checkbox" checked={hecho} onChange={e => setHecho(e.target.checked)} /> Ya solicité la anulación en SRI en Línea.
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                <BotonPrimario color="#ef4444" disabled={ocupado || !hecho || motivo.trim().length < 10} onClick={() => onConfirmar(motivo)}>REGISTRAR</BotonPrimario>
            </div>
        </Modal>
    );
}

function ModalCorreo({ c, onClose, onEnviado }) {
    const p = usePaleta();
    const [para, setPara] = useState(c.comprador_email || '');
    const [enviando, setEnviando] = useState(false);
    const enviar = async () => {
        setEnviando(true);
        try {
            const { data } = await api.post(`/facturacion/${c.id}/correo`, { para });
            toast.success(`Enviado a ${data.para.join(', ')}.`);
            onEnviado(); onClose();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo enviar.'); }
        finally { setEnviando(false); }
    };
    return (
        <Modal titulo="Enviar por correo" etiqueta="FACTURACIÓN · ENTREGA" onClose={onClose} ancho={480}
            subtitulo="Se adjuntan el XML autorizado y el RIDE. Un error de correo no cambia el estado tributario del comprobante.">
            <input aria-label="Correos" value={para} onChange={e => setPara(e.target.value)} placeholder="correo@cliente.com, otro@correo.com"
                style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.88rem'), marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                <BotonPrimario disabled={enviando || !para.trim()} onClick={enviar}>{enviando ? 'ENVIANDO...' : 'ENVIAR'}</BotonPrimario>
            </div>
        </Modal>
    );
}
