/**
 * SS SWAP - Middleware de Carga de Archivos (Multer)
 * Configura la subida de imágenes de perfil al servidor: valida extensión,
 * limita el tamaño y genera nombres únicos por usuario y fecha.
 */
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const DIR_PERFILES = path.join(__dirname, '..', '..', 'uploads', 'perfiles');
fs.mkdirSync(DIR_PERFILES, { recursive: true });

const TIPOS_PERMITIDOS = ['.jpg', '.jpeg', '.png', '.webp'];

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DIR_PERFILES),
    filename: (_req, file, cb) => {
        // Nombre aleatorio: la carpeta /uploads es publica, asi que el nombre no
        // debe permitir adivinar las fotos de otras personas (antes era id+fecha).
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
    },
});

// Firma real del archivo (primeros bytes): la extension se puede falsificar.
function esImagenReal(ruta) {
    let fd;
    try {
        fd = fs.openSync(ruta, 'r');
        const b = Buffer.alloc(12);
        fs.readSync(fd, b, 0, 12, 0);
        const jpg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
        const png = b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
        const webp = b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP';
        return jpg || png || webp;
    } catch (_) {
        return false;
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
    }
}

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
        if (!esImagenReal(req.file.path)) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ error: 'El archivo no es una imagen valida. Usa JPG, PNG o WEBP.' });
        }
        next();
    });
};

module.exports = { subirFotoPerfil };
