/**
 * SS SWAP - Middleware de Carga de Archivos (Multer)
 * Configura la subida de imágenes de perfil y de logos de empresa: valida
 * extensión y firma real del archivo, limita el tamaño y genera nombres
 * aleatorios (la carpeta /uploads es pública).
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
function esImagenReal(ruta, { permitirWebp = true } = {}) {
    let fd;
    try {
        fd = fs.openSync(ruta, 'r');
        const b = Buffer.alloc(12);
        fs.readSync(fd, b, 0, 12, 0);
        const jpg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
        const png = b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
        const webp = b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP';
        return jpg || png || (permitirWebp && webp);
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

// ── Logo de empresa ─────────────────────────────────────────
// Solo PNG o JPG: son los formatos que se pueden incrustar en los PDF
// (proformas, órdenes, RIDE). SVG no se acepta (puede llevar scripts).
const DIR_LOGOS = path.join(__dirname, '..', '..', 'uploads', 'logos');
fs.mkdirSync(DIR_LOGOS, { recursive: true });
const TIPOS_LOGO = ['.jpg', '.jpeg', '.png'];
const MAX_LOGO = 2 * 1024 * 1024; // 2 MB

const uploaderLogo = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, DIR_LOGOS),
        filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
    }),
    fileFilter: (_req, file, cb) => {
        if (!TIPOS_LOGO.includes(path.extname(file.originalname).toLowerCase())) {
            return cb(new Error('Formato no permitido. El logo debe ser PNG o JPG.'));
        }
        cb(null, true);
    },
    limits: { fileSize: MAX_LOGO, files: 1 },
});

/** Sube 1 archivo bajo el campo 'logo' (PNG/JPG reales, máx. 2 MB). */
const subirLogoEmpresa = (req, res, next) => {
    uploaderLogo.single('logo')(req, res, (err) => {
        if (err) {
            const msg = err.code === 'LIMIT_FILE_SIZE' ? 'El logo no puede superar 2 MB.'
                : err instanceof multer.MulterError ? 'No se pudo recibir el archivo.' : (err.message || 'Error al subir el logo.');
            return res.status(400).json({ error: msg });
        }
        if (!req.file) return res.status(400).json({ error: 'Selecciona una imagen para el logo.' });
        if (!esImagenReal(req.file.path, { permitirWebp: false })) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ error: 'El archivo no es una imagen PNG o JPG valida.' });
        }
        next();
    });
};

module.exports = { subirFotoPerfil, subirLogoEmpresa, esImagenReal };
