/**
 * SS SWAP - Servidor SOAP LOCAL que imita los servicios del SRI (SOLO PRUEBAS)
 *
 * Responde AutorizacionComprobantesOffline y ConsultaComprobante con el mismo
 * sobre SOAP que devuelve el SRI (ver respuesta real en soap.js / Ficha
 * técnica 5.11), para probar de punta a punta el código de producción sin
 * enviar datos al SRI. Nunca se usa fuera de las pruebas.
 *
 *   const sri = await iniciarSriLocal();
 *   process.env.SRI_WS_PRODUCCION = sri.url;   // ANTES de requerir src/sri/soap
 *   sri.registrar(clave, { estado: 'AUTORIZADO', xml, anulado: false });
 *   sri.caido = true;  // simula el SRI fuera de servicio
 */
const http = require('http');

function sobre(cuerpo) {
    return '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' + cuerpo + '</soap:Body></soap:Envelope>';
}

async function iniciarSriLocal() {
    const facturas = new Map();
    const estado = { caido: false, llamadas: 0 };
    const server = http.createServer((req, res) => {
        let cuerpo = '';
        req.on('data', (c) => { cuerpo += c; });
        req.on('end', () => {
            estado.llamadas++;
            if (estado.caido) { res.writeHead(503, { 'Content-Type': 'text/html' }); return res.end('<html>Service Unavailable</html>'); }
            const clave = (cuerpo.match(/<claveAcceso(?:Comprobante)?>(\d{49})</) || [])[1];
            const f = facturas.get(clave);
            res.writeHead(200, { 'Content-Type': 'text/xml;charset=UTF-8' });
            if (req.url.includes('AutorizacionComprobantesOffline')) {
                const aut = !f ? '' : `<autorizaciones><autorizacion><estado>${f.estado}</estado>`
                    + (f.estado === 'AUTORIZADO' ? `<numeroAutorizacion>${clave}</numeroAutorizacion>` : '')
                    + `<fechaAutorizacion>2026-10-10T10:20:30.000-05:00</fechaAutorizacion><ambiente>PRODUCCIÓN</ambiente>`
                    + (f.estado === 'AUTORIZADO' && !f.sinXml ? `<comprobante><![CDATA[${f.xml}]]></comprobante>` : '')
                    + (f.estado === 'AUTORIZADO' ? '<mensajes/>' : '<mensajes><mensaje><identificador>45</identificador><mensaje>SECUENCIAL REGISTRADO</mensaje><tipo>ERROR</tipo></mensaje></mensajes>')
                    + '</autorizacion></autorizaciones>';
                return res.end(sobre(`<ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion"><RespuestaAutorizacionComprobante>`
                    + `<claveAccesoConsultada>${clave}</claveAccesoConsultada><numeroComprobantes>${f ? 1 : 0}</numeroComprobantes>${aut}`
                    + `</RespuestaAutorizacionComprobante></ns2:autorizacionComprobanteResponse>`));
            }
            if (req.url.includes('ConsultaComprobante')) {
                if (f?.consultaCaida) { res.writeHead(503); return res.end(''); }
                const est = !f ? '<estadoConsulta>RECHAZADA</estadoConsulta>'
                    : `<estadoConsulta>EXISTE</estadoConsulta><estadoAutorizacion>${f.anulado ? 'ANULADO' : f.estado}</estadoAutorizacion>`;
                return res.end(sobre(`<ns2:consultarEstadoAutorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.consultas"><EstadoAutorizacionComprobante>`
                    + `${est}<claveAcceso>${clave}</claveAcceso></EstadoAutorizacionComprobante></ns2:consultarEstadoAutorizacionComprobanteResponse>`));
            }
            res.end(sobre('<soap:Fault><faultstring>Operacion desconocida</faultstring></soap:Fault>'));
        });
    });
    await new Promise(ok => server.listen(0, '127.0.0.1', ok));
    return {
        url: `http://127.0.0.1:${server.address().port}`,
        registrar: (clave, datos) => facturas.set(clave, datos),
        get caido() { return estado.caido; },
        set caido(v) { estado.caido = v; },
        get llamadas() { return estado.llamadas; },
        cerrar: () => new Promise(ok => server.close(ok)),
    };
}

module.exports = { iniciarSriLocal };
