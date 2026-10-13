# Sprint 25 — Facturas de compra (SRI) que alimentan el inventario

## 1. Auditoría (lo que ya existía)
| Pieza | Estado previo | Uso en este sprint |
|---|---|---|
| `sri/soap.js` | Cliente de los servicios OFICIALES del SRI: recepción, `autorizacionComprobante` y `consultarEstadoAutorizacionComprobante`. | Reutilizado sin cambios. `autorizacionComprobante` devuelve el **XML autorizado** dentro de `<comprobante>` (Ficha técnica 5.11). |
| `sri/claveAcceso.js` | Módulo 11 de la clave de 49 dígitos. | Validación de la clave recibida. |
| `sri/firma.js` | Firma y **verificación** XAdES-BES. | Verifica la firma del XML que carga el usuario. |
| `inventory.controller.generarCodigoReferencia` | Código interno `MEC-000001` / `COL-000001` con contador atómico por empresa. | Reutilizado para productos nuevos. |
| `movimientos_inventario` | Entradas/salidas con `origen='compra'`, `compra_id`, `precio_unitario`, área. | Las entradas por factura usan el mismo esquema + vínculo a la factura. |
| `compras_proveedor` + `movimientos_financieros_proveedor` | Compras manuales, deuda y pagos. | La factura confirmada crea una compra "recibida" con su deuda/pago. |

Verificado en vivo (13/10/2026) con una clave inexistente: pruebas y producción responden
(`numeroComprobantes = 0`; producción tuvo un corte breve de red y respondió al reintento).
**Verificado con una factura real** (13/10/2026): factura de CIALBRA CIA LTDA consultada por
clave en producción; el SRI devolvió el XML autorizado con su detalle.

Hallazgos corregidos: `compras_proveedor_items.cantidad` era entera (no permitía 2,5 litros);
no existía relación código del proveedor → código interno.

## 2. Flujo
1. **Proveedores › Facturas de compra › Registrar factura**: clave de acceso → el servidor
   consulta el SRI. AUTORIZADA → guarda cabecera y artículos (estado `pendiente_confirmacion`).
   **Consultar no toca el inventario.** Repetir la consulta devuelve la misma factura.
2. Si el SRI no responde o no entrega el detalle: **cargar el XML** del proveedor (se valida,
   se verifica su firma y se vuelve a consultar al SRI; si el SRI responde, manda el XML oficial).
   Último recurso: ingreso manual, marcado **no verificado**.
3. Revisión por artículo: producto existente (sugerido por código, nunca solo por nombre),
   producto nuevo (área Mecánica o Colisiones/Pintura, categoría, precio de venta, stock mínimo)
   o "no va al inventario" (fletes, servicios); cantidad recibida ≤ facturada.
4. **Confirmar**: una transacción crea compra + ítems, productos nuevos (código interno del
   sistema), entradas de inventario, relación de códigos del proveedor, deuda (crédito 15 días)
   o pago (contado) y auditoría. Cualquier error → ROLLBACK (nada a medias).

Bloqueos: NO AUTORIZADA, ANULADA, PENDIENTE DE ANULAR, NO ENCONTRADA. Requieren aceptar
advertencias: sin verificar con el SRI, ambiente de pruebas, comprador distinto al RUC de la
empresa, firma inválida. El proveedor elegido debe tener el RUC del emisor.

## 3. Sin duplicados
- `UNIQUE (empresa_id, clave_acceso)` en `facturas_compra`.
- Confirmar bloquea la fila (`FOR UPDATE`) y exige `pendiente_confirmacion`: un segundo
  usuario/doble clic/reintento recibe 409 `YA_REGISTRADA`.
- `UNIQUE (factura_compra_detalle_id)` en `movimientos_inventario`: un artículo genera a lo
  sumo una entrada (garantía de la base).
- Triggers: una factura registrada (y sus artículos) no se borra ni se modifica.
- `Idempotency-Key` en los POST del módulo Proveedores.

## 4. Base de datos (bloque "Sprint 25" de `migrations.sql`, aditivo)
`facturas_compra`, `facturas_compra_detalles`, `repuestos_codigos_proveedor` (RLS por
empresa + llaves compuestas generadas desde `multiempresa.js`), columnas
`movimientos_inventario.factura_compra_id` / `factura_compra_detalle_id`,
`compras_proveedor_items.cantidad` y `cantidad_recibida` → `NUMERIC(10,2)`.
Costo: el costo unitario neto (sin IVA, con descuento) queda en el movimiento
(`precio_unitario`, historial de costos) y actualiza `repuestos.precio_compra` (último costo).

## 4b. PDF de la factura
`GET /api/proveedores/facturas-compra/:id/pdf` (`?ver=1` para abrirlo e imprimir): diseño propio
(services/facturaCompraPdf.service.js) con logo de la empresa, emisor, comprobante con código
de barras de la clave, adquirente, detalle paginado con cabecera repetida, subtotales por tarifa,
forma de pago, información adicional, ingreso al inventario (si está registrada), marca de agua
si no está AUTORIZADA y "Página X de Y". Botones DESCARGAR PDF e IMPRIMIR en el detalle.

## 5. Seguridad
XML: máx. 2 MB, sin DOCTYPE/ENTITY (XXE), parser estricto, coherencia contenido ↔ clave;
el XML original solo lo descarga personal con acceso a Proveedores de la misma empresa
(auditado). Límite de 40 consultas al SRI por usuario cada 10 min. Sin XML ni RUC en los logs.
Permisos: Proveedores ver/crear/eliminar + "Registrar entradas/salidas" + acceso al área
(crear productos exige `inventario_<área>:crear`).

## 6. Pruebas
`PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest --runInBand` → 244/244 (incluye
`sprint25.facturasCompra.integracion.test.js`, 18 pruebas con los 20 escenarios pedidos, con
un servidor SOAP local en el formato del SRI). Frontend: 53/53 y build con `CI=true`.
Prueba manual en el navegador (base de pruebas) del flujo completo.

## 7. Configuración / producción
1. Supabase: `supabase_sprint23.sql`, `supabase_sprint24.sql` (si faltan) y `supabase_sprint25.sql`.
2. El servidor debe poder salir a `https://cel.sri.gob.ec` (producción). Variables opcionales:
   `SRI_WS_PRODUCCION`, `SRI_WS_PRUEBAS`, `SRI_TIMEOUT_MS`.
3. Configurar el RUC de la empresa (Mi empresa o Facturación SRI) para detectar facturas
   emitidas a otro comprador.

## 8. Pendientes / limitaciones
- El SRI puede tardar en tener disponible una factura recién emitida ("no encontrada").
- Si el SRI entrega solo el estado sin XML, se pide el XML del proveedor.
- No se registran notas de crédito ni retenciones recibidas (solo facturas, código 01).
