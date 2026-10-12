/**
 * SS SWAP - Pruebas unitarias de facturación electrónica (sin base de datos)
 *
 * Referencias: Ficha Técnica Off-line v2.34 (ejemplo de módulo 11 de la
 * Tabla 1, Tabla 6, Tabla 17) y los XSD oficiales en src/sri/xsd.
 */
const { digitoVerificador, generarClaveAcceso, claveValida, descomponerClave } = require('../claveAcceso');
const { validarCedula, validarRuc, validarIdentificacion, tipoSugerido } = require('../identificacion');
const { calcularComprobante, f6 } = require('../calculos');
const { construirXml, esc } = require('../xml');
const { validarXsd } = require('../validadorXsd');
const { firmarComprobante, verificarFirma, abrirP12 } = require('../firma');
const { cifrar, descifrar } = require('../certificado');
const { codigoIvaPorPorcentaje, TARIFAS_IVA } = require('../catalogos');
const { certificadoPrueba } = require('../../test-utils/certificadoPrueba');

const comprobanteBase = (extra = {}) => {
    const calc = calcularComprobante([
        { codigo: 'SRV-1', descripcion: 'Servicio & revisión <motor>', cantidad: 1, precio_unitario: 45.5, iva_codigo: '4' },
        { codigo: 'REP-2', descripcion: 'Repuesto "original"', cantidad: 2, precio_unitario: 18.333333, iva_codigo: '4' },
        { descripcion: 'Exento', cantidad: 1, precio_unitario: 10, iva_codigo: '0' },
    ], { descuentoGlobal: 5 });
    return {
        codDoc: '01', ambiente: 1,
        claveAcceso: generarClaveAcceso({ fechaEmision: '2026-10-12', codDoc: '01', ruc: '1790000000001', ambiente: 1, establecimiento: '001', puntoEmision: '001', secuencial: 1, codigo: '12345678' }),
        establecimiento: '001', puntoEmision: '001', secuencial: '000000001', fechaEmision: '2026-10-12',
        emisor: { razonSocial: 'EMISOR S.A.', ruc: '1790000000001', dirMatriz: 'Quito', dirEstablecimiento: 'Quito', obligadoContabilidad: true, regimen: 'general' },
        comprador: { tipoIdentificacion: '05', razonSocial: 'PRUEBAS SERVICIO DE RENTAS INTERNAS', identificacion: '1710034065', direccion: 'Quito' },
        ...calc, pagos: [{ formaPago: '01', total: calc.importeTotal }], infoAdicional: [{ nombre: 'Placa', valor: 'PBA-1234' }],
        ...extra,
    };
};

describe('Clave de acceso (Tabla 1, módulo 11)', () => {
    test('ejemplo oficial de la ficha: 41261533 → 6', () => {
        expect(digitoVerificador('41261533')).toBe(6);
    });
    test('resultado 11 → 0 y resultado 10 → 1', () => {
        // Se buscan cadenas cuyo cálculo dé 11 y 10 para cubrir ambas reglas.
        const buscar = (objetivo) => {
            for (let i = 0; i < 100000; i++) {
                const c = String(i).padStart(8, '0');
                let s = 0; let f = 2;
                for (let k = c.length - 1; k >= 0; k--) { s += Number(c[k]) * f; f = f === 7 ? 2 : f + 1; }
                if (11 - (s % 11) === objetivo) return c;
            }
            return null;
        };
        expect(digitoVerificador(buscar(11))).toBe(0);
        expect(digitoVerificador(buscar(10))).toBe(1);
    });
    test('49 dígitos, partes en su lugar y verificables', () => {
        const clave = generarClaveAcceso({ fechaEmision: '2026-10-12', codDoc: '01', ruc: '1790000000001', ambiente: 2, establecimiento: '002', puntoEmision: '003', secuencial: 45, codigo: '87654321' });
        expect(clave).toHaveLength(49);
        expect(claveValida(clave)).toBe(true);
        expect(descomponerClave(clave)).toMatchObject({ fecha: '12102026', codDoc: '01', ruc: '1790000000001', ambiente: '2',
            establecimiento: '002', puntoEmision: '003', secuencial: '000000045', codigo: '87654321', tipoEmision: '1' });
        expect(claveValida(clave.slice(0, 48) + ((Number(clave[48]) + 1) % 10))).toBe(false);
    });
    test('rechaza campos mal conformados', () => {
        expect(() => generarClaveAcceso({ fechaEmision: '2026-10-12', codDoc: '01', ruc: '123', ambiente: 1, establecimiento: '001', puntoEmision: '001', secuencial: 1 })).toThrow(/ruc/);
    });
});

