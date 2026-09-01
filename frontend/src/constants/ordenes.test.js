/**
 * SS SWAP - Pruebas de las Constantes de Órdenes de Trabajo (constants/ordenes)
 * Verifica la integridad de los datos compartidos entre el panel
 * administrativo y el portal de clientes:
 *
 *   - cada estado/progreso tiene label y color (si falta uno, la UI pinta
 *     etiquetas vacias o badges sin color),
 *   - los Map derivados (ESTADO_ORDEN_MAP / ESTADO_PROGRESO_MAP) quedan
 *     sincronizados con sus arrays fuente,
 *   - estados y progreso no se mezclan (son campos independientes por diseño).
 */

import {
    ESTADOS_ORDEN,
    ESTADOS_PROGRESO,
    ESTADO_ORDEN_MAP,
    ESTADO_PROGRESO_MAP,
    FILTROS_ORDEN,
} from './ordenes';

// Colores en hex valido: los badges/estilos se rompen con valores vacios.
const esColorValido = (color) => /^#[0-9a-f]{6}$/i.test(color || '');

describe('constants/ordenes — estados y progreso', () => {
    test('cada estado de orden tiene val, label y color validos', () => {
        expect(ESTADOS_ORDEN.length).toBeGreaterThan(0);
        for (const e of ESTADOS_ORDEN) {
            // Jest 27 no soporta mensaje como 2do arg de expect.
            if (!e.val) throw new Error(`estado sin val: ${JSON.stringify(e)}`);
            if (!e.label) throw new Error(`estado ${e.val} sin label`);
            expect(e.val).toBeTruthy();
            expect(e.label).toBeTruthy();
            expect(esColorValido(e.color)).toBe(true);
        }
    });

    test('cada etapa de progreso tiene val, label y color validos', () => {
        expect(ESTADOS_PROGRESO.length).toBeGreaterThan(0);
        for (const p of ESTADOS_PROGRESO) {
            if (!p.val) throw new Error(`progreso sin val: ${JSON.stringify(p)}`);
            if (!p.label) throw new Error(`progreso ${p.val} sin label`);
            expect(p.val).toBeTruthy();
            expect(p.label).toBeTruthy();
            expect(esColorValido(p.color)).toBe(true);
        }
    });

    test('no hay valores duplicados dentro de ninguna lista', () => {
        // Un val repetido haria que dos filas distintas compartieran badge.
        const vals = (lista) => lista.map((x) => x.val);
        expect(new Set(vals(ESTADOS_ORDEN)).size).toBe(ESTADOS_ORDEN.length);
        expect(new Set(vals(ESTADOS_PROGRESO)).size).toBe(ESTADOS_PROGRESO.length);
    });

    test('estados y progreso son conjuntos disjuntos (campos independientes)', () => {
        // NOTA de negocio: que el progreso llegue a 'listo_entrega' NO cambia
        // el estado a 'completado'. Si alguien unificara estos vals, esa
        // independencia se romperia silenciosamente.
        const valsOrden = new Set(ESTADOS_ORDEN.map((e) => e.val));
        const solapados = ESTADOS_PROGRESO.filter((p) => valsOrden.has(p.val));
        expect(solapados).toEqual([]);
    });

    test('los Map derivados quedan sincronizados con sus arrays', () => {
        // Los componentes resuelven por clave (map[val]); si un array cambia
        // y el Map no lo refleja, la UI muestra entradas indefinidas.
        for (const e of ESTADOS_ORDEN) {
            expect(ESTADO_ORDEN_MAP[e.val]).toBe(e);
        }
        expect(Object.keys(ESTADO_ORDEN_MAP)).toHaveLength(ESTADOS_ORDEN.length);

        for (const p of ESTADOS_PROGRESO) {
            expect(ESTADO_PROGRESO_MAP[p.val]).toBe(p);
        }
        expect(Object.keys(ESTADO_PROGRESO_MAP)).toHaveLength(ESTADOS_PROGRESO.length);
    });

    test('los filtros incluyen siempre la opcion "Todas" (valor vacio)', () => {
        // '' significa sin filtro en OrdenesTrabajo.jsx; si desaparece,
        // no hay forma de volver a ver el listado completo.
        expect(FILTROS_ORDEN.some((f) => f.val === '')).toBe(true);

        const labels = FILTROS_ORDEN.map((f) => f.label);
        expect(new Set(labels).size).toBe(labels.length); // labels legibles y unicos
    });
});
