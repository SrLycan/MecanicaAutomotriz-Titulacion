/**
 * SS SWAP - Controlador de Gestión y Agendamiento de Citas
 *
 * Gestiona el calendario de atención por sucursal:
 * - Cálculo dinámico de turnos disponibles según duración del servicio y horario operativo.
 * - Control de concurrencia mediante cerrojos a nivel de transacción en PostgreSQL
 *   (`pg_advisory_xact_lock`) para evitar sobreventa de turnos (doble reserva simultánea).
 * - Restricciones de negocio: días hábiles, validación de franjas horarias y capacidad por turno.
 */
const pool = require('../config/db');

// Vehiculos que el taller puede atender en simultaneo por sucursal (simula bahias/elevadores)
// Una cita por bahia: no se permiten servicios que se crucen.
const CAPACIDAD_POR_TURNO  = 1;
const DURACION_DEFECTO_MIN = 60;
const INTERVALO_SLOT_MIN   = 30;

/**
 * Retorna el horario operativo según el día de la semana
 * (0=Domingo cerrado, 6=Sábado media jornada).
 */
function horarioDelDia(diaSemana) {
    if (diaSemana === 0) return null; // domingo: cerrado
    if (diaSemana === 6) return { apertura: '08:00', cierre: '14:00' };
    return { apertura: '08:00', cierre: '18:00' };
}

