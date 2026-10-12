# SS SWAP — Sprint 23: guías, pruebas y pendientes

Complementa [SPRINT23_AUDITORIA_Y_PLAN.md](SPRINT23_AUDITORIA_Y_PLAN.md) (diagnóstico, arquitectura, hallazgos y fuentes del SRI).

---

## 1. Qué se entregó

### Módulos nuevos

| Módulo | Backend | Frontend |
|---|---|---|
| Facturación electrónica SRI | `src/sri/*` (catálogos, identificación, clave de acceso, cálculos, XML, XSD, firma XAdES-BES, SOAP, custodia del certificado, RIDE, correo), `services/facturacion.service.js`, `controllers/facturacion.controller.js`, `routes/facturacion.routes.js` | `pages/facturacion/*` (panel, editor, detalle, configuración) |
| Documentos legales y contratación | `services/legal.service.js`, `controllers/legal.controller.js`, `routes/legal.routes.js`, `legal/plantillas/*.md` | `pages/legal/*`, `pages/plataforma/LegalPlataforma.jsx`, `components/legal/*` |
| Portal del cliente | `GET /api/panel/facturas` (+ `/ride`, `/xml`), aceptaciones | `components/portal/PortalFacturasLegal.jsx` |

### Módulos modificados

- **Registro de clientes**: aceptación expresa por documento, guardada en la misma transacción.
- **Contraseñas**:
  - cambiarla cierra las demás sesiones;
  - las contraseñas nuevas exigen un mínimo de 8 caracteres.
- **Clientes**: tipo de identificación SRI, con validación de formato.
- **Proformas y OT**: botón "Facturar (SRI)".
- **Menú**: grupo Facturación SRI, Documentos legales, Contratación y Plataforma › Documentos y contratos.

---

## 2. Migración de base de datos

- **Archivo**: bloque "Sprint 23" al final de `backend/src/config/migrations.sql`.
- **Para Supabase**: `Downloads/ssswap/supabase_sprint23.sql`, el mismo bloque dentro de `BEGIN/COMMIT`.
- **Es aditivo**: crea tablas nuevas y agrega 3 columnas opcionales a `clientes`. No borra ni cambia datos.
- **Pruebas realizadas**:
  - `ssswap_test`: 3 corridas seguidas.
  - Copia restaurada del respaldo de hoy: 2 corridas seguidas, con los mismos conteos antes y después.
  - BD local real: aplicada; conteos iguales (6 clientes, 6 proformas, 1 OT, 4 pagos, 11 repuestos, 5 usuarios).
- **Tablas**:
  - `sri_configuracion`, `sri_puntos_emision`;
  - `comprobantes_electronicos`, `comprobante_detalles`, `comprobante_eventos`;
  - `documentos_legales`, `documento_legal_versiones`, `aceptaciones_legales`, `notificaciones_legales`;
  - `contratos_empresa`, `plataforma_proveedor`.
- **Integridad garantizada por la base de datos (triggers)**:
  - Un comprobante autorizado no se edita ni se borra.
  - La clave y el número no cambian.
  - Una versión legal publicada es inmutable y su hash SHA-256 lo calcula la BD.
  - Las aceptaciones y los eventos son de solo inserción.
  - Las condiciones de un contrato aceptado no cambian.
- **Aislamiento**: todas las tablas nuevas tienen RLS y llaves compuestas por empresa, generadas desde `config/multiempresa.js`.

---

## 3. Variables de entorno nuevas

Documentadas, sin valores reales, en `backend/.env.example`.

| Variable | Obligatoria | Uso |
|---|---|---|
| `SRI_CERT_KEY` | **Sí, para facturar** | Llave (≥ 32 caracteres aleatorios) que cifra el `.p12` y su clave. Guárdela también fuera del servidor: si se pierde, hay que volver a cargar el certificado. |
| `SRI_WS_PRUEBAS` / `SRI_WS_PRODUCCION` | No | Direcciones de los servicios del SRI. Por defecto, las de la ficha v2.34. |
| `SRI_TIMEOUT_MS` | No | Espera máxima por respuesta del SRI (30000). |
| `SRI_TAREA_AUTOMATICA` | No | `false` desactiva la consulta y el reintento automáticos cada minuto. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | No | Envío del XML y el RIDE por correo. Sin esto, se descargan desde el panel. |

