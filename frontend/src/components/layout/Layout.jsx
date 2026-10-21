/**
 * SS SWAP - Componente de Estructura Principal del Panel Administrativo (Layout)
 * Provee la barra lateral colapsable, menú de navegación según los PERMISOS del
 * usuario (solo aparecen los módulos que puede abrir), encabezado con selector
 * de tema, datos de sesión (nombre y rol), "Mi cuenta" y área principal (Outlet).
 * Los estilos de animaciones/clases auxiliares viven en Layout.css.
 */
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import CargandoPagina from '../common/CargandoPagina';
import ModalMiCuenta from './ModalMiCuenta';
import AvisoPendientes from '../legal/AvisoPendientes';
import { LogoEmpresa } from '../common/MarcaEmpresa';
import BotonAyuda from '../ayuda/BotonAyuda';
import './Layout.css';

// Icono exclusivo de Proveedores (solo administradores)
function IconTruck() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>; }
function IconPlataforma() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="7" rx="1.5"/><rect x="2" y="14" width="20" height="7" rx="1.5"/><line x1="6" y1="6.5" x2="6.01" y2="6.5"/><line x1="6" y1="17.5" x2="6.01" y2="17.5"/></svg>; }
function IconMoney() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
function IconFactura() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>; }
function IconEngranaje() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function IconChart() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }

