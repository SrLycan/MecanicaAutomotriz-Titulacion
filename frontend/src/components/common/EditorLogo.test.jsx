/**
 * SS SWAP - Validación del archivo de logo en el navegador (Sprint 24).
 * El servidor vuelve a validar la firma real del archivo.
 */
import { validarArchivoLogo } from './EditorLogo';

const archivo = (nombre, tipo, bytes = 1000) => ({ name: nombre, type: tipo, size: bytes });

test('acepta PNG y JPG de hasta 2 MB', () => {
    expect(validarArchivoLogo(archivo('logo.png', 'image/png'))).toBeNull();
    expect(validarArchivoLogo(archivo('logo.JPG', 'image/jpeg', 2 * 1024 * 1024))).toBeNull();
});

test('rechaza SVG, WEBP, otros archivos y los mayores a 2 MB', () => {
    expect(validarArchivoLogo(archivo('logo.svg', 'image/svg+xml'))).toMatch(/PNG o JPG/);
    expect(validarArchivoLogo(archivo('logo.webp', 'image/webp'))).toMatch(/PNG o JPG/);
    expect(validarArchivoLogo(archivo('virus.exe', 'application/octet-stream'))).toMatch(/PNG o JPG/);
    expect(validarArchivoLogo(archivo('logo.png.exe', 'image/png'))).toMatch(/PNG o JPG/);
    expect(validarArchivoLogo(archivo('grande.png', 'image/png', 2 * 1024 * 1024 + 1))).toMatch(/2 MB/);
    expect(validarArchivoLogo(null)).toMatch(/Selecciona/);
});
