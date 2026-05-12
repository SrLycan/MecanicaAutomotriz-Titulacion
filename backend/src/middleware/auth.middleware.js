const jwt = require('jsonwebtoken');

/**
 * Verifica el JWT en el header Authorization.
 * Adjunta req.usuario = { id, nombre, email, rol }
 */
const verificarToken = (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer '))
        return res.status(401).json({ error: 'Token de acceso requerido.' });

    const token = header.split(' ')[1];
    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        const msg = err.name === 'TokenExpiredError'
            ? 'Token expirado. Inicia sesion nuevamente.'
            : 'Token invalido.';
        return res.status(401).json({ error: msg });
    }
};

/**
 * Restringe la ruta a los roles indicados.
 * Uso: verificarRol('administrador', 'tecnico')
 */
const verificarRol = (...rolesPermitidos) => (req, res, next) => {
    if (!req.usuario)
        return res.status(401).json({ error: 'No autenticado.' });
    if (!rolesPermitidos.includes(req.usuario.rol))
        return res.status(403).json({
            error: `Acceso denegado. Roles permitidos: ${rolesPermitidos.join(', ')}.`
        });
    next();
};

/**
 * Solo personal interno del taller (excluye clientes)
 */
const soloStaff = verificarRol('administrador', 'tecnico', 'recepcionista');

module.exports = { verificarToken, verificarRol, soloStaff };
