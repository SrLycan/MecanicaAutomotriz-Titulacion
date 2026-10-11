/**
 * SS SWAP - Configuración de la empresa
 *
 * Datos comerciales de la propia mecánica (aparecen en proformas, PDF y
 * Excel) y la autorización para que el superadministrador de la plataforma
 * pueda entrar en modo soporte. El estado de la empresa y su identificador
 * los administra solo la plataforma.
 */
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/common/ConfirmDialog';
import { usePaleta, bebas, outfit, BotonPrimario, Pildora } from '../components/common/PanelUI';

const CAMPOS = [
    { k: 'nombre', l: 'NOMBRE DE LA EMPRESA *', max: 120 },
    { k: 'nombre_comercial', l: 'NOMBRE COMERCIAL (EN DOCUMENTOS)', max: 160 },
    { k: 'razon_social', l: 'RAZÓN SOCIAL', max: 160 },
    { k: 'ruc', l: 'RUC', max: 20 },
    { k: 'direccion', l: 'DIRECCIÓN', max: 255 },
    { k: 'telefono', l: 'TELÉFONO', max: 30 },
    { k: 'email', l: 'CORREO', max: 150, tipo: 'email' },
];

export default function EmpresaConfig() {
    const p = usePaleta();
    const confirm = useConfirm();
    const { puede, refrescarSesion } = useAuth();
    const editable = puede('empresa', 'editar');
    const [empresa, setEmpresa] = useState(null);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/empresa').then(({ data }) => {
            setEmpresa(data.empresa);
            setForm(Object.fromEntries(CAMPOS.map(c => [c.k, data.empresa[c.k] || ''])));
        }).catch(err => toast.error(err.response?.data?.error || 'No se pudieron cargar los datos de la empresa.'));
    }, []);

    const guardar = async (cambios) => {
        setSaving(true);
        try {
            const { data } = await api.put('/empresa', cambios);
            setEmpresa(data.empresa);
            toast.success('Datos de la empresa guardados.');
            refrescarSesion();
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo guardar.');
        } finally { setSaving(false); }
    };

    const alternarSoporte = async () => {
        const activar = !empresa.permite_soporte;
        if (!(await confirm({
            title: activar ? 'Autorizar soporte' : 'Retirar autorización de soporte',
            message: activar
                ? 'El superadministrador de la plataforma podrá abrir accesos temporales (máximo 8 horas, con motivo) para ver o corregir datos de tu empresa. Cada acceso y cada acción queda en tu auditoría. ¿Autorizar?'
                : 'El superadministrador ya no podrá abrir nuevos accesos de soporte a tu empresa. ¿Continuar?',
            confirmLabel: activar ? 'Autorizar' : 'Retirar', danger: !activar,
        }))) return;
        guardar({ permite_soporte: activar });
    };

    if (!empresa) return <div className="sk-pulse" style={{ height: 240, borderRadius: 16, background: p.card }} />;

    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.88rem'), outline: 'none' };
    const seccion = { background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, padding: 20, marginBottom: 18 };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 980 }}>
            <div style={{ marginBottom: 20 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>{empresa.nombre.toUpperCase()} · CONFIGURACIÓN</span></div>
                <h1 style={{ ...bebas('2.6rem', '.04em'), color: p.txt, lineHeight: 1 }}>Configuración de la empresa</h1>
                <p style={{ ...outfit('.85rem'), color: p.mut, marginTop: 6 }}>
                    Estos datos identifican a tu mecánica en proformas, PDF y Excel. Solo los ve y usa tu empresa.
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Pildora color={empresa.estado === 'activa' ? '#10b981' : '#f59e0b'}>{empresa.estado.toUpperCase()}</Pildora>
                    <Pildora color={p.SKY_DEEP}>IDENTIFICADOR: {empresa.slug}</Pildora>
                </div>
            </div>

            <form style={seccion} onSubmit={(e) => { e.preventDefault(); guardar(form); }}>
                <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 12 }}>DATOS COMERCIALES</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 13 }}>
                    {CAMPOS.map(c => (
                        <div key={c.k}>
                            <label htmlFor={`emp-${c.k}`} style={{ display: 'block', marginBottom: 6, ...bebas('.62rem', '.22em'), color: p.SKY_DEEP }}>{c.l}</label>
                            <input id={`emp-${c.k}`} type={c.tipo || 'text'} value={form[c.k] || ''} maxLength={c.max} disabled={!editable}
                                required={c.k === 'nombre'} onChange={e => setForm({ ...form, [c.k]: e.target.value })} style={inputSt} />
                        </div>
                    ))}
                </div>
                {editable && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                        <BotonPrimario type="submit" disabled={saving}>{saving ? 'GUARDANDO...' : 'GUARDAR DATOS'}</BotonPrimario>
                    </div>
                )}
            </form>

            <div style={seccion}>
                <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 8 }}>SOPORTE DE LA PLATAFORMA</p>
                <p style={{ ...outfit('.85rem'), color: p.txtSf, marginBottom: 12 }}>
                    {empresa.permite_soporte
                        ? 'Autorizado: el superadministrador puede abrir accesos temporales a tu empresa (con motivo y límite de tiempo). Todo queda en tu auditoría.'
                        : 'No autorizado: el superadministrador de la plataforma no puede ver los datos de tu empresa.'}
                </p>
                {editable && (
                    <BotonPrimario onClick={alternarSoporte} disabled={saving} color={empresa.permite_soporte ? '#ef4444' : undefined}>
                        {empresa.permite_soporte ? 'RETIRAR AUTORIZACIÓN' : 'AUTORIZAR SOPORTE'}
                    </BotonPrimario>
                )}
            </div>
        </div>
    );
}