// Menú lateral tipo ACORDEÓN: cada sección se despliega al hacer clic y
// muestra sus opciones; solo una abierta a la vez. Cada opción lleva directo
// a la vista correspondiente (?tab= / ?area=).
// Sprint 27: una opción por PÁGINA (las pestañas internas de cada página
// cubren sus subsecciones, que siguen abriéndose por URL con ?tab=), más los
// atajos de las operaciones habituales (Nueva proforma, Crear compra, Nueva
// factura). Configuración y Usuarios y seguridad agrupan lo que estaba
// repartido. Ninguna ruta ni permiso cambió.
// Permisos: cada opción declara el permiso que necesita ('modulo:accion' o
// lista, basta uno). Un grupo sin opciones visibles no se muestra. Las
// opciones "soloSuperadmin" solo las ve el superadministrador.
const PROF_VER = ['proformas_mecanica:ver', 'proformas_colisiones:ver'];
const PROF_CREAR = ['proformas_mecanica:crear', 'proformas_colisiones:crear'];
const NAV_GROUPS = [
    { id: 'panel', label: 'Panel', icon: IconDash, to: '/dashboard' },
    { id: 'inventario', label: 'Inventario', icon: IconInv, badgeStock: true, children: [
        { to: '/dashboard/inventario',                 label: 'Inventario Mecánica', permiso: 'inventario_mecanica:ver' },
        { to: '/dashboard/inventario?area=colisiones', label: 'Colisiones / Pintura', permiso: 'inventario_colisiones:ver' },
        { to: '/dashboard/movimientos', label: 'Entradas y salidas', permiso: ['registros_inventario:ver', 'registros_inventario:crear'] },
        { to: '/dashboard/historial-productos', label: 'Historial de productos', permiso: ['inventario_mecanica:ver', 'inventario_colisiones:ver'] },
        { to: '/dashboard/pedidos',     label: 'Pedidos de la tienda', permiso: 'pedidos_tienda:ver' },
    ] },
    { id: 'taller', label: 'Taller', icon: IconOrden, children: [
        { to: '/dashboard/ordenes',          label: 'Órdenes de trabajo', permiso: 'ordenes:ver' },
        { to: '/dashboard/proformas',        label: 'Proformas', permiso: PROF_VER, prefijo: true },
        { to: '/dashboard/proformas/nueva',  label: 'Nueva proforma', permiso: PROF_CREAR },
        { to: '/dashboard/citas',            label: 'Citas', permiso: 'citas:ver' },
    ] },
    { id: 'clientes', label: 'Clientes', icon: IconClient, badgePagare: true, children: [
        { to: '/dashboard/clientes',            label: 'Clientes del taller', permiso: 'clientes:ver' },
        { to: '/dashboard/vehiculos',           label: 'Vehículos', permiso: 'vehiculos:ver' },
        { to: '/dashboard/clientes?tab=pagare', label: 'Pagaré / Cartera', permiso: 'cuentas_cobrar:ver' },
    ] },
    { id: 'proveedores', label: 'Proveedores', icon: IconTruck, badgeCredito: true, children: [
        { to: '/dashboard/proveedores',               label: 'Proveedores, gastos y pagos', permiso: 'proveedores:ver' },
        { to: '/dashboard/proveedores?tab=compras',   label: 'Compras', permiso: 'proveedores:ver' },
        { to: '/dashboard/proveedores?tab=compras&crear=1', label: 'Crear compra', permiso: 'proveedores:crear' },
    ] },
    { id: 'finanzas', label: 'Finanzas', icon: IconMoney, children: [
        { to: '/dashboard/finanzas',                  label: 'Dinero, nómina y cuentas', permiso: 'finanzas:ver' },
        { to: '/dashboard/caja',                      label: 'Caja diaria', permiso: 'caja:ver' },
    ] },
    { id: 'facturacion', label: 'Facturación SRI', icon: IconFactura, children: [
        { to: '/dashboard/facturacion',          label: 'Comprobantes', permiso: 'facturacion:ver', prefijo: true },
        { to: '/dashboard/facturacion/nueva',    label: 'Nueva factura', permiso: 'facturacion:crear' },
    ] },
    { id: 'graficas', label: 'Gráficas', icon: IconChart, to: '/dashboard/graficas', permiso: 'estadisticas:ver' },
    { id: 'configuracion', label: 'Configuración', icon: IconEngranaje, children: [
        { to: '/dashboard/empresa',             label: 'Datos de la empresa', permiso: 'empresa:ver' },
        { to: '/dashboard/sucursales',          label: 'Sucursales', permiso: 'sucursales:ver' },
        { to: '/dashboard/servicios',           label: 'Servicios del taller', permiso: 'servicios:ver' },
        { to: '/dashboard/facturacion/config',  label: 'Configuración tributaria', permiso: 'facturacion_config:ver' },
        { to: '/dashboard/legal',               label: 'Documentos legales', permiso: 'legal:ver' },
        { to: '/dashboard/contratacion',        label: 'Contratación del servicio', permiso: 'empresa:editar' },
    ] },
    { id: 'seguridad', label: 'Usuarios y seguridad', icon: IconUsers, children: [
        { to: '/dashboard/usuarios',            label: 'Usuarios y permisos', permiso: 'usuarios:ver' },
        { to: '/dashboard/auditoria',           label: 'Auditoría', permiso: 'auditoria:ver' },
        { to: '/dashboard/bitacora',            label: 'Bitácora', permiso: 'bitacora:ver' },
    ] },
    // Plataforma multiempresa: solo el superadministrador.
    { id: 'plataforma', label: 'Plataforma', icon: IconPlataforma, children: [
        { to: '/dashboard/plataforma',           label: 'Empresas', soloSuperadmin: true },
        { to: '/dashboard/plataforma/auditoria', label: 'Auditoría global', soloSuperadmin: true },
        { to: '/dashboard/plataforma/respaldos', label: 'Respaldos', soloSuperadmin: true },
        { to: '/dashboard/plataforma/sistema',   label: 'Migraciones y errores', soloSuperadmin: true },
        { to: '/dashboard/plataforma/legal',     label: 'Documentos y contratos', soloSuperadmin: true },
    ] },
];

/** Puntaje de coincidencia de una opcion del menu con la URL actual (0 = no coincide). */
function puntajeRuta(to, location, hermanos, prefijo) {
    const [ruta, query = ''] = to.split('?');
    const params = new URLSearchParams(query);
    const actuales = new URLSearchParams(location.search);
    const exacta = location.pathname === ruta;
    if (!exacta && !(prefijo && location.pathname.startsWith(`${ruta}/`))) return 0;
    for (const [k, v] of params) if (actuales.get(k) !== v) return 0;
    if ([...params.keys()].length === 0) {
        // Opcion "por defecto" (sin parametros): no aplica si la URL coincide
        // con otra opcion hermana de la misma pagina (p. ej. ?area=colisiones).
        // Las pestañas que no tienen opcion propia (?tab=gastos) siguen
        // marcando la opcion general de su pagina.
        const coincideHermana = hermanos.some(h => {
            const [r, qh] = h.to.split('?');
            if (r !== ruta || !qh) return false;
            return [...new URLSearchParams(qh)].every(([k, v]) => actuales.get(k) === v);
        });
        if (coincideHermana) return 0;
    }
    return (exacta ? 10 : 1) + [...params.keys()].length;
}