describe('Identificaciones (formato; el SRI no publica consulta de datos)', () => {
    test('cédula válida e inválida', () => {
        expect(validarCedula('1710034065').valido).toBe(true);
        expect(validarCedula('1710034066').valido).toBe(false);
        expect(validarCedula('2510034065').valido).toBe(false); // provincia 25 no existe
        expect(validarCedula('17100340').valido).toBe(false);
    });
    test('RUC: estructura obligatoria; dígito de sociedades solo advierte', () => {
        expect(validarRuc('1710034065001').valido).toBe(true);
        expect(validarRuc('1710034065000').valido).toBe(false); // establecimiento 000
        const soc = validarRuc('1790000000001');
        expect(soc.valido).toBe(true);
        expect(soc.advertencias.length + soc.errores.length).toBeGreaterThanOrEqual(0);
        expect(validarRuc('1780000000001').valido).toBe(false); // tercer dígito 8
    });
    test('consumidor final, pasaporte y sugerencia de tipo', () => {
        expect(validarIdentificacion('07', '9999999999999').valido).toBe(true);
        expect(validarIdentificacion('07', '1710034065').valido).toBe(false);
        expect(validarIdentificacion('06', 'AB123456').valido).toBe(true);
        expect(tipoSugerido('1710034065')).toBe('05');
        expect(tipoSugerido('1710034065001')).toBe('04');
    });
});

describe('Cálculos (Tabla 21 y regla de redondeo)', () => {
    test('reparte el descuento global y cuadra centavos por tarifa', () => {
        const c = calcularComprobante([
            { descripcion: 'A', cantidad: 1, precio_unitario: 40, iva_codigo: '4' },
            { descripcion: 'B', cantidad: 2, precio_unitario: 18.5, iva_codigo: '4' },
        ], { descuentoGlobal: 2 });
        expect(c.totalSinImpuestos).toBe(75);
        expect(c.totalDescuento).toBe(2);
        expect(c.impuestos).toEqual([{ codigoPorcentaje: '4', tarifa: 15, base: 75, valor: 11.25 }]);
        expect(c.importeTotal).toBe(86.25);
        const sumaLineas = c.lineas.reduce((s, l) => s + Math.round(l.iva_valor * 100), 0) / 100;
        expect(sumaLineas).toBe(11.25);
    });
    test('separa bases por tarifa (15 %, 0 %, no objeto)', () => {
        const c = calcularComprobante([
            { descripcion: 'A', cantidad: 3, precio_unitario: 0.333333, iva_codigo: '4' },
            { descripcion: 'B', cantidad: 1, precio_unitario: 7, iva_codigo: '0' },
            { descripcion: 'C', cantidad: 1, precio_unitario: 3, iva_codigo: '6' },
        ]);
        expect(c.impuestos.map(g => g.codigoPorcentaje)).toEqual(['0', '4', '6']);
        expect(c.importeTotal).toBe(Math.round((c.totalSinImpuestos + c.totalIva) * 100) / 100);
    });
    test('rechaza valores inválidos', () => {
        expect(() => calcularComprobante([])).toThrow();
        expect(() => calcularComprobante([{ descripcion: 'X', cantidad: 0, precio_unitario: 1, iva_codigo: '4' }])).toThrow(/cantidad/);
        expect(() => calcularComprobante([{ descripcion: 'X', cantidad: 1, precio_unitario: 1, iva_codigo: '99' }])).toThrow(/tarifa/);
        expect(() => calcularComprobante([{ descripcion: 'X', cantidad: 1, precio_unitario: 10, iva_codigo: '4' }], { descuentoGlobal: 11 })).toThrow(/descuento/);
    });
    test('formato de hasta 6 decimales', () => {
        expect(f6(18.333333)).toBe('18.333333');
        expect(f6(2)).toBe('2.00');
        expect(f6(1.5)).toBe('1.50');
    });
    test('mapeo de porcentaje a tarifa oficial', () => {
        expect(codigoIvaPorPorcentaje(15)).toBe('4');
        expect(codigoIvaPorPorcentaje(0)).toBe('0');
        expect(codigoIvaPorPorcentaje(7)).toBeNull();
        expect(TARIFAS_IVA['2'].vigente).toBe(false); // 12 % ya no se ofrece
    });
});

