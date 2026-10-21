/**
 * SS SWAP - Tema visual y utilidades del modulo de Finanzas y Caja.
 * Misma paleta (SKY) y tipografia (Bebas Neue / Outfit) que Proveedores,
 * para que las pantallas nuevas se vean igual que el resto del panel.
 */
import { useTheme } from '../../context/ThemeContext';

export function useTemaPanel() {
    const { isDark } = useTheme();
    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    // Modo claro: bordes y sombras marcados para que cada tarjeta/tabla se
    // distinga del fondo blanco del panel.
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.12)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.35)';
    const txt   = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf = isDark ? '#cbd5e1' : '#334155';
    const mut   = isDark ? 'rgba(241,245,249,0.72)' : '#526075';
    const bdr   = isDark ? 'rgba(148,163,184,0.28)' : '#b6c3d3';
    const card  = isDark ? 'rgba(255,255,255,0.045)' : '#ffffff';
    const boxBg = isDark ? '#111826' : '#ffffff';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const cardSh = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 1px 2px rgba(15,23,42,0.06), 0 8px 22px -8px rgba(15,23,42,0.20)';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.74rem', letterSpacing: '.22em', color: SKY_DEEP };
    const btnPrim = { display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '10px 18px', cursor: 'pointer' };
    const btnSec  = { display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.74rem', letterSpacing: '.14em', color: txtSf, background: card, border: `1px solid ${bdr}`, borderRadius: 11, padding: '10px 16px', cursor: 'pointer' };
    return { isDark, txt, txtSf, mut, bdr, card, boxBg, inputBg, cardSh, inputSt, labelSt, btnPrim, btnSec, SKY, SKY_DEEP, SKY_PALE, SKY_BDR };
}

export const VERDE = '#10b981';
export const ROJO = '#ef4444';
export const AMBAR = '#f59e0b';
export const VIOLETA = '#8b5cf6';

/** $1.234,56 (formato Ecuador) */
export function dinero(n) {
    const v = Number(n) || 0;
    return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Fecha local de hoy en formato YYYY-MM-DD */
export const hoyLocal = () => new Date().toLocaleDateString('sv-SE');

/** Mes local actual YYYY-MM */
export const mesActual = () => hoyLocal().slice(0, 7);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** '2026-10' o '2026-10-01' -> 'octubre 2026' */
export function nombreMes(valor) {
    const m = /^(\d{4})-(\d{2})/.exec(String(valor || ''));
    return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** 2026-10-05 -> 05/10/2026 */
export function fechaCorta(f) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export const ORIGEN_LABEL = {
    pago_cliente: 'Cobro cliente',
    pago_proveedor: 'Pago proveedor',
    gasto: 'Gasto',
    caja: 'Caja',
    pago_empleado: 'Nómina',
    movimiento: 'Finanzas',
};

export const METODOS_PAGO = [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'cheque', label: 'Cheque' },
    { id: 'otro', label: 'Otro' },
];

export const TIPOS_PAGO_EMPLEADO = [
    { id: 'sueldo', label: 'Sueldo' },
    { id: 'anticipo', label: 'Anticipo' },
    { id: 'bono', label: 'Bono' },
    { id: 'comision', label: 'Comisión' },
    { id: 'horas_extra', label: 'Horas extra' },
    { id: 'liquidacion', label: 'Liquidación' },
    { id: 'otro', label: 'Otro' },
];

export const ROL_LABEL = { administrador: 'Administrador', tecnico: 'Técnico', recepcionista: 'Recepción' };
