# Sprint 24 — Identidad por empresa (logos y documentos) y coherencia de proveedores

## 1. Diagnóstico

### 1.1 Los "cuatro registros" de Proveedores › Historial financiero
No eran cuatro proveedores. Eran **cuatro movimientos de dinero de UNA sola compra (#1)
del mismo proveedor** (CIALBRA CIA. LTDA.). La base ya impedía dos proveedores con el
mismo RUC en una empresa (índice `uq_proveedores_ruc`) y ningún proceso crea proveedores
al consultar el historial o registrar pagos (verificado en código y en pruebas).

Secuencia que generó las filas (código anterior):

| Fila | Origen |
|---|---|
| `COMPRA` "Orden de compra #1" | automática al crear la compra |
| `PAGO` "Pago al contado compra #1" | automática (compra al contado) |
| `PAGO` "Pago al contado…" → **Anulado** | botón ⊘ del historial: anulaba **sin pedir confirmación** |
| `PAGO` "Pago compra a crédito #1" | pago registrado en el detalle de la compra; el texto decía "a crédito" aunque la compra era al contado |
| `CANCELACIÓN` "Compra #1 cancelada" | al cancelar la compra (la fila `COMPRA` pasó a Anulado) |

**Causa real de la inconsistencia:** se podía **cancelar una compra que tenía pagos
confirmados**. El pago siguió restando del banco y el resumen mostraba
"Total pagado $55.66" con "Total comprado $0.00". Además Finanzas y el Panel restaban la
cancelación **dos veces** (la compra ya quedaba anulada), lo que podía esconder deuda real
de otras compras del mismo proveedor.

### 1.2 Logo y documentos
- El cuadro del Dashboard mostraba una imagen fija (`assets/admin.png`).
- `empresas.logo_archivo` existía pero no había forma de subirlo (solo `asset:` del backend).
- Varias pantallas tenían "SS SWAP" escrito a mano; las órdenes de trabajo no tenían PDF;
  el RIDE tomaba el logo con `SELECT … FROM empresas LIMIT 1`.

## 2. Cambios

### Base de datos (bloque "Sprint 24" en `backend/src/config/migrations.sql`, aditivo)
- `GRANT UPDATE (logo_archivo) ON empresas TO ssswap_app` (RLS limita a la propia fila).
- `proformas.empresa_datos` y `ordenes_trabajo.empresa_datos` (JSONB) + trigger
  `copiar_datos_empresa`: al **crear** el documento la base copia nombre, razón social,
  RUC, dirección, contacto y logo de su empresa. La copia no se puede reescribir.
  Los documentos anteriores quedan con `NULL` y usan los datos actuales de su empresa.

### Backend
- `services/marcaEmpresa.js`: identidad del documento (copia histórica o datos actuales),
  URL del logo, datos de empresa para la sesión.
- Logo: `POST/DELETE /api/empresa/logo` (permiso `empresa:editar`) y
  `POST/DELETE /api/plataforma/empresas/:id/logo` (superadmin). Solo PNG/JPG reales
  (firma de bytes), máx. 2 MB, nombre aleatorio en `uploads/logos`; auditado.
  Los archivos anteriores no se borran (los usan documentos ya emitidos).
- Sesión (`/auth/login`, `/auth/me`): `empresa.logo_url` y `nombre_comercial`.
- PDF de orden de trabajo: `GET /api/ordenes/ordenes/:id/pdf` (empresa, cliente, vehículo,
  trabajo, "Registrada por", técnico, última modificación).
- Proforma PDF/Excel: dirección y contacto de la empresa cuando la sucursal no los tiene.
- RIDE: logo de la empresa dueña del comprobante, congelado al emitir.
- Proveedores: RUC normalizado y único por empresa con mensaje claro; mismo nombre sin RUC
  pide confirmación; eliminar = borrar si no tiene historial, desactivar si lo tiene.
- Compras/pagos: no se cancela una compra con pagos confirmados (409 `COMPRA_CON_PAGOS`);
  pagos con bloqueo de la compra (`FOR UPDATE`) para no superar el saldo; no se reconfirma
  un pago de compra cancelada; anulaciones registradas en la bitácora.
- Saldo con proveedores en una sola regla (`finanzas.service.saldoProveedoresSql`) usada
  por Proveedores, Finanzas y el Panel. El resumen avisa de pagos vigentes en compras
  canceladas (`pagos_en_compras_canceladas`).
- `middleware/idempotencia.middleware.js`: cabecera `Idempotency-Key` en los POST de
  Proveedores (un doble clic o reintento devuelve la misma respuesta sin crear otro registro).

### Frontend
- `components/common/MarcaEmpresa.jsx` (`LogoEmpresa`, `NombreEmpresa`) y
  `EditorLogo.jsx` (vista previa antes de guardar, validación, quitar).
- Dashboard (cuadro rojo), barra lateral y etiquetas de las páginas usan la empresa de la sesión.
- Configuración de la empresa y Plataforma › Empresas: subir/cambiar logo.
- Órdenes de trabajo: botón PDF.
- Proveedores: confirmaciones al eliminar, cancelar compra y anular pagos; aviso de pagos en
  compras canceladas; aclaración de que el historial son movimientos.

## 3. Pruebas
- `backend`: `npx jest` (114 unitarias) y `PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest --runInBand`
  (220 en total, incluida `sprint24.identidad.integracion.test.js`).
- `frontend`: `CI=true npx react-scripts test --watchAll=false` (53) y build con `CI=true`.

## 4. Pasos manuales (producción)
1. Respaldo en Supabase. Si aún no se corrió, `supabase_sprint23.sql`; luego
   `Downloads/ssswap/supabase_sprint24.sql`.
2. `Downloads/ssswap/supabase_diagnostico_proveedores.sql` (solo lectura) para revisar el
   pago de la compra #1 cancelada y decidir si se anula (solo si el dinero volvió o no salió).
3. Al publicar el backend, la carpeta `uploads/logos` debe ser persistente (igual que `uploads/perfiles`).

## 5. Reversión
El código anterior ignora las columnas nuevas. Para quitar solo el trigger:
`DROP TRIGGER trg_proformas_empresa_datos ON proformas; DROP TRIGGER trg_ordenes_empresa_datos ON ordenes_trabajo;`
(las columnas pueden quedarse; no afectan al código anterior).
