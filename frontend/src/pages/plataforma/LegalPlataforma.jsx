/**
 * SS SWAP - Plataforma: documentos, contratos y proveedor (/dashboard/plataforma/legal)
 * Solo superadministrador.
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { usePaleta, bebas, outfit, BotonPrimario, BotonSecundario, Pildora, Modal } from '../../components/common/PanelUI';
import GestionDocumentos from '../../components/legal/GestionDocumentos';
import { dinero, fechaHora } from '../facturacion/comun';

export default function LegalPlataforma() {
    const p = usePaleta();
    const [tab, setTab] = useState('documentos');
    const tabSt = (t) => ({ ...bebas('.72rem', '.16em'), padding: '9px 16px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${tab === t ? p.SKY_DEEP : p.bdr}`, background: tab === t ? p.SKY_PALE : 'none', color: tab === t ? p.SKY_DEEP : p.mut });
    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1200 }}>
            <div style={{ marginBottom: 18 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>PLATAFORMA · LEGAL</span></div>
                <h1 style={{ ...bebas('2.5rem', '.04em'), color: p.txt, lineHeight: 1 }}>Documentos y contratos de la plataforma</h1>
            </div>
            <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button role="tab" aria-selected={tab === 'documentos'} style={tabSt('documentos')} onClick={() => setTab('documentos')}>DOCUMENTOS</button>
                <button role="tab" aria-selected={tab === 'contratos'} style={tabSt('contratos')} onClick={() => setTab('contratos')}>CONTRATOS DE EMPRESAS</button>
                <button role="tab" aria-selected={tab === 'proveedor'} style={tabSt('proveedor')} onClick={() => setTab('proveedor')}>PROVEEDOR</button>
            </div>
            {tab === 'documentos' && <GestionDocumentos ambito="plataforma" />}
            {tab === 'contratos' && <Contratos />}
            {tab === 'proveedor' && <Proveedor />}
        </div>
    );
}

function Contratos() {
    const p = usePaleta();
    const [lista, setLista] = useState(null);
    const [empresas, setEmpresas] = useState([]);
    const [nuevo, setNuevo] = useState(false);
    const cargar = useCallback(async () => {
        try {
            setLista((await api.get('/legal/plataforma/contratos')).data.contratos);
            setEmpresas((await api.get('/plataforma/empresas')).data.empresas || []);
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudieron cargar los contratos.'); }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);
    const terminar = async (k) => {
        const motivo = window.prompt('Motivo de la terminación:');
        if (!motivo) return;
        try { await api.post(`/legal/plataforma/contratos/${k.id}/terminar`, { motivo }); cargar(); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudo terminar.'); }
    };
    if (!lista) return <p style={{ ...outfit('.85rem'), color: p.mut }}>Cargando…</p>;
    return (
        <div>
            <div style={{ marginBottom: 12 }}><BotonPrimario onClick={() => setNuevo(true)}>+ NUEVO CONTRATO</BotonPrimario></div>
            <p style={{ ...outfit('.8rem'), color: p.mut, marginBottom: 12 }}>Un contrato aceptado no se modifica: para cambiar condiciones se crea uno nuevo.</p>
            {lista.map(k => (
                <div key={k.id} style={{ background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div>
                            <p style={{ ...bebas('1rem', '.05em'), color: p.txt }}>{k.empresa_nombre} · {k.plan}</p>
                            <p style={{ ...outfit('.82rem'), color: p.mut }}>{k.precio != null ? `${dinero(k.precio)} ${k.periodicidad || ''}` : 'Sin precio'} · creado {fechaHora(k.created_at)}{k.aceptado_at ? ` · aceptado ${fechaHora(k.aceptado_at)} por ${k.aceptado_por_nombre || ''}` : ''}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Pildora color={{ vigente: '#10b981', pendiente_aceptacion: '#f59e0b', terminado: '#94a3b8' }[k.estado]}>{k.estado.replace(/_/g, ' ').toUpperCase()}</Pildora>
                            {k.estado === 'vigente' && <BotonSecundario color="#ef4444" onClick={() => terminar(k)}>TERMINAR</BotonSecundario>}
                        </div>
                    </div>
                </div>
            ))}
            {nuevo && <ModalContrato empresas={empresas} onClose={() => setNuevo(false)} onCreado={() => { setNuevo(false); cargar(); }} />}
        </div>
    );
}

function ModalContrato({ empresas, onClose, onCreado }) {
    const p = usePaleta();
    const [f, setF] = useState({ empresa_id: '', plan: '', alcance: '', precio: '', periodicidad: 'mensual', condiciones_soporte: '', fecha_inicio: '' });
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.86rem') };
    const crear = async () => {
        try { await api.post('/legal/plataforma/contratos', f); toast.success('Contrato creado: la empresa debe aceptarlo.'); onCreado(); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudo crear.'); }
    };
    return (
        <Modal titulo="Nuevo contrato" etiqueta="PLATAFORMA · CONTRATOS" ancho={620} onClose={onClose} subtitulo="La empresa lo verá en Contratación del servicio y deberá aceptarlo junto con los documentos de la plataforma.">
            <div style={{ display: 'grid', gap: 10 }}>
                <select aria-label="Empresa" value={f.empresa_id} onChange={e => setF({ ...f, empresa_id: e.target.value })} style={inputSt}>
                    <option value="">Seleccione la empresa…</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
                <input aria-label="Plan" value={f.plan} maxLength={120} onChange={e => setF({ ...f, plan: e.target.value })} placeholder="Plan (ej. Taller completo + facturación)" style={inputSt} />
                <textarea aria-label="Alcance" value={f.alcance} rows={5} onChange={e => setF({ ...f, alcance: e.target.value })} placeholder="Alcance real del servicio: módulos, usuarios, límites y dependencias externas" style={inputSt} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <input aria-label="Precio" type="number" min="0" step="0.01" value={f.precio} onChange={e => setF({ ...f, precio: e.target.value })} placeholder="Precio USD" style={inputSt} />
                    <select aria-label="Periodicidad" value={f.periodicidad} onChange={e => setF({ ...f, periodicidad: e.target.value })} style={inputSt}>
                        {['mensual', 'trimestral', 'semestral', 'anual', 'unico'].map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                    <input aria-label="Fecha de inicio" type="date" value={f.fecha_inicio} onChange={e => setF({ ...f, fecha_inicio: e.target.value })} style={inputSt} />
                </div>
                <textarea aria-label="Soporte" value={f.condiciones_soporte} rows={3} onChange={e => setF({ ...f, condiciones_soporte: e.target.value })} placeholder="Condiciones de soporte y disponibilidad" style={inputSt} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                <BotonPrimario onClick={crear} disabled={!f.empresa_id || f.plan.length < 3 || f.alcance.length < 20}>CREAR</BotonPrimario>
            </div>
        </Modal>
    );
}

function Proveedor() {
    const p = usePaleta();
    const [f, setF] = useState(null);
    useEffect(() => { api.get('/legal/plataforma/proveedor').then(({ data }) => setF(data.proveedor || {})).catch(() => setF({})); }, []);
    if (!f) return <p style={{ ...outfit('.85rem'), color: p.mut }}>Cargando…</p>;
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.86rem') };
    const campos = [['razon_social', 'Razón social'], ['ruc', 'RUC'], ['direccion', 'Dirección'], ['email_contacto', 'Correo de contacto'], ['telefono', 'Teléfono'], ['canal_reclamos', 'Canal de reclamos']];
    const guardar = async () => {
        try { setF((await api.put('/legal/plataforma/proveedor', f)).data.proveedor); toast.success('Datos del proveedor guardados.'); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudo guardar.'); }
    };
    return (
        <div style={{ background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, padding: 18, maxWidth: 700 }}>
            <p style={{ ...outfit('.84rem'), color: p.mut, marginBottom: 12 }}>Identidad de quien presta el servicio. Se muestra a las empresas antes de contratar y en las constancias.</p>
            <div style={{ display: 'grid', gap: 10 }}>
                {campos.map(([k, l]) => <input key={k} aria-label={l} placeholder={l} value={f[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })} style={inputSt} />)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><BotonPrimario onClick={guardar}>GUARDAR</BotonPrimario></div>
        </div>
    );
}
