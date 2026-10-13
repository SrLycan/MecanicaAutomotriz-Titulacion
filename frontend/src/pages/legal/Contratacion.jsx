/**
 * SS SWAP - Contratación del servicio (/dashboard/contratacion)
 *
 * Lo que la empresa ve y acepta antes de contratar: identidad del proveedor y
 * de la empresa, alcance, precio y periodicidad, soporte, y los documentos
 * de la plataforma (leerlos y descargarlos ANTES de aceptar). Cada documento
 * obligatorio tiene su propia casilla, desmarcada al inicio. Sin todas las
 * casillas obligatorias no se puede aceptar.
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { usePaleta, bebas, outfit, BotonPrimario, BotonSecundario, Pildora } from '../../components/common/PanelUI';
import LectorDocumento, { descargarTexto } from '../../components/legal/LectorDocumento';
import { dinero, fechaHora, descargar } from '../facturacion/comun';

const PERIODO = { mensual: 'mensual', trimestral: 'trimestral', semestral: 'semestral', anual: 'anual', unico: 'pago único' };

export default function Contratacion() {
    const p = usePaleta();
    const [d, setD] = useState(null);
    const [leer, setLeer] = useState(null);
    const [marcados, setMarcados] = useState({});
    const [enviando, setEnviando] = useState(false);
    const [historial, setHistorial] = useState([]);

    const cargar = useCallback(async () => {
        try {
            setD((await api.get('/legal/contratacion')).data);
            setHistorial((await api.get('/legal/mis-aceptaciones')).data.aceptaciones);
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo cargar la contratación.'); }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    if (!d) return <div className="sk-pulse" style={{ height: 300, borderRadius: 16, background: p.card }} />;
    const pendiente = d.contratos.find(k => k.estado === 'pendiente_aceptacion');
    const vigente = d.contratos.find(k => k.estado === 'vigente');
    const obligatorios = d.documentos.filter(x => x.obligatorio);
    const completos = obligatorios.every(x => marcados[x.version_id]);
    const seccion = { background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, padding: 18, marginBottom: 16 };

    const aceptar = async () => {
        setEnviando(true);
        try {
            const version_ids = Object.entries(marcados).filter(([, v]) => v).map(([k]) => Number(k));
            const { data } = await api.post('/legal/aceptar', { contrato_id: pendiente?.id, version_ids, acepto: true });
            toast.success('Aceptación registrada. Puede descargar su constancia.');
            setMarcados({});
            await cargar();
            descargar(`/legal/constancias/${data.transaccion_id}`, 'constancia.pdf');
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo registrar la aceptación.'); }
        finally { setEnviando(false); }
    };

    const contrato = pendiente || vigente;
    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1000 }}>
            <div style={{ marginBottom: 18 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>MI EMPRESA · CONTRATACIÓN</span></div>
                <h1 style={{ ...bebas('2.5rem', '.04em'), color: p.txt, lineHeight: 1 }}>Contratación del servicio</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
                <div style={seccion}>
                    <p style={{ ...bebas('.8rem', '.18em'), color: p.SKY_DEEP, marginBottom: 8 }}>PROVEEDOR DEL SERVICIO</p>
                    {d.proveedor?.razon_social ? (
                        <div style={{ ...outfit('.86rem'), color: p.txtSf, display: 'grid', gap: 3 }}>
                            <strong style={{ color: p.txt }}>{d.proveedor.razon_social}</strong>
                            {d.proveedor.ruc && <span>RUC {d.proveedor.ruc}</span>}
                            {d.proveedor.direccion && <span>{d.proveedor.direccion}</span>}
                            {d.proveedor.email_contacto && <span>{d.proveedor.email_contacto}{d.proveedor.telefono ? ` · ${d.proveedor.telefono}` : ''}</span>}
                            {d.proveedor.canal_reclamos && <span>Reclamos: {d.proveedor.canal_reclamos}</span>}
                        </div>
                    ) : <p style={{ ...outfit('.85rem'), color: p.mut }}>La plataforma aún no registró los datos del proveedor.</p>}
                </div>
                <div style={seccion}>
                    <p style={{ ...bebas('.8rem', '.18em'), color: p.SKY_DEEP, marginBottom: 8 }}>EMPRESA CONTRATANTE</p>
                    <div style={{ ...outfit('.86rem'), color: p.txtSf, display: 'grid', gap: 3 }}>
                        <strong style={{ color: p.txt }}>{d.empresa?.razon_social || d.empresa?.nombre}</strong>
                        {d.empresa?.ruc ? <span>RUC {d.empresa.ruc}</span> : <span style={{ color: '#b45309' }}>Registre el RUC en Configuración de la empresa.</span>}
                        {d.empresa?.direccion && <span>{d.empresa.direccion}</span>}
                    </div>
                </div>
            </div>

            <div style={seccion}>
                <p style={{ ...bebas('.8rem', '.18em'), color: p.SKY_DEEP, marginBottom: 8 }}>SERVICIO CONTRATADO</p>
                {!contrato ? <p style={{ ...outfit('.86rem'), color: p.mut }}>No hay un contrato registrado para su empresa.</p> : (
                    <div style={{ ...outfit('.88rem'), color: p.txtSf, display: 'grid', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Pildora color={contrato.estado === 'vigente' ? '#10b981' : '#f59e0b'}>{contrato.estado === 'vigente' ? 'VIGENTE' : 'PENDIENTE DE ACEPTACIÓN'}</Pildora>
                            <Pildora color={p.SKY_DEEP}>{contrato.plan}</Pildora>
                        </div>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{contrato.alcance}</p>
                        {contrato.precio != null && <p><strong>Precio:</strong> {dinero(contrato.precio)} {contrato.moneda} {PERIODO[contrato.periodicidad] ? `(${PERIODO[contrato.periodicidad]})` : ''} — impuestos según ley.</p>}
                        {contrato.condiciones_soporte && <p style={{ whiteSpace: 'pre-wrap' }}><strong>Soporte:</strong> {contrato.condiciones_soporte}</p>}
                        {contrato.aceptado_at && <p style={{ color: p.mut }}>Aceptado el {fechaHora(contrato.aceptado_at)}.</p>}
                    </div>
                )}
            </div>

            <div style={seccion}>
                <p style={{ ...bebas('.8rem', '.18em'), color: p.SKY_DEEP, marginBottom: 8 }}>DOCUMENTOS DE LA PLATAFORMA</p>
                <p style={{ ...outfit('.82rem'), color: p.mut, marginBottom: 10 }}>Lea cada documento antes de aceptarlo. Puede descargarlos. La aceptación no equivale a una firma electrónica certificada.</p>
                {d.documentos.length === 0 && <p style={{ ...outfit('.85rem'), color: p.mut }}>La plataforma aún no publicó documentos.</p>}
                {d.documentos.map(doc => (
                    <div key={doc.version_id} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: `1px solid ${p.bdr}`, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', ...outfit('.88rem'), color: p.txt, cursor: pendiente ? 'pointer' : 'default', flex: 1 }}>
                            {pendiente && <input type="checkbox" checked={Boolean(marcados[doc.version_id])} onChange={e => setMarcados({ ...marcados, [doc.version_id]: e.target.checked })} style={{ marginTop: 3 }} />}
                            <span>He leído y acepto: <strong>{doc.titulo}</strong> (versión {doc.version}){doc.obligatorio ? '' : ' — opcional'}</span>
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <BotonSecundario color={p.SKY_DEEP} onClick={() => setLeer(doc)}>LEER</BotonSecundario>
                            <BotonSecundario onClick={() => descargarTexto(doc)}>DESCARGAR</BotonSecundario>
                        </div>
                    </div>
                ))}
                {pendiente && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                        <BotonPrimario disabled={enviando || !completos} onClick={aceptar}>{enviando ? 'REGISTRANDO...' : 'ACEPTAR Y CONTRATAR'}</BotonPrimario>
                    </div>
                )}
            </div>

            {historial.length > 0 && (
                <div style={seccion}>
                    <p style={{ ...bebas('.8rem', '.18em'), color: p.SKY_DEEP, marginBottom: 8 }}>MIS ACEPTACIONES</p>
                    {[...new Map(historial.map(h => [h.transaccion_id, h])).values()].map(h => (
                        <div key={h.transaccion_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...outfit('.84rem'), color: p.txtSf, padding: '6px 0', borderTop: `1px solid ${p.bdr}` }}>
                            <span>{fechaHora(h.aceptado_at)} · {h.contexto.replace(/_/g, ' ')}</span>
                            <button type="button" onClick={() => descargar(`/legal/constancias/${h.transaccion_id}`, 'constancia.pdf')} style={{ background: 'none', border: 'none', color: p.SKY_DEEP, cursor: 'pointer', ...bebas('.76rem') }}>CONSTANCIA</button>
                        </div>
                    ))}
                </div>
            )}

            {leer && <LectorDocumento doc={leer} onClose={() => setLeer(null)} etiqueta="PLATAFORMA · DOCUMENTO" />}
        </div>
    );
}