function aMinutos(hhmm) {
    const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
    return h * 60 + m;
}
function aHHMM(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}
function parseFechaLocal(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return null;
    const d = new Date(fecha + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/citas/disponibilidad?sucursal_id=&servicio_id=&fecha=YYYY-MM-DD
 * Calcula los turnos y cupos disponibles para una sucursal, servicio y fecha
 * determinados. Filtra citas preexistentes no canceladas y descarta las
 * franjas que ya pasaron.
 */
const disponibilidad = async (req, res) => {
    const { sucursal_id, servicio_id, fecha } = req.query;
    if (!sucursal_id || !servicio_id || !fecha)
        return res.status(400).json({ error: 'sucursal_id, servicio_id y fecha son requeridos.' });

    const fechaObj = parseFechaLocal(fecha);
    if (!fechaObj) return res.status(400).json({ error: 'Fecha invalida. Usa el formato YYYY-MM-DD.' });

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (fechaObj < hoy) return res.status(400).json({ error: 'No se pueden agendar citas en fechas pasadas.' });

    const horario = horarioDelDia(fechaObj.getDay());
    if (!horario) return res.json({ abierto: false, slots: [], mensaje: 'El taller no atiende los domingos.' });

    try {
        const { rows: servRows } = await pool.query(
            'SELECT duracion_estimada_min FROM tipos_servicio WHERE id = $1 AND activo = TRUE',
            [servicio_id]
        );
        if (!servRows[0]) return res.status(404).json({ error: 'Servicio no encontrado.' });
        const duracion = servRows[0].duracion_estimada_min || DURACION_DEFECTO_MIN;

        const { rows: sucRows } = await pool.query(
            'SELECT id FROM sucursales WHERE id = $1 AND activa = TRUE', [sucursal_id]
        );
        if (!sucRows[0]) return res.status(404).json({ error: 'Sucursal no encontrada.' });

        const { rows: citasDia } = await pool.query(
            `SELECT hora_inicio, hora_fin FROM citas
             WHERE sucursal_id = $1 AND fecha = $2 AND estado <> 'cancelada'`,
            [sucursal_id, fecha]
        );
        const ocupadas = citasDia.map(c => ({ inicio: aMinutos(c.hora_inicio), fin: aMinutos(c.hora_fin) }));

        const apertura = aMinutos(horario.apertura);
        const cierre   = aMinutos(horario.cierre);
        const esHoy    = fechaObj.getTime() === hoy.getTime();
        const ahora    = new Date();
        const ahoraMin = esHoy ? (ahora.getHours() * 60 + ahora.getMinutes()) : -1;

        const slots = [];
        for (let inicio = apertura; inicio + duracion <= cierre; inicio += INTERVALO_SLOT_MIN) {
            const fin        = inicio + duracion;
            const enElPasado = esHoy && inicio <= ahoraMin;
            const ocupacion  = ocupadas.filter(o => o.inicio < fin && o.fin > inicio).length;
            slots.push({
                hora_inicio:      aHHMM(inicio),
                hora_fin:         aHHMM(fin),
                disponible:       !enElPasado && ocupacion < CAPACIDAD_POR_TURNO,
                cupos_restantes:  Math.max(0, CAPACIDAD_POR_TURNO - ocupacion),
            });
        }

        return res.json({ abierto: true, duracion_min: duracion, capacidad_por_turno: CAPACIDAD_POR_TURNO, slots });
    } catch (err) {
        console.error('Error disponibilidad:', err);
        return res.status(500).json({ error: 'Error al calcular la disponibilidad.' });
    }
};

/**
 * POST /api/citas   (cliente)
 * body: { servicio_id, sucursal_id, vehiculo_id?, fecha, hora_inicio, notas? }
 *
 * Agenda una nueva cita para el cliente autenticado. Aplica cerrojos advisory
 * a nivel de transacción para asegurar exclusión mutua ante peticiones
 * concurrentes sobre la misma sucursal y fecha.
 */
const crearCita = async (req, res) => {
    const { email, id: usuario_id } = req.usuario;
    const { servicio_id, sucursal_id, vehiculo_id, fecha, hora_inicio, notas } = req.body;

    if (!servicio_id || !sucursal_id || !fecha || !hora_inicio)
        return res.status(400).json({ error: 'servicio_id, sucursal_id, fecha y hora_inicio son requeridos.' });

    const fechaObj = parseFechaLocal(fecha);
    if (!fechaObj) return res.status(400).json({ error: 'Fecha invalida.' });
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (fechaObj < hoy) return res.status(400).json({ error: 'No se pueden agendar citas en fechas pasadas.' });

    const horario = horarioDelDia(fechaObj.getDay());
    if (!horario) return res.status(400).json({ error: 'El taller no atiende los domingos.' });

    try {
        const { rows: cliRows } = await pool.query('SELECT id FROM clientes WHERE email = $1', [email]);
        const cliente = cliRows[0];
        if (!cliente)
            return res.status(409).json({ error: 'Tu cuenta aun no esta vinculada a un cliente del taller. Visita una sucursal o contacta a recepcion para completar tu registro.' });

        if (vehiculo_id) {
            const { rows: vehRows } = await pool.query(
                'SELECT id FROM vehiculos WHERE id = $1 AND cliente_id = $2', [vehiculo_id, cliente.id]
            );
            if (!vehRows[0]) return res.status(403).json({ error: 'Ese vehiculo no pertenece a tu cuenta.' });
        }

        const { rows: servRows } = await pool.query(
            'SELECT duracion_estimada_min FROM tipos_servicio WHERE id = $1 AND activo = TRUE', [servicio_id]
        );
        if (!servRows[0]) return res.status(404).json({ error: 'Servicio no encontrado.' });
        const duracion = servRows[0].duracion_estimada_min || DURACION_DEFECTO_MIN;

        const { rows: sucRows } = await pool.query('SELECT id FROM sucursales WHERE id = $1 AND activa = TRUE', [sucursal_id]);
        if (!sucRows[0]) return res.status(404).json({ error: 'Sucursal no encontrada.' });

        const inicioMin = aMinutos(hora_inicio);
        const finMin    = inicioMin + duracion;
        if (Number.isNaN(inicioMin) || inicioMin < aMinutos(horario.apertura) || finMin > aMinutos(horario.cierre))
            return res.status(400).json({ error: 'La hora seleccionada esta fuera del horario de atencion.' });

        const esHoy = fechaObj.getTime() === hoy.getTime();
        if (esHoy) {
            const ahora = new Date();
            if (inicioMin <= ahora.getHours() * 60 + ahora.getMinutes())
                return res.status(400).json({ error: 'Ese horario ya paso. Elige un turno mas adelante.' });
        }

        const horaFin = aHHMM(finMin);
        const client  = await pool.connect();
        try {
            await client.query('BEGIN');

            // Evita que dos solicitudes simultaneas reserven el mismo turno.
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [String(sucursal_id), fecha]);

            const { rows: solapadas } = await client.query(
                `SELECT COUNT(*)::int AS n FROM citas
                 WHERE sucursal_id = $1 AND fecha = $2 AND estado <> 'cancelada'
                   AND hora_inicio < $3 AND hora_fin > $4`,
                [sucursal_id, fecha, horaFin, hora_inicio]
            );
            if (solapadas[0].n >= CAPACIDAD_POR_TURNO) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Ese horario ya no tiene cupo disponible. Elige otro turno.' });
            }

            const { rows } = await client.query(
                `INSERT INTO citas (cliente_id, usuario_id, vehiculo_id, servicio_id, sucursal_id, fecha, hora_inicio, hora_fin, notas)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 RETURNING *`,
                [cliente.id, usuario_id, vehiculo_id || null, servicio_id, sucursal_id, fecha, hora_inicio, horaFin, notas || null]
            );
            await client.query('COMMIT');
            return res.status(201).json({ cita: rows[0] });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error crearCita:', err);
        return res.status(500).json({ error: 'Error al agendar la cita.' });
    }
};

/**
 * GET /api/citas/mias   (cliente)
 * Consulta las citas registradas por el cliente autenticado,
 * con ordenamiento configurable por fecha o registro.
 */
const misCitas = async (req, res) => {
    const { email } = req.usuario;
    const orden = req.query.orden === 'registro_asc' ? 'c.created_at ASC' :
        req.query.orden === 'registro_desc' ? 'c.created_at DESC' :
        req.query.orden === 'fecha_asc' ? 'c.fecha ASC, c.hora_inicio ASC' :
        'c.fecha DESC, c.hora_inicio DESC';
    try {
        const { rows: cliRows } = await pool.query('SELECT id FROM clientes WHERE email = $1', [email]);
        const cliente = cliRows[0];
        if (!cliente) return res.json({ citas: [] });

        const { rows } = await pool.query(
            `SELECT c.id, c.fecha, c.hora_inicio, c.hora_fin, c.estado, c.notas, c.created_at,
                    s.nombre AS servicio_nombre, s.precio_base,
                    su.nombre AS sucursal_nombre, su.direccion AS sucursal_direccion,
                    v.placa, v.marca, v.modelo
             FROM citas c
             JOIN tipos_servicio s  ON s.id = c.servicio_id
             JOIN sucursales su     ON su.id = c.sucursal_id
             LEFT JOIN vehiculos v  ON v.id = c.vehiculo_id
             WHERE c.cliente_id = $1
             ORDER BY ${orden}`,
            [cliente.id]
        );
        return res.json({ citas: rows });
    } catch (err) {
        console.error('Error misCitas:', err);
        return res.status(500).json({ error: 'Error al obtener tus citas.' });
    }
};

/**
 * Lista general de citas para el personal administrativo y de recepción del taller.
 */
const listarCitas = async (req, res) => {
    const { estado, orden = 'fecha_asc', page, limit } = req.query;
    const ordenes = {
        fecha_asc: 'c.fecha ASC, c.hora_inicio ASC',
        fecha_desc: 'c.fecha DESC, c.hora_inicio DESC',
        registro_asc: 'c.created_at ASC',
        registro_desc: 'c.created_at DESC',
    };
    const params = [];
    let where = '';
    if (estado && estado !== 'todas') {
        params.push(estado);
        where = 'WHERE c.estado = $1';
    }

    const countQuery = `SELECT COUNT(*) AS total FROM citas c ${where}`;
    let dataQuery = `
        SELECT c.*,
               cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono,
               ts.nombre AS servicio_nombre, su.nombre AS sucursal_nombre,
               v.placa, v.marca, v.modelo
        FROM citas c
        JOIN clientes cl ON cl.id = c.cliente_id
        JOIN tipos_servicio ts ON ts.id = c.servicio_id
        JOIN sucursales su ON su.id = c.sucursal_id
        LEFT JOIN vehiculos v ON v.id = c.vehiculo_id
        ${where}
        ORDER BY ${ordenes[orden] || ordenes.fecha_asc}
    `;

    const statsQuery = `
        SELECT
            COUNT(*)                                      AS total,
            COUNT(*) FILTER (WHERE estado = 'pendiente')  AS pendiente,
            COUNT(*) FILTER (WHERE estado = 'confirmada') AS confirmada,
            COUNT(*) FILTER (WHERE estado = 'completada') AS completada,
            COUNT(*) FILTER (WHERE estado = 'cancelada')  AS cancelada
        FROM citas
    `;

    try {
        if (page !== undefined || limit !== undefined) {
            const pageNum  = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
            const offset   = (pageNum - 1) * limitNum;

            dataQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

            const [{ rows: countRows }, { rows }, { rows: statsRows }] = await Promise.all([
                pool.query(countQuery, params),
                pool.query(dataQuery, [...params, limitNum, offset]),
                pool.query(statsQuery),
            ]);

            const total = parseInt(countRows[0].total, 10);
            const st = statsRows[0] || {};
            const pend = parseInt(st.pendiente, 10) || 0;
            return res.json({
                citas: rows,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1,
                pendientes: pend,
                stats: {
                    total:      parseInt(st.total, 10) || 0,
                    pendiente:  pend,
                    confirmada: parseInt(st.confirmada, 10) || 0,
                    completada: parseInt(st.completada, 10) || 0,
                    cancelada:  parseInt(st.cancelada, 10) || 0,
                },
            });
        }

        const [{ rows: countRows }, { rows }, { rows: statsRows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, params),
            pool.query(statsQuery),
        ]);

        const total = parseInt(countRows[0]?.total, 10) || rows.length;
        const st = statsRows[0] || {};
        const pend = parseInt(st.pendiente, 10) || 0;
        return res.json({
            citas: rows,
            total,
            page: 1,
            limit: total,
            totalPages: 1,
            pendientes: pend,
            stats: {
                total:      parseInt(st.total, 10) || 0,
                pendiente:  pend,
                confirmada: parseInt(st.confirmada, 10) || 0,
                completada: parseInt(st.completada, 10) || 0,
                cancelada:  parseInt(st.cancelada, 10) || 0,
            },
        });
    } catch (err) {
        console.error('Error listarCitas:', err);
        return res.status(500).json({ error: 'Error al obtener las citas.' });
    }
};

