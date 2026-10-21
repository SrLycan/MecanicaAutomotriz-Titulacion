# Sprint 27 — Auditoría de módulos, unificación y centro de ayuda contextual

Auditoría hecha sobre el código real (frontend React 18 + backend Express + PostgreSQL con RLS
multiempresa), siguiendo cada pantalla hasta sus endpoints (`api.get/post/...`), controladores y
tablas. Roles: superadministrador (plataforma), administrador, recepcionista, técnico y personal
"interno" con permisos a medida (`backend/src/config/permisos.js`, plantillas por rol). Cada ruta
del panel exige su permiso en el frontend (`App.jsx › RUTAS_PANEL` + `ProtectedRoute`) **y** en el
backend (`permisoPorMetodo` / `exigirPermiso` por módulo).

## 1. Inventario de módulos (antes de los cambios)

| # | Sección (ruta) | Objetivo | Operaciones | Datos / endpoints | Depende de | Permiso | Similar a | Riesgo de unificar |
|---|---|---|---|---|---|---|---|---|
| 1 | Panel (`/dashboard`) | Resumen del día | Indicadores, atención, gráfico 6/12 meses, accesos rápidos | `GET /dashboard` | Todos | dashboard:ver | Gráficas, Finanzas › Resumen | Bajo (solo lectura) |
| 2 | Inventario (`/inventario`, `?area=colisiones`) | Catálogo y stock por área | Crear/editar/eliminar/activar producto, categorías, movimiento rápido, exportar CSV, acciones en lote, venta en tienda | `/inventory/repuestos`, `/inventory/categorias`, `POST /inventory/movimientos` | Proformas, Compras | inventario_<area>:* | Registrar movimiento (misma operación) | Medio |
| 3 | Registrar movimiento (`/registrar`) | Entrada/salida manual paso a paso | Buscar producto → tipo, cantidad, motivo → confirmar | `GET /inventory/repuestos`, `POST /inventory/movimientos` | Inventario | registros_inventario:crear | **Modal de movimiento de Inventario** y Registros | Bajo (mismo endpoint) |
| 4 | Registros (`/movimientos`) | Historial de entradas/salidas | Filtros (producto, tipo, área, usuario, proforma, OT, fechas), CSV | `GET /inventory/movimientos` | Inventario, Proformas, Compras | registros_inventario:ver | Registrar movimiento | Bajo |
| 5 | Pedidos de la tienda (`/pedidos`) | Solicitudes del sitio público | Ver, cambiar estado | `/solicitudes` | Sitio público | pedidos_tienda:* | — | — |
| 6 | Órdenes de trabajo (`/ordenes`) | Trabajo del taller | Crear OT (con cliente/vehículo rápido), asignar técnico, progreso, PDF | `/ordenes/ordenes`, `/ordenes/clientes`, `/ordenes/vehiculos`, `/users/tecnicos` | Clientes, Vehículos, Proformas | ordenes:* | Clientes/Vehículos (alta rápida) | Alto (flujo central): se conserva |
| 7 | Proformas (`/proformas`, `/nueva`, `/:id`, `/:id/editar`) | Cotizaciones mecánica/colisiones | Crear, editar, aprobar, descontar inventario, PDF, pictograma | `/proformas`, `/servicios`, `/inventory/repuestos` | Inventario, Clientes, Facturación | proformas_<area>:* | — | Alto: se conserva |
| 8 | Citas (`/citas`) | Agenda del sitio público | Filtrar, confirmar/reprogramar/cancelar | `/citas` | Portal | citas:* | — | — |
| 9 | Clientes (`/clientes`, `?tab=pagare`) | Clientes del taller y cartera | CRUD clientes; pagarés (cobros, abonos) | `/ordenes/clientes`, `/cuentas-cobrar` | OT, Proformas, Finanzas | clientes:*, cuentas_cobrar:* | Usuarios › clientes del portal (son **cuentas de acceso**, otra entidad) | Medio |
| 10 | Vehículos (`/vehiculos`) | Vehículos de clientes | CRUD, historial de OT | `/ordenes/vehiculos` | Clientes, OT | vehiculos:* | — | — |
| 11 | Proveedores (`/proveedores` + tabs) | Proveedores, compras, gastos, pagos | CRUD proveedores/contactos; compras (Sprint 26); gastos; historial financiero | `/proveedores/*` | Inventario, Finanzas | proveedores:* | Finanzas › Movimientos (vista general del dinero) | Medio |
| 12 | Finanzas (`/finanzas` + tabs) | ¿Cuánto hay? | Resumen, movimientos, nómina, cuentas, transferencias | `/finanzas/*` | Caja, Proveedores, Pagarés | finanzas:* | Proveedores › Historial, Gráficas | Medio |
| 13 | Caja diaria (`/caja`) | Apertura/cierre de caja | Abrir con conteo, movimientos, cerrar | `/caja/*` | Finanzas | caja:* | — | — |
| 14 | Facturación SRI (`/facturacion`, `/nueva`, `/config`, `/:id`) | Comprobantes electrónicos | Emitir/enviar/anular, notas de crédito, configuración y certificado | `/facturacion/*` | Proformas, Clientes | facturacion*:* | Configuración de la empresa (datos del emisor) | Medio |
| 15 | Gráficas (`/graficas` + 4 tabs) | Estadísticas | Productos, servicios, proformas, crecimiento | `/estadisticas/*` | Proformas, OT | estadisticas:ver | Panel (gráfico), Finanzas › Resumen | Bajo |
| 16 | Servicios del taller (`/servicios`) | Catálogo de mano de obra | CRUD, activar | `/servicios` | Proformas, sitio público | servicios:* | — | — |
| 17 | Sucursales (`/sucursales`) | Sedes | CRUD | `/sucursales` | Proformas (encabezado) | sucursales:* | — | — |
| 18 | Bitácora (`/bitacora`) | Historial operativo | Conversaciones del chatbot, historial de OT, otras acciones | `/chatbot/conversaciones`, `/ordenes/ordenes/historial/general` | Mongo (bitácora) | bitacora:ver | Auditoría (seguridad) | Bajo: otra fuente de datos |
| 19 | Usuarios (`/usuarios`, `?rol=`) | Cuentas y permisos | Crear, permisos, cuenta/acceso, historial; filtro por rol | `/users/*` | Auth | usuarios:* | Clientes (otra entidad) | Bajo |
| 20 | Auditoría (`/auditoria`) | Registro de seguridad | Filtros, paginación | `/auditoria` | Auth | auditoria:ver | Bitácora, Auditoría global | Bajo |
| 21 | Configuración de la empresa (`/empresa`) | Datos y logo | Editar | `/empresa` | Documentos | empresa:* | Config. tributaria | — |
| 22 | Documentos legales (`/legal`) / Contratación (`/contratacion`) | Términos y aceptaciones | Versiones, aceptar | `/legal/*` | Portal | legal:*, empresa:editar | Plataforma › Documentos | — |
| 23 | Plataforma (5 páginas) | Superadministrador | Empresas, soporte, auditoría global, respaldos, migraciones/errores, contratos | `/plataforma/*`, `/legal/plataforma/*` | — | soloSuperadmin | — | — |

