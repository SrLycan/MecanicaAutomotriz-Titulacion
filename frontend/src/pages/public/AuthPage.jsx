/**
 * SS SWAP - Portal de Autenticación Unificado (Login / Registro)
 * Maneja el inicio de sesión y registro de clientes, así como el acceso administrativo (staffOnly),
 * gestionando tokens JWT y sincronización de sesión en el navegador.
 * Estilos en AuthPage.css (clases auth-*; no hay reglas globales nuevas).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import bannerAuth from '../../assets/banner.png';
import logoImg from '../../assets/logo.png';
import LectorDocumento from '../../components/legal/LectorDocumento';
import './AuthPage.css';

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
    // Sprint 23: documentos legales vigentes del taller (cada uno con su casilla, desmarcada al inicio).
    const [docsLegales, setDocsLegales] = useState([]);
    const [aceptados,   setAceptados]   = useState({});
    const [leyendo,     setLeyendo]     = useState(null);

    useEffect(() => {
        if (modo !== 'registro' || staffOnly) return;
        api.get('/legal/publico/vigentes').then(({ data }) => setDocsLegales(data.documentos || [])).catch(() => setDocsLegales([]));
    }, [modo, staffOnly]);

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
        const result = await login(loginForm.email, loginForm.password, staffOnly ? 'staff' : 'cliente');
        setLoading(false);
        if (!result.ok) { toast.error(result.error); return; }

        // El backend ya valido que el rol coincide con el panel usado (staff vs
        // cliente) antes de emitir el token — aqui solo queda navegar.
        if (staffOnly) {
            toast.success('Sesión iniciada');
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
        if (regForm.password.length < 8) {
            setRegError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }
        if (regForm.password.length > 72) {
            setRegError('La contraseña no puede tener más de 72 caracteres.');
            return;
        }
        const faltan = docsLegales.filter(d => d.obligatorio && !aceptados[d.version_id]);
        if (faltan.length) {
            setRegError(`Para crear la cuenta lea y acepte: ${faltan.map(d => d.titulo).join(', ')}.`);
            return;
        }
        setLoading(true);
        try {
            const aceptaciones = docsLegales.filter(d => aceptados[d.version_id]).map(d => d.version_id);
            const { data } = await api.post('/auth/register', { ...regForm, aceptaciones });
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
        border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)',
        color: '#fff', fontFamily: "'Outfit'", fontSize: '.95rem', outline: 'none',
        transition: 'border-color .2s, background .2s', boxSizing: 'border-box',
    };
    const labelBase = {
        display: 'block', marginBottom: 6, fontFamily: "'Outfit'",
        fontWeight: 500, fontSize: '.75rem', color: 'rgba(255,255,255,.66)',
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
        <div className="auth-pagina" style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', fontFamily: "'Outfit', sans-serif", position: 'relative' }}>

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
                    background: 'linear-gradient(180deg, rgba(7,9,12,.6) 0%, rgba(7,9,12,.74) 55%, rgba(7,9,12,.9) 100%), radial-gradient(60% 50% at 80% 20%, rgba(61,180,239,.22), transparent 70%)',
                    backdropFilter: 'blur(2px)',
                    WebkitBackdropFilter: 'blur(2px)',
                }} />

                <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
                    <img className="auth-logo-img" src={logoImg} alt="SS SWAP" style={{ width: 50, height: 50, objectFit: 'contain' }} />
                    <p className="auth-lema" style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.7rem', letterSpacing: '.12em', lineHeight: 1.45 }}>
                        RESTAURAMOS VEHÍCULOS<br />REFORZAMOS<br />CONFIANZA
                    </p>
                </Link>

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p className="auth-eyebrow">{staffOnly ? 'Acceso personal' : 'Panel de cliente'}</p>
                    <h1 className="auth-titulo" style={{ marginBottom: 40, maxWidth: 420 }}>
                        {staffOnly ? 'Gestiona el taller desde un solo panel.' : 'Todo tu vehículo, en un solo panel.'}
                    </h1>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {BENEFICIOS.map((b, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <div style={{ width: 40, height: 40, minWidth: 40, borderRadius: 11, background: 'rgba(61,180,239,.14)', border: '1px solid rgba(61,180,239,.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93d6f8' }}>
                                    {b.icon}
                                </div>
                                <div>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.9rem', color: '#fff', marginBottom: 3 }}>{b.t}</p>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: 'rgba(255,255,255,.62)', lineHeight: 1.5 }}>{b.d}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p style={{ fontSize: '.78rem', fontWeight: 400, color: 'rgba(255,255,255,.45)', position: 'relative', zIndex: 1 }}>
                    Mecánica SS SWAP · Ponciano Alto, Quito · 2026
                </p>
            </div>

            {/* Panel derecho — formulario */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>

            {/* Volver */}
            <Link to="/" className="auth-enlace-sup" style={{ left: 24 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Volver al inicio
            </Link>

            {/* Link discreto al panel admin */}
            <Link to="/admin/login" className="auth-enlace-sup auth-enlace-sup--discreto" style={{ right: 24 }}>
                Acceso personal del taller
            </Link>

            <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1, animation: 'authFadeUp .6s cubic-bezier(.4,0,.2,1)' }}>

                {/* Logo de SS SWAP arriba de la tarjeta de login/registro */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div className="auth-logo-ring" style={{ width: 74, height: 74, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', margin: '0 auto 16px' }}>
                        <img src={logoImg} alt="SS SWAP" style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
                    </div>
                    <p style={{ fontSize: '.92rem', fontWeight: 400, color: 'rgba(255,255,255,.66)' }}>
                        {staffOnly ? 'Acceso exclusivo para personal autorizado' : (modo === 'login' ? 'Accede a tu cuenta de cliente' : 'Crea tu cuenta para hacer seguimiento de tu vehículo')}
                    </p>
                </div>

                {/* Card */}
                <div style={{ position: 'relative', background: 'linear-gradient(180deg, #161c24 0%, #11161d 100%)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 70px -20px rgba(0,0,0,.6)' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #3db4ef, transparent)' }} />

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
                                    <label htmlFor="auth-login-email" style={labelBase}>Correo electrónico</label>
                                    <div className="auth-input-wrap">
                                        <IconMailAuth className="auth-input-icon" />
                                        <input id="auth-login-email" className="auth-input" style={inputBase} type="email" required
                                            maxLength={254}
                                            placeholder="tucorreo@email.com"
                                            value={loginForm.email}
                                            onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="auth-login-pass" style={labelBase}>Contraseña</label>
                                    <div className="auth-input-wrap" style={{ position: 'relative' }}>
                                        <IconLockAuth className="auth-input-icon" />
                                        <input id="auth-login-pass" className="auth-input" style={inputBase} type={showPass ? 'text' : 'password'} required
                                            maxLength={72}
                                            placeholder="Tu contraseña"
                                            value={loginForm.password}
                                            onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
                                        <button type="button" className="pass-toggle" onClick={() => setShowPass(p => !p)} aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
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

                                {!staffOnly && <p style={{ textAlign: 'center', fontSize: '.85rem', fontWeight: 400, color: 'rgba(255,255,255,.55)' }}>
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
                                    <label htmlFor="auth-reg-nombre" style={labelBase}>Nombre completo *</label>
                                    <input id="auth-reg-nombre" className="auth-input" style={inputBase} type="text" required
                                        maxLength={120}
                                        placeholder="Ingresa tu nombre"
                                        value={regForm.nombre}
                                        onChange={e => setRegForm({ ...regForm, nombre: e.target.value })} />
                                </div>

                                <div>
                                    <label htmlFor="auth-reg-email" style={labelBase}>Correo electrónico *</label>
                                    <input id="auth-reg-email" className="auth-input" style={inputBase} type="email" required
                                        maxLength={254}
                                        placeholder="tucorreo@email.com"
                                        value={regForm.email}
                                        onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label htmlFor="auth-reg-tel" style={labelBase}>Teléfono</label>
                                        <input id="auth-reg-tel" className="auth-input" style={inputBase} type="tel"
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
                                        <label htmlFor="auth-reg-cedula" style={labelBase}>Cédula</label>
                                        <input id="auth-reg-cedula" className="auth-input" style={inputBase} type="text"
                                            placeholder="1712345678"
                                            maxLength={15}
                                            value={regForm.cedula}
                                            onChange={e => setRegForm({ ...regForm, cedula: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="auth-reg-pass" style={labelBase}>Contraseña * (8 a 72 caracteres)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input id="auth-reg-pass" className="auth-input" style={inputBase} type={showPass ? 'text' : 'password'} required
                                            maxLength={72}
                                            placeholder="Mínimo 8 caracteres"
                                            value={regForm.password}
                                            onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
                                        <button type="button" className="pass-toggle" onClick={() => setShowPass(p => !p)} aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                                            {showPass
                                                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                            }
                                        </button>
                                    </div>
                                </div>

                                {docsLegales.length > 0 && (
                                    <div role="group" aria-label="Documentos legales" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)' }}>
                                        {docsLegales.map(d => (
                                            <label key={d.version_id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '.8rem', color: 'rgba(255,255,255,.75)', cursor: 'pointer', lineHeight: 1.45 }}>
                                                <input type="checkbox" checked={Boolean(aceptados[d.version_id])} style={{ marginTop: 3 }}
                                                    onChange={e => setAceptados({ ...aceptados, [d.version_id]: e.target.checked })} />
                                                <span>
                                                    {d.tipo === 'autorizacion_datos' ? 'Autorizo (opcional): ' : 'He leído y acepto '}
                                                    <button type="button" className="text-link" onClick={(e) => { e.preventDefault(); setLeyendo(d); }}>{d.titulo}</button>
                                                    {d.obligatorio ? ' *' : ' (opcional)'}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {regError && (
                                    <div style={{ padding: '10px 14px', borderRadius: 7, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', fontSize: '.82rem' }}>
                                        {regError}
                                    </div>
                                )}

                                <button type="submit" className="auth-submit" disabled={loading} style={{ marginTop: 4 }}>
                                    {loading ? 'Creando cuenta...' : 'Crear Cuenta Gratis'}
                                </button>


                                <p style={{ textAlign: 'center', fontSize: '.85rem', fontWeight: 400, color: 'rgba(255,255,255,.55)' }}>
                                    ¿Ya tienes cuenta?{' '}
                                    <button type="button" className="text-link" onClick={() => setModo('login')}>
                                        Inicia sesión
                                    </button>
                                </p>
                            </form>
                        )}
                    </div>
                </div>

                {leyendo && <LectorDocumento doc={leyendo} onClose={() => setLeyendo(null)} />}
                <p style={{ textAlign: 'center', marginTop: 18, fontSize: '.78rem', fontWeight: 400, color: 'rgba(255,255,255,.4)' }}>
                    Mecánica SS SWAP · Ponciano Alto, Quito · 2026
                </p>
            </div>
            </div>
        </div>
    );
}