**Node**: se recomienda **Node 20** en Hostinger. `@google/genai` ya lo exige, y las versiones de `nodemailer` sin vulnerabilidades conocidas también.

---

## 4. Instalación y despliegue

1. **Respaldar Supabase** antes de cualquier cambio (ver `RECUPERACION.md`).
2. En el SQL Editor de Supabase, ejecutar `supabase_sprint23.sql`. Debe terminar sin errores.
3. En Hostinger (backend):
   - agregar la variable `SRI_CERT_KEY` con un valor nuevo y aleatorio (no reutilizar el local);
   - opcional: agregar las variables `SMTP_*`;
   - cambiar la versión de Node a 20.x;
   - subir el ZIP nuevo.
4. Subir el frontend, como siempre.
5. Entrar al panel y revisar **Facturación SRI › Configuración tributaria**, sección Estado.

---

## 5. Guía: configuración tributaria y firma electrónica

1. **Datos del emisor**:
   - RUC, razón social, nombre comercial y dirección matriz, **exactamente como constan en el SRI**;
   - régimen (General, RIMPE Emprendedor o RIMPE Negocio Popular);
   - si está obligado a llevar contabilidad;
   - contribuyente especial y agente de retención, solo si aplica.
2. **Anexo 26 (RUC proveedor)**: dejarlo **vacío** si se usa este sistema propio. Solo se llena si se factura con un sistema de un tercero listado en la resolución del SRI.
3. **Puntos de emisión**:
   - registrar el establecimiento y el punto **habilitados** para el RUC (p. ej. 001-001);
   - si ya emitía comprobantes electrónicos con otro sistema, en **Numeración** indique el último número usado. Solo puede avanzar.
4. **Certificado**: cargar el `.p12` y su clave. El sistema:
   - lo abre en memoria y comprueba la clave y la vigencia;
   - avisa si el RUC del certificado no coincide con el del emisor;
   - lo guarda cifrado.

   Nunca vuelve a mostrarse.
5. **Renovación**: la pantalla avisa cuando faltan menos de 30 días para el vencimiento. Para renovar, se carga el nuevo `.p12` con el mismo botón.

**Nunca** comparta la clave del certificado por chat ni por correo.

---

## 6. Guía: ambiente de pruebas del SRI

1. Mientras la configuración esté en **PRUEBAS**:
   - todos los comprobantes se envían a `celcer.sri.gob.ec`;
   - el RIDE lleva la marca "PRUEBAS – SIN VALIDEZ";
   - no tienen validez tributaria.
2. Emita varias facturas de prueba desde proformas aprobadas. Use datos ficticios del comprador: la ficha permite "PRUEBAS SERVICIO DE RENTAS INTERNAS".
3. Resultados posibles:
   - **AUTORIZADA**: la prueba es correcta.
   - **Devuelta / No autorizada**: lea el mensaje del SRI en el detalle, corrija con "Corregir datos" y "Reenviar". Se conservan el número y la clave, como exige el SRI.
   - **En procesamiento / Sin respuesta**: el sistema consulta solo cada pocos minutos. Nunca emite otro número; también puede pulsar "Consultar en el SRI ahora".
4. Pruebe también una **nota de crédito** sobre una factura autorizada.

**Prueba de conexión realizada el 2026-10-12**: se envió una factura firmada con un certificado y un RUC ficticios. El SRI respondió `DEVUELTA` con el error 35: *"No existe un contribuyente registrado con el RUC 1790000000001"*. Esto confirma la comunicación real, el formato SOAP y la lectura de la respuesta. **La autorización real todavía no se ha probado**, porque falta el RUC habilitado y el certificado de SS SWAP.

---

## 7. Lista de verificación antes de activar PRODUCCIÓN