## 2. Duplicaciones y problemas de navegación encontrados

1. **Registrar movimiento (página) + modal de movimiento (Inventario) + Registros**: la misma operación
   (`POST /inventory/movimientos`) desde dos pantallas, y su historial en una tercera, cada una con su
   propia entrada de menú.
2. **Menú con atajos que repiten filtros o pestañas de una misma página**: Usuarios (3 entradas → la
   página ya tiene filtro de rol), Gráficas (4 entradas → 4 pestañas), Finanzas (4 → pestañas),
   Proveedores (Gastos, Pagos/Historial → pestañas), Facturación › Configuración tributaria (la página
   de Facturación ya tiene el botón CONFIGURACIÓN). 46 opciones en total.
3. **Configuración dispersa**: empresa y documentos legales en "Mi empresa", sucursales y servicios en
   "Ajustes", configuración tributaria en "Facturación".
4. **Registros de actividad separados sin criterio**: Bitácora en "Ajustes", Auditoría en "Mi empresa".
5. Sin ayuda contextual en ninguna sección.

**Se mantienen separados (no son duplicados):** Clientes ≠ cuentas del portal (Usuarios); Proveedores
› Historial (por proveedor, con acciones) ≠ Finanzas › Movimientos (todo el dinero); Bitácora (operación)
≠ Auditoría (seguridad, otra tabla); alta rápida de cliente/vehículo dentro de una OT (evita salir de la
orden); Panel ≠ Gráficas (resumen vs análisis).

## 3. Plan aplicado

| Cambio | Cómo se conserva cada función |
|---|---|
| "Entradas y salidas" = Registros + Registrar en **una página con pestañas** (`/movimientos?tab=historial|registrar`) | Mismo formulario y endpoint; `/dashboard/registrar` redirige; cada pestaña exige su permiso (ver / crear) |
| Menú: una entrada por página; las pestañas internas cubren las subsecciones | Las pestañas y los `?tab=` siguen funcionando (enlaces viejos válidos) |
| Grupo **Configuración** (empresa, sucursales, servicios, tributaria, legales, contratación) | Mismas rutas y permisos |
| Grupo **Usuarios y seguridad** (usuarios, auditoría, bitácora) | Mismas rutas y permisos |
| **Centro de ayuda contextual** (botón ? en el encabezado de cada sección) | No toca la lógica; guías en JSON separados |
