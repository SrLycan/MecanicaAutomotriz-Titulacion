/**
 * SS SWAP - Pruebas unitarias de las reglas de cobro (reglasPago.js).
 * Casos A-E del Sprint 20 a nivel de calculo puro (sin base de datos).
 */
const {
    calcularAnticipoRequerido, calcularEstadoPago, estadoPersistido, porcentajes, resumenDeuda, porcentajeAnticipo,
} = require('../reglasPago');

const HOY = new Date('2026-10-08T12:00:00Z');

describe('Anticipo requerido segun el tipo de trabajo', () => {
    test('mecanica general: no exige anticipo (0 por defecto)', () => {
        expect(porcentajeAnticipo('mecanica')).toBeNull();
        expect(calcularAnticipoRequerido('mecanica', 500)).toBe(0);
        expect(calcularAnticipoRequerido('mecanica', 500, 100)).toBe(100);   // opcional, si se indica
        expect(calcularAnticipoRequerido('mecanica', 500, 900)).toBe(500);   // nunca mayor al total
        expect(calcularAnticipoRequerido('mecanica', 500, -20)).toBe(0);
    });
    test('colisiones: 70% fijo del total (no se puede cambiar a mano)', () => {
        expect(porcentajeAnticipo('pintura')).toBe(70);
        expect(calcularAnticipoRequerido('pintura', 3000)).toBe(2100);
        expect(calcularAnticipoRequerido('pintura', 3000, 50)).toBe(2100);
        expect(calcularAnticipoRequerido('pintura', 2000)).toBe(1400);
        expect(calcularAnticipoRequerido('pintura', 309.77)).toBe(216.84);
    });
});

describe('Caso A: mecanica sin anticipo ($500, pagado $0)', () => {
    test('pendiente, 0%, saldo completo', () => {
        const r = resumenDeuda({ montoTotal: 500, montoPagado: 0, anticipoRequerido: 0 });
        expect(r).toMatchObject({ total: 500, pagado: 0, saldo: 500, porcentaje_pagado: 0, porcentaje_pendiente: 100, anticipo_requerido: 0 });
        expect(calcularEstadoPago({ montoTotal: 500, montoPagado: 0, hoy: HOY })).toBe('pendiente');
    });
});

describe('Caso B: mecanica con pago parcial ($200 de $500)', () => {
    test('parcial, 40%, saldo $300', () => {
        const r = resumenDeuda({ montoTotal: 500, montoPagado: 200 });
        expect(r).toMatchObject({ pagado: 200, saldo: 300, porcentaje_pagado: 40, porcentaje_pendiente: 60 });
        expect(calcularEstadoPago({ montoTotal: 500, montoPagado: 200, hoy: HOY })).toBe('parcial');
    });
});

describe('Caso C: mecanica pagada por completo', () => {
    test('pagado, 100%, saldo $0', () => {
        const r = resumenDeuda({ montoTotal: 500, montoPagado: 500 });
        expect(r).toMatchObject({ pagado: 500, saldo: 0, porcentaje_pagado: 100, porcentaje_pendiente: 0 });
        expect(calcularEstadoPago({ montoTotal: 500, montoPagado: 500, hoy: HOY })).toBe('pagado');
    });
});

describe('Caso D: colisiones $3.000 con anticipo del 70%', () => {
    const anticipo = calcularAnticipoRequerido('pintura', 3000);
    test('antes del anticipo: pagado $0, pendiente $3.000, anticipo requerido $2.100, pendiente', () => {
        const r = resumenDeuda({ montoTotal: 3000, montoPagado: 0, anticipoRequerido: anticipo });
        expect(r).toMatchObject({ total: 3000, pagado: 0, saldo: 3000, anticipo_requerido: 2100, saldo_despues_anticipo: 900, anticipo_cubierto: false, anticipo_pendiente: 2100 });
        expect(estadoPersistido({ montoTotal: 3000, montoPagado: 0 })).toBe('pendiente');
    });
    test('despues del anticipo: pagado $2.100, pendiente $900, 70%, parcial (NO pagado)', () => {
        const r = resumenDeuda({ montoTotal: 3000, montoPagado: 2100, anticipoRequerido: anticipo });
        expect(r).toMatchObject({ pagado: 2100, saldo: 900, porcentaje_pagado: 70, porcentaje_pendiente: 30, anticipo_cubierto: true });
        expect(estadoPersistido({ montoTotal: 3000, montoPagado: 2100 })).toBe('parcial');
    });
    test('despues del pago final: $3.000, saldo $0, 100%, pagado', () => {
        const r = resumenDeuda({ montoTotal: 3000, montoPagado: 3000, anticipoRequerido: anticipo });
        expect(r).toMatchObject({ pagado: 3000, saldo: 0, porcentaje_pagado: 100 });
        expect(estadoPersistido({ montoTotal: 3000, montoPagado: 3000 })).toBe('pagado');
    });
});

describe('Caso E: vencimiento', () => {
    test('fecha limite pasada con saldo -> vencido', () => {
        expect(calcularEstadoPago({ montoTotal: 500, montoPagado: 0, fechaVencimiento: '2026-10-01', hoy: HOY })).toBe('vencido');
        expect(calcularEstadoPago({ montoTotal: 500, montoPagado: 100, fechaVencimiento: '2026-10-07', hoy: HOY })).toBe('vencido');
    });
    test('vence hoy o en el futuro -> todavia no esta vencido', () => {
        expect(calcularEstadoPago({ montoTotal: 500, montoPagado: 0, fechaVencimiento: '2026-10-08', hoy: HOY })).toBe('pendiente');
        expect(calcularEstadoPago({ montoTotal: 500, montoPagado: 100, fechaVencimiento: '2026-12-01', hoy: HOY })).toBe('parcial');
    });
    test('una deuda pagada por completo nunca aparece como vencida', () => {
        expect(calcularEstadoPago({ montoTotal: 500, montoPagado: 500, fechaVencimiento: '2026-01-01', hoy: HOY })).toBe('pagado');
    });
    test('anulado se respeta', () => {
        expect(calcularEstadoPago({ montoTotal: 500, montoPagado: 0, fechaVencimiento: '2026-01-01', anulado: true, hoy: HOY })).toBe('anulado');
    });
});

describe('Barra de progreso', () => {
    test('nunca llega al 100% mientras exista saldo', () => {
        // $999,99 de $1.000 redondearia a 100%: con $0,01 de saldo debe quedar en 99,99%
        expect(porcentajes(1000, 999.99)).toEqual({ pagado: 99.99, pendiente: 0.01 });
        expect(porcentajes(3, 2.99).pagado).toBeLessThan(100);
        expect(porcentajes(1000, 700)).toEqual({ pagado: 70, pendiente: 30 });
        expect(porcentajes(0, 0)).toEqual({ pagado: 0, pendiente: 0 });
    });
});
