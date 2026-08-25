/**
 * SS SWAP - Pruebas Unitarias del Servicio de Cuota Diaria de Gemini (geminiQuota.service)
 * Verifica el control de gasto contra la API gratuita de Gemini:
 *
 *   - lectura del contador del dia desde MongoDB (coleccion chatbot_cuota_diaria),
 *   - bloqueo al alcanzar LIMITE_DIARIO,
 *   - registro de consumo ($inc) e invalidacion del cache,
 *   - fallback en memoria cuando Mongo no esta disponible (el chat NUNCA
 *     debe romperse por un problema del contador).
 *
 * Es unitario: la unica dependencia externa es Mongo, y aqui se reemplaza
 * con jest.mock() — no se conecta a ninguna base real.
 */

// Mock del modulo de conexion: expone __coleccion para que cada prueba
// configure que devuelve findOne y afirme sobre updateOne. getMongoDb se
// hace jest.fn() para poder simular tambien que Mongo esta caido.
jest.mock('../../config/mongo', () => {
    const __coleccion = {
        findOne: jest.fn(),
        updateOne: jest.fn(),
    };
    return {
        getMongoDb: jest.fn(() => ({ collection: () => __coleccion })),
        __coleccion,
    };
});

const fechaHoy = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD', igual que el servicio

describe('geminiQuota — cuota diaria de la API de Gemini', () => {
    let quota, mongoMock;

    beforeEach(() => {
        // Estado fresco del modulo en cada prueba: el cache y el contador
        // en memoria viven a nivel de modulo, igual que los Map del throttle.
        jest.resetModules();
        quota = require('../geminiQuota.service');

        // Se requiere DESPUES del reset para obtener LA MISMA instancia
        // del mock que usa el servicio recien cargado.
        mongoMock = require('../../config/mongo');
        mongoMock.getMongoDb.mockClear();
        mongoMock.__coleccion.findOne.mockReset();
        mongoMock.__coleccion.updateOne.mockReset();

        // Por defecto Mongo disponible; cada prueba lo cambia si quiere.
        mongoMock.getMongoDb.mockImplementation(() => ({ collection: () => mongoMock.__coleccion }));
    });

    test('con la coleccion vacia hay cuota disponible (contador en 0)', async () => {
        // Ningun mensaje consumido hoy: findOne no encuentra documento.
        mongoMock.__coleccion.findOne.mockResolvedValue(null);

        await expect(quota.hayCuotaDisponible()).resolves.toBe(true);

        const estado = await quota.estadoCuota();
        expect(estado).toEqual({ usados: 0, limite: 1000, disponibles: 1000 });
    });

    test('lee los usados del documento de hoy y descuenta del limite', async () => {
        mongoMock.__coleccion.findOne.mockResolvedValue({ _id: fechaHoy(), usados: 250 });

        const estado = await quota.estadoCuota();

        // El documento se busca por el id del DIA actual (clave diaria).
        expect(mongoMock.__coleccion.findOne).toHaveBeenCalledWith({ _id: fechaHoy() });
        expect(estado.usados).toBe(250);
        expect(estado.disponibles).toBe(750);
    });

    test('al alcanzar el limite diario ya no queda cuota disponible', async () => {
        mongoMock.__coleccion.findOne.mockResolvedValue({ _id: fechaHoy(), usados: 1000 });

        await expect(quota.hayCuotaDisponible()).resolves.toBe(false);
    });

    test('registrarConsumo incrementa $inc en Mongo e invalida el cache', async () => {
        mongoMock.__coleccion.findOne.mockResolvedValue({ _id: fechaHoy(), usados: 10 });

        // Primera lectura (queda cacheada 5 segundos)...
        await quota.estadoCuota();
        const lecturasAntes = mongoMock.__coleccion.findOne.mock.calls.length;

        // ...registrar consumo ESCRIBE el incremento con upsert (crea el
        // documento del dia si no existe) y guarda metadatos del limite.
        await quota.registrarConsumo();

        expect(mongoMock.__coleccion.updateOne).toHaveBeenCalledWith(
            { _id: fechaHoy() },
            expect.objectContaining({
                $inc: { usados: 1 },
            }),
            expect.objectContaining({ upsert: true })
        );

        // Tras escribir, el cache se invalida: la siguiente lectura vuelve
        // a preguntar a Mongo en vez de confiar en el valor viejo.
        await quota.estadoCuota();
        expect(mongoMock.__coleccion.findOne.mock.calls.length).toBeGreaterThan(lecturasAntes);
    });

    test('si Mongo esta caido usa el contador en memoria y nunca rompe el chat', async () => {
        // Simula Mongo indisponible en este momento.
        mongoMock.getMongoDb.mockReturnValue(null);

        // Registrar consumo no lanza error aunque no haya BD...
        await expect(quota.registrarConsumo()).resolves.toBeUndefined();
        await expect(quota.registrarConsumo()).resolves.toBeUndefined();

        // ...y el contador en memoria refleja los consumos registrados,
        // de modo que el limite sigue protegiendo la cuota mientras dure
        // la caida de Mongo.
        const estado = await quota.estadoCuota();
        expect(estado.usados).toBe(2);
        expect(estado.disponibles).toBe(998);
    });
});
