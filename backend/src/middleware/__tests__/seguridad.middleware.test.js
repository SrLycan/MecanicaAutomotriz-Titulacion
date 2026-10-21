/**
 * Un error en un controlador async (fuera de su try/catch) ya no debe cerrar
 * el proceso: antes, POST /api/auth/login con {"email": ["x"]} tumbaba el
 * servidor completo.
 */
const express = require('express');
const { protegerControladoresAsync, cabecerasSeguridad, limitarPorIp } = require('../seguridad.middleware');

protegerControladoresAsync();

function levantar(configurar) {
    const app = express();
    app.use(cabecerasSeguridad);
    configurar(app);
    app.use((err, _req, res, _next) => res.status(500).json({ error: 'interno' }));
    return new Promise(ok => { const s = app.listen(0, () => ok(s)); });
}

describe('seguridad.middleware', () => {
    let server;
    afterEach(() => new Promise(ok => (server ? server.close(ok) : ok())));

    test('un controlador async que lanza responde 500 y el servidor sigue vivo', async () => {
        server = await levantar(app => {
            app.get('/falla', async () => { 'x'.noExiste(); });
            app.get('/ok', (_req, res) => res.json({ ok: true }));
        });
        const base = `http://127.0.0.1:${server.address().port}`;
        expect((await fetch(`${base}/falla`)).status).toBe(500);
        const r = await fetch(`${base}/ok`);
        expect(r.status).toBe(200);
        expect(r.headers.get('x-content-type-options')).toBe('nosniff');
        expect(r.headers.get('x-frame-options')).toBe('DENY');
    });

    test('limitarPorIp corta al superar el maximo', async () => {
        server = await levantar(app => {
            app.post('/r', limitarPorIp({ ventanaMs: 60000, maximo: 2, mensaje: 'basta' }), (_req, res) => res.json({}));
        });
        const base = `http://127.0.0.1:${server.address().port}`;
        const estados = [];
        for (let i = 0; i < 3; i++) estados.push((await fetch(`${base}/r`, { method: 'POST' })).status);
        expect(estados).toEqual([200, 200, 429]);
    });
});
