/**
 * SS SWAP - Idempotencia de operaciones de creación
 *
 * El navegador manda en cada formulario una cabecera `Idempotency-Key`
 * (una clave nueva por cada intento del usuario). Si la misma petición llega
 * dos veces (doble clic, reintento de la red, pestaña recargada), la segunda:
 *   - mientras la primera sigue en curso  -> 409 (no se procesa)
 *   - cuando la primera ya terminó bien   -> se devuelve la MISMA respuesta
 *                                            sin volver a crear nada.
 * Si la primera falló (4xx/5xx), la clave se libera para poder reintentar.
 *
 * La clave se aísla por usuario, empresa, método y ruta: nadie puede leer la
 * respuesta de otra persona adivinando su clave. Se guarda en memoria del
 * proceso durante 15 minutos (suficiente para reintentos; un reinicio del
 * servidor la olvida, y entonces aplican las validaciones de la base, como
 * el RUC único por empresa). Sin cabecera la petición sigue igual que antes.
 */
const TTL_MS = 15 * 60 * 1000;
const MAX_CLAVES = 5000;
const CLAVE_RE = /^[A-Za-z0-9_-]{8,100}$/;

const registros = new Map(); // clave -> { estado: 'en_curso' | 'hecho', status, cuerpo, vence }

function limpiarVencidas(ahora = Date.now()) {
    for (const [k, r] of registros) if (r.vence <= ahora) registros.delete(k);
    // Tope de memoria: descarta las más antiguas.
    while (registros.size > MAX_CLAVES) registros.delete(registros.keys().next().value);
}

/** Middleware: usar DESPUÉS de verificarToken. */
function idempotencia(req, res, next) {
    if (req.method !== 'POST') return next();
    const valor = req.get('Idempotency-Key');
    if (valor === undefined || valor === '') return next();
    if (!CLAVE_RE.test(valor)) return res.status(400).json({ error: 'Cabecera Idempotency-Key invalida.' });

    const clave = [req.usuario?.id ?? 'anon', req.usuario?.empresa_id ?? '-', req.method, req.baseUrl + req.path, valor].join('|');
    const ahora = Date.now();
    limpiarVencidas(ahora);
    const previo = registros.get(clave);
    if (previo && previo.estado === 'en_curso') {
        return res.status(409).json({ error: 'Esta operacion ya se esta procesando. Espera un momento.', codigo: 'OPERACION_EN_CURSO' });
    }
    if (previo && previo.estado === 'hecho') {
        res.set('Idempotent-Replay', 'true');
        return res.status(previo.status).json(previo.cuerpo);
    }

    registros.set(clave, { estado: 'en_curso', vence: ahora + TTL_MS });
    const jsonOriginal = res.json.bind(res);
    res.json = (cuerpo) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            registros.set(clave, { estado: 'hecho', status: res.statusCode, cuerpo, vence: Date.now() + TTL_MS });
        } else {
            registros.delete(clave);
        }
        return jsonOriginal(cuerpo);
    };
    // Si la respuesta termina sin pasar por res.json (error inesperado), se libera.
    res.on('close', () => { if (registros.get(clave)?.estado === 'en_curso') registros.delete(clave); });
    return next();
}

/** Solo pruebas. */
idempotencia._reiniciar = () => registros.clear();

module.exports = { idempotencia };
