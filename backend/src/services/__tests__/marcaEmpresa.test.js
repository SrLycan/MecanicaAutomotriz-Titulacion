/**
 * SS SWAP - Identidad de la empresa en documentos (Sprint 24)
 */
const { marcaDe, urlLogo, rutaLogo, partesLogo } = require('../marcaEmpresa');

describe('marcaDe', () => {
    const actuales = { empresa_nombre: 'Taller Actual', empresa_nombre_comercial: 'Actual Motors', empresa_ruc: '1790000000001',
        empresa_direccion: 'Calle Nueva', empresa_telefono: '099', empresa_email: 'a@x.test', empresa_logo: 'asset:logo.png' };

    test('documento sin copia (anterior al Sprint 24): usa los datos actuales de su empresa', () => {
        const m = marcaDe(actuales);
        expect(m).toMatchObject({ nombre: 'Actual Motors', ruc: '1790000000001', direccion: 'Calle Nueva', telefono: '099', email: 'a@x.test' });
        expect(m.logo).toMatch(/logo\.png$/);
    });

    test('documento con copia: conserva la identidad con la que se emitio', () => {
        const m = marcaDe({ ...actuales, empresa_datos: { nombre: 'Taller Viejo', nombre_comercial: null, ruc: '1790000000009', direccion: 'Calle Vieja', logo_archivo: null } });
        expect(m).toMatchObject({ nombre: 'Taller Viejo', ruc: '1790000000009', direccion: 'Calle Vieja', telefono: null });
        expect(m.logo).toBeNull(); // se emitio sin logo: no toma el logo actual
    });

    test('si el archivo de la copia ya no existe usa el logo actual de la misma empresa', () => {
        const m = marcaDe({ ...actuales, empresa_datos: { nombre: 'X', logo_archivo: 'upload:no-existe.png' } });
        expect(m.logo).toMatch(/logo\.png$/);
    });
});

describe('logos', () => {
    test('solo PNG/JPG dentro de las carpetas permitidas', () => {
        expect(urlLogo('upload:abc.png')).toBe('/uploads/logos/abc.png');
        expect(urlLogo('asset:logo.png')).toBe('/recursos-marca/logo.png');
        expect(urlLogo('upload:../../.env')).toBeNull();
        expect(partesLogo('upload:../../secreto.png')).toEqual({ origen: 'upload', archivo: 'secreto.png' });
        expect(urlLogo('upload:x.svg')).toBeNull();
        expect(urlLogo('http://evil/x.png')).toBeNull();
        expect(urlLogo(null)).toBeNull();
        expect(rutaLogo('asset:fonts/DejaVuSans.ttf')).toBeNull();
    });
});
