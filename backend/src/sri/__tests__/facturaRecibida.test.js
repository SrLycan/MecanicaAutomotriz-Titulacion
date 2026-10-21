/**
 * SS SWAP - Lectura de facturas recibidas (Sprint 25), sin base de datos.
 */
const { analizarClave, leerFactura } = require('../facturaRecibida');
const { construirXml } = require('../xml');
const { calcularComprobante } = require('../calculos');
const { generarClaveAcceso } = require('../claveAcceso');

function factura({ version } = {}) {
    const calc = calcularComprobante([
        { codigo: 'BOSCH-0451', descripcion: 'Filtro aceite', cantidad: 3, precio_unitario: 4.5, iva_codigo: '4' },
        { codigo: 'PPG-2K', descripcion: 'Pintura 2K litro', cantidad: 2.5, precio_unitario: 22, iva_codigo: '4', descuento: 1 },
    ], {});
    const xml = construirXml({
        codDoc: '01', ambiente: 2,
        claveAcceso: generarClaveAcceso({ fechaEmision: '2026-10-10', codDoc: '01', ruc: '0990000001001', ambiente: 2, establecimiento: '002', puntoEmision: '003', secuencial: 45, codigo: '87654321' }),
        establecimiento: '002', puntoEmision: '003', secuencial: '000000045', fechaEmision: '2026-10-10',
        emisor: { razonSocial: 'DISTRIBUIDORA X S.A.', ruc: '0990000001001', dirMatriz: 'Guayaquil', dirEstablecimiento: 'Gye', obligadoContabilidad: true, regimen: 'general' },
        comprador: { tipoIdentificacion: '04', razonSocial: 'SS SWAP', identificacion: '1790000000001', direccion: 'Quito' },
        ...calc, pagos: [{ formaPago: '20', total: calc.importeTotal }],
    });
    return version ? xml.replace(/version="1\.1\.0"/, `version="${version}"`) : xml;
}

describe('analizarClave', () => {
    test('descompone una clave valida', () => {
        const clave = generarClaveAcceso({ fechaEmision: '2026-10-10', codDoc: '01', ruc: '0990000001001', ambiente: 2, establecimiento: '002', puntoEmision: '003', secuencial: 45, codigo: '87654321' });
        expect(analizarClave(` ${clave} `)).toMatchObject({ clave, fechaEmision: '2026-10-10', codDoc: '01', ruc: '0990000001001', ambiente: 2, establecimiento: '002', puntoEmision: '003', secuencial: '000000045' });
    });
    test('rechaza longitud, letras, digito verificador y fecha imposible', () => {
        const clave = generarClaveAcceso({ fechaEmision: '2026-10-10', codDoc: '01', ruc: '0990000001001', ambiente: 2, establecimiento: '002', puntoEmision: '003', secuencial: 45, codigo: '87654321' });
        for (const mala of ['', '123', 'a'.repeat(49), clave.slice(0, 48) + ((Number(clave[48]) + 1) % 10), `3102${clave.slice(4)}`]) {
            expect(() => analizarClave(mala)).toThrow();
        }
    });
});

describe('leerFactura', () => {
    test('extrae cabecera, totales y articulos (con cantidades decimales y descuentos)', () => {
        const r = leerFactura(factura());
        expect(r.cabecera).toMatchObject({ ruc: '0990000001001', razonSocial: 'DISTRIBUIDORA X S.A.', fechaEmision: '2026-10-10', compradorIdentificacion: '1790000000001',
            totalSinImpuestos: 67.5, totalDescuento: 1, totalIva: 10.13, importeTotal: 77.63 });
        expect(r.detalles.map(d => [d.codigoPrincipal, d.cantidad, d.precioUnitario, d.descuento, d.precioTotalSinImpuesto]))
            .toEqual([['BOSCH-0451', 3, 4.5, 0, 13.5], ['PPG-2K', 2.5, 22, 1, 54]]);
    });
    test('acepta otras versiones de la factura y la respuesta de autorizacion que la envuelve', () => {
        expect(leerFactura(factura({ version: '2.1.0' })).detalles).toHaveLength(2);
        const envuelto = `<autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>1</numeroAutorizacion><comprobante><![CDATA[${factura()}]]></comprobante></autorizacion>`;
        const r = leerFactura(envuelto);
        expect(r.autorizacionArchivo.estado).toBe('AUTORIZADO');
        expect(r.cabecera.importeTotal).toBe(77.63);
    });
    test('rechaza XXE, XML mal formado, otros comprobantes e incoherencias con la clave', () => {
        expect(() => leerFactura('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><factura>&a;</factura>')).toThrow(/DOCTYPE/);
        expect(() => leerFactura('<factura><infoTributaria>')).toThrow(/bien formado/);
        expect(() => leerFactura('<notaCredito id="comprobante"></notaCredito>')).toThrow(/no es una factura/);
        expect(() => leerFactura(factura().replace('<ruc>0990000001001</ruc>', '<ruc>0990000001999</ruc>'))).toThrow(/no coincide con su clave/);
        expect(() => leerFactura(factura().replace(/<cantidad>3\.00<\/cantidad>/, '<cantidad>abc</cantidad>'))).toThrow(/numérico/);
    });
});
