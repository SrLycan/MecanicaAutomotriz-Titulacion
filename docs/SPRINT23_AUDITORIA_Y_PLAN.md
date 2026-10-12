# SS SWAP — Sprint 23: auditoría, plan y decisiones

Fecha: 2026-10-12 · Rama: `feature/facturacion-sri` (sale de `feature/multiempresa-seguridad`).

## 0. Respaldo previo (hecho antes de tocar nada)

| Qué | Dónde | Verificación |
|---|---|---|
| BD local completa + uploads | `respaldos/ssswap_20261012-203053_previo_migracion.*` (copia en `Downloads/ssswap/respaldos/pre-sri-2026-10-12/`) | `npm run respaldo:probar`: restaurado en base temporal, 43 tablas, 404 filas, 0 diferencias, 0 huérfanos |
| Código (todas las ramas y etiquetas) | `Downloads/ssswap/respaldos/pre-sri-2026-10-12/repo-completo.bundle` + etiqueta `respaldo-pre-sri-2026-10-12` | `git bundle verify` correcto |
| `.env` local | misma carpeta (`backend.env`; **no** está en git) | — |

Supabase (producción) **no** se respaldó desde aquí porque sus credenciales no están en este equipo.
Antes de correr la migración del Sprint 23 en Supabase hay que hacer ese respaldo (procedimiento en `RECUPERACION.md`).

## 1. Arquitectura actual (resumen)

- **Backend**: Node/Express 4 (`backend/src`), PostgreSQL (local o Supabase) con `pg`. MongoDB opcional (bitácora y chatbot).
  Rutas `/api/*` → controladores → `config/db.js`.
  Cada consulta de una empresa corre con el rol `ssswap_app` y `app.empresa_id`, con Row Level Security.
- **Frontend**: React 18 + react-router (CRA), páginas *lazy* en `/dashboard/*`.
  Menú y rutas filtrados por permisos `módulo:acción`.
- **Autenticación**: JWT Bearer (localStorage).
  En cada petición `verificarToken` relee la cuenta, el `token_version`, la empresa y los permisos.
  El login tiene límite por cuenta y por IP. Contraseñas con bcrypt.
- **Autorización**: `requierePermiso(modulo, accion)` en cada ruta; el tipo o área real se lee de la BD (proformas, inventario).
  El catálogo está en `config/permisos.js` y copiado en la migración (con prueba de consistencia).
- **Multiempresa** (Sprint 22): `empresas` + `empresa_id` en 32 tablas, RLS, llaves compuestas `(col, empresa_id)`.
  La empresa sale del usuario autenticado, nunca del navegador.
  El superadministrador ve otras empresas solo con un soporte auditado.
- **Auditoría**: `auditoria_seguridad`, de solo inserción mediante un trigger.
- **Respaldos**: `npm run respaldo` / `respaldo:probar` / `restaurar`, con cifrado opcional.

### Entidades del negocio relevantes para facturar

```
clientes ─┬─ vehiculos
          ├─ ordenes_trabajo (descripción libre, SIN ítems estructurados)
          └─ proformas ── proforma_items (producto/servicio | mano_obra/pintura/repuesto/insumo)
                │            └─ movimientos_inventario (salida al "confirmar uso" o al convertir en OT)
                ├─ orden_id / orden_generada_id → ordenes_trabajo
                └─ cuentas_cobrar (pagaré 70 % automático o manual) ── pagos_cliente (anulables)
caja_* / movimientos_dinero / cuentas_dinero (finanzas)
```

Reglas que la facturación **no** debe romper:
- El stock se descuenta **una sola vez**, al "Confirmar uso de materiales" o al convertir en OT.
  **Facturar no mueve inventario.**
- Los cobros son los pagos del pagaré (`pagos_cliente`). **Facturar no registra ingresos ni pagos.**
  La factura solo se enlaza a la proforma, la OT y la cuenta para los reportes.
- La OT no tiene ítems: se factura **a partir de la proforma** aprobada o convertida de esa OT.
- El IVA hoy es un `iva_porcentaje` libre por proforma (por defecto 0) con un descuento global.
  La factura usa los códigos oficiales de tarifa (Tabla 17) y reparte el descuento por línea.

## 2. Hallazgos de seguridad

