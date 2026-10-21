/**
 * SS SWAP - Idempotencia de creaciones (Sprint 24)
 */
const { idempotencia } = require('../idempotencia.middleware');

function peticion({ clave, usuario = 1, empresa = 1, metodo = 'POST', ruta = '/proveedores' } = {}) {
    return { method: metodo, baseUrl: '/api/proveedores', path: ruta, usuario: { id: usuario, empresa_id: empresa },
        get: (h) => (h === 'Idempotency-Key' ? clave : undefined) };
}
function respuesta() {
    const r = { statusCode: 200, cabeceras: {}, cuerpo: undefined, cierre: null };
    r.status = (s) => { r.statusCode = s; return r; };
    r.json = (c) => { r.cuerpo = c; return r; };
    r.set = (k, v) => { r.cabeceras[k] = v; return r; };
    r.on = (ev, fn) => { if (ev === 'close') r.cierre = fn; };
    return r;
}

beforeEach(() => idempotencia._reiniciar());

test('sin cabecera la peticion sigue igual', () => {
    const next = jest.fn();
    idempotencia(peticion({ clave: undefined }), respuesta(), next);
    expect(next).toHaveBeenCalled();
});

test('mientras la primera esta en curso, la segunda recibe 409; al terminar se repite la misma respuesta', () => {
    const next = jest.fn();
    const r1 = respuesta();
    idempotencia(peticion({ clave: 'clave-prueba-0001' }), r1, next);
    expect(next).toHaveBeenCalledTimes(1);

    const r2 = respuesta();
    idempotencia(peticion({ clave: 'clave-prueba-0001' }), r2, next);
    expect(r2.statusCode).toBe(409);
    expect(next).toHaveBeenCalledTimes(1);

    r1.status(201).json({ proveedor: { id: 7 } });   // termina la primera
    const r3 = respuesta();
    idempotencia(peticion({ clave: 'clave-prueba-0001' }), r3, next);
    expect(next).toHaveBeenCalledTimes(1);           // no se vuelve a procesar
    expect(r3.statusCode).toBe(201);
    expect(r3.cuerpo).toEqual({ proveedor: { id: 7 } });
    expect(r3.cabeceras['Idempotent-Replay']).toBe('true');
});

test('si la primera falla, la clave se libera para reintentar', () => {
    const next = jest.fn();
    const r1 = respuesta();
    idempotencia(peticion({ clave: 'clave-prueba-0002' }), r1, next);
    r1.status(400).json({ error: 'x' });
    idempotencia(peticion({ clave: 'clave-prueba-0002' }), respuesta(), next);
    expect(next).toHaveBeenCalledTimes(2);
});

test('la clave se aisla por usuario y empresa; claves invalidas se rechazan', () => {
    const next = jest.fn();
    const r1 = respuesta();
    idempotencia(peticion({ clave: 'clave-prueba-0003' }), r1, next);
    r1.status(201).json({ secreto: 'de A' });
    const otro = respuesta();
    idempotencia(peticion({ clave: 'clave-prueba-0003', usuario: 2, empresa: 2 }), otro, next);
    expect(next).toHaveBeenCalledTimes(2);           // se procesa aparte: no ve la respuesta de A
    expect(otro.cuerpo).toBeUndefined();

    const mala = respuesta();
    idempotencia(peticion({ clave: 'a b' }), mala, next);
    expect(mala.statusCode).toBe(400);
});
