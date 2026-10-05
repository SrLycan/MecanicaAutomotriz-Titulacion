# SS SWAP — Sprint 15: base de datos reforzada + menú lateral tipo acordeón

## 1. Base de datos (correr en Supabase)
Corre el bloque **"Sprint 15"** del final de `backend/src/config/migrations.sql`
(si no corriste el Sprint 14, corre ambos o el archivo completo; es idempotente).
Probado en una BD nueva y en una con datos anteriores, dos veces seguidas.

- **Catálogos nuevos** (un único significado para cada código):
  `cat_areas_inventario`, `cat_metodos_pago`, `cat_tipos_proforma`, `cat_origenes_movimiento`,
  con llaves foráneas desde repuestos, categorías, movimientos, proformas, pagos y gastos.
  Para crear un tercer inventario basta con insertar una fila en `cat_areas_inventario`.
- **Pagos anulables:** los pagos de clientes ya no se borran; se marcan como anulados
  (`anulado_at`, `anulado_por`, `motivo_anulacion`), siguen visibles y dejan de contar como pagado.
- **Número de OT dentro de la tabla:** `ordenes_trabajo.numero` = OT-000123 (columna generada, única).
- **Sin borrados en cascada de historial:** borrar un repuesto ya no borra sus movimientos
  y borrar una cuenta ya no borra sus pagos (RESTRICT). Clientes y vehículos con órdenes,
  proformas o pagarés no se pueden eliminar (mensaje claro en vez de error 500).
- Restricción "pagado ≤ monto", índices nuevos, vistas `v_movimientos_inventario_detalle`
  y `v_cuentas_cobrar_detalle`, y comentarios en cada tabla (se ven en Supabase).
- Endpoint nuevo `GET /api/catalogos`.

## 2. Menú lateral tipo acordeón
Secciones Panel, Inventario, Taller, Clientes, Proveedores, Usuarios, Gráficas y Ajustes.
Al hacer clic en una sección se despliega su submenú (solo una abierta a la vez) y cada
opción abre la página directo en esa vista, por ejemplo Usuarios → Técnicos,
Proveedores → Compras o Inventario → Colisiones / Pintura. La URL refleja la vista
(`?rol=`, `?tab=`, `?area=`), así que se puede recargar o compartir.

---

# SS SWAP — Sprint 14: Inventario desde proformas, 2 inventarios, Colisiones con pictograma, Pagaré automático 70% y pagos detallados

## 1. Base de datos (OBLIGATORIO antes de arrancar)
Corre en el SQL Editor de Supabase el bloque **"Sprint 14"** del final de
`backend/src/config/migrations.sql` (o el archivo completo: es idempotente).
Es 100% aditivo: no borra ni renombra nada. Probado sobre una BD vacía y sobre
una BD con datos del Sprint 13, dos veces seguidas.

Qué agrega:
- `repuestos.area` ('mecanica' | 'colisiones'; todo lo existente queda en Mecánica) + 6 categorías de colisiones.
- Stock y cantidades de movimientos pasan a `NUMERIC(10,2)` (litros parciales de pintura) + CHECK de stock no negativo.
- `movimientos_inventario`: `origen` (manual/compra/proforma/ajuste/devolucion), `area`, `proforma_id`, `proforma_item_id`, `orden_id`, `compra_id`, `precio_unitario` (histórico), `revertido_at`, `movimiento_revertido_id`. Los movimientos `COMPRA-n` existentes se reclasifican como `compra`.
- Índice UNIQUE que impide dos salidas activas del mismo ítem de proforma + trigger que impide borrar ítems que ya descontaron stock.
- `proformas`: `inventario_descontado_at/por`, `carroceria_tipo`, `carroceria_puertas`, `danos_observaciones`; tabla `proforma_zonas_danadas`.
- `cuentas_cobrar`: `vehiculo_id`, `monto_base`, `porcentaje`, `origen` + UNIQUE para no duplicar pagarés automáticos.
- `pagos_cliente`: banco, número de cuenta, tipo de cuenta, titular, comprobante, cheque, fecha del documento, datos de tarjeta.

