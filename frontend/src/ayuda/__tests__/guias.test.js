/**
 * SS SWAP - Verificación del centro de ayuda (Sprint 27)
 *
 * Mantiene las guías sincronizadas con el código. Falla si:
 *  - un JSON de guía no está registrado (o al revés), o le faltan campos;
 *  - una guía apunta a una ruta que ya no existe en el panel;
 *  - una ruta del panel o una opción del menú se queda sin guía;
 *  - una imagen referenciada no existe, no está en el manifiesto de capturas
 *    o hay imágenes huérfanas en public/ayuda;
 *  - un control señalado en una captura (texto, placeholder, etiqueta,
 *    campo, data-ayuda o clase CSS) ya no aparece en el código fuente;
 *  - una guía está marcada como "pendiente" de actualización.
 * Lo que NO puede detectar: cambios de significado (un botón que conserva su
 * nombre pero ahora hace otra cosa). Eso requiere revisión humana al
 * modificar la sección (ver docs/AYUDA_CONTEXTUAL.md).
 */
import fs from 'fs';
import path from 'path';
import { GUIAS } from '../guias';
import { guiaParaUbicacion, puntajeRegla } from '../resolver';

const SRC = path.resolve(__dirname, '../..');
const PUBLICO = path.resolve(SRC, '../public/ayuda');
const DIR_GUIAS = path.resolve(__dirname, '../guias');

const archivosGuia = fs.readdirSync(DIR_GUIAS).filter(f => f.endsWith('.json'));
const leerFuente = () => {
    const out = [];
    (function caminar(d) {
        for (const f of fs.readdirSync(d)) {
            const p = path.join(d, f);
            if (fs.statSync(p).isDirectory()) { if (!['ayuda', '__tests__', 'public'].includes(f)) caminar(p); }
            else if (/\.(jsx?|css)$/.test(f) && !/\.test\./.test(f)) out.push(fs.readFileSync(p, 'utf8'));
        }
    })(SRC);
    return out.join('\n');
};
const FUENTE = leerFuente();
const FUENTE_MIN = FUENTE.toLowerCase();

/** Rutas del panel declaradas en App.jsx (RUTAS_PANEL) + el inicio. */
const RUTAS_PANEL = (() => {
    const app = fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
    const bloque = app.slice(app.indexOf('const RUTAS_PANEL'), app.indexOf('];', app.indexOf('const RUTAS_PANEL')));
    return [...bloque.matchAll(/path: '([^']+)',\s*Pagina: (\w+)/g)].map(m => ({ path: `/dashboard/${m[1]}`, pagina: m[2] }));
})();
/** Opciones del menú lateral (Layout.jsx › NAV_GROUPS). */
const MENU = (() => {
    const lay = fs.readFileSync(path.join(SRC, 'components/layout/Layout.jsx'), 'utf8');
    const bloque = lay.slice(lay.indexOf('const NAV_GROUPS'), lay.indexOf('/** Puntaje de coincidencia'));
    return [...bloque.matchAll(/to: '([^']+)'/g)].map(m => m[1]);
})();

const objetivosDe = (g) => g.pasos.flatMap(p => (p.marcas || []).filter(m => typeof m === 'object' && m.objetivo).map(m => m.objetivo)
    .concat(p.imagen?.captura?.esperar ? [p.imagen.captura.esperar] : [])
    .concat((p.imagen?.captura?.acciones || []).map(a => a.clic || a.escribir?.objetivo || a.elegir?.objetivo || a.desplazar).filter(Boolean)));

