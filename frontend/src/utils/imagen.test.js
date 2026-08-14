/**
 * Pruebas unitarias de resolveImagenSrc.
 *
 * Es una funcion pura (misma entrada -> misma salida, sin tocar la red ni
 * el DOM) — el caso mas simple y mas util de probar, porque no hace falta
 * mockear nada.
 */
import { resolveImagenSrc } from './imagen';

describe('resolveImagenSrc', () => {
    test('devuelve vacio si no hay valor', () => {
        expect(resolveImagenSrc('')).toBe('');
        expect(resolveImagenSrc(undefined)).toBe('');
        expect(resolveImagenSrc('   ')).toBe('');
    });

    test('deja igual las URLs que ya son absolutas', () => {
        expect(resolveImagenSrc('https://cdn.com/foto.png')).toBe('https://cdn.com/foto.png');
        expect(resolveImagenSrc('http://cdn.com/foto.png')).toBe('http://cdn.com/foto.png');
    });

    test('deja igual las imagenes en base64 (data URLs)', () => {
        const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSU';
        expect(resolveImagenSrc(dataUrl)).toBe(dataUrl);
    });

    test('deja igual las blob URLs (preview antes de subir)', () => {
        expect(resolveImagenSrc('blob:http://localhost/abc-123')).toBe('blob:http://localhost/abc-123');
    });

    test('arma la URL completa cuando la ruta empieza con /', () => {
        expect(resolveImagenSrc('/uploads/repuesto.png'))
            .toBe(`${window.location.origin}/uploads/repuesto.png`);
    });

    test('arma la URL completa cuando la ruta NO empieza con /', () => {
        expect(resolveImagenSrc('uploads/repuesto.png'))
            .toBe(`${window.location.origin}/uploads/repuesto.png`);
    });

    test('no le agrega una barra extra si la ruta ya la trae', () => {
        // src empieza con "/", asi que entra por la rama que solo concatena
        // el host + la ruta tal cual (sin barra extra en el medio).
        expect(resolveImagenSrc('/uploads/repuesto.png'))
            .not.toContain('//uploads');
    });
});
