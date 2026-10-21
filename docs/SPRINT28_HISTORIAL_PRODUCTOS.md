# Sprint 28 — Paginación del inventario e historial de productos

## 1. Paginación del inventario
- La barra de páginas debajo de la tabla de Inventario ahora **siempre se ve**
  (antes se ocultaba cuando había una sola página): muestra
  `Mostrando 1–15 de N · Página X de Y`, botones ‹ › y los números de página.
- Selector **Por página** (15, 25, 50, 100); se recuerda en el navegador.
- El contador y la tarjeta **Total Repuestos** usan el total real del servidor
  (antes contaban solo los de la página visible).
- Si se elimina el último producto de una página, se vuelve a la última página válida.

## 2. Historial de productos (Inventario › Historial de productos)
Ruta `/dashboard/historial-productos`. Lista cada producto creado, del más
reciente al más antiguo, con:
- **Origen**: *Creado a mano* (formulario de Inventario) o *Factura de proveedor*
  (al registrar una factura de compra del SRI con la acción "producto nuevo").
- Para facturas: número de factura, proveedor, cantidad ingresada y costo.
- **Creado por** (usuario), fecha y hora, inventario, categoría, stock actual,
  y enlace a sus movimientos. Los productos dados de baja también aparecen.
- Filtros: texto, origen, inventario, rango de fechas. Tarjetas de resumen por origen.
- Permiso: el mismo de ver inventario; cada usuario ve solo sus áreas.

Nota: las proformas no crean productos (solo descuentan stock); sus salidas
siguen en *Entradas y salidas*.

## 3. Base de datos
Columnas nuevas en `repuestos`: `origen_creacion` (`manual` | `factura_compra` | `importacion`)
y `creado_por` (usuario). Los productos existentes se clasifican solos: los que
nacieron de una factura quedan como `factura_compra` (con el usuario que la
registró) y el resto como `manual` (creador "Sin registro").

API: `GET /api/inventory/historial-creacion?q=&origen=&area=&fecha_inicio=&fecha_fin=&page=&limit=`.

## 4. Todo registro queda a nombre de quien lo creó
- `config/db.js` fija `app.usuario_id` (usuario de la sesión) en cada consulta,
  igual que `app.empresa_id`. La función `usuario_actual()` lo lee.
- Columna `creado_por` (por defecto `usuario_actual()`) en: clientes, vehículos,
  proveedores, contactos de proveedor, categorías, tipos de servicio, sucursales
  y cuentas de dinero. Las tablas que ya tenían usuario (proformas, órdenes,
  compras, gastos, movimientos, caja, cobros, pagos, comprobantes) toman el de
  la sesión si un INSERT lo omite.
- Se muestra "Registrado por …" en Clientes, Vehículos, Proveedores, Proformas,
  Compras e Historial de productos. Los registros anteriores a este cambio
  dicen "Registro anterior (sin usuario)"; los clientes que se registraron solos
  en la web dicen "Registrado desde la web".

## 5. Producción (Supabase)
Correr `supabase_sprint26.sql` (si aún no se corrió) y luego `docs/supabase_sprint28.sql` en el SQL Editor.
Aditivo e idempotente. Mientras no se corra, crear productos fallará con el
código nuevo, así que debe aplicarse antes de subir este cambio.
