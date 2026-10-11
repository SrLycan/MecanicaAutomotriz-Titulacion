/**
 * SS SWAP - "Mi cuenta" del personal (desde el encabezado del panel)
 * Muestra nombre, correo y rol de la sesión y permite cambiar la propia
 * contraseña (necesario tras recibir una contraseña temporal del
 * superadministrador). Usa PUT /api/users/me/password, que exige la actual.
 */
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const ROL_TEXTO = {
    superadministrador: 'Superadministrador (acceso total)', administrador: 'Administrador',
    tecnico: 'Técnico', recepcionista: 'Recepcionista', interno: 'Personal interno',
};

export default function ModalMiCuenta({ onClose }) {
    const { usuario, permisos } = useAuth();
    const { isDark } = useTheme();
    const [form, setForm] = useState({ actual: '', nueva: '', repetir: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : '#b6c3d3';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP };

    const onChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (form.nueva.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
        if (form.nueva.length > 72) { setError('La contraseña no puede tener más de 72 caracteres.'); return; }
        if (form.nueva !== form.repetir) { setError('Las contraseñas no coinciden.'); return; }
        setSaving(true);
        try {
            await api.put('/users/me/password', { password_actual: form.actual, password_nueva: form.nueva });
            toast.success('Contraseña actualizada.');
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo cambiar la contraseña.');
        } finally { setSaving(false); }
    };

    const totalPermisos = permisos.includes('*') ? 'Todos' : permisos.length;

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" role="dialog" aria-modal="true" aria-label="Mi cuenta" style={{ maxWidth: 460, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY}, ${SKY_DEEP}, ${SKY}, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>MI CUENTA</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>{usuario?.nombre}</h2>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginTop: 4 }}>{usuario?.email}</p>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>{ROL_TEXTO[usuario?.rol] || usuario?.rol} · Permisos: {totalPermisos}</p>
                    </div>
                    <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.18em', color: txt }}>CAMBIAR CONTRASEÑA</p>
                    <div><label style={labelSt} htmlFor="mc-actual">CONTRASEÑA ACTUAL</label><input id="mc-actual" type="password" name="actual" value={form.actual} onChange={onChange} required autoComplete="current-password" style={inputSt} /></div>
                    <div><label style={labelSt} htmlFor="mc-nueva">NUEVA CONTRASEÑA</label><input id="mc-nueva" type="password" name="nueva" value={form.nueva} onChange={onChange} required minLength={8} maxLength={72} autoComplete="new-password" placeholder="Mínimo 8 caracteres" style={inputSt} /></div>
                    <div><label style={labelSt} htmlFor="mc-repetir">REPETIR NUEVA CONTRASEÑA</label><input id="mc-repetir" type="password" name="repetir" value={form.repetir} onChange={onChange} required autoComplete="new-password" style={inputSt} /></div>
                    {error && <div role="alert" style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.82rem' }}>{error}</div>}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, borderTop: `1px solid ${bdr}` }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CERRAR</button>
                        <button type="submit" disabled={saving} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>
                            {saving ? 'GUARDANDO...' : 'GUARDAR CONTRASEÑA'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
