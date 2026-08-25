/**
 * SS SWAP - Middleware de Carga de Archivos (Multer)
 * Configura la subida de imágenes de perfil al servidor: valida extensión,
 * limita el tamaño y genera nombres únicos por usuario y fecha.
 */
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const DIR_PERFILES = path.join(__dirname, '..', '..', 'uploads', 'perfiles');
fs.mkdirSync(DIR_PERFILES, { recursive: true });

const TIPOS_PERMITIDOS = ['.jpg', '.jpeg', '.png', '.webp'];

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DIR_PERFILES),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `usuario-${req.usuario.id}-${Date.now()}${ext}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!TIPOS_PERMITIDOS.includes(ext)) {
        return cb(new Error('Formato no permitido. Usa JPG, PNG o WEBP.'));
    }
    cb(null, true);
};

const uploader = multer({ storage, fileFilter, limits: { fileSize: 3 * 1024 * 1024 } }); // 3MB

/**
 * Middleware listo para montar en una ruta: sube 1 archivo bajo el campo 'foto'
 * y responde con un error legible si algo falla (tamano, formato, etc).
 * Requiere ejecutarse DESPUES de verificarToken (usa req.usuario.id).
 */
const subirFotoPerfil = (req, res, next) => {
    uploader.single('foto')(req, res, (err) => {
        if (err) {
            const msg = err.code === 'LIMIT_FILE_SIZE'
                ? 'La imagen no puede superar 3MB.'
                : (err.message || 'Error al subir la imagen.');
            return res.status(400).json({ error: msg });
        }
        if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen para subir.' });
        next();
    });
};

module.exports = { subirFotoPerfil };
