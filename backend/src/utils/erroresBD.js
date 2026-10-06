/**
 * SS SWAP - Traduccion de errores de PostgreSQL a respuestas HTTP claras.
 * Las restricciones de la base (CHECK, UNIQUE, FK) son la ultima linea de
 * defensa: si un dato invalido llega hasta ahi, se responde 400/409 con un
 * mensaje entendible en lugar de un 500 generico.
 */

// Mensajes por nombre de restriccion (ver migrations.sql, Sprint 16).
const MENSAJES = {
    repuestos_precios_no_negativos:      'Los precios y el stock minimo no pueden ser negativos.',
    repuestos_stock_no_negativo:         'El stock no puede quedar negativo.',
    tipos_servicio_valores_validos:      'El precio no puede ser negativo y la duracion debe ser mayor a cero.',
    vehiculos_anio_valido:               'El año del vehiculo no es valido.',
    ordenes_trabajo_km_no_negativo:      'El kilometraje no puede ser negativo.',
    cuentas_cobrar_vencimiento_valido:   'La fecha de vencimiento no puede ser anterior a la fecha de la cuenta.',
    cuentas_cobrar_pagado_no_excede:     'El monto pagado no puede superar el total de la cuenta.',
    caja_movimientos_monto_check:        'El monto debe ser mayor a cero.',
    uq_sucursal_principal:               'Ya existe una sucursal principal.',
    uq_proveedores_ruc:                  'Ya existe un proveedor con ese RUC.',
    uq_caja_sesion_abierta:              'Ya existe una caja abierta. Cierrala antes de abrir una nueva.',
    uq_cuenta_dinero_predeterminada:     'Ya existe una cuenta predeterminada de ese tipo.',
    cuentas_dinero_nombre_key:           'Ya existe una cuenta con ese nombre.',
    cuentas_dinero_predeterminada_activa:'La cuenta predeterminada no se puede desactivar.',
    pagos_empleados_descuento_valido:    'Los descuentos deben ser menores al monto.',
    movimientos_dinero_monto_check:      'El monto debe ser mayor a cero.',
    repuestos_codigo_key:                'El codigo ya existe.',
    usuarios_email_key:                  'Ese correo ya esta en uso.',
    clientes_cedula_key:                 'Ya existe un cliente con esa cedula.',
};

/**
 * Devuelve { status, error } si el error es una violacion de restriccion
 * conocida, o null para que el llamador responda su 500 habitual.
 */
function errorBD(err) {
    if (!err || !err.code) return null;
    const msg = MENSAJES[err.constraint];
    switch (err.code) {
        case '23514': return { status: 400, error: msg || 'Algun dato no cumple las reglas de validacion.' };
        case '23505': return { status: 409, error: msg || 'Ya existe un registro con esos datos.' };
        case '23503':
            // Insert/update con una referencia inexistente vs. borrar algo que otros usan.
            // El detalle viene en ingles o espanol segun el idioma del servidor PostgreSQL.
            if (/not present|no est. presente/i.test(err.detail || ''))
                return { status: 400, error: msg || 'Alguno de los valores seleccionados no existe.' };
            return { status: 409, error: msg || 'No se puede completar: el registro esta relacionado con otros datos.' };
        case '22P02':
        case '22007':
        case '22008': return { status: 400, error: 'Algun dato tiene un formato invalido.' };
        default:      return null;
    }
}

module.exports = { errorBD };