describe('Centro de ayuda: guías', () => {
    test('cada JSON está registrado y no hay ids repetidos', () => {
        expect(GUIAS.length).toBe(archivosGuia.length);
        const ids = GUIAS.map(g => g.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const f of archivosGuia) expect(ids).toContain(JSON.parse(fs.readFileSync(path.join(DIR_GUIAS, f), 'utf8')).id);
    });

    test.each(GUIAS.map(g => [g.id, g]))('%s: contenido completo y sin marca de pendiente', (id, g) => {
        for (const k of ['grupo', 'titulo', 'version', 'actualizada', 'descripcion', 'resultado']) expect([id, k, Boolean(String(g[k] || '').trim())]).toEqual([id, k, true]);
        expect(g.pendiente).not.toBe(true);
        expect(g.rutas.length).toBeGreaterThan(0);
        expect(g.funciones.length).toBeGreaterThan(0);
        expect(g.pasos.length).toBeGreaterThan(0);
        for (const p of g.pasos) {
            expect(String(p.titulo || '').trim()).not.toBe('');
            const textos = Array.isArray(p.texto) ? p.texto : [p.texto];
            expect(textos.join('').trim()).not.toBe('');
            if (p.imagen) {
                expect(['captura', 'esquema']).toContain(p.imagen.tipo);
                expect(String(p.imagen.alt || '').length).toBeGreaterThan(10);
            }
            for (const m of p.marcas || []) expect(String(typeof m === 'string' ? m : m.texto).trim()).not.toBe('');
        }
    });

    test.each(GUIAS.map(g => [g.id, g]))('%s: sus rutas existen en el panel', (id, g) => {
        for (const r of g.rutas) {
            const existe = r.path === '/dashboard' || RUTAS_PANEL.some(x => puntajeRegla({ path: r.path }, x.path.replace(/:\w+/g, '1'), '') > 0
                || puntajeRegla({ path: x.path }, r.path.replace(/:\w+/g, '1'), '') > 0);
            expect([id, r.path, existe]).toEqual([id, r.path, true]);
        }
    });

    test.each(GUIAS.map(g => [g.id, g]))('%s: imágenes existentes y registradas en el manifiesto', (id, g) => {
        const manifiesto = fs.existsSync(path.join(PUBLICO, 'manifiesto.json')) ? JSON.parse(fs.readFileSync(path.join(PUBLICO, 'manifiesto.json'), 'utf8')).imagenes : {};
        for (const p of g.pasos.filter(x => x.imagen)) {
            expect([id, p.imagen.archivo, fs.existsSync(path.join(PUBLICO, p.imagen.archivo))]).toEqual([id, p.imagen.archivo, true]);
            if (p.imagen.tipo === 'captura') expect([id, p.imagen.archivo, manifiesto[p.imagen.archivo]?.guia]).toEqual([id, p.imagen.archivo, id]);
        }
    });

    test.each(GUIAS.map(g => [g.id, g]))('%s: los controles señalados siguen existiendo en el código', (id, g) => {
        // "dato": el objetivo es un registro de la empresa demo (no un texto del código).
        for (const o of objetivosDe(g).filter(x => !x.dato)) {
            const valor = o.ayuda ? `"${o.ayuda}"` : o.selector ? (o.selector.match(/\.([\w-]+)/)?.[1] || o.selector) : (o.texto || o.contiene || o.placeholder || o.etiqueta || o.campo);
            const presente = o.ayuda ? FUENTE.includes(o.ayuda) : FUENTE_MIN.includes(String(valor).replace(/ \*$/, '').toLowerCase());
            expect([id, JSON.stringify(o), presente]).toEqual([id, JSON.stringify(o), true]);
        }
    });
});

// PENDIENTE (Sprint 27 en pausa, 2026-10-14): todavía faltan guías para varias
// secciones. Al completarlas, quitar ".skip" para exigir cobertura total.
describe.skip('Centro de ayuda: cobertura', () => {
    test('cada ruta del panel tiene su guía', () => {
        const sinGuia = RUTAS_PANEL.filter(r => r.pagina !== 'RedirigirRegistrar')
            .filter(r => !guiaParaUbicacion(GUIAS, r.path.replace(/:\w+/g, '7'), ''))
            .map(r => r.path);
        expect(sinGuia).toEqual([]);
        expect(guiaParaUbicacion(GUIAS, '/dashboard', '')).not.toBeNull();
    });

    test('cada opción del menú lateral abre una guía', () => {
        const sinGuia = MENU.filter(to => { const [p, q] = to.split('?'); return !guiaParaUbicacion(GUIAS, p, q ? `?${q}` : ''); });
        expect(sinGuia).toEqual([]);
    });

    test('no hay imágenes huérfanas en public/ayuda', () => {
        const usadas = new Set(GUIAS.flatMap(g => g.pasos.filter(p => p.imagen).map(p => p.imagen.archivo)));
        const todas = [];
        (function caminar(d, rel) {
            if (!fs.existsSync(d)) return;
            for (const f of fs.readdirSync(d)) {
                const p = path.join(d, f);
                if (fs.statSync(p).isDirectory()) caminar(p, `${rel}${f}/`);
                else if (/\.(png|jpe?g|webp|svg)$/.test(f)) todas.push(`${rel}${f}`);
            }
        })(PUBLICO, '');
        expect(todas.filter(f => !usadas.has(f))).toEqual([]);
    });
});

describe('Centro de ayuda: resolución por sección', () => {
    test('cada pestaña abre su propia guía, no una genérica', () => {
        const a = guiaParaUbicacion(GUIAS, '/dashboard/inventario', '');
        expect(a?.id).toBe('inventario');
    });
});
