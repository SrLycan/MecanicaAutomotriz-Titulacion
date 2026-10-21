# Rendimiento del panel y la web pública (2026-10-18)

## Cómo se midió

- Copia de la base local (`ssswap_perf`, restaurada del respaldo
  `respaldos/antes_rendimiento_2026-10-18.dump`) con volumen de prueba:
  8 011 repuestos, 4 006 clientes, 5 006 proformas (25 042 ítems),
  30 012 movimientos de inventario y 2 002 pagarés.
- Entre el backend y PostgreSQL se puso un proxy que agrega **25 ms por
  sentido (50 ms ida y vuelta)**, parecido a Hostinger → Supabase. En local
  sin latencia todo parece rápido y no se ve el problema real.
- Se midieron las peticiones que hace el navegador al abrir cada página desde
  el menú (incluidas las alertas del menú lateral), 7 repeticiones, mediana.
  "Viajes" = consultas enviadas a PostgreSQL.

## Causas encontradas

1. **3 viajes a la base por cada consulta.** Para aislar cada empresa (RLS),
   `config/db.js` enviaba `BEGIN + empresa`, luego la consulta y luego
   `COMMIT`: tres idas y vueltas a Supabase por consulta. Era la causa
   principal en producción.
2. **Dashboard:** la serie de crecimiento hacía 5 subconsultas *por mes*
   (60 recorridos de tablas para 12 meses) y los saldos de caja y cuentas se
   pedían después, uno tras otro.
3. **Caja:** 5 consultas encadenadas (cada una esperaba a la anterior).
4. **Clientes:** se descargaban *todos* los clientes (1,5 MB con 4 000) y se
   pintaban todas las tarjetas; la búsqueda lanzaba una petición por tecla.
5. **Menú lateral:** las alertas de créditos y pagarés se volvían a pedir en
   *cada* cambio de página; el contador de stock bajo descargaba 15 productos
   para usar solo el total.
6. **Sin compresión** de respuestas.
7. **Imágenes sin optimizar en la web pública:** la portada descargaba
   ~6,5 MB (logo de 1,4 MB mostrado a 138 px, mascota de 2,3 MB mostrada a 52 px).
8. El bundle de JavaScript **ya** estaba dividido por rutas (lazy) y
   `recharts` va en su propio trozo: no hizo falta tocarlo.
9. Índices: ya había casi todos; faltaban tres de apoyo (ver abajo). Las
   consultas en sí tardan pocos milisegundos.

## Antes y después (50 ms de latencia a la base)

| Página | Antes | Después | Viajes antes → después | Datos antes → después |
|---|---|---|---|---|
| Inicio del panel | 287 ms (frío 728 ms) | 152 ms (frío 223 ms) | 16 → 8 | 55 KB → 2,6 KB |
| Dashboard | 1 221 ms | 279 ms | 75 → 23 | 55 KB → 1,8 KB |
| Inventario | 275 ms | 151 ms | 19 → 5 | 61 KB → 2,0 KB |
| Proformas | 276 ms | 151 ms | 15 → 3 | 54 KB → 0,6 KB |
| Caja | 1 009 ms | 260 ms | 34 → 10 | 50 KB → 1,3 KB |
| Clientes | 373 ms | 137 ms | 12 → 3 | 1,6 MB → 0,7 KB |

"Después" ya no incluye las alertas del menú si se consultaron hace menos de
30 s. Contando también esas alertas (mismas peticiones que antes): Dashboard
307 ms, Inventario 141 ms, Proformas 139 ms, Caja 246 ms, Clientes 139 ms.

Web pública (build de producción):

| | Antes | Después |
|---|---|---|
| Imágenes de la portada | ~6,5 MB | ~0,4 MB |
| `static/media` | 6,7 MB | 0,6 MB |
| `servicios/` | 5,4 MB | 1,1 MB |
| JavaScript | 2,0 MB (sin cambios) | 2,0 MB |

## Qué se cambió

**Backend**
- `config/db.js`: la consulta aislada se envía en **un solo viaje**
  (`BEGIN; set_config(...); consulta; COMMIT`). Los parámetros se insertan
  como literales con el mismo escape del driver (`escapeLiteral`) y solo fuera
  de textos, identificadores y comentarios. Ante cualquier caso dudoso
  (`E'...'`, `$$`, `/* */`, Buffers, bytes nulos) usa el camino anterior.
  Se puede desactivar con `DB_UN_VIAJE=false`. El RLS no cambia.
  Pool configurable con `DB_POOL_MAX` (por defecto 10).
- `server.js`: compresión gzip (`compression`) y 4 conexiones "calientes"
  en vez de 1 (`DB_POOL_CALIENTES`).
- `dashboard.controller.js`: serie de crecimiento con un recorrido por tabla;
  saldos en la misma tanda que el resto.
- `caja.controller.js`: saldo y sesión abierta en paralelo.
- `ordenes.controller.js`: `GET /ordenes/clientes` acepta `page`/`limit`
  (opcional; sin `page` devuelve la lista completa como antes, para los
  selectores) y devuelve los totales de la búsqueda.
- `proformas.controller.js`: desempate por `id` en el orden de la lista
  (paginación estable).

**Frontend**
- `Layout.jsx`: alertas como máximo cada 30 s al navegar; stock bajo pide 1 fila.
- `Clientes.jsx`: lista paginada (20 por página) y búsqueda con espera
  (una petición al dejar de escribir).
- Imágenes: logo y mascota reducidos (PNG con transparencia); fotos
  convertidas a JPEG (`colisiones`, `bannergrande`, y en `public/servicios`
  `alineacion`, `suspension`, `frenos`, `diagnostico`).

**Base de datos** (aditivo e idempotente; en `migrations.sql` y en
`docs/supabase_rendimiento.sql`): `idx_proformas_empresa_creada`,
`idx_usuarios_email_lower`, `idx_proforma_items_repuesto_pendiente`.

## Pruebas

- Backend: `npx jest` (unitarias) pasa; nueva prueba `config/__tests__/db.unViaje.test.js`
  (unitaria + integración: resultado, RLS y errores).
- Integración (`PG_INTEGRATION=1`) en una base de pruebas recién creada.
- Frontend: `react-scripts test` pasa; `react-scripts build` compila.
- Las respuestas de Dashboard, Caja, Clientes, Inventario, alertas y sesión son
  idénticas byte a byte a las de antes (comparadas sobre la misma copia).

## Pendiente en Supabase / producción

1. Correr `docs/supabase_rendimiento.sql` en el SQL Editor de Supabase.
2. Subir backend y frontend cuando corresponda (incluye `npm install`
   en el backend por la dependencia nueva `compression`).
3. Opcional: si el plan de Supabase lo permite, subir `DB_POOL_MAX`.
