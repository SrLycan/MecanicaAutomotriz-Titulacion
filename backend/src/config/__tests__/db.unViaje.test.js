/**
 * SS SWAP - Consultas aisladas en un solo viaje (config/db.js)
 *
 * Unitarias: los parametros $n se insertan como literales escapados solo
 * fuera de textos, identificadores y comentarios; ante algo dudoso se usa el
 * camino anterior (null). Con PG_INTEGRATION=1 tambien se comprueba contra
 * PostgreSQL que el resultado, el aislamiento (RLS) y los errores son iguales.
 *
 *   PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest db.unViaje
 */
const { _sqlConLiterales: sql } = require('../db');

describe('config/db — parametros como literales', () => {
    test('reemplaza $n por literales escapados', () => {
        expect(sql('SELECT * FROM t WHERE a = $1 AND b = $2', ['x', 5])).toBe("SELECT * FROM t WHERE a = 'x' AND b = '5'");
        expect(sql('SELECT $1::int IS NULL', [null])).toBe('SELECT NULL::int IS NULL');
        expect(sql('SELECT $1', [undefined])).toBe('SELECT NULL');
        expect(sql('SELECT $10, $1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe("SELECT '10', '1'");
    });

    test('escapa comillas y barras invertidas (sin inyeccion)', () => {
        expect(sql('SELECT $1', ["x' OR 1=1 --"])).toBe("SELECT 'x'' OR 1=1 --'");
        expect(sql('SELECT $1', ['a\\b'])).toBe("SELECT  E'a\\\\b'");
    });

    test('arreglos, fechas, booleanos y objetos como los envia el driver', () => {
        expect(sql('SELECT $1', [['a', 'b']])).toBe(`SELECT '{"a","b"}'`);
        expect(sql('SELECT $1', [true])).toBe("SELECT 'true'");
        expect(sql('SELECT $1', [{ a: 1 }])).toBe(`SELECT '{"a":1}'`);
        expect(sql('SELECT $1', [new Date('2026-01-02T03:04:05Z')])).toMatch(/^SELECT '2026-01-0\d/);
    });

    test('no toca $n dentro de textos, identificadores ni comentarios', () => {
        expect(sql("SELECT '$1', \"col$1\", a$1 FROM t WHERE x = $1 -- $1\n", ['v']))
            .toBe("SELECT '$1', \"col$1\", a$1 FROM t WHERE x = 'v' -- $1");
        expect(sql("SELECT 'it''s $1' WHERE x = $1", ['v'])).toBe("SELECT 'it''s $1' WHERE x = 'v'");
    });

    test('quita el punto y coma final', () => {
        expect(sql('SELECT 1;  ', [])).toBe('SELECT 1');
    });

    test('usa el camino anterior ante casos dudosos', () => {
        expect(sql("SELECT E'a\\'b' WHERE x = $1", ['v'])).toBeNull();
        expect(sql('SELECT $$a$$ WHERE x = $1', ['v'])).toBeNull();
        expect(sql('SELECT $tag$a$tag$', [])).toBeNull();
        expect(sql('SELECT 1 /* c */', [])).toBeNull();
        expect(sql("SELECT 'sin cerrar", [])).toBeNull();
        expect(sql('SELECT $2', ['solo uno'])).toBeNull();
        expect(sql('SELECT $1', [Buffer.from('x')])).toBeNull();
        expect(sql('SELECT $1', ['a\0b'])).toBeNull();
    });
});

const RUN = process.env.PG_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

d('config/db — un viaje contra PostgreSQL', () => {
    let db, conEmpresa, empresa;
    beforeAll(async () => {
        db = require('../db');
        ({ conEmpresa } = require('../contexto'));
        const { idEmpresa } = require('../../test-utils/empresaPrueba');
        empresa = await idEmpresa();
    });
    afterAll(() => db.end());

    const enEmpresa = (fn) => conEmpresa(empresa, fn, { usuarioId: 1 });

    test('fija rol y empresa y devuelve solo el resultado de la consulta', async () => {
        const r = await enEmpresa(() => db.query(
            "SELECT current_user AS rol, current_setting('app.empresa_id') AS emp, $1::text AS t, $2::int AS n, $3::text[] AS arr",
            ["o'brien \\ $1", 7, ['a', 'b']]));
        expect(r.rows).toEqual([{ rol: db.ROL_APP, emp: String(empresa), t: "o'brien \\ $1", n: 7, arr: ['a', 'b'] }]);
        expect(r.command).toBe('SELECT');
    });

    test('RLS sigue aislando: sin empresa no se ve nada', async () => {
        const ajena = await enEmpresa(() => db.query('SELECT COUNT(*)::int AS n FROM clientes WHERE empresa_id <> $1', [empresa]));
        const sinEmpresa = await conEmpresa(null, () => db.query('SELECT COUNT(*)::int AS n FROM clientes WHERE id > $1', [0]));
        expect(ajena.rows[0].n).toBe(0);
        expect(sinEmpresa.rows[0].n).toBe(0);
    });

    test('un error no deja la transaccion abierta en la conexion', async () => {
        await expect(enEmpresa(() => db.query('SELECT 1/$1::int', [0]))).rejects.toMatchObject({ code: '22012' });
        for (let i = 0; i < 12; i++) {
            const r = await db.query("SELECT now() = statement_timestamp() AS fuera_de_transaccion, current_setting('app.empresa_id', true) AS emp");
            expect(r.rows[0]).toEqual({ fuera_de_transaccion: true, emp: expect.not.stringMatching(/^\d+$/) });
        }
    });

    test('dentro de una transaccion del codigo no cambia nada', async () => {
        const cliente = await enEmpresa(() => db.connect());
        try {
            await cliente.query('BEGIN');
            const r = await cliente.query("SELECT current_setting('app.empresa_id') AS emp, $1::int AS n", [3]);
            expect(r.rows[0]).toEqual({ emp: String(empresa), n: 3 });
            await cliente.query('ROLLBACK');
            const suelta = await cliente.query("SELECT current_setting('app.empresa_id') AS emp WHERE $1", [true]);
            expect(suelta.rows[0].emp).toBe(String(empresa));
        } finally {
            cliente.release();
        }
    });
});
