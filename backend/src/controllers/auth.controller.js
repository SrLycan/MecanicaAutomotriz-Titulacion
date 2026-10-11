/**
 * SS SWAP - Controlador de Autenticación y Cuentas de Usuario
 *
 * Gestiona el inicio de sesión con JWT separando explícitamente el acceso del
 * panel de clientes y del panel del personal (staff), la validación de estados
 * de cuenta (activo, suspendido, bloqueado) y el registro de clientes con
 * vinculación automática a la tabla 'clientes'.
 *
 * Multiempresa: el correo es único en toda la plataforma, así que el login
 * busca la cuenta en todas las empresas (sinAislamiento) y la sesión queda
 * en la empresa de esa cuenta. El registro público crea clientes de la
 * empresa dueña de la web pública (SS SWAP).
 */
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { registrarIntento, registrarIntentoIp } = require('../middleware/loginThrottle.middleware');
const { ROLES_STAFF, ROL_SUPERADMIN } = require('../config/permisos');
const { registrarAuditoria } = require('../services/auditoria.service');
const { sinAislamiento } = require('../config/contexto');
const { empresaPublicaId } = require('../middleware/empresa.middleware');
const { MODULOS } = require('../config/permisos');

/**
 * Firma el JWT de una cuenta. "tv" (token_version) permite invalidar todas
 * las sesiones de la cuenta al desactivarla o restablecer su acceso.
 */
