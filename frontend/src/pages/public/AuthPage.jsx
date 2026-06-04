import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AuthPage() {
    const [params]   = useSearchParams();
    const navigate   = useNavigate();
    const { login, syncFromStorage } = useAuth();

    const [modo,    setModo]    = useState(params.get('modo') === 'registro' ? 'registro' : 'login');
    const [loading, setLoading] = useState(false);
    const [showPass,setShowPass]= useState(false);

    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [regForm,   setRegForm]   = useState({ nombre: '', email: '', password: '', telefono: '', cedula: '' });
    const [regError,  setRegError]  = useState('');

    useEffect(() => {
        setModo(params.get('modo') === 'registro' ? 'registro' : 'login');
    }, [params]);

    /* ── LOGIN ── */
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await login(loginForm.email, loginForm.password);
        setLoading(false);
        if (!result.ok) { toast.error(result.error); return; }
        const rol = result.usuario?.rol;
        if (['administrador','tecnico','recepcionista'].includes(rol)) {
            navigate('/dashboard');
        } else {
            toast.success('Sesion iniciada');
            navigate('/');
        }
    };

    /* ── REGISTRO ── */
    const handleRegister = async (e) => {
        e.preventDefault();
        setRegError('');
        if (regForm.password.length < 6) {
            setRegError('La contrasena debe tener al menos 6 caracteres.');
            return;
        }
        setLoading(true);
        try {
            const { data } = await api.post('/auth/register', regForm);
            localStorage.setItem('sswap_token',   data.token);
            localStorage.setItem('sswap_usuario', JSON.stringify(data.usuario));
            syncFromStorage();
            toast.success('Cuenta creada correctamente. Bienvenido a SSWAP.');
            navigate('/');
        } catch (err) {
            setRegError(err.response?.data?.error || 'Error al crear la cuenta.');
        } finally {
            setLoading(false);
        }
    };

    const inputBase = {
        width: '100%', padding: '11px 14px', borderRadius: 7,
        border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
        color: '#fff', fontFamily: "'Outfit'", fontSize: '.88rem', outline: 'none',
        transition: 'border-color .2s, background .2s', boxSizing: 'border-box',
    };
    const labelBase = {
        display: 'block', marginBottom: 6, fontFamily: "'Outfit'",
        fontWeight: 500, fontSize: '.75rem', color: 'rgba(255,255,255,.45)',
        textTransform: 'uppercase', letterSpacing: '.07em',
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Outfit', sans-serif", position: 'relative' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&display=swap');
                .auth-input:focus { border-color: rgba(201,162,39,.5) !important; background: rgba(201,162,39,.03) !important; }
                .auth-input::placeholder { color: rgba(255,255,255,.2); }
                .auth-tab { font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .88rem; padding: 12px 0; border: none; background: none; cursor: pointer; transition: color .2s; flex: 1; }
                .auth-tab.active   { color: #c9a227; border-bottom: 2px solid #c9a227; }
                .auth-tab.inactive { color: rgba(255,255,255,.3); border-bottom: 2px solid transparent; }
                .auth-tab.inactive:hover { color: rgba(255,255,255,.55); }
                .auth-submit { width: 100%; padding: 12px; border-radius: 7px; border: none; background: #c9a227; color: #0d0d0d; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: .9rem; cursor: pointer; transition: background .2s; }
                .auth-submit:hover:not(:disabled) { background: #e0b830; }
                .auth-submit:disabled { opacity: .55; cursor: not-allowed; }
                .pass-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,.28); cursor: pointer; display: flex; padding: 0; line-height: 0; transition: color .18s; }
                .pass-toggle:hover { color: rgba(255,255,255,.55); }
                .text-link { background: none; border: none; color: #c9a227; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: .82rem; font-weight: 500; padding: 0; }
            `}</style>

            {/* Volver */}
            <Link to="/" style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,.35)', textDecoration: 'none', fontSize: '.82rem', transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#c9a227'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.35)'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Volver al inicio
            </Link>

            {/* Link discreto al panel admin */}
            <Link to="/admin/login" style={{ position: 'absolute', top: 24, right: 24, color: 'rgba(255,255,255,.18)', textDecoration: 'none', fontSize: '.72rem', transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.38)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.18)'}>
                Acceso personal del taller
            </Link>

            <div style={{ width: '100%', maxWidth: 440 }}>

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 38, height: 38, background: '#c9a227', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" strokeWidth="2.5" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', letterSpacing: '.1em', color: '#fff', lineHeight: 1 }}>SSWAP</p>
                            <p style={{ fontSize: '.62rem', fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.2 }}>Mecanica Automotriz · Quito</p>
                        </div>
                    </Link>
                    <p style={{ fontSize: '.85rem', fontWeight: 300, color: 'rgba(255,255,255,.38)' }}>
                        {modo === 'login' ? 'Accede a tu cuenta de cliente' : 'Crea tu cuenta para hacer seguimiento de tu vehiculo'}
                    </p>
                </div>

                {/* Card */}
                <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>

                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                        <button className={`auth-tab ${modo === 'login'    ? 'active' : 'inactive'}`} onClick={() => { setModo('login');    setRegError(''); }}>Iniciar Sesion</button>
                        <button className={`auth-tab ${modo === 'registro' ? 'active' : 'inactive'}`} onClick={() => { setModo('registro'); setRegError(''); }}>Registrarse</button>
                    </div>

                    <div style={{ padding: '28px 28px 32px' }}>

                        {/* ── FORMULARIO LOGIN ── */}
                        {modo === 'login' && (
                            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                <div>
                                    <label style={labelBase}>Correo electronico</label>
                                    <input className="auth-input" style={inputBase} type="email" required
                                        placeholder="tucorreo@email.com"
                                        value={loginForm.email}
                                        onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
                                </div>

                                <div>
                                    <label style={labelBase}>Contrasena</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="auth-input" style={inputBase} type={showPass ? 'text' : 'password'} required
                                            placeholder="Tu contrasena"
                                            value={loginForm.password}
                                            onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
                                        <button type="button" className="pass-toggle" onClick={() => setShowPass(p => !p)}>
                                            {showPass
                                                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                            }
                                        </button>
                                    </div>
                                </div>

                                <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: 4 }}>
                                    {loading ? 'Verificando...' : 'Iniciar Sesion'}
                                </button>

                                <p style={{ textAlign: 'center', fontSize: '.82rem', fontWeight: 300, color: 'rgba(255,255,255,.3)' }}>
                                    No tienes cuenta?{' '}
                                    <button type="button" className="text-link" onClick={() => setModo('registro')}>
                                        Registrate gratis
                                    </button>
                                </p>
                            </form>
                        )}

                        {/* ── FORMULARIO REGISTRO ── */}
                        {modo === 'registro' && (
                            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                                <div>
                                    <label style={labelBase}>Nombre completo *</label>
                                    <input className="auth-input" style={inputBase} type="text" required
                                        placeholder="Juan Perez"
                                        value={regForm.nombre}
                                        onChange={e => setRegForm({ ...regForm, nombre: e.target.value })} />
                                </div>

                                <div>
                                    <label style={labelBase}>Correo electronico *</label>
                                    <input className="auth-input" style={inputBase} type="email" required
                                        placeholder="tucorreo@email.com"
                                        value={regForm.email}
                                        onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={labelBase}>Telefono</label>
                                        <input className="auth-input" style={inputBase} type="tel"
                                            placeholder="099 XXX XXXX"
                                            value={regForm.telefono}
                                            onChange={e => {
                                                let val = e.target.value.replace(/[^\d+]/g, '');
                                                if (!val.startsWith('+')) val = '+' + val;
                                                if (val === '+') val = '+593';
                                                if (!val.startsWith('+593')) val = '+593' + val.replace(/^\+?\d*/, '');
                                                if (val.length > 13) val = val.slice(0, 13);
                                                setRegForm({ ...regForm, telefono: val });
                                            }} />
                                    </div>
                                    <div>
                                        <label style={labelBase}>Cedula</label>
                                        <input className="auth-input" style={inputBase} type="text"
                                            placeholder="1712345678"
                                            maxLength={15}
                                            value={regForm.cedula}
                                            onChange={e => setRegForm({ ...regForm, cedula: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label style={labelBase}>Contrasena * (min. 6 caracteres)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="auth-input" style={inputBase} type={showPass ? 'text' : 'password'} required
                                            placeholder="Minimo 6 caracteres"
                                            value={regForm.password}
                                            onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
                                        <button type="button" className="pass-toggle" onClick={() => setShowPass(p => !p)}>
                                            {showPass
                                                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                            }
                                        </button>
                                    </div>
                                </div>

                                {regError && (
                                    <div style={{ padding: '10px 14px', borderRadius: 7, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', fontSize: '.82rem' }}>
                                        {regError}
                                    </div>
                                )}

                                <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: 4 }}>
                                    {loading ? 'Creando cuenta...' : 'Crear Cuenta Gratis'}
                                </button>

                                <p style={{ textAlign: 'center', fontSize: '.75rem', fontWeight: 300, color: 'rgba(255,255,255,.22)', lineHeight: 1.6 }}>
                                    Al registrarte aceptas recibir notificaciones sobre el estado de tu vehiculo.
                                </p>

                                <p style={{ textAlign: 'center', fontSize: '.82rem', fontWeight: 300, color: 'rgba(255,255,255,.3)' }}>
                                    Ya tienes cuenta?{' '}
                                    <button type="button" className="text-link" onClick={() => setModo('login')}>
                                        Inicia sesion
                                    </button>
                                </p>
                            </form>
                        )}
                    </div>
                </div>

                <p style={{ textAlign: 'center', marginTop: 18, fontSize: '.75rem', fontWeight: 300, color: 'rgba(255,255,255,.18)' }}>
                    Mecanica SSWAP · Ponciano Alto, Quito · 2026
                </p>
            </div>
        </div>
    );
}
