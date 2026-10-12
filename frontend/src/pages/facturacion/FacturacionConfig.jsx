/**
 * SS SWAP - Configuración tributaria y firma electrónica (/dashboard/facturacion/config)
 *
 *  1. Estado: ambiente, lo que falta, custodia del certificado, correo, conexión con el SRI.
 *  2. Datos del EMISOR (los ingresa y verifica un administrador; no se copian de otro comprobante).
 *  3. Puntos de emisión habilitados en el SRI y numeración inicial.
 *  4. Certificado .p12: se envía una sola vez, se guarda cifrado y nunca vuelve a mostrarse.
 *  5. Ambiente de producción: solo con una prueba AUTORIZADA y confirmación expresa.
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePaleta, bebas, outfit, BotonPrimario, BotonSecundario, Pildora, Modal } from '../../components/common/PanelUI';
import { fechaHora } from './comun';

const CAMPOS = [
    { k: 'ruc', l: 'RUC DEL EMISOR *', max: 13 },
    { k: 'razon_social', l: 'RAZÓN SOCIAL *', max: 300, ancho: 2 },
    { k: 'nombre_comercial', l: 'NOMBRE COMERCIAL', max: 300, ancho: 2 },
    { k: 'dir_matriz', l: 'DIRECCIÓN MATRIZ *', max: 300, ancho: 2 },
    { k: 'email_emisor', l: 'CORREO DEL EMISOR', max: 150 },
    { k: 'telefono', l: 'TELÉFONO', max: 30 },
    { k: 'contribuyente_especial', l: 'CONTRIBUYENTE ESPECIAL (N.º RESOLUCIÓN)', max: 13 },
    { k: 'agente_retencion', l: 'AGENTE DE RETENCIÓN (N.º RESOLUCIÓN)', max: 8 },
    { k: 'ruc_proveedor_sistema', l: 'RUC PROVEEDOR DEL SISTEMA (ANEXO 26)', max: 13 },
];

export default function FacturacionConfig() {
    const p = usePaleta();
    const { puede } = useAuth();
    const editable = puede('facturacion_config', 'editar');
    const [d, setD] = useState(null);
    const [form, setForm] = useState({});
    const [guardando, setGuardando] = useState(false);
    const [punto, setPunto] = useState(null);     // punto en edición
    const [secuencial, setSecuencial] = useState(null);
    const [produccion, setProduccion] = useState(false);
    const [conexion, setConexion] = useState(null);

    const cargar = useCallback(async () => {
        try {
            const { data } = await api.get('/facturacion/config');
            setD(data);
            const c = data.config || {};
            setForm({ ...Object.fromEntries(CAMPOS.map(x => [x.k, c[x.k] || ''])), regimen: c.regimen || 'general',
                obligado_contabilidad: Boolean(c.obligado_contabilidad), iva_codigo_defecto: c.iva_codigo_defecto || '4',
                espera_autorizacion_seg: c.espera_autorizacion_seg || 3 });
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo cargar la configuración.'); }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    if (!d) return <div className="sk-pulse" style={{ height: 300, borderRadius: 16, background: p.card }} />;
    const cfg = d.config;
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.86rem'), outline: 'none' };
    const label = (t, htmlFor) => <label htmlFor={htmlFor} style={{ display: 'block', marginBottom: 6, ...bebas('.6rem', '.2em'), color: p.SKY_DEEP }}>{t}</label>;
    const seccion = { background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, padding: 20, marginBottom: 18 };
    const titulo = (t) => <p style={{ ...bebas('.82rem', '.18em'), color: p.txt, marginBottom: 12 }}>{t}</p>;

    const guardar = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            const { data } = await api.put('/facturacion/config', form);
            (data.advertencias || []).forEach(a => toast(a, { icon: '⚠️', duration: 7000 }));
            toast.success('Datos del emisor guardados.');
            await cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo guardar.'); }
        finally { setGuardando(false); }
    };

    const probar = async () => {
        setConexion({ probando: true });
        try { setConexion((await api.post('/facturacion/config/probar-conexion')).data); }
        catch (err) { setConexion({ ok: false, detalle: err.response?.data?.error || 'Sin respuesta.' }); }
    };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1100 }}>
            <div style={{ marginBottom: 18 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>FACTURACIÓN · CONFIGURACIÓN</span></div>
                <h1 style={{ ...bebas('2.5rem', '.04em'), color: p.txt, lineHeight: 1 }}>Configuración tributaria</h1>
                <p style={{ ...outfit('.85rem'), color: p.mut, marginTop: 6, maxWidth: 760 }}>
                    Datos del EMISOR de los comprobantes. Deben coincidir exactamente con el RUC registrado y habilitado en el SRI.
                    El sistema usa los servicios web oficiales y gratuitos del SRI (esquema off-line).
                </p>
            </div>

            {/* 1. Estado */}
            <div style={seccion}>
                {titulo('ESTADO')}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {Number(cfg?.ambiente) === 2
                        ? <Pildora color="#10b981">PRODUCCIÓN desde {fechaHora(cfg.produccion_habilitada_at)}</Pildora>
                        : <Pildora color="#f59e0b">AMBIENTE DE PRUEBAS</Pildora>}
                    <Pildora color={d.custodia_configurada ? '#10b981' : '#ef4444'}>{d.custodia_configurada ? 'CUSTODIA DEL CERTIFICADO ACTIVA' : 'FALTA SRI_CERT_KEY EN EL SERVIDOR'}</Pildora>
                    <Pildora color={d.correo_configurado ? '#10b981' : '#f59e0b'}>{d.correo_configurado ? 'CORREO CONFIGURADO' : 'CORREO SIN CONFIGURAR (SMTP)'}</Pildora>
                    <Pildora color={p.SKY_DEEP}>PRUEBAS AUTORIZADAS: {d.autorizados_en_pruebas}</Pildora>
                </div>
                {d.faltantes.length > 0
                    ? <ul style={{ margin: 0, paddingLeft: 18, ...outfit('.85rem'), color: '#b45309' }}>{d.faltantes.map(f => <li key={f}>{f}</li>)}</ul>
                    : <p style={{ ...outfit('.86rem'), color: '#10b981' }}>Configuración completa: se pueden emitir comprobantes en el ambiente actual.</p>}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                    {editable && <BotonSecundario color={p.SKY_DEEP} onClick={probar} disabled={conexion?.probando}>{conexion?.probando ? 'PROBANDO...' : 'PROBAR CONEXIÓN CON EL SRI'}</BotonSecundario>}
                    {conexion && !conexion.probando && (
                        <span style={{ ...outfit('.82rem'), color: conexion.ok ? '#10b981' : '#ef4444' }}>
                            {conexion.ok ? `✓ ${conexion.detalle} (${conexion.milisegundos} ms, ambiente ${conexion.ambiente === 2 ? 'producción' : 'pruebas'})` : `✗ ${conexion.detalle}`}
                        </span>
                    )}
                </div>
                <p style={{ ...outfit('.74rem'), color: p.mut, marginTop: 10 }}>Servicios: pruebas {d.servicios.pruebas} · producción {d.servicios.produccion}</p>
            </div>

            {/* 2. Emisor */}
            <form style={seccion} onSubmit={guardar}>
                {titulo('DATOS DEL EMISOR')}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 13 }}>
                    {CAMPOS.map(c => (
                        <div key={c.k} style={c.ancho ? { gridColumn: `span ${c.ancho}` } : undefined}>
                            {label(c.l, `cfg-${c.k}`)}
                            <input id={`cfg-${c.k}`} value={form[c.k] || ''} maxLength={c.max} disabled={!editable} onChange={e => setForm({ ...form, [c.k]: e.target.value })} style={inputSt} />
                        </div>
                    ))}
                    <div>
                        {label('RÉGIMEN', 'cfg-regimen')}
                        <select id="cfg-regimen" value={form.regimen} disabled={!editable} onChange={e => setForm({ ...form, regimen: e.target.value })} style={inputSt}>
                            {d.regimenes.map(r => <option key={r.codigo} value={r.codigo}>{r.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        {label('TARIFA DE IVA POR DEFECTO', 'cfg-iva')}
                        <select id="cfg-iva" value={form.iva_codigo_defecto} disabled={!editable} onChange={e => setForm({ ...form, iva_codigo_defecto: e.target.value })} style={inputSt}>
                            {d.tarifas_iva.map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        {label('ESPERA ANTES DE CONSULTAR (SEG.)', 'cfg-espera')}
                        <input id="cfg-espera" type="number" min="1" max="60" value={form.espera_autorizacion_seg} disabled={!editable} onChange={e => setForm({ ...form, espera_autorizacion_seg: Number(e.target.value) })} style={inputSt} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...outfit('.86rem'), color: p.txt, marginTop: 20 }}>
                        <input type="checkbox" checked={form.obligado_contabilidad} disabled={!editable} onChange={e => setForm({ ...form, obligado_contabilidad: e.target.checked })} />
                        Obligado a llevar contabilidad
                    </label>
                </div>
                <p style={{ ...outfit('.76rem'), color: p.mut, marginTop: 10 }}>
                    Anexo 26 (ficha v2.34): el RUC del proveedor solo se llena si la empresa usa un sistema de facturación de un TERCERO listado por el SRI; con sistema propio se deja vacío.
                    El RUC del emisor no se puede cambiar después de emitir comprobantes.
                </p>
                {editable && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><BotonPrimario type="submit" disabled={guardando}>{guardando ? 'GUARDANDO...' : 'GUARDAR DATOS DEL EMISOR'}</BotonPrimario></div>}
            </form>

            {/* 3. Puntos */}
            <div style={seccion}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    {titulo('PUNTOS DE EMISIÓN')}
                    {editable && cfg && <BotonSecundario color={p.SKY_DEEP} onClick={() => setPunto({ establecimiento: '001', punto_emision: '001', direccion: cfg.dir_matriz || '', descripcion: '', activo: true })}>+ PUNTO DE EMISIÓN</BotonSecundario>}
                </div>
                {d.puntos.length === 0 ? <p style={{ ...outfit('.85rem'), color: p.mut }}>Registre el establecimiento y punto de emisión habilitados para su RUC en el SRI.</p> : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        {d.puntos.map(pt => {
                            const sec = (amb, cod) => d.secuencias.find(s => s.nombre === `sri:${amb}:${cod}:${pt.establecimiento}-${pt.punto_emision}`)?.ultimo || 0;
                            return (
                                <div key={pt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1px solid ${p.bdr}`, borderRadius: 11, flexWrap: 'wrap' }}>
                                    <div>
                                        <span style={{ ...bebas('1rem', '.08em'), color: p.txt }}>{pt.establecimiento}-{pt.punto_emision}</span>
                                        <span style={{ ...outfit('.82rem'), color: p.mut, marginLeft: 10 }}>{pt.descripcion || pt.direccion}</span>
                                        <span style={{ display: 'block', ...outfit('.74rem'), color: p.mut }}>Último usado — facturas: pruebas {sec(1, '01')} · producción {sec(2, '01')} · NC: producción {sec(2, '04')}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {!pt.activo && <Pildora color="#94a3b8">INACTIVO</Pildora>}
                                        {editable && <BotonSecundario onClick={() => setPunto(pt)}>EDITAR</BotonSecundario>}
                                        {editable && <BotonSecundario onClick={() => setSecuencial({ punto: pt, ambiente: 2, cod_doc: '01', ultimo_usado: sec(2, '01') })}>NUMERACIÓN</BotonSecundario>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 4. Certificado */}
            <Certificado cfg={cfg} editable={editable} onCargado={cargar} />

            {/* 5. Producción */}
            <div style={seccion}>
                {titulo('AMBIENTE DE PRODUCCIÓN')}
                <p style={{ ...outfit('.86rem'), color: p.txtSf, marginBottom: 10 }}>
                    En PRUEBAS los comprobantes no tienen validez tributaria. Antes de pasar a PRODUCCIÓN: emita en pruebas y verifique que el SRI las AUTORICE,
                    confirme en SRI en Línea que su RUC está habilitado para emitir comprobantes electrónicos y que el certificado es el del emisor.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {Number(cfg?.ambiente) !== 2 && puede('facturacion_config', 'aprobar') && <BotonPrimario color="#10b981" onClick={() => setProduccion(true)}>ACTIVAR PRODUCCIÓN</BotonPrimario>}
                    {Number(cfg?.ambiente) === 2 && editable && <BotonSecundario onClick={async () => { try { await api.post('/facturacion/config/pruebas'); toast.success('Ambiente de pruebas activo.'); cargar(); } catch (err) { toast.error(err.response?.data?.error || 'No se pudo cambiar.'); } }}>VOLVER A PRUEBAS</BotonSecundario>}
                </div>
            </div>

            {punto && <ModalPunto punto={punto} onClose={() => setPunto(null)} onGuardado={() => { setPunto(null); cargar(); }} />}
            {secuencial && <ModalSecuencial datos={secuencial} onClose={() => setSecuencial(null)} onGuardado={() => { setSecuencial(null); cargar(); }} />}
            {produccion && <ModalProduccion d={d} onClose={() => setProduccion(false)} onActivado={() => { setProduccion(false); cargar(); }} />}
        </div>
    );
}

function Certificado({ cfg, editable, onCargado }) {
    const p = usePaleta();
    const [archivo, setArchivo] = useState(null);
    const [clave, setClave] = useState('');
    const [subiendo, setSubiendo] = useState(false);
    const vencido = cfg?.certificado_hasta && new Date(cfg.certificado_hasta) < new Date();
    const diasRestantes = cfg?.certificado_hasta ? Math.floor((new Date(cfg.certificado_hasta) - new Date()) / 86400000) : null;

    const subir = async (e) => {
        e.preventDefault();
        if (!archivo || !clave) return;
        setSubiendo(true);
        const fd = new FormData();
        fd.append('certificado', archivo);
        fd.append('clave', clave);
        try {
            const { data } = await api.post('/facturacion/config/certificado', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            (data.advertencias || []).forEach(a => toast(a, { icon: '⚠️', duration: 8000 }));
            toast.success('Certificado guardado de forma cifrada.');
            setArchivo(null); setClave('');
            e.target.reset();
            onCargado();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo cargar el certificado.'); }
        finally { setSubiendo(false); setClave(''); }
    };

    return (
        <div style={{ background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, padding: 20, marginBottom: 18 }}>
            <p style={{ ...bebas('.82rem', '.18em'), color: p.txt, marginBottom: 12 }}>FIRMA ELECTRÓNICA (.P12)</p>
            {cfg?.certificado_cargado ? (
                <div style={{ ...outfit('.86rem'), color: p.txtSf, display: 'grid', gap: 4, marginBottom: 14 }}>
                    <span><strong>Titular:</strong> {cfg.certificado_titular}</span>
                    <span><strong>Emitido por:</strong> {cfg.certificado_emisor}</span>
                    <span style={{ color: vencido ? '#ef4444' : diasRestantes < 30 ? '#b45309' : p.txtSf }}>
                        <strong>Vigencia:</strong> {fechaHora(cfg.certificado_desde)} → {fechaHora(cfg.certificado_hasta)} {vencido ? '(CADUCADO)' : diasRestantes < 30 ? `(vence en ${diasRestantes} días: renuévelo)` : ''}
                    </span>
                    {cfg.certificado_ruc && <span><strong>RUC/identificación detectado:</strong> {cfg.certificado_ruc}</span>}
                    <span style={{ ...outfit('.74rem'), color: p.mut }}>Huella SHA-256: {cfg.certificado_huella} · cargado {fechaHora(cfg.certificado_cargado_at)}</span>
                </div>
            ) : <p style={{ ...outfit('.86rem'), color: p.mut, marginBottom: 12 }}>No hay certificado cargado.</p>}
            {editable && cfg && (
                <form onSubmit={subir} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label htmlFor="cert-archivo" style={{ display: 'block', marginBottom: 6, ...bebas('.6rem', '.2em'), color: p.SKY_DEEP }}>ARCHIVO .P12 / .PFX</label>
                        <input id="cert-archivo" type="file" accept=".p12,.pfx" onChange={e => setArchivo(e.target.files[0] || null)} style={{ ...outfit('.82rem'), color: p.txt }} />
                    </div>
                    <div>
                        <label htmlFor="cert-clave" style={{ display: 'block', marginBottom: 6, ...bebas('.6rem', '.2em'), color: p.SKY_DEEP }}>CLAVE DEL CERTIFICADO</label>
                        <input id="cert-clave" type="password" autoComplete="new-password" value={clave} onChange={e => setClave(e.target.value)}
                            style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt }} />
                    </div>
                    <BotonPrimario type="submit" disabled={subiendo || !archivo || !clave}>{subiendo ? 'VERIFICANDO...' : cfg.certificado_cargado ? 'REEMPLAZAR CERTIFICADO' : 'CARGAR CERTIFICADO'}</BotonPrimario>
                </form>
            )}
            <p style={{ ...outfit('.74rem'), color: p.mut, marginTop: 10 }}>
                El archivo y su clave se verifican, se cifran (AES-256-GCM) y se guardan en el servidor. Nunca se vuelven a mostrar ni se envían a ningún otro lugar.
                No comparta la clave por chat ni por correo.
            </p>
        </div>
    );
}

function ModalPunto({ punto, onClose, onGuardado }) {
    const p = usePaleta();
    const [f, setF] = useState({ ...punto });
    const [g, setG] = useState(false);
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.86rem') };
    const guardar = async () => {
        setG(true);
        try {
            if (punto.id) await api.put(`/facturacion/config/puntos/${punto.id}`, f); else await api.post('/facturacion/config/puntos', f);
            toast.success('Punto de emisión guardado.');
            onGuardado();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo guardar.'); } finally { setG(false); }
    };
    return (
        <Modal titulo={punto.id ? 'Editar punto de emisión' : 'Nuevo punto de emisión'} etiqueta="FACTURACIÓN · PUNTOS" onClose={onClose} ancho={520}
            subtitulo="Use exactamente los códigos habilitados en el SRI para su RUC.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input aria-label="Establecimiento" value={f.establecimiento} maxLength={3} onChange={e => setF({ ...f, establecimiento: e.target.value.replace(/\D/g, '') })} style={inputSt} placeholder="001" />
                <input aria-label="Punto de emisión" value={f.punto_emision} maxLength={3} onChange={e => setF({ ...f, punto_emision: e.target.value.replace(/\D/g, '') })} style={inputSt} placeholder="001" />
                <input aria-label="Dirección del establecimiento" value={f.direccion} maxLength={300} onChange={e => setF({ ...f, direccion: e.target.value })} style={{ ...inputSt, gridColumn: 'span 2' }} placeholder="Dirección del establecimiento" />
                <input aria-label="Descripción" value={f.descripcion || ''} maxLength={120} onChange={e => setF({ ...f, descripcion: e.target.value })} style={{ ...inputSt, gridColumn: 'span 2' }} placeholder="Descripción (ej. Caja principal)" />
                <label style={{ display: 'flex', gap: 8, ...outfit('.85rem'), color: p.txt }}><input type="checkbox" checked={f.activo !== false} onChange={e => setF({ ...f, activo: e.target.checked })} /> Activo</label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                <BotonPrimario disabled={g} onClick={guardar}>GUARDAR</BotonPrimario>
            </div>
        </Modal>
    );
}

function ModalSecuencial({ datos, onClose, onGuardado }) {
    const p = usePaleta();
    const [f, setF] = useState({ ambiente: datos.ambiente, cod_doc: datos.cod_doc, ultimo_usado: datos.ultimo_usado });
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.86rem') };
    const guardar = async () => {
        try {
            const { data } = await api.put(`/facturacion/config/puntos/${datos.punto.id}/secuencial`, { ...f, ultimo_usado: Number(f.ultimo_usado) });
            toast.success(`El próximo número será ${String(data.siguiente).padStart(9, '0')}.`);
            onGuardado();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo guardar.'); }
    };
    return (
        <Modal titulo={`Numeración ${datos.punto.establecimiento}-${datos.punto.punto_emision}`} etiqueta="FACTURACIÓN · SECUENCIAL" onClose={onClose} ancho={500}
            subtitulo="Solo si ya emitía comprobantes electrónicos con otro sistema: indique el ÚLTIMO número usado. La numeración solo puede avanzar.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select aria-label="Ambiente" value={f.ambiente} onChange={e => setF({ ...f, ambiente: Number(e.target.value) })} style={inputSt}><option value={2}>Producción</option><option value={1}>Pruebas</option></select>
                <select aria-label="Tipo" value={f.cod_doc} onChange={e => setF({ ...f, cod_doc: e.target.value })} style={inputSt}><option value="01">Facturas</option><option value="04">Notas de crédito</option></select>
                <input aria-label="Último número usado" type="number" min="0" value={f.ultimo_usado} onChange={e => setF({ ...f, ultimo_usado: e.target.value })} style={{ ...inputSt, gridColumn: 'span 2' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                <BotonPrimario onClick={guardar}>GUARDAR</BotonPrimario>
            </div>
        </Modal>
    );
}

function ModalProduccion({ d, onClose, onActivado }) {
    const p = usePaleta();
    const [habilitado, setHabilitado] = useState(false);
    const [texto, setTexto] = useState('');
    const [g, setG] = useState(false);
    const lista = [
        ['Configuración completa', d.faltantes.length === 0],
        ['Al menos una factura AUTORIZADA en pruebas', d.autorizados_en_pruebas > 0],
        ['Certificado vigente cargado', Boolean(d.config?.certificado_cargado)],
    ];
    const activar = async () => {
        setG(true);
        try {
            await api.post('/facturacion/config/produccion', { confirmacion: texto, confirmo_habilitacion_sri: habilitado });
            toast.success('Ambiente de PRODUCCIÓN activo: los nuevos comprobantes tienen validez tributaria.');
            onActivado();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo activar.'); } finally { setG(false); }
    };
    return (
        <Modal titulo="Activar producción" etiqueta="FACTURACIÓN · AMBIENTE" color="#10b981" onClose={onClose} ancho={560}
            subtitulo="Desde ese momento cada factura emitida tendrá validez tributaria y consumirá la numeración real.">
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', ...outfit('.88rem') }}>
                {lista.map(([t, ok]) => <li key={t} style={{ color: ok ? '#10b981' : '#ef4444', marginBottom: 4 }}>{ok ? '✓' : '✗'} {t}</li>)}
            </ul>
            <label style={{ display: 'flex', gap: 10, ...outfit('.86rem'), color: p.txt, marginBottom: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={habilitado} onChange={e => setHabilitado(e.target.checked)} />
                Verifiqué en SRI en Línea que el RUC está habilitado para emitir comprobantes electrónicos en producción.
            </label>
            <input aria-label="Confirmación" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escriba ACTIVAR PRODUCCION"
                style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.88rem') }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                <BotonPrimario color="#10b981" disabled={g || !habilitado || texto !== 'ACTIVAR PRODUCCION' || lista.some(([, ok]) => !ok)} onClick={activar}>ACTIVAR</BotonPrimario>
            </div>
        </Modal>
    );
}