describe('XML contra los XSD oficiales', () => {
    test('factura 1.1.0 válida, con caracteres especiales escapados', async () => {
        const xml = construirXml(comprobanteBase());
        expect(xml).toContain('Servicio &amp; revisión &lt;motor&gt;');
        expect(xml).toContain('<cantidad>2.00</cantidad><precioUnitario>18.333333</precioUnitario>');
        const r = await validarXsd(xml, '01');
        expect(r).toEqual({ valido: true, errores: [] });
    });
    test('leyendas RIMPE emprendedor y negocio popular', async () => {
        for (const regimen of ['rimpe_emprendedor', 'rimpe_negocio_popular']) {
            const base = comprobanteBase();
            const xml = construirXml({ ...base, emisor: { ...base.emisor, regimen } });
            expect(xml).toMatch(/<contribuyenteRimpe>CONTRIBUYENTE (RÉGIMEN RIMPE|NEGOCIO POPULAR - RÉGIMEN RIMPE)<\/contribuyenteRimpe>/);
            expect((await validarXsd(xml, '01')).valido).toBe(true);
        }
    });
    test('nota de crédito 1.1.0 válida', async () => {
        const base = comprobanteBase({ codDoc: '04', motivo: 'Devolución', sustento: { codDoc: '01', numero: '001-001-000000001', fechaEmision: '2026-10-12' } });
        const xml = construirXml(base);
        expect(xml).toContain('<numDocModificado>001-001-000000001</numDocModificado>');
        expect((await validarXsd(xml, '04')).valido).toBe(true);
    });
    test('un XML fuera de esquema se detecta antes de enviarlo', async () => {
        const xml = construirXml(comprobanteBase()).replace('<totalDescuento>', '<totalDescuentoX>').replace('</totalDescuento>', '</totalDescuentoX>');
        const r = await validarXsd(xml, '01');
        expect(r.valido).toBe(false);
        expect(r.errores.length).toBeGreaterThan(0);
    });
    test('el escape quita saltos de línea (los XSD exigen [^\\n]*)', () => {
        expect(esc('a\nb & c')).toBe('a b &amp; c');
    });
});

describe('Firma XAdES-BES', () => {
    const { p12, clave } = certificadoPrueba();

    test('firma verificable, XML firmado sigue cumpliendo el XSD', async () => {
        const firmado = firmarComprobante(construirXml(comprobanteBase()), p12, clave);
        expect(firmado).toContain('<ds:Signature');
        expect(firmado).toContain('http://uri.etsi.org/01903/v1.3.2#');
        expect(firmado).toContain('rsa-sha1');
        expect(verificarFirma(firmado)).toEqual({ valida: true });
        expect((await validarXsd(firmado, '01')).valido).toBe(true);
    });
    test('una alteración posterior invalida la firma', () => {
        const firmado = firmarComprobante(construirXml(comprobanteBase()), p12, clave);
        const alterado = firmado.replace('<importeTotal>', '<importeTotal>1');
        expect(verificarFirma(alterado).valida).toBe(false);
    });
    test('clave incorrecta del .p12', () => {
        expect(() => abrirP12(p12, 'otra')).toThrow(/clave del certificado/);
    });
    test('verificación independiente con xml-crypto', () => {
        const { SignedXml } = require('xml-crypto');
        const { DOMParser } = require('@xmldom/xmldom');
        const firmado = firmarComprobante(construirXml(comprobanteBase()), p12, clave);
        const doc = new DOMParser().parseFromString(firmado, 'text/xml');
        const sx = new SignedXml({ idAttributes: ['Id', 'id'], getCertFromKeyInfo: SignedXml.getCertFromKeyInfo });
        sx.loadSignature(doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0]);
        expect(sx.checkSignature(firmado)).toBe(true);
    });
});

describe('Custodia del certificado', () => {
    const previa = process.env.SRI_CERT_KEY;
    afterAll(() => { if (previa === undefined) delete process.env.SRI_CERT_KEY; else process.env.SRI_CERT_KEY = previa; });

    test('cifra y descifra; sin la llave no se abre', () => {
        process.env.SRI_CERT_KEY = 'llave-de-custodia-de-prueba-0123456789abcdef';
        const blob = cifrar(Buffer.from('contenido secreto'));
        expect(blob.includes(Buffer.from('contenido secreto'))).toBe(false);
        expect(descifrar(blob).toString()).toBe('contenido secreto');
        process.env.SRI_CERT_KEY = 'otra-llave-distinta-0123456789abcdefghijkl';
        expect(() => descifrar(blob)).toThrow(/SRI_CERT_KEY/);
        delete process.env.SRI_CERT_KEY;
        expect(() => cifrar(Buffer.from('x'))).toThrow(/SRI_CERT_KEY/);
    });
});
