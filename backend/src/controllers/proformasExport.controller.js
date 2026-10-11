/**
 * SS SWAP - Exportacion de Proformas (PDF / Excel)
 */
const pool = require('../config/db');
const { generarProformaPdf } = require('../services/proformaPdf.service');
const { generarProformaExcel } = require('../services/proformaExcel.service');

/** Quita caracteres invalidos en nombres de archivo de Windows: \ / : * ? " < > | */
function sanitizarNombreArchivo(texto) {
    return String(texto || 'CLIENTE')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 60)
        .toUpperCase() || 'CLIENTE';
}

async function obtenerProformaCompleta(id) {
    const { rows } = await pool.query(
        `SELECT p.*, u.nombre AS usuario_nombre,
                s.nombre AS sucursal_nombre, s.direccion AS sucursal_direccion,
                s.telefono AS sucursal_telefono, s.email AS sucursal_email,
                e.nombre AS empresa_nombre, e.nombre_comercial AS empresa_nombre_comercial,
                e.razon_social AS empresa_razon_social, e.ruc AS empresa_ruc, e.logo_archivo AS empresa_logo
         FROM proformas p
         JOIN empresas e ON e.id = p.empresa_id          -- datos de la empresa DUEÑA del documento
         LEFT JOIN usuarios u ON u.id = p.usuario_id
         LEFT JOIN sucursales s ON s.id = p.sucursal_id
         WHERE p.id = $1`,
        [id]
    );
    const proforma = rows[0];
    if (!proforma) return null;
    // Solo el codigo de referencia INTERNO (r.codigo); el del proveedor no se consulta.
    const { rows: items } = await pool.query(
        `SELECT i.*, r.codigo AS repuesto_codigo
         FROM proforma_items i
         LEFT JOIN repuestos r ON i.referencia_tipo = 'repuesto' AND r.id = i.referencia_id
         WHERE i.proforma_id = $1 ORDER BY i.categoria, i.orden_linea, i.id`, [id]);
    const { rows: zonas } = await pool.query('SELECT zona FROM proforma_zonas_danadas WHERE proforma_id = $1 ORDER BY id', [id]);
    // Pagos reales: los registrados en el pagare de esta proforma (si existe).
    const { rows: pagare } = await pool.query(
        `SELECT id, monto_total, monto_pagado, anticipo_requerido FROM cuentas_cobrar
         WHERE proforma_id = $1 AND estado <> 'anulado' ORDER BY (origen = 'automatico') DESC, id LIMIT 1`, [id]);
    return { ...proforma, items, zonas_danadas: zonas.map(z => z.zona), pagare: pagare[0] || null };
}

// GET /api/proformas/:id/pdf
const descargarPdf = async (req, res) => {
    try {
        const proforma = await obtenerProformaCompleta(req.params.id);
        if (!proforma) return res.status(404).json({ error: 'Proforma no encontrada.' });

        const nombreArchivo = `${proforma.numero}-${sanitizarNombreArchivo(proforma.cliente_nombre)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        generarProformaPdf(proforma, res);
    } catch (err) {
        console.error('Error descargarPdf (proforma):', err);
        if (!res.headersSent) res.status(500).json({ error: 'Error al generar el PDF de la proforma.' });
    }
};

// GET /api/proformas/:id/excel
const descargarExcel = async (req, res) => {
    try {
        const proforma = await obtenerProformaCompleta(req.params.id);
        if (!proforma) return res.status(404).json({ error: 'Proforma no encontrada.' });

        const buffer = await generarProformaExcel(proforma);
        const nombreArchivo = `${proforma.numero}-${sanitizarNombreArchivo(proforma.cliente_nombre)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error('Error descargarExcel (proforma):', err);
        if (!res.headersSent) res.status(500).json({ error: 'Error al generar el Excel de la proforma.' });
    }
};

module.exports = { descargarPdf, descargarExcel };