- [ ] El RUC aparece **habilitado** como emisor electrónico en SRI en Línea (Consulta de emisores autorizados).
- [ ] Los datos del emisor coinciden con el RUC: razón social, dirección matriz y régimen.
- [ ] El establecimiento y el punto de emisión son los habilitados.
- [ ] El certificado `.p12` es vigente y pertenece al emisor (o a su representante legal autorizado).
- [ ] Al menos una factura **AUTORIZADA en pruebas**. El sistema lo exige.
- [ ] Una nota de crédito probada en pruebas.
- [ ] `SRI_CERT_KEY` está guardada fuera del servidor.
- [ ] Respaldo reciente de la base de datos.
- [ ] Si ya emitía con otro sistema: la numeración se fijó con el último número usado.
- [ ] Activar con **Configuración › Activar producción**. Requiere el permiso "Activar el ambiente de producción" y escribir `ACTIVAR PRODUCCION`.

---

## 8. Guía: emitir, corregir, anular

- **Emitir**: Facturación › Nueva factura, o "Facturar (SRI)" en una proforma aprobada o convertida, o en una OT.
  1. Revise el comprador, las tarifas de IVA de cada línea, el descuento y la forma de pago.
  2. Guarde el borrador.
  3. Pulse "Emitir y enviar al SRI" y confirme los datos del comprador.
- **Facturar no descuenta inventario** (eso ya ocurrió al confirmar materiales o al convertir en OT) y **no registra pagos** (se registran en el pagaré).
- **Facturado ≠ cobrado**: el panel muestra ambos por separado.
- **Corregir valores** de una factura autorizada: use una **nota de crédito**. La suma de notas de crédito no puede superar la factura.
- **Anular**: el SRI no ofrece servicio web para esto.
  1. Solicite la anulación en SRI en Línea, dentro de 90 días desde la emisión.
  2. Registre en el sistema que la solicitó.
  3. El sistema la marca *Anulada* solo cuando la consulta oficial del SRI lo confirma.

---

## 9. Guía: términos, privacidad y aceptaciones

1. **Mi empresa › Documentos legales › Nuevo documento**: elija el tipo y cargue una plantilla de borrador.
2. Adapte el texto. Los puntos `[COMPLETAR]` y `[REVISIÓN PROFESIONAL]` **deben resolverse con un abogado ecuatoriano**. Las plantillas no están validadas jurídicamente.
3. **Publicar**: elija la fecha de vigencia y confirme. Desde ese momento, el registro de clientes exige aceptar los documentos obligatorios, con una casilla por documento, desmarcada al inicio.
4. **Nueva versión**: marque "cambio material" si exige que todos vuelvan a aceptar. En ese caso:
   - los clientes ven el aviso en su portal;
   - las aceptaciones anteriores se conservan.
5. **Evidencia**: en la pestaña Aceptaciones se puede filtrar por documento, persona y fecha, y descargar la **constancia PDF**. La constancia incluye la huella SHA-256 y el texto aceptado como anexo.
6. **Autorizaciones opcionales** (p. ej. comunicaciones comerciales): van separadas de los términos, y el cliente puede retirarlas desde su portal.

La constancia no equivale a una firma electrónica certificada. Es la evidencia técnica del consentimiento expresado por medios electrónicos.

---

## 10. Guía: empresas que contratan la plataforma

1. Superadministrador › **Plataforma › Documentos y contratos**:
   - **Proveedor**: identidad de quien presta el servicio.
   - **Documentos**: términos SaaS, privacidad, condiciones comerciales y cancelación.
   - **Contratos**: plan, alcance, precio, periodicidad y soporte de cada empresa.
2. La empresa (su administrador, con permiso "Configuración de la empresa: editar") ve un aviso y entra a **Mi empresa › Contratación del servicio**. Ahí lee, descarga y acepta los documentos y el contrato. Sin todos los documentos obligatorios marcados, el contrato no se acepta.
3. Un contrato aceptado no se modifica: para cambiar condiciones se crea uno nuevo.
4. El aislamiento de datos entre empresas es el del Sprint 22: RLS, llaves compuestas y la empresa tomada del usuario autenticado. Las pruebas del Sprint 23 confirman que esto aplica también a facturas, configuración, certificados, documentos y aceptaciones.