/**
 * Actualiza el estado administrativo de una cita (confirmada, completada, cancelada).
 */
const actualizarEstado = async (req, res) => {
    const { estado } = req.body;
    if (!['confirmada', 'cancelada', 'completada'].includes(estado)) return res.status(400).json({ error: 'Estado de cita invalido.' });
    try {
        const { rows } = await pool.query('UPDATE citas SET estado = $1 WHERE id = $2 AND estado <> \'cancelada\' RETURNING *', [estado, req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada o ya fue cancelada.' });
        return res.json({ cita: rows[0] });
    } catch (err) { console.error('Error actualizar estado de cita:', err); return res.status(500).json({ error: 'Error al actualizar la cita.' }); }
};

/**
 * PATCH /api/citas/:id/cancelar   (cliente, solo propias)
 * Permite a un cliente cancelar una de sus citas pendientes o confirmadas.
 */
const cancelarCita = async (req, res) => {
    const { id } = req.params;
    const { email } = req.usuario;
    try {
        const { rows } = await pool.query(
            `UPDATE citas SET estado = 'cancelada'
             WHERE id = $1 AND estado IN ('pendiente','confirmada')
               AND cliente_id = (SELECT id FROM clientes WHERE email = $2)
             RETURNING *`,
            [id, email]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Cita no encontrada o ya no se puede cancelar.' });
        return res.json({ cita: rows[0] });
    } catch (err) {
        console.error('Error cancelarCita:', err);
        return res.status(500).json({ error: 'Error al cancelar la cita.' });
    }
};

module.exports = { disponibilidad, crearCita, misCitas, cancelarCita, listarCitas, actualizarEstado };
