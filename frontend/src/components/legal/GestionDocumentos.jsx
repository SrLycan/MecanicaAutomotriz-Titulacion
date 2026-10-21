/**
 * SS SWAP - Gestión de documentos legales (empresa o plataforma)
 *
 *  - Documentos con su historial de versiones (borrador → publicada → retirada).
 *  - Redactar un borrador (desde cero o desde una plantilla marcada para
 *    revisión profesional), previsualizarlo y publicarlo. Una versión
 *    publicada no se edita: para cambiarla se crea otra.
 *  - Publicar distingue cambio MATERIAL (exige nueva aceptación) de
 *    informativo.
 *  - Evidencia: aceptaciones con filtros y constancias PDF; pendientes.
 *
 * ambito = 'empresa' (documentos para los clientes del portal) o
 * 'plataforma' (los aceptan las empresas; solo superadministrador).
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePaleta, bebas, outfit, BotonPrimario, BotonSecundario, Pildora, Modal } from '../common/PanelUI';
import LectorDocumento from './LectorDocumento';
import { descargar, fechaHora } from '../../pages/facturacion/comun';

const ESTADO_COLOR = { borrador: '#64748b', publicada: '#10b981', retirada: '#94a3b8' };

export default function GestionDocumentos({ ambito = 'empresa' }) {
    const p = usePaleta();
    const { puede, esSuperadmin } = useAuth();
    const plataforma = ambito === 'plataforma';
    const puedeEditar = plataforma ? esSuperadmin : puede('legal', 'editar');
    const puedePublicar = plataforma ? esSuperadmin : puede('legal', 'aprobar');
    const q = plataforma ? '?ambito=plataforma' : '';
    const cuerpo = (b = {}) => (plataforma ? { ...b, ambito: 'plataforma' } : b);

    const [tab, setTab] = useState('documentos');
    const [datos, setDatos] = useState(null);
    const [lectura, setLectura] = useState(null);
    const [editor, setEditor] = useState(null);   // { documento, version? }
    const [publicar, setPublicar] = useState(null);
    const [nuevo, setNuevo] = useState(false);

    const cargar = useCallback(async () => {
        try { setDatos((await api.get(`/legal/documentos${q}`)).data); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudieron cargar los documentos.'); }
    }, [q]);
    useEffect(() => { cargar(); }, [cargar]);

    const verVersion = async (v, doc) => {
        try {
            const { data } = await api.get(`/legal/versiones/${v.id}${q}`);
            setLectura({ ...data.version, titulo: doc.titulo });
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo abrir la versión.'); }
    };

    if (!datos) return <div className="sk-pulse" style={{ height: 260, borderRadius: 16, background: p.card }} />;
    const tabSt = (t) => ({ ...bebas('.72rem', '.16em'), padding: '9px 16px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${tab === t ? p.SKY_DEEP : p.bdr}`, background: tab === t ? p.SKY_PALE : 'none', color: tab === t ? p.SKY_DEEP : p.mut });

    return (
        <div>
            <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button role="tab" aria-selected={tab === 'documentos'} style={tabSt('documentos')} onClick={() => setTab('documentos')}>DOCUMENTOS Y VERSIONES</button>
                <button role="tab" aria-selected={tab === 'aceptaciones'} style={tabSt('aceptaciones')} onClick={() => setTab('aceptaciones')}>ACEPTACIONES (EVIDENCIA)</button>
                {!plataforma && <button role="tab" aria-selected={tab === 'pendientes'} style={tabSt('pendientes')} onClick={() => setTab('pendientes')}>PENDIENTES</button>}
            </div>

            {tab === 'documentos' && (
                <>
                    <div role="note" style={{ padding: '12px 14px', borderRadius: 11, border: '1px solid #f59e0b55', background: '#f59e0b12', ...outfit('.83rem'), color: p.txtSf, marginBottom: 14 }}>
                        Las plantillas son <strong>borradores</strong> para adaptar al servicio real. Las cláusulas marcadas [REVISIÓN PROFESIONAL] deben validarse con un abogado ecuatoriano antes de publicar.
                        Al publicar, el texto y su huella quedan fijos: no se podrán cambiar ni borrar.
                    </div>
                    {puedeEditar && <div style={{ marginBottom: 14 }}><BotonPrimario onClick={() => setNuevo(true)}>+ NUEVO DOCUMENTO</BotonPrimario></div>}
                    {datos.documentos.length === 0 && <p style={{ ...outfit('.88rem'), color: p.mut }}>Aún no hay documentos.</p>}
                    <div style={{ display: 'grid', gap: 14 }}>
                        {datos.documentos.map(doc => {
                            const borrador = doc.versiones.find(v => v.estado === 'borrador');
                            const vigente = doc.versiones.find(v => v.estado === 'publicada');
                            return (
                                <div key={doc.id} style={{ background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, padding: 16, opacity: doc.activo ? 1 : 0.65 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                        <div>
                                            <p style={{ ...bebas('1.1rem', '.05em'), color: p.txt }}>{doc.titulo}</p>
                                            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                                <Pildora color={p.SKY_DEEP}>{doc.nombre_tipo}</Pildora>
                                                <Pildora color={doc.obligatorio ? '#8b5cf6' : '#64748b'}>{doc.obligatorio ? 'OBLIGATORIO' : 'OPCIONAL'}</Pildora>
                                                {!doc.activo && <Pildora color="#94a3b8">DESACTIVADO PARA NUEVAS ACEPTACIONES</Pildora>}
                                                {vigente ? <Pildora color="#10b981">VIGENTE: V{vigente.version}</Pildora> : <Pildora color="#f59e0b">SIN VERSIÓN PUBLICADA</Pildora>}
                                            </div>
                                        </div>
                                        {puedeEditar && (
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {!borrador && <BotonSecundario color={p.SKY_DEEP} onClick={async () => {
                                                    // La nueva versión parte del texto vigente (si hay) para editar solo lo que cambia.
                                                    const base = vigente ? (await api.get(`/legal/versiones/${vigente.id}${q}`)).data.version : null;
                                                    setEditor({ documento: doc, base });
                                                }}>NUEVA VERSIÓN</BotonSecundario>}
                                                <BotonSecundario onClick={async () => {
                                                    try { await api.put(`/legal/documentos/${doc.id}${q}`, cuerpo({ activo: !doc.activo })); cargar(); }
                                                    catch (err) { toast.error(err.response?.data?.error || 'No se pudo cambiar.'); }
                                                }}>{doc.activo ? 'DESACTIVAR' : 'ACTIVAR'}</BotonSecundario>
                                            </div>
                                        )}
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                                        <tbody>
                                            {doc.versiones.map(v => (
                                                <tr key={v.id} style={{ borderTop: `1px solid ${p.bdr}`, ...outfit('.82rem'), color: p.txtSf }}>
                                                    <td style={{ padding: '7px 4px', whiteSpace: 'nowrap' }}><strong>v{v.version}</strong></td>
                                                    <td style={{ padding: '7px 4px' }}><span style={{ color: ESTADO_COLOR[v.estado], ...bebas('.76rem') }}>{v.estado.toUpperCase()}</span>{v.cambio_material && v.estado !== 'borrador' && <span style={{ ...bebas('.72rem'), color: '#8b5cf6', marginLeft: 6 }}>CAMBIO MATERIAL</span>}</td>
                                                    <td style={{ padding: '7px 4px' }}>{v.vigente_desde ? `vigente desde ${String(v.vigente_desde).slice(0, 10)}` : 'sin publicar'}{v.publicada_por_nombre ? ` · ${v.publicada_por_nombre}` : ''}</td>
                                                    <td style={{ padding: '7px 4px' }}>{v.aceptaciones} aceptación(es)</td>
                                                    <td style={{ padding: '7px 4px' }}>{v.revision_profesional === 'revisado' ? '✓ revisado por profesional' : 'revisión profesional pendiente'}</td>
                                                    <td style={{ padding: '7px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <button type="button" onClick={() => verVersion(v, doc)} style={{ background: 'none', border: 'none', color: p.SKY_DEEP, cursor: 'pointer', ...bebas('.76rem') }}>VER</button>
                                                        {v.estado === 'borrador' && puedeEditar && <button type="button" onClick={async () => setEditor({ documento: doc, version: (await api.get(`/legal/versiones/${v.id}${q}`)).data.version })} style={{ background: 'none', border: 'none', color: p.SKY_DEEP, cursor: 'pointer', ...bebas('.76rem') }}>EDITAR</button>}
                                                        {v.estado === 'borrador' && puedePublicar && <button type="button" onClick={() => setPublicar({ documento: doc, version: v, primera: !doc.versiones.some(x => x.estado !== 'borrador') })} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', ...bebas('.76rem') }}>PUBLICAR</button>}
                                                        {v.estado === 'borrador' && puedeEditar && <button type="button" onClick={async () => { try { await api.delete(`/legal/versiones/${v.id}${q}`); cargar(); } catch (err) { toast.error(err.response?.data?.error || 'No se pudo eliminar.'); } }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', ...bebas('.76rem') }}>ELIMINAR</button>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {tab === 'aceptaciones' && <Aceptaciones q={q} documentos={datos.documentos} />}
            {tab === 'pendientes' && !plataforma && <Pendientes />}

            {lectura && <LectorDocumento doc={lectura} onClose={() => setLectura(null)} />}
            {nuevo && <ModalNuevoDocumento tipos={datos.tipos} ambito={ambito} q={q} cuerpo={cuerpo} onClose={() => setNuevo(false)} onCreado={() => { setNuevo(false); cargar(); }} />}
            {editor && <ModalEditor editor={editor} plantillas={datos.plantillas.filter(t => t.ambito === (plataforma ? 'plataforma' : 'empresa'))} q={q} cuerpo={cuerpo}
                onClose={() => setEditor(null)} onGuardado={() => { setEditor(null); cargar(); }} />}
            {publicar && <ModalPublicar datos={publicar} q={q} cuerpo={cuerpo} onClose={() => setPublicar(null)} onPublicado={() => { setPublicar(null); cargar(); }} />}
        </div>
    );
}

function ModalNuevoDocumento({ tipos, ambito, q, cuerpo, onClose, onCreado }) {
    const p = usePaleta();
    const [f, setF] = useState({ tipo: 'terminos', titulo: '', obligatorio: true });
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.86rem') };
    const crear = async () => {
        try {
            await api.post(`/legal/documentos${q}`, cuerpo({ ...f, titulo: f.titulo || tipos[f.tipo], obligatorio: f.tipo === 'autorizacion_datos' ? false : f.obligatorio }));
            toast.success('Documento creado. Ahora redacte su primera versión.');
            onCreado();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo crear.'); }
    };
    return (
        <Modal titulo="Nuevo documento" etiqueta={ambito === 'plataforma' ? 'PLATAFORMA · LEGAL' : 'EMPRESA · LEGAL'} onClose={onClose} ancho={520}
            subtitulo={ambito === 'plataforma' ? 'Lo aceptarán las empresas que contratan la plataforma.' : 'Lo aceptarán los clientes de su portal al registrarse.'}>
            <div style={{ display: 'grid', gap: 10 }}>
                <select aria-label="Tipo de documento" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} style={inputSt}>
                    {Object.entries(tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input aria-label="Título" value={f.titulo} maxLength={200} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder={tipos[f.tipo]} style={inputSt} />
                {f.tipo === 'autorizacion_datos'
                    ? <p style={{ ...outfit('.8rem'), color: p.mut }}>Las autorizaciones específicas de datos son OPCIONALES y separadas de los términos: se pueden revocar.</p>
                    : <label style={{ display: 'flex', gap: 8, ...outfit('.85rem'), color: p.txt }}><input type="checkbox" checked={f.obligatorio} onChange={e => setF({ ...f, obligatorio: e.target.checked })} /> Obligatorio para registrarse / contratar</label>}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                <BotonPrimario onClick={crear}>CREAR</BotonPrimario>
            </div>
        </Modal>
    );
}

function ModalEditor({ editor, plantillas, q, cuerpo, onClose, onGuardado }) {
    const p = usePaleta();
    const v = editor.version;
    const [texto, setTexto] = useState(v?.contenido || editor.base?.contenido || '');
    const [material, setMaterial] = useState(Boolean(v?.cambio_material));
    const [resumen, setResumen] = useState(v?.resumen_cambios || '');
    const [revisado, setRevisado] = useState(v?.revision_profesional === 'revisado');
    const [g, setG] = useState(false);
    const cargarPlantilla = async (archivo) => {
        if (!archivo) return;
        try { setTexto((await api.get(`/legal/plantillas/${archivo}${q}`)).data.contenido); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudo cargar la plantilla.'); }
    };
    const guardar = async () => {
        setG(true);
        try {
            const b = cuerpo({ contenido: texto, cambio_material: material, resumen_cambios: resumen, revision_profesional: revisado ? 'revisado' : 'pendiente' });
            if (v) await api.put(`/legal/versiones/${v.id}${q}`, b);
            else await api.post(`/legal/documentos/${editor.documento.id}/versiones${q}`, b);
            toast.success('Borrador guardado.');
            onGuardado();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo guardar.'); } finally { setG(false); }
    };
    return (
        <Modal titulo={`${editor.documento.titulo} — ${v ? `borrador v${v.version}` : 'nueva versión'}`} etiqueta="LEGAL · REDACCIÓN" ancho={900} onClose={onClose}
            subtitulo="Texto plano. Puede partir de una plantilla y adaptarla al servicio real.">
            {plantillas.length > 0 && (
                <select aria-label="Cargar plantilla" defaultValue="" onChange={e => cargarPlantilla(e.target.value)}
                    style={{ padding: 9, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.84rem'), marginBottom: 10 }}>
                    <option value="">Cargar una plantilla de borrador…</option>
                    {plantillas.map(t => <option key={t.archivo} value={t.archivo}>{t.titulo}</option>)}
                </select>
            )}
            <textarea aria-label="Texto del documento" value={texto} onChange={e => setTexto(e.target.value)} rows={18}
                style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '.82rem', lineHeight: 1.5 }} />
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {(editor.base || v?.version > 1) && (
                    <label style={{ display: 'flex', gap: 8, ...outfit('.85rem'), color: p.txt }}><input type="checkbox" checked={material} onChange={e => setMaterial(e.target.checked)} /> Cambio MATERIAL (exigirá que todos vuelvan a aceptar)</label>
                )}
                <input aria-label="Resumen de cambios" value={resumen} maxLength={1000} onChange={e => setResumen(e.target.value)} placeholder="Resumen de los cambios (se muestra a quienes deben volver a aceptar)"
                    style={{ padding: 10, borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.85rem') }} />
                <label style={{ display: 'flex', gap: 8, ...outfit('.85rem'), color: p.txt }}><input type="checkbox" checked={revisado} onChange={e => setRevisado(e.target.checked)} /> Un profesional del derecho revisó este texto</label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                <BotonPrimario disabled={g || texto.trim().length < 50} onClick={guardar}>GUARDAR BORRADOR</BotonPrimario>
            </div>
        </Modal>
    );
}

function ModalPublicar({ datos, q, cuerpo, onClose, onPublicado }) {
    const p = usePaleta();
    const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
    const [vigente, setVigente] = useState(hoy);
    const [material, setMaterial] = useState(datos.primera ? true : Boolean(datos.version.cambio_material));
    const [confirmo, setConfirmo] = useState(false);
    const pendienteRevision = datos.version.revision_profesional !== 'revisado';
    const publicar = async () => {
        try {
            const { data } = await api.post(`/legal/versiones/${datos.version.id}/publicar${q}`, cuerpo({ vigente_desde: vigente, cambio_material: material, confirmacion: true }));
            toast.success(`Versión ${data.version.version} publicada.${data.notificados ? ` ${data.notificados} persona(s) deberán volver a aceptar.` : ''}`);
            onPublicado();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo publicar.'); }
    };
    return (
        <Modal titulo={`Publicar ${datos.documento.titulo} v${datos.version.version}`} etiqueta="LEGAL · PUBLICACIÓN" color="#10b981" onClose={onClose} ancho={560}
            subtitulo="Publicada, la versión queda fija (texto y huella SHA-256). La versión anterior se conserva como retirada.">
            {pendienteRevision && <p role="alert" style={{ ...outfit('.84rem'), color: '#b45309', marginBottom: 10 }}>Esta versión no está marcada como revisada por un profesional.</p>}
            <div style={{ display: 'grid', gap: 10 }}>
                <label style={{ ...outfit('.85rem'), color: p.txt }}>Vigente desde{' '}
                    <input type="date" value={vigente} onChange={e => setVigente(e.target.value)} style={{ padding: 8, borderRadius: 9, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt }} />
                </label>
                {datos.primera
                    ? <p style={{ ...outfit('.82rem'), color: p.mut }}>Primera versión: todos deberán aceptarla.</p>
                    : <label style={{ display: 'flex', gap: 8, ...outfit('.85rem'), color: p.txt }}><input type="checkbox" checked={material} onChange={e => setMaterial(e.target.checked)} /> Cambio material: pedir nueva aceptación antes de aplicarlo</label>}
                <label style={{ display: 'flex', gap: 8, ...outfit('.85rem'), color: p.txt }}><input type="checkbox" checked={confirmo} onChange={e => setConfirmo(e.target.checked)} /> Revisé el texto completo y quiero publicarlo</label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                <BotonPrimario color="#10b981" disabled={!confirmo} onClick={publicar}>PUBLICAR</BotonPrimario>
            </div>
        </Modal>
    );
}

function Aceptaciones({ q, documentos }) {
    const p = usePaleta();
    const [f, setF] = useState({ documento_id: '', q: '', desde: '', hasta: '' });
    const [filas, setFilas] = useState(null);
    useEffect(() => {
        const t = setTimeout(async () => {
            const params = new URLSearchParams(q.replace('?', ''));
            Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
            try { setFilas((await api.get(`/legal/aceptaciones?${params}`)).data.aceptaciones); } catch { setFilas([]); }
        }, 250);
        return () => clearTimeout(t);
    }, [f, q]);
    const sel = { padding: '8px 10px', borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.82rem') };
    return (
        <div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <select aria-label="Documento" value={f.documento_id} onChange={e => setF({ ...f, documento_id: e.target.value })} style={sel}>
                    <option value="">Todos los documentos</option>
                    {documentos.map(d => <option key={d.id} value={d.id}>{d.titulo}</option>)}
                </select>
                <input aria-label="Buscar persona" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="Nombre o correo" style={{ ...sel, minWidth: 200 }} />
                <input aria-label="Desde" type="date" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} style={sel} />
                <input aria-label="Hasta" type="date" value={f.hasta} onChange={e => setF({ ...f, hasta: e.target.value })} style={sel} />
            </div>
            {!filas ? <p style={{ ...outfit('.85rem'), color: p.mut }}>Cargando…</p> : filas.length === 0 ? <p style={{ ...outfit('.85rem'), color: p.mut }}>Sin aceptaciones para estos filtros.</p> : (
                <div style={{ overflowX: 'auto', background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                        <thead><tr>{['Fecha (servidor)', 'Persona', 'Empresa', 'Documento', 'Evento', 'Contexto', 'IP', ''].map(h => <th key={h} style={{ ...bebas('.72rem', '.18em'), color: p.SKY_DEEP, textAlign: 'left', padding: 8 }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {filas.map(a => (
                                <tr key={a.id} style={{ borderTop: `1px solid ${p.bdr}`, ...outfit('.8rem'), color: p.txtSf }}>
                                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{fechaHora(a.aceptado_at)}</td>
                                    <td style={{ padding: 8 }}>{a.nombre_aceptante || a.usuario_nombre}<span style={{ display: 'block', color: p.mut, fontSize: '.72rem' }}>{a.usuario_email}</span></td>
                                    <td style={{ padding: 8 }}>{a.empresa_nombre}</td>
                                    <td style={{ padding: 8 }}>{a.titulo} v{a.version}</td>
                                    <td style={{ padding: 8, color: a.evento === 'revocacion' ? '#ef4444' : '#10b981' }}>{a.evento}</td>
                                    <td style={{ padding: 8 }}>{a.contexto.replace(/_/g, ' ')}</td>
                                    <td style={{ padding: 8 }}>{a.ip || '—'}</td>
                                    <td style={{ padding: 8 }}><button type="button" onClick={() => descargar(`/legal/constancias/${a.transaccion_id}${q}`, 'constancia.pdf')} style={{ background: 'none', border: 'none', color: p.SKY_DEEP, cursor: 'pointer', ...bebas('.75rem') }}>CONSTANCIA</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Pendientes() {
    const p = usePaleta();
    const [d, setD] = useState(null);
    useEffect(() => { api.get('/legal/pendientes-resumen').then(({ data }) => setD(data.documentos)).catch(() => setD([])); }, []);
    if (!d) return <p style={{ ...outfit('.85rem'), color: p.mut }}>Cargando…</p>;
    if (!d.length) return <p style={{ ...outfit('.85rem'), color: p.mut }}>No hay documentos obligatorios publicados para el portal.</p>;
    return (
        <div style={{ display: 'grid', gap: 12 }}>
            {d.map(x => (
                <div key={x.documento_id} style={{ background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 12, padding: 14 }}>
                    <p style={{ ...bebas('1rem', '.05em'), color: p.txt }}>{x.titulo} — v{x.version} (se exige desde v{x.version_exigida})</p>
                    <p style={{ ...outfit('.84rem'), color: x.pendientes ? '#b45309' : '#10b981', marginTop: 4 }}>
                        {x.pendientes ? `${x.pendientes} cliente(s) del portal aún no la aceptan. Se les pedirá al ingresar.` : 'Todos los clientes del portal la aceptaron.'}
                    </p>
                    {x.usuarios.length > 0 && <p style={{ ...outfit('.78rem'), color: p.mut, marginTop: 6 }}>{x.usuarios.slice(0, 15).map(u => u.nombre).join(', ')}{x.usuarios.length > 15 ? '…' : ''}</p>}
                </div>
            ))}
        </div>
    );
}