## 2. Flujo nuevo
1. En la proforma, los ítems de Productos/Repuestos/Insumos se eligen del inventario (agrupado por Mecánica / Colisiones, con el stock visible).
2. Con la proforma **aprobada** o **convertida**, el botón **"Confirmar uso de materiales"** descuenta el stock y crea las salidas (en una sola transacción; no se puede repetir; si falta stock no descuenta nada).
3. Al convertir a OT se crea automáticamente el **pagaré del 70 %** del total (también al aprobar una proforma creada desde una OT).
4. Registros (antes "Movimientos") tiene filtros por tipo/origen, producto, fecha, usuario, proforma, OT e inventario.
5. Las proformas "Colisiones / Pintura" (el tipo `pintura` existente) tienen selector PICKUP / HATCHBACK / SEDAN / SUV y pictograma interactivo, que también aparece en la vista, el PDF y el Excel.
6. El administrador puede **"Devolver al inventario"** una salida (el historial se conserva).

## 3. Notas
- No hay dependencias npm nuevas.
- El `node_modules` del ZIP original venía de Windows; en Linux/CI usa `npm ci`.
- Pruebas de integración contra PostgreSQL real: `PG_INTEGRATION=1 DB_HOST=... DB_NAME=<bd_de_prueba> npx jest sprint14` (¡nunca contra producción!).
- La bitácora sigue en MongoDB: si `MONGO_URI` no está configurado (como en tu `.env` local), no se guarda nada en la bitácora, aunque inventario y pagos sí quedan en Postgres.

---

# SS SWAP — Auditoría de BD + Módulo "Pagaré" (entrega)

Reemplaza estos archivos en tu proyecto respetando las mismas rutas
(este ZIP ya tiene la misma estructura `backend/` / `frontend/`).

## Archivos NUEVOS (no existían antes)

Backend:
- backend/src/controllers/cuentasCobrar.controller.js
- backend/src/routes/cuentasCobrar.routes.js

Frontend:
- frontend/src/components/clientes/PagareTab.jsx

## Archivos MODIFICADOS (ya existían, ediciones aditivas)

- backend/src/config/migrations.sql →
  1) corrige `proformas.iva_porcentaje` (tenía `DEFAULT 15` por error;
     ahora `DEFAULT 0`, con un `ALTER TABLE` explícito para que la
     corrección aplique aunque ya hayas corrido el Sprint 12 antes).
  2) agrega el bloque **"Sprint 13"** al final: tablas `cuentas_cobrar`
     y `pagos_cliente`. Nada existente se tocó ni se borró.
- backend/src/server.js → 2 líneas (require + app.use de
  `/api/cuentas-cobrar`)
- frontend/src/pages/Clientes.jsx → se agregó una pestaña "Pagaré" junto
  a "Clientes" (tabs nuevos + import de `PagareTab` y del CSS compartido
  de Proveedores para los tabs). El listado/CRUD de clientes que ya
  tenías **no se tocó**: sigue siendo exactamente el mismo código, ahora
  solo envuelto en `tab === 'clientes' && (...)`.

## Pasos después de reemplazar los archivos

1. Corre el bloque **"Sprint 13"** de `migrations.sql` en el SQL Editor
   de tu Supabase (y la línea `ALTER TABLE proformas ALTER COLUMN
   iva_porcentaje SET DEFAULT 0;` que está justo antes, si no la habías
   corrido).
2. No hay dependencias npm nuevas — este módulo no necesitó ninguna.
3. Reinicia el backend y el frontend.
4. Entra como `administrador` o `recepcionista` → en "Clientes" vas a ver
   las pestañas **Clientes** y **Pagaré**.

## Cómo probarlo

1. En Clientes → pestaña Pagaré → "Nueva Cuenta".
2. Selecciona un cliente, escribe un concepto y un monto, guarda.
3. Verás la cuenta en la lista con su saldo en rojo.
4. Ábrela y registra un pago parcial — el saldo baja, el estado pasa a
   "parcial" automáticamente.
5. Registra el resto — pasa a "pagado" solo.
6. Prueba también cambiar el estado manualmente desde el selector de la
   lista (por ejemplo, a "vencido").

## Notas importantes

- **Permisos**: igual que la página de Clientes — administrador y
  recepcionista. Eliminar una cuenta queda solo para administrador, y
  además **no se puede eliminar una cuenta que ya tiene pagos
  registrados** (hay que anularla para no perder ese historial).
- **No se puede eliminar un cliente con una cuenta por cobrar
  registrada** (pagada o no) — a propósito, para que ese historial
  financiero nunca se pierda.
- **Pendiente anotado, no resuelto todavía**: `eliminarCliente` (función
  preexistente, no tocada en esta entrega) borra directo sin revisar si
  el cliente tiene vehículos u órdenes asociadas — si quieres que lo
  arregle en una próxima entrega, dímelo.
