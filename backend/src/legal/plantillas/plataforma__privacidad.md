# Política de privacidad y tratamiento de datos de la plataforma

> BORRADOR — requiere revisión de un abogado ecuatoriano especializado en protección de datos antes de publicarse.
> Marco de referencia: Ley Orgánica de Protección de Datos Personales (LOPDP, Registro Oficial Suplemento 459 de 26 de mayo de 2021) y su reglamento. [REVISIÓN PROFESIONAL: confirmar la cita vigente del reglamento.]

## 1. Responsable y encargado

1.1. **Datos de las empresas usuarias y de sus administradores**: los trata [RAZÓN SOCIAL DEL PROVEEDOR], RUC [COMPLETAR], como **responsable**. Contacto: [CORREO — COMPLETAR].

1.2. **Datos de los clientes de cada taller** (nombres, cédula/RUC, contacto, vehículos, órdenes, pagos, facturas): el **responsable** es cada empresa (taller). El Proveedor actúa como **encargado** y solo trata esos datos para prestar el servicio, según las instrucciones de la empresa.

## 2. Datos que tratamos

- **Cuentas de usuario**: nombre, correo, rol, permisos, fechas de acceso, contraseña guardada solo como hash (bcrypt).
- **Datos tributarios del emisor**: RUC, razón social, direcciones, régimen y el certificado de firma electrónica, que se guarda **cifrado** y nunca se muestra.
- **Registros de seguridad y auditoría**: quién hizo qué y cuándo, resultado e IP de la petición.
- **Evidencia de aceptación de documentos legales**: versión, huella del texto, fecha, IP y navegador.

## 3. Finalidades y bases de legitimación

| Finalidad | Base |
|---|---|
| Prestar el servicio contratado | Ejecución del contrato |
| Transmitir comprobantes al SRI | Obligación legal tributaria de la empresa emisora |
| Seguridad, prevención de fraude y auditoría | Interés legítimo / obligación de seguridad |
| Evidencia de contratación | Interés legítimo y ejecución del contrato |

[REVISIÓN PROFESIONAL: validar cada base frente a la LOPDP.]

## 4. Destinatarios y subencargados

- **Servicio de Rentas Internas (SRI)**: comprobantes electrónicos (obligación legal).
- **Alojamiento del servidor**: [PROVEEDOR DE HOSTING — p. ej. Hostinger; COMPLETAR país].
- **Base de datos**: [PROVEEDOR — p. ej. Supabase; región COMPLETAR]. Si los servidores están fuera de Ecuador, existe **transferencia internacional de datos**. [REVISIÓN PROFESIONAL: garantías exigidas por la LOPDP para la transferencia.]
- **Correo electrónico**: proveedor SMTP [COMPLETAR], para enviar comprobantes.
- **Asistente del portal**: Google (API Gemini), solo con los mensajes que el usuario escribe al chatbot. [REVISIÓN PROFESIONAL]

## 5. Conservación

- Los comprobantes electrónicos y sus registros se conservan durante el plazo que exige la normativa tributaria. [COMPLETAR plazo; REVISIÓN PROFESIONAL]
- Las evidencias de aceptación se conservan mientras puedan ser necesarias para acreditar la relación contractual.
- El resto de datos se conserva mientras dure el contrato y el período posterior que se indique.

## 6. Seguridad

- Aislamiento de los datos de cada empresa dentro de la base de datos (Row Level Security).
- Permisos por módulo y acción.
- Contraseñas con hash.
- Certificado de firma cifrado con AES-256-GCM.
- Auditoría inmutable.
- Respaldos verificados.

Ninguna medida elimina por completo el riesgo. Los incidentes se gestionan y se notifican conforme a la ley.

## 7. Derechos

Los titulares pueden ejercer sus derechos de:
- acceso;
- rectificación y actualización;
- eliminación;
- oposición;
- portabilidad;
- suspensión del tratamiento;
- a no ser objeto de decisiones basadas únicamente en valoraciones automatizadas.

Para ejercerlos, escriba a [CORREO — COMPLETAR]. Si los datos son de clientes de un taller, la solicitud se traslada a ese taller, que es el responsable. También puede acudir a la Superintendencia de Protección de Datos Personales.

## 8. Cambios

Se publican nuevas versiones con su fecha de vigencia. Si un cambio es material, se solicita una nueva aceptación cuando corresponda.
