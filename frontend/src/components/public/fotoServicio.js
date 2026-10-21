/**
 * SS SWAP - Foto de un servicio del catálogo para la web pública.
 * Usa la imagen propia del servicio; si no tiene, una foto genérica según su nombre.
 */
import { resolveImagenSrc } from '../../utils/imagen';

const FOTOS_GENERICAS = [
    { match: /motor|distribuc|correa/i,                  img: '/servicios/motor.png' },
    { match: /freno|disco|pastilla/i,                    img: '/servicios/frenos.jpg' },
    { match: /diagn|escaner|computari|obd/i,             img: '/servicios/diagnostico.jpg' },
    { match: /colisi|pintura|carrocer|latoner|enderez/i, img: '/servicios/colisiones.png' },
    { match: /aceite|lubric|filtro|mantenimiento/i,      img: '/servicios/aceite.png' },
    { match: /suspens|amortigu|rotula/i,                 img: '/servicios/suspension.jpg' },
    { match: /electr|bater|alternador|arranque/i,        img: '/servicios/electronica.png' },
    { match: /alinea|balanceo|neum|llanta/i,             img: '/servicios/alineacion.jpg' },
];

export default function fotoServicio(s) {
    if (s.imagen_url) return resolveImagenSrc(s.imagen_url);
    return FOTOS_GENERICAS.find(f => f.match.test(s.nombre || ''))?.img || '';
}
