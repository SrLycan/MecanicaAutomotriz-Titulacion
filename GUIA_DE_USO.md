# Guía de uso — SS SWAP (panel del taller)

Esta guía explica, paso a paso, cómo usar el programa en el día a día del taller.
Está pensada para el personal nuevo: léela en orden la primera vez y después úsala
como consulta.

> **Consejo:** el menú de la izquierda se abre por secciones. Haz clic en una sección
> (por ejemplo *Inventario*) y aparecen sus opciones. El botón **☀ / 🌙** de arriba
> cambia entre modo claro y modo oscuro.

---

## Índice

1. [Entrar al sistema y roles](#1-entrar-al-sistema-y-roles)
2. [El día a día en 10 pasos](#2-el-día-a-día-en-10-pasos)
3. [Panel (inicio)](#3-panel-inicio)
4. [Clientes y vehículos](#4-clientes-y-vehículos)
5. [Citas](#5-citas)
6. [Órdenes de trabajo](#6-órdenes-de-trabajo)
7. [Proformas](#7-proformas)
8. [Pagaré / Cartera (cobrar a clientes)](#8-pagaré--cartera-cobrar-a-clientes)
9. [Inventario](#9-inventario)
10. [Registrar movimiento y Registros](#10-registrar-movimiento-y-registros)
11. [Pedidos de la tienda](#11-pedidos-de-la-tienda)
12. [Proveedores, compras y gastos](#12-proveedores-compras-y-gastos)
13. [Caja diaria](#13-caja-diaria)
14. [Finanzas](#14-finanzas)
15. [Usuarios, gráficas y ajustes](#15-usuarios-gráficas-y-ajustes)
16. [Lo que ve el cliente](#16-lo-que-ve-el-cliente)
17. [¿A dónde va el dinero? (resumen)](#17-a-dónde-va-el-dinero-resumen)
18. [Preguntas frecuentes](#18-preguntas-frecuentes)

---

## 1. Entrar al sistema y roles

1. Abre la página del taller y entra por **Acceso personal** (`/admin/login`).
2. Escribe tu correo y contraseña y pulsa **Iniciar sesión**.
3. Para salir usa el botón rojo de la esquina superior derecha.

Cada persona ve solo lo que le corresponde según su **rol**:

| Sección | Administrador | Recepcionista | Técnico |
|---|:-:|:-:|:-:|
| Panel, Inventario, Taller (órdenes, proformas, citas), Vehículos | ✅ | ✅ | ✅ |
| Clientes y Pagaré / Cartera | ✅ | ✅ | — |
| Caja diaria | ✅ | ✅ | — |
| Proveedores (compras, gastos, pagos) | ✅ | — | — |
| Finanzas (resumen, movimientos, nómina, cuentas) | ✅ | — | — |
| Usuarios, Gráficas, Ajustes (servicios, sucursales, bitácora) | ✅ | — | — |

Los usuarios los crea el administrador en **Usuarios** (ver sección 15).

---

## 2. El día a día en 10 pasos

Este es el recorrido normal de un vehículo por el taller:

1. **Abrir la caja** al llegar: *Finanzas › Caja diaria* → contar billetes y monedas → **Abrir caja**.
2. **Revisar el Panel**: citas de hoy, vehículos en el taller y productos con stock bajo.
3. **Atender la cita** o al cliente que llega: *Taller › Citas* → **Aceptar cita**.
4. **Registrar al cliente y su vehículo** si son nuevos (*Clientes* y *Vehículos*).
5. **Hacer la proforma** (presupuesto): *Taller › Nueva proforma*.
6. **Aprobar la proforma** cuando el cliente acepta y **convertirla en orden de trabajo**.
   Esto crea solo el **pagaré del 70 %**.
7. **Confirmar uso de materiales** en la proforma: descuenta del inventario los repuestos usados.
8. El técnico **actualiza el avance** de la orden (en revisión → en progreso → completado).
9. **Cobrar** al cliente: *Clientes › Pagaré / Cartera* → **Registrar pago**.
   Si paga en efectivo, el dinero aparece solo en la caja.
10. **Cerrar la caja** al final del día: contar billetes y monedas → revisar el cuadre → **Cerrar caja**.

---

## 3. Panel (inicio)

Es la primera pantalla al entrar. Muestra de un vistazo:

- **Citas de hoy** y **vehículos que están en el taller**.
- **Stock bajo**: productos por debajo de su mínimo (también se ve un número rojo
  junto a *Inventario* en el menú).
- **Movimientos de inventario** recientes, **ingresos y egresos** y el crecimiento del taller.
- **Accesos rápidos** a las tareas más comunes.

Si ves "No se pudo cargar el panel", el servidor está apagado: pulsa **Reintentar**
o avisa al administrador.

---

## 4. Clientes y vehículos

### Registrar un cliente
1. Menú **Clientes › Visualizar** → **Nuevo cliente**.
2. Llena nombre, cédula/RUC, teléfono o correo (al menos uno) y dirección.
3. Guarda. Desde la misma lista puedes **Editar** o **Eliminar**.

> No se puede eliminar un cliente que ya tiene órdenes, proformas o pagarés:
> así nunca se pierde su historial.

### Registrar un vehículo
1. Menú **Clientes › Vehículos** → **Registrar vehículo**.
2. Elige el **propietario** (cliente), escribe **placa**, **marca**, modelo, año, color y VIN.
3. Guarda. Al abrir un vehículo ves su **historial de órdenes de trabajo**.

---

## 5. Citas

Los clientes pueden pedir cita desde la página web; también las agenda el personal.

1. Menú **Taller › Citas**.
2. Filtra por estado: **Pendientes, Confirmadas, Completadas, Canceladas** o **Todas**.
3. En una cita pendiente pulsa **✓ Aceptar cita** para confirmarla, o **Cancelar**.
4. Usa **↻ Actualizar** para ver solicitudes nuevas.

El cliente ve en su panel si su cita fue confirmada o cancelada.

---

## 6. Órdenes de trabajo

Una orden de trabajo (OT) es el trabajo real que se hace en un vehículo.

### Crear una orden
1. Menú **Taller › Órdenes de trabajo** → **Nueva orden**.
2. Elige el **cliente** (o crea uno nuevo desde ahí con **Registrar cliente**) y su **vehículo**.
3. Escribe la **descripción del trabajo**, el diagnóstico y asigna un **técnico**.
4. Pulsa **Crear orden**.

> Lo más común es crear la orden **desde una proforma aprobada** (sección 7), porque así
> se genera solo el pagaré del cliente.

### Avance de la reparación
Estados de una orden: **Pendiente → En revisión → En progreso → Completado** (o **Cancelado**).

1. Abre la orden y usa **Actualizar progreso de reparación**.
2. Cambia el estado y escribe **notas de progreso** (qué se hizo, qué falta).
3. Cada cambio queda en el **historial** de la orden, y el cliente lo ve en su panel.

---

## 7. Proformas

La proforma es el **presupuesto** que se entrega al cliente. Hay dos tipos:
**Mecánica** y **Colisiones / Pintura**. La numeración es automática.

### Crear una proforma
1. Menú **Taller › Nueva proforma**.
2. Elige **cliente**, **vehículo**, fecha de emisión y "válida hasta".
3. Agrega los ítems:
   - **Servicios / mano de obra**: se escriben con su precio.
   - **Productos / repuestos / insumos**: se eligen **del inventario** (se ve el stock
     disponible, separado en Mecánica y Colisiones).
4. Ajusta **descuento**, **IVA (%)**, **anticipo**, forma de pago, garantía y tiempo estimado.
5. En proformas de **Colisiones / Pintura**: elige la carrocería (PICKUP, HATCHBACK,
   SEDAN, SUV) y **marca en el dibujo las zonas dañadas**.
6. Pulsa **Crear proforma**.

### Estados de la proforma
**Borrador → Emitida → Aprobada → Convertida** (o **Rechazada / Vencida**).

### Qué hacer después
En **Taller › Proformas** usa los íconos: **Ver**, **Editar**, **Duplicar**,
**PDF**, **Excel** o **Eliminar**. Al **ver** una proforma tienes:

- **✔ Aprobar** o **Rechazar** según la respuesta del cliente.
- **Convertir a orden**: crea la orden de trabajo y el **pagaré del 70 %** automáticamente.
- **Confirmar uso de materiales**: descuenta del inventario los productos de la proforma.
  - Solo funciona con la proforma **aprobada** o **convertida**.
  - Se hace **una sola vez**. Si falta stock, **no descuenta nada** y avisa qué falta.
- **Devolver al inventario** (solo administrador): si un material no se usó, vuelve al stock
  y el movimiento queda registrado.
- **Ver pagaré**: abre la cuenta por cobrar del cliente.

---

## 8. Pagaré / Cartera (cobrar a clientes)

Aquí se controla **lo que los clientes deben** y **lo que pagan**.

- Las órdenes que vienen de una proforma generan su pagaré **automático (70 %)**.
- Para deudas sin proforma se crea una cuenta **manual**.

### Crear una cuenta manual
1. **Clientes › Pagaré / Cartera** → **Nueva cuenta**.
2. Cliente, concepto, monto y (opcional) fecha de vencimiento. Guarda.

### Registrar un pago
1. Abre la cuenta → **Registrar pago**.
2. Escribe el **monto** y el **método**: efectivo, transferencia, tarjeta, cheque…
   (se pueden anotar banco, comprobante, número de cheque, etc.).
3. Guarda. El estado cambia solo: **Pendiente → Parcial → Pagado**.

> **Efectivo** = entra a la **caja**. Transferencia, tarjeta o cheque = entra al **banco**.

Si un pago se registró mal, usa **Anular pago**: no se borra, queda tachado en el
historial y deja de contar.

---

## 9. Inventario

Hay dos inventarios: **Inventario Mecánica** (repuestos, filtros, baterías, eléctricos…)
y **Colisiones / Pintura** (pinturas, masillas, lijas, primer, barniz…).

### Crear un repuesto
1. **Inventario › Inventario Mecánica** (o Colisiones) → **Nuevo repuesto**.
2. Llena **código**, **nombre**, categoría, unidad de medida, **precio de compra**,
   **precio de venta** (se ve el margen), **stock inicial** y **stock mínimo**.
3. Opcional: foto y **Marcar para venta** (aparece en la tienda en línea).
4. Pulsa **Crear repuesto**.

### Leer la tabla
- **Stock**: cantidad actual / mínimo. En rojo con **ALERTA** = está en el mínimo o por debajo.
- Arriba ves: total de repuestos, cuántos tienen **bajo stock**, unidades totales y
  **valor del inventario** (a precio de venta).
- Filtra por nombre/código, categoría o **Solo bajo stock**, y usa **Exportar CSV**.

### Acciones de cada fila
⬇ **Registrar movimiento** · ✏ **Editar** · 🗑 **Eliminar** · 🏷 **Categoría**.
También puedes seleccionar varios para cambiar categoría, activar/desactivar o exportar.

---

## 10. Registrar movimiento y Registros

### Registrar un movimiento a mano
Para lo que **no** viene de una compra ni de una proforma:

1. **Inventario › Registrar movimiento**.
2. Elige inventario (Mecánica / Colisiones) y busca el **producto**.
3. Tipo: **Entrada** o **Salida**, y el origen: manual, **devolución** o
   **ajuste de inventario** (conteo físico, merma, daño).
4. Escribe **cantidad**, motivo y referencia. Revisa el "Resultado" (cómo queda el stock) y guarda.

### Registros (historial)
**Inventario › Registros** muestra **todo** lo que entró y salió:
entrada manual, **entrada por compra**, salida manual, **salida por proforma**,
**venta a cliente (tienda)** y devoluciones.

Filtra por tipo, inventario, producto/cliente/placa, usuario, proforma, orden de trabajo y fechas.
Se puede **Exportar CSV**.

> Las entradas por compra y las salidas por proforma se registran **solas**; no hace
> falta registrarlas a mano.

---

## 11. Pedidos de la tienda

Cuando un cliente pide un producto en la tienda en línea, llega aquí.

1. **Inventario › Pedidos de la tienda**. Filtra: **Por atender, Entregados, Cancelados, Todos**.
2. Para entregar: **Entregar** → indica **¿Cómo pagó?** (efectivo, transferencia…) →
   **Confirmar entrega**.
   - El producto **sale del inventario** (aparece en Registros como "Venta a cliente").
   - Si se cobró, el dinero entra en Finanzas (en efectivo, a la **caja**).
3. Si no se concreta: **Cancelar**.

> Para que un producto aparezca en la tienda, márcalo **"En venta"** en Inventario.

---

## 12. Proveedores, compras y gastos

*(Solo administrador.)* Arriba se ve el resumen: total comprado, pagado,
**pendiente**, gastos, número de compras y proveedores activos (por semana, mes, año o todo).

### Proveedores
1. **Proveedores › Visualizar** → **Nuevo proveedor** (nombre comercial, razón social,
   RUC, teléfono, correo, categoría…).
2. Dentro de cada proveedor puedes **agregar contactos** (vendedores, cobradores).

### Compras (pedir mercadería)
1. **Proveedores › Compras** → **Nueva compra**.
2. Elige el **proveedor**, la fecha y agrega los **ítems**:
   - Si eliges un repuesto del inventario, se llena solo el nombre y el precio de compra.
   - "Ítem libre" sirve para cosas que no son del inventario (herramientas, insumos de oficina).
3. Elige la **forma de pago**:
   - **Contado**: se paga en ese momento. Elige el método (efectivo **sale de la caja**,
     transferencia, tarjeta o cheque).
   - **Crédito 15 días**: no sale dinero ahora; la compra **vence a los 15 días**.
4. El sistema calcula subtotal, IVA 15 % y total. Pulsa **Crear compra**.

#### Avance de la compra
**Pendiente → Solicitada → En proceso → Recibida** (o **Cancelada**).
Al marcarla **Recibida** escribes cuánto llegó de cada ítem y el **stock se suma solo**
al inventario (aparece en Registros como "Entrada por compra").

#### Pagar una compra a crédito
1. Abre la compra (ícono 👁). Verás **pagado** y **saldo**.
2. En **Registrar pago** escribe el monto (todo = pago, una parte = abono), el método y referencia.
3. Cuando el saldo llega a $0 la compra aparece como **CRÉDITO · PAGADA**.

#### ⚠ Alertas de crédito
Cuando a una compra a crédito le quedan **3 días o menos** (o ya venció) y tiene saldo:
- Aparece un **aviso naranja/rojo** arriba en *Proveedores* con la lista y el botón **Ver compras**.
- Sale un **número naranja** junto a *Proveedores* en el menú.
- Al entrar al sistema aparece un **mensaje emergente** (una vez por sesión).

En la tabla de compras, la columna **Pago** se pinta: azul = falta tiempo,
naranja = vence en 3 días o menos, rojo = **vencida**.

### Gastos
Para pagos que no son compras de mercadería (luz, agua, arriendo, transporte…):
1. **Proveedores › Gastos** → **Registrar gasto**.
2. Descripción, categoría, monto, fecha, método de pago, proveedor (opcional),
   N° de comprobante y **estado**.
3. Solo los gastos en estado **pagado** cuentan como salida de dinero
   (en efectivo, salen de la **caja**).

### Pagos / Historial
**Proveedores › Pagos / Historial** muestra todo lo que pasó con cada proveedor:
compras, pagos, abonos, gastos, cancelaciones y ajustes. Aquí también se puede registrar
un pago o abono suelto, o **anular** uno mal registrado.

---

## 13. Caja diaria

*(Administrador y recepcionista.)* La caja es el **efectivo físico** del taller.
Menú **Finanzas › Caja diaria**.

### Abrir la caja (al empezar el día)
1. Verás cuánto **debería haber según el sistema**.
2. En **¿Con cuánto se abre?** escribe **cuántos billetes y monedas** hay de cada valor
   (billetes de $100, $50, $20, $10, $5, $1 y monedas de $1, 50¢, 25¢, 10¢, 5¢, 1¢).
   - Ejemplo: 4 billetes de $20, 2 de $10, 2 monedas de $1, 4 de 50¢, 8 de 25¢,
     3 de 10¢, 1 de 5¢ y 10 de 1¢ = **$106.45**.
3. El **monto de apertura** se calcula solo (o escríbelo a mano si no cuentas por billetes).
4. Si no coincide con el sistema, verás cuánto sobra o falta; al abrir se registra un
   **ajuste de caja** para que todo cuadre.
5. Pulsa **Abrir caja**.

### Durante el día
Arriba ves: **Apertura**, **Entradas de efectivo**, **Salidas de efectivo** y
**Debería haber en caja**. Debajo, la lista de cada movimiento con su hora.

Aparecen **solos** todos los movimientos en **efectivo**: cobros a clientes, ventas de la
tienda, compras al contado, pagos a proveedores, gastos pagados y sueldos.
Lo que se cobra por transferencia, tarjeta o cheque se muestra aparte
("Otros medios hoy"), porque **no entra a la caja**.

Para movimientos pequeños usa:
- **+ Entrada**: por ejemplo, cambio o sencillo que se trae.
- **− Salida**: por ejemplo, un taxi para traer un repuesto.

> No uses "+ Entrada" para cobrar a un cliente: regístralo en *Pagaré / Cartera*.
> Si es en efectivo, aparece en la caja solo.

### Cerrar la caja (al final del día) — Reporte de cuadre
1. Pulsa **Cerrar caja**. Se abre el **Reporte de cuadre**:
   - **Izquierda (lo que dice el sistema):** monto apertura (+), entradas en efectivo (+),
     salidas en efectivo (−) y **debería haber en caja (=)**. Debajo, informativo, lo que
     entró por transferencia, tarjeta, cheques y otros.
   - **Derecha (lo que se cuenta):** la tabla de **billetes y monedas**, el
     **total de fracciones** y el **total reportado**.
2. Cuenta el dinero y llena la tabla.
3. Revisa el resultado: **CUADRA** (verde), **Sobra** o **Falta** (rojo).
4. Si hay diferencia, explica el motivo en **Notas**.
5. Pulsa **Cerrar caja**. La diferencia queda registrada como ajuste y el conteo de
   billetes y monedas queda guardado.

En **Cierres anteriores** ves cada día: apertura, cierre, inicial, esperado, contado,
diferencia y quién abrió y cerró.

> **Importante:** mantén la caja **abierta todo el día de trabajo**. Si se cobra en efectivo
> con la caja cerrada, la diferencia aparecerá al abrir al día siguiente.

---

## 14. Finanzas

*(Solo administrador.)* Responde a la pregunta **"¿cuánto dinero hay y en qué se va?"**.

### Resumen / ¿Cuánto hay?
Saldo de cada cuenta, **ingresos vs egresos de los últimos 12 meses**,
**¿de dónde entra el dinero?**, **¿en qué se va el dinero?** y los últimos movimientos.
Desde aquí puedes registrar **+ Ingreso**, **− Egreso**, **⇄ Transferir** o **Pagar empleado**.

### Movimientos de dinero
Lista de **todo** el dinero que entra y sale, venga de donde venga (cobros, proveedores,
gastos, caja, nómina…). Filtra por tipo, cuenta, categoría, origen y fechas.
Se usa también para registrar ingresos/egresos que no entran en otra sección
(por ejemplo, un préstamo o un pago de impuestos) y para **anular** uno mal hecho.

### Nómina / Empleados
1. **Configurar** cada empleado: cargo, sueldo mensual, si se paga mensual, quincenal o
   semanal, y su fecha de ingreso.
2. **+ Registrar pago** (o **Pagar**): tipo (sueldo, anticipo, bono, comisión, horas extra,
   liquidación), mes que se paga, descuentos (IESS, multas…) y cuenta de la que sale.
   El sistema muestra el **neto a pagar**.
3. Cada empleado muestra si está **al día** en el mes.

### Cuentas (caja / bancos)
- Hay una cuenta **Caja · Efectivo** y una o más cuentas de **Banco**.
  Las marcadas como **predeterminadas** reciben solas los pagos (efectivo → caja; lo demás → banco).
- **+ Nueva cuenta**: nombre, tipo, banco, N° de cuenta y **saldo inicial**.
- **⇄ Transferir**: por ejemplo, cuando se deposita el efectivo de la caja en el banco.

---

## 15. Usuarios, gráficas y ajustes

*(Solo administrador.)*

- **Usuarios**: **Nuevo usuario** (nombre, correo, contraseña, rol). Desde la lista puedes
  editar, **cambiar rol**, **cambiar estado** (activar/desactivar) o **cambiar contraseña**.
  Filtra por administradores, técnicos, recepcionistas o clientes del portal.
- **Gráficas**: estadísticas de **productos**, **servicios**, **proformas** y **crecimiento**.
- **Ajustes › Servicios del taller**: servicios que ven los clientes en la web (nombre,
  descripción, precio base, duración, foto, activo/inactivo).
- **Ajustes › Sucursales**: datos de cada sucursal (aparecen en la página principal y en el
  encabezado de las proformas).
- **Ajustes › Bitácora**: historial de acciones y de las conversaciones con el asistente
  virtual **SwapBot**.

---

## 16. Lo que ve el cliente

Los clientes tienen su propio acceso en la página web:

- Pueden **pedir citas** y ver si fueron confirmadas.
- En **Mi panel** ven sus datos, sus vehículos, el **estado de su orden de trabajo**,
  el técnico asignado y el historial de cambios.
- Pueden comprar en la **tienda en línea** (los pedidos llegan a la sección 11).
- Pueden conversar con **SwapBot**, el asistente virtual.

Por eso es importante **actualizar el avance de las órdenes** con notas claras:
el cliente las lee.

---

## 17. ¿A dónde va el dinero? (resumen)

| Lo que pasa | ¿Afecta la caja? | ¿Afecta el inventario? |
|---|---|---|
| Cliente paga un pagaré en **efectivo** | ✅ Entra | — |
| Cliente paga por transferencia / tarjeta / cheque | Va al **banco** | — |
| Venta de la tienda (entregada y cobrada en efectivo) | ✅ Entra | ✅ Sale el producto |
| Compra a proveedor **al contado** en efectivo | ✅ Sale | ✅ Entra al marcarla *Recibida* |
| Compra a proveedor **a crédito** | Sale solo cuando se **paga/abona** | ✅ Entra al marcarla *Recibida* |
| Gasto en estado **pagado** en efectivo | ✅ Sale | — |
| Sueldo / anticipo en efectivo | ✅ Sale | — |
| + Entrada / − Salida de caja | ✅ Entra / Sale | — |
| Proforma: **Confirmar uso de materiales** | — | ✅ Sale |
| Proforma: **Devolver al inventario** | — | ✅ Vuelve a entrar |

---

## 18. Preguntas frecuentes

**El número rojo en "Inventario" ¿qué significa?**
Cuántos productos están en su stock mínimo o por debajo. Revisa *Solo bajo stock* y haz una compra.

**El número naranja en "Proveedores" ¿qué significa?**
Compras a crédito que vencen en 3 días o menos (o ya vencidas). Ve a *Proveedores › Compras* y págalas.

**Confirmé materiales pero dice que falta stock.**
No se descontó nada. Repón el stock (compra o movimiento de entrada) y vuelve a pulsar
**Confirmar uso de materiales**.

**Registré un pago por error.**
- Cliente: *Pagaré* → abre la cuenta → **Anular pago**.
- Proveedor: *Pagos / Historial* → **Anular**.
- Movimiento de dinero: *Finanzas › Movimientos* → **Anular**.

Nada se borra: queda tachado para que el historial sea confiable.

**La caja no cuadra.**
Revisa que todos los cobros y gastos en efectivo del día estén registrados con el método
correcto. Si aun así hay diferencia, ciérrala explicando el motivo en **Notas**;
queda registrada como ajuste.

**No puedo eliminar un cliente o repuesto.**
Tiene historial (órdenes, pagos o movimientos) y se protege para no perderlo.
Un repuesto que ya no se usa se puede **Desactivar** desde Inventario.

**No veo una sección del menú.**
Tu rol no tiene acceso. Pide al administrador que revise tu usuario.
