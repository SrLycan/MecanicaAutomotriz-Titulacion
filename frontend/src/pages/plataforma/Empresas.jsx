/**
 * SS SWAP - Plataforma: Empresas (solo superadministrador)
 *
 * Alta de mecánicas con su administrador inicial (contraseña temporal que
 * se muestra una sola vez), edición de datos generales, suspensión /
 * reactivación con motivo, restablecimiento del acceso del administrador y
 * accesos de SOPORTE (solo si la empresa lo autorizó; con motivo, tiempo
 * límite y modo lectura o completo). Aquí solo se ven conteos: nunca datos
 * de clientes ni documentos de las empresas.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { usePaleta, bebas, outfit, Pildora, BotonPrimario, BotonSecundario, Modal, KpiCard } from '../../components/common/PanelUI';
import EditorLogo, { validarArchivoLogo } from '../../components/common/EditorLogo';
import { LogoEmpresa } from '../../components/common/MarcaEmpresa';
import '../Usuarios.css';

const COLOR_ESTADO = { activa: '#10b981', suspendida: '#f59e0b', inactiva: '#ef4444' };
const fecha = (v) => (v ? new Date(v).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function CampoTexto({ id, label, value, onChange, ...resto }) {
    const p = usePaleta();
    return (
        <div>
            <label htmlFor={id} style={{ display: 'block', marginBottom: 6, ...bebas('.62rem', '.22em'), color: p.SKY_DEEP }}>{label}</label>
            <input id={id} value={value} onChange={e => onChange(e.target.value)} {...resto}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.88rem'), outline: 'none' }} />
        </div>
    );
}

function ModalPassword({ titulo, email, password, onClose }) {
    const p = usePaleta();
    const copiar = async () => {
        try { await navigator.clipboard.writeText(password); toast.success('Copiada.'); } catch { toast.error('Cópiala a mano.'); }
    };
    return (
        <Modal titulo={titulo} etiqueta="PLATAFORMA · ACCESO" color="#f59e0b" onClose={onClose} ancho={460}
            subtitulo={`Administrador: ${email}. Se muestra UNA sola vez: entrégala en persona y pide que la cambie en "Mi cuenta".`}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 16, borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.35)' }}>
                <code style={{ flex: 1, fontSize: '1.2rem', letterSpacing: '.08em', color: p.txt, userSelect: 'all' }}>{password}</code>
                <BotonSecundario color="#f59e0b" onClick={copiar}>COPIAR</BotonSecundario>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}><BotonPrimario onClick={onClose}>LISTO</BotonPrimario></div>
        </Modal>
    );
}

function ModalEmpresa({ empresa, onClose, onGuardada }) {
    const nueva = !empresa;
    const [f, setF] = useState({
        nombre: empresa?.nombre || '', slug: '', nombre_comercial: empresa?.nombre_comercial || '', razon_social: empresa?.razon_social || '',
        ruc: empresa?.ruc || '', direccion: empresa?.direccion || '', telefono: empresa?.telefono || '', email: empresa?.email || '',
        admin_nombre: '', admin_email: '',
    });
    const [saving, setSaving] = useState(false);
    const [actual, setActual] = useState(empresa);          // para refrescar el logo al editar
    const [logoNuevo, setLogoNuevo] = useState(null);        // { archivo, preview } al crear
    const set = (k) => (v) => setF({ ...f, [k]: v });
    useEffect(() => () => { if (logoNuevo) URL.revokeObjectURL(logoNuevo.preview); }, [logoNuevo]);

    const elegirLogo = (e) => {
        const archivo = e.target.files?.[0];
        e.target.value = '';
        if (!archivo) return;
        const error = validarArchivoLogo(archivo);
        if (error) { toast.error(error); return; }
        setLogoNuevo({ archivo, preview: URL.createObjectURL(archivo) });
    };

    const enviar = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const datos = { nombre: f.nombre, nombre_comercial: f.nombre_comercial, razon_social: f.razon_social, ruc: f.ruc, direccion: f.direccion, telefono: f.telefono, email: f.email };
            const { data } = nueva
                ? await api.post('/plataforma/empresas', { ...datos, slug: f.slug || undefined, admin: { nombre: f.admin_nombre, email: f.admin_email } })
                : await api.put(`/plataforma/empresas/${empresa.id}`, datos);
            // El logo se sube cuando la empresa ya existe (necesita su id).
            if (nueva && logoNuevo) {
                try {
                    const fd = new FormData();
                    fd.append('logo', logoNuevo.archivo);
                    await api.post(`/plataforma/empresas/${data.empresa.id}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                } catch (errLogo) {
                    toast.error(`Empresa creada, pero el logo no se guardó: ${errLogo.response?.data?.error || 'intenta de nuevo desde Editar.'}`);
                }
            }
            toast.success(nueva ? 'Empresa creada.' : 'Empresa actualizada.');
            onGuardada(data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo guardar la empresa.');
        } finally { setSaving(false); }
    };

    return (
        <Modal titulo={nueva ? 'Nueva empresa' : `Editar ${empresa.nombre}`} etiqueta="PLATAFORMA · EMPRESAS" onClose={onClose} ancho={760}
            subtitulo={nueva ? 'La empresa empieza vacía: no se copia ningún dato de otra mecánica.' : 'El identificador y el estado no se cambian aquí.'}>
            <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 13 }}>
                    <CampoTexto id="e-nombre" label="NOMBRE *" value={f.nombre} onChange={set('nombre')} required maxLength={120} />
                    {nueva && <CampoTexto id="e-slug" label="IDENTIFICADOR (OPCIONAL)" value={f.slug} onChange={set('slug')} maxLength={60} placeholder="taller-ejemplo" />}
                    <CampoTexto id="e-nc" label="NOMBRE COMERCIAL" value={f.nombre_comercial} onChange={set('nombre_comercial')} maxLength={160} />
                    <CampoTexto id="e-rs" label="RAZÓN SOCIAL" value={f.razon_social} onChange={set('razon_social')} maxLength={160} />
                    <CampoTexto id="e-ruc" label="RUC" value={f.ruc} onChange={set('ruc')} maxLength={20} />
                    <CampoTexto id="e-dir" label="DIRECCIÓN" value={f.direccion} onChange={set('direccion')} maxLength={255} />
                    <CampoTexto id="e-tel" label="TELÉFONO" value={f.telefono} onChange={set('telefono')} maxLength={30} />
                    <CampoTexto id="e-mail" label="CORREO" type="email" value={f.email} onChange={set('email')} maxLength={150} />
                </div>
                <div>
                    <p style={{ ...bebas('.8rem', '.18em'), marginBottom: 8 }}>LOGOTIPO</p>
                    {nueva ? (
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ width: 180, height: 100, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', padding: 8, boxSizing: 'border-box' }}>
                                {logoNuevo
                                    ? <img src={logoNuevo.preview} alt="Vista previa del logo" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                                    : <LogoEmpresa empresa={{ nombre: f.nombre || '?' }} alto={82} />}
                            </div>
                            <label style={{ ...bebas('.72rem'), cursor: 'pointer', padding: '9px 16px', borderRadius: 10, border: '1px solid #94a3b8' }}>
                                {logoNuevo ? 'CAMBIAR IMAGEN' : 'ELEGIR LOGO (PNG/JPG, MÁX. 2 MB)'}
                                <input type="file" accept="image/png,image/jpeg" onChange={elegirLogo} style={{ display: 'none' }} />
                            </label>
                            {logoNuevo && <BotonSecundario onClick={() => setLogoNuevo(null)}>QUITAR</BotonSecundario>}
                        </div>
                    ) : (
                        <EditorLogo empresa={actual} rutaBase={`/plataforma/empresas/${empresa.id}`} editable onGuardado={setActual} />
                    )}
                </div>
                {nueva && (
                    <div>
                        <p style={{ ...bebas('.8rem', '.18em'), marginBottom: 8 }}>ADMINISTRADOR INICIAL</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 13 }}>
                            <CampoTexto id="e-an" label="NOMBRE *" value={f.admin_nombre} onChange={set('admin_nombre')} required maxLength={100} />
                            <CampoTexto id="e-ae" label="CORREO (USUARIO DE ACCESO) *" type="email" value={f.admin_email} onChange={set('admin_email')} required maxLength={150} />
                        </div>
                        <p style={{ ...outfit('.76rem', 300), marginTop: 6, opacity: .8 }}>Se genera una contraseña temporal segura. Tendrá los permisos de administrador de su empresa y podrá crear a su personal.</p>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                    <BotonPrimario type="submit" disabled={saving}>{saving ? 'GUARDANDO...' : nueva ? 'CREAR EMPRESA' : 'GUARDAR'}</BotonPrimario>
                </div>
            </form>
        </Modal>
    );
}

function ModalSoporte({ empresa, onClose }) {
    const p = usePaleta();
    const { iniciarSoporte } = useAuth();
    const [f, setF] = useState({ motivo: '', minutos: 60, modo: 'lectura' });
    const [saving, setSaving] = useState(false);
    const enviar = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post(`/plataforma/empresas/${empresa.id}/soporte`, { ...f, minutos: Number(f.minutos) });
            toast.success('Acceso de soporte abierto.');
            iniciarSoporte(empresa);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo abrir el acceso.');
            setSaving(false);
        }
    };
    const ctrl = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.88rem') };
    return (
        <Modal titulo={`Soporte a ${empresa.nombre}`} etiqueta="PLATAFORMA · SOPORTE" color="#f59e0b" onClose={onClose} ancho={560}
            subtitulo="El acceso es temporal y cada acción queda en la auditoría de la empresa.">
            <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div>
                    <label htmlFor="s-motivo" style={{ display: 'block', marginBottom: 6, ...bebas('.62rem', '.22em'), color: p.SKY_DEEP }}>MOTIVO * (MÍNIMO 10 CARACTERES)</label>
                    <textarea id="s-motivo" value={f.motivo} onChange={e => setF({ ...f, motivo: e.target.value })} required minLength={10} maxLength={300} rows={3} style={ctrl} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                    <div>
                        <label htmlFor="s-min" style={{ display: 'block', marginBottom: 6, ...bebas('.62rem', '.22em'), color: p.SKY_DEEP }}>DURACIÓN</label>
                        <select id="s-min" value={f.minutos} onChange={e => setF({ ...f, minutos: e.target.value })} style={ctrl}>
                            {[15, 30, 60, 120, 240, 480].map(m => <option key={m} value={m}>{m < 60 ? `${m} minutos` : `${m / 60} hora(s)`}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="s-modo" style={{ display: 'block', marginBottom: 6, ...bebas('.62rem', '.22em'), color: p.SKY_DEEP }}>MODO</label>
                        <select id="s-modo" value={f.modo} onChange={e => setF({ ...f, modo: e.target.value })} style={ctrl}>
                            <option value="lectura">Solo lectura</option>
                            <option value="completo">Completo (puede modificar)</option>
                        </select>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                    <BotonPrimario type="submit" disabled={saving} color="#d97706">{saving ? 'ABRIENDO...' : 'ENTRAR EN MODO SOPORTE'}</BotonPrimario>
                </div>
            </form>
        </Modal>
    );
}

export default function Empresas() {
    const p = usePaleta();
    const confirm = useConfirm();
    const [params] = useSearchParams();
    const [empresas, setEmpresas] = useState([]);
    const [resumen, setResumen] = useState(null);
    const [accesos, setAccesos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [modal, setModal] = useState(null); // { tipo: 'empresa'|'soporte', empresa }
    const [password, setPassword] = useState(null);

    const cargar = useCallback(async () => {
        try {
            const [e, r, a] = await Promise.all([api.get('/plataforma/empresas'), api.get('/plataforma/resumen'), api.get('/plataforma/soporte')]);
            setEmpresas(e.data.empresas); setResumen(r.data); setAccesos(a.data.accesos);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo cargar la plataforma.');
        } finally { setCargando(false); }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => { if (params.get('soporte') === 'vencido') toast('El acceso de soporte venció o fue cerrado.', { icon: '⏱️' }); }, [params]);

    const cambiarEstado = async (e, estado) => {
        let motivo;
        if (estado !== 'activa') {
            motivo = window.prompt(`Motivo para ${estado === 'suspendida' ? 'suspender' : 'desactivar'} "${e.nombre}" (queda en la auditoría):`);
            if (!motivo) return;
        } else if (!(await confirm({ title: 'Reactivar empresa', message: `"${e.nombre}" podrá volver a usar el sistema.`, confirmLabel: 'Reactivar', danger: false }))) return;
        try {
            await api.patch(`/plataforma/empresas/${e.id}/estado`, { estado, motivo });
            toast.success('Estado actualizado.');
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo cambiar el estado.'); }
    };

    const restablecerAdmin = async (e) => {
        let detalle;
        try { detalle = (await api.get(`/plataforma/empresas/${e.id}`)).data; } catch { toast.error('No se pudo cargar la empresa.'); return; }
        const sugerido = detalle.administradores[0]?.email || '';
        const email = window.prompt('Correo del administrador a restablecer (o uno nuevo para crearlo):', sugerido);
        if (!email) return;
        let nombre;
        if (!detalle.administradores.some(a => a.email === email.toLowerCase().trim())) {
            nombre = window.prompt('Nombre del nuevo administrador:');
            if (!nombre) return;
        }
        try {
            const { data } = await api.post(`/plataforma/empresas/${e.id}/administrador`, { email, nombre });
            setPassword({ titulo: data.creado ? 'Administrador creado' : 'Acceso restablecido', email: data.administrador.email, password: data.password_temporal });
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo gestionar el administrador.'); }
    };

    const cerrarAcceso = async (a) => {
        try { await api.delete(`/plataforma/soporte/${a.id}`); toast.success('Acceso cerrado.'); cargar(); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudo cerrar.'); }
    };

    const vigentes = accesos.filter(a => a.vigente);
    const th = { padding: '12px 14px', textAlign: 'left', ...bebas('.62rem', '.2em'), color: p.SKY_DEEP, whiteSpace: 'nowrap' };
    const td = { padding: '11px 14px', ...outfit('.82rem'), color: p.txtSf };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>PLATAFORMA · SUPERADMINISTRADOR</span></div>
                    <h1 style={{ ...bebas('2.6rem', '.04em'), color: p.txt, lineHeight: 1 }}>Empresas</h1>
                    <p style={{ ...outfit('.85rem'), color: p.mut, marginTop: 6, maxWidth: 680 }}>
                        Cada mecánica trabaja con sus propios datos. Desde aquí solo se ven conteos; para revisar datos de una
                        empresa abre un acceso de soporte (si la empresa lo autorizó).
                    </p>
                </div>
                <BotonPrimario onClick={() => setModal({ tipo: 'empresa', empresa: null })}>+ NUEVA EMPRESA</BotonPrimario>
            </div>

            {resumen && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
                    <KpiCard label="Empresas activas" value={resumen.empresas.activa || 0} color="#10b981" />
                    <KpiCard label="Suspendidas / inactivas" value={(resumen.empresas.suspendida || 0) + (resumen.empresas.inactiva || 0)} color="#f59e0b" />
                    <KpiCard label="Personal activo" value={resumen.usuarios.personal_activo} color={p.SKY} />
                    <KpiCard label="Errores (24 h)" value={resumen.errores_24h} color={resumen.errores_24h ? '#ef4444' : '#10b981'} />
                    <KpiCard label="Último respaldo" value={resumen.ultimo_respaldo ? (resumen.ultimo_respaldo.resultado === 'exito' ? 'OK' : 'ERROR') : 'NINGUNO'}
                        color={resumen.ultimo_respaldo?.resultado === 'exito' ? '#10b981' : '#ef4444'} />
                </div>
            )}

            {vigentes.length > 0 && (
                <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, border: '1px solid rgba(245,158,11,.45)', background: 'rgba(245,158,11,.08)' }}>
                    <p style={{ ...bebas('.75rem', '.16em'), color: '#b45309', marginBottom: 8 }}>TUS ACCESOS DE SOPORTE VIGENTES</p>
                    {vigentes.map(a => (
                        <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', ...outfit('.82rem'), color: p.txt, padding: '4px 0' }}>
                            <strong>{a.empresa_nombre}</strong><span>· {a.modo} · vence {fecha(a.expira)} · {a.motivo}</span>
                            <BotonSecundario onClick={() => cerrarAcceso(a)} color="#ef4444">CERRAR</BotonSecundario>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                    <thead>
                        <tr style={{ background: p.SKY_PALE, borderBottom: `1px solid ${p.bdr}` }}>
                            {['Empresa', 'Estado', 'Personal', 'Clientes', 'Órdenes', 'Proformas', 'Productos', 'Último acceso', 'Soporte', ''].map(h => <th key={h} style={th}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr><td colSpan={10} style={{ ...td, padding: 40, textAlign: 'center' }}>Cargando...</td></tr>
                        ) : empresas.map(e => (
                            <tr key={e.id} className="u-row" style={{ borderBottom: `1px solid ${p.bdr}` }}>
                                <td style={td}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 46, height: 34, background: '#fff', borderRadius: 8, padding: 2, boxSizing: 'border-box', flexShrink: 0 }}>
                                            <LogoEmpresa empresa={e} alto={30} radio={6} />
                                        </div>
                                        <div>
                                            <strong style={{ color: p.txt }}>{e.nombre}</strong>
                                            <span style={{ display: 'block', fontSize: '.72rem', color: p.mut }}>{e.slug}{e.es_publica ? ' · web pública' : ''}{e.ruc ? ` · RUC ${e.ruc}` : ''}{e.creada_por_nombre ? ` · creada por ${e.creada_por_nombre}` : ''}</span>
                                        </div>
                                    </div>
                                </td>
                                <td style={td}><Pildora color={COLOR_ESTADO[e.estado]}>{e.estado.toUpperCase()}</Pildora></td>
                                <td style={td}>{e.personal_activo}</td>
                                <td style={td}>{e.total_clientes}</td>
                                <td style={td}>{e.total_ordenes}</td>
                                <td style={td}>{e.total_proformas}</td>
                                <td style={td}>{e.total_productos}</td>
                                <td style={{ ...td, whiteSpace: 'nowrap' }}>{fecha(e.ultimo_acceso)}</td>
                                <td style={td}>{e.permite_soporte ? 'Autorizado' : 'No autorizado'}</td>
                                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <BotonSecundario onClick={() => setModal({ tipo: 'empresa', empresa: e })}>EDITAR</BotonSecundario>
                                        <BotonSecundario onClick={() => restablecerAdmin(e)} color={p.SKY_DEEP}>ADMINISTRADOR</BotonSecundario>
                                        {e.estado === 'activa' && !e.es_publica && <BotonSecundario onClick={() => cambiarEstado(e, 'suspendida')} color="#f59e0b">SUSPENDER</BotonSecundario>}
                                        {e.estado !== 'activa' && <BotonSecundario onClick={() => cambiarEstado(e, 'activa')} color="#10b981">REACTIVAR</BotonSecundario>}
                                        <BotonSecundario onClick={() => setModal({ tipo: 'soporte', empresa: e })} disabled={!e.permite_soporte || e.estado === 'inactiva'}
                                            title={e.permite_soporte ? 'Abrir acceso de soporte' : 'La empresa no autorizó el soporte'} color="#d97706">SOPORTE</BotonSecundario>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modal?.tipo === 'empresa' && (
                <ModalEmpresa empresa={modal.empresa} onClose={() => { setModal(null); cargar(); }} onGuardada={(data) => {
                    setModal(null);
                    cargar();
                    if (data.password_temporal) setPassword({ titulo: 'Empresa creada', email: data.administrador.email, password: data.password_temporal });
                }} />
            )}
            {modal?.tipo === 'soporte' && <ModalSoporte empresa={modal.empresa} onClose={() => setModal(null)} />}
            {password && <ModalPassword {...password} onClose={() => setPassword(null)} />}
        </div>
    );
}
