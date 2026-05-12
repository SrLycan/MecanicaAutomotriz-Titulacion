import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const ROLES_INTERNOS = ['administrador', 'tecnico', 'recepcionista'];

export default function AdminLogin() {
    const { login }  = useAuth();
    const navigate   = useNavigate();
    const [form, setForm]       = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await login(form.email, form.password);
        setLoading(false);

        if (!result.ok) { setError(result.error); return; }

        const usuario = JSON.parse(localStorage.getItem('sswap_usuario') || '{}');
        if (!ROLES_INTERNOS.includes(usuario.rol)) {
            setError('Esta seccion es exclusiva para personal del taller.');
            localStorage.removeItem('sswap_token');
            localStorage.removeItem('sswap_usuario');
            return;
        }

        toast.success('Bienvenido al panel de administracion');
        navigate('/dashboard');
    };

    const inputStyle = {
        width: '100%', padding: '11px 14px', borderRadius: 7,
        border: '1px solid rgba(168,85,247,.18)', background: 'rgba(255,255,255,.03)',
        color: '#e2dff0', fontFamily: "'Outfit'", fontSize: '.88rem', outline: 'none',
        transition: 'border-color .2s',
        boxSizing: 'border-box',
    };

    return (
        <div style={{ minHeight: '100vh', background: '#050309', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Outfit', sans-serif", position: 'relative' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&display=swap');
                .adm-input:focus { border-color: rgba(168,85,247,.55) !important; box-shadow: 0 0 0 3px rgba(168,85,247,.09); }
                .adm-input::placeholder { color: rgba(226,223,240,.2); }
                .adm-submit { width: 100%; padding: 12px; border-radius: 8px; border: none; background: linear-gradient(135deg, #7c3aed, #a855f7); color: #fff; font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .9rem; cursor: pointer; transition: opacity .2s; }
                .adm-submit:hover { opacity: .9; }
                .adm-submit:disabled { opacity: .5; cursor: not-allowed; }
            `}</style>

            {/* Fondo decorativo */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'rgba(124,58,237,0.06)', filter: 'blur(80px)' }} />
                <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(168,85,247,0.05)', filter: 'blur(80px)' }} />
            </div>

            {/* Volver */}
            <Link to="/" style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(226,223,240,.3)', textDecoration: 'none', fontSize: '.82rem', transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(168,85,247,.6)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(226,223,240,.3)'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Sitio principal
            </Link>

            <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>

                {/* Logo + badge de sistema interno */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', marginBottom: 14, boxShadow: '0 8px 24px rgba(124,58,237,.35)' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.28em', color: 'rgba(168,85,247,.5)', marginBottom: 4 }}>SISTEMA INTERNO</p>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2rem', letterSpacing: '.06em', color: '#e2dff0', lineHeight: 1 }}>Panel SSWAP</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: 'rgba(226,223,240,.38)', marginTop: 6 }}>
                        Acceso exclusivo para personal autorizado
                    </p>
                </div>

                {/* Card */}
                <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(147,51,234,0.14)', borderRadius: 16, padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(168,85,247,.6), transparent)' }} />

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.22em', background: 'linear-gradient(90deg, #7c3aed, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                CORREO ELECTRONICO
                            </label>
                            <input className="adm-input" style={inputStyle} type="email" required
                                placeholder="usuario@sswap.com"
                                value={form.email}
                                onChange={e => { setForm({ ...form, email: e.target.value }); setError(''); }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.22em', background: 'linear-gradient(90deg, #7c3aed, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                CONTRASENA
                            </label>
                            <input className="adm-input" style={inputStyle} type="password" required
                                placeholder="••••••••"
                                value={form.password}
                                onChange={e => { setForm({ ...form, password: e.target.value }); setError(''); }} />
                        </div>

                        {error && (
                            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.82rem' }}>
                                {error}
                            </div>
                        )}

                        <button type="submit" className="adm-submit" disabled={loading} style={{ marginTop: 4 }}>
                            {loading ? 'Verificando...' : 'Ingresar al Sistema'}
                        </button>
                    </form>

                    {/* Roles de referencia */}
                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: 'rgba(168,85,247,.4)', marginBottom: 10, textAlign: 'center' }}>
                            ACCESOS DE PRUEBA
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {[
                                { rol: 'Administrador', email: 'admin@sswap.com',    pass: 'Admin@SSWAP2026'  },
                                { rol: 'Tecnico',       email: 'tecnico@sswap.com',  pass: 'Tecnico@2026'    },
                                { rol: 'Recepcion',     email: 'recepcion@sswap.com',pass: 'Recepcion@2026'  },
                            ].map(u => (
                                <button key={u.rol} type="button"
                                    onClick={() => setForm({ email: u.email, password: u.pass })}
                                    style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', border: '1px solid rgba(147,51,234,.14)', borderRadius: 7, background: 'none', cursor: 'pointer', transition: 'all .15s', width: '100%' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,.35)'; e.currentTarget.style.background = 'rgba(168,85,247,.05)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(147,51,234,.14)'; e.currentTarget.style.background = 'none'; }}>
                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.1em', color: 'rgba(168,85,247,.65)' }}>{u.rol}</span>
                                    <span style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.68rem', color: 'rgba(226,223,240,.3)' }}>{u.email}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.75rem', fontWeight: 300, color: 'rgba(226,223,240,.18)' }}>
                    SSWAP Sistema Integral v1.0 · PUCE TEC 2026
                </p>
            </div>
        </div>
    );
}
