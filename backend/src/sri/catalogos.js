/**
 * SS SWAP - Catálogos oficiales del SRI usados en la facturación electrónica
 *
 * Fuente: Ficha Técnica de Comprobantes Electrónicos, Esquema Off-line,
 * versión 2.34 (julio 2026), descargada de https://www.sri.gob.ec/facturacion-electronica
 *  - Tabla 3:  tipos de comprobante (codDoc)
 *  - Tabla 4:  ambiente (1 pruebas, 2 producción)
 *  - Tabla 6:  tipo de identificación del comprador
 *  - Tabla 16: código de impuesto (IVA = 2)
 *  - Tabla 17: tarifas de IVA (codigoPorcentaje)
 *  - Tabla 24: formas de pago
 * Si el SRI cambia una tarifa o agrega una forma de pago, se actualiza AQUÍ
 * (y la prueba sri.catalogos lo recuerda).
 */

const VERSION_FICHA = '2.34';

const COD_DOC = { FACTURA: '01', NOTA_CREDITO: '04' };
const NOMBRE_DOC = { '01': 'FACTURA', '04': 'NOTA DE CRÉDITO' };

const AMBIENTES = { 1: 'PRUEBAS', 2: 'PRODUCCIÓN' };

const TIPOS_IDENTIFICACION = {
    '04': 'RUC',
    '05': 'Cédula',
    '06': 'Pasaporte',
    '07': 'Consumidor final',
    '08': 'Identificación del exterior',
};
const CONSUMIDOR_FINAL = { tipo: '07', identificacion: '9999999999999', razonSocial: 'CONSUMIDOR FINAL' };
// Ficha 9.10: por encima de este valor hay que identificar al comprador.
const LIMITE_CONSUMIDOR_FINAL = 50;

const CODIGO_IVA = '2';
// Tabla 17. `vigente` = se ofrece para comprobantes nuevos.
const TARIFAS_IVA = {
    '0':  { tarifa: 0,  nombre: 'IVA 0%', vigente: true },
    '2':  { tarifa: 12, nombre: 'IVA 12%', vigente: false },
    '3':  { tarifa: 14, nombre: 'IVA 14%', vigente: false },
    '4':  { tarifa: 15, nombre: 'IVA 15%', vigente: true },
    '5':  { tarifa: 5,  nombre: 'IVA 5%', vigente: true },
    '6':  { tarifa: 0,  nombre: 'No objeto de IVA', vigente: true },
    '7':  { tarifa: 0,  nombre: 'Exento de IVA', vigente: true },
    '8':  { tarifa: 0,  nombre: 'IVA diferenciado', vigente: false },
    '10': { tarifa: 13, nombre: 'IVA 13%', vigente: true },
};

// Tabla 24.
const FORMAS_PAGO = {
    '01': 'Sin utilización del sistema financiero',
    '15': 'Compensación de deudas',
    '16': 'Tarjeta de débito',
    '17': 'Dinero electrónico',
    '18': 'Tarjeta prepago',
    '19': 'Tarjeta de crédito',
    '20': 'Otros con utilización del sistema financiero',
    '21': 'Endoso de títulos',
};

// Métodos de pago internos (cat_metodos_pago) → forma de pago SRI sugerida.
// "tarjeta" se precisa con pagos_cliente.tarjeta_tipo (credito/debito).
// Es solo una sugerencia: quien emite confirma la forma de pago real.
const FORMA_PAGO_POR_METODO = { efectivo: '01', transferencia: '20', cheque: '20', tarjeta: '19', otro: '20' };
const FORMA_PAGO_POR_TARJETA = { credito: '19', debito: '16', prepago: '18' };

const REGIMENES = {
    general: { nombre: 'Régimen general', leyenda: null },
    rimpe_emprendedor: { nombre: 'RIMPE Emprendedor', leyenda: 'CONTRIBUYENTE RÉGIMEN RIMPE' },
    rimpe_negocio_popular: { nombre: 'RIMPE Negocio Popular', leyenda: 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE' },
};

/** codigoPorcentaje de IVA para un porcentaje numérico (solo tarifas vigentes con valor > 0 o 0%). */
function codigoIvaPorPorcentaje(porcentaje) {
    const p = Number(porcentaje);
    if (!Number.isFinite(p)) return null;
    const entrada = Object.entries(TARIFAS_IVA).find(([cod, t]) => t.tarifa === p && (p > 0 || cod === '0'));
    return entrada ? entrada[0] : null;
}

module.exports = {
    VERSION_FICHA, COD_DOC, NOMBRE_DOC, AMBIENTES, TIPOS_IDENTIFICACION, CONSUMIDOR_FINAL,
    LIMITE_CONSUMIDOR_FINAL, CODIGO_IVA, TARIFAS_IVA, FORMAS_PAGO, FORMA_PAGO_POR_METODO, FORMA_PAGO_POR_TARJETA, REGIMENES,
    codigoIvaPorPorcentaje,
};
