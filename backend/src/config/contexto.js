/**
 * SS SWAP - Contexto de empresa de cada petición (AsyncLocalStorage)
 *
 * El backend sabe a qué empresa pertenece una petición por el usuario
 * AUTENTICADO (verificarToken) o, en la web pública, por la empresa pública
 * configurada. Ese dato viaja aquí, nunca en un parámetro del navegador, y
 * config/db.js lo usa para ejecutar cada consulta aislada (RLS).
 *
 * Contextos:
 *  - { empresaId: N }        consultas de la empresa N (rol ssswap_app + RLS).
 *  - { empresaId: null }     usuario autenticado sin empresa (p. ej. el
 *                            superadministrador global): no ve datos de
 *                            ninguna empresa (falla cerrado).
 *  - { sistema: true }       SIN aislamiento: solo para operaciones de la
 *                            plataforma (login, gestión de empresas,
 *                            respaldos). Se usa con sinAislamiento(), a la
 *                            vista en el código.
 *  - sin contexto            scripts del servidor y arranque (migraciones).
 */
const { AsyncLocalStorage } = require('async_hooks');

const almacen = new AsyncLocalStorage();

/** Contexto actual (o undefined fuera de una petición). */
const contextoActual = () => almacen.getStore();

/** Ejecuta fn con el contexto indicado (se propaga a todo lo asíncrono que llame). */
const conContexto = (ctx, fn) => almacen.run(Object.freeze({ ...ctx }), fn);

/** Ejecuta fn dentro de la empresa indicada. */
const conEmpresa = (empresaId, fn, extra = {}) => conContexto({ ...extra, empresaId: empresaId ?? null }, fn);

/**
 * Ejecuta fn SIN aislamiento por empresa. Solo para operaciones de la
 * plataforma que necesitan ver varias empresas (login, empresas, respaldos).
 */
const sinAislamiento = (fn) => conContexto({ sistema: true }, fn);

/** Empresa del contexto actual (null si no hay). */
const empresaActual = () => {
    const ctx = contextoActual();
    return ctx && !ctx.sistema ? ctx.empresaId ?? null : null;
};

module.exports = { contextoActual, conContexto, conEmpresa, sinAislamiento, empresaActual };
