/**
 * La geometria del pictograma vive en DOS copias (backend para el PDF y
 * la validacion; frontend para el SVG interactivo, porque create-react-app
 * no importa fuera de src/). Esta prueba garantiza que sean identicas.
 */
const fs = require('fs');
const path = require('path');
const d = require('../vehiculoDiagramas');

const cuerpo = (txt) => txt.slice(0, txt.search(/^(module\.exports = |export )\{/m));

test('la copia del frontend es identica a la del backend', () => {
    const back = fs.readFileSync(path.join(__dirname, '..', 'vehiculoDiagramas.js'), 'utf8');
    const front = fs.readFileSync(path.join(__dirname, '../../../../frontend/src/components/proformas/vehiculo/vehiculoDiagramas.js'), 'utf8');
    expect(cuerpo(front)).toBe(cuerpo(back));
});

test.each(d.TIPOS_CARROCERIA.flatMap(t => d.CARROCERIAS[t].puertas.map(p => [t, p])))('%s %i puertas: zonas con etiqueta y paths validos', (tipo, puertas) => {
    const diag = d.construirDiagrama(tipo, puertas);
    expect(diag.codigos.length).toBeGreaterThan(15);
    for (const c of diag.codigos) expect(d.ETIQUETAS_ZONA[c]).toBeDefined();
    for (const z of diag.zonas) expect(z.d).toMatch(/^M[-\d. ]+( L[-\d. ]+)+ Z$/);
    // Zonas laterales simetricas izquierda/derecha
    const izq = diag.codigos.filter(c => c.endsWith('_izq')).map(c => c.replace('_izq', ''));
    const der = diag.codigos.filter(c => c.endsWith('_der')).map(c => c.replace('_der', ''));
    expect(izq.sort()).toEqual(der.sort());
});

test('reglas de carroceria: zonas propias de cada tipo', () => {
    expect(d.zonasValidas('pickup', 4)).toEqual(expect.arrayContaining(['balde', 'costado_balde_izq', 'compuerta']));
    expect(d.zonasValidas('sedan', 4)).toContain('maletero');
    expect(d.zonasValidas('sedan', 4)).not.toContain('balde');
    expect(d.zonasValidas('hatchback', 3)).not.toContain('puerta_tras_izq');
    expect(d.zonasValidas('hatchback', 5)).toContain('puerta_tras_izq');
    expect(d.normalizarPuertas('hatchback', 7)).toBe(5);
    expect(d.construirDiagrama('camion')).toBeNull();
});
