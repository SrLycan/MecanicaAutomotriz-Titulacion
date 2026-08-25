/**
 * SS SWAP - Utilidades de Imágenes (Resolución y Compresión)
 * Utilidades para resolver y comprimir imágenes subidas por el usuario
 * (repuestos, servicios, perfil). Antes estaban duplicadas en
 * ModalRepuesto.jsx, pages/Servicios.jsx y pages/public/Servicios.jsx.
 */

export const getApiHost = () => {
    const base = process.env.REACT_APP_API_URL || '/api';
    if (/^https?:\/\//i.test(base)) return base.replace(/\/api\/?$/i, '').replace(/\/$/, '');
    return window.location.origin;
};

export const resolveImagenSrc = (value = '') => {
    const src = String(value || '').trim();
    if (!src) return '';
    if (/^(data:image\/|blob:|https?:\/\/)/i.test(src)) return src;
    if (src.startsWith('/')) return `${getApiHost()}${src}`;
    return `${getApiHost()}/${src.replace(/^\/+/, '')}`;
};

export const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

export const comprimirImagen = (file, maxSize = 900, quality = 0.78) => new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml') {
        fileToDataUrl(file).then(resolve).catch(reject);
        return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo procesar la imagen.'));
    };

    img.src = objectUrl;
});