| # | Hallazgo | Riesgo | Acción |
|---|---|---|---|
| S1 | Cambiar la contraseña ("Mi cuenta") **no cierra las demás sesiones**: un token robado sigue válido | Alto | **Corregido**: sube `token_version` y devuelve un token nuevo solo para la sesión actual |
| S2 | Mínimo de contraseña 6 en el registro y en "Mi cuenta"; 8 en las cuentas que crea el admin | Medio | **Corregido**: mínimo 8 para contraseñas nuevas (las existentes siguen funcionando) |
| S3 | `/uploads` público por nombre aleatorio (sin empresa) | Bajo | Pendiente documentado. Los XML y RIDE de facturas **no** van a `/uploads`: se sirven por endpoint autenticado y aislado por empresa |
| S4 | JWT en localStorage (expuesto si hubiera XSS) | Medio | Se mantiene, porque React escapa la salida y no hay `dangerouslySetInnerHTML` con datos de usuario. Los documentos legales se muestran como **texto**, nunca como HTML |
| S5 | Dependencias backend: `uuid` (vía exceljs, función no usada) y `node-forge` (verificación RSA, no se usa para verificar) | Bajo | Documentado. La firma se hace con `crypto` nativo; forge solo abre el `.p12` |
| S6 | `nodemailer` ≤ 10.0.5 con fallos altos; las versiones corregidas exigen Node ≥ 20 | Alto si se usara | Se usa 10.0.13 cargado **solo si hay SMTP configurado**. **Recomendación: Node 20 en Hostinger** (`@google/genai` ya lo exige) |
| S7 | Frontend: 109 avisos de `npm audit`, casi todos de `react-scripts` (herramientas de compilación) | Bajo en producción | Documentado: no se envían al navegador. Migrar a Vite es un trabajo aparte |
| S8 | Certificado `.p12` y su clave: nuevos secretos | Crítico | Cifrado AES-256-GCM en la BD con `SRI_CERT_KEY` (solo en el `.env` del servidor). Nunca vuelve al frontend ni aparece en logs, auditoría o respaldos en claro |

Verificado sin hallazgos nuevos: IDOR entre empresas (RLS + llaves compuestas + prueba Sprint 22), inyección SQL (consultas parametrizadas), límites de login, CORS por lista, cabeceras de seguridad, caídas por errores async, auditoría inmutable.
Sigue vigente lo pendiente para ti: cambiar las 4 contraseñas demo publicadas en el historial de GitHub.

## 3. Facturación electrónica — qué dice el SRI (fuentes oficiales descargadas hoy)

- **Ficha técnica Off-line v2.34** (27/07/2026) y XSD oficiales (factura 1.0.0–2.1.0 y nota de crédito 1.0.0–1.1.0, publicados en feb-2022).
  Se usan **factura 1.1.0** y **nota de crédito 1.1.0** (Anexo 3: hasta 6 decimales en cantidad y precio).
- **Servicios web SOAP** (gratuitos, oficiales):
  - Pruebas: `https://celcer.sri.gob.ec/comprobantes-electronicos-ws/{RecepcionComprobantesOffline|AutorizacionComprobantesOffline}?wsdl`
  - Producción: `https://cel.sri.gob.ec/...` (mismas rutas)
  - Consulta de validez (v2.31+): `ConsultaComprobante?wsdl`. Devuelve AUTORIZADO, NO AUTORIZADO, PENDIENTE DE ANULAR o ANULADO.
- **Flujo**:
  1. XML.
  2. Firma **XAdES-BES** (RSA-SHA1, `.p12`, ENVELOPED).
  3. `validarComprobante`, que devuelve RECIBIDA o DEVUELTA.
  4. Esperar un tiempo parametrizable.
  5. `autorizacionComprobante(claveAcceso)`, que devuelve AUTORIZADO, NO AUTORIZADO o en procesamiento (hasta 24 h).
- **Clave de acceso** de 49 dígitos, compuesta así: fecha, tipo, RUC, ambiente, serie, secuencial, código numérico, tipo de emisión 1 y dígito módulo 11.
  Si sale 11 el dígito es 0; si sale 10, es 1.
- **Reglas de reintento**:
  - Un comprobante rechazado se corrige y se reenvía con la **misma clave y el mismo secuencial**.
  - Error **70** (en procesamiento): **no** se reenvía ni se genera otra clave; solo se consulta.
  - Errores **43/45** (clave o secuencial ya registrados): se consulta el estado, nunca se reemite.
