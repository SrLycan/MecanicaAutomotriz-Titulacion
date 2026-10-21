# Sprint 29 — Caja completa (control de cajas)

Tomando como referencia el "Control de Cajas" de otro sistema (video y PDF de
cierre que envió el usuario), la Caja diaria ahora tiene dos pestañas:
**Caja actual** y **Control de cajas**.

## 1. Apertura de caja
- Se elige la **sucursal** (por defecto la principal) y el **cajero** responsable,
  que puede ser distinto de quien abre. Solo aparecen cuentas activas de la
  misma empresa con permiso de caja (`caja:crear` o `caja:aprobar`).
- El saldo inicial se cuenta por billetes y monedas o se escribe a mano (como antes).

## 2. Durante la caja
- Barra con el número de caja, cajero, sucursal y hora de apertura.
- **Anular** entradas/salidas manuales con motivo (permiso nuevo `caja:eliminar`).
  No se borran: quedan tachadas en el reporte con quién y por qué se anularon,
  y dejan de contar en el efectivo.
- Botón **Ver reporte** con el reporte preliminar de la caja abierta.

## 3. Cierre de caja
- Efectivo: apertura + entradas − salidas = esperado, contra el conteo de
  billetes y monedas (efectivo entregado). La diferencia se registra como
  ajuste (igual que antes).
- **Declaración del cajero por forma de pago**: cheques, transferencias,
  tarjeta de crédito, tarjeta de débito y otros, cada una con lo que dice el
  sistema y la diferencia. Las diferencias en estas formas quedan en el
  reporte pero no generan ajuste (no es dinero de la caja).
- **Retenciones recibidas** (fuente e IVA): se declaran como documentos del
  cliente; son informativas porque el sistema aún no registra retenciones de venta.
- Al cerrar se guarda una copia de los totales del sistema (`resumen_cierre`)
  y lo declarado (`declaracion_cierre`): el reporte de una caja cerrada no
  cambia aunque después se anule algo.

### 3.1 Resumen completo al cerrar (mejora pedida con la imagen del cierre)
La ventana de cierre tiene dos partes: **1 · Resumen de la caja** y **2 · Cuadre y conteo**.
El resumen muestra lo mismo que después sale en el PDF:
- **Apertura**: con cuánto se abrió, quién y cómo (billetes y monedas contados,
  o monto escrito a mano). En el reporte de una caja cerrada se ve el conteo
  de apertura junto al conteo del cierre, billete por billete.
- **Ingresos del sistema (pagos + anticipos)** por forma de pago, con la fila
  **Crédito (por cobrar)** siempre visible (aunque sea $0.00).
- **Por cobrar**: cada venta de esta caja que todavía tiene saldo (total,
  abonado y por cobrar). Incluye las **proformas aprobadas o convertidas en
  orden que todavía no tienen pagaré ni pagos** (antes no aparecían).
- **Movimientos manuales** con la columna **Tipo: INGRESO / EGRESO / ANULADO**.
- **Ingresos y egresos del periodo** por forma de pago (efectivo,
  transferencias, tarjetas...) y, en el reporte y el PDF, el detalle de cada
  ingreso o egreso (cobros, pagos a proveedores, gastos, sueldos, caja).
- En "Caja actual" cada movimiento lleva su etiqueta INGRESO / EGRESO.

Para saber cuándo se aprobó una proforma se agregó `proformas.aprobada_at`
(la pone la base al pasar a aprobada/convertida; vuelve a NULL si deja de
estar aprobada). Una venta que nace de una proforma cuenta en la caja donde
se aprobó; si el pagaré se crea después, sus cobros en otra caja salen como
recaudación (no se cuenta dos veces).

## 4. Control de cajas
- Todas las cajas (abiertas y cerradas): #, sucursal, cajero, apertura,
  cierre, estado, inicial, esperado, contado y diferencia
  (**Sobrante** en ámbar, **Faltante** en rojo, **Cuadra** en verde).
- Buscador (#, cajero, sucursal, notas), filtros por estado, cajero y fechas,
  paginación de 20 y botón **Excel** con los filtros aplicados.
- Acciones por fila: **ver reporte**, **descargar PDF**, **imprimir** y
  **reabrir** (solo la última caja cerrada y con el permiso nuevo `caja:reabrir`).

## 5. Reporte de caja (pantalla y PDF)
- Cierre final (efectivo) e ingresos del sistema (cobros + anticipos por forma
  de pago y lo que quedó por cobrar).
- Cuadre por forma de pago (sistema contra cajero) y retenciones declaradas.
- Resumen por documentos (factura, pagaré, nota de crédito) y por vendedor.
- Movimientos manuales (con los anulados marcados).
- Ventas de la caja: pagarés creados durante la caja (con su factura SRI si
  existe) y facturas/notas de crédito emitidas sin pagaré.
- Ventas 100 % a crédito (sin abono), recaudaciones (cobros de deudas creadas
  antes de abrir la caja), anticipos de clientes (Finanzas › categoría
  "Anticipos de clientes") y reaperturas.
- PDF A4 con logo y datos de la empresa, firmas "Aprobado por" y
  "Cajero / Entregado". Una caja abierta sale con la marca **PRELIMINAR**.

## 6. Reabrir una caja
Solo la **última** caja y si no hay otra abierta. Pide motivo, anula el ajuste
del cierre (el saldo de caja vuelve a lo que dice el sistema), guarda el cierre
anterior en el historial de reaperturas y queda en la auditoría.

## 7. Base de datos
- `caja_sesiones`: `cajero_id`, `declaracion_cierre`, `resumen_cierre`,
  `ajuste_cierre_id`, `reaperturas`. Las cajas anteriores toman como cajero a
  quien las abrió.
- `caja_movimientos`: `anulado_at`, `anulado_por`, `motivo_anulacion`.
- `v_flujo_dinero` deja fuera los movimientos de caja anulados.
- Permisos nuevos `caja:eliminar` y `caja:reabrir`: los reciben los
  administradores existentes (una vez) y la plantilla de administrador.

API (`/api/caja`): `GET /opciones`, `GET /sesiones`, `GET /sesiones/excel`,
`GET /sesiones/:id/reporte`, `GET /sesiones/:id/pdf` (`?ver=1` para imprimir),
`POST /sesiones/:id/reabrir`, `POST /movimientos/:id/anular`; `POST /apertura`
acepta `cajero_id` y `sucursal_id`; `POST /cierre` acepta `declaracion`.

## 8. Pruebas
`PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest sprint29` (6 pruebas: cajero de
otra empresa rechazado, cierre con declaración, reporte completo, PDF/Excel/
listado aislados por empresa, reapertura y recaudaciones en la caja siguiente).

## 9. Producción (Supabase)
Correr `docs/supabase_sprint29.sql` en el SQL Editor (aditivo e idempotente,
probado dos veces seguidas sobre una copia de la base). Debe aplicarse antes de
subir este código: sin las columnas nuevas, abrir y cerrar caja fallan.
