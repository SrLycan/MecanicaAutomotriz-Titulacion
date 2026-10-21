/**
 * SS SWAP - Datos del comprobante de una compra (Sprint 26)
 * Tipo y numero de documento, tipo de registro y sustento tributario
 * (tabla 5 del ATS del SRI), compartidos por las compras manuales y las
 * registradas desde una factura electronica.
 */

const TIPOS_DOCUMENTO = ['orden', 'factura', 'nota_venta', 'otro'];
const TIPOS_REGISTRO = ['inventario', 'gasto', 'activo_fijo'];

/** Codigos de sustento tributario del SRI (mismos textos que el ATS). */
const SUSTENTOS = {
    '01': 'Crédito Tributario para declaración de IVA (servicios y bienes distintos de inventarios y activos fijos)',
    '02': 'Costo o Gasto para declaración de IR (servicios y bienes distintos de inventarios y activos fijos)',
    '03': 'Activo Fijo - Crédito Tributario para declaración de IVA',
    '04': 'Activo Fijo - Costo o Gasto para declaración de IR',
    '05': 'Liquidación Gastos de Viaje, hospedaje y alimentación Gastos IR (a nombre de empleados y no de la empresa)',
    '06': 'Inventario - Crédito Tributario para declaración de IVA',
    '07': 'Inventario - Costo o Gasto para declaración de IR',
    '08': 'Valor pagado para solicitar Reembolso de Gasto (intermediario)',
    '09': 'Reembolso por Siniestros',
    '10': 'Distribución de Dividendos, Beneficios o Utilidades',
    '11': "Convenios de débito o recaudación para IFI's",
    '12': 'Impuestos y retenciones presuntivos',
    '13': 'Valores reconocidos por entidades del sector público a favor de sujetos pasivos',
    '14': 'Valores facturados por socios a operadoras de transporte (que no constituyen gasto de dicha operadora)',
    '15': 'Pagos efectuados por consumos propios y de terceros de servicios digitales',
    '00': 'Casos especiales cuyo sustento no aplica en las opciones anteriores',
};

/** Sustento sugerido segun como se registra la compra. */
const SUSTENTO_POR_REGISTRO = { inventario: '06', gasto: '01', activo_fijo: '03' };

/**
 * "1-2-87124" / "001-002-000087124" / { est, pto, sec } -> "001-002-000087124".
 * Devuelve null si viene vacio y lanza Error si no es valido.
 */
function normalizarNumeroDocumento(valor) {
    let est; let pto; let sec;
    if (valor && typeof valor === 'object') ({ est, pto, sec } = valor);
    else {
        const t = String(valor ?? '').trim();
        if (!t) return null;
        const partes = t.split(/[-\s]+/);
        if (partes.length !== 3) throw new Error('El número del documento debe tener establecimiento, punto de emisión y secuencial (001-001-000000123).');
        [est, pto, sec] = partes;
    }
    if (![est, pto, sec].every(p => /^\d+$/.test(String(p ?? '').trim()))) {
        throw new Error('El número del documento solo admite dígitos (001-001-000000123).');
    }
    const e = String(est).trim(); const p = String(pto).trim(); const s = String(sec).trim();
    if (e.length > 3 || p.length > 3 || s.length > 9 || Number(s) === 0 || Number(e) === 0 || Number(p) === 0) {
        throw new Error('Número de documento inválido: establecimiento y punto de 3 dígitos y secuencial de hasta 9 (mayor a cero).');
    }
    return `${e.padStart(3, '0')}-${p.padStart(3, '0')}-${s.padStart(9, '0')}`;
}

/** Tarifa de IVA (porcentaje) de un articulo de factura electronica (impuesto codigo 2). */
function tarifaIvaDetalle(impuestos) {
    const lista = Array.isArray(impuestos) ? impuestos : [];
    const iva = lista.filter(t => String(t.codigo) === '2' && Number.isFinite(Number(t.tarifa)));
    return iva.length ? Math.max(...iva.map(t => Number(t.tarifa))) : 0;
}

module.exports = {
    TIPOS_DOCUMENTO, TIPOS_REGISTRO, SUSTENTOS, SUSTENTO_POR_REGISTRO,
    normalizarNumeroDocumento, tarifaIvaDetalle,
};
