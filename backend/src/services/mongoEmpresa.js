/**
 * SS SWAP - Separación por empresa de los datos guardados en MongoDB
 * (bitácora de órdenes y conversaciones del chatbot).
 *
 * MongoDB no tiene Row Level Security: cada documento nuevo guarda
 * empresa_id (de la petición) y cada lectura se filtra por la empresa de la
 * petición. Los documentos anteriores a la plataforma multiempresa no tienen
 * empresa_id: pertenecen a SS SWAP (la única empresa que existía).
 */
const pool = require('../config/db');
const { empresaActual, sinAislamiento } = require('../config/contexto');

let ssswap = { id: undefined, hasta: 0 };

/** Id de SS SWAP (dueña de los documentos antiguos sin empresa). */
async function idEmpresaLegada() {
    if (ssswap.id !== undefined && Date.now() < ssswap.hasta) return ssswap.id;
    try {
        const { rows } = await sinAislamiento(() => pool.query(`SELECT id FROM empresas WHERE slug = 'ss-swap'`));
        ssswap = { id: rows[0]?.id ?? null, hasta: Date.now() + 10 * 60 * 1000 };
    } catch {
        ssswap = { id: null, hasta: Date.now() + 60 * 1000 };
    }
    return ssswap.id;
}

/** Campo a guardar en cada documento nuevo. */
const marcaEmpresa = () => ({ empresa_id: empresaActual() });

/**
 * Filtro de MongoDB que limita a la empresa de la petición. Sin empresa no
 * coincide con nada (falla cerrado).
 */
async function filtroEmpresa(filtro = {}) {
    const id = empresaActual();
    if (!id) return { $and: [filtro, { empresa_id: -1 }] };
    const propio = id === await idEmpresaLegada()
        ? { $or: [{ empresa_id: id }, { empresa_id: { $exists: false } }] }
        : { empresa_id: id };
    return { $and: [filtro, propio] };
}

module.exports = { marcaEmpresa, filtroEmpresa, idEmpresaLegada };
