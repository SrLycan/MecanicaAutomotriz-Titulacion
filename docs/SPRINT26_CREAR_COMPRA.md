# Sprint 26 — "Crear compra" (estilo de los sistemas contables)

Referencia: el flujo de compras de Woo!Factura (video y capturas del 13/10/2026). Se aplicó al
sistema propio reutilizando todo lo del Sprint 25 (consulta al SRI, XML, entrada única al inventario).

## 1. Dónde quedó
- **Proveedores › Compras** es ahora el único lugar de las compras. La pestaña "Facturas de compra"
  desapareció del menú (sus facturas se ven y se continúan desde Compras; los enlaces viejos
  `?tab=facturas` redirigen solos).
- Menú: Proveedores › **Compras** (lista) y Proveedores › **Crear compra**.
- La URL guarda la vista (`?tab=compras&crear=1`, `?tab=compras&compra=ID`): el botón "atrás"
  del navegador funciona.

## 2. Lista de compras
CREAR · Desde / Hasta (por defecto el mes actual) · Estado · Proveedor · Inventario · Buscar
(proveedor, RUC o número) · indicadores **TOTAL** y **CANTIDAD** del filtro (sin canceladas) ·
**Excel** (CSV que Excel abre directo: UTF-8, separador `;`, coma decimal) · tabla con
Inventario, F. emisión, Proveedor, Estado, Documento (tipo + número), Pago (saldo y vencimiento),
Valor y Acciones (editar sustento/notas, ver, imprimir, eliminar si sigue pendiente).
Las facturas consultadas sin terminar aparecen arriba para continuarlas.

## 3. Crear compra (cabecera)
Inventario (almacén) · Documento · Proveedor (buscar "Nombre | ID: RUC" o **Crear**) ·
F. emisión · Forma de pago · F. vencimiento (editable; por defecto emisión + 15 días) ·
Est / Pto / N. documento · Autorización · Tipo registro · Sustento tributario (tabla 5 del ATS:
01–15 y 00; sugerido 06 para inventario, 01 para gastos, 03 para activos fijos).

- **FACTURA electrónica**: al completar los 49 dígitos de la autorización se consulta sola al SRI
  ("Espere: consultando en el SRI…" → "Completo: comprobante encontrado") y se llenan fecha,
  establecimiento, punto, número y proveedor. Botón **XML** para cargar el archivo del proveedor.
  Si el proveedor no existe, **Crear** abre su ficha ya llena con los datos de la factura.
  Si la factura ya se registró: **"Ya existe un registro con esta información"** + VER COMPRA.
  Si el SRI no responde: reintentar, cargar XML o ingreso manual (no verificado).
- **Continuar** (factura) → revisión: cada artículo va a un **producto existente** (sugerido por
  código), a un **producto nuevo** (en Mecánica o Colisiones/Pintura; el código interno lo asigna
  el sistema) o **no va al inventario** (fletes, servicios). Totales: Subtotal 15 %, Subtotal 0 %,
  Descuento, Impuesto, Total. Registrar suma al inventario en una sola transacción.
  Si el tipo de registro es Gastos/Activos fijos, los artículos se proponen como "no va al inventario".
- **NOTA DE VENTA / OTRO COMPROBANTE**: "Continuar" verifica que ese número no exista para el
  proveedor y pasa a cargar artículos (producto del inventario o texto libre, cantidad, costo, IVA
  15 % / 0 %; la nota de venta propone 0 %). Al registrar queda **recibida** y suma al inventario.
- **ORDEN DE COMPRA**: pedido al proveedor; suma al inventario cuando se marca "recibida".

## 4. Detalle e impresión
Detalle: documento, proveedor (ver datos), estado ("DOCUMENTO REGISTRADO"), filas y artículos,
tabla con precio (4 decimales), IVA y entrada al inventario (stock resultante + historial),
tarjetas **Proveedor**, **Pagos (F4)** e **Imprimir (F7)**, totales por tarifa y datos de la
compra (inventario, tipo de registro, sustento, vencimiento, pagado/saldo, usuario, autorización).
Las facturas del SRI conservan su PDF y XML. Impresión: hoja con documento, fecha, vence,
proveedor, inventario, tipo de registro, movimiento, usuario, registro y totales.

## 5. Base de datos (bloque "Sprint 26" de `migrations.sql`, aditivo)
`compras_proveedor`: `tipo_documento` (orden/factura/nota_venta/otro), `numero_documento`
(`001-001-000000123`), `area`, `tipo_registro` (inventario/gasto/activo_fijo),
`sustento_tributario`. `compras_proveedor_items.iva_porcentaje`. Índice único parcial
`uq_compras_documento` (empresa, proveedor, tipo, número; sin canceladas): un documento no se
registra dos veces. Las compras ya creadas desde facturas reciben su número, sustento 06 e IVA real.

## 6. Reglas
- Compra como **gasto o activo fijo**: no suma existencias.
- Al recibir, el costo del producto se actualiza con el último costo (como en las facturas del SRI).
- Vencimiento nunca anterior a la emisión. Editar después solo cambia sustento y notas
  (montos, artículos e inventario no se modifican).

## 7. API nueva / ampliada
`GET /api/proveedores/compras` (+ `q`, `area`, `tipo_documento`, `desde`, `hasta`, `resumen`) ·
`GET /compras/catalogos` · `GET /compras/documento?proveedor_id&tipo_documento&numero_documento` ·
`POST /compras` (+ documento, vencimiento, área, tipo de registro, sustento, IVA por item,
`recibir_ahora`) · `PUT /compras/:id` (sustento y notas) · `POST /facturas-compra/:id/confirmar`
(+ `fecha_vencimiento`, `area`, `tipo_registro`, `sustento_tributario`).

## 8. Pruebas
`PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest --runInBand` → 252/252 (incluye
`sprint26.crearCompra.integracion.test.js`, 8 pruebas). Frontend 53/53 y build con `CI=true`.
Prueba en el navegador con un SRI local: factura por clave → crear proveedor → revisión →
registro (3 entradas, 2 productos nuevos) → duplicado bloqueado → nota de venta → impresión (F7).

## 9. Producción (Supabase)
Correr `supabase_sprint26.sql` (requiere `supabase_sprint25.sql`). Aditivo e idempotente.