// Tiempo minimo entre dos consultas de alertas al navegar por el panel.
const RECONSULTA_MIN_MS = 30000;
const ROL_COLOR = { superadministrador: '#a855f7', administrador: '#7fabce', tecnico: '#1a8f5c', recepcionista: '#c9821a', interno: '#6366f1' };
const GOLD = '#3b7bab';
const GOLD_LIGHT = '#7fabce';
const GOLD_DEEP = '#1b3a57';
const ROL_LABEL = { superadministrador: 'SUPERADMIN', administrador: 'ADMIN', tecnico: 'TECNICO', recepcionista: 'RECEPCION', interno: 'PERSONAL' };

function IconDash() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }
function IconInv()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconUsers(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconClient(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function IconOrden(){ return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>; }

export default function Layout() {
    const { usuario, logout, puede, puedeAlguno, esSuperadmin, empresa, soporte, terminarSoporte } = useAuth();
    const { isDark, toggle } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [bajoStockCount, setBajoStockCount] = useState(0);
    const [creditosPorVencer, setCreditosPorVencer] = useState(0);
    const [pagaresVencidos, setPagaresVencidos] = useState(0);
    const [miCuenta, setMiCuenta] = useState(false);

    useEffect(() => {
        // matchMedia solo avisa al cruzar los 768px; el evento 'resize' se
        // disparaba sin parar en moviles al mostrar/ocultar la barra del navegador.
        const mq = window.matchMedia('(max-width: 768px)');
        const onChange = () => setIsMobile(mq.matches);
        onChange();
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else mq.addListener(onChange);
        return () => {
            if (mq.removeEventListener) mq.removeEventListener('change', onChange);
            else mq.removeListener(onChange);
        };
    }, []);

    // Cerrar drawer al navegar en móvil
    useEffect(() => { setMobileOpen(false); }, [location.pathname, location.search]);

    // Insignia de stock bajo (solo si puede ver el inventario de mecanica; las
    // alertas de stock no aplican a Colisiones / Pintura).
    const veStock = puede('inventario_mecanica', 'ver');
    useEffect(() => {
        if (!veStock) { setBajoStockCount(0); return undefined; }
        // Solo se usa el total: se pide 1 fila en vez de la pagina completa.
        const revisar = () => api.get('/inventory/repuestos?bajo_stock=true&limit=1')
            .then(r => setBajoStockCount(r.data.total || 0))
            .catch(() => {});
        revisar();
        const interval = setInterval(revisar, 30000);
        return () => clearInterval(interval);
    }, [veStock]);

    // Las alertas de creditos y pagares se refrescan al navegar, pero como
    // maximo una vez cada 30 s (antes se pedian de nuevo en CADA cambio de
    // pagina): si la ultima consulta es reciente, se espera lo que falta.
    const ultimaRevision = useRef({ creditos: 0, pagares: 0 });

    // Compras a credito que vencen en 3 dias o menos (quien ve Proveedores).
    // La primera vez en la sesion del navegador tambien sale un aviso emergente.
    const veProveedores = puede('proveedores', 'ver');
    useEffect(() => {
        if (!veProveedores) { setCreditosPorVencer(0); return undefined; }
        const revisar = () => api.get('/proveedores/compras/alertas-credito')
            .then(({ data }) => {
                ultimaRevision.current.creditos = Date.now();
                const alertas = data.alertas || [];
                setCreditosPorVencer(alertas.length);
                let avisado = false;
                try { avisado = sessionStorage.getItem('ssswap_aviso_creditos') === '1'; } catch { /* sin storage */ }
                if (alertas.length && !avisado) {
                    const vencidas = alertas.filter(a => Number(a.dias_para_vencer) < 0).length;
                    toast(`${alertas.length} compra(s) a crédito por pagar${vencidas ? ` (${vencidas} vencida(s))` : ' en 3 días o menos'}. Revisa Proveedores › Compras.`, { icon: '⚠️', duration: 8000 });
                    try { sessionStorage.setItem('ssswap_aviso_creditos', '1'); } catch { /* sin storage */ }
                }
            })
            .catch(() => {});
        const primera = setTimeout(revisar, Math.max(0, RECONSULTA_MIN_MS - (Date.now() - ultimaRevision.current.creditos)));
        const interval = setInterval(revisar, 120000);
        return () => { clearTimeout(primera); clearInterval(interval); };
    }, [veProveedores, location.pathname, location.search]);

    // Pagares de clientes vencidos con saldo (quien ve la cartera). Mismo
    // mecanismo que las compras a credito: insignia en el menu + aviso unico
    // por sesion. Un pagare pagado por completo nunca cuenta como vencido.
    const veCartera = puede('cuentas_cobrar', 'ver');
    useEffect(() => {
        if (!veCartera) { setPagaresVencidos(0); return undefined; }
        const revisar = () => api.get('/cuentas-cobrar/alertas')
            .then(({ data }) => {
                ultimaRevision.current.pagares = Date.now();
                const vencidas = (data.alertas || []).filter(a => a.tipo_alerta === 'vencido');
                setPagaresVencidos(vencidas.length);
                let avisado = false;
                try { avisado = sessionStorage.getItem('ssswap_aviso_pagares') === '1'; } catch { /* sin storage */ }
                if (vencidas.length && !avisado) {
                    const total = vencidas.reduce((s, a) => s + Number(a.saldo), 0);
                    toast(`${vencidas.length} pagaré(s) de clientes vencido(s) · $${total.toFixed(2)} pendiente. Revisa Clientes › Pagaré / Cartera.`, { icon: '⏰', duration: 8000 });
                    try { sessionStorage.setItem('ssswap_aviso_pagares', '1'); } catch { /* sin storage */ }
                }
            })
            .catch(() => {});
        const primera = setTimeout(revisar, Math.max(0, RECONSULTA_MIN_MS - (Date.now() - ultimaRevision.current.pagares)));
        const interval = setInterval(revisar, 120000);
        return () => { clearTimeout(primera); clearInterval(interval); };
    }, [veCartera, location.pathname, location.search]);

    const SKY      = GOLD;
    const SKY_DEEP = GOLD_DEEP;
    const SKY_SOFT = GOLD_LIGHT;

    const sbBg    = isDark ? '#070b12' : '#0a0f1c';
    const sbBdr   = 'rgba(127,171,206,0.20)';
    // Fondo del area de trabajo: distinto de las tarjetas para que cada bloque se distinga
    const mainBg  = isDark ? '#0a0f17' : '#f3f5f9';
    const hdrBg   = isDark ? '#0d131d' : '#ffffff';
    const hdrBdr  = isDark ? 'rgba(148,163,184,0.24)' : '#d3dbe6';
    const txt     = isDark ? '#f1f5f9' : '#020617';
    const mut     = isDark ? 'rgba(241,245,249,0.72)' : '#475569';
    const navMut  = 'rgba(214,222,232,0.74)';
    const crumbAcc = isDark ? GOLD_LIGHT : GOLD_DEEP;

    const handleLogout = () => { logout(); toast.success('Sesion cerrada'); navigate('/admin/login'); };
    const opcionVisible = (c) => (c.soloSuperadmin ? esSuperadmin : (!c.permiso || puedeAlguno(c.permiso)));
    const grupos = NAV_GROUPS
        .map(g => g.children ? { ...g, children: g.children.filter(opcionVisible) } : g)
        .filter(g => (g.children ? g.children.length > 0 : (!g.permiso || puedeAlguno(g.permiso))));

    // Opcion activa = la de mayor puntaje entre todas (la mas especifica)
    const activo = (() => {
        let mejor = { score: 0, grupo: null, to: null };
        grupos.forEach(g => {
            const lista = g.children || [{ to: g.to }];
            lista.forEach(c => {
                const sc = g.children ? puntajeRuta(c.to, location, g.children, c.prefijo) : (location.pathname === g.to ? 10 : 0);
                if (sc > mejor.score) mejor = { score: sc, grupo: g.id, to: c.to };
            });
        });
        return mejor;
    })();

    // Acordeon: se abre solo el grupo de la pagina actual; el usuario puede
    // abrir otro (y se cierra el anterior) o cerrarlo con otro clic.
    const [grupoAbierto, setGrupoAbierto] = useState(activo.grupo);
    useEffect(() => { if (activo.grupo) setGrupoAbierto(activo.grupo); }, [activo.grupo]);
    const clickGrupo = (g) => {
        if (!g.children) { navigate(g.to); return; }
        if (collapsed && !isMobile) { navigate(g.children[0].to); setGrupoAbierto(g.id); return; }
        setGrupoAbierto(abierto => (abierto === g.id ? null : g.id));
    };

    // Breadcrumb dinámico
    const crumb = (() => {
        if (location.pathname.endsWith('/inventario'))   return 'Inventario';
        if (location.pathname.endsWith('/movimientos'))  return 'Entradas y salidas';
        if (location.pathname.endsWith('/historial-productos')) return 'Historial de productos';
        if (location.pathname.endsWith('/usuarios'))     return 'Usuarios y permisos';
        if (location.pathname.includes('/plataforma/auditoria')) return 'Auditoría global';
        if (location.pathname.includes('/plataforma/respaldos')) return 'Respaldos';
        if (location.pathname.includes('/plataforma/sistema'))   return 'Migraciones y errores';
        if (location.pathname.endsWith('/plataforma'))   return 'Empresas';
        if (location.pathname.endsWith('/empresa'))      return 'Configuración de la empresa';
        if (location.pathname.includes('/facturacion/config')) return 'Configuración tributaria';
        if (location.pathname.includes('/facturacion'))  return 'Facturación electrónica';
        if (location.pathname.includes('/plataforma/legal')) return 'Documentos y contratos';
        if (location.pathname.endsWith('/legal'))        return 'Documentos legales';
        if (location.pathname.endsWith('/contratacion')) return 'Contratación del servicio';
        if (location.pathname.endsWith('/auditoria'))    return 'Auditoría';
        if (location.pathname.endsWith('/acceso-denegado')) return 'Acceso denegado';
        if (location.pathname.endsWith('/clientes'))     return 'Clientes';
        if (location.pathname.endsWith('/ordenes'))      return 'Ordenes';
        if (location.pathname.endsWith('/citas'))        return 'Citas';
        if (location.pathname.endsWith('/vehiculos'))    return 'Vehiculos';
        if (location.pathname.endsWith('/sucursales'))   return 'Sucursales';
        if (location.pathname.endsWith('/servicios'))    return 'Servicios';
        if (location.pathname.endsWith('/bitacora'))     return 'Bitácora';
        if (location.pathname.endsWith('/proveedores'))  return 'Proveedores';
        if (location.pathname.endsWith('/graficas'))     return 'Gráficas';
        if (location.pathname.endsWith('/finanzas'))     return 'Finanzas';
        if (location.pathname.endsWith('/caja'))         return 'Caja diaria';
        if (location.pathname.endsWith('/pedidos'))      return 'Pedidos de la tienda';
        if (location.pathname.includes('/proformas')) {
            if (location.pathname.endsWith('/nueva'))   return 'Nueva Proforma';
            if (location.pathname.endsWith('/editar'))  return 'Editar Proforma';
            if (location.pathname.endsWith('/proformas')) return 'Proformas';
            return 'Proforma';
        }
        return 'Dashboard';
    })();

    const sidebarVisible = isMobile ? mobileOpen : true;
    const sidebarWidth = isMobile ? 232 : (collapsed ? 68 : 232);

    return (
        <div className="layout-root" style={{ display: 'flex', background: mainBg, overflow: 'hidden' }}>

            {/* ── Mobile overlay ── */}
            {isMobile && mobileOpen && (
                <div onClick={() => setMobileOpen(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 19 }} />
            )}

            {/* ── Sidebar ── */}
            <aside style={{
                width: sidebarWidth,
                background: sbBg,
                display: 'flex', flexDirection: 'column',
                // En movil solo se anima transform (lo mueve la GPU); animar width
                // obliga a recalcular el layout de toda la pagina en cada frame.
                transition: isMobile ? 'transform .26s cubic-bezier(.4,0,.2,1)' : 'width .28s cubic-bezier(.4,0,.2,1)',
                willChange: isMobile ? 'transform' : undefined,
                flexShrink: 0,
                borderRight: `1px solid ${sbBdr}`,
                overflow: 'hidden',
                position: isMobile ? 'fixed' : 'relative',
                top: 0, left: 0, bottom: 0,
                zIndex: isMobile ? 20 : 10,
                transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
            }}>
                {/* Glow superior */}
                <div style={{ position: 'absolute', top: -120, left: -40, right: -40, height: 240, background: `radial-gradient(closest-side, rgba(43,92,133,0.20), transparent)`, pointerEvents: 'none' }} />

                {/* Logo */}
                <div style={{
                    padding: collapsed ? '22px 0' : '22px 22px',
                    borderBottom: `1px solid ${sbBdr}`,
                    display: 'flex', alignItems: 'center', gap: 11,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    minHeight: 70, position: 'relative', zIndex: 1,
                }}>
                    {empresa?.logo_url ? (
                        // Logo de la empresa de la sesion (fondo claro: los logos suelen ser oscuros).
                        <div title={empresa.nombre} style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', padding: 3, flexShrink: 0, boxSizing: 'border-box' }}>
                            <LogoEmpresa alto={34} radio={7} />
                        </div>
                    ) : (
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `linear-gradient(135deg, ${GOLD_DEEP}, ${GOLD})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, boxShadow: `0 6px 20px -6px ${GOLD}`,
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                        </svg>
                    </div>
                    )}
                    {!collapsed && (
                        <div style={{ minWidth: 0 }}>
                            <p title={empresa?.nombre || 'SS SWAP'} style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: '1.05rem', letterSpacing: '.02em', color: '#fff', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{(empresa?.nombre || 'SS SWAP').toUpperCase()}</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.7rem', color: GOLD_LIGHT, marginTop: 2, letterSpacing: '.18em' }}>ADMIN PANEL</p>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav className="layout-sidebar-nav" style={{ flex: 1, paddingTop: 14, paddingBottom: 12, position: 'relative', zIndex: 1 }}>
                    {!collapsed && (
                        <p style={{ padding: '0 24px 8px', fontFamily: "'Sora'", fontWeight: 600, fontSize: '.72rem', letterSpacing: '.14em', color: 'rgba(127,171,206,0.72)' }}>MENÚ</p>
                    )}
                    {grupos.map((g, idx) => {
                        const abierto = grupoAbierto === g.id && !(collapsed && !isMobile);
                        const grupoActivo = activo.grupo === g.id;
                        return (
                            <div key={g.id} className="sb-group" style={{ animationDelay: `${idx * 40}ms` }}>
                                <button type="button" onClick={() => clickGrupo(g)}
                                    className={`sb-item sb-group-btn${grupoActivo ? ' is-active' : ''}${abierto ? ' is-open' : ''}`}
                                    aria-expanded={g.children ? abierto : undefined}
                                    title={collapsed ? g.label : undefined}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 13, width: '100%',
                                        padding: collapsed && !isMobile ? '12px 0' : '12px 22px', margin: '2px 0',
                                        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                                        color: grupoActivo || abierto ? '#fff' : navMut,
                                        background: grupoActivo && !g.children ? 'linear-gradient(90deg, rgba(43,92,133,0.22), rgba(43,92,133,0.02))' : 'transparent',
                                        border: 'none', cursor: 'pointer', textAlign: 'left',
                                        fontSize: '.95rem', fontFamily: "'Outfit'", fontWeight: 500,
                                    }}>
                                    <span className="sb-icon" style={{ flexShrink: 0, display: 'flex', color: grupoActivo ? GOLD_LIGHT : 'inherit', position: 'relative' }}>
                                        <g.icon />
                                        {g.badgeCredito && creditosPorVencer > 0 && (
                                            <span title="Compras a crédito por vencer" style={{ position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 999, background: '#f59e0b', color: '#fff', fontSize: '.6rem', fontFamily: "'Bebas Neue'", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 2px 6px rgba(245,158,11,.55)' }}>{creditosPorVencer}</span>
                                        )}
                                        {g.badgePagare && pagaresVencidos > 0 && (
                                            <span title="Pagarés de clientes vencidos" style={{ position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: '.6rem', fontFamily: "'Bebas Neue'", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 2px 6px rgba(239,68,68,.55)' }}>{pagaresVencidos}</span>
                                        )}
                                        {g.badgeStock && bajoStockCount > 0 && (
                                            <span style={{ position: 'absolute', top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: '.6rem', fontFamily: "'Bebas Neue'", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxShadow: '0 2px 6px rgba(239,68,68,.55)' }}>{bajoStockCount}</span>
                                        )}
                                    </span>
                                    {!(collapsed && !isMobile) && <span style={{ whiteSpace: 'nowrap', flex: 1 }}>{g.label}</span>}
                                    {!(collapsed && !isMobile) && g.children && (
                                        <svg className="sb-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18" /></svg>
                                    )}
                                </button>
                                {g.children && !(collapsed && !isMobile) && (
                                    <div className={`sb-sub${abierto ? ' is-open' : ''}`} role="group" aria-label={g.label} aria-hidden={!abierto}>
                                        <div className="sb-sub-inner">
                                            {g.children.map(c => {
                                                const activoHijo = activo.to === c.to;
                                                return (
                                                    <NavLink key={c.to} to={c.to} tabIndex={abierto ? 0 : -1}
                                                        className={`sb-subitem${activoHijo ? ' is-active' : ''}`}
                                                        aria-current={activoHijo ? 'page' : undefined}>
                                                        <span className="sb-subdot" />
                                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                                                    </NavLink>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Toggle collapse — hidden on mobile */}
                {!isMobile && (
                <button onClick={() => setCollapsed(c => !c)}
                    style={{
                        margin: '0 14px 16px', padding: '10px',
                        borderRadius: 10, border: `1px solid ${sbBdr}`,
                        background: 'rgba(127,171,206,0.06)', color: GOLD_LIGHT,
                        cursor: 'pointer', fontFamily: "'Sora'", fontWeight: 600, fontSize: '.76rem', letterSpacing: '.08em',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        transition: 'all .2s', position: 'relative', zIndex: 1,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(127,171,206,0.55)'; e.currentTarget.style.background = 'rgba(127,171,206,0.12)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = sbBdr; e.currentTarget.style.background = 'rgba(127,171,206,0.06)'; }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        {collapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
                    </svg>
                    {!collapsed && <span>COLAPSAR</span>}
                </button>
                )}
            </aside>

            {/* ── Main ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Header */}
                <header className="layout-header" style={{
                    background: hdrBg,
                    borderBottom: `1px solid ${hdrBdr}`,
                    padding: '0 32px', height: 64,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0, position: 'relative', zIndex: 5,
                }}>
                    <div className="hdr-left" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        {/* Hamburger — mobile only */}
                        {isMobile && (
                            <button onClick={() => setMobileOpen(o => !o)} aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={mobileOpen}
                                style={{ background: 'none', border: `1px solid ${isDark ? 'rgba(127,171,206,0.20)' : '#b6c3d3'}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: mut, display: 'flex', marginRight: 4 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                            </button>
                        )}
                        <p className="hdr-admin" style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: '.74rem', letterSpacing: '.14em', color: crumbAcc }}>ADMIN</p>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={mut} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <p className="hdr-crumb" title={crumb} style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.95rem', color: txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{crumb}</p>
                        {/* Ayuda contextual de la sección actual (Sprint 27) */}
                        <BotonAyuda color={crumbAcc} />
                        {/* Empresa de la sesion (la decide el servidor) */}
                        {(empresa || esSuperadmin) && (
                            <span className="hdr-empresa" title="Empresa en la que estas trabajando" style={{ marginLeft: 10, padding: '3px 10px', borderRadius: 999, fontFamily: "'Sora'", fontWeight: 600, fontSize: '.76rem', letterSpacing: '.06em',
                                color: soporte ? (isDark ? '#fbbf24' : '#b45309') : crumbAcc, background: soporte ? 'rgba(245,158,11,.12)' : (isDark ? 'rgba(127,171,206,.12)' : 'rgba(59,123,171,.10)'), border: `1px solid ${soporte ? 'rgba(245,158,11,.45)' : 'rgba(59,123,171,.30)'}`, whiteSpace: 'nowrap' }}>
                                {empresa ? empresa.nombre.toUpperCase() : 'PLATAFORMA'}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {/* Theme toggle */}
                        <button onClick={toggle} className="btn-icon" title={isDark ? 'Modo claro' : 'Modo oscuro'} aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} style={{ color: mut }}>
                            {isDark
                                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            }
                        </button>

                        {/* User pill: nombre + rol; abre "Mi cuenta" */}
                        <button type="button" className="hdr-pill" onClick={() => setMiCuenta(true)} title="Mi cuenta (cambiar contraseña)"
                            aria-label={`Mi cuenta: ${usuario?.nombre || ''}, ${ROL_LABEL[usuario?.rol] || usuario?.rol || ''}`}
                            style={{
                            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '6px 12px 6px 6px',
                            border: `1px solid ${isDark ? 'rgba(127,171,206,0.20)' : '#b6c3d3'}`,
                            borderRadius: 999,
                            background: isDark ? 'rgba(127,171,206,0.06)' : '#ffffff',
                        }}>
                            <div style={{
                                width: 30, height: 30, borderRadius: '50%',
                                background: `linear-gradient(135deg, ${GOLD_DEEP}, ${GOLD})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `0 4px 12px -4px ${GOLD}`,
                            }}>
                                <span style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: '.78rem', color: '#fff' }}>{usuario?.nombre?.[0]?.toUpperCase()}</span>
                            </div>
                            <div className="hdr-username">
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.9rem', color: txt, lineHeight: 1 }}>{usuario?.nombre}</p>
                                <p style={{ fontFamily: "'Sora'", fontWeight: 600, fontSize: '.7rem', letterSpacing: '.08em', color: (!isDark && usuario?.rol === 'administrador') ? GOLD_DEEP : (ROL_COLOR[usuario?.rol] || SKY), lineHeight: 1.5 }}>{ROL_LABEL[usuario?.rol] || usuario?.rol}</p>
                            </div>
                        </button>

                        {/* Logout */}
                        <button onClick={handleLogout} className="btn-icon"
                            style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                            title="Cerrar sesion" aria-label="Cerrar sesión"
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.45)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main className="main-content-pad" style={{ flex: 1, overflowY: 'auto', padding: '32px 36px', animation: 'fadeIn .35s ease', background: mainBg }}>
                    {/* Modo soporte: visible siempre, con su motivo, limite y salida */}
                    {soporte && (
                        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18, padding: '10px 14px', borderRadius: 12,
                            background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.45)', fontFamily: "'Outfit'", fontSize: '.85rem', color: txt }}>
                            <strong style={{ color: isDark ? '#fbbf24' : '#b45309' }}>MODO SOPORTE{soporte.modo === 'lectura' ? ' · SOLO LECTURA' : ''}</strong>
                            <span>en {empresa?.nombre} · {soporte.motivo} · vence a las {new Date(soporte.expira).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })} — todo lo que hagas queda en su auditoría</span>
                            <button type="button" onClick={terminarSoporte} style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(245,158,11,.6)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: isDark ? '#fbbf24' : '#b45309', fontFamily: "'Bebas Neue'", letterSpacing: '.1em' }}>TERMINAR SOPORTE</button>
                        </div>
                    )}
                    <AvisoPendientes />
                    {/* Suspense aqui: al cambiar de pagina solo el contenido muestra
                        el indicador de carga; menu y encabezado se quedan quietos. */}
                    <Suspense fallback={<CargandoPagina />}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
            {miCuenta && <ModalMiCuenta onClose={() => setMiCuenta(false)} />}
        </div>
    );
}