---

## 11. Resultados de pruebas (ejecutadas el 2026-10-12)

| Batería | Resultado |
|---|---|
| Backend completo con PostgreSQL (`PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest --runInBand`) | **197 / 197** |
| — de ellas, Sprint 23 integración (SRI simulado; XML, XSD y firma reales) | 25 / 25 |
| — de ellas, unitarias SRI (clave, cédula/RUC, cálculos, XSD oficiales, firma verificada también con xml-crypto, custodia) | 22 / 22 |
| Frontend (`CI=true npm test`) | **50 / 50** |
| Compilación del frontend en modo estricto (`CI=true react-scripts build`) | Sin errores ni advertencias |
| Transporte real con el SRI (celcer, ambiente de pruebas) | `DEVUELTA` error 35 por RUC ficticio, como se esperaba |
| Recorrido en navegador (BD de prueba + simulador local del SRI) | Configuración → borrador → emisión con confirmación → AUTORIZADA → panel. Vista móvil sin desplazamiento horizontal |

Nota: una prueba del Sprint 14 (PDF en un proceso hijo) falla de forma intermitente solo cuando las baterías corren en paralelo. Con `--runInBand` pasa siempre. Ya ocurría antes de este sprint.

---

## 12. Limitaciones conocidas y pendientes

1. **Falta la prueba real de autorización**. Se necesitan el RUC habilitado de SS SWAP, su certificado `.p12` y los datos del emisor.
2. **Consulta de datos de RUC/cédula**: el SRI no publica un servicio oficial. Solo se valida el formato, y una persona confirma los datos.
3. **Anulación**: se tramita en SRI en Línea. El sistema la registra y la verifica.
4. **Solo factura (01) y nota de crédito (04)**. No se implementaron retenciones, guías de remisión ni liquidaciones (el taller no las usa hoy), ni reembolsos.
5. **Textos legales**: son borradores que requieren revisión de un abogado ecuatoriano antes de publicarse.
6. **Correo**: requiere configurar SMTP. Mientras tanto, el RIDE y el XML se descargan desde el panel y el portal.
7. **Video y PDF de referencia**: no llegaron a este equipo. El diseño se basó en la ficha técnica oficial (Anexo 2, RIDE).
8. **XSD del SRI de 2022**: no incluye la leyenda "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE" que exige la ficha 2.34. Se agregó localmente y está documentado en `src/sri/xsd/LEEME.txt`.
9. **Tarea automática**: corre dentro del proceso del servidor. Si Hostinger lo duerme por inactividad, se reanuda al despertar y los comprobantes en curso se atienden en ese momento.
10. **Pendientes de seguridad anteriores** (ver auditoría):
    - cambiar las 4 contraseñas demo publicadas en GitHub;
    - fotos en `/uploads` por nombre aleatorio, sin aislamiento por empresa;
    - JWT en localStorage.

---

## 13. Reversión

- **Código**: volver a desplegar el ZIP anterior (`ssswap-actualizacion-2026-10-12.zip`, commit 2f822b6). El código anterior funciona con las tablas nuevas presentes, porque no las usa.
- **Base de datos**: la migración es aditiva, así que **no hace falta deshacerla** para volver al código anterior.
- **No se deben borrar** las tablas de comprobantes si ya existen facturas autorizadas en producción: son documentos tributarios que deben conservarse.
- **Restauración completa** de un respaldo previo: procedimiento en `RECUPERACION.md`. Se usa solo si la base quedó dañada. Se pierde lo registrado después del respaldo.
- **Respaldos de hoy**:
  - `respaldos/ssswap_20261012-203053_previo_migracion.*` (verificado con una restauración de prueba);
  - copia en `Downloads/ssswap/respaldos/pre-sri-2026-10-12/`, con el repositorio completo (`repo-completo.bundle`).
