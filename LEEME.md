> 📘 **¿Cómo se usa el programa?** Lee la guía paso a paso para el personal:
> [GUIA_DE_USO.md](GUIA_DE_USO.md) (registros, inventario, proformas, cobros, proveedores, caja y finanzas).
> Este archivo (LEEME) es el registro técnico de cambios para quien mantiene el sistema.

---

# SS SWAP — Sprint 21: Superadministrador y permisos personalizados

## 1. Base de datos (OBLIGATORIO antes de desplegar el código nuevo)
Corre el bloque **"Sprint 21"** del final de `backend/src/config/migrations.sql`
(aditivo e idempotente; con `RUN_MIGRATIONS=true` se aplica solo al arrancar).
Para Supabase está listo `Downloads/ssswap/supabase_sprint21.sql` (mismo bloque, en BEGIN/COMMIT).
**Sin esta migración el backend nuevo responde 500**: cada petición lee `usuario_permisos`.

- Roles nuevos `superadministrador` e `interno` (CHECK de `usuarios.rol`).
- `usuarios.token_version` (invalida sesiones), `permisos_inicializados`, `ultimo_acceso`.
- `permisos_catalogo` (módulo × acción) y `usuario_permisos` (permisos de cada cuenta).
- Las cuentas de personal existentes reciben **exactamente el acceso que ya tenían** (plantilla de su rol), una sola vez.
- `auditoria_seguridad`: registro de solo inserción (un trigger rechaza UPDATE/DELETE).
- Trigger `proteger_rol_superadmin`: nadie crea, promueve, degrada ni borra un superadministrador
  desde la aplicación; solo una sesión que active `ssswap.gestion_superadmin` (el script de servidor).

## 2. Primer superadministrador (solo desde el servidor)
No hay contraseñas por defecto ni forma de obtener el rol desde la web. Desde `backend/`:

```
npm run superadmin -- --promover --email dueno@ssswap.com           # cuenta de personal existente
npm run superadmin -- --crear --email dueno@ssswap.com --nombre "Nombre Apellido"   # cuenta nueva
npm run superadmin -- --listar
npm run superadmin -- --revocar --email persona@ssswap.com          # vuelve a administrador
```

`--crear` muestra una contraseña temporal UNA sola vez; se cambia en el panel desde
**Mi cuenta** (clic en el nombre, arriba a la derecha). Usa el `.env` de la BD a la que apunte
(para Supabase: correr en una máquina con el `.env` de producción). No hay variables de entorno nuevas.

## 3. Cómo funciona
- **Permisos por módulo y acción** (`backend/src/config/permisos.js`): ver, crear, editar, eliminar,
  exportar y aprobar, solo donde la operación existe. Inventario y proformas se separan por área/tipo
  (mecánica vs. colisiones/pintura) y el backend lee el área/tipo REAL del registro en la BD.
- **Backend**: `verificarToken` relee en cada petición la cuenta (activa, rol, `token_version`) y sus
  permisos; `requierePermiso` / `requiereAlguno` protegen cada endpoint. Revocar un permiso surte
  efecto en la siguiente petición; desactivar, cambiar rol o restablecer el acceso cierra las sesiones.
- **Gestión** (`/dashboard/usuarios`, solo superadmin): crear cuentas, editar, activar/desactivar,
  restablecer acceso (contraseña temporal), cerrar sesiones, permisos con plantillas e historial.
  `/dashboard/auditoria`: registro de seguridad (incluye accesos denegados).
- **Frontend**: menú, rutas, botones y dashboard según permisos; URL directa sin permiso →
  `/dashboard/acceso-denegado`. El personal con sesión que abre la web pública es llevado a su panel;
  clientes y visitantes usan la web igual que antes.
- El **administrador común** ya no gestiona usuarios (ni clientes del portal): eso es del superadmin.
- Agregar un módulo futuro: definirlo en `permisos.js`, protegerlo con `requierePermiso`, regenerar las
  filas con `node src/config/permisosSql.js` y copiarlas a la migración (la prueba `permisos.catalogo` lo exige).

## 4. Pruebas
- `npm test` (backend): unitarias del middleware y del catálogo.
- `PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest` (¡nunca contra producción!): incluye
  `sprint21.permisos.integracion` con peticiones HTTP reales (escenarios A–F).
- `CI=true npm test` (frontend): rutas protegidas, web pública y menú dinámico.

---

# SS SWAP — Sprint 19: compras a crédito/contado, alertas de vencimiento y cuadre de caja

## 1. Base de datos
Corre el bloque **"Sprint 19"** del final de `backend/src/config/migrations.sql`
(aditivo e idempotente). Con `RUN_MIGRATIONS=true` se aplica solo al arrancar; en
Supabase hay que correrlo a mano.

- `compras_proveedor.forma_pago` ('contado' | 'credito') y `fecha_vencimiento` (solicitud + 15 días).
- `caja_sesiones.denominaciones_apertura` / `denominaciones_cierre` (JSONB con el conteo de billetes y monedas).

## 2. Cambios
- Compra al contado: genera el pago en el momento (en efectivo sale de la caja).
- `GET /api/proveedores/compras/alertas-credito`: compras a crédito con saldo que vencen en ≤ 3 días;
  aviso en Proveedores, número en el menú y mensaje emergente al entrar.
- Pagos/abonos de una compra no pueden superar su saldo.
- Caja: apertura y cierre con conteo de billetes/monedas y "Reporte de cuadre"
  (efectivo + otros medios del día).
- Modo claro: bordes y sombras más marcados en todo el panel.

---

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
