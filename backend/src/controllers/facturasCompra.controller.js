/**
 * SS SWAP - Facturas de compra (/api/proveedores/facturas-compra)
 *
 * Permisos (permisoPorMetodo('proveedores') en el enrutador): ver = GET,
 * crear = consultar / cargar XML / ingresar / confirmar, eliminar = descartar
 * una factura NO registrada. Confirmar exige además "Registrar entradas /
 * salidas" de inventario y acceso al área de cada artículo (en el servicio).
 * Todo corre aislado por empresa (RLS): otra empresa nunca ve ni toca estas filas.
 */
const F = require('../services/facturasCompra.service');
const { registrarAuditoria } = require('../services/auditoria.service');

// Límite de consultas al SRI por usuario (protege al servicio y evita abuso).
const VENTANA_MS = 10 * 60 * 1000;
const MAX_CONSULTAS = 40;
const consultas = new Map();
function limiteConsultas(req, res, next) {
    const clave = `${req.usuario.empresa_id}:${req.usuario.id}`;
    const ahora = Date.now();
    const lista = (consultas.get(clave) || []).filter(t => ahora - t < VENTANA_MS);
    if (lista.length >= MAX_CONSULTAS) {
        return res.status(429).json({ error: 'Demasiadas consultas al SRI en poco tiempo. Espere unos minutos.', codigo: 'LIMITE_CONSULTAS' });
    }
    lista.push(ahora);
    consultas.set(clave, lista);
    if (consultas.size > 5000) consultas.delete(consultas.keys().next().value);
    return next();
}

function responder(res, err, mensaje) {
    if (err instanceof F.ErrorNegocio) {
        const { status, error, ...extra } = err;
        delete extra.message; delete extra.stack;
        return res.status(status).json({ error, ...extra });
    }
    if (err instanceof F.ErrorXml) return res.status(400).json({ error: err.message, codigo: err.codigo });
    if (err && err.code === 'P0001') return res.status(409).json({ error: String(err.message).slice(0, 300) });
    if (err && err.code === '23505') return res.status(409).json({ error: 'La operación ya se realizó (registro duplicado). Actualice la pantalla.', codigo: 'DUPLICADO' });
    // Sin XML, RUC ni datos tributarios en el log: solo el tipo de error.
    console.error('[facturas-compra]', mensaje, err && (err.code || err.name), err && String(err.message).slice(0, 160));
    return res.status(500).json({ error: mensaje });
}

const conFactura = async (res, id, extra = {}) => {
    const factura = await F.obtener(id);
    return res.json({ factura, ...extra });
};

// POST /consultar   { clave_acceso, reconsultar? }
const consultar = async (req, res) => {
    try {
        const r = await F.consultar(req.body?.clave_acceso, req.usuario, { reconsultar: req.body?.reconsultar === true });
        return conFactura(res.status(r.existente ? 200 : 201), r.factura_id, { existente: r.existente });
    } catch (err) { return responder(res, err, 'No se pudo consultar la factura.'); }
};

// POST /xml   { xml }   (texto del archivo que entregó el proveedor)
const cargarXml = async (req, res) => {
    const xml = req.body?.xml;
    if (typeof xml !== 'string') return res.status(400).json({ error: 'Envíe el contenido del XML.' });
    try {
        const r = await F.cargarXml(xml, req.usuario);
        return conFactura(res.status(r.existente ? 200 : 201), r.factura_id, { existente: r.existente, sri_disponible: r.sri_disponible });
    } catch (err) { return responder(res, err, 'No se pudo procesar el XML.'); }
};

// POST /manual   { clave_acceso, razon_social?, total_iva?, lineas:[{codigo?, descripcion, cantidad, precio_unitario, descuento?, unidad_medida?}] }
const ingresoManual = async (req, res) => {
    try {
        const r = await F.ingresoManual(req.body || {}, req.usuario);
        return conFactura(res.status(r.existente ? 200 : 201), r.factura_id, { existente: r.existente, sri_disponible: r.sri_disponible });
    } catch (err) { return responder(res, err, 'No se pudo guardar la factura.'); }
};

// GET /   ?q=&estado=&desde=&hasta=&proveedor_id=&page=&limit=
const listar = async (req, res) => {
    try { return res.json(await F.listar(req.query)); } catch (err) { return responder(res, err, 'No se pudieron listar las facturas de compra.'); }
};

// GET /:id
const obtener = async (req, res) => {
    try {
        const factura = await F.obtener(req.params.id);
        if (!factura) return res.status(404).json({ error: 'Factura no encontrada.' });
        return res.json({ factura });
    } catch (err) { return responder(res, err, 'No se pudo obtener la factura.'); }
};

// GET /:id/xml   (XML original; solo personal con acceso a Proveedores de la misma empresa)
const descargarXml = async (req, res) => {
    try {
        const f = await F.xmlOriginal(req.params.id);
        if (!f) return res.status(404).json({ error: 'Factura no encontrada.' });
        if (!f.xml_original) return res.status(404).json({ error: 'Esta factura no tiene XML (se ingresó a mano).' });
        registrarAuditoria({ req, accion: 'factura_compra.descargar_xml', recursoTipo: 'factura_compra', recursoId: req.params.id });
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="factura-${String(f.numero || f.clave_acceso).replace(/[^\w-]/g, '_')}.xml"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(f.xml_original);
    } catch (err) { return responder(res, err, 'No se pudo descargar el XML.'); }
};

// GET /:id/pdf   (representación legible; ?ver=1 para abrirlo en el navegador e imprimir)
const descargarPdf = async (req, res) => {
    if (!/^\d+$/.test(String(req.params.id))) return res.status(404).json({ error: 'Factura no encontrada.' });
    try {
        const r = await F.pdf(req.params.id);
        if (!r) return res.status(404).json({ error: 'Factura no encontrada.' });
        const nombre = `Factura-compra-${String(r.numero || req.params.id).replace(/[^\w-]/g, '_')}-${String(r.emisor || '').normalize('NFD')
            .replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').slice(0, 40)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${req.query.ver === '1' ? 'inline' : 'attachment'}; filename="${nombre}"`);
        return res.send(r.buffer);
    } catch (err) { return responder(res, err, 'No se pudo generar el PDF de la factura.'); }
};

// POST /:id/confirmar
const confirmar = async (req, res) => {
    if (!/^\d+$/.test(String(req.params.id))) return res.status(404).json({ error: 'Factura no encontrada.' });
    try {
        const r = await F.confirmar(req.params.id, req.body || {}, req);
        return conFactura(res, r.factura_id, { resultado: r });
    } catch (err) { return responder(res, err, 'No se pudo registrar la compra.'); }
};

// DELETE /:id   (solo facturas NO registradas)
const descartar = async (req, res) => {
    if (!/^\d+$/.test(String(req.params.id))) return res.status(404).json({ error: 'Factura no encontrada.' });
    try {
        await F.descartar(req.params.id);
        return res.json({ mensaje: 'Factura descartada.' });
    } catch (err) { return responder(res, err, 'No se pudo descartar la factura.'); }
};

module.exports = { consultar, cargarXml, ingresoManual, listar, obtener, descargarXml, descargarPdf, confirmar, descartar, limiteConsultas };