- **Anulación de facturas**: **no hay servicio web**. Se solicita en el portal SRI en Línea dentro de 90 días, o en las oficinas después de ese plazo.
  El sistema registra la solicitud y verifica el estado con `ConsultaComprobante`.
  Para corregir valores se usa una **nota de crédito** (cod. 04).
- **Consumidor final** (9999999999999): solo hasta USD 50; por encima, el comprador debe estar identificado.
- **Anexo 26** (v2.34): quien use un sistema de **terceros** listado en la resolución 2718 debe incluir "RUC Proveedor" en la información adicional.
  SS SWAP usa sistema propio, así que el campo queda **configurable y vacío por defecto**.
- **Consulta de RUC o cédula**: la ficha **no** publica un servicio oficial de consulta de datos de contribuyentes.
  Se valida el formato (cédula módulo 10; estructura de RUC) y una persona autorizada confirma los datos.
  **No se usan endpoints internos del portal web.**
- **Costos reales** (no de API): certificado de firma electrónica (`.p12`) de un proveedor acreditado, servidor y mantenimiento.
  Los servicios del SRI no cobran.

## 4. Plan de implementación (archivos, migraciones, riesgos y pruebas)

| Fase | Contenido | Archivos principales |
|---|---|---|
| 3 Seguridad | S1, S2. Las tablas nuevas entran al registro multiempresa (RLS + llaves compuestas) | `users.controller.js`, `auth.controller.js`, `config/multiempresa.js` |
| 4 Legal | Documentos versionados (de plataforma y de empresa), publicación inmutable con hash, aceptaciones de solo inserción, re-aceptación por cambios materiales, notificaciones, constancia PDF, panel, aceptación en el registro de clientes y en la contratación de la empresa | `legal.*`, `pages/Legal*.jsx` |
| 5 SRI | Configuración tributaria, puntos de emisión, certificado cifrado, clave de acceso, XML 1.1.0, validación XSD local, firma XAdES-BES, cliente SOAP, estados, reintentos sin duplicados, RIDE con código de barras, correo, NC, registro de anulación | `src/sri/*`, `facturacion.*`, `pages/Facturacion*.jsx` |
| 6 Integración | Factura desde una proforma aprobada o convertida (o desde una OT por su proforma); datos tributarios del cliente; enlace con el pagaré; reportes que distinguen facturado, cobrado y saldo | `proformas`, `clientes`, `estadisticas` |
| 7 Pruebas/docs | Unitarias (clave, módulo 11, cédula/RUC, XML vs XSD, firma verificable, transiciones) + integración en `ssswap_test` + prueba de transporte real contra **celcer (pruebas)** | `__tests__`, `LEEME.md`, guías |

**Migración Sprint 23**: aditiva e idempotente al final de `migrations.sql`, más `Downloads/ssswap/supabase_sprint23.sql`.
No borra ni modifica datos existentes; solo agrega columnas opcionales a `clientes`.

**Riesgos principales**:
- Firmas rechazadas por la canonicalización. Se mitiga generando XML sin espacios, C14N con xml-crypto y verificación local de la firma.
- Concurrencia en secuenciales. Se mitiga con un contador por empresa, ambiente, punto y tipo, con bloqueo de fila.
- Reenvíos duplicados. Se mitiga con estados, `idempotency_key` y reconciliación por consulta.
- Despliegue en Node 18. Se mitiga con la recomendación de Node 20.

## 5. Datos que solo puede dar el dueño del emisor (no se inventan)

1. RUC, razón social, nombre comercial, dirección matriz, régimen (General / RIMPE) y si está obligado a llevar contabilidad o es contribuyente especial / agente de retención.
2. Código de establecimiento y de punto de emisión **habilitados en el SRI** y el último secuencial usado (si ya facturó electrónicamente).
3. Certificado de firma `.p12` vigente y su clave. **Se cargan en el sistema, nunca por chat.**
4. Confirmación de que el RUC está habilitado para emitir electrónicamente (portal SRI en Línea → Consulta de emisores autorizados).
5. Servidor SMTP (correo, usuario y clave) para enviar los comprobantes, como variables de entorno.
6. Revisión por un abogado ecuatoriano de los borradores legales (marcados como **BORRADOR — requiere revisión profesional**).
7. El video y el PDF de referencia mencionados en la solicitud **no llegaron** a este equipo. El diseño se basa en la ficha técnica oficial (Anexo 2, RIDE).