function firmarToken(u) {
    const payload = { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
    const token = jwt.sign({ ...payload, tv: Number(u.token_version) || 0 }, process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    return { token, usuario: payload };
}

/** Todos los permisos de "ver" (soporte de solo lectura). */
const PERMISOS_LECTURA = MODULOS.flatMap(m => m.acciones.filter(a => a.codigo === 'ver').map(() => `${m.codigo}:ver`));

/**
 * Permisos vigentes de una cuenta. El superadministrador tiene '*' (todo)
 * solo dentro de una empresa; sin empresa no tiene permisos de empresa.
 */
async function permisosDe(u, soporte = null) {
    if (u.rol === ROL_SUPERADMIN) {
        if (!u.empresa_id) return [];
        return soporte?.modo === 'lectura' ? PERMISOS_LECTURA : ['*'];
    }
    if (!ROLES_STAFF.includes(u.rol)) return [];
    const { rows } = await sinAislamiento(() => pool.query(
        `SELECT modulo || ':' || accion AS p FROM usuario_permisos WHERE usuario_id = $1 ORDER BY 1`, [u.id]));
    return rows.map(r => r.p);
}

/** Datos de sesion que recibe el frontend (nunca contrasenas ni tokens internos). */
const datosEmpresa = (u) => (u.empresa_id ? { id: u.empresa_id, nombre: u.empresa_nombre, slug: u.empresa_slug } : null);

// Limites de longitud aceptados para email/contrasena. No son solo cosmeticos:
// - EMAIL_MAX_LEN evita procesar strings gigantes en la consulta/comparaciones.
// - PASSWORD_MAX_LEN evita mandar strings enormes a bcrypt (costo de CPU
//   innecesario) y, sobre todo, respeta el limite real de bcrypt: solo mira
//   los primeros 72 bytes de la contrasena y trunca el resto EN SILENCIO, asi
//   que aceptar mas de eso sin avisar es un problema de seguridad, no de UX.
const EMAIL_MAX_LEN    = 254; // maximo practico de un correo (RFC 5321)
const PASSWORD_MIN_LEN = 6;
const PASSWORD_MAX_LEN = 72;

/* ── LOGIN ─────────────────────────────────────────────────── */
/**
 * Autentica usuarios del sistema (staff administrativo/técnico y clientes).
 * Valida credenciales con hash bcrypt, verifica que la cuenta no esté
 * suspendida o bloqueada y que el panel solicitado corresponda al rol.
 */
const login = async (req, res) => {
    const { email, password, panel } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string')
        return res.status(400).json({ error: 'Email y contrasena son requeridos.' });
    if (!email || !password)
        return res.status(400).json({ error: 'Email y contrasena son requeridos.' });

    // "panel" es obligatorio y cerrado a dos valores: es lo que separa de
    // verdad el acceso de clientes del acceso de personal (antes solo se
    // filtraba en el frontend, lo cual no protegia nada real).
    if (panel !== 'cliente' && panel !== 'staff')
        return res.status(400).json({ error: 'Solicitud invalida.' });

    if (email.length > EMAIL_MAX_LEN || password.length > PASSWORD_MAX_LEN)
        return res.status(401).json({ error: 'Credenciales invalidas.' });

    registrarIntentoIp(req);
    const emailNorm = email.toLowerCase().trim();

    try {
        // El correo es unico en la plataforma: se busca en todas las empresas.
        const { rows } = await sinAislamiento(() => pool.query(
            `SELECT u.id, u.nombre, u.email, u.password, u.rol, u.activo, u.estado, u.token_version, u.empresa_id,
                    e.nombre AS empresa_nombre, e.slug AS empresa_slug, e.estado AS empresa_estado
             FROM usuarios u LEFT JOIN empresas e ON e.id = u.empresa_id
             WHERE u.email = $1`,
            [emailNorm]
        ));
        const usuario = rows[0];
        if (!usuario) {
            registrarIntento(emailNorm, false);
            return res.status(401).json({ error: 'Credenciales invalidas.' });
        }

        const ok = await bcrypt.compare(password, usuario.password);
        if (!ok) {
            registrarIntento(emailNorm, false);
            return res.status(401).json({ error: 'Credenciales invalidas.' });
        }

        // De aqui en adelante la contrasena ya es correcta: lo que sigue son
        // rechazos por estado de cuenta o panel equivocado, no intentos de
        // adivinar la contrasena, asi que no cuentan para el bloqueo por
        // fuerza bruta (se limpia el contador, igual que un login exitoso).
        registrarIntento(emailNorm, true);

        if (usuario.estado === 'bloqueado')
            return res.status(403).json({ error: 'Tu cuenta esta bloqueada. Contacta al administrador.' });
        if (usuario.estado === 'suspendido')
            return res.status(403).json({ error: 'Tu cuenta esta suspendida temporalmente.' });
        if (!usuario.activo)
            return res.status(403).json({ error: 'Tu cuenta esta inactiva.' });

        if (usuario.empresa_id && usuario.empresa_estado !== 'activa' && usuario.rol !== ROL_SUPERADMIN)
            return res.status(403).json({ error: 'La empresa de esta cuenta no esta activa. Contacta al administrador de la plataforma.' });

        const esStaff = ROLES_STAFF.includes(usuario.rol);
        // El portal de clientes es el de la web publica: solo sus clientes.
        if (panel === 'cliente' && !esStaff && usuario.empresa_id !== await empresaPublicaId())
            return res.status(403).json({ error: 'Esta cuenta no pertenece a este sitio.' });
        if (panel === 'cliente' && esStaff)
            return res.status(403).json({ error: 'Esta cuenta pertenece al personal del taller. Ingresa desde el acceso de personal.' });
        if (panel === 'staff' && !esStaff)
            return res.status(403).json({ error: 'Este acceso es exclusivo para personal del taller.' });

        const { token, usuario: payload } = firmarToken(usuario);
        const permisos = await permisosDe(usuario);
        sinAislamiento(() => pool.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1', [usuario.id])).catch(() => {});
        if (esStaff) {
            sinAislamiento(() => registrarAuditoria({ req, actor: payload, accion: 'sesion.inicio', recursoTipo: 'usuario',
                recursoId: usuario.id, empresaId: usuario.empresa_id }));
        }

        return res.json({
            token, usuario: payload, permisos,
            empresa: datosEmpresa(usuario),
            plataforma: usuario.rol === ROL_SUPERADMIN,
        });
    } catch (err) {
        console.error('Error en login:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/* ── REGISTRO CLIENTE ───────────────────────────────────────── */
/**
 * Registra nuevos clientes desde el portal público.
 * Crea el usuario con rol 'cliente' y asegura, dentro de la MISMA transacción,
 * la creación/vínculo del registro correspondiente en la tabla 'clientes'
 * para habilitar historial, citas y tienda.
 */
const register = async (req, res) => {
    const { nombre, email, password, telefono, cedula } = req.body || {};

    if ([nombre, email, password].some(v => typeof v !== 'string')
        || [telefono, cedula].some(v => v !== undefined && v !== null && typeof v !== 'string' && typeof v !== 'number'))
        return res.status(400).json({ error: 'Nombre, email y contrasena son requeridos.' });
    if (!nombre || !email || !password)
        return res.status(400).json({ error: 'Nombre, email y contrasena son requeridos.' });

    if (email.length > EMAIL_MAX_LEN)
        return res.status(400).json({ error: 'El email es demasiado largo.' });

    if (password.length < PASSWORD_MIN_LEN)
        return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres.' });
    if (password.length > PASSWORD_MAX_LEN)
        return res.status(400).json({ error: `La contrasena no puede tener mas de ${PASSWORD_MAX_LEN} caracteres.` });

    if (nombre.trim().length > 120)
        return res.status(400).json({ error: 'El nombre es demasiado largo.' });
    if (telefono && String(telefono).length > 20)
        return res.status(400).json({ error: 'El telefono no es valido.' });
    if (cedula && String(cedula).length > 20)
        return res.status(400).json({ error: 'La cedula no es valida.' });

    const emailNorm = email.toLowerCase().trim();
    let client;

    try {
        // Dentro del try: si no se logra conexion, se responde un error en vez
        // de dejar la peticion colgada (el usuario veia "cargando" eterno).
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: existe } = await client.query(
            'SELECT id FROM usuarios WHERE email = $1', [emailNorm]
        );
        if (existe.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe una cuenta con ese email.' });
        }

        const hash = await bcrypt.hash(password, 10);
        const { rows } = await client.query(
            `INSERT INTO usuarios (nombre, email, password, rol, telefono, cedula)
             VALUES ($1, $2, $3, 'cliente', $4, $5)
             RETURNING id, nombre, email, rol`,
            [nombre.trim(), emailNorm, hash, telefono || null, cedula || null]
        );

        // Vincula (o crea) el registro de "clientes" en la MISMA transaccion que el
        // usuario: si esta insercion falla, la de arriba tambien se revierte, para
        // que nunca quede una cuenta creada sin cliente vinculado (bloqueaba agendar).
        // El correo NO se verifica, y el portal muestra las ordenes, vehiculos y
        // pagos del cliente con ese correo. Si ya es cliente del taller, solo se
        // vincula si tambien da su cedula registrada; si no, cualquiera podria
        // registrarse con el correo de otra persona y ver sus datos.
        const { rows: cliExiste } = await client.query(
            'SELECT id, cedula FROM clientes WHERE LOWER(email) = $1', [emailNorm]
        );
        const soloDigitos = (v) => String(v || '').replace(/\D/g, '');
        if (cliExiste.length > 0
            && !cliExiste.some(c => soloDigitos(c.cedula) && soloDigitos(c.cedula) === soloDigitos(cedula))) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: 'Ese correo ya esta registrado en el taller. Escribe la cedula con la que te registraron, o comunicate con el taller.',
            });
        }
        if (cliExiste.length === 0) {
            await client.query(
                `INSERT INTO clientes (nombre, email, telefono, cedula)
                 VALUES ($1, $2, $3, $4)`,
                [nombre.trim(), emailNorm, telefono || null, cedula || null]
            );
        }

        await client.query('COMMIT');

        const { token, usuario: payload } = firmarToken(rows[0]);

        return res.status(201).json({ token, usuario: payload, permisos: [] });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error en register:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        if (client) client.release();
    }
};

/* ── ME ─────────────────────────────────────────────────────── */
/**
 * Retorna el usuario autenticado y sus permisos VIGENTES (leídos de la BD por
 * verificarToken). El panel lo consulta al cargar y periódicamente para que
 * un permiso revocado desaparezca del menú sin cerrar sesión.
 */
const me = async (req, res) => {
    const { id, nombre, email, rol, empresa, soporte } = req.usuario;
    const permisos = rol === ROL_SUPERADMIN
        ? await permisosDe({ rol, empresa_id: req.usuario.empresa_id }, soporte)
        : req.usuario.permisos;
    return res.json({
        usuario: { id, nombre, email, rol }, permisos,
        empresa: empresa || null,
        soporte: soporte ? { modo: soporte.modo, expira: soporte.expira, motivo: soporte.motivo } : null,
        plataforma: rol === ROL_SUPERADMIN,
    });
};

module.exports = { login, register, me, firmarToken, permisosDe };
