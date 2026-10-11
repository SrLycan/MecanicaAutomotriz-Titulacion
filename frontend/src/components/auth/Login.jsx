/**
 * SS SWAP - Formulario de Inicio de Sesión del Personal (Login)
 * Provee interfaz para inicio de sesión del staff administrativo/técnico
 * con soporte de tema oscuro/claro y accesos de prueba.
 * Los estilos visuales viven en la hoja de estilos global (ssswap-label, etc.).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';

const DEMO_USERS = [
    { rol: 'administrador', email: 'admin@ssswap.com',      password: 'AdminSS2026',      label: 'Administrador' },
    { rol: 'tecnico',       email: 'tecnico@ssswap.com',    password: 'Tecnico@2026',     label: 'Tecnico'       },
    { rol: 'recepcionista', email: 'recepcion@ssswap.com',  password: 'Recepcion@2026',   label: 'Recepcionista' },
];

export default function Login() {
    const { login, loading } = useAuth();
    const { isDark, toggle } = useTheme();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });

    const txt  = isDark ? '#e2dff0' : '#160830';
    const mut  = isDark ? 'rgba(226,223,240,0.42)' : 'rgba(55,10,120,0.55)';
    const bdr  = isDark ? 'rgba(147,51,234,0.14)'  : 'rgba(100,30,180,0.18)';
    const card = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.92)';
    const bg   = isDark ? '#09060f' : '#f5f0ff';

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(form.email, form.password);
        if (result.ok) { toast.success('Acceso concedido'); navigate('/dashboard'); }
        else toast.error(result.error);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, padding: 16, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: isDark ? 'rgba(124,58,237,0.07)' : 'rgba(124,58,237,0.06)', filter: 'blur(80px)' }} />
                <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: isDark ? 'rgba(168,85,247,0.05)' : 'rgba(168,85,247,0.07)', filter: 'blur(80px)' }} />
            </div>
            <button onClick={toggle} style={{ position: 'absolute', top: 20, right: 20, background: card, border: `1px solid ${bdr}`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', color: mut, fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.15em' }}>
                {isDark ? 'MODO CLARO' : 'MODO OSCURO'}
            </button>
            <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 20, padding: '40px 36px', boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(100,30,180,0.1)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(168,85,247,.7), transparent)' }} />
                    <div style={{ textAlign: 'center', marginBottom: 36 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', marginBottom: 16, boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                        </div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.28em', color: isDark ? 'rgba(168,85,247,.5)' : 'rgba(124,58,237,.55)', marginBottom: 4 }}>SISTEMA DE GESTION</p>
                        <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.08em', color: txt, lineHeight: 1 }}>SS SWAP</h1>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, marginTop: 6 }}>Mecanica Automotriz · Quito</p>
                    </div>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label className="ssswap-label">CORREO ELECTRONICO</label>
                            <input className="ssswap-input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="usuario@ssswap.com" required style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(124,58,237,0.04)', border: `1px solid ${bdr}`, color: txt }} />
                        </div>
                        <div>
                            <label className="ssswap-label">CONTRASEÑA</label>
                            <input className="ssswap-input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" required style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(124,58,237,0.04)', border: `1px solid ${bdr}`, color: txt }} />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 4, fontSize: '.82rem' }}>
                            <span>{loading ? 'Verificando...' : 'Iniciar Sesion'}</span>
                        </button>
                    </form>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 16px' }}>
                        <div style={{ flex: 1, height: 1, background: bdr }} />
                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: mut }}>ACCESOS DE PRUEBA</span>
                        <div style={{ flex: 1, height: 1, background: bdr }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {DEMO_USERS.map(u => (
                            <button key={u.rol} type="button" onClick={() => setForm({ email: u.email, password: u.password })}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: `1px solid ${bdr}`, borderRadius: 9, background: 'none', cursor: 'pointer', transition: 'all .18s', width: '100%' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,.45)'; e.currentTarget.style.background = isDark ? 'rgba(168,85,247,.06)' : 'rgba(124,58,237,.04)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.background = 'none'; }}>
                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.12em', color: mut }}>{u.label}</span>
                                <span style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.72rem', color: isDark ? 'rgba(168,85,247,.5)' : 'rgba(124,58,237,.55)' }}>{u.email}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
