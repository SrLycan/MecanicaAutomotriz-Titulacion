import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import bannerAuth from '../../assets/banner.png';
import logoImg from '../../assets/logo.png';

export default function AuthPage({ staffOnly = false }) {
    const [params]   = useSearchParams();
    const navigate   = useNavigate();
    const { login, syncFromStorage } = useAuth();

    const [modo,    setModo]    = useState(staffOnly ? 'login' : (params.get('modo') === 'registro' ? 'registro' : 'login'));
    const [loading, setLoading] = useState(false);
    const [showPass,setShowPass]= useState(false);

    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [regForm,   setRegForm]   = useState({ nombre: '', email: '', password: '', telefono: '', cedula: '' });
    const [regError,  setRegError]  = useState('');

    useEffect(() => {
        setModo(staffOnly ? 'login' : (params.get('modo') === 'registro' ? 'registro' : 'login'));
    }, [params, staffOnly]);

    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get('sesion') === 'expirada') {
            toast.error('Tu sesión expiró. Inicia sesión nuevamente.');
        }
    }, []);

    /* ── LOGIN ── */
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await login(loginForm.email, loginForm.password);
        setLoading(false);
        if (!result.ok) { toast.error(result.error); return; }
        const rol = result.usuario?.rol;
        if (staffOnly && !['administrador','tecnico','recepcionista'].includes(rol)) {
            localStorage.removeItem('SS SWAP_token'); localStorage.removeItem('SS SWAP_usuario'); syncFromStorage();
            toast.error('Este acceso es exclusivo para personal del taller.'); return;
        }
        if (['administrador','tecnico','recepcionista'].includes(rol)) {
            navigate('/dashboard');
        } else {
            toast.success('Sesión iniciada');
            navigate('/');
        }
    };

    /* ── REGISTRO ── */
    const handleRegister = async (e) => {
        e.preventDefault();
        setRegError('');
        if (regForm.password.length < 6) {
            setRegError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        setLoading(true);
        try {
            const { data } = await api.post('/auth/register', regForm);
            localStorage.setItem('SS SWAP_token',   data.token);
            localStorage.setItem('SS SWAP_usuario', JSON.stringify(data.usuario));
            syncFromStorage();
            toast.success('Cuenta creada correctamente. Bienvenido a SS SWAP.');
            navigate('/');
        } catch (err) {
            setRegError(err.response?.data?.error || 'Error al crear la cuenta.');
        } finally {
            setLoading(false);
        }
    };

    const inputBase = {
        width: '100%', padding: '12px 14px 12px 42px', borderRadius: 10,
        border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
        color: '#fff', fontFamily: "'Outfit'", fontSize: '.88rem', outline: 'none',
        transition: 'border-color .2s, background .2s', boxSizing: 'border-box',
    };
    const labelBase = {
        display: 'block', marginBottom: 6, fontFamily: "'Outfit'",
        fontWeight: 500, fontSize: '.75rem', color: 'rgba(255,255,255,.45)',
        textTransform: 'uppercase', letterSpacing: '.07em',
    };

    const IconMailAuth = ({ className }) => <svg className={className} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>;
    const IconLockAuth = ({ className }) => <svg className={className} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    const IconCalendarSmall = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    const IconCarSmall = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.5l2-3h7l2 3H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/></svg>;
    const IconBellSmall = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;

    const BENEFICIOS = [
        { icon: <IconCalendarSmall />, t: 'Agenda citas en segundos', d: 'Elige la fecha y hora disponible.' },
        { icon: <IconCarSmall />,      t: 'Sigue tus vehículos',      d: 'Historial completo del mantenimiento de tu vehículo.' },
        { icon: <IconBellSmall />,     t: 'Notificaciones',   d: 'Entérate cuando tu auto esté listo.' },
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', fontFamily: "'Outfit', sans-serif", position: 'relative' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
                * { box-sizing: border-box; }
                @keyframes authFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
                @keyframes authOrb { 0%, 100% { opacity: .4; transform: scale(1); } 50% { opacity: .7; transform: scale(1.1); } }
                .auth-panel-left { display: none; }

                /* ── Logo titilando (destello pulsante) ── */
                @keyframes authLogoGlow {
                    0%, 100% { filter: drop-shadow(0 0 8px rgba(127,171,206,.4)); }
                    50%      { filter: drop-shadow(0 0 22px rgba(127,171,206,.95)) drop-shadow(0 0 40px rgba(59,123,171,.55)); }
                }
                @keyframes authLogoRing {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(127,171,206,.45), inset 0 0 14px rgba(59,123,171,.1); }
                    50%      { box-shadow: 0 0 0 8px rgba(127,171,206,0), inset 0 0 22px rgba(59,123,171,.3); }
                }
                .auth-logo-ring { animation: authLogoRing 2.4s ease-in-out infinite; }
                .auth-logo-img  { animation: authLogoGlow 2.4s ease-in-out infinite; }

                /* ── Rainbow shimmer para titulares del login ── */
                @keyframes authShimmerSweep { 0% { background-position: -280% center; } 100% { background-position: 280% center; } }
                .auth-rainbow-heading {
                    background: linear-gradient(90deg, #3b7bab 0%, #7fabce 20%, #cfe3f3 38%, #7fabce 55%, #3b7bab 72%, #4a83b3 100%);
                    background-size: 280% auto;
                    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
                    animation: authShimmerSweep 5s linear infinite;
                }
                .auth-input:focus { border-color: rgba(59,123,171,.5) !important; background: rgba(59,123,171,.05) !important; box-shadow: 0 0 0 4px rgba(59,123,171,.1); }
                .auth-input::placeholder { color: rgba(255,255,255,.22); }
                .auth-input-wrap { position: relative; }
                .auth-input-wrap svg.auth-input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,.32); pointer-events: none; transition: color .2s; }
                .auth-input-wrap:focus-within svg.auth-input-icon { color: #3b7bab; }
                .auth-tabs { display: flex; gap: 4px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 999px; padding: 4px; }
                .auth-tab { font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .84rem; padding: 10px 0; border: none; background: none; cursor: pointer; transition: all .2s; flex: 1; border-radius: 999px; color: rgba(255,255,255,.4); }
                .auth-tab.active   { color: #fff; background: linear-gradient(135deg, #2b5c85, #3b7bab); box-shadow: 0 6px 16px -6px rgba(59,123,171,.6); }
                .auth-tab.inactive:hover { color: rgba(255,255,255,.7); }
                .auth-submit { width: 100%; padding: 13px; border-radius: 10px; border: none; background: linear-gradient(135deg, #2b5c85, #3b7bab); color: #fff; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: .9rem; cursor: pointer; transition: all .2s; box-shadow: 0 8px 22px -8px rgba(59,123,171,.55); }
                .auth-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 28px -8px rgba(59,123,171,.7); }
                .auth-submit:disabled { opacity: .55; cursor: not-allowed; transform: none; }
                .pass-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,.28); cursor: pointer; display: flex; padding: 0; line-height: 0; transition: color .18s; }
                .pass-toggle:hover { color: rgba(255,255,255,.55); }
                .text-link { background: none; border: none; color: #3b7bab; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: .82rem; font-weight: 600; padding: 0; }
                .text-link:hover { color: #7fabce; }
                @media (min-width: 980px) {
                    .auth-panel-left { display: flex; }
                }
            `}</style>

            {/* Panel izquierdo — branding (desktop) */}
            <div className="auth-panel-left" style={{ flex: 1, position: 'relative', overflow: 'hidden', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 56px', background: '#0a0a0a' }}>
                {/* Imagen de fondo (banner.png) con desenfoque: capa ampliada + blur para no recortar bordes nítidos */}
                <div style={{
                    position: 'absolute', inset: -20,
                    backgroundImage: `url(${bannerAuth})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    filter: 'blur(10px)',
                    transform: 'scale(1.08)',
                }} />
                {/* Overlay oscuro + blur adicional para integrar la imagen con la interfaz y asegurar legibilidad del texto */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, rgba(5,5,5,.55) 0%, rgba(5,5,5,.7) 55%, rgba(5,5,5,.85) 100%)',
                    backdropFilter: 'blur(2px)',
                    WebkitBackdropFilter: 'blur(2px)',
                }} />
                <div style={{ position: 'absolute', top: '15%', right: '-5%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(59,123,171,.3), transparent)', animation: 'authOrb 8s ease-in-out infinite' }} />
                <div style={{ position: 'absolute', bottom: '5%', left: '-8%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(74,131,179,.16), transparent)', animation: 'authOrb 9s ease-in-out infinite 1.5s' }} />

                <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
                    <img className="auth-logo-img" src={logoImg} alt="SS SWAP" style={{ width: 50, height: 50, objectFit: 'contain' }} />
                    <p className="auth-rainbow-heading" style={{ fontFamily: "'Bebas Neue'", fontSize: '.95rem', letterSpacing: '.04em', lineHeight: 1.25 }}>
                        RESTAURAMOS VEHÍCULOS<br />REFORZAMOS<br />CONFIANZA
                    </p>
                </Link>

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p className="mono" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '.7rem', letterSpacing: '.3em', color: '#7fabce', marginBottom: 18, fontWeight: 500 }}>{staffOnly ? '// ACCESO PERSONAL' : '// PANEL DE CLIENTE'}</p>
                    <h1 className="auth-rainbow-heading" style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.2rem, 3.4vw, 3rem)', letterSpacing: '.02em', lineHeight: 1.05, marginBottom: 40, maxWidth: 380 }}>
                        {staffOnly ? 'Gestiona el taller desde un solo panel.' : 'Todo tu vehículo, en un solo panel.'}
                    </h1>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {BENEFICIOS.map((b, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <div style={{ width: 40, height: 40, minWidth: 40, borderRadius: 11, background: 'rgba(59,123,171,.12)', border: '1px solid rgba(59,123,171,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7fabce' }}>
                                    {b.icon}
                                </div>
                                <div>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.9rem', color: '#fff', marginBottom: 3 }}>{b.t}</p>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.8rem', color: 'rgba(255,255,255,.45)', lineHeight: 1.5 }}>{b.d}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p style={{ fontSize: '.75rem', fontWeight: 300, color: 'rgba(255,255,255,.25)', position: 'relative', zIndex: 1 }}>
                    Mecánica SS SWAP · Ponciano Alto, Quito · 2026
                </p>
            </div>

            {/* Panel derecho — formulario */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>

            {/* Volver */}
            <Link to="/" style={{ position: 'absolute', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,.35)', textDecoration: 'none', fontSize: '.82rem', transition: 'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#3b7bab'}
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

            <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1, animation: 'authFadeUp .6s cubic-bezier(.4,0,.2,1)' }}>

                {/* Logo de SS SWAP arriba de la tarjeta de login/registro */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div className="auth-logo-ring" style={{ width: 74, height: 74, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'rgba(255,255,255,.04)', margin: '0 auto 16px' }}>
                        <img className="auth-logo-img" src={logoImg} alt="SS SWAP" style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
                    </div>
                    <p style={{ fontSize: '.85rem', fontWeight: 300, color: 'rgba(255,255,255,.38)' }}>
                        {staffOnly ? 'Acceso exclusivo para personal autorizado' : (modo === 'login' ? 'Accede a tu cuenta de cliente' : 'Crea tu cuenta para hacer seguimiento de tu vehículo')}
                    </p>
                </div>

                {/* Card */}
                <div style={{ position: 'relative', background: 'linear-gradient(180deg, #141414 0%, #0e0e0e 100%)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 70px -20px rgba(0,0,0,.6)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #3b7bab, transparent)' }} />

                    <div style={{ padding: '26px 26px 0' }}>
                        {/* Tabs */}
                        {!staffOnly && <div className="auth-tabs">
                            <button className={`auth-tab ${modo === 'login'    ? 'active' : 'inactive'}`} onClick={() => { setModo('login');    setRegError(''); }}>Iniciar Sesión</button>
                            <button className={`auth-tab ${modo === 'registro' ? 'active' : 'inactive'}`} onClick={() => { setModo('registro'); setRegError(''); }}>Registrarse</button>
                        </div>}
                    </div>


                    <div style={{ padding: '28px 28px 32px' }}>

                        {/* ── FORMULARIO LOGIN ── */}
                        {modo === 'login' && (
                            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                <div>
                                    <label style={labelBase}>Correo electrónico</label>
                                    <div className="auth-input-wrap">
                                        <IconMailAuth className="auth-input-icon" />
                                        <input className="auth-input" style={inputBase} type="email" required
                                            placeholder="tucorreo@email.com"
                                            value={loginForm.email}
                                            onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label style={labelBase}>Contraseña</label>
                                    <div className="auth-input-wrap" style={{ position: 'relative' }}>
                                        <IconLockAuth className="auth-input-icon" />
                                        <input className="auth-input" style={inputBase} type={showPass ? 'text' : 'password'} required
                                            placeholder="Tu contraseña"
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
                                    {loading ? 'Verificando...' : 'Iniciar Sesión'}
                                </button>

                                {!staffOnly && <p style={{ textAlign: 'center', fontSize: '.82rem', fontWeight: 300, color: 'rgba(255,255,255,.3)' }}>
                                    ¿No tienes cuenta?{' '}
                                    <button type="button" className="text-link" onClick={() => setModo('registro')}>
                                        Regístrate gratis
                                    </button>
                                </p>}
                            </form>
                        )}

                        {/* ── FORMULARIO REGISTRO ── */}
                        {!staffOnly && modo === 'registro' && (
                            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                                <div>
                                    <label style={labelBase}>Nombre completo *</label>
                                    <input className="auth-input" style={inputBase} type="text" required
                                        placeholder="Ingresa tu nombre"
                                        value={regForm.nombre}
                                        onChange={e => setRegForm({ ...regForm, nombre: e.target.value })} />
                                </div>

                                <div>
                                    <label style={labelBase}>Correo electrónico *</label>
                                    <input className="auth-input" style={inputBase} type="email" required
                                        placeholder="tucorreo@email.com"
                                        value={regForm.email}
                                        onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label style={labelBase}>Teléfono</label>
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
                                        <label style={labelBase}>Cédula</label>
                                        <input className="auth-input" style={inputBase} type="text"
                                            placeholder="1712345678"
                                            maxLength={15}
                                            value={regForm.cedula}
                                            onChange={e => setRegForm({ ...regForm, cedula: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label style={labelBase}>Contraseña * (min. 6 caracteres)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="auth-input" style={inputBase} type={showPass ? 'text' : 'password'} required
                                            placeholder="Mínimo 6 caracteres"
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
                                    Al registrarte aceptas los términos y condiciones del uso de tus datos*.
                                </p>

                                <p style={{ textAlign: 'center', fontSize: '.82rem', fontWeight: 300, color: 'rgba(255,255,255,.3)' }}>
                                    ¿Ya tienes cuenta?{' '}
                                    <button type="button" className="text-link" onClick={() => setModo('login')}>
                                        Inicia sesión
                                    </button>
                                </p>
                            </form>
                        )}
                    </div>
                </div>

                <p style={{ textAlign: 'center', marginTop: 18, fontSize: '.75rem', fontWeight: 300, color: 'rgba(255,255,255,.18)' }}>
                    Mecánica SS SWAP · Ponciano Alto, Quito · 2026
                </p>
            </div>
            </div>
        </div>
    );
}
