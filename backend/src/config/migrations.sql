-- ============================================================
-- SS SWAP — Migraciones idempotentes (corren en cada arranque)
-- Sprint 2: Gestion de usuarios + Sucursales
-- ============================================================

-- ── Actualizar CHECK de rol para incluir 'cliente' ──────────
-- (Corrige schemas creados antes de agregar el rol cliente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'usuarios_rol_check'
        AND pg_get_constraintdef(oid) LIKE '%cliente%'
    ) THEN
        ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
        ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
            CHECK (rol IN ('administrador','tecnico','recepcionista','cliente'));
    END IF;
END $$;

-- ── Estado de usuario (activo / suspendido / bloqueado) ──────
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20)
        NOT NULL DEFAULT 'activo'
        CHECK (estado IN ('activo','suspendido','bloqueado'));

-- ── Telefono / Cedula (si faltan en migraciones previas) ────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cedula VARCHAR(20);

-- ── Imagen URL en repuestos ─────────────────────────────────
ALTER TABLE repuestos ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- ── Sucursales ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sucursales (
    id           SERIAL PRIMARY KEY,
    nombre       VARCHAR(150) NOT NULL,
    direccion    VARCHAR(255),
    ciudad       VARCHAR(80),
    telefono     VARCHAR(50),
    email        VARCHAR(150),
    horario      VARCHAR(255),
    descripcion  TEXT,
    es_principal BOOLEAN NOT NULL DEFAULT FALSE,
    activa       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sucursales_activa ON sucursales(activa);

-- Trigger updated_at sobre sucursales (reutiliza la funcion del schema base)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_sucursales'
    ) THEN
        CREATE TRIGGER set_updated_at_sucursales
            BEFORE UPDATE ON sucursales
            FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── Seed: sucursal principal (solo si no hay ninguna) ────────
INSERT INTO sucursales (nombre, direccion, ciudad, telefono, email, horario, descripcion, es_principal, activa)
SELECT 'SS SWAP Ponciano Alto',
       'Av. Real Audiencia y Manuel Cordova Galarza',
       'Quito',
       '+593 99 123 4567',
       'contacto@ssswap.com',
       'Lun-Vie 8:00-18:00 · Sab 8:00-14:00',
       'Sucursal principal: diagnostico computarizado, mecanica general, alineacion y balanceo.',
       TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM sucursales);

-- ============================================================
-- Sprint 3: Ordenes de Trabajo — Clientes, Vehiculos
-- ============================================================

-- ── Clientes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    email       VARCHAR(150),
    telefono    VARCHAR(50),
    cedula      VARCHAR(20) UNIQUE,
    direccion   TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_cedula ON clientes(cedula);

-- ── Vehiculos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehiculos (
    id          SERIAL PRIMARY KEY,
    cliente_id  INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    placa       VARCHAR(20) NOT NULL,
    marca       VARCHAR(60) NOT NULL,
    modelo      VARCHAR(60),
    anio        INTEGER,
    color       VARCHAR(30),
    vin         VARCHAR(30),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehiculos_placa      ON vehiculos(placa);
CREATE INDEX IF NOT EXISTS idx_vehiculos_cliente    ON vehiculos(cliente_id);

-- ── Ordenes de Trabajo ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
    id              SERIAL PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(id),
    vehiculo_id     INTEGER REFERENCES vehiculos(id),
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','en_progreso','completado','cancelado')),
    descripcion     TEXT NOT NULL,
    diagnostico     TEXT,
    kilometraje     INTEGER,
    fecha_ingreso   DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_salida    DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_cliente   ON ordenes_trabajo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_vehiculo  ON ordenes_trabajo(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado    ON ordenes_trabajo(estado);

-- Triggers updated_at para nuevas tablas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_clientes') THEN
        CREATE TRIGGER set_updated_at_clientes
            BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_vehiculos') THEN
        CREATE TRIGGER set_updated_at_vehiculos
            BEFORE UPDATE ON vehiculos FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_ordenes_trabajo') THEN
        CREATE TRIGGER set_updated_at_ordenes_trabajo
            BEFORE UPDATE ON ordenes_trabajo FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ============================================================
-- Sprint 4: Progreso de reparacion (estados de mecanica)
-- ============================================================

ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS estado_progreso VARCHAR(30);
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS notas_progreso TEXT;

-- Ampliar estados de progreso mecanico (idempotente)
DO $$
BEGIN
    ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_trabajo_estado_progreso_check;
    ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_trabajo_estado_progreso_check
        CHECK (estado_progreso IS NULL OR estado_progreso IN (
            'en_revision', 'deteccion_falla', 'en_reparacion',
            'esperando_repuestos', 'pruebas_finales', 'listo_entrega'
        ));
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- Sprint 5: Asignacion de tecnico + permisos de estado
-- ============================================================

-- Columna tecnico asignado a la orden
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS tecnico_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ordenes_tecnico ON ordenes_trabajo(tecnico_id);

-- ============================================================
-- Sprint 6: Tipos de Servicio + en_venta en repuestos + Panel cliente
-- ============================================================

-- ── Columna en_venta en repuestos ─────────────────────────────
ALTER TABLE repuestos ADD COLUMN IF NOT EXISTS en_venta BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Tipos de Servicio ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tipos_servicio (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_base NUMERIC(10,2) NOT NULL DEFAULT 0,
    duracion_estimada_min INTEGER,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_tipos_servicio') THEN
        CREATE TRIGGER set_updated_at_tipos_servicio
            BEFORE UPDATE ON tipos_servicio FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tipos_servicio_activo ON tipos_servicio(activo);

-- Seed de tipos de servicio (solo si la tabla está vacía)
INSERT INTO tipos_servicio (nombre, descripcion, precio_base, duracion_estimada_min, activo)
SELECT nombre, descripcion, precio_base, duracion_estimada_min, TRUE FROM (VALUES
    ('Cambio de Aceite y Filtro', 'Incluye vaciado, filtro de aceite y aceite de motor (1L adicional con costo)', 25.00, 45),
    ('Alineacion y Balanceo', 'Alineacion laser y balanceo de las 4 ruedas', 30.00, 60),
    ('Revision de Frenos', 'Inspeccion de pastillas, discos y liquido de frenos', 20.00, 45),
    ('Diagnostico Computarizado', 'Lectura de codigos de falla con equipo certificado', 35.00, 30),
    ('Mantenimiento de 5.000 km', 'Revision general + cambio de aceite y filtros', 60.00, 90),
    ('Correccion de Carroceria', 'Enderezada y pintura parcial o total segun evaluacion', 150.00, 480)
) AS t(nombre, descripcion, precio_base, duracion_estimada_min)
WHERE NOT EXISTS (SELECT 1 FROM tipos_servicio);

-- ============================================================
-- Sprint 7: Foto de perfil, Citas (agendamiento) y Solicitudes de producto
-- ============================================================

-- ── Foto de perfil ───────────────────────────────────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- ── Citas (agendamiento de servicios) ────────────────────────
CREATE TABLE IF NOT EXISTS citas (
    id              SERIAL PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    vehiculo_id     INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL,
    servicio_id     INTEGER NOT NULL REFERENCES tipos_servicio(id),
    sucursal_id     INTEGER NOT NULL REFERENCES sucursales(id),
    fecha           DATE NOT NULL,
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','confirmada','completada','cancelada')),
    notas           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citas_cliente            ON citas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_citas_sucursal_fecha      ON citas(sucursal_id, fecha);
CREATE INDEX IF NOT EXISTS idx_citas_estado              ON citas(estado);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_citas') THEN
        CREATE TRIGGER set_updated_at_citas
            BEFORE UPDATE ON citas FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── Solicitudes de producto (tienda del cliente) ─────────────
CREATE TABLE IF NOT EXISTS solicitudes_producto (
    id              SERIAL PRIMARY KEY,
    cliente_id      INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    repuesto_id     INTEGER NOT NULL REFERENCES repuestos(id),
    cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','atendida','cancelada')),
    notas           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente  ON solicitudes_producto(cliente_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado    ON solicitudes_producto(estado);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_solicitudes_producto') THEN
        CREATE TRIGGER set_updated_at_solicitudes_producto
            BEFORE UPDATE ON solicitudes_producto FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ============================================================
-- Sprint 8: Historial de cambios de ordenes de trabajo
-- ============================================================
CREATE TABLE IF NOT EXISTS ordenes_historial (
    id                  SERIAL PRIMARY KEY,
    orden_id            INTEGER NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    estado_anterior     VARCHAR(20),
    estado_nuevo        VARCHAR(20),
    progreso_anterior   VARCHAR(30),
    progreso_nuevo      VARCHAR(30),
    usuario_id          INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    notas               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_historial_orden ON ordenes_historial(orden_id);

-- ============================================================
-- Sprint 9: Foto para tipos de servicio (pagina publica de Servicios)
-- ============================================================
ALTER TABLE tipos_servicio ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- ============================================================
-- Sprint 10: Proveedores, Contactos, Gastos, Compras e Historial
-- financiero de proveedores (Fase 1 - ampliacion panel admin)
-- ============================================================

-- ── Proveedores ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedores (
    id               SERIAL PRIMARY KEY,
    nombre_comercial VARCHAR(150) NOT NULL,
    razon_social     VARCHAR(150),
    ruc              VARCHAR(20),
    direccion        TEXT,
    telefono         VARCHAR(50),
    email            VARCHAR(150),
    categoria        VARCHAR(100),
    notas            TEXT,
    activo           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre_comercial);
CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON proveedores(activo);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_proveedores') THEN
        CREATE TRIGGER set_updated_at_proveedores
            BEFORE UPDATE ON proveedores FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── Contactos de proveedor ───────────────────────────────────
-- Nota: NO se reutiliza la tabla `usuarios` porque esta ligada al sistema
-- de login (email unico, password, uno de los 4 roles fijos). Un contacto
-- de proveedor no inicia sesion en el sistema, es solo informacion de
-- referencia, por lo que se maneja como tabla propia liviana.
CREATE TABLE IF NOT EXISTS proveedores_contactos (
    id            SERIAL PRIMARY KEY,
    proveedor_id  INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    nombre        VARCHAR(150) NOT NULL,
    cargo         VARCHAR(100),
    telefono      VARCHAR(50),
    email         VARCHAR(150),
    es_principal  BOOLEAN NOT NULL DEFAULT FALSE,
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prov_contactos_proveedor ON proveedores_contactos(proveedor_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_prov_contactos') THEN
        CREATE TRIGGER set_updated_at_prov_contactos
            BEFORE UPDATE ON proveedores_contactos FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── Gastos relacionados a proveedores ────────────────────────
CREATE TABLE IF NOT EXISTS gastos_proveedor (
    id                  SERIAL PRIMARY KEY,
    proveedor_id        INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
    usuario_id          INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    categoria           VARCHAR(30) NOT NULL DEFAULT 'otros'
                            CHECK (categoria IN ('repuestos','materiales','insumos','herramientas','servicios','otros')),
    descripcion         TEXT NOT NULL,
    monto               NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
    metodo_pago         VARCHAR(30) NOT NULL DEFAULT 'efectivo'
                            CHECK (metodo_pago IN ('efectivo','transferencia','tarjeta','cheque','otro')),
    estado              VARCHAR(20) NOT NULL DEFAULT 'pagado'
                            CHECK (estado IN ('pendiente','pagado','anulado')),
    numero_comprobante  VARCHAR(100),
    observaciones       TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_proveedor  ON gastos_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha       ON gastos_proveedor(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_estado      ON gastos_proveedor(estado);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria   ON gastos_proveedor(categoria);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_gastos_proveedor') THEN
        CREATE TRIGGER set_updated_at_gastos_proveedor
            BEFORE UPDATE ON gastos_proveedor FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── Compras / ordenes a proveedores ──────────────────────────
CREATE TABLE IF NOT EXISTS compras_proveedor (
    id                SERIAL PRIMARY KEY,
    proveedor_id      INTEGER NOT NULL REFERENCES proveedores(id),
    usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
    estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente','solicitada','en_proceso','recibida','cancelada')),
    fecha_solicitud   DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_recepcion   DATE,
    subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
    iva               NUMERIC(10,2) NOT NULL DEFAULT 0,
    total             NUMERIC(10,2) NOT NULL DEFAULT 0,
    notas             TEXT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_estado     ON compras_proveedor(estado);
CREATE INDEX IF NOT EXISTS idx_compras_fecha      ON compras_proveedor(fecha_solicitud DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_compras_proveedor') THEN
        CREATE TRIGGER set_updated_at_compras_proveedor
            BEFORE UPDATE ON compras_proveedor FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── Detalle de items de una compra ───────────────────────────
-- repuesto_id es opcional: permite registrar items que no forman parte del
-- catalogo de inventario (ej. herramientas, insumos de oficina), sin forzar
-- que todo pase por `repuestos`. Cuando SI esta ligado a un repuesto, la
-- Fase 3 usara este campo para actualizar `stock_actual` al marcar la
-- compra como 'recibida', reutilizando la misma logica transaccional que
-- ya usa inventory.controller.js (registrarMovimiento).
CREATE TABLE IF NOT EXISTS compras_proveedor_items (
    id                  SERIAL PRIMARY KEY,
    compra_id           INTEGER NOT NULL REFERENCES compras_proveedor(id) ON DELETE CASCADE,
    repuesto_id         INTEGER REFERENCES repuestos(id) ON DELETE SET NULL,
    descripcion         VARCHAR(200) NOT NULL,
    cantidad            INTEGER NOT NULL CHECK (cantidad > 0),
    cantidad_recibida   INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
    precio_unitario     NUMERIC(10,2) NOT NULL DEFAULT 0,
    subtotal            NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_items_compra    ON compras_proveedor_items(compra_id);
CREATE INDEX IF NOT EXISTS idx_compras_items_repuesto   ON compras_proveedor_items(repuesto_id);

-- ── Historial financiero (movimientos de dinero con proveedores) ─
CREATE TABLE IF NOT EXISTS movimientos_financieros_proveedor (
    id             SERIAL PRIMARY KEY,
    proveedor_id   INTEGER NOT NULL REFERENCES proveedores(id),
    tipo           VARCHAR(20) NOT NULL
                       CHECK (tipo IN ('compra','pago','abono','gasto','cancelacion','ajuste')),
    compra_id      INTEGER REFERENCES compras_proveedor(id) ON DELETE SET NULL,
    gasto_id       INTEGER REFERENCES gastos_proveedor(id) ON DELETE SET NULL,
    descripcion    TEXT,
    monto          NUMERIC(10,2) NOT NULL,
    metodo_pago    VARCHAR(30) CHECK (metodo_pago IN ('efectivo','transferencia','tarjeta','cheque','otro')),
    referencia     VARCHAR(100),
    estado         VARCHAR(20) NOT NULL DEFAULT 'confirmado'
                       CHECK (estado IN ('pendiente','confirmado','anulado')),
    usuario_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movfin_proveedor ON movimientos_financieros_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_movfin_tipo       ON movimientos_financieros_proveedor(tipo);
CREATE INDEX IF NOT EXISTS idx_movfin_fecha      ON movimientos_financieros_proveedor(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movfin_estado     ON movimientos_financieros_proveedor(estado);

-- ============================================================
-- Sprint 11: Indices de rendimiento (Fase 7 - optimizacion final)
-- Las consultas de Graficas/Crecimiento (Fase 4) filtran por fecha en
-- clientes, vehiculos, ordenes_trabajo y citas; solo `movimientos_inventario`
-- y `gastos_proveedor` ya tenian indice util para ese patron.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clientes_created_at  ON clientes(created_at);
CREATE INDEX IF NOT EXISTS idx_vehiculos_created_at ON vehiculos(created_at);
CREATE INDEX IF NOT EXISTS idx_ordenes_created_at   ON ordenes_trabajo(created_at);
CREATE INDEX IF NOT EXISTS idx_citas_fecha           ON citas(fecha);

-- ============================================================
-- Sprint 12: Modulo de Proformas (mecanica y pintura/carroceria)
-- ============================================================

-- Secuencia atomica para el numero de proforma (PROFORMA-000001, ...).
-- Una secuencia nunca repite un valor aunque una transaccion falle despues
-- de pedirlo (puede dejar huecos, pero JAMAS duplica un numero), que es
-- exactamente la garantia que se necesita aqui.
CREATE SEQUENCE IF NOT EXISTS proformas_numero_seq START 1;

CREATE TABLE IF NOT EXISTS proformas (
    id                   SERIAL PRIMARY KEY,
    numero               VARCHAR(20) NOT NULL UNIQUE,
    tipo                 VARCHAR(20) NOT NULL CHECK (tipo IN ('mecanica','pintura')),
    estado               VARCHAR(20) NOT NULL DEFAULT 'borrador'
                             CHECK (estado IN ('borrador','emitida','aprobada','rechazada','vencida','convertida')),

    cliente_id           INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    vehiculo_id          INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL,
    orden_id             INTEGER REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
    orden_generada_id    INTEGER REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
    sucursal_id          INTEGER REFERENCES sucursales(id) ON DELETE SET NULL,
    usuario_id           INTEGER NOT NULL REFERENCES usuarios(id),

    -- Snapshot del cliente al momento de crear/guardar la proforma: si el
    -- cliente cambia de telefono o direccion despues, esta proforma ya
    -- emitida no debe cambiar retroactivamente.
    cliente_nombre       VARCHAR(150) NOT NULL,
    cliente_ruc          VARCHAR(20),
    cliente_direccion    TEXT,
    cliente_telefono     VARCHAR(50),
    cliente_email        VARCHAR(150),

    -- Snapshot del vehiculo. vehiculo_tipo no existe como columna en la
    -- tabla `vehiculos` (no se agrego ahi para no alterar ese catalogo);
    -- aqui es un campo libre que el usuario completa en la proforma.
    vehiculo_marca        VARCHAR(60),
    vehiculo_modelo       VARCHAR(60),
    vehiculo_anio         INTEGER,
    vehiculo_color        VARCHAR(30),
    vehiculo_placa        VARCHAR(20),
    vehiculo_vin          VARCHAR(30),
    vehiculo_tipo         VARCHAR(50),

    fecha_emision         DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_validez         DATE,
    observaciones         TEXT,
    condiciones           TEXT,
    garantia              VARCHAR(255),
    tiempo_estimado       VARCHAR(100),

    descuento             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    -- DEFAULT 0, no 15: el proyecto no tiene una tasa de IVA configurada en
    -- ningun lado (ver decision documentada en proformas.controller.js);
    -- este default corrige una inconsistencia detectada en una revision de
    -- la base de datos (la columna habia quedado en 15 por error).
    iva_porcentaje        NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (iva_porcentaje >= 0),
    anticipo              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (anticipo >= 0),

    -- Totales por seccion + generales. Se recalculan y persisten en cada
    -- guardado desde los items (nunca se piden al frontend como verdad).
    subtotal_productos    NUMERIC(10,2) NOT NULL DEFAULT 0,
    subtotal_servicios    NUMERIC(10,2) NOT NULL DEFAULT 0,
    subtotal_mano_obra    NUMERIC(10,2) NOT NULL DEFAULT 0,
    subtotal_pintura      NUMERIC(10,2) NOT NULL DEFAULT 0,
    subtotal_repuestos    NUMERIC(10,2) NOT NULL DEFAULT 0,
    subtotal_insumos      NUMERIC(10,2) NOT NULL DEFAULT 0,
    subtotal              NUMERIC(10,2) NOT NULL DEFAULT 0,
    iva_valor              NUMERIC(10,2) NOT NULL DEFAULT 0,
    total                  NUMERIC(10,2) NOT NULL DEFAULT 0,
    saldo                  NUMERIC(10,2) NOT NULL DEFAULT 0,

    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proformas_numero    ON proformas(numero);
CREATE INDEX IF NOT EXISTS idx_proformas_cliente    ON proformas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_proformas_vehiculo   ON proformas(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_proformas_estado     ON proformas(estado);
CREATE INDEX IF NOT EXISTS idx_proformas_fecha      ON proformas(fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_proformas_orden      ON proformas(orden_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_proformas') THEN
        CREATE TRIGGER set_updated_at_proformas
            BEFORE UPDATE ON proformas FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── Items de la proforma (productos, servicios, mano de obra, pintura, ─
-- repuestos, insumos) — una sola tabla con `categoria`, igual criterio que
-- ya se uso en movimientos_financieros_proveedor con `tipo`.
CREATE TABLE IF NOT EXISTS proforma_items (
    id                SERIAL PRIMARY KEY,
    proforma_id       INTEGER NOT NULL REFERENCES proformas(id) ON DELETE CASCADE,
    categoria         VARCHAR(20) NOT NULL
                          CHECK (categoria IN ('producto','servicio','mano_obra','pintura','repuesto','insumo')),
    -- Referencia suave (sin FK fisica: puede apuntar a repuestos o a
    -- tipos_servicio segun referencia_tipo, Postgres no permite FK
    -- condicional). Solo es informativa/para re-vincular; el snapshot de
    -- abajo es la fuente de verdad para el documento.
    referencia_tipo   VARCHAR(20) CHECK (referencia_tipo IN ('repuesto','servicio')),
    referencia_id     INTEGER,
    orden_linea       INTEGER NOT NULL DEFAULT 1,
    descripcion       VARCHAR(255) NOT NULL,
    cantidad          NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
    subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proforma_items_proforma ON proforma_items(proforma_id);
CREATE INDEX IF NOT EXISTS idx_proforma_items_categoria ON proforma_items(categoria);

-- Si este archivo ya corrio una vez con el Sprint 12 anterior (default 15),
-- `CREATE TABLE IF NOT EXISTS` no vuelve a aplicar el default nuevo por si
-- solo porque la tabla ya existe — este ALTER si corre siempre y corrige
-- el default para cualquier fila futura que no reciba el valor explicito
-- (la app SIEMPRE lo envia explicito, asi que esto es solo una red de
-- seguridad a nivel de base de datos).
ALTER TABLE proformas ALTER COLUMN iva_porcentaje SET DEFAULT 0;

-- ============================================================
-- Sprint 13: Cuentas por Cobrar de Clientes ("Pagare")
-- Contraparte, del lado de clientes, de lo que `movimientos_financieros_
-- proveedor` ya hace del lado de proveedores: deja ver quien debe, cuanto,
-- y registrar pagos/abonos hasta saldar la cuenta.
-- ============================================================

CREATE TABLE IF NOT EXISTS cuentas_cobrar (
    id                 SERIAL PRIMARY KEY,
    -- Sin ON DELETE CASCADE/SET NULL a proposito: un cliente con una cuenta
    -- por cobrar (pagada o no) no se puede eliminar fisicamente, para que
    -- el historial de deuda/pago nunca se pierda. Mismo criterio que ya
    -- aplica (sin querer, pero correctamente) a ordenes_trabajo.cliente_id.
    cliente_id         INTEGER NOT NULL REFERENCES clientes(id),
    -- Origen opcional: una cuenta puede nacer del saldo pendiente de una
    -- proforma/orden, o registrarse manualmente (reparacion sin proforma,
    -- deuda historica, etc.).
    proforma_id        INTEGER REFERENCES proformas(id) ON DELETE SET NULL,
    orden_id           INTEGER REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
    concepto           VARCHAR(255) NOT NULL,
    monto_total        NUMERIC(10,2) NOT NULL CHECK (monto_total > 0),
    monto_pagado       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0),
    estado             VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                           CHECK (estado IN ('pendiente','parcial','pagado','vencido','anulado')),
    fecha              DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento  DATE,
    notas              TEXT,
    usuario_id         INTEGER NOT NULL REFERENCES usuarios(id),
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cuentas_cobrar_cliente ON cuentas_cobrar(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_cobrar_estado  ON cuentas_cobrar(estado);
CREATE INDEX IF NOT EXISTS idx_cuentas_cobrar_fecha   ON cuentas_cobrar(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_cuentas_cobrar_venc    ON cuentas_cobrar(fecha_vencimiento);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_cuentas_cobrar') THEN
        CREATE TRIGGER set_updated_at_cuentas_cobrar
            BEFORE UPDATE ON cuentas_cobrar FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── Historial de pagos/abonos de una cuenta por cobrar ───────
CREATE TABLE IF NOT EXISTS pagos_cliente (
    id          SERIAL PRIMARY KEY,
    cuenta_id   INTEGER NOT NULL REFERENCES cuentas_cobrar(id) ON DELETE CASCADE,
    monto       NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
    metodo_pago VARCHAR(30) CHECK (metodo_pago IN ('efectivo','transferencia','tarjeta','cheque','otro')),
    referencia  VARCHAR(100),
    notas       TEXT,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_cliente_cuenta ON pagos_cliente(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_fecha  ON pagos_cliente(fecha DESC);

-- ============================================================
-- Sprint 14: Inventario por areas + salida de inventario desde
-- proformas + pictograma de colisiones + pagare automatico (70%)
-- + datos bancarios de pagos.
--
-- Bloque 100% ADITIVO e IDEMPOTENTE: se puede correr varias veces en el
-- SQL Editor de Supabase sin duplicar nada. No borra ni renombra ninguna
-- tabla/columna existente. Las conversiones de tipo (INTEGER -> NUMERIC)
-- solo se ejecutan si la columna todavia es INTEGER.
-- ============================================================

-- ── 14.1 Inventario: dos areas (Mecanica / Colisiones-Pintura) ──────
-- Un solo catalogo `repuestos` con columna `area`: evita duplicar el modulo
-- y permite agregar mas areas en el futuro ampliando solo el CHECK.
ALTER TABLE repuestos ADD COLUMN IF NOT EXISTS area VARCHAR(20) NOT NULL DEFAULT 'mecanica';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'repuestos_area_check') THEN
        ALTER TABLE repuestos ADD CONSTRAINT repuestos_area_check CHECK (area IN ('mecanica','colisiones'));
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_repuestos_area ON repuestos(area);

-- Categorias tambien pueden pertenecer a un area (NULL = compartida).
ALTER TABLE categorias_repuesto ADD COLUMN IF NOT EXISTS area VARCHAR(20);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categorias_repuesto_area_check') THEN
        ALTER TABLE categorias_repuesto ADD CONSTRAINT categorias_repuesto_area_check
            CHECK (area IS NULL OR area IN ('mecanica','colisiones'));
    END IF;
END $$;

-- Categorias base del area de colisiones/pintura (catalogo, no datos de prueba).
-- (Sprint 22: "solo si no existe" en vez de ON CONFLICT (nombre), porque el
--  nombre ahora es unico por empresa; al volver a correr no inserta nada.)
INSERT INTO categorias_repuesto (nombre, descripcion, area)
SELECT v.nombre, v.descripcion, v.area FROM (VALUES
    ('Pinturas',             'Pinturas base, bicapa y tricapa',                 'colisiones'),
    ('Masillas',             'Masillas de relleno y acabado',                   'colisiones'),
    ('Lijas y Abrasivos',    'Lijas al agua/seco, discos, esponjas abrasivas',  'colisiones'),
    ('Primers y Barnices',   'Fondos, primers, selladores y barnices (clear)',  'colisiones'),
    ('Diluyentes y Solventes','Thinner, reductores, desengrasantes',            'colisiones'),
    ('Materiales de Reparacion','Cintas, plasticos, enderezado y otros insumos','colisiones')
) AS v(nombre, descripcion, area)
WHERE NOT EXISTS (SELECT 1 FROM categorias_repuesto c WHERE c.nombre = v.nombre);

-- ── 14.2 Stock decimal (litros/galones parciales de pintura) ─────────
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'repuestos' AND column_name = 'stock_actual') = 'integer' THEN
        ALTER TABLE repuestos ALTER COLUMN stock_actual TYPE NUMERIC(10,2);
        ALTER TABLE repuestos ALTER COLUMN stock_minimo TYPE NUMERIC(10,2);
    END IF;
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_name = 'movimientos_inventario' AND column_name = 'cantidad') = 'integer' THEN
        ALTER TABLE movimientos_inventario ALTER COLUMN cantidad       TYPE NUMERIC(10,2);
        ALTER TABLE movimientos_inventario ALTER COLUMN stock_anterior TYPE NUMERIC(10,2);
        ALTER TABLE movimientos_inventario ALTER COLUMN stock_nuevo    TYPE NUMERIC(10,2);
    END IF;
END $$;
-- Red de seguridad a nivel BD: el stock nunca puede quedar negativo.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'repuestos_stock_no_negativo') THEN
        ALTER TABLE repuestos ADD CONSTRAINT repuestos_stock_no_negativo CHECK (stock_actual >= 0) NOT VALID;
    END IF;
END $$;

-- ── 14.3 Origen y trazabilidad de cada movimiento ─────────────────────
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'manual';
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS area VARCHAR(20);
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS proforma_id INTEGER REFERENCES proformas(id) ON DELETE RESTRICT;
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS proforma_item_id INTEGER REFERENCES proforma_items(id) ON DELETE SET NULL;
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS orden_id INTEGER REFERENCES ordenes_trabajo(id) ON DELETE SET NULL;
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS compra_id INTEGER REFERENCES compras_proveedor(id) ON DELETE SET NULL;
-- Para devoluciones: movimiento de salida que se esta revirtiendo.
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS movimiento_revertido_id INTEGER REFERENCES movimientos_inventario(id) ON DELETE RESTRICT;
-- Precio unitario historico del movimiento: en salidas por proforma es el
-- precio COBRADO en la proforma (lo usan las graficas); en entradas por
-- compra es el costo de compra. NULL en movimientos anteriores al Sprint 14.
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(10,2);
-- Marca (no borra) una salida por proforma que fue devuelta al inventario
-- mediante un movimiento de 'devolucion'. El historial nunca se pierde.
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS revertido_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_origen_check') THEN
        ALTER TABLE movimientos_inventario ADD CONSTRAINT movimientos_inventario_origen_check
            CHECK (origen IN ('manual','compra','proforma','ajuste','devolucion'));
    END IF;
END $$;

-- Clasificacion retroactiva de movimientos existentes (solo los que siguen
-- con el default 'manual' y se pueden identificar con certeza).
UPDATE movimientos_inventario
   SET origen = 'compra',
       compra_id = NULLIF(regexp_replace(referencia, '^COMPRA-', ''), '')::int
 WHERE origen = 'manual' AND referencia ~ '^COMPRA-[0-9]+$'
   AND EXISTS (SELECT 1 FROM compras_proveedor cp WHERE cp.id = NULLIF(regexp_replace(referencia, '^COMPRA-', ''), '')::int);
UPDATE movimientos_inventario m SET area = r.area
  FROM repuestos r WHERE r.id = m.repuesto_id AND m.area IS NULL;

-- GARANTIA ANTI DOBLE DESCUENTO: un item de proforma solo puede tener UNA
-- salida activa (no revertida). Aunque la peticion se reintente o llegue
-- dos veces en paralelo, Postgres rechaza la segunda insercion.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mov_salida_por_item_proforma
    ON movimientos_inventario(proforma_item_id)
    WHERE origen = 'proforma' AND tipo = 'salida' AND revertido_at IS NULL;
-- Una salida solo se puede devolver una vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mov_devolucion_unica
    ON movimientos_inventario(movimiento_revertido_id)
    WHERE movimiento_revertido_id IS NOT NULL;

-- Un item de proforma con una salida ACTIVA (no devuelta) no se puede
-- borrar: protege contra editar/eliminar una proforma que ya desconto
-- inventario aunque alguien salte la validacion de la API.
CREATE OR REPLACE FUNCTION proteger_item_proforma_con_salida()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM movimientos_inventario
               WHERE proforma_item_id = OLD.id AND origen = 'proforma'
                 AND tipo = 'salida' AND revertido_at IS NULL) THEN
        RAISE EXCEPTION 'El item % de la proforma ya genero una salida de inventario y no se puede eliminar.', OLD.id
            USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_proteger_item_proforma_con_salida') THEN
        CREATE TRIGGER trg_proteger_item_proforma_con_salida
            BEFORE DELETE ON proforma_items FOR EACH ROW EXECUTE FUNCTION proteger_item_proforma_con_salida();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mov_origen    ON movimientos_inventario(origen);
CREATE INDEX IF NOT EXISTS idx_mov_proforma  ON movimientos_inventario(proforma_id);
CREATE INDEX IF NOT EXISTS idx_mov_orden     ON movimientos_inventario(orden_id);
CREATE INDEX IF NOT EXISTS idx_mov_usuario   ON movimientos_inventario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mov_area      ON movimientos_inventario(area);

-- ── 14.4 Proformas: salida de inventario + pictograma de colisiones ──
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS inventario_descontado_at  TIMESTAMP WITH TIME ZONE;
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS inventario_descontado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS carroceria_tipo     VARCHAR(20);
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS carroceria_puertas  SMALLINT;
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS danos_observaciones TEXT;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proformas_carroceria_tipo_check') THEN
        ALTER TABLE proformas ADD CONSTRAINT proformas_carroceria_tipo_check
            CHECK (carroceria_tipo IS NULL OR carroceria_tipo IN ('pickup','hatchback','sedan','suv'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proformas_carroceria_puertas_check') THEN
        ALTER TABLE proformas ADD CONSTRAINT proformas_carroceria_puertas_check
            CHECK (carroceria_puertas IS NULL OR carroceria_puertas IN (2,3,4,5));
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_proformas_carroceria ON proformas(carroceria_tipo);

-- Zonas danadas marcadas MANUALMENTE en el pictograma. Tabla relacional
-- (no texto) para poder consultar zona por zona (ej. "cuantas reparaciones
-- de parachoques delantero este mes").
CREATE TABLE IF NOT EXISTS proforma_zonas_danadas (
    id           SERIAL PRIMARY KEY,
    proforma_id  INTEGER NOT NULL REFERENCES proformas(id) ON DELETE CASCADE,
    zona         VARCHAR(40) NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (proforma_id, zona)
);
CREATE INDEX IF NOT EXISTS idx_zonas_danadas_zona ON proforma_zonas_danadas(zona);

-- ── 14.5 Pagare automatico (70%) ─────────────────────────────────────
ALTER TABLE cuentas_cobrar ADD COLUMN IF NOT EXISTS vehiculo_id INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL;
ALTER TABLE cuentas_cobrar ADD COLUMN IF NOT EXISTS monto_base  NUMERIC(10,2);
ALTER TABLE cuentas_cobrar ADD COLUMN IF NOT EXISTS porcentaje  NUMERIC(5,2);
ALTER TABLE cuentas_cobrar ADD COLUMN IF NOT EXISTS origen      VARCHAR(20) NOT NULL DEFAULT 'manual';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_cobrar_origen_check') THEN
        ALTER TABLE cuentas_cobrar ADD CONSTRAINT cuentas_cobrar_origen_check CHECK (origen IN ('manual','automatico'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_cobrar_porcentaje_check') THEN
        ALTER TABLE cuentas_cobrar ADD CONSTRAINT cuentas_cobrar_porcentaje_check
            CHECK (porcentaje IS NULL OR (porcentaje > 0 AND porcentaje <= 100));
    END IF;
END $$;
-- GARANTIA ANTI DUPLICADO: una proforma (y una orden) genera como maximo un
-- pagare automatico no anulado.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cuenta_auto_por_proforma
    ON cuentas_cobrar(proforma_id) WHERE origen = 'automatico' AND estado <> 'anulado';
CREATE UNIQUE INDEX IF NOT EXISTS uq_cuenta_auto_por_orden
    ON cuentas_cobrar(orden_id) WHERE origen = 'automatico' AND estado <> 'anulado';
CREATE INDEX IF NOT EXISTS idx_cuentas_cobrar_proforma ON cuentas_cobrar(proforma_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_cobrar_orden    ON cuentas_cobrar(orden_id);

-- ── 14.6 Detalle de pagos (transferencia / cheque / tarjeta) ─────────
-- Columnas tipadas (no un JSON libre) para poder buscar luego por banco,
-- numero de comprobante o numero de cheque.
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS banco              VARCHAR(100);
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS numero_cuenta      VARCHAR(40);
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS tipo_cuenta        VARCHAR(20);
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS titular            VARCHAR(150);
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS numero_comprobante VARCHAR(60);
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS numero_cheque      VARCHAR(40);
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS fecha_documento    DATE;
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS tarjeta_tipo       VARCHAR(20);
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS tarjeta_ultimos4   VARCHAR(4);
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS autorizacion       VARCHAR(40);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_cliente_tipo_cuenta_check') THEN
        ALTER TABLE pagos_cliente ADD CONSTRAINT pagos_cliente_tipo_cuenta_check
            CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('ahorros','corriente'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_cliente_tarjeta_tipo_check') THEN
        ALTER TABLE pagos_cliente ADD CONSTRAINT pagos_cliente_tarjeta_tipo_check
            CHECK (tarjeta_tipo IS NULL OR tarjeta_tipo IN ('credito','debito'));
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_comprobante ON pagos_cliente(numero_comprobante);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_cheque      ON pagos_cliente(numero_cheque);

-- ============================================================
-- Sprint 15: Endurecimiento de la base de datos
--  - Catalogos (tablas cat_*) con el significado UNICO de cada codigo
--    (areas de inventario, metodos de pago, tipos de proforma, origenes
--    de movimiento) y llaves foraneas hacia ellos.
--  - Pagos de clientes ANULABLES (ya no se borran) para no perder dinero
--    registrado.
--  - Numero visible de la orden de trabajo (OT-000123) guardado en la tabla.
--  - Llaves foraneas que borraban historial en cascada pasan a RESTRICT.
--  - Restricciones de coherencia, indices faltantes, vistas de consulta y
--    comentarios (COMMENT ON) que documentan cada tabla.
-- Idempotente y aditivo: se puede correr varias veces.
-- ============================================================

-- ── 15.1 Catalogos ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cat_areas_inventario (
    codigo       VARCHAR(20) PRIMARY KEY,
    nombre       VARCHAR(80)  NOT NULL,
    descripcion  TEXT,
    orden        SMALLINT NOT NULL DEFAULT 0,
    activo       BOOLEAN  NOT NULL DEFAULT TRUE
);
INSERT INTO cat_areas_inventario (codigo, nombre, descripcion, orden) VALUES
    ('mecanica',   'Inventario Mecánica',             'Repuestos, componentes mecánicos y eléctricos, filtros, baterías, accesorios', 1),
    ('colisiones', 'Inventario Colisiones / Pintura', 'Pinturas, masillas, primer, lijas, barniz, diluyentes y materiales de carrocería', 2)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS cat_metodos_pago (
    codigo             VARCHAR(30) PRIMARY KEY,
    nombre             VARCHAR(60) NOT NULL,
    -- Campos de pagos_cliente que el formulario exige para este metodo.
    campos_requeridos  TEXT[] NOT NULL DEFAULT '{}',
    orden              SMALLINT NOT NULL DEFAULT 0,
    activo             BOOLEAN  NOT NULL DEFAULT TRUE
);
INSERT INTO cat_metodos_pago (codigo, nombre, campos_requeridos, orden) VALUES
    ('efectivo',      'Efectivo',      '{}', 1),
    ('transferencia', 'Transferencia', '{banco,numero_cuenta,titular,numero_comprobante,fecha_documento}', 2),
    ('cheque',        'Cheque',        '{banco,numero_cheque,numero_cuenta,titular,fecha_documento}', 3),
    ('tarjeta',       'Tarjeta',       '{tarjeta_tipo,autorizacion}', 4),
    ('otro',          'Otro',          '{}', 5)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS cat_tipos_proforma (
    codigo       VARCHAR(20) PRIMARY KEY,
    nombre       VARCHAR(80) NOT NULL,
    descripcion  TEXT,
    orden        SMALLINT NOT NULL DEFAULT 0
);
-- El codigo interno 'pintura' se conserva (hay proformas guardadas con el),
-- pero su nombre oficial es "Colisiones / Pintura": aqui queda documentado.
INSERT INTO cat_tipos_proforma (codigo, nombre, descripcion, orden) VALUES
    ('mecanica', 'Mecánica',             'Productos/repuestos y servicios de mecánica', 1),
    ('pintura',  'Colisiones / Pintura', 'Carrocería, pintura y colisiones; incluye pictograma de daños', 2)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS cat_origenes_movimiento (
    codigo              VARCHAR(20) PRIMARY KEY,
    nombre              VARCHAR(80) NOT NULL,
    tipo_permitido      VARCHAR(10) CHECK (tipo_permitido IS NULL OR tipo_permitido IN ('entrada','salida')),
    registrable_manual  BOOLEAN NOT NULL DEFAULT FALSE,
    descripcion         TEXT
);
INSERT INTO cat_origenes_movimiento (codigo, nombre, tipo_permitido, registrable_manual, descripcion) VALUES
    ('manual',     'Entrada / salida manual', NULL,      TRUE,  'Registrado a mano desde Inventario o Registrar'),
    ('compra',     'Entrada por compra',      'entrada', FALSE, 'Recepción de una compra a proveedor'),
    ('proforma',   'Salida por proforma',     'salida',  FALSE, 'Confirmación del uso de materiales de una proforma'),
    ('ajuste',     'Ajuste de inventario',    NULL,      TRUE,  'Conteo físico, merma o daño'),
    ('devolucion', 'Devolución',              'entrada', TRUE,  'Material devuelto al inventario')
ON CONFLICT (codigo) DO NOTHING;

-- Llaves foraneas hacia los catalogos. Las areas ya no dependen de un
-- CHECK fijo: para agregar un area nueva basta con insertarla en
-- cat_areas_inventario (escalable).
ALTER TABLE repuestos DROP CONSTRAINT IF EXISTS repuestos_area_check;
ALTER TABLE categorias_repuesto DROP CONSTRAINT IF EXISTS categorias_repuesto_area_check;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_repuestos_area') THEN
        ALTER TABLE repuestos ADD CONSTRAINT fk_repuestos_area FOREIGN KEY (area) REFERENCES cat_areas_inventario(codigo) ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_categorias_area') THEN
        ALTER TABLE categorias_repuesto ADD CONSTRAINT fk_categorias_area FOREIGN KEY (area) REFERENCES cat_areas_inventario(codigo) ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_movimientos_area') THEN
        ALTER TABLE movimientos_inventario ADD CONSTRAINT fk_movimientos_area FOREIGN KEY (area) REFERENCES cat_areas_inventario(codigo) ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_movimientos_origen') THEN
        ALTER TABLE movimientos_inventario ADD CONSTRAINT fk_movimientos_origen FOREIGN KEY (origen) REFERENCES cat_origenes_movimiento(codigo) ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_proformas_tipo') THEN
        ALTER TABLE proformas ADD CONSTRAINT fk_proformas_tipo FOREIGN KEY (tipo) REFERENCES cat_tipos_proforma(codigo) ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pagos_cliente_metodo') THEN
        ALTER TABLE pagos_cliente ADD CONSTRAINT fk_pagos_cliente_metodo FOREIGN KEY (metodo_pago) REFERENCES cat_metodos_pago(codigo) ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_gastos_proveedor_metodo') THEN
        ALTER TABLE gastos_proveedor ADD CONSTRAINT fk_gastos_proveedor_metodo FOREIGN KEY (metodo_pago) REFERENCES cat_metodos_pago(codigo) ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_movfin_proveedor_metodo') THEN
        ALTER TABLE movimientos_financieros_proveedor ADD CONSTRAINT fk_movfin_proveedor_metodo FOREIGN KEY (metodo_pago) REFERENCES cat_metodos_pago(codigo) ON UPDATE CASCADE;
    END IF;
END $$;

-- ── 15.2 Llaves que borraban historial en cascada -> RESTRICT ─────────
-- Borrar un repuesto ya no elimina en silencio sus movimientos (la API
-- decide que hacer), y borrar una cuenta por cobrar no elimina sus pagos.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_repuesto_id_fkey' AND confdeltype = 'c') THEN
        ALTER TABLE movimientos_inventario DROP CONSTRAINT movimientos_inventario_repuesto_id_fkey;
        ALTER TABLE movimientos_inventario ADD CONSTRAINT movimientos_inventario_repuesto_id_fkey
            FOREIGN KEY (repuesto_id) REFERENCES repuestos(id) ON DELETE RESTRICT;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_cliente_cuenta_id_fkey' AND confdeltype = 'c') THEN
        ALTER TABLE pagos_cliente DROP CONSTRAINT pagos_cliente_cuenta_id_fkey;
        ALTER TABLE pagos_cliente ADD CONSTRAINT pagos_cliente_cuenta_id_fkey
            FOREIGN KEY (cuenta_id) REFERENCES cuentas_cobrar(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- ── 15.3 Pagos anulables (nunca se borra dinero registrado) ──────────
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS anulado_at        TIMESTAMP WITH TIME ZONE;
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS anulado_por       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE pagos_cliente ADD COLUMN IF NOT EXISTS motivo_anulacion  VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_activos ON pagos_cliente(cuenta_id) WHERE anulado_at IS NULL;

-- Lo pagado nunca puede superar lo que se debe (red de seguridad).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_cobrar_pagado_no_excede') THEN
        ALTER TABLE cuentas_cobrar ADD CONSTRAINT cuentas_cobrar_pagado_no_excede
            CHECK (monto_pagado <= monto_total + 0.01) NOT VALID;
    END IF;
END $$;

-- ── 15.4 Numero visible de la orden de trabajo ──────────────────
-- Columna generada: siempre coincide con el id, nunca se escribe a mano.
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS numero VARCHAR(20)
    GENERATED ALWAYS AS ('OT-' || LPAD(id::text, 6, '0')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ordenes_trabajo_numero ON ordenes_trabajo(numero);

-- ── 15.5 Indices que faltaban para las consultas nuevas ─────────
CREATE INDEX IF NOT EXISTS idx_proformas_orden_generada ON proformas(orden_generada_id);
CREATE INDEX IF NOT EXISTS idx_proformas_tipo           ON proformas(tipo);
CREATE INDEX IF NOT EXISTS idx_proforma_items_referencia ON proforma_items(referencia_tipo, referencia_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_cobrar_vehiculo  ON cuentas_cobrar(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_cobrar_origen    ON cuentas_cobrar(origen);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_metodo     ON pagos_cliente(metodo_pago);
CREATE INDEX IF NOT EXISTS idx_mov_repuesto_fecha       ON movimientos_inventario(repuesto_id, created_at DESC);

-- ── 15.6 Vistas de consulta (para reportes y para revisar a mano) ─
CREATE OR REPLACE VIEW v_movimientos_inventario_detalle AS
SELECT m.id, m.created_at, m.tipo, m.origen, co.nombre AS origen_nombre,
       COALESCE(m.area, r.area) AS area, ca.nombre AS area_nombre,
       r.id AS repuesto_id, r.codigo AS repuesto_codigo, r.nombre AS repuesto_nombre,
       m.cantidad, m.stock_anterior, m.stock_nuevo, m.precio_unitario,
       u.nombre AS usuario_nombre,
       p.numero AS proforma_numero, o.numero AS orden_numero,
       COALESCE(p.cliente_nombre, c.nombre) AS cliente_nombre,
       COALESCE(p.vehiculo_placa, v.placa) AS vehiculo_placa,
       m.motivo, m.referencia, m.revertido_at
FROM movimientos_inventario m
JOIN repuestos r ON r.id = m.repuesto_id
JOIN usuarios u ON u.id = m.usuario_id
LEFT JOIN cat_origenes_movimiento co ON co.codigo = m.origen
LEFT JOIN cat_areas_inventario ca ON ca.codigo = COALESCE(m.area, r.area)
LEFT JOIN proformas p ON p.id = m.proforma_id
LEFT JOIN ordenes_trabajo o ON o.id = m.orden_id
LEFT JOIN clientes c ON c.id = COALESCE(p.cliente_id, o.cliente_id)
LEFT JOIN vehiculos v ON v.id = COALESCE(p.vehiculo_id, o.vehiculo_id);

CREATE OR REPLACE VIEW v_cuentas_cobrar_detalle AS
SELECT cc.id, cc.origen, cc.estado, cc.fecha, cc.fecha_vencimiento,
       c.id AS cliente_id, c.nombre AS cliente_nombre,
       COALESCE(v.placa, p.vehiculo_placa) AS vehiculo_placa,
       o.numero AS orden_numero, p.numero AS proforma_numero,
       cc.monto_base, cc.porcentaje, cc.monto_total, cc.monto_pagado,
       (cc.monto_total - cc.monto_pagado) AS saldo,
       (SELECT COUNT(*) FROM pagos_cliente pc WHERE pc.cuenta_id = cc.id AND pc.anulado_at IS NULL) AS pagos_activos,
       (SELECT COUNT(*) FROM pagos_cliente pc WHERE pc.cuenta_id = cc.id AND pc.anulado_at IS NOT NULL) AS pagos_anulados
FROM cuentas_cobrar cc
JOIN clientes c ON c.id = cc.cliente_id
LEFT JOIN proformas p ON p.id = cc.proforma_id
LEFT JOIN ordenes_trabajo o ON o.id = cc.orden_id
LEFT JOIN vehiculos v ON v.id = COALESCE(cc.vehiculo_id, p.vehiculo_id);

-- ── 15.7 Documentacion dentro de la base (visible en Supabase) ───
COMMENT ON TABLE repuestos IS 'Catalogo unico de productos del inventario. La columna area (cat_areas_inventario) separa Inventario Mecanica de Inventario Colisiones/Pintura.';
COMMENT ON COLUMN repuestos.stock_actual IS 'Stock actual (decimal). Solo cambia mediante movimientos_inventario.';
COMMENT ON TABLE movimientos_inventario IS 'Historial de TODA entrada/salida de stock. origen (cat_origenes_movimiento) indica si fue manual, compra, proforma, ajuste o devolucion.';
COMMENT ON COLUMN movimientos_inventario.precio_unitario IS 'Precio historico: en salidas por proforma = precio cobrado; en entradas por compra = costo.';
COMMENT ON COLUMN movimientos_inventario.revertido_at IS 'Salida por proforma devuelta al inventario (ver movimiento con movimiento_revertido_id).';
COMMENT ON TABLE proformas IS 'Cotizaciones. tipo: mecanica | pintura (= Colisiones / Pintura, ver cat_tipos_proforma).';
COMMENT ON COLUMN proformas.inventario_descontado_at IS 'Momento en que se confirmo el uso de materiales (salida de inventario). Si tiene valor, la proforma ya no se edita.';
COMMENT ON TABLE proforma_zonas_danadas IS 'Zonas del pictograma marcadas manualmente como dañadas (codigos de shared/vehiculoDiagramas.js).';
COMMENT ON TABLE cuentas_cobrar IS 'Pagares / cuentas por cobrar. origen=automatico: 70% del total de la proforma al convertirla en orden.';
COMMENT ON COLUMN cuentas_cobrar.monto_base IS 'Total de la proforma/orden (100%). monto_total = lo que se cobra (70% en pagares automaticos).';
COMMENT ON TABLE pagos_cliente IS 'Pagos/abonos a una cuenta por cobrar. Nunca se borran: se anulan (anulado_at) y dejan de contar en monto_pagado.';
COMMENT ON COLUMN ordenes_trabajo.numero IS 'Numero visible OT-000123, generado a partir del id.';
COMMENT ON TABLE cat_areas_inventario IS 'Catalogo de areas de inventario. Agregar una fila crea un nuevo inventario.';
COMMENT ON TABLE cat_metodos_pago IS 'Catalogo de metodos de pago y los datos obligatorios de cada uno.';

-- ============================================================
-- Sprint 16: Robustez de la base de datos
--   16.1 Correccion de correos demo con espacio ("@SS SWAP.com")
--   16.2 Modulo de Caja (tablas que usaba caja.controller.js)
--   16.3 Indices en todas las claves foraneas que no tenian
--   16.4 Reglas de validacion (CHECK) + validar las NOT VALID previas
--   16.5 Unicidad: una sola sucursal principal, RUC de proveedor unico
--
-- Bloque 100% ADITIVO e IDEMPOTENTE. Las restricciones nuevas se crean
-- NOT VALID (no fallan si hubiera datos antiguos fuera de regla) y luego
-- se intenta validarlas; si un dato viejo no cumple, solo se avisa.
-- ============================================================

-- ── 16.1 Correos demo dañados por un buscar/reemplazar ──────────
UPDATE usuarios u SET email = REPLACE(u.email, '@SS SWAP.com', '@ssswap.com')
WHERE u.email LIKE '%@SS SWAP.com'
  AND NOT EXISTS (SELECT 1 FROM usuarios x WHERE x.email = REPLACE(u.email, '@SS SWAP.com', '@ssswap.com'));
UPDATE sucursales  SET email = REPLACE(email, '@SS SWAP.com', '@ssswap.com') WHERE email LIKE '%@SS SWAP.com';
UPDATE proveedores SET email = REPLACE(email, '@SS SWAP.com', '@ssswap.com') WHERE email LIKE '%@SS SWAP.com';

-- ── 16.2 Caja diaria: sesiones (apertura/cierre) y movimientos ──
CREATE TABLE IF NOT EXISTS caja_sesiones (
    id                    SERIAL PRIMARY KEY,
    sucursal_id           INTEGER REFERENCES sucursales(id) ON DELETE SET NULL,
    usuario_apertura_id   INTEGER NOT NULL REFERENCES usuarios(id),
    usuario_cierre_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    estado                VARCHAR(10) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
    monto_apertura        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monto_apertura >= 0),
    monto_cierre_esperado NUMERIC(10,2),
    monto_cierre_real     NUMERIC(10,2) CHECK (monto_cierre_real IS NULL OR monto_cierre_real >= 0),
    diferencia            NUMERIC(10,2),
    notas_apertura        TEXT,
    notas_cierre          TEXT,
    fecha_apertura        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    fecha_cierre          TIMESTAMP WITH TIME ZONE,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT caja_sesiones_cierre_coherente CHECK (estado = 'abierta' OR fecha_cierre IS NOT NULL)
);
-- Solo puede haber UNA caja abierta a la vez (protege contra dobles clics).
CREATE UNIQUE INDEX IF NOT EXISTS uq_caja_sesion_abierta ON caja_sesiones ((estado)) WHERE estado = 'abierta';
CREATE INDEX IF NOT EXISTS idx_caja_sesiones_fecha    ON caja_sesiones(fecha_apertura DESC);
CREATE INDEX IF NOT EXISTS idx_caja_sesiones_sucursal ON caja_sesiones(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_caja_sesiones_usuario  ON caja_sesiones(usuario_apertura_id);

CREATE TABLE IF NOT EXISTS caja_movimientos (
    id              SERIAL PRIMARY KEY,
    caja_sesion_id  INTEGER NOT NULL REFERENCES caja_sesiones(id) ON DELETE RESTRICT,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','egreso')),
    concepto        VARCHAR(255) NOT NULL,
    monto           NUMERIC(10,2) NOT NULL CONSTRAINT caja_movimientos_monto_check CHECK (monto > 0),
    metodo_pago     VARCHAR(30) NOT NULL DEFAULT 'efectivo' REFERENCES cat_metodos_pago(codigo) ON UPDATE CASCADE,
    referencia      VARCHAR(100),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_caja_mov_sesion  ON caja_movimientos(caja_sesion_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_usuario ON caja_movimientos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_fecha   ON caja_movimientos(created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_caja_sesiones') THEN
        CREATE TRIGGER set_updated_at_caja_sesiones
            BEFORE UPDATE ON caja_sesiones FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

COMMENT ON TABLE caja_sesiones IS 'Apertura/cierre de caja diaria. Solo una sesion abierta a la vez (uq_caja_sesion_abierta).';
COMMENT ON TABLE caja_movimientos IS 'Ingresos y egresos de efectivo registrados durante una sesion de caja.';

-- ── 16.3 Indices en claves foraneas (JOINs y borrados mas rapidos) ─
CREATE INDEX IF NOT EXISTS idx_citas_usuario              ON citas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_citas_servicio             ON citas(servicio_id);
CREATE INDEX IF NOT EXISTS idx_citas_vehiculo             ON citas(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_compras_usuario            ON compras_proveedor(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_cobrar_usuario     ON cuentas_cobrar(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gastos_usuario             ON gastos_proveedor(usuario_id);
CREATE INDEX IF NOT EXISTS idx_movfin_compra              ON movimientos_financieros_proveedor(compra_id);
CREATE INDEX IF NOT EXISTS idx_movfin_gasto               ON movimientos_financieros_proveedor(gasto_id);
CREATE INDEX IF NOT EXISTS idx_movfin_usuario             ON movimientos_financieros_proveedor(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mov_compra                 ON movimientos_inventario(compra_id);
CREATE INDEX IF NOT EXISTS idx_mov_proforma_item          ON movimientos_inventario(proforma_item_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_historial_usuario  ON ordenes_historial(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_usuario            ON ordenes_trabajo(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_usuario      ON pagos_cliente(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_anulado_por  ON pagos_cliente(anulado_por);
CREATE INDEX IF NOT EXISTS idx_proformas_sucursal         ON proformas(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_proformas_usuario          ON proformas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_proformas_descontado_por   ON proformas(inventario_descontado_por);
CREATE INDEX IF NOT EXISTS idx_repuestos_categoria        ON repuestos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_categorias_repuesto_area   ON categorias_repuesto(area);
CREATE INDEX IF NOT EXISTS idx_solicitudes_repuesto       ON solicitudes_producto(repuesto_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario        ON solicitudes_producto(usuario_id);
-- El panel del cliente, citas y solicitudes buscan la ficha por LOWER(email).
CREATE INDEX IF NOT EXISTS idx_clientes_email_lower       ON clientes(LOWER(email));

-- ── 16.4 Reglas de validacion ───────────────────────────────────
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('repuestos',               'repuestos_precios_no_negativos',    'precio_compra >= 0 AND precio_venta >= 0 AND stock_minimo >= 0'),
        ('tipos_servicio',          'tipos_servicio_valores_validos',    'precio_base >= 0 AND (duracion_estimada_min IS NULL OR duracion_estimada_min > 0)'),
        ('vehiculos',               'vehiculos_anio_valido',             'anio IS NULL OR anio BETWEEN 1900 AND 2100'),
        ('ordenes_trabajo',         'ordenes_trabajo_km_no_negativo',    'kilometraje IS NULL OR kilometraje >= 0'),
        ('citas',                   'citas_horario_valido',              'hora_fin > hora_inicio'),
        ('cuentas_cobrar',          'cuentas_cobrar_vencimiento_valido', 'fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha'),
        ('compras_proveedor',       'compras_proveedor_montos_validos',  'subtotal >= 0 AND iva >= 0 AND total >= 0'),
        ('compras_proveedor_items', 'compras_items_recibido_valido',     'cantidad_recibida <= cantidad AND precio_unitario >= 0')
    ) AS t(tabla, nombre, expr)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.nombre) THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s) NOT VALID', r.tabla, r.nombre, r.expr);
        END IF;
    END LOOP;

    -- Validar contra los datos existentes todas las restricciones que
    -- sigan NOT VALID (incluidas las de sprints anteriores).
    FOR r IN SELECT conrelid::regclass::text AS tabla, conname AS nombre
             FROM pg_constraint
             WHERE NOT convalidated AND contype IN ('c','f')
               AND connamespace = 'public'::regnamespace
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', r.tabla, r.nombre);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Restriccion % en % queda NOT VALID: hay datos antiguos que no la cumplen (%).', r.nombre, r.tabla, SQLERRM;
        END;
    END LOOP;
END $$;

-- ── 16.5 Unicidad ───────────────────────────────────────────────
-- Una sola sucursal principal (el controller ya desmarca la anterior).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_sucursal_principal')
       AND (SELECT COUNT(*) FROM sucursales WHERE es_principal) <= 1 THEN
        CREATE UNIQUE INDEX uq_sucursal_principal ON sucursales ((es_principal)) WHERE es_principal;
    END IF;
END $$;
-- RUC de proveedor unico (si se informa). Se crea solo si no hay duplicados.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_proveedores_ruc')
       AND NOT EXISTS (SELECT 1 FROM proveedores WHERE NULLIF(TRIM(ruc), '') IS NOT NULL
                       GROUP BY TRIM(ruc) HAVING COUNT(*) > 1) THEN
        CREATE UNIQUE INDEX uq_proveedores_ruc ON proveedores ((TRIM(ruc))) WHERE NULLIF(TRIM(ruc), '') IS NOT NULL;
    END IF;
END $$;

-- ============================================================
-- Sprint 17: Finanzas del taller (cuanto dinero hay y por que)
--
-- Idea: NO se duplica informacion. El dinero que ya registra el sistema
-- (pagos de clientes, pagos a proveedores, gastos pagados, caja) se lee
-- tal cual; solo se agregan las piezas que faltaban:
--   17.1 cuentas_dinero         donde esta la plata (caja, banco...)
--   17.2 cat_categorias_dinero  clasificacion de ingresos/egresos
--   17.3 movimientos_dinero     otros ingresos/egresos + transferencias
--   17.4 empleados_perfil / pagos_empleados   nomina
--   17.5 v_flujo_dinero         TODO el dinero que entra y sale, unificado
-- Bloque 100% ADITIVO e IDEMPOTENTE.
-- ============================================================

-- ── 17.1 Cuentas de dinero ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS cuentas_dinero (
    id                  SERIAL PRIMARY KEY,
    nombre              VARCHAR(100) NOT NULL UNIQUE,
    tipo                VARCHAR(10) NOT NULL CHECK (tipo IN ('caja','banco','otro')),
    banco               VARCHAR(100),
    numero_cuenta       VARCHAR(40),
    saldo_inicial       NUMERIC(12,2) NOT NULL DEFAULT 0,
    fecha_saldo_inicial DATE NOT NULL DEFAULT CURRENT_DATE,
    predeterminada      BOOLEAN NOT NULL DEFAULT FALSE,
    activa              BOOLEAN NOT NULL DEFAULT TRUE,
    notas               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT cuentas_dinero_predeterminada_activa CHECK (NOT predeterminada OR activa)
);
-- Una cuenta predeterminada por tipo: el efectivo cae en la caja
-- predeterminada y los demas metodos en el banco predeterminado.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cuenta_dinero_predeterminada ON cuentas_dinero (tipo) WHERE predeterminada;
COMMENT ON TABLE cuentas_dinero IS 'Donde esta el dinero del taller. saldo = saldo_inicial + flujo (v_flujo_dinero) desde fecha_saldo_inicial.';
COMMENT ON COLUMN cuentas_dinero.saldo_inicial IS 'Dinero que habia al INICIO del dia fecha_saldo_inicial (antes de registrar movimientos en el sistema).';

INSERT INTO cuentas_dinero (nombre, tipo, predeterminada, notas)
SELECT 'Caja principal', 'caja', TRUE, 'Efectivo del taller. Recibe todo lo cobrado/pagado en efectivo.'
WHERE NOT EXISTS (SELECT 1 FROM cuentas_dinero WHERE tipo = 'caja' AND predeterminada);
INSERT INTO cuentas_dinero (nombre, tipo, predeterminada, notas)
SELECT 'Banco principal', 'banco', TRUE, 'Recibe transferencias, tarjetas y cheques.'
WHERE NOT EXISTS (SELECT 1 FROM cuentas_dinero WHERE tipo = 'banco' AND predeterminada);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_cuentas_dinero') THEN
        CREATE TRIGGER set_updated_at_cuentas_dinero
            BEFORE UPDATE ON cuentas_dinero FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- Las tablas de dinero existentes pueden indicar su cuenta; si no la
-- indican, se asigna por metodo de pago (ver cuenta_dinero_por_metodo).
ALTER TABLE pagos_cliente                     ADD COLUMN IF NOT EXISTS cuenta_dinero_id INTEGER REFERENCES cuentas_dinero(id) ON DELETE SET NULL;
ALTER TABLE gastos_proveedor                  ADD COLUMN IF NOT EXISTS cuenta_dinero_id INTEGER REFERENCES cuentas_dinero(id) ON DELETE SET NULL;
ALTER TABLE movimientos_financieros_proveedor ADD COLUMN IF NOT EXISTS cuenta_dinero_id INTEGER REFERENCES cuentas_dinero(id) ON DELETE SET NULL;
ALTER TABLE caja_movimientos                  ADD COLUMN IF NOT EXISTS cuenta_dinero_id INTEGER REFERENCES cuentas_dinero(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_cuenta_dinero ON pagos_cliente(cuenta_dinero_id);
CREATE INDEX IF NOT EXISTS idx_gastos_cuenta_dinero        ON gastos_proveedor(cuenta_dinero_id);
CREATE INDEX IF NOT EXISTS idx_movfin_cuenta_dinero        ON movimientos_financieros_proveedor(cuenta_dinero_id);
CREATE INDEX IF NOT EXISTS idx_caja_mov_cuenta_dinero      ON caja_movimientos(cuenta_dinero_id);

CREATE OR REPLACE FUNCTION cuenta_dinero_por_metodo(p_metodo TEXT) RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT id FROM cuentas_dinero
    WHERE predeterminada
      AND tipo = CASE WHEN p_metodo IS NULL OR p_metodo = 'efectivo' THEN 'caja' ELSE 'banco' END
    LIMIT 1
$$;

-- ── 17.2 Categorias de ingresos / egresos ───────────────────────
CREATE TABLE IF NOT EXISTS cat_categorias_dinero (
    codigo  VARCHAR(30) PRIMARY KEY,
    nombre  VARCHAR(80) NOT NULL,
    tipo    VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','egreso','ambos')),
    manual  BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE = la genera el sistema (no se elige a mano)
    color   VARCHAR(9) NOT NULL DEFAULT '#64748b',
    orden   SMALLINT NOT NULL DEFAULT 0
);
INSERT INTO cat_categorias_dinero (codigo, nombre, tipo, manual, color, orden) VALUES
    ('cobro_clientes',     'Cobros a clientes',          'ingreso', FALSE, '#10b981', 1),
    ('anticipo_cliente',   'Anticipos de clientes',      'ingreso', TRUE,  '#34d399', 2),
    ('venta_repuestos',    'Venta de repuestos',         'ingreso', TRUE,  '#22c55e', 3),
    ('aporte_capital',     'Aporte del dueño / capital', 'ingreso', TRUE,  '#0ea5e9', 4),
    ('prestamo_recibido',  'Préstamo recibido',          'ingreso', TRUE,  '#6366f1', 5),
    ('otros_ingresos',     'Otros ingresos',             'ingreso', TRUE,  '#14b8a6', 6),
    ('caja_ingreso',       'Ingreso de caja',            'ingreso', FALSE, '#2dd4bf', 7),
    ('nomina',             'Sueldos y pagos a empleados','egreso',  FALSE, '#f59e0b', 20),
    ('pago_proveedores',   'Pagos a proveedores',        'egreso',  FALSE, '#ef4444', 21),
    ('gastos_operativos',  'Gastos (módulo proveedores)','egreso',  FALSE, '#f97316', 22),
    ('arriendo',           'Arriendo del local',         'egreso',  TRUE,  '#e11d48', 23),
    ('servicios_basicos',  'Luz, agua, internet',        'egreso',  TRUE,  '#fb7185', 24),
    ('impuestos',          'Impuestos y permisos',       'egreso',  TRUE,  '#a855f7', 25),
    ('mantenimiento',      'Mantenimiento del local',    'egreso',  TRUE,  '#d946ef', 26),
    ('herramientas',       'Herramientas y equipos',     'egreso',  TRUE,  '#8b5cf6', 27),
    ('publicidad',         'Publicidad',                 'egreso',  TRUE,  '#ec4899', 28),
    ('pago_prestamo',      'Pago de préstamo',           'egreso',  TRUE,  '#7c3aed', 29),
    ('retiro_dueno',       'Retiro del dueño',           'egreso',  TRUE,  '#0284c7', 30),
    ('otros_egresos',      'Otros egresos',              'egreso',  TRUE,  '#94a3b8', 31),
    ('caja_egreso',        'Egreso de caja',             'egreso',  FALSE, '#fdba74', 32),
    ('ajuste_caja',        'Ajuste por conteo de caja',  'ambos',   FALSE, '#64748b', 40),
    ('transferencia',      'Transferencia entre cuentas','ambos',   FALSE, '#475569', 41)
ON CONFLICT (codigo) DO NOTHING;

-- ── 17.3 Otros ingresos/egresos y transferencias ────────────────
CREATE TABLE IF NOT EXISTS movimientos_dinero (
    id                SERIAL PRIMARY KEY,
    tipo              VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','egreso')),
    categoria         VARCHAR(30) NOT NULL REFERENCES cat_categorias_dinero(codigo) ON UPDATE CASCADE,
    monto             NUMERIC(12,2) NOT NULL CONSTRAINT movimientos_dinero_monto_check CHECK (monto > 0),
    fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
    cuenta_dinero_id  INTEGER NOT NULL REFERENCES cuentas_dinero(id),
    metodo_pago       VARCHAR(30) NOT NULL DEFAULT 'efectivo' REFERENCES cat_metodos_pago(codigo) ON UPDATE CASCADE,
    descripcion       VARCHAR(255) NOT NULL,
    referencia        VARCHAR(100),
    transferencia_id  UUID,                     -- par egreso/ingreso de una transferencia
    caja_sesion_id    INTEGER REFERENCES caja_sesiones(id) ON DELETE SET NULL,
    usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
    anulado_at        TIMESTAMP WITH TIME ZONE,
    anulado_por       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    motivo_anulacion  VARCHAR(255),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movdin_fecha         ON movimientos_dinero(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movdin_cuenta        ON movimientos_dinero(cuenta_dinero_id);
CREATE INDEX IF NOT EXISTS idx_movdin_categoria     ON movimientos_dinero(categoria);
CREATE INDEX IF NOT EXISTS idx_movdin_transferencia ON movimientos_dinero(transferencia_id);
CREATE INDEX IF NOT EXISTS idx_movdin_usuario       ON movimientos_dinero(usuario_id);
CREATE INDEX IF NOT EXISTS idx_movdin_caja_sesion   ON movimientos_dinero(caja_sesion_id);
COMMENT ON TABLE movimientos_dinero IS 'Ingresos/egresos que no nacen de otro modulo (arriendo, luz, aporte del dueño...), transferencias entre cuentas y ajustes de caja. Nunca se borran: se anulan.';

-- ── 17.4 Nomina ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empleados_perfil (
    usuario_id      INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    cargo           VARCHAR(80),
    sueldo_base     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (sueldo_base >= 0),
    frecuencia_pago VARCHAR(10) NOT NULL DEFAULT 'mensual' CHECK (frecuencia_pago IN ('mensual','quincenal','semanal')),
    fecha_ingreso   DATE,
    banco           VARCHAR(100),
    numero_cuenta   VARCHAR(40),
    tipo_cuenta     VARCHAR(20) CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('ahorros','corriente')),
    en_nomina       BOOLEAN NOT NULL DEFAULT TRUE,
    notas           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON COLUMN empleados_perfil.sueldo_base IS 'Sueldo MENSUAL acordado. La frecuencia solo indica cada cuanto se paga.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_empleados_perfil') THEN
        CREATE TRIGGER set_updated_at_empleados_perfil
            BEFORE UPDATE ON empleados_perfil FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS pagos_empleados (
    id                SERIAL PRIMARY KEY,
    usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
    tipo              VARCHAR(15) NOT NULL DEFAULT 'sueldo'
                      CHECK (tipo IN ('sueldo','anticipo','bono','comision','horas_extra','liquidacion','otro')),
    periodo           DATE NOT NULL,             -- primer dia del mes al que corresponde
    monto_bruto       NUMERIC(10,2) NOT NULL CHECK (monto_bruto > 0),
    descuentos        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (descuentos >= 0),
    monto_neto        NUMERIC(10,2) GENERATED ALWAYS AS (monto_bruto - descuentos) STORED,
    fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
    cuenta_dinero_id  INTEGER NOT NULL REFERENCES cuentas_dinero(id),
    metodo_pago       VARCHAR(30) NOT NULL DEFAULT 'transferencia' REFERENCES cat_metodos_pago(codigo) ON UPDATE CASCADE,
    referencia        VARCHAR(100),
    notas             TEXT,
    registrado_por    INTEGER NOT NULL REFERENCES usuarios(id),
    anulado_at        TIMESTAMP WITH TIME ZONE,
    anulado_por       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    motivo_anulacion  VARCHAR(255),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT pagos_empleados_descuento_valido CHECK (descuentos < monto_bruto),
    CONSTRAINT pagos_empleados_periodo_mes CHECK (EXTRACT(DAY FROM periodo) = 1)
);
CREATE INDEX IF NOT EXISTS idx_pagos_emp_usuario   ON pagos_empleados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_emp_periodo   ON pagos_empleados(periodo);
CREATE INDEX IF NOT EXISTS idx_pagos_emp_fecha     ON pagos_empleados(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_emp_cuenta    ON pagos_empleados(cuenta_dinero_id);
CREATE INDEX IF NOT EXISTS idx_pagos_emp_registro  ON pagos_empleados(registrado_por);
COMMENT ON TABLE pagos_empleados IS 'Pagos a empleados (sueldo, anticipo, bono...). Sale dinero por monto_neto. Nunca se borran: se anulan.';

-- ── 17.5 Flujo de dinero unificado ─────────────────────────────
-- Una fila por cada entrada/salida REAL de dinero, venga de donde venga.
-- Las compras a proveedores NO son salida de dinero (son deuda): sale
-- dinero cuando se registra el pago/abono. Igual los pagares: entra
-- dinero cuando el cliente paga.
CREATE OR REPLACE VIEW v_flujo_dinero AS
SELECT 'pago_cliente'::text AS origen, p.id AS origen_id, p.fecha, p.created_at AS momento,
       'ingreso'::text AS tipo, 'cobro_clientes'::text AS categoria, p.monto,
       p.metodo_pago, COALESCE(p.cuenta_dinero_id, cuenta_dinero_por_metodo(p.metodo_pago)) AS cuenta_dinero_id,
       ('Pago: ' || cc.concepto)::text AS descripcion, COALESCE(p.numero_comprobante, p.referencia)::text AS referencia,
       c.nombre::text AS tercero
FROM pagos_cliente p
JOIN cuentas_cobrar cc ON cc.id = p.cuenta_id
JOIN clientes c ON c.id = cc.cliente_id
WHERE p.anulado_at IS NULL
UNION ALL
SELECT 'pago_proveedor', m.id, m.created_at::date, m.created_at,
       'egreso', 'pago_proveedores', m.monto,
       m.metodo_pago, COALESCE(m.cuenta_dinero_id, cuenta_dinero_por_metodo(m.metodo_pago)),
       COALESCE(m.descripcion, INITCAP(m.tipo) || ' a proveedor'), m.referencia, pr.nombre_comercial
FROM movimientos_financieros_proveedor m
JOIN proveedores pr ON pr.id = m.proveedor_id
WHERE m.tipo IN ('pago','abono') AND m.estado = 'confirmado'
UNION ALL
SELECT 'gasto', g.id, g.fecha, g.created_at,
       'egreso', 'gastos_operativos', g.monto,
       g.metodo_pago, COALESCE(g.cuenta_dinero_id, cuenta_dinero_por_metodo(g.metodo_pago)),
       g.descripcion, g.numero_comprobante, pr.nombre_comercial
FROM gastos_proveedor g
LEFT JOIN proveedores pr ON pr.id = g.proveedor_id
WHERE g.estado = 'pagado'
UNION ALL
SELECT 'caja', cm.id, cm.created_at::date, cm.created_at,
       cm.tipo, CASE cm.tipo WHEN 'ingreso' THEN 'caja_ingreso' ELSE 'caja_egreso' END, cm.monto,
       cm.metodo_pago, COALESCE(cm.cuenta_dinero_id, cuenta_dinero_por_metodo(cm.metodo_pago)),
       cm.concepto, cm.referencia, NULL
FROM caja_movimientos cm
UNION ALL
SELECT 'pago_empleado', pe.id, pe.fecha, pe.created_at,
       'egreso', 'nomina', pe.monto_neto,
       pe.metodo_pago, pe.cuenta_dinero_id,
       (INITCAP(REPLACE(pe.tipo, '_', ' ')) || ' ' || TO_CHAR(pe.periodo, 'MM/YYYY')), pe.referencia, u.nombre
FROM pagos_empleados pe
JOIN usuarios u ON u.id = pe.usuario_id
WHERE pe.anulado_at IS NULL
UNION ALL
SELECT 'movimiento', md.id, md.fecha, md.created_at,
       md.tipo, md.categoria, md.monto,
       md.metodo_pago, md.cuenta_dinero_id,
       md.descripcion, md.referencia, NULL
FROM movimientos_dinero md
WHERE md.anulado_at IS NULL;

COMMENT ON VIEW v_flujo_dinero IS 'Todo el dinero que entra y sale del taller: pagos de clientes, pagos a proveedores, gastos pagados, caja, nomina y otros movimientos.';

-- ============================================================
-- Sprint 18: Pedidos de la tienda en linea (solicitudes_producto)
-- Antes el cliente solo abria WhatsApp y el pedido no quedaba en ningun
-- lado. Ahora el pedido se registra, el personal lo atiende y al
-- entregarlo sale del inventario (origen 'venta') y, si se cobro, entra
-- el dinero en Finanzas (categoria 'venta_repuestos').
-- Bloque 100% ADITIVO e IDEMPOTENTE.
-- ============================================================
INSERT INTO cat_origenes_movimiento (codigo, nombre, tipo_permitido, registrable_manual, descripcion) VALUES
    ('venta', 'Salida por venta a cliente', 'salida', FALSE, 'Entrega de un pedido de la tienda en linea')
ON CONFLICT (codigo) DO NOTHING;

-- El CHECK original de origen no incluia 'venta': se reemplaza solo si hace falta.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_inventario_origen_check'
               AND pg_get_constraintdef(oid) NOT LIKE '%venta%') THEN
        ALTER TABLE movimientos_inventario DROP CONSTRAINT movimientos_inventario_origen_check;
        ALTER TABLE movimientos_inventario ADD CONSTRAINT movimientos_inventario_origen_check
            CHECK (origen IN ('manual','compra','proforma','ajuste','devolucion','venta'));
    END IF;
END $$;

ALTER TABLE solicitudes_producto ADD COLUMN IF NOT EXISTS atendida_por      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE solicitudes_producto ADD COLUMN IF NOT EXISTS atendida_at       TIMESTAMP WITH TIME ZONE;
ALTER TABLE solicitudes_producto ADD COLUMN IF NOT EXISTS movimiento_id     INTEGER REFERENCES movimientos_inventario(id) ON DELETE SET NULL;
ALTER TABLE solicitudes_producto ADD COLUMN IF NOT EXISTS cobro_id          INTEGER REFERENCES movimientos_dinero(id) ON DELETE SET NULL;
ALTER TABLE solicitudes_producto ADD COLUMN IF NOT EXISTS motivo_cancelacion VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_solicitudes_atendida_por ON solicitudes_producto(atendida_por);
CREATE INDEX IF NOT EXISTS idx_solicitudes_movimiento   ON solicitudes_producto(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cobro        ON solicitudes_producto(cobro_id);
COMMENT ON TABLE solicitudes_producto IS 'Pedidos de la tienda en linea. Al atenderse: salida de inventario (movimiento_id, origen venta) y cobro opcional en Finanzas (cobro_id).';

-- ============================================================
-- Sprint 19: Compras a credito/contado y cuadre de caja por denominaciones
-- * compras_proveedor.forma_pago: 'contado' (se paga al registrar la compra,
--   genera un movimiento 'pago') o 'credito' (vence a los 15 dias; el
--   panel avisa cuando faltan 3 dias o menos).
-- * caja_sesiones.denominaciones_*: conteo de billetes y monedas al abrir
--   y al cerrar ({"20": 4, "0.25": 8, ...}).
-- Bloque 100% ADITIVO e IDEMPOTENTE.
-- ============================================================
ALTER TABLE compras_proveedor ADD COLUMN IF NOT EXISTS forma_pago        VARCHAR(10) NOT NULL DEFAULT 'credito';
ALTER TABLE compras_proveedor ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_proveedor_forma_pago_check') THEN
        ALTER TABLE compras_proveedor ADD CONSTRAINT compras_proveedor_forma_pago_check CHECK (forma_pago IN ('contado','credito'));
    END IF;
END $$;
-- Compras a credito ya existentes: vencen 15 dias despues de la solicitud.
UPDATE compras_proveedor SET fecha_vencimiento = fecha_solicitud + 15
WHERE forma_pago = 'credito' AND fecha_vencimiento IS NULL;
CREATE INDEX IF NOT EXISTS idx_compras_vencimiento ON compras_proveedor(fecha_vencimiento) WHERE forma_pago = 'credito';

ALTER TABLE caja_sesiones ADD COLUMN IF NOT EXISTS denominaciones_apertura JSONB;
ALTER TABLE caja_sesiones ADD COLUMN IF NOT EXISTS denominaciones_cierre   JSONB;

-- ============================================================
-- Sprint 20: Pagarés al 100%, anticipo por tipo de trabajo y
--            código de proveedor en el inventario
--
-- 20.1 cuentas_cobrar.anticipo_requerido / fecha_pago_completo.
-- 20.2 CORRECCION de los pagares automaticos antiguos: guardaban solo el
--      70% como monto_total, asi que al pagar ese 70% la deuda quedaba
--      "pagada" aunque faltaba el 30%. Ahora monto_total = 100% del total
--      de la proforma y el 70% queda como anticipo REQUERIDO (solo en
--      Colisiones/Pintura; en Mecanica el anticipo pasa a ser el de la
--      proforma, 0 por defecto). Los pagos registrados NO se tocan.
-- 20.3 Estado recalculado desde los pagos activos ('vencido' ya no se
--      guarda: se calcula con la fecha limite al consultar).
-- 20.4 Proformas: anticipo = anticipo requerido (70% en colisiones) y
--      saldo = total (el anticipo no es dinero recibido).
-- 20.5 Inventario: codigo = referencia interna (se genera sola en los
--      productos nuevos); codigo_proveedor = codigo del proveedor/fabricante.
--
-- Bloque ADITIVO e IDEMPOTENTE (se puede correr varias veces).
-- ============================================================

-- ── 20.1 Columnas nuevas del pagare ──────────────────────────
ALTER TABLE cuentas_cobrar ADD COLUMN IF NOT EXISTS anticipo_requerido NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE cuentas_cobrar ADD COLUMN IF NOT EXISTS fecha_pago_completo TIMESTAMP WITH TIME ZONE;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuentas_cobrar_anticipo_valido') THEN
        ALTER TABLE cuentas_cobrar ADD CONSTRAINT cuentas_cobrar_anticipo_valido
            CHECK (anticipo_requerido >= 0 AND anticipo_requerido <= monto_total + 0.01) NOT VALID;
    END IF;
END $$;

-- ── 20.2 Pagares automaticos antiguos: monto_total pasa a ser el 100% ──
-- Condicion idempotente: solo filas cuyo monto_total sigue siendo el
-- porcentaje del total (despues de corregirlas, monto_total = monto_base).
UPDATE cuentas_cobrar cc
SET anticipo_requerido = CASE WHEN p.tipo = 'pintura' THEN ROUND(cc.monto_base * 0.70, 2)
                              ELSE LEAST(COALESCE(p.anticipo, 0), cc.monto_base) END,
    porcentaje         = CASE WHEN p.tipo = 'pintura' THEN 70 ELSE NULL END,
    monto_total        = cc.monto_base,
    concepto           = REPLACE(cc.concepto, 'Pagaré 70%', CASE WHEN p.tipo = 'pintura' THEN 'Pagaré colisiones (anticipo 70%)' ELSE 'Pagaré mecánica' END)
FROM proformas p
WHERE p.id = cc.proforma_id
  AND cc.origen = 'automatico'
  AND cc.monto_base IS NOT NULL AND cc.porcentaje IS NOT NULL
  AND cc.monto_total + 0.005 < cc.monto_base
  AND ABS(cc.monto_total - ROUND(cc.monto_base * cc.porcentaje / 100, 2)) < 0.02;

-- ── 20.3 Estado y fecha de pago completo desde los pagos activos ──
UPDATE cuentas_cobrar cc
SET monto_pagado = x.pagado
FROM (SELECT cuenta_id, COALESCE(SUM(monto), 0) AS pagado FROM pagos_cliente WHERE anulado_at IS NULL GROUP BY cuenta_id) x
WHERE x.cuenta_id = cc.id AND ABS(cc.monto_pagado - x.pagado) >= 0.005;

UPDATE cuentas_cobrar
SET estado = CASE WHEN monto_pagado + 0.005 >= monto_total THEN 'pagado'
                  WHEN monto_pagado > 0.005 THEN 'parcial' ELSE 'pendiente' END
WHERE estado <> 'anulado'
  AND estado IS DISTINCT FROM (CASE WHEN monto_pagado + 0.005 >= monto_total THEN 'pagado'
                                    WHEN monto_pagado > 0.005 THEN 'parcial' ELSE 'pendiente' END);

UPDATE cuentas_cobrar cc
SET fecha_pago_completo = COALESCE((SELECT MAX(pc.created_at) FROM pagos_cliente pc WHERE pc.cuenta_id = cc.id AND pc.anulado_at IS NULL), cc.updated_at)
WHERE cc.estado = 'pagado' AND cc.fecha_pago_completo IS NULL;
UPDATE cuentas_cobrar SET fecha_pago_completo = NULL
WHERE estado IN ('pendiente', 'parcial') AND fecha_pago_completo IS NOT NULL;

-- ── 20.4 Proformas: anticipo requerido y saldo ──
UPDATE proformas SET anticipo = ROUND(total * 0.70, 2)
WHERE tipo = 'pintura' AND ABS(anticipo - ROUND(total * 0.70, 2)) >= 0.005;
UPDATE proformas SET anticipo = total WHERE tipo = 'mecanica' AND anticipo > total;
UPDATE proformas SET saldo = total WHERE ABS(saldo - total) >= 0.005;

-- ── 20.5 Inventario: codigo de proveedor + secuencia de referencias ──
ALTER TABLE repuestos ADD COLUMN IF NOT EXISTS codigo_proveedor VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_repuestos_codigo_proveedor ON repuestos(codigo_proveedor);
CREATE SEQUENCE IF NOT EXISTS repuestos_referencia_seq;

COMMENT ON TABLE cuentas_cobrar IS 'Pagares / cuentas por cobrar. monto_total = 100% de la deuda. anticipo_requerido = anticipo programado (70% en colisiones, 0 o el indicado en mecanica); solo los pagos registrados cuentan como pagado.';
COMMENT ON COLUMN cuentas_cobrar.monto_base IS 'Total de la proforma/orden (100%). En pagares automaticos coincide con monto_total.';
COMMENT ON COLUMN cuentas_cobrar.anticipo_requerido IS 'Anticipo requerido/programado. NO es dinero recibido.';
COMMENT ON COLUMN cuentas_cobrar.fecha_pago_completo IS 'Momento en que los pagos registrados cubrieron el total.';
COMMENT ON COLUMN cuentas_cobrar.estado IS 'Estado guardado (pendiente/parcial/pagado/anulado). "vencido" se calcula al consultar con fecha_vencimiento.';
COMMENT ON COLUMN proformas.anticipo IS 'Anticipo REQUERIDO: 70% del total en colisiones/pintura; opcional en mecanica. No es un pago recibido.';
COMMENT ON COLUMN proformas.saldo IS 'Saldo de la proforma antes de pagos (= total). Lo pagado se registra en el pagare (cuentas_cobrar).';
COMMENT ON COLUMN repuestos.codigo IS 'Codigo de referencia INTERNO (unico). Se genera automaticamente y es el unico que aparece en proformas.';
COMMENT ON COLUMN repuestos.codigo_proveedor IS 'Codigo del proveedor o fabricante (solo inventario; no se imprime en proformas).';

-- ============================================================
-- Sprint 21: Superadministrador y permisos personalizados
--
-- 21.1 Roles nuevos: 'superadministrador' (control total, solo se concede
--      con el script de servidor "npm run superadmin") e 'interno'
--      (personal con acceso a medida). Trigger que impide crear, promover,
--      degradar o borrar un superadministrador desde la aplicacion.
-- 21.2 usuarios.token_version (invalida sesiones al desactivar/restablecer),
--      permisos_inicializados y ultimo_acceso.
-- 21.3 permisos_catalogo (modulo x accion) y usuario_permisos.
-- 21.4 Plantillas por rol: las cuentas de personal EXISTENTES reciben
--      exactamente el acceso que ya tenian (una sola vez por cuenta).
-- 21.5 auditoria_seguridad: registro de solo-insercion (no UPDATE/DELETE).
--
-- 100% aditivo e idempotente. El catalogo y las plantillas se generan
-- desde backend/src/config/permisos.js (una prueba verifica que coincidan).
-- ============================================================

-- ── 21.1 Roles ──
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'usuarios_rol_check'
          AND pg_get_constraintdef(oid) LIKE '%superadministrador%'
    ) THEN
        ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
        ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
            CHECK (rol IN ('superadministrador','administrador','tecnico','recepcionista','interno','cliente'));
    END IF;
END $$;

-- Solo una sesion que active "ssswap.gestion_superadmin" (el script de
-- servidor) puede crear, promover, degradar o borrar superadministradores.
CREATE OR REPLACE FUNCTION proteger_rol_superadmin()
RETURNS TRIGGER AS $$
BEGIN
    IF COALESCE(current_setting('ssswap.gestion_superadmin', true), '') = 'on' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF TG_OP = 'INSERT' AND NEW.rol = 'superadministrador' THEN
        RAISE EXCEPTION 'El rol superadministrador solo se asigna desde el servidor.' USING ERRCODE = '42501';
    ELSIF TG_OP = 'UPDATE' AND (NEW.rol = 'superadministrador') IS DISTINCT FROM (OLD.rol = 'superadministrador') THEN
        RAISE EXCEPTION 'El rol superadministrador solo se cambia desde el servidor.' USING ERRCODE = '42501';
    ELSIF TG_OP = 'DELETE' AND OLD.rol = 'superadministrador' THEN
        RAISE EXCEPTION 'Un superadministrador no se puede eliminar desde la aplicacion.' USING ERRCODE = '42501';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proteger_rol_superadmin ON usuarios;
CREATE TRIGGER trg_proteger_rol_superadmin
    BEFORE INSERT OR UPDATE OF rol OR DELETE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION proteger_rol_superadmin();

-- ── 21.2 Sesiones ──
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos_inicializados BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMP WITH TIME ZONE;
COMMENT ON COLUMN usuarios.token_version IS 'Se incrementa al desactivar, cambiar rol o restablecer acceso: invalida todos los JWT emitidos antes.';
COMMENT ON COLUMN usuarios.permisos_inicializados IS 'TRUE cuando la cuenta ya recibio su plantilla de permisos (o el superadministrador la configuro). Evita volver a otorgar permisos revocados.';

-- ── 21.3 Catalogo y asignaciones ──
CREATE TABLE IF NOT EXISTS permisos_catalogo (
    modulo          VARCHAR(50)  NOT NULL,
    accion          VARCHAR(20)  NOT NULL,
    modulo_nombre   VARCHAR(100) NOT NULL,
    accion_nombre   VARCHAR(100) NOT NULL,
    grupo           VARCHAR(50)  NOT NULL,
    orden           INTEGER      NOT NULL DEFAULT 0,
    solo_superadmin BOOLEAN      NOT NULL DEFAULT FALSE,
    PRIMARY KEY (modulo, accion)
);
COMMENT ON TABLE permisos_catalogo IS 'Modulos del panel y acciones que se pueden autorizar. Fuente: backend/src/config/permisos.js.';

-- CATALOGO_INICIO (generado desde permisos.js)
INSERT INTO permisos_catalogo (modulo, accion, modulo_nombre, accion_nombre, grupo, orden, solo_superadmin) VALUES
    ('dashboard', 'ver', 'Panel principal', 'Ver', 'Panel', 1, FALSE),
    ('inventario_mecanica', 'ver', 'Inventario de mecánica', 'Ver', 'Inventario', 2, FALSE),
    ('inventario_mecanica', 'crear', 'Inventario de mecánica', 'Crear', 'Inventario', 3, FALSE),
    ('inventario_mecanica', 'editar', 'Inventario de mecánica', 'Editar', 'Inventario', 4, FALSE),
    ('inventario_mecanica', 'eliminar', 'Inventario de mecánica', 'Eliminar', 'Inventario', 5, FALSE),
    ('inventario_colisiones', 'ver', 'Inventario de colisiones / pintura', 'Ver', 'Inventario', 6, FALSE),
    ('inventario_colisiones', 'crear', 'Inventario de colisiones / pintura', 'Crear', 'Inventario', 7, FALSE),
    ('inventario_colisiones', 'editar', 'Inventario de colisiones / pintura', 'Editar', 'Inventario', 8, FALSE),
    ('inventario_colisiones', 'eliminar', 'Inventario de colisiones / pintura', 'Eliminar', 'Inventario', 9, FALSE),
    ('registros_inventario', 'ver', 'Entradas y salidas de inventario', 'Ver registros', 'Inventario', 10, FALSE),
    ('registros_inventario', 'crear', 'Entradas y salidas de inventario', 'Registrar entradas / salidas', 'Inventario', 11, FALSE),
    ('registros_inventario', 'aprobar', 'Entradas y salidas de inventario', 'Devolver salidas al inventario', 'Inventario', 12, FALSE),
    ('pedidos_tienda', 'ver', 'Pedidos de la tienda', 'Ver', 'Inventario', 13, FALSE),
    ('pedidos_tienda', 'editar', 'Pedidos de la tienda', 'Atender / cancelar', 'Inventario', 14, FALSE),
    ('ordenes', 'ver', 'Órdenes de trabajo', 'Ver', 'Taller', 15, FALSE),
    ('ordenes', 'crear', 'Órdenes de trabajo', 'Crear', 'Taller', 16, FALSE),
    ('ordenes', 'editar', 'Órdenes de trabajo', 'Editar', 'Taller', 17, FALSE),
    ('ordenes', 'eliminar', 'Órdenes de trabajo', 'Eliminar', 'Taller', 18, FALSE),
    ('ordenes', 'asignar', 'Órdenes de trabajo', 'Asignar técnico', 'Taller', 19, FALSE),
    ('ordenes', 'aprobar', 'Órdenes de trabajo', 'Cambiar estado de cualquier orden', 'Taller', 20, FALSE),
    ('proformas_mecanica', 'ver', 'Proformas de mecánica', 'Ver', 'Taller', 21, FALSE),
    ('proformas_mecanica', 'crear', 'Proformas de mecánica', 'Crear', 'Taller', 22, FALSE),
    ('proformas_mecanica', 'editar', 'Proformas de mecánica', 'Editar', 'Taller', 23, FALSE),
    ('proformas_mecanica', 'eliminar', 'Proformas de mecánica', 'Eliminar', 'Taller', 24, FALSE),
    ('proformas_mecanica', 'exportar', 'Proformas de mecánica', 'Descargar PDF / Excel', 'Taller', 25, FALSE),
    ('proformas_mecanica', 'aprobar', 'Proformas de mecánica', 'Aprobar, rechazar, convertir en OT y confirmar materiales', 'Taller', 26, FALSE),
    ('proformas_colisiones', 'ver', 'Proformas de colisiones / pintura', 'Ver', 'Taller', 27, FALSE),
    ('proformas_colisiones', 'crear', 'Proformas de colisiones / pintura', 'Crear', 'Taller', 28, FALSE),
    ('proformas_colisiones', 'editar', 'Proformas de colisiones / pintura', 'Editar', 'Taller', 29, FALSE),
    ('proformas_colisiones', 'eliminar', 'Proformas de colisiones / pintura', 'Eliminar', 'Taller', 30, FALSE),
    ('proformas_colisiones', 'exportar', 'Proformas de colisiones / pintura', 'Descargar PDF / Excel', 'Taller', 31, FALSE),
    ('proformas_colisiones', 'aprobar', 'Proformas de colisiones / pintura', 'Aprobar, rechazar, convertir en OT y confirmar materiales', 'Taller', 32, FALSE),
    ('citas', 'ver', 'Citas', 'Ver', 'Taller', 33, FALSE),
    ('citas', 'editar', 'Citas', 'Confirmar / cambiar estado', 'Taller', 34, FALSE),
    ('clientes', 'ver', 'Clientes', 'Ver', 'Clientes', 35, FALSE),
    ('clientes', 'crear', 'Clientes', 'Crear', 'Clientes', 36, FALSE),
    ('clientes', 'editar', 'Clientes', 'Editar', 'Clientes', 37, FALSE),
    ('clientes', 'eliminar', 'Clientes', 'Eliminar', 'Clientes', 38, FALSE),
    ('vehiculos', 'ver', 'Vehículos', 'Ver', 'Clientes', 39, FALSE),
    ('vehiculos', 'crear', 'Vehículos', 'Crear', 'Clientes', 40, FALSE),
    ('vehiculos', 'editar', 'Vehículos', 'Editar', 'Clientes', 41, FALSE),
    ('vehiculos', 'eliminar', 'Vehículos', 'Eliminar', 'Clientes', 42, FALSE),
    ('cuentas_cobrar', 'ver', 'Pagarés y cuentas por cobrar', 'Ver', 'Clientes', 43, FALSE),
    ('cuentas_cobrar', 'crear', 'Pagarés y cuentas por cobrar', 'Crear', 'Clientes', 44, FALSE),
    ('cuentas_cobrar', 'editar', 'Pagarés y cuentas por cobrar', 'Editar (vencimiento, datos)', 'Clientes', 45, FALSE),
    ('cuentas_cobrar', 'eliminar', 'Pagarés y cuentas por cobrar', 'Eliminar / anular / reabrir', 'Clientes', 46, FALSE),
    ('pagos_clientes', 'crear', 'Registro de pagos de clientes', 'Registrar pagos', 'Clientes', 47, FALSE),
    ('pagos_clientes', 'eliminar', 'Registro de pagos de clientes', 'Anular pagos', 'Clientes', 48, FALSE),
    ('caja', 'ver', 'Caja diaria', 'Ver', 'Finanzas', 49, FALSE),
    ('caja', 'crear', 'Caja diaria', 'Registrar movimientos de caja', 'Finanzas', 50, FALSE),
    ('caja', 'aprobar', 'Caja diaria', 'Abrir y cerrar caja', 'Finanzas', 51, FALSE),
    ('caja', 'eliminar', 'Caja diaria', 'Anular movimientos manuales de caja', 'Finanzas', 52, FALSE),
    ('caja', 'reabrir', 'Caja diaria', 'Reabrir una caja cerrada', 'Finanzas', 53, FALSE),
    ('finanzas', 'ver', 'Finanzas, cuentas y nómina', 'Ver', 'Finanzas', 54, FALSE),
    ('finanzas', 'crear', 'Finanzas, cuentas y nómina', 'Crear', 'Finanzas', 55, FALSE),
    ('finanzas', 'editar', 'Finanzas, cuentas y nómina', 'Editar', 'Finanzas', 56, FALSE),
    ('finanzas', 'eliminar', 'Finanzas, cuentas y nómina', 'Anular movimientos / pagos', 'Finanzas', 57, FALSE),
    ('proveedores', 'ver', 'Proveedores, compras y gastos', 'Ver', 'Proveedores', 58, FALSE),
    ('proveedores', 'crear', 'Proveedores, compras y gastos', 'Crear', 'Proveedores', 59, FALSE),
    ('proveedores', 'editar', 'Proveedores, compras y gastos', 'Editar', 'Proveedores', 60, FALSE),
    ('proveedores', 'eliminar', 'Proveedores, compras y gastos', 'Eliminar', 'Proveedores', 61, FALSE),
    ('facturacion', 'ver', 'Facturación electrónica (SRI)', 'Ver comprobantes', 'Facturación', 62, FALSE),
    ('facturacion', 'crear', 'Facturación electrónica (SRI)', 'Preparar borradores', 'Facturación', 63, FALSE),
    ('facturacion', 'aprobar', 'Facturación electrónica (SRI)', 'Emitir y enviar al SRI', 'Facturación', 64, FALSE),
    ('facturacion', 'exportar', 'Facturación electrónica (SRI)', 'Descargar XML / RIDE y reenviar correo', 'Facturación', 65, FALSE),
    ('facturacion', 'anular', 'Facturación electrónica (SRI)', 'Notas de crédito y registro de anulaciones', 'Facturación', 66, FALSE),
    ('facturacion', 'eliminar', 'Facturación electrónica (SRI)', 'Descartar borradores', 'Facturación', 67, FALSE),
    ('facturacion_config', 'ver', 'Configuración tributaria y firma electrónica', 'Ver', 'Facturación', 68, FALSE),
    ('facturacion_config', 'editar', 'Configuración tributaria y firma electrónica', 'Editar datos tributarios, puntos de emisión y certificado', 'Facturación', 69, FALSE),
    ('facturacion_config', 'aprobar', 'Configuración tributaria y firma electrónica', 'Activar el ambiente de producción', 'Facturación', 70, FALSE),
    ('estadisticas', 'ver', 'Reportes y estadísticas', 'Ver', 'Reportes', 71, FALSE),
    ('servicios', 'ver', 'Servicios del taller', 'Ver', 'Ajustes', 72, FALSE),
    ('servicios', 'crear', 'Servicios del taller', 'Crear', 'Ajustes', 73, FALSE),
    ('servicios', 'editar', 'Servicios del taller', 'Editar', 'Ajustes', 74, FALSE),
    ('servicios', 'eliminar', 'Servicios del taller', 'Eliminar', 'Ajustes', 75, FALSE),
    ('sucursales', 'ver', 'Sucursales', 'Ver', 'Ajustes', 76, FALSE),
    ('sucursales', 'crear', 'Sucursales', 'Crear', 'Ajustes', 77, FALSE),
    ('sucursales', 'editar', 'Sucursales', 'Editar', 'Ajustes', 78, FALSE),
    ('sucursales', 'eliminar', 'Sucursales', 'Eliminar', 'Ajustes', 79, FALSE),
    ('bitacora', 'ver', 'Bitácora de operaciones', 'Ver', 'Ajustes', 80, FALSE),
    ('usuarios', 'ver', 'Usuarios y permisos de la empresa', 'Ver', 'Empresa', 81, FALSE),
    ('usuarios', 'crear', 'Usuarios y permisos de la empresa', 'Crear', 'Empresa', 82, FALSE),
    ('usuarios', 'editar', 'Usuarios y permisos de la empresa', 'Editar, activar/desactivar, permisos y restablecer acceso', 'Empresa', 83, FALSE),
    ('usuarios', 'eliminar', 'Usuarios y permisos de la empresa', 'Eliminar', 'Empresa', 84, FALSE),
    ('auditoria', 'ver', 'Auditoría de la empresa', 'Ver', 'Empresa', 85, FALSE),
    ('empresa', 'ver', 'Configuración de la empresa', 'Ver', 'Empresa', 86, FALSE),
    ('empresa', 'editar', 'Configuración de la empresa', 'Editar', 'Empresa', 87, FALSE),
    ('legal', 'ver', 'Documentos legales y aceptaciones', 'Ver documentos, aceptaciones y constancias', 'Empresa', 88, FALSE),
    ('legal', 'editar', 'Documentos legales y aceptaciones', 'Redactar borradores', 'Empresa', 89, FALSE),
    ('legal', 'aprobar', 'Documentos legales y aceptaciones', 'Publicar versiones', 'Empresa', 90, FALSE)
ON CONFLICT (modulo, accion) DO UPDATE SET
    modulo_nombre = EXCLUDED.modulo_nombre, accion_nombre = EXCLUDED.accion_nombre,
    grupo = EXCLUDED.grupo, orden = EXCLUDED.orden, solo_superadmin = EXCLUDED.solo_superadmin;
-- CATALOGO_FIN

CREATE TABLE IF NOT EXISTS usuario_permisos (
    usuario_id   INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    modulo       VARCHAR(50) NOT NULL,
    accion       VARCHAR(20) NOT NULL,
    otorgado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (usuario_id, modulo, accion),
    FOREIGN KEY (modulo, accion) REFERENCES permisos_catalogo(modulo, accion) ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_usuario_permisos_otorgado ON usuario_permisos(otorgado_por);
COMMENT ON TABLE usuario_permisos IS 'Permiso (modulo, accion) concedido a una cuenta de personal. El superadministrador no necesita filas: tiene todo.';

-- ── 21.4 Plantillas por rol para las cuentas existentes (una sola vez) ──
-- PLANTILLAS_INICIO (generado desde permisos.js)
INSERT INTO usuario_permisos (usuario_id, modulo, accion)
SELECT u.id, t.modulo, t.accion
FROM usuarios u
JOIN (VALUES
    ('administrador', 'dashboard', 'ver'),
    ('administrador', 'inventario_mecanica', 'ver'),
    ('administrador', 'inventario_mecanica', 'crear'),
    ('administrador', 'inventario_mecanica', 'editar'),
    ('administrador', 'inventario_mecanica', 'eliminar'),
    ('administrador', 'inventario_colisiones', 'ver'),
    ('administrador', 'inventario_colisiones', 'crear'),
    ('administrador', 'inventario_colisiones', 'editar'),
    ('administrador', 'inventario_colisiones', 'eliminar'),
    ('administrador', 'registros_inventario', 'ver'),
    ('administrador', 'registros_inventario', 'crear'),
    ('administrador', 'registros_inventario', 'aprobar'),
    ('administrador', 'pedidos_tienda', 'ver'),
    ('administrador', 'pedidos_tienda', 'editar'),
    ('administrador', 'ordenes', 'ver'),
    ('administrador', 'ordenes', 'crear'),
    ('administrador', 'ordenes', 'editar'),
    ('administrador', 'ordenes', 'eliminar'),
    ('administrador', 'ordenes', 'asignar'),
    ('administrador', 'ordenes', 'aprobar'),
    ('administrador', 'proformas_mecanica', 'ver'),
    ('administrador', 'proformas_mecanica', 'crear'),
    ('administrador', 'proformas_mecanica', 'editar'),
    ('administrador', 'proformas_mecanica', 'eliminar'),
    ('administrador', 'proformas_mecanica', 'exportar'),
    ('administrador', 'proformas_mecanica', 'aprobar'),
    ('administrador', 'proformas_colisiones', 'ver'),
    ('administrador', 'proformas_colisiones', 'crear'),
    ('administrador', 'proformas_colisiones', 'editar'),
    ('administrador', 'proformas_colisiones', 'eliminar'),
    ('administrador', 'proformas_colisiones', 'exportar'),
    ('administrador', 'proformas_colisiones', 'aprobar'),
    ('administrador', 'citas', 'ver'),
    ('administrador', 'citas', 'editar'),
    ('administrador', 'clientes', 'ver'),
    ('administrador', 'clientes', 'crear'),
    ('administrador', 'clientes', 'editar'),
    ('administrador', 'clientes', 'eliminar'),
    ('administrador', 'vehiculos', 'ver'),
    ('administrador', 'vehiculos', 'crear'),
    ('administrador', 'vehiculos', 'editar'),
    ('administrador', 'vehiculos', 'eliminar'),
    ('administrador', 'cuentas_cobrar', 'ver'),
    ('administrador', 'cuentas_cobrar', 'crear'),
    ('administrador', 'cuentas_cobrar', 'editar'),
    ('administrador', 'cuentas_cobrar', 'eliminar'),
    ('administrador', 'pagos_clientes', 'crear'),
    ('administrador', 'pagos_clientes', 'eliminar'),
    ('administrador', 'caja', 'ver'),
    ('administrador', 'caja', 'crear'),
    ('administrador', 'caja', 'aprobar'),
    ('administrador', 'caja', 'eliminar'),
    ('administrador', 'caja', 'reabrir'),
    ('administrador', 'finanzas', 'ver'),
    ('administrador', 'finanzas', 'crear'),
    ('administrador', 'finanzas', 'editar'),
    ('administrador', 'finanzas', 'eliminar'),
    ('administrador', 'proveedores', 'ver'),
    ('administrador', 'proveedores', 'crear'),
    ('administrador', 'proveedores', 'editar'),
    ('administrador', 'proveedores', 'eliminar'),
    ('administrador', 'estadisticas', 'ver'),
    ('administrador', 'servicios', 'ver'),
    ('administrador', 'servicios', 'crear'),
    ('administrador', 'servicios', 'editar'),
    ('administrador', 'servicios', 'eliminar'),
    ('administrador', 'sucursales', 'ver'),
    ('administrador', 'sucursales', 'crear'),
    ('administrador', 'sucursales', 'editar'),
    ('administrador', 'sucursales', 'eliminar'),
    ('administrador', 'bitacora', 'ver'),
    ('administrador', 'usuarios', 'ver'),
    ('administrador', 'usuarios', 'crear'),
    ('administrador', 'usuarios', 'editar'),
    ('administrador', 'usuarios', 'eliminar'),
    ('administrador', 'auditoria', 'ver'),
    ('administrador', 'empresa', 'ver'),
    ('administrador', 'empresa', 'editar'),
    ('administrador', 'facturacion', 'ver'),
    ('administrador', 'facturacion', 'crear'),
    ('administrador', 'facturacion', 'aprobar'),
    ('administrador', 'facturacion', 'exportar'),
    ('administrador', 'facturacion', 'anular'),
    ('administrador', 'facturacion', 'eliminar'),
    ('administrador', 'facturacion_config', 'ver'),
    ('administrador', 'facturacion_config', 'editar'),
    ('administrador', 'facturacion_config', 'aprobar'),
    ('administrador', 'legal', 'ver'),
    ('administrador', 'legal', 'editar'),
    ('administrador', 'legal', 'aprobar'),
    ('recepcionista', 'dashboard', 'ver'),
    ('recepcionista', 'inventario_mecanica', 'ver'),
    ('recepcionista', 'inventario_colisiones', 'ver'),
    ('recepcionista', 'registros_inventario', 'ver'),
    ('recepcionista', 'registros_inventario', 'crear'),
    ('recepcionista', 'pedidos_tienda', 'ver'),
    ('recepcionista', 'pedidos_tienda', 'editar'),
    ('recepcionista', 'ordenes', 'ver'),
    ('recepcionista', 'ordenes', 'crear'),
    ('recepcionista', 'ordenes', 'editar'),
    ('recepcionista', 'ordenes', 'asignar'),
    ('recepcionista', 'proformas_mecanica', 'ver'),
    ('recepcionista', 'proformas_mecanica', 'crear'),
    ('recepcionista', 'proformas_mecanica', 'editar'),
    ('recepcionista', 'proformas_mecanica', 'exportar'),
    ('recepcionista', 'proformas_mecanica', 'aprobar'),
    ('recepcionista', 'proformas_colisiones', 'ver'),
    ('recepcionista', 'proformas_colisiones', 'crear'),
    ('recepcionista', 'proformas_colisiones', 'editar'),
    ('recepcionista', 'proformas_colisiones', 'exportar'),
    ('recepcionista', 'proformas_colisiones', 'aprobar'),
    ('recepcionista', 'citas', 'ver'),
    ('recepcionista', 'citas', 'editar'),
    ('recepcionista', 'clientes', 'ver'),
    ('recepcionista', 'clientes', 'crear'),
    ('recepcionista', 'clientes', 'editar'),
    ('recepcionista', 'clientes', 'eliminar'),
    ('recepcionista', 'vehiculos', 'ver'),
    ('recepcionista', 'vehiculos', 'crear'),
    ('recepcionista', 'vehiculos', 'editar'),
    ('recepcionista', 'cuentas_cobrar', 'ver'),
    ('recepcionista', 'cuentas_cobrar', 'crear'),
    ('recepcionista', 'cuentas_cobrar', 'editar'),
    ('recepcionista', 'pagos_clientes', 'crear'),
    ('recepcionista', 'caja', 'ver'),
    ('recepcionista', 'caja', 'crear'),
    ('recepcionista', 'caja', 'aprobar'),
    ('recepcionista', 'facturacion', 'ver'),
    ('recepcionista', 'facturacion', 'crear'),
    ('recepcionista', 'facturacion', 'exportar'),
    ('tecnico', 'dashboard', 'ver'),
    ('tecnico', 'inventario_mecanica', 'ver'),
    ('tecnico', 'inventario_mecanica', 'crear'),
    ('tecnico', 'inventario_mecanica', 'editar'),
    ('tecnico', 'inventario_colisiones', 'ver'),
    ('tecnico', 'inventario_colisiones', 'crear'),
    ('tecnico', 'inventario_colisiones', 'editar'),
    ('tecnico', 'registros_inventario', 'ver'),
    ('tecnico', 'registros_inventario', 'crear'),
    ('tecnico', 'pedidos_tienda', 'ver'),
    ('tecnico', 'pedidos_tienda', 'editar'),
    ('tecnico', 'ordenes', 'ver'),
    ('tecnico', 'ordenes', 'editar'),
    ('tecnico', 'proformas_mecanica', 'ver'),
    ('tecnico', 'proformas_mecanica', 'crear'),
    ('tecnico', 'proformas_mecanica', 'editar'),
    ('tecnico', 'proformas_mecanica', 'exportar'),
    ('tecnico', 'proformas_mecanica', 'aprobar'),
    ('tecnico', 'proformas_colisiones', 'ver'),
    ('tecnico', 'proformas_colisiones', 'crear'),
    ('tecnico', 'proformas_colisiones', 'editar'),
    ('tecnico', 'proformas_colisiones', 'exportar'),
    ('tecnico', 'proformas_colisiones', 'aprobar'),
    ('tecnico', 'citas', 'ver'),
    ('tecnico', 'citas', 'editar'),
    ('tecnico', 'clientes', 'crear'),
    ('tecnico', 'vehiculos', 'ver'),
    ('tecnico', 'vehiculos', 'crear'),
    ('tecnico', 'vehiculos', 'editar')
) AS t(rol, modulo, accion) ON t.rol = u.rol
WHERE u.permisos_inicializados = FALSE
ON CONFLICT DO NOTHING;
-- PLANTILLAS_FIN

UPDATE usuarios SET permisos_inicializados = TRUE
WHERE permisos_inicializados = FALSE AND rol IN ('administrador','tecnico','recepcionista','interno');

-- ── 21.5 Auditoria de seguridad (solo insercion) ──
-- Sin llave foranea a usuarios a proposito: el registro debe sobrevivir
-- intacto aunque la cuenta se elimine (se guarda una copia del correo).
CREATE TABLE IF NOT EXISTS auditoria_seguridad (
    id           BIGSERIAL PRIMARY KEY,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    actor_id     INTEGER,
    actor_email  VARCHAR(150),
    actor_rol    VARCHAR(20),
    accion       VARCHAR(60)  NOT NULL,
    recurso_tipo VARCHAR(40),
    recurso_id   VARCHAR(60),
    resultado    VARCHAR(12)  NOT NULL DEFAULT 'exito' CHECK (resultado IN ('exito','denegado','error')),
    detalle      JSONB,
    ip           VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha   ON auditoria_seguridad(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_actor   ON auditoria_seguridad(actor_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_recurso ON auditoria_seguridad(recurso_tipo, recurso_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion  ON auditoria_seguridad(accion);
COMMENT ON TABLE auditoria_seguridad IS 'Registro de seguridad: usuarios, permisos, roles, accesos denegados. Nunca guarda contrasenas ni tokens. No admite UPDATE ni DELETE.';

CREATE OR REPLACE FUNCTION auditoria_solo_insercion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'La auditoria de seguridad no se puede modificar ni borrar.' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditoria_solo_insercion ON auditoria_seguridad;
CREATE TRIGGER trg_auditoria_solo_insercion
    BEFORE UPDATE OR DELETE ON auditoria_seguridad
    FOR EACH ROW EXECUTE FUNCTION auditoria_solo_insercion();

-- ============================================================
-- Sprint 22: Plataforma multiempresa (SS SWAP = primera empresa)
--
-- Estrategia: UNA base de datos compartida y aislamiento por empresa
-- DENTRO de PostgreSQL (Row Level Security):
--  * Cada tabla operativa tiene empresa_id. El valor por defecto sale de la
--    variable de la transaccion app.empresa_id, que el backend fija a partir
--    del usuario AUTENTICADO (nunca de un dato enviado por el navegador).
--  * El backend ejecuta las consultas de una empresa con el rol ssswap_app
--    (sin privilegios de propietario): las politicas RLS filtran SELECT,
--    UPDATE y DELETE e impiden INSERTAR filas de otra empresa.
--  * Llaves foraneas compuestas (columna, empresa_id) impiden enlazar un
--    registro con otro de otra empresa aunque se adivine su id.
--  * Sin empresa en contexto no se ve nada (falla cerrado).
--
-- 22.1 Registro de migraciones y tablas de la plataforma.
-- 22.2 Tabla empresas + SS SWAP como primera empresa (con datos reales de
--      su sucursal principal; no se inventa nada).
-- 22.3 empresa_id en todas las tablas operativas. La asociacion de los
--      datos existentes a SS SWAP se hace UNA sola vez y se detiene si ya
--      existe mas de una empresa con filas sin asociar.
-- 22.4 Unicidades por empresa (codigo, cedula, numero de proforma, RUC...).
-- 22.5 Llaves compuestas (generadas desde backend/src/config/multiempresa.js).
-- 22.6 Rol ssswap_app, permisos de tabla y politicas RLS.
-- 22.7 Vistas con security_invoker (respetan RLS).
-- 22.8 Numeracion por empresa (empresa_secuencias).
-- 22.9 Catalogo de permisos (usuarios/auditoria/empresa delegables).
-- 22.10 Validaciones finales: si algo no cuadra la migracion FALLA y, como
--       se corre en una transaccion, no deja nada a medias.
--
-- Idempotente: se puede correr varias veces sin duplicar nada.
-- ============================================================

-- ── 22.1 Plataforma ──
CREATE TABLE IF NOT EXISTS migraciones_registro (
    id          SERIAL PRIMARY KEY,
    version     VARCHAR(40)  NOT NULL,
    descripcion VARCHAR(200) NOT NULL,
    aplicada_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resultado   VARCHAR(12)  NOT NULL CHECK (resultado IN ('exito','error')),
    detalle     JSONB
);
COMMENT ON TABLE migraciones_registro IS 'Historial de migraciones de datos relevantes (version, resultado y verificaciones).';

CREATE TABLE IF NOT EXISTS empresas (
    id               SERIAL PRIMARY KEY,
    slug             VARCHAR(60)  NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    nombre           VARCHAR(120) NOT NULL,
    nombre_comercial VARCHAR(160),
    razon_social     VARCHAR(160),
    ruc              VARCHAR(20),
    direccion        VARCHAR(255),
    telefono         VARCHAR(30),
    email            VARCHAR(150),
    logo_archivo     VARCHAR(200),
    estado           VARCHAR(12)  NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','suspendida','inactiva')),
    permite_soporte  BOOLEAN      NOT NULL DEFAULT FALSE,
    creada_por       INTEGER,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE empresas IS 'Mecanicas de la plataforma. Cada una ve solo sus datos (RLS por empresa_id).';
COMMENT ON COLUMN empresas.logo_archivo IS 'Logo para PDF/Excel. "asset:logo.png" = logo incluido en el backend; vacio = sin logo.';
COMMENT ON COLUMN empresas.permite_soporte IS 'Si TRUE, el superadministrador puede abrir un acceso de soporte (con motivo, tiempo limite y auditoria).';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_empresas') THEN
        CREATE TRIGGER set_updated_at_empresas BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS accesos_soporte (
    id              SERIAL PRIMARY KEY,
    superadmin_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    empresa_id      INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    motivo          VARCHAR(300) NOT NULL CHECK (length(trim(motivo)) >= 10),
    modo            VARCHAR(10)  NOT NULL DEFAULT 'lectura' CHECK (modo IN ('lectura','completo')),
    inicio          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expira          TIMESTAMP WITH TIME ZONE NOT NULL,
    finalizado_at   TIMESTAMP WITH TIME ZONE,
    CHECK (expira > inicio AND expira <= inicio + INTERVAL '8 hours')
);
CREATE INDEX IF NOT EXISTS idx_accesos_soporte_vigentes ON accesos_soporte(superadmin_id, empresa_id) WHERE finalizado_at IS NULL;
COMMENT ON TABLE accesos_soporte IS 'Accesos temporales del superadministrador a una empresa (motivo obligatorio, maximo 8 h, auditado).';

CREATE TABLE IF NOT EXISTS respaldos_registro (
    id           SERIAL PRIMARY KEY,
    inicio       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    fin          TIMESTAMP WITH TIME ZONE,
    tipo         VARCHAR(30)  NOT NULL CHECK (tipo IN ('automatico','manual','previo_migracion','previo_restauracion','prueba_restauracion')),
    motor        VARCHAR(20),
    archivo      VARCHAR(255),
    tamano_bytes BIGINT,
    sha256       VARCHAR(64),
    cifrado      BOOLEAN NOT NULL DEFAULT FALSE,
    version_app  VARCHAR(40),
    commit_git   VARCHAR(40),
    alcance      VARCHAR(200),
    resultado    VARCHAR(12)  NOT NULL DEFAULT 'en_curso' CHECK (resultado IN ('en_curso','exito','error')),
    detalle      JSONB,
    ejecutado_por VARCHAR(150)
);
COMMENT ON TABLE respaldos_registro IS 'Resultado de cada respaldo y de cada prueba de restauracion (sin contrasenas ni claves).';

CREATE TABLE IF NOT EXISTS errores_sistema (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metodo      VARCHAR(10),
    ruta        VARCHAR(200),
    estado_http INTEGER,
    empresa_id  INTEGER,
    usuario_id  INTEGER,
    mensaje     VARCHAR(300)
);
CREATE INDEX IF NOT EXISTS idx_errores_sistema_fecha ON errores_sistema(created_at DESC);
COMMENT ON TABLE errores_sistema IS 'Errores 500 del API (ruta y mensaje tecnico breve; nunca datos de clientes ni secretos).';

-- ── 22.2 SS SWAP como primera empresa ──
-- Los datos de contacto salen de la sucursal principal que YA existe.
INSERT INTO empresas (slug, nombre, nombre_comercial, direccion, telefono, email, logo_archivo, estado, permite_soporte)
SELECT 'ss-swap', 'SS SWAP', 'SS Swap - Sarango Sosa Intercambio Inteligente',
       s.direccion, s.telefono, s.email, 'asset:logo.png', 'activa', TRUE
FROM (SELECT 1) x
LEFT JOIN LATERAL (SELECT direccion, telefono, email FROM sucursales ORDER BY es_principal DESC, id LIMIT 1) s ON TRUE
WHERE NOT EXISTS (SELECT 1 FROM empresas WHERE slug = 'ss-swap');

-- Valor por defecto de empresa_id: la empresa de la transaccion actual.
CREATE OR REPLACE FUNCTION empresa_actual() RETURNS INTEGER
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.empresa_id', true), '')::int $$;

-- Utilidad idempotente: agrega una constraint si no existe con ese nombre.
CREATE OR REPLACE FUNCTION agregar_constraint_si_falta(tabla TEXT, nombre TEXT, definicion TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = nombre AND conrelid = tabla::regclass) THEN
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', tabla, nombre, definicion);
    END IF;
END $$;

-- ── 22.8 (antes de 22.3 porque es tabla de empresa) Numeracion por empresa ──
CREATE TABLE IF NOT EXISTS empresa_secuencias (
    empresa_id INTEGER     NOT NULL,
    nombre     VARCHAR(40) NOT NULL,
    valor      BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (empresa_id, nombre)
);
COMMENT ON TABLE empresa_secuencias IS 'Contadores por empresa (numero de proforma, codigo de repuesto). Cada mecanica numera desde 1.';

-- ── 22.9 (antes de asignar permisos) Catalogo de permisos (generado desde permisos.js) ──
-- CATALOGO_INICIO (generado desde permisos.js)
INSERT INTO permisos_catalogo (modulo, accion, modulo_nombre, accion_nombre, grupo, orden, solo_superadmin) VALUES
    ('dashboard', 'ver', 'Panel principal', 'Ver', 'Panel', 1, FALSE),
    ('inventario_mecanica', 'ver', 'Inventario de mecánica', 'Ver', 'Inventario', 2, FALSE),
    ('inventario_mecanica', 'crear', 'Inventario de mecánica', 'Crear', 'Inventario', 3, FALSE),
    ('inventario_mecanica', 'editar', 'Inventario de mecánica', 'Editar', 'Inventario', 4, FALSE),
    ('inventario_mecanica', 'eliminar', 'Inventario de mecánica', 'Eliminar', 'Inventario', 5, FALSE),
    ('inventario_colisiones', 'ver', 'Inventario de colisiones / pintura', 'Ver', 'Inventario', 6, FALSE),
    ('inventario_colisiones', 'crear', 'Inventario de colisiones / pintura', 'Crear', 'Inventario', 7, FALSE),
    ('inventario_colisiones', 'editar', 'Inventario de colisiones / pintura', 'Editar', 'Inventario', 8, FALSE),
    ('inventario_colisiones', 'eliminar', 'Inventario de colisiones / pintura', 'Eliminar', 'Inventario', 9, FALSE),
    ('registros_inventario', 'ver', 'Entradas y salidas de inventario', 'Ver registros', 'Inventario', 10, FALSE),
    ('registros_inventario', 'crear', 'Entradas y salidas de inventario', 'Registrar entradas / salidas', 'Inventario', 11, FALSE),
    ('registros_inventario', 'aprobar', 'Entradas y salidas de inventario', 'Devolver salidas al inventario', 'Inventario', 12, FALSE),
    ('pedidos_tienda', 'ver', 'Pedidos de la tienda', 'Ver', 'Inventario', 13, FALSE),
    ('pedidos_tienda', 'editar', 'Pedidos de la tienda', 'Atender / cancelar', 'Inventario', 14, FALSE),
    ('ordenes', 'ver', 'Órdenes de trabajo', 'Ver', 'Taller', 15, FALSE),
    ('ordenes', 'crear', 'Órdenes de trabajo', 'Crear', 'Taller', 16, FALSE),
    ('ordenes', 'editar', 'Órdenes de trabajo', 'Editar', 'Taller', 17, FALSE),
    ('ordenes', 'eliminar', 'Órdenes de trabajo', 'Eliminar', 'Taller', 18, FALSE),
    ('ordenes', 'asignar', 'Órdenes de trabajo', 'Asignar técnico', 'Taller', 19, FALSE),
    ('ordenes', 'aprobar', 'Órdenes de trabajo', 'Cambiar estado de cualquier orden', 'Taller', 20, FALSE),
    ('proformas_mecanica', 'ver', 'Proformas de mecánica', 'Ver', 'Taller', 21, FALSE),
    ('proformas_mecanica', 'crear', 'Proformas de mecánica', 'Crear', 'Taller', 22, FALSE),
    ('proformas_mecanica', 'editar', 'Proformas de mecánica', 'Editar', 'Taller', 23, FALSE),
    ('proformas_mecanica', 'eliminar', 'Proformas de mecánica', 'Eliminar', 'Taller', 24, FALSE),
    ('proformas_mecanica', 'exportar', 'Proformas de mecánica', 'Descargar PDF / Excel', 'Taller', 25, FALSE),
    ('proformas_mecanica', 'aprobar', 'Proformas de mecánica', 'Aprobar, rechazar, convertir en OT y confirmar materiales', 'Taller', 26, FALSE),
    ('proformas_colisiones', 'ver', 'Proformas de colisiones / pintura', 'Ver', 'Taller', 27, FALSE),
    ('proformas_colisiones', 'crear', 'Proformas de colisiones / pintura', 'Crear', 'Taller', 28, FALSE),
    ('proformas_colisiones', 'editar', 'Proformas de colisiones / pintura', 'Editar', 'Taller', 29, FALSE),
    ('proformas_colisiones', 'eliminar', 'Proformas de colisiones / pintura', 'Eliminar', 'Taller', 30, FALSE),
    ('proformas_colisiones', 'exportar', 'Proformas de colisiones / pintura', 'Descargar PDF / Excel', 'Taller', 31, FALSE),
    ('proformas_colisiones', 'aprobar', 'Proformas de colisiones / pintura', 'Aprobar, rechazar, convertir en OT y confirmar materiales', 'Taller', 32, FALSE),
    ('citas', 'ver', 'Citas', 'Ver', 'Taller', 33, FALSE),
    ('citas', 'editar', 'Citas', 'Confirmar / cambiar estado', 'Taller', 34, FALSE),
    ('clientes', 'ver', 'Clientes', 'Ver', 'Clientes', 35, FALSE),
    ('clientes', 'crear', 'Clientes', 'Crear', 'Clientes', 36, FALSE),
    ('clientes', 'editar', 'Clientes', 'Editar', 'Clientes', 37, FALSE),
    ('clientes', 'eliminar', 'Clientes', 'Eliminar', 'Clientes', 38, FALSE),
    ('vehiculos', 'ver', 'Vehículos', 'Ver', 'Clientes', 39, FALSE),
    ('vehiculos', 'crear', 'Vehículos', 'Crear', 'Clientes', 40, FALSE),
    ('vehiculos', 'editar', 'Vehículos', 'Editar', 'Clientes', 41, FALSE),
    ('vehiculos', 'eliminar', 'Vehículos', 'Eliminar', 'Clientes', 42, FALSE),
    ('cuentas_cobrar', 'ver', 'Pagarés y cuentas por cobrar', 'Ver', 'Clientes', 43, FALSE),
    ('cuentas_cobrar', 'crear', 'Pagarés y cuentas por cobrar', 'Crear', 'Clientes', 44, FALSE),
    ('cuentas_cobrar', 'editar', 'Pagarés y cuentas por cobrar', 'Editar (vencimiento, datos)', 'Clientes', 45, FALSE),
    ('cuentas_cobrar', 'eliminar', 'Pagarés y cuentas por cobrar', 'Eliminar / anular / reabrir', 'Clientes', 46, FALSE),
    ('pagos_clientes', 'crear', 'Registro de pagos de clientes', 'Registrar pagos', 'Clientes', 47, FALSE),
    ('pagos_clientes', 'eliminar', 'Registro de pagos de clientes', 'Anular pagos', 'Clientes', 48, FALSE),
    ('caja', 'ver', 'Caja diaria', 'Ver', 'Finanzas', 49, FALSE),
    ('caja', 'crear', 'Caja diaria', 'Registrar movimientos de caja', 'Finanzas', 50, FALSE),
    ('caja', 'aprobar', 'Caja diaria', 'Abrir y cerrar caja', 'Finanzas', 51, FALSE),
    ('caja', 'eliminar', 'Caja diaria', 'Anular movimientos manuales de caja', 'Finanzas', 52, FALSE),
    ('caja', 'reabrir', 'Caja diaria', 'Reabrir una caja cerrada', 'Finanzas', 53, FALSE),
    ('finanzas', 'ver', 'Finanzas, cuentas y nómina', 'Ver', 'Finanzas', 54, FALSE),
    ('finanzas', 'crear', 'Finanzas, cuentas y nómina', 'Crear', 'Finanzas', 55, FALSE),
    ('finanzas', 'editar', 'Finanzas, cuentas y nómina', 'Editar', 'Finanzas', 56, FALSE),
    ('finanzas', 'eliminar', 'Finanzas, cuentas y nómina', 'Anular movimientos / pagos', 'Finanzas', 57, FALSE),
    ('proveedores', 'ver', 'Proveedores, compras y gastos', 'Ver', 'Proveedores', 58, FALSE),
    ('proveedores', 'crear', 'Proveedores, compras y gastos', 'Crear', 'Proveedores', 59, FALSE),
    ('proveedores', 'editar', 'Proveedores, compras y gastos', 'Editar', 'Proveedores', 60, FALSE),
    ('proveedores', 'eliminar', 'Proveedores, compras y gastos', 'Eliminar', 'Proveedores', 61, FALSE),
    ('facturacion', 'ver', 'Facturación electrónica (SRI)', 'Ver comprobantes', 'Facturación', 62, FALSE),
    ('facturacion', 'crear', 'Facturación electrónica (SRI)', 'Preparar borradores', 'Facturación', 63, FALSE),
    ('facturacion', 'aprobar', 'Facturación electrónica (SRI)', 'Emitir y enviar al SRI', 'Facturación', 64, FALSE),
    ('facturacion', 'exportar', 'Facturación electrónica (SRI)', 'Descargar XML / RIDE y reenviar correo', 'Facturación', 65, FALSE),
    ('facturacion', 'anular', 'Facturación electrónica (SRI)', 'Notas de crédito y registro de anulaciones', 'Facturación', 66, FALSE),
    ('facturacion', 'eliminar', 'Facturación electrónica (SRI)', 'Descartar borradores', 'Facturación', 67, FALSE),
    ('facturacion_config', 'ver', 'Configuración tributaria y firma electrónica', 'Ver', 'Facturación', 68, FALSE),
    ('facturacion_config', 'editar', 'Configuración tributaria y firma electrónica', 'Editar datos tributarios, puntos de emisión y certificado', 'Facturación', 69, FALSE),
    ('facturacion_config', 'aprobar', 'Configuración tributaria y firma electrónica', 'Activar el ambiente de producción', 'Facturación', 70, FALSE),
    ('estadisticas', 'ver', 'Reportes y estadísticas', 'Ver', 'Reportes', 71, FALSE),
    ('servicios', 'ver', 'Servicios del taller', 'Ver', 'Ajustes', 72, FALSE),
    ('servicios', 'crear', 'Servicios del taller', 'Crear', 'Ajustes', 73, FALSE),
    ('servicios', 'editar', 'Servicios del taller', 'Editar', 'Ajustes', 74, FALSE),
    ('servicios', 'eliminar', 'Servicios del taller', 'Eliminar', 'Ajustes', 75, FALSE),
    ('sucursales', 'ver', 'Sucursales', 'Ver', 'Ajustes', 76, FALSE),
    ('sucursales', 'crear', 'Sucursales', 'Crear', 'Ajustes', 77, FALSE),
    ('sucursales', 'editar', 'Sucursales', 'Editar', 'Ajustes', 78, FALSE),
    ('sucursales', 'eliminar', 'Sucursales', 'Eliminar', 'Ajustes', 79, FALSE),
    ('bitacora', 'ver', 'Bitácora de operaciones', 'Ver', 'Ajustes', 80, FALSE),
    ('usuarios', 'ver', 'Usuarios y permisos de la empresa', 'Ver', 'Empresa', 81, FALSE),
    ('usuarios', 'crear', 'Usuarios y permisos de la empresa', 'Crear', 'Empresa', 82, FALSE),
    ('usuarios', 'editar', 'Usuarios y permisos de la empresa', 'Editar, activar/desactivar, permisos y restablecer acceso', 'Empresa', 83, FALSE),
    ('usuarios', 'eliminar', 'Usuarios y permisos de la empresa', 'Eliminar', 'Empresa', 84, FALSE),
    ('auditoria', 'ver', 'Auditoría de la empresa', 'Ver', 'Empresa', 85, FALSE),
    ('empresa', 'ver', 'Configuración de la empresa', 'Ver', 'Empresa', 86, FALSE),
    ('empresa', 'editar', 'Configuración de la empresa', 'Editar', 'Empresa', 87, FALSE),
    ('legal', 'ver', 'Documentos legales y aceptaciones', 'Ver documentos, aceptaciones y constancias', 'Empresa', 88, FALSE),
    ('legal', 'editar', 'Documentos legales y aceptaciones', 'Redactar borradores', 'Empresa', 89, FALSE),
    ('legal', 'aprobar', 'Documentos legales y aceptaciones', 'Publicar versiones', 'Empresa', 90, FALSE)
ON CONFLICT (modulo, accion) DO UPDATE SET
    modulo_nombre = EXCLUDED.modulo_nombre, accion_nombre = EXCLUDED.accion_nombre,
    grupo = EXCLUDED.grupo, orden = EXCLUDED.orden, solo_superadmin = EXCLUDED.solo_superadmin;
-- CATALOGO_FIN

-- ── 22.3 empresa_id en las tablas operativas ──
DO $$
DECLARE
    t TEXT;
    tablas TEXT[] := ARRAY['usuarios', 'usuario_permisos', 'auditoria_seguridad', 'sucursales', 'tipos_servicio', 'clientes', 'vehiculos', 'citas', 'ordenes_trabajo', 'ordenes_historial', 'categorias_repuesto', 'repuestos', 'movimientos_inventario', 'solicitudes_producto', 'proformas', 'proforma_items', 'proforma_zonas_danadas', 'cuentas_cobrar', 'pagos_cliente', 'proveedores', 'proveedores_contactos', 'gastos_proveedor', 'compras_proveedor', 'compras_proveedor_items', 'movimientos_financieros_proveedor', 'cuentas_dinero', 'caja_sesiones', 'caja_movimientos', 'movimientos_dinero', 'empleados_perfil', 'pagos_empleados', 'empresa_secuencias'];
    v_ssswap INTEGER;
    v_empresas INTEGER;
    v_sin_empresa BIGINT;
    v_asociar BOOLEAN;
BEGIN
    SELECT id INTO v_ssswap FROM empresas WHERE slug = 'ss-swap';
    SELECT COUNT(*) INTO v_empresas FROM empresas;
    -- La asociacion de los datos existentes se hace UNA vez (primera corrida).
    v_asociar := NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '22-multiempresa' AND resultado = 'exito');

    FOREACH t IN ARRAY tablas LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS empresa_id INTEGER', t);

        IF v_asociar THEN
            EXECUTE format('SELECT COUNT(*) FROM %I WHERE empresa_id IS NULL', t) INTO v_sin_empresa;
            IF v_sin_empresa > 0 AND v_empresas > 1 THEN
                RAISE EXCEPTION 'La tabla % tiene % fila(s) sin empresa y ya existen % empresas: no se puede asumir que son de SS SWAP. Revisar antes de continuar.', t, v_sin_empresa, v_empresas;
            END IF;
            -- Todo lo existente antes de la plataforma multiempresa es de SS SWAP.
            -- La auditoria es de solo insercion: su trigger se suspende SOLO para
            -- esta asignacion unica de empresa (no cambia ningun otro dato).
            IF t = 'auditoria_seguridad' AND v_sin_empresa > 0 THEN
                ALTER TABLE auditoria_seguridad DISABLE TRIGGER trg_auditoria_solo_insercion;
            END IF;
            EXECUTE format('UPDATE %I SET empresa_id = %s WHERE empresa_id IS NULL', t, v_ssswap);
            IF t = 'auditoria_seguridad' AND v_sin_empresa > 0 THEN
                ALTER TABLE auditoria_seguridad ENABLE TRIGGER trg_auditoria_solo_insercion;
            END IF;
        END IF;

        EXECUTE format('ALTER TABLE %I ALTER COLUMN empresa_id SET DEFAULT empresa_actual()', t);
        PERFORM agregar_constraint_si_falta(t, 'fk_' || t || '_empresa', 'FOREIGN KEY (empresa_id) REFERENCES empresas(id)');
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (empresa_id)', 'idx_' || t || '_empresa', t);
        -- usuarios: NULL solo para un superadministrador global (sin empresa propia).
        -- auditoria_seguridad: NULL = evento de la plataforma (solo lo ve el superadministrador).
        IF t NOT IN ('usuarios', 'auditoria_seguridad') THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN empresa_id SET NOT NULL', t);
        ELSE
            EXECUTE format('ALTER TABLE %I ALTER COLUMN empresa_id DROP NOT NULL', t);
        END IF;
    END LOOP;

    PERFORM agregar_constraint_si_falta('usuarios', 'usuarios_empresa_requerida',
        'CHECK (empresa_id IS NOT NULL OR rol = ''superadministrador'')');

    IF v_asociar THEN
        -- Los administradores de SS SWAP pasan a gestionar el personal de su
        -- empresa (en el Sprint 21 era exclusivo del superadministrador).
        INSERT INTO usuario_permisos (usuario_id, modulo, accion, empresa_id)
        SELECT u.id, x.modulo, x.accion, u.empresa_id
        FROM usuarios u
        CROSS JOIN (VALUES ('usuarios','ver'),('usuarios','crear'),('usuarios','editar'),('usuarios','eliminar'),
                           ('auditoria','ver'),('empresa','ver'),('empresa','editar')) AS x(modulo, accion)
        WHERE u.rol = 'administrador' AND u.empresa_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM permisos_catalogo pc WHERE pc.modulo = x.modulo AND pc.accion = x.accion)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- usuario_permisos: si se inserta sin empresa (scripts del servidor), la toma del usuario.
CREATE OR REPLACE FUNCTION usuario_permisos_empresa() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.empresa_id IS NULL THEN
        SELECT empresa_id INTO NEW.empresa_id FROM usuarios WHERE id = NEW.usuario_id;
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_usuario_permisos_empresa ON usuario_permisos;
CREATE TRIGGER trg_usuario_permisos_empresa BEFORE INSERT ON usuario_permisos
    FOR EACH ROW EXECUTE FUNCTION usuario_permisos_empresa();

-- Numeracion: SS SWAP continua desde donde iban sus contadores globales.
INSERT INTO empresa_secuencias (empresa_id, nombre, valor)
SELECT e.id, 'proformas', (SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END FROM proformas_numero_seq)
FROM empresas e WHERE e.slug = 'ss-swap'
ON CONFLICT DO NOTHING;
INSERT INTO empresa_secuencias (empresa_id, nombre, valor)
SELECT e.id, 'repuestos_referencia', (SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END FROM repuestos_referencia_seq)
FROM empresas e WHERE e.slug = 'ss-swap'
ON CONFLICT DO NOTHING;

-- ── 22.4 Unicidades por empresa (se conserva el nombre de cada restriccion) ──
CREATE OR REPLACE FUNCTION reemplazar_unique_por_empresa(tabla TEXT, nombre TEXT, columnas TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = nombre AND conrelid = tabla::regclass
               AND pg_get_constraintdef(oid) NOT LIKE '%empresa_id%') THEN
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tabla, nombre);
    END IF;
    PERFORM agregar_constraint_si_falta(tabla, nombre, format('UNIQUE (empresa_id, %s)', columnas));
END $$;

CREATE OR REPLACE FUNCTION reemplazar_indice_por_empresa(nombre TEXT, definicion TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = nombre AND indexdef NOT LIKE '%empresa_id%') THEN
        EXECUTE format('DROP INDEX %I', nombre);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = nombre) THEN
        EXECUTE format('CREATE UNIQUE INDEX %I %s', nombre, definicion);
    END IF;
END $$;

DO $$
BEGIN
    PERFORM reemplazar_unique_por_empresa('categorias_repuesto', 'categorias_repuesto_nombre_key', 'nombre');
    PERFORM reemplazar_unique_por_empresa('repuestos', 'repuestos_codigo_key', 'codigo');
    PERFORM reemplazar_unique_por_empresa('clientes', 'clientes_cedula_key', 'cedula');
    PERFORM reemplazar_unique_por_empresa('proformas', 'proformas_numero_key', 'numero');
    PERFORM reemplazar_unique_por_empresa('cuentas_dinero', 'cuentas_dinero_nombre_key', 'nombre');
    PERFORM reemplazar_indice_por_empresa('uq_caja_sesion_abierta', 'ON caja_sesiones (empresa_id) WHERE estado = ''abierta''');
    PERFORM reemplazar_indice_por_empresa('uq_sucursal_principal', 'ON sucursales (empresa_id) WHERE es_principal');
    PERFORM reemplazar_indice_por_empresa('uq_proveedores_ruc', 'ON proveedores (empresa_id, (TRIM(ruc))) WHERE NULLIF(TRIM(ruc), '''') IS NOT NULL');
    PERFORM reemplazar_indice_por_empresa('uq_cuenta_dinero_predeterminada', 'ON cuentas_dinero (empresa_id, tipo) WHERE predeterminada');
END $$;

-- ── 22.5 Relaciones dentro de la misma empresa (generado desde multiempresa.js) ──
-- RELACIONES_INICIO
DO $$
BEGIN
    PERFORM agregar_constraint_si_falta('caja_sesiones', 'uq_caja_sesiones_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('categorias_repuesto', 'uq_categorias_repuesto_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('clientes', 'uq_clientes_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('compras_proveedor', 'uq_compras_proveedor_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('cuentas_cobrar', 'uq_cuentas_cobrar_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('cuentas_dinero', 'uq_cuentas_dinero_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('gastos_proveedor', 'uq_gastos_proveedor_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_dinero', 'uq_movimientos_dinero_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_inventario', 'uq_movimientos_inventario_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('ordenes_trabajo', 'uq_ordenes_trabajo_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proforma_items', 'uq_proforma_items_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proformas', 'uq_proformas_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proveedores', 'uq_proveedores_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('repuestos', 'uq_repuestos_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('sucursales', 'uq_sucursales_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('tipos_servicio', 'uq_tipos_servicio_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('usuarios', 'uq_usuarios_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('vehiculos', 'uq_vehiculos_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('repuestos', 'fk_emp_repuestos_categoria_id', 'FOREIGN KEY (categoria_id, empresa_id) REFERENCES categorias_repuesto(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_inventario', 'fk_emp_movimientos_inventario_repuesto_id', 'FOREIGN KEY (repuesto_id, empresa_id) REFERENCES repuestos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_inventario', 'fk_emp_movimientos_inventario_proforma_id', 'FOREIGN KEY (proforma_id, empresa_id) REFERENCES proformas(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_inventario', 'fk_emp_movimientos_inventario_proforma_item_id', 'FOREIGN KEY (proforma_item_id, empresa_id) REFERENCES proforma_items(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_inventario', 'fk_emp_movimientos_inventario_orden_id', 'FOREIGN KEY (orden_id, empresa_id) REFERENCES ordenes_trabajo(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_inventario', 'fk_emp_movimientos_inventario_compra_id', 'FOREIGN KEY (compra_id, empresa_id) REFERENCES compras_proveedor(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_inventario', 'fk_emp_movimientos_inventario_movimiento_revertido_id', 'FOREIGN KEY (movimiento_revertido_id, empresa_id) REFERENCES movimientos_inventario(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('vehiculos', 'fk_emp_vehiculos_cliente_id', 'FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('ordenes_trabajo', 'fk_emp_ordenes_trabajo_cliente_id', 'FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('ordenes_trabajo', 'fk_emp_ordenes_trabajo_vehiculo_id', 'FOREIGN KEY (vehiculo_id, empresa_id) REFERENCES vehiculos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('ordenes_trabajo', 'fk_emp_ordenes_trabajo_tecnico_id', 'FOREIGN KEY (tecnico_id, empresa_id) REFERENCES usuarios(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('citas', 'fk_emp_citas_cliente_id', 'FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('citas', 'fk_emp_citas_vehiculo_id', 'FOREIGN KEY (vehiculo_id, empresa_id) REFERENCES vehiculos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('citas', 'fk_emp_citas_servicio_id', 'FOREIGN KEY (servicio_id, empresa_id) REFERENCES tipos_servicio(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('citas', 'fk_emp_citas_sucursal_id', 'FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('citas', 'fk_emp_citas_usuario_id', 'FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('solicitudes_producto', 'fk_emp_solicitudes_producto_cliente_id', 'FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('solicitudes_producto', 'fk_emp_solicitudes_producto_usuario_id', 'FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('solicitudes_producto', 'fk_emp_solicitudes_producto_repuesto_id', 'FOREIGN KEY (repuesto_id, empresa_id) REFERENCES repuestos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('solicitudes_producto', 'fk_emp_solicitudes_producto_movimiento_id', 'FOREIGN KEY (movimiento_id, empresa_id) REFERENCES movimientos_inventario(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('solicitudes_producto', 'fk_emp_solicitudes_producto_cobro_id', 'FOREIGN KEY (cobro_id, empresa_id) REFERENCES movimientos_dinero(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('ordenes_historial', 'fk_emp_ordenes_historial_orden_id', 'FOREIGN KEY (orden_id, empresa_id) REFERENCES ordenes_trabajo(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proveedores_contactos', 'fk_emp_proveedores_contactos_proveedor_id', 'FOREIGN KEY (proveedor_id, empresa_id) REFERENCES proveedores(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('gastos_proveedor', 'fk_emp_gastos_proveedor_proveedor_id', 'FOREIGN KEY (proveedor_id, empresa_id) REFERENCES proveedores(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('gastos_proveedor', 'fk_emp_gastos_proveedor_cuenta_dinero_id', 'FOREIGN KEY (cuenta_dinero_id, empresa_id) REFERENCES cuentas_dinero(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('compras_proveedor', 'fk_emp_compras_proveedor_proveedor_id', 'FOREIGN KEY (proveedor_id, empresa_id) REFERENCES proveedores(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('compras_proveedor_items', 'fk_emp_compras_proveedor_items_compra_id', 'FOREIGN KEY (compra_id, empresa_id) REFERENCES compras_proveedor(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('compras_proveedor_items', 'fk_emp_compras_proveedor_items_repuesto_id', 'FOREIGN KEY (repuesto_id, empresa_id) REFERENCES repuestos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_financieros_proveedor', 'fk_emp_movimientos_financieros_proveedor_proveedor_id', 'FOREIGN KEY (proveedor_id, empresa_id) REFERENCES proveedores(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_financieros_proveedor', 'fk_emp_movimientos_financieros_proveedor_gasto_id', 'FOREIGN KEY (gasto_id, empresa_id) REFERENCES gastos_proveedor(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_financieros_proveedor', 'fk_emp_movimientos_financieros_proveedor_compra_id', 'FOREIGN KEY (compra_id, empresa_id) REFERENCES compras_proveedor(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_financieros_proveedor', 'fk_emp_movimientos_financieros_proveedor_cuenta_dinero_id', 'FOREIGN KEY (cuenta_dinero_id, empresa_id) REFERENCES cuentas_dinero(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proformas', 'fk_emp_proformas_cliente_id', 'FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proformas', 'fk_emp_proformas_vehiculo_id', 'FOREIGN KEY (vehiculo_id, empresa_id) REFERENCES vehiculos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proformas', 'fk_emp_proformas_orden_id', 'FOREIGN KEY (orden_id, empresa_id) REFERENCES ordenes_trabajo(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proformas', 'fk_emp_proformas_orden_generada_id', 'FOREIGN KEY (orden_generada_id, empresa_id) REFERENCES ordenes_trabajo(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proformas', 'fk_emp_proformas_sucursal_id', 'FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proforma_items', 'fk_emp_proforma_items_proforma_id', 'FOREIGN KEY (proforma_id, empresa_id) REFERENCES proformas(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proforma_zonas_danadas', 'fk_emp_proforma_zonas_danadas_proforma_id', 'FOREIGN KEY (proforma_id, empresa_id) REFERENCES proformas(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('cuentas_cobrar', 'fk_emp_cuentas_cobrar_cliente_id', 'FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('cuentas_cobrar', 'fk_emp_cuentas_cobrar_vehiculo_id', 'FOREIGN KEY (vehiculo_id, empresa_id) REFERENCES vehiculos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('cuentas_cobrar', 'fk_emp_cuentas_cobrar_proforma_id', 'FOREIGN KEY (proforma_id, empresa_id) REFERENCES proformas(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('cuentas_cobrar', 'fk_emp_cuentas_cobrar_orden_id', 'FOREIGN KEY (orden_id, empresa_id) REFERENCES ordenes_trabajo(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('pagos_cliente', 'fk_emp_pagos_cliente_cuenta_id', 'FOREIGN KEY (cuenta_id, empresa_id) REFERENCES cuentas_cobrar(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('pagos_cliente', 'fk_emp_pagos_cliente_cuenta_dinero_id', 'FOREIGN KEY (cuenta_dinero_id, empresa_id) REFERENCES cuentas_dinero(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('caja_sesiones', 'fk_emp_caja_sesiones_sucursal_id', 'FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('caja_movimientos', 'fk_emp_caja_movimientos_caja_sesion_id', 'FOREIGN KEY (caja_sesion_id, empresa_id) REFERENCES caja_sesiones(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('caja_movimientos', 'fk_emp_caja_movimientos_cuenta_dinero_id', 'FOREIGN KEY (cuenta_dinero_id, empresa_id) REFERENCES cuentas_dinero(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_dinero', 'fk_emp_movimientos_dinero_cuenta_dinero_id', 'FOREIGN KEY (cuenta_dinero_id, empresa_id) REFERENCES cuentas_dinero(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_dinero', 'fk_emp_movimientos_dinero_caja_sesion_id', 'FOREIGN KEY (caja_sesion_id, empresa_id) REFERENCES caja_sesiones(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('empleados_perfil', 'fk_emp_empleados_perfil_usuario_id', 'FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('pagos_empleados', 'fk_emp_pagos_empleados_usuario_id', 'FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('pagos_empleados', 'fk_emp_pagos_empleados_cuenta_dinero_id', 'FOREIGN KEY (cuenta_dinero_id, empresa_id) REFERENCES cuentas_dinero(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('usuario_permisos', 'fk_emp_usuario_permisos_usuario_id', 'FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)');
END $$;
-- RELACIONES_FIN

-- ── 22.6 Rol de la aplicacion y Row Level Security ──
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ssswap_app') THEN
        CREATE ROLE ssswap_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
    END IF;
    -- El usuario de conexion debe poder hacer SET ROLE ssswap_app (en Supabase
    -- el usuario postgres no es superusuario). Desde PostgreSQL 16 quien crea
    -- un rol queda solo con ADMIN sobre el (sin SET), asi que la membresia
    -- existe pero SET ROLE falla: se concede SET explicitamente.
    IF current_setting('server_version_num')::int >= 160000 THEN
        EXECUTE format('GRANT ssswap_app TO %I WITH SET TRUE', current_user);
    ELSIF NOT EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid
                   JOIN pg_roles u ON u.oid = m.member
                   WHERE r.rolname = 'ssswap_app' AND u.rolname = current_user) THEN
        EXECUTE format('GRANT ssswap_app TO %I', current_user);
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO ssswap_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ssswap_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ssswap_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ssswap_app;
-- Catalogos: solo lectura. Plataforma: sin acceso. empresas: ver/editar la propia.
REVOKE INSERT, UPDATE, DELETE ON cat_areas_inventario, cat_metodos_pago, cat_tipos_proforma,
    cat_origenes_movimiento, cat_categorias_dinero, permisos_catalogo FROM ssswap_app;
REVOKE ALL ON migraciones_registro, accesos_soporte, respaldos_registro, errores_sistema FROM ssswap_app;
-- empresas: cada empresa solo cambia sus datos comerciales y la autorizacion
-- de soporte (nunca su estado ni su identificador).
REVOKE INSERT, UPDATE, DELETE ON empresas FROM ssswap_app;
GRANT UPDATE (nombre, nombre_comercial, razon_social, ruc, direccion, telefono, email, permite_soporte) ON empresas TO ssswap_app;
-- La auditoria es de solo insercion tambien para la app.
REVOKE UPDATE, DELETE ON auditoria_seguridad FROM ssswap_app;

DO $$
DECLARE
    t TEXT;
    tablas TEXT[] := ARRAY['usuarios', 'usuario_permisos', 'auditoria_seguridad', 'sucursales', 'tipos_servicio', 'clientes', 'vehiculos', 'citas', 'ordenes_trabajo', 'ordenes_historial', 'categorias_repuesto', 'repuestos', 'movimientos_inventario', 'solicitudes_producto', 'proformas', 'proforma_items', 'proforma_zonas_danadas', 'cuentas_cobrar', 'pagos_cliente', 'proveedores', 'proveedores_contactos', 'gastos_proveedor', 'compras_proveedor', 'compras_proveedor_items', 'movimientos_financieros_proveedor', 'cuentas_dinero', 'caja_sesiones', 'caja_movimientos', 'movimientos_dinero', 'empleados_perfil', 'pagos_empleados', 'empresa_secuencias'];
BEGIN
    FOREACH t IN ARRAY tablas LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS aislamiento_empresa ON %I', t);
        EXECUTE format('CREATE POLICY aislamiento_empresa ON %I USING (empresa_id = empresa_actual()) WITH CHECK (empresa_id = empresa_actual())', t);
    END LOOP;
    ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS empresa_propia ON empresas;
    CREATE POLICY empresa_propia ON empresas USING (id = empresa_actual()) WITH CHECK (id = empresa_actual());
    -- Tablas de plataforma: RLS sin politicas = nadie salvo el propietario
    -- (protege tambien contra el API REST de Supabase).
    ALTER TABLE migraciones_registro ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accesos_soporte ENABLE ROW LEVEL SECURITY;
    ALTER TABLE respaldos_registro ENABLE ROW LEVEL SECURITY;
    ALTER TABLE errores_sistema ENABLE ROW LEVEL SECURITY;
END $$;

-- ── 22.7 Vistas: se ejecutan con los permisos de quien consulta (respetan RLS) ──
ALTER VIEW v_movimientos_inventario_detalle SET (security_invoker = true);
ALTER VIEW v_cuentas_cobrar_detalle SET (security_invoker = true);
ALTER VIEW v_flujo_dinero SET (security_invoker = true);



-- ── 22.10 Validaciones finales y registro ──
DO $$
DECLARE
    t TEXT;
    tablas TEXT[] := ARRAY['usuarios', 'usuario_permisos', 'auditoria_seguridad', 'sucursales', 'tipos_servicio', 'clientes', 'vehiculos', 'citas', 'ordenes_trabajo', 'ordenes_historial', 'categorias_repuesto', 'repuestos', 'movimientos_inventario', 'solicitudes_producto', 'proformas', 'proforma_items', 'proforma_zonas_danadas', 'cuentas_cobrar', 'pagos_cliente', 'proveedores', 'proveedores_contactos', 'gastos_proveedor', 'compras_proveedor', 'compras_proveedor_items', 'movimientos_financieros_proveedor', 'cuentas_dinero', 'caja_sesiones', 'caja_movimientos', 'movimientos_dinero', 'empleados_perfil', 'pagos_empleados', 'empresa_secuencias'];
    globales TEXT[] := ARRAY['cat_areas_inventario', 'cat_metodos_pago', 'cat_tipos_proforma', 'cat_origenes_movimiento', 'cat_categorias_dinero', 'permisos_catalogo', 'migraciones_registro', 'accesos_soporte', 'respaldos_registro', 'errores_sistema'];
    n BIGINT;
    detalle JSONB := '{}'::jsonb;
    v_ssswap INTEGER;
BEGIN
    SELECT id INTO v_ssswap FROM empresas WHERE slug = 'ss-swap';
    IF v_ssswap IS NULL THEN RAISE EXCEPTION 'Validacion: no existe la empresa SS SWAP.'; END IF;

    FOREACH t IN ARRAY tablas LOOP
        -- Ninguna fila sin empresa (salvo superadministradores globales).
        IF t = 'usuarios' THEN
            SELECT COUNT(*) INTO n FROM usuarios WHERE empresa_id IS NULL AND rol <> 'superadministrador';
        ELSIF t = 'auditoria_seguridad' THEN
            n := 0;
        ELSE
            EXECUTE format('SELECT COUNT(*) FROM %I WHERE empresa_id IS NULL', t) INTO n;
        END IF;
        IF n > 0 THEN RAISE EXCEPTION 'Validacion: % tiene % fila(s) sin empresa.', t, n; END IF;
        -- RLS activo.
        IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = t::regclass) THEN
            RAISE EXCEPTION 'Validacion: % no tiene Row Level Security.', t;
        END IF;
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE empresa_id = %s', t, v_ssswap) INTO n;
        detalle := detalle || jsonb_build_object(t, n);
    END LOOP;

    -- Toda tabla a la que la app puede escribir debe estar aislada o ser
    -- un catalogo/plataforma conocido: una tabla nueva sin empresa_id falla aqui.
    -- (Sprint 23: las tablas de sprints posteriores cuentan como protegidas si
    -- tienen RLS activo: con politicas quedan aisladas por empresa y sin
    -- politicas nadie salvo el sistema las lee. Su propio bloque las valida.)
    FOR t IN
        SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname = 'public' AND c.relkind = 'r'
          AND has_table_privilege('ssswap_app', c.oid, 'SELECT')
          AND NOT (c.relname = ANY (tablas)) AND NOT (c.relname = ANY (globales)) AND c.relname <> 'empresas'
          AND NOT c.relrowsecurity
    LOOP
        RAISE EXCEPTION 'Validacion: la tabla % es accesible para la app pero no esta clasificada (empresa o global).', t;
    END LOOP;

    INSERT INTO migraciones_registro (version, descripcion, resultado, detalle)
    SELECT '22-multiempresa', 'Plataforma multiempresa: SS SWAP como primera empresa, RLS y llaves compuestas', 'exito',
           jsonb_build_object('empresa_ss_swap', v_ssswap, 'filas_ss_swap', detalle)
    WHERE NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '22-multiempresa' AND resultado = 'exito');
END $$;


-- ============================================================
-- Sprint 23: Facturacion electronica SRI + documentos legales
--
-- Requiere el Sprint 22 (empresas, RLS, rol ssswap_app). 100 % aditivo:
-- no borra ni modifica datos existentes (solo agrega columnas opcionales a
-- clientes). Idempotente: se puede correr varias veces.
--
-- 23.1 Clientes: tipo de identificacion SRI y confirmacion de datos.
-- 23.2 Configuracion tributaria del emisor (por empresa) y certificado
--      CIFRADO (AES-256-GCM con la llave SRI_CERT_KEY del servidor).
-- 23.3 Puntos de emision (establecimiento + punto habilitados en el SRI).
-- 23.4 Comprobantes electronicos, detalles y eventos (bitacora inmutable).
--      Un comprobante AUTORIZADO no se puede editar ni borrar (trigger).
-- 23.5 Documentos legales versionados, contratos y aceptaciones
--      (evidencia de solo insercion, ligada al hash del texto aceptado).
-- 23.6 Proveedor de la plataforma (datos para el flujo de contratacion).
-- 23.7 Aislamiento por empresa (RLS + llaves compuestas generadas desde
--      backend/src/config/multiempresa.js) y permisos del rol ssswap_app.
-- 23.8 Permisos nuevos para los administradores existentes (una vez).
-- 23.9 Validaciones finales y registro.
-- ============================================================

-- ── 23.1 Clientes ──
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_identificacion VARCHAR(2);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS identificacion_confirmada_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS identificacion_confirmada_por INTEGER;
SELECT agregar_constraint_si_falta('clientes', 'chk_clientes_tipo_identificacion',
    'CHECK (tipo_identificacion IS NULL OR tipo_identificacion IN (''04'',''05'',''06'',''07'',''08''))');
COMMENT ON COLUMN clientes.tipo_identificacion IS 'Tipo SRI (Tabla 6): 04 RUC, 05 cedula, 06 pasaporte, 07 consumidor final, 08 exterior. NULL = sin confirmar.';
COMMENT ON COLUMN clientes.identificacion_confirmada_at IS 'Cuando una persona autorizada confirmo la identificacion y razon social (el SRI no publica un servicio de consulta de RUC).';

-- ── 23.2 Configuracion tributaria ──
CREATE TABLE IF NOT EXISTS sri_configuracion (
    id                        SERIAL PRIMARY KEY,
    empresa_id                INTEGER NOT NULL DEFAULT empresa_actual() UNIQUE,
    ruc                       VARCHAR(13),
    razon_social              VARCHAR(300),
    nombre_comercial          VARCHAR(300),
    dir_matriz                VARCHAR(300),
    regimen                   VARCHAR(30) NOT NULL DEFAULT 'general'
                              CHECK (regimen IN ('general','rimpe_emprendedor','rimpe_negocio_popular')),
    obligado_contabilidad     BOOLEAN NOT NULL DEFAULT FALSE,
    contribuyente_especial    VARCHAR(13),
    agente_retencion          VARCHAR(8),
    email_emisor              VARCHAR(150),
    telefono                  VARCHAR(30),
    iva_codigo_defecto        VARCHAR(4) NOT NULL DEFAULT '4',
    ruc_proveedor_sistema     VARCHAR(13),
    ambiente                  SMALLINT NOT NULL DEFAULT 1 CHECK (ambiente IN (1,2)),
    produccion_habilitada_at  TIMESTAMP WITH TIME ZONE,
    produccion_habilitada_por INTEGER,
    espera_autorizacion_seg   INTEGER NOT NULL DEFAULT 3 CHECK (espera_autorizacion_seg BETWEEN 1 AND 60),
    certificado_cifrado       BYTEA,
    certificado_clave_cifrada BYTEA,
    certificado_titular       VARCHAR(300),
    certificado_emisor        VARCHAR(300),
    certificado_serial        VARCHAR(80),
    certificado_desde         TIMESTAMP WITH TIME ZONE,
    certificado_hasta         TIMESTAMP WITH TIME ZONE,
    certificado_ruc           VARCHAR(13),
    certificado_huella        VARCHAR(64),
    certificado_cargado_por   INTEGER,
    certificado_cargado_at    TIMESTAMP WITH TIME ZONE,
    actualizado_por           INTEGER,
    created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (ruc IS NULL OR ruc ~ '^[0-9]{13}$'),
    CHECK (ruc_proveedor_sistema IS NULL OR ruc_proveedor_sistema ~ '^[0-9]{13}$'),
    -- Produccion solo con la habilitacion registrada (quien y cuando).
    CHECK (ambiente = 1 OR produccion_habilitada_at IS NOT NULL)
);
COMMENT ON TABLE sri_configuracion IS 'Datos tributarios del EMISOR de cada empresa. Los ingresa y verifica un administrador; nunca se copian de otro comprobante.';
COMMENT ON COLUMN sri_configuracion.certificado_cifrado IS 'Archivo .p12 cifrado (AES-256-GCM, llave SRI_CERT_KEY del servidor). Nunca se devuelve por la API.';
COMMENT ON COLUMN sri_configuracion.ruc_proveedor_sistema IS 'Anexo 26 (Ficha v2.34): RUC del proveedor del sistema de facturacion, solo si es un tercero de la resolucion 2718.';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_sri_configuracion') THEN
        CREATE TRIGGER set_updated_at_sri_configuracion BEFORE UPDATE ON sri_configuracion FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── 23.3 Puntos de emision ──
CREATE TABLE IF NOT EXISTS sri_puntos_emision (
    id                SERIAL PRIMARY KEY,
    empresa_id        INTEGER NOT NULL DEFAULT empresa_actual(),
    establecimiento   CHAR(3) NOT NULL CHECK (establecimiento ~ '^[0-9]{3}$' AND establecimiento <> '000'),
    punto_emision     CHAR(3) NOT NULL CHECK (punto_emision ~ '^[0-9]{3}$' AND punto_emision <> '000'),
    direccion         VARCHAR(300) NOT NULL,
    sucursal_id       INTEGER,
    descripcion       VARCHAR(120),
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (empresa_id, establecimiento, punto_emision)
);
COMMENT ON TABLE sri_puntos_emision IS 'Establecimiento y punto de emision habilitados en el SRI. La numeracion de cada uno vive en empresa_secuencias (sri:<ambiente>:<codDoc>:<estab>-<pto>).';

-- ── 23.4 Comprobantes electronicos ──
CREATE TABLE IF NOT EXISTS comprobantes_electronicos (
    id                         SERIAL PRIMARY KEY,
    empresa_id                 INTEGER NOT NULL DEFAULT empresa_actual(),
    cod_doc                    VARCHAR(2)  NOT NULL CHECK (cod_doc IN ('01','04')),
    version_xml                VARCHAR(10) NOT NULL DEFAULT '1.1.0',
    ambiente                   SMALLINT    NOT NULL CHECK (ambiente IN (1,2)),
    estado                     VARCHAR(25) NOT NULL DEFAULT 'borrador' CHECK (estado IN (
                                   'borrador','firmado','recibida','devuelta','en_procesamiento','autorizado',
                                   'no_autorizado','pendiente_reintento','anulacion_solicitada','anulado','descartado')),
    punto_emision_id           INTEGER NOT NULL,
    establecimiento            CHAR(3) NOT NULL,
    punto_emision              CHAR(3) NOT NULL,
    secuencial                 CHAR(9) CHECK (secuencial ~ '^[0-9]{9}$'),
    clave_acceso               CHAR(49) UNIQUE CHECK (clave_acceso ~ '^[0-9]{49}$'),
    fecha_emision              DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Instantanea del comprador (integridad historica: no cambia si cambia el cliente).
    cliente_id                 INTEGER,
    comprador_tipo_identificacion VARCHAR(2) NOT NULL CHECK (comprador_tipo_identificacion IN ('04','05','06','07','08')),
    comprador_identificacion   VARCHAR(20)  NOT NULL,
    comprador_razon_social     VARCHAR(300) NOT NULL,
    comprador_direccion        VARCHAR(300),
    comprador_email            VARCHAR(300),
    comprador_telefono         VARCHAR(50),
    emisor                     JSONB,
    vehiculo                   JSONB,
    -- Origen y relaciones con el resto del sistema.
    proforma_id                INTEGER,
    orden_id                   INTEGER,
    cuenta_cobrar_id           INTEGER,
    comprobante_modificado_id  INTEGER,
    motivo_nc                  VARCHAR(300),
    -- Valores.
    total_sin_impuestos        NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_descuento            NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_iva                  NUMERIC(14,2) NOT NULL DEFAULT 0,
    propina                    NUMERIC(14,2) NOT NULL DEFAULT 0,
    importe_total              NUMERIC(14,2) NOT NULL DEFAULT 0,
    totales_impuestos          JSONB NOT NULL DEFAULT '[]'::jsonb,
    pagos                      JSONB NOT NULL DEFAULT '[]'::jsonb,
    info_adicional             JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- SRI.
    xml_firmado                TEXT,
    xml_autorizado             TEXT,
    numero_autorizacion        VARCHAR(49),
    fecha_autorizacion         TIMESTAMP WITH TIME ZONE,
    ultimo_mensaje             JSONB,
    intentos_envio             INTEGER NOT NULL DEFAULT 0,
    proximo_intento            TIMESTAMP WITH TIME ZONE,
    procesando_hasta           TIMESTAMP WITH TIME ZONE,
    -- Entrega (independiente del estado tributario).
    correo_estado              VARCHAR(12) NOT NULL DEFAULT 'pendiente' CHECK (correo_estado IN ('pendiente','enviado','error','sin_correo')),
    correo_enviado_at          TIMESTAMP WITH TIME ZONE,
    correo_destinatarios       VARCHAR(500),
    correo_error               VARCHAR(300),
    -- Anulacion (se tramita en SRI en Linea; aqui se registra y se verifica).
    anulacion_solicitada_at    TIMESTAMP WITH TIME ZONE,
    anulacion_solicitada_por   INTEGER,
    anulacion_motivo           VARCHAR(300),
    anulado_at                 TIMESTAMP WITH TIME ZONE,
    idempotency_key            VARCHAR(64),
    creado_por                 INTEGER NOT NULL,
    emitido_por                INTEGER,
    emitido_at                 TIMESTAMP WITH TIME ZONE,
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (importe_total >= 0 AND total_sin_impuestos >= 0 AND total_iva >= 0 AND total_descuento >= 0),
    CHECK (cod_doc <> '04' OR (comprobante_modificado_id IS NOT NULL AND motivo_nc IS NOT NULL)),
    -- Ficha 9.10: consumidor final solo hasta USD 50 (y nunca en notas de credito).
    CHECK (comprador_tipo_identificacion <> '07' OR (cod_doc = '01' AND importe_total <= 50)),
    CHECK (estado IN ('borrador','descartado') OR (secuencial IS NOT NULL AND clave_acceso IS NOT NULL))
);
COMMENT ON TABLE comprobantes_electronicos IS 'Facturas (01) y notas de credito (04) electronicas. El estado tributario sale SOLO de las respuestas del SRI. Un comprobante autorizado no se edita ni se borra.';
COMMENT ON COLUMN comprobantes_electronicos.ambiente IS '1 = pruebas (sin validez tributaria), 2 = produccion.';
COMMENT ON COLUMN comprobantes_electronicos.correo_estado IS 'Entrega al cliente. Un error de correo NO cambia el estado tributario.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_comprobante_numero ON comprobantes_electronicos (empresa_id, ambiente, cod_doc, establecimiento, punto_emision, secuencial) WHERE secuencial IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_comprobante_idempotencia ON comprobantes_electronicos (empresa_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
-- Una proforma se factura una sola vez por ambiente (salvo borradores descartados o facturas anuladas).
CREATE UNIQUE INDEX IF NOT EXISTS uq_factura_por_proforma ON comprobantes_electronicos (empresa_id, ambiente, proforma_id)
    WHERE cod_doc = '01' AND proforma_id IS NOT NULL AND estado NOT IN ('descartado','anulado');
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON comprobantes_electronicos (empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_comprobantes_fecha ON comprobantes_electronicos (empresa_id, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_comprobantes_comprador ON comprobantes_electronicos (empresa_id, comprador_identificacion);
CREATE INDEX IF NOT EXISTS idx_comprobantes_pendientes ON comprobantes_electronicos (proximo_intento)
    WHERE estado IN ('firmado','recibida','en_procesamiento','pendiente_reintento');
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_comprobantes_electronicos') THEN
        CREATE TRIGGER set_updated_at_comprobantes_electronicos BEFORE UPDATE ON comprobantes_electronicos FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS comprobante_detalles (
    id                         SERIAL PRIMARY KEY,
    empresa_id                 INTEGER NOT NULL DEFAULT empresa_actual(),
    comprobante_id             INTEGER NOT NULL,
    linea                      INTEGER NOT NULL,
    codigo_principal           VARCHAR(25),
    descripcion                VARCHAR(300) NOT NULL,
    cantidad                   NUMERIC(18,6) NOT NULL CHECK (cantidad > 0),
    precio_unitario            NUMERIC(18,6) NOT NULL CHECK (precio_unitario >= 0),
    descuento                  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    precio_total_sin_impuesto  NUMERIC(14,2) NOT NULL CHECK (precio_total_sin_impuesto >= 0),
    iva_codigo                 VARCHAR(4)  NOT NULL,
    iva_tarifa                 NUMERIC(5,2) NOT NULL,
    iva_base                   NUMERIC(14,2) NOT NULL,
    iva_valor                  NUMERIC(14,2) NOT NULL,
    proforma_item_id           INTEGER,
    detalles_adicionales       JSONB,
    UNIQUE (comprobante_id, linea)
);
CREATE INDEX IF NOT EXISTS idx_comprobante_detalles_comprobante ON comprobante_detalles (comprobante_id);
COMMENT ON TABLE comprobante_detalles IS 'Lineas del comprobante tal como se enviaron al SRI (instantanea; no cambian si cambia el inventario o la proforma).';

CREATE TABLE IF NOT EXISTS comprobante_eventos (
    id                 BIGSERIAL PRIMARY KEY,
    empresa_id         INTEGER NOT NULL DEFAULT empresa_actual(),
    comprobante_id     INTEGER NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    usuario_id         INTEGER,
    tipo               VARCHAR(40) NOT NULL,
    estado_anterior    VARCHAR(25),
    estado_nuevo       VARCHAR(25),
    detalle            JSONB,
    respuesta_sri      TEXT
);
CREATE INDEX IF NOT EXISTS idx_comprobante_eventos ON comprobante_eventos (comprobante_id, created_at);
COMMENT ON TABLE comprobante_eventos IS 'Bitacora inmutable de cada comprobante: emision, envios, respuestas del SRI, correos, anulaciones. Nunca guarda certificados ni claves.';

-- ── 23.5 Documentos legales, contratos y aceptaciones ──
CREATE TABLE IF NOT EXISTS documentos_legales (
    id            SERIAL PRIMARY KEY,
    empresa_id    INTEGER,
    tipo          VARCHAR(40) NOT NULL CHECK (tipo IN ('terminos','privacidad','condiciones_comerciales',
                      'cancelacion','condiciones_empresariales','autorizacion_datos')),
    titulo        VARCHAR(200) NOT NULL,
    audiencia     VARCHAR(20)  NOT NULL CHECK (audiencia IN ('empresas','clientes_portal')),
    obligatorio   BOOLEAN NOT NULL DEFAULT TRUE,
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Plataforma (empresa NULL) -> lo aceptan las empresas; empresa -> sus clientes.
    CHECK ((empresa_id IS NULL AND audiencia = 'empresas') OR (empresa_id IS NOT NULL AND audiencia = 'clientes_portal'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_legal ON documentos_legales (COALESCE(empresa_id, 0), tipo);
COMMENT ON TABLE documentos_legales IS 'Documentos legales: empresa_id NULL = de la plataforma (los acepta cada empresa); con empresa = de esa empresa para los clientes de su portal.';
COMMENT ON COLUMN documentos_legales.activo IS 'FALSE = ya no se ofrece para nuevas aceptaciones; el historial y las aceptaciones se conservan.';

CREATE TABLE IF NOT EXISTS documento_legal_versiones (
    id                   SERIAL PRIMARY KEY,
    documento_id         INTEGER NOT NULL REFERENCES documentos_legales(id),
    empresa_id           INTEGER,
    version              INTEGER NOT NULL,
    contenido            TEXT NOT NULL CHECK (length(contenido) BETWEEN 50 AND 200000),
    hash_contenido       CHAR(64) NOT NULL,
    estado               VARCHAR(12) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','publicada','retirada')),
    cambio_material      BOOLEAN NOT NULL DEFAULT FALSE,
    resumen_cambios      VARCHAR(1000),
    revision_profesional VARCHAR(12) NOT NULL DEFAULT 'pendiente' CHECK (revision_profesional IN ('pendiente','revisado')),
    vigente_desde        DATE,
    publicada_at         TIMESTAMP WITH TIME ZONE,
    publicada_por        INTEGER,
    retirada_at          TIMESTAMP WITH TIME ZONE,
    creado_por           INTEGER,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (documento_id, version),
    CHECK (estado = 'borrador' OR (publicada_at IS NOT NULL AND vigente_desde IS NOT NULL))
);
COMMENT ON TABLE documento_legal_versiones IS 'Versiones de cada documento. Al publicarse, el texto y su hash SHA-256 quedan inmutables (trigger).';

CREATE TABLE IF NOT EXISTS contratos_empresa (
    id                   SERIAL PRIMARY KEY,
    empresa_id           INTEGER NOT NULL DEFAULT empresa_actual(),
    plan                 VARCHAR(120) NOT NULL,
    alcance              TEXT NOT NULL,
    precio               NUMERIC(12,2),
    moneda               VARCHAR(3) NOT NULL DEFAULT 'USD',
    periodicidad         VARCHAR(20) CHECK (periodicidad IS NULL OR periodicidad IN ('mensual','trimestral','semestral','anual','unico')),
    condiciones_soporte  TEXT,
    fecha_inicio         DATE,
    fecha_fin            DATE,
    estado               VARCHAR(25) NOT NULL DEFAULT 'pendiente_aceptacion' CHECK (estado IN ('pendiente_aceptacion','vigente','terminado')),
    creado_por           INTEGER,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    aceptado_por         INTEGER,
    aceptado_at          TIMESTAMP WITH TIME ZONE,
    transaccion_aceptacion UUID,
    terminado_at         TIMESTAMP WITH TIME ZONE,
    motivo_terminacion   VARCHAR(300),
    CHECK (estado = 'pendiente_aceptacion' OR aceptado_at IS NOT NULL)
);
COMMENT ON TABLE contratos_empresa IS 'Contratacion del servicio por cada empresa: plan, alcance y precio. Lo crea la plataforma y lo acepta el administrador de la empresa.';

CREATE TABLE IF NOT EXISTS aceptaciones_legales (
    id               BIGSERIAL PRIMARY KEY,
    empresa_id       INTEGER NOT NULL DEFAULT empresa_actual(),
    version_id       INTEGER NOT NULL REFERENCES documento_legal_versiones(id),
    documento_id     INTEGER NOT NULL REFERENCES documentos_legales(id),
    evento           VARCHAR(12) NOT NULL DEFAULT 'aceptacion' CHECK (evento IN ('aceptacion','revocacion')),
    usuario_id       INTEGER,
    cliente_id       INTEGER,
    contrato_id      INTEGER,
    contexto         VARCHAR(30) NOT NULL CHECK (contexto IN ('registro_cliente','contratacion_empresa','reaceptacion','revocacion')),
    metodo           VARCHAR(30) NOT NULL DEFAULT 'casilla_web',
    transaccion_id   UUID NOT NULL,
    hash_contenido   CHAR(64) NOT NULL,
    nombre_aceptante VARCHAR(200),
    identificacion_aceptante VARCHAR(20),
    ip               VARCHAR(64),
    user_agent       VARCHAR(250),
    aceptado_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CHECK (usuario_id IS NOT NULL OR cliente_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_aceptaciones_version ON aceptaciones_legales (version_id);
CREATE INDEX IF NOT EXISTS idx_aceptaciones_usuario ON aceptaciones_legales (usuario_id);
CREATE INDEX IF NOT EXISTS idx_aceptaciones_transaccion ON aceptaciones_legales (transaccion_id);
COMMENT ON TABLE aceptaciones_legales IS 'Evidencia de aceptacion: version exacta, hash del texto, fecha del servidor y transaccion. Solo insercion (una revocacion es una fila nueva).';
COMMENT ON COLUMN aceptaciones_legales.ip IS 'IP de la peticion, como evidencia tecnica del evento. Solo visible con el permiso legal:ver.';

CREATE TABLE IF NOT EXISTS notificaciones_legales (
    id            BIGSERIAL PRIMARY KEY,
    empresa_id    INTEGER NOT NULL DEFAULT empresa_actual(),
    version_id    INTEGER NOT NULL REFERENCES documento_legal_versiones(id),
    usuario_id    INTEGER,
    cliente_id    INTEGER,
    medio         VARCHAR(12) NOT NULL CHECK (medio IN ('panel','correo')),
    resultado     VARCHAR(12) NOT NULL DEFAULT 'enviado' CHECK (resultado IN ('enviado','error','visto')),
    detalle       VARCHAR(300),
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_legales ON notificaciones_legales (version_id);
COMMENT ON TABLE notificaciones_legales IS 'Cuando y por que medio se notifico una nueva version de un documento legal.';

-- ── 23.6 Proveedor de la plataforma ──
CREATE TABLE IF NOT EXISTS plataforma_proveedor (
    id                 INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    razon_social       VARCHAR(300),
    ruc                VARCHAR(13),
    direccion          VARCHAR(300),
    email_contacto     VARCHAR(150),
    telefono           VARCHAR(30),
    canal_reclamos     VARCHAR(300),
    actualizado_por    INTEGER,
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE plataforma_proveedor IS 'Identidad del proveedor del servicio (para el flujo de contratacion). Solo el superadministrador la edita.';

-- ── Triggers de integridad ──
-- Solo insercion (aceptaciones y eventos son evidencia).
CREATE OR REPLACE FUNCTION solo_insercion() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de % no se pueden modificar ni borrar (son evidencia).', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_solo_insercion ON aceptaciones_legales;
CREATE TRIGGER trg_solo_insercion BEFORE UPDATE OR DELETE ON aceptaciones_legales FOR EACH ROW EXECUTE FUNCTION solo_insercion();
DROP TRIGGER IF EXISTS trg_solo_insercion ON comprobante_eventos;
CREATE TRIGGER trg_solo_insercion BEFORE UPDATE OR DELETE ON comprobante_eventos FOR EACH ROW EXECUTE FUNCTION solo_insercion();
DROP TRIGGER IF EXISTS trg_solo_insercion ON notificaciones_legales;
CREATE TRIGGER trg_solo_insercion BEFORE UPDATE OR DELETE ON notificaciones_legales FOR EACH ROW EXECUTE FUNCTION solo_insercion();

-- Comprobante autorizado/anulado: inmutable salvo correo y anulacion.
CREATE OR REPLACE FUNCTION proteger_comprobante_electronico() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.estado <> 'borrador' THEN
            RAISE EXCEPTION 'Un comprobante electronico emitido no se puede borrar (estado %).', OLD.estado USING ERRCODE = '42501';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.clave_acceso IS NOT NULL AND NEW.clave_acceso IS DISTINCT FROM OLD.clave_acceso THEN
        RAISE EXCEPTION 'La clave de acceso de un comprobante no se puede cambiar.' USING ERRCODE = '42501';
    END IF;
    IF OLD.secuencial IS NOT NULL AND (NEW.secuencial, NEW.establecimiento, NEW.punto_emision, NEW.ambiente, NEW.cod_doc)
            IS DISTINCT FROM (OLD.secuencial, OLD.establecimiento, OLD.punto_emision, OLD.ambiente, OLD.cod_doc) THEN
        RAISE EXCEPTION 'El numero de un comprobante emitido no se puede cambiar.' USING ERRCODE = '42501';
    END IF;
    IF OLD.estado IN ('autorizado','anulacion_solicitada','anulado') THEN
        IF NEW.estado NOT IN ('autorizado','anulacion_solicitada','anulado') THEN
            RAISE EXCEPTION 'Un comprobante autorizado no puede volver al estado %.', NEW.estado USING ERRCODE = '42501';
        END IF;
        IF OLD.estado = 'anulado' AND NEW.estado <> 'anulado' THEN
            RAISE EXCEPTION 'Un comprobante anulado no cambia de estado.' USING ERRCODE = '42501';
        END IF;
        IF (NEW.fecha_emision, NEW.xml_firmado, NEW.xml_autorizado, NEW.numero_autorizacion, NEW.fecha_autorizacion,
            NEW.total_sin_impuestos, NEW.total_descuento, NEW.total_iva, NEW.propina, NEW.importe_total,
            NEW.comprador_tipo_identificacion, NEW.comprador_identificacion, NEW.comprador_razon_social, NEW.comprador_direccion,
            NEW.emisor, NEW.totales_impuestos, NEW.pagos, NEW.info_adicional, NEW.cliente_id, NEW.proforma_id, NEW.orden_id)
           IS DISTINCT FROM
           (OLD.fecha_emision, OLD.xml_firmado, OLD.xml_autorizado, OLD.numero_autorizacion, OLD.fecha_autorizacion,
            OLD.total_sin_impuestos, OLD.total_descuento, OLD.total_iva, OLD.propina, OLD.importe_total,
            OLD.comprador_tipo_identificacion, OLD.comprador_identificacion, OLD.comprador_razon_social, OLD.comprador_direccion,
            OLD.emisor, OLD.totales_impuestos, OLD.pagos, OLD.info_adicional, OLD.cliente_id, OLD.proforma_id, OLD.orden_id) THEN
            RAISE EXCEPTION 'Un comprobante autorizado no se puede modificar. Para corregirlo use una nota de credito.' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_proteger_comprobante ON comprobantes_electronicos;
CREATE TRIGGER trg_proteger_comprobante BEFORE UPDATE OR DELETE ON comprobantes_electronicos
    FOR EACH ROW EXECUTE FUNCTION proteger_comprobante_electronico();

-- Lineas: solo editables mientras el comprobante es borrador o fue devuelto/no autorizado (se corrige con la misma clave).
CREATE OR REPLACE FUNCTION proteger_detalle_comprobante() RETURNS TRIGGER AS $$
DECLARE v_estado TEXT;
BEGIN
    SELECT estado INTO v_estado FROM comprobantes_electronicos WHERE id = COALESCE(NEW.comprobante_id, OLD.comprobante_id);
    IF v_estado IS NOT NULL AND v_estado NOT IN ('borrador','devuelta','no_autorizado') THEN
        RAISE EXCEPTION 'Las lineas de un comprobante en estado % no se pueden modificar.', v_estado USING ERRCODE = '42501';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_proteger_detalle ON comprobante_detalles;
CREATE TRIGGER trg_proteger_detalle BEFORE INSERT OR UPDATE OR DELETE ON comprobante_detalles
    FOR EACH ROW EXECUTE FUNCTION proteger_detalle_comprobante();

-- Versiones legales: el hash lo calcula la BD; publicada = inmutable (solo puede retirarse).
CREATE OR REPLACE FUNCTION proteger_version_legal() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.estado <> 'borrador' THEN
            RAISE EXCEPTION 'Una version publicada no se puede borrar (se conserva como evidencia).' USING ERRCODE = '42501';
        END IF;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.estado <> 'borrador' THEN
        IF (NEW.contenido, NEW.version, NEW.documento_id, NEW.empresa_id, NEW.cambio_material, NEW.resumen_cambios, NEW.publicada_at, NEW.publicada_por, NEW.vigente_desde)
           IS DISTINCT FROM (OLD.contenido, OLD.version, OLD.documento_id, OLD.empresa_id, OLD.cambio_material, OLD.resumen_cambios, OLD.publicada_at, OLD.publicada_por, OLD.vigente_desde)
           OR NOT (NEW.estado = OLD.estado OR (OLD.estado = 'publicada' AND NEW.estado = 'retirada')) THEN
            RAISE EXCEPTION 'Una version publicada no se puede modificar; cree una version nueva.' USING ERRCODE = '42501';
        END IF;
    END IF;
    NEW.hash_contenido := encode(sha256(convert_to(NEW.contenido, 'UTF8')), 'hex');
    -- La empresa de la version es siempre la de su documento.
    NEW.empresa_id := (SELECT empresa_id FROM documentos_legales WHERE id = NEW.documento_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_proteger_version_legal ON documento_legal_versiones;
CREATE TRIGGER trg_proteger_version_legal BEFORE INSERT OR UPDATE OR DELETE ON documento_legal_versiones
    FOR EACH ROW EXECUTE FUNCTION proteger_version_legal();

-- Aceptacion: solo de versiones publicadas; el hash lo copia la BD desde la version (no el navegador).
CREATE OR REPLACE FUNCTION completar_aceptacion_legal() RETURNS TRIGGER AS $$
DECLARE v RECORD;
BEGIN
    SELECT estado, hash_contenido, documento_id INTO v FROM documento_legal_versiones WHERE id = NEW.version_id;
    IF v IS NULL OR (v.estado <> 'publicada' AND NEW.evento = 'aceptacion') THEN
        RAISE EXCEPTION 'Solo se puede aceptar una version publicada y vigente.' USING ERRCODE = '23514';
    END IF;
    NEW.hash_contenido := v.hash_contenido;
    NEW.documento_id := v.documento_id;
    NEW.aceptado_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_completar_aceptacion ON aceptaciones_legales;
CREATE TRIGGER trg_completar_aceptacion BEFORE INSERT ON aceptaciones_legales
    FOR EACH ROW EXECUTE FUNCTION completar_aceptacion_legal();

-- Contrato aceptado: sus condiciones ya no cambian (solo puede terminarse).
CREATE OR REPLACE FUNCTION proteger_contrato_empresa() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.estado <> 'pendiente_aceptacion' THEN
            RAISE EXCEPTION 'Un contrato aceptado no se puede borrar.' USING ERRCODE = '42501';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.estado <> 'pendiente_aceptacion' AND
       (NEW.plan, NEW.alcance, NEW.precio, NEW.moneda, NEW.periodicidad, NEW.condiciones_soporte, NEW.fecha_inicio,
        NEW.aceptado_por, NEW.aceptado_at, NEW.transaccion_aceptacion)
       IS DISTINCT FROM
       (OLD.plan, OLD.alcance, OLD.precio, OLD.moneda, OLD.periodicidad, OLD.condiciones_soporte, OLD.fecha_inicio,
        OLD.aceptado_por, OLD.aceptado_at, OLD.transaccion_aceptacion) THEN
        RAISE EXCEPTION 'Las condiciones de un contrato aceptado no se pueden cambiar; cree un contrato nuevo.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_proteger_contrato ON contratos_empresa;
CREATE TRIGGER trg_proteger_contrato BEFORE UPDATE OR DELETE ON contratos_empresa
    FOR EACH ROW EXECUTE FUNCTION proteger_contrato_empresa();

-- ── 23.7 Aislamiento por empresa ──
DO $$
DECLARE
    t TEXT;
    tablas TEXT[] := ARRAY['sri_configuracion', 'sri_puntos_emision', 'comprobantes_electronicos', 'comprobante_detalles', 'comprobante_eventos', 'contratos_empresa', 'aceptaciones_legales', 'notificaciones_legales'];
BEGIN
    FOREACH t IN ARRAY tablas LOOP
        PERFORM agregar_constraint_si_falta(t, 'fk_' || t || '_empresa', 'FOREIGN KEY (empresa_id) REFERENCES empresas(id)');
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (empresa_id)', 'idx_' || t || '_empresa', t);
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS aislamiento_empresa ON %I', t);
        EXECUTE format('CREATE POLICY aislamiento_empresa ON %I USING (empresa_id = empresa_actual()) WITH CHECK (empresa_id = empresa_actual())', t);
    END LOOP;

    -- Documentos legales: leer los de la plataforma (empresa NULL) y los propios; escribir solo los propios.
    FOREACH t IN ARRAY ARRAY['documentos_legales', 'documento_legal_versiones'] LOOP
        PERFORM agregar_constraint_si_falta(t, 'fk_' || t || '_empresa', 'FOREIGN KEY (empresa_id) REFERENCES empresas(id)');
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS legal_lectura ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS legal_insercion ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS legal_edicion ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS legal_borrado ON %I', t);
        EXECUTE format('CREATE POLICY legal_lectura ON %I FOR SELECT USING (empresa_id IS NULL OR empresa_id = empresa_actual())', t);
        EXECUTE format('CREATE POLICY legal_insercion ON %I FOR INSERT WITH CHECK (empresa_id = empresa_actual())', t);
        EXECUTE format('CREATE POLICY legal_edicion ON %I FOR UPDATE USING (empresa_id = empresa_actual()) WITH CHECK (empresa_id = empresa_actual())', t);
        EXECUTE format('CREATE POLICY legal_borrado ON %I FOR DELETE USING (empresa_id = empresa_actual())', t);
    END LOOP;
    ALTER TABLE documentos_legales ALTER COLUMN empresa_id SET DEFAULT empresa_actual();
    ALTER TABLE plataforma_proveedor ENABLE ROW LEVEL SECURITY;
END $$;

-- Llaves compuestas (generadas desde multiempresa.js: RELACIONES_SPRINT23).
-- RELACIONES23_INICIO
DO $$
BEGIN
    PERFORM agregar_constraint_si_falta('clientes', 'uq_clientes_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('comprobantes_electronicos', 'uq_comprobantes_electronicos_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('contratos_empresa', 'uq_contratos_empresa_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('cuentas_cobrar', 'uq_cuentas_cobrar_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('ordenes_trabajo', 'uq_ordenes_trabajo_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proforma_items', 'uq_proforma_items_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proformas', 'uq_proformas_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('sri_puntos_emision', 'uq_sri_puntos_emision_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('sucursales', 'uq_sucursales_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('usuarios', 'uq_usuarios_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('sri_puntos_emision', 'fk_emp_sri_puntos_emision_sucursal_id', 'FOREIGN KEY (sucursal_id, empresa_id) REFERENCES sucursales(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('comprobantes_electronicos', 'fk_emp_comprobantes_electronicos_punto_emision_id', 'FOREIGN KEY (punto_emision_id, empresa_id) REFERENCES sri_puntos_emision(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('comprobantes_electronicos', 'fk_emp_comprobantes_electronicos_cliente_id', 'FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('comprobantes_electronicos', 'fk_emp_comprobantes_electronicos_proforma_id', 'FOREIGN KEY (proforma_id, empresa_id) REFERENCES proformas(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('comprobantes_electronicos', 'fk_emp_comprobantes_electronicos_orden_id', 'FOREIGN KEY (orden_id, empresa_id) REFERENCES ordenes_trabajo(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('comprobantes_electronicos', 'fk_emp_comprobantes_electronicos_cuenta_cobrar_id', 'FOREIGN KEY (cuenta_cobrar_id, empresa_id) REFERENCES cuentas_cobrar(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('comprobantes_electronicos', 'fk_emp_comprobantes_electronicos_comprobante_modificado_id', 'FOREIGN KEY (comprobante_modificado_id, empresa_id) REFERENCES comprobantes_electronicos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('comprobante_detalles', 'fk_emp_comprobante_detalles_comprobante_id', 'FOREIGN KEY (comprobante_id, empresa_id) REFERENCES comprobantes_electronicos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('comprobante_detalles', 'fk_emp_comprobante_detalles_proforma_item_id', 'FOREIGN KEY (proforma_item_id, empresa_id) REFERENCES proforma_items(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('comprobante_eventos', 'fk_emp_comprobante_eventos_comprobante_id', 'FOREIGN KEY (comprobante_id, empresa_id) REFERENCES comprobantes_electronicos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('aceptaciones_legales', 'fk_emp_aceptaciones_legales_contrato_id', 'FOREIGN KEY (contrato_id, empresa_id) REFERENCES contratos_empresa(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('aceptaciones_legales', 'fk_emp_aceptaciones_legales_cliente_id', 'FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('aceptaciones_legales', 'fk_emp_aceptaciones_legales_usuario_id', 'FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('notificaciones_legales', 'fk_emp_notificaciones_legales_usuario_id', 'FOREIGN KEY (usuario_id, empresa_id) REFERENCES usuarios(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('notificaciones_legales', 'fk_emp_notificaciones_legales_cliente_id', 'FOREIGN KEY (cliente_id, empresa_id) REFERENCES clientes(id, empresa_id)');
END $$;
-- RELACIONES23_FIN

-- Permisos del rol de la aplicacion sobre las tablas nuevas. (El bloque del
-- Sprint 22 concede ALL TABLES en cada corrida: por eso aqui se QUITA
-- explicitamente lo que la app no debe poder hacer.)
GRANT SELECT, INSERT, UPDATE, DELETE ON sri_puntos_emision, comprobantes_electronicos,
    comprobante_detalles, documentos_legales, documento_legal_versiones TO ssswap_app;
GRANT SELECT, INSERT, UPDATE ON sri_configuracion TO ssswap_app;
REVOKE DELETE ON sri_configuracion FROM ssswap_app;
-- Evidencia: solo insercion.
GRANT SELECT, INSERT ON comprobante_eventos, aceptaciones_legales, notificaciones_legales TO ssswap_app;
REVOKE UPDATE, DELETE, TRUNCATE ON comprobante_eventos, aceptaciones_legales, notificaciones_legales FROM ssswap_app;
-- Contratos: los crea la plataforma; la empresa solo los lee y registra su aceptacion.
GRANT SELECT ON contratos_empresa TO ssswap_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON contratos_empresa FROM ssswap_app;
GRANT UPDATE (estado, aceptado_por, aceptado_at, transaccion_aceptacion) ON contratos_empresa TO ssswap_app;
-- Proveedor de la plataforma: solo el sistema (superadministrador).
REVOKE ALL ON plataforma_proveedor FROM ssswap_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ssswap_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ssswap_app;

-- Catalogo de permisos (incluye facturacion, facturacion_config y legal).
-- CATALOGO_INICIO (generado desde permisos.js)
INSERT INTO permisos_catalogo (modulo, accion, modulo_nombre, accion_nombre, grupo, orden, solo_superadmin) VALUES
    ('dashboard', 'ver', 'Panel principal', 'Ver', 'Panel', 1, FALSE),
    ('inventario_mecanica', 'ver', 'Inventario de mecánica', 'Ver', 'Inventario', 2, FALSE),
    ('inventario_mecanica', 'crear', 'Inventario de mecánica', 'Crear', 'Inventario', 3, FALSE),
    ('inventario_mecanica', 'editar', 'Inventario de mecánica', 'Editar', 'Inventario', 4, FALSE),
    ('inventario_mecanica', 'eliminar', 'Inventario de mecánica', 'Eliminar', 'Inventario', 5, FALSE),
    ('inventario_colisiones', 'ver', 'Inventario de colisiones / pintura', 'Ver', 'Inventario', 6, FALSE),
    ('inventario_colisiones', 'crear', 'Inventario de colisiones / pintura', 'Crear', 'Inventario', 7, FALSE),
    ('inventario_colisiones', 'editar', 'Inventario de colisiones / pintura', 'Editar', 'Inventario', 8, FALSE),
    ('inventario_colisiones', 'eliminar', 'Inventario de colisiones / pintura', 'Eliminar', 'Inventario', 9, FALSE),
    ('registros_inventario', 'ver', 'Entradas y salidas de inventario', 'Ver registros', 'Inventario', 10, FALSE),
    ('registros_inventario', 'crear', 'Entradas y salidas de inventario', 'Registrar entradas / salidas', 'Inventario', 11, FALSE),
    ('registros_inventario', 'aprobar', 'Entradas y salidas de inventario', 'Devolver salidas al inventario', 'Inventario', 12, FALSE),
    ('pedidos_tienda', 'ver', 'Pedidos de la tienda', 'Ver', 'Inventario', 13, FALSE),
    ('pedidos_tienda', 'editar', 'Pedidos de la tienda', 'Atender / cancelar', 'Inventario', 14, FALSE),
    ('ordenes', 'ver', 'Órdenes de trabajo', 'Ver', 'Taller', 15, FALSE),
    ('ordenes', 'crear', 'Órdenes de trabajo', 'Crear', 'Taller', 16, FALSE),
    ('ordenes', 'editar', 'Órdenes de trabajo', 'Editar', 'Taller', 17, FALSE),
    ('ordenes', 'eliminar', 'Órdenes de trabajo', 'Eliminar', 'Taller', 18, FALSE),
    ('ordenes', 'asignar', 'Órdenes de trabajo', 'Asignar técnico', 'Taller', 19, FALSE),
    ('ordenes', 'aprobar', 'Órdenes de trabajo', 'Cambiar estado de cualquier orden', 'Taller', 20, FALSE),
    ('proformas_mecanica', 'ver', 'Proformas de mecánica', 'Ver', 'Taller', 21, FALSE),
    ('proformas_mecanica', 'crear', 'Proformas de mecánica', 'Crear', 'Taller', 22, FALSE),
    ('proformas_mecanica', 'editar', 'Proformas de mecánica', 'Editar', 'Taller', 23, FALSE),
    ('proformas_mecanica', 'eliminar', 'Proformas de mecánica', 'Eliminar', 'Taller', 24, FALSE),
    ('proformas_mecanica', 'exportar', 'Proformas de mecánica', 'Descargar PDF / Excel', 'Taller', 25, FALSE),
    ('proformas_mecanica', 'aprobar', 'Proformas de mecánica', 'Aprobar, rechazar, convertir en OT y confirmar materiales', 'Taller', 26, FALSE),
    ('proformas_colisiones', 'ver', 'Proformas de colisiones / pintura', 'Ver', 'Taller', 27, FALSE),
    ('proformas_colisiones', 'crear', 'Proformas de colisiones / pintura', 'Crear', 'Taller', 28, FALSE),
    ('proformas_colisiones', 'editar', 'Proformas de colisiones / pintura', 'Editar', 'Taller', 29, FALSE),
    ('proformas_colisiones', 'eliminar', 'Proformas de colisiones / pintura', 'Eliminar', 'Taller', 30, FALSE),
    ('proformas_colisiones', 'exportar', 'Proformas de colisiones / pintura', 'Descargar PDF / Excel', 'Taller', 31, FALSE),
    ('proformas_colisiones', 'aprobar', 'Proformas de colisiones / pintura', 'Aprobar, rechazar, convertir en OT y confirmar materiales', 'Taller', 32, FALSE),
    ('citas', 'ver', 'Citas', 'Ver', 'Taller', 33, FALSE),
    ('citas', 'editar', 'Citas', 'Confirmar / cambiar estado', 'Taller', 34, FALSE),
    ('clientes', 'ver', 'Clientes', 'Ver', 'Clientes', 35, FALSE),
    ('clientes', 'crear', 'Clientes', 'Crear', 'Clientes', 36, FALSE),
    ('clientes', 'editar', 'Clientes', 'Editar', 'Clientes', 37, FALSE),
    ('clientes', 'eliminar', 'Clientes', 'Eliminar', 'Clientes', 38, FALSE),
    ('vehiculos', 'ver', 'Vehículos', 'Ver', 'Clientes', 39, FALSE),
    ('vehiculos', 'crear', 'Vehículos', 'Crear', 'Clientes', 40, FALSE),
    ('vehiculos', 'editar', 'Vehículos', 'Editar', 'Clientes', 41, FALSE),
    ('vehiculos', 'eliminar', 'Vehículos', 'Eliminar', 'Clientes', 42, FALSE),
    ('cuentas_cobrar', 'ver', 'Pagarés y cuentas por cobrar', 'Ver', 'Clientes', 43, FALSE),
    ('cuentas_cobrar', 'crear', 'Pagarés y cuentas por cobrar', 'Crear', 'Clientes', 44, FALSE),
    ('cuentas_cobrar', 'editar', 'Pagarés y cuentas por cobrar', 'Editar (vencimiento, datos)', 'Clientes', 45, FALSE),
    ('cuentas_cobrar', 'eliminar', 'Pagarés y cuentas por cobrar', 'Eliminar / anular / reabrir', 'Clientes', 46, FALSE),
    ('pagos_clientes', 'crear', 'Registro de pagos de clientes', 'Registrar pagos', 'Clientes', 47, FALSE),
    ('pagos_clientes', 'eliminar', 'Registro de pagos de clientes', 'Anular pagos', 'Clientes', 48, FALSE),
    ('caja', 'ver', 'Caja diaria', 'Ver', 'Finanzas', 49, FALSE),
    ('caja', 'crear', 'Caja diaria', 'Registrar movimientos de caja', 'Finanzas', 50, FALSE),
    ('caja', 'aprobar', 'Caja diaria', 'Abrir y cerrar caja', 'Finanzas', 51, FALSE),
    ('caja', 'eliminar', 'Caja diaria', 'Anular movimientos manuales de caja', 'Finanzas', 52, FALSE),
    ('caja', 'reabrir', 'Caja diaria', 'Reabrir una caja cerrada', 'Finanzas', 53, FALSE),
    ('finanzas', 'ver', 'Finanzas, cuentas y nómina', 'Ver', 'Finanzas', 54, FALSE),
    ('finanzas', 'crear', 'Finanzas, cuentas y nómina', 'Crear', 'Finanzas', 55, FALSE),
    ('finanzas', 'editar', 'Finanzas, cuentas y nómina', 'Editar', 'Finanzas', 56, FALSE),
    ('finanzas', 'eliminar', 'Finanzas, cuentas y nómina', 'Anular movimientos / pagos', 'Finanzas', 57, FALSE),
    ('proveedores', 'ver', 'Proveedores, compras y gastos', 'Ver', 'Proveedores', 58, FALSE),
    ('proveedores', 'crear', 'Proveedores, compras y gastos', 'Crear', 'Proveedores', 59, FALSE),
    ('proveedores', 'editar', 'Proveedores, compras y gastos', 'Editar', 'Proveedores', 60, FALSE),
    ('proveedores', 'eliminar', 'Proveedores, compras y gastos', 'Eliminar', 'Proveedores', 61, FALSE),
    ('facturacion', 'ver', 'Facturación electrónica (SRI)', 'Ver comprobantes', 'Facturación', 62, FALSE),
    ('facturacion', 'crear', 'Facturación electrónica (SRI)', 'Preparar borradores', 'Facturación', 63, FALSE),
    ('facturacion', 'aprobar', 'Facturación electrónica (SRI)', 'Emitir y enviar al SRI', 'Facturación', 64, FALSE),
    ('facturacion', 'exportar', 'Facturación electrónica (SRI)', 'Descargar XML / RIDE y reenviar correo', 'Facturación', 65, FALSE),
    ('facturacion', 'anular', 'Facturación electrónica (SRI)', 'Notas de crédito y registro de anulaciones', 'Facturación', 66, FALSE),
    ('facturacion', 'eliminar', 'Facturación electrónica (SRI)', 'Descartar borradores', 'Facturación', 67, FALSE),
    ('facturacion_config', 'ver', 'Configuración tributaria y firma electrónica', 'Ver', 'Facturación', 68, FALSE),
    ('facturacion_config', 'editar', 'Configuración tributaria y firma electrónica', 'Editar datos tributarios, puntos de emisión y certificado', 'Facturación', 69, FALSE),
    ('facturacion_config', 'aprobar', 'Configuración tributaria y firma electrónica', 'Activar el ambiente de producción', 'Facturación', 70, FALSE),
    ('estadisticas', 'ver', 'Reportes y estadísticas', 'Ver', 'Reportes', 71, FALSE),
    ('servicios', 'ver', 'Servicios del taller', 'Ver', 'Ajustes', 72, FALSE),
    ('servicios', 'crear', 'Servicios del taller', 'Crear', 'Ajustes', 73, FALSE),
    ('servicios', 'editar', 'Servicios del taller', 'Editar', 'Ajustes', 74, FALSE),
    ('servicios', 'eliminar', 'Servicios del taller', 'Eliminar', 'Ajustes', 75, FALSE),
    ('sucursales', 'ver', 'Sucursales', 'Ver', 'Ajustes', 76, FALSE),
    ('sucursales', 'crear', 'Sucursales', 'Crear', 'Ajustes', 77, FALSE),
    ('sucursales', 'editar', 'Sucursales', 'Editar', 'Ajustes', 78, FALSE),
    ('sucursales', 'eliminar', 'Sucursales', 'Eliminar', 'Ajustes', 79, FALSE),
    ('bitacora', 'ver', 'Bitácora de operaciones', 'Ver', 'Ajustes', 80, FALSE),
    ('usuarios', 'ver', 'Usuarios y permisos de la empresa', 'Ver', 'Empresa', 81, FALSE),
    ('usuarios', 'crear', 'Usuarios y permisos de la empresa', 'Crear', 'Empresa', 82, FALSE),
    ('usuarios', 'editar', 'Usuarios y permisos de la empresa', 'Editar, activar/desactivar, permisos y restablecer acceso', 'Empresa', 83, FALSE),
    ('usuarios', 'eliminar', 'Usuarios y permisos de la empresa', 'Eliminar', 'Empresa', 84, FALSE),
    ('auditoria', 'ver', 'Auditoría de la empresa', 'Ver', 'Empresa', 85, FALSE),
    ('empresa', 'ver', 'Configuración de la empresa', 'Ver', 'Empresa', 86, FALSE),
    ('empresa', 'editar', 'Configuración de la empresa', 'Editar', 'Empresa', 87, FALSE),
    ('legal', 'ver', 'Documentos legales y aceptaciones', 'Ver documentos, aceptaciones y constancias', 'Empresa', 88, FALSE),
    ('legal', 'editar', 'Documentos legales y aceptaciones', 'Redactar borradores', 'Empresa', 89, FALSE),
    ('legal', 'aprobar', 'Documentos legales y aceptaciones', 'Publicar versiones', 'Empresa', 90, FALSE)
ON CONFLICT (modulo, accion) DO UPDATE SET
    modulo_nombre = EXCLUDED.modulo_nombre, accion_nombre = EXCLUDED.accion_nombre,
    grupo = EXCLUDED.grupo, orden = EXCLUDED.orden, solo_superadmin = EXCLUDED.solo_superadmin;
-- CATALOGO_FIN

-- ── 23.8 Permisos nuevos para los administradores existentes (una sola vez) ──
-- Las cuentas creadas despues reciben la plantilla de permisos.js.
INSERT INTO usuario_permisos (usuario_id, modulo, accion, empresa_id)
SELECT u.id, t.modulo, t.accion, u.empresa_id
FROM usuarios u
JOIN (VALUES
    ('facturacion', 'ver'), ('facturacion', 'crear'), ('facturacion', 'aprobar'), ('facturacion', 'exportar'),
    ('facturacion', 'anular'), ('facturacion', 'eliminar'),
    ('facturacion_config', 'ver'), ('facturacion_config', 'editar'), ('facturacion_config', 'aprobar'),
    ('legal', 'ver'), ('legal', 'editar'), ('legal', 'aprobar')
) AS t(modulo, accion) ON TRUE
WHERE u.rol = 'administrador' AND u.permisos_inicializados = TRUE AND u.empresa_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '23-facturacion-legal' AND resultado = 'exito')
ON CONFLICT DO NOTHING;

-- ── 23.9 Validaciones finales y registro ──
DO $$
DECLARE
    t TEXT;
    tablas TEXT[] := ARRAY['sri_configuracion', 'sri_puntos_emision', 'comprobantes_electronicos', 'comprobante_detalles', 'comprobante_eventos', 'contratos_empresa', 'aceptaciones_legales', 'notificaciones_legales'];
    n BIGINT;
BEGIN
    FOREACH t IN ARRAY tablas || ARRAY['documentos_legales', 'documento_legal_versiones'] LOOP
        IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = t::regclass) THEN
            RAISE EXCEPTION 'Validacion 23: % no tiene Row Level Security.', t;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t) THEN
            RAISE EXCEPTION 'Validacion 23: % no tiene politicas de aislamiento.', t;
        END IF;
    END LOOP;
    FOREACH t IN ARRAY tablas LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE empresa_id IS NULL', t) INTO n;
        IF n > 0 THEN RAISE EXCEPTION 'Validacion 23: % tiene % fila(s) sin empresa.', t, n; END IF;
    END LOOP;
    IF has_table_privilege('ssswap_app', 'aceptaciones_legales', 'UPDATE') OR has_table_privilege('ssswap_app', 'aceptaciones_legales', 'DELETE')
       OR has_table_privilege('ssswap_app', 'comprobante_eventos', 'UPDATE') OR has_table_privilege('ssswap_app', 'comprobante_eventos', 'DELETE')
       OR has_table_privilege('ssswap_app', 'plataforma_proveedor', 'SELECT') THEN
        RAISE EXCEPTION 'Validacion 23: la evidencia debe ser de solo insercion para la app.';
    END IF;

    INSERT INTO migraciones_registro (version, descripcion, resultado, detalle)
    SELECT '23-facturacion-legal', 'Facturacion electronica SRI (factura/NC 1.1.0) y documentos legales con evidencia de aceptacion', 'exito',
           jsonb_build_object('tablas', tablas || ARRAY['documentos_legales', 'documento_legal_versiones', 'plataforma_proveedor'])
    WHERE NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '23-facturacion-legal' AND resultado = 'exito');
END $$;

-- ============================================================
-- Sprint 24: Identidad de cada empresa en sus documentos (logo y copia
-- de los datos al crear el documento)
--
-- 100 % aditivo e idempotente. No modifica documentos existentes: las
-- proformas y ordenes anteriores quedan con empresa_datos = NULL y siguen
-- mostrando los datos ACTUALES de su propia empresa (como hasta ahora).
--
-- 24.1 Logo: la app puede cambiar empresas.logo_archivo de SU empresa
--      (RLS empresa_propia ya limita la fila).
-- 24.2 Copia de los datos de la empresa (nombre, RUC, direccion, contacto
--      y logo) en cada proforma y orden de trabajo NUEVA, hecha por la base
--      (trigger): el documento conserva la identidad con la que se emitio
--      aunque la empresa cambie despues su nombre o su logo. La copia no se
--      puede modificar una vez guardada.
-- 24.3 Registro.
-- (El RUC de proveedor ya es unico por empresa: indice uq_proveedores_ruc,
--  Sprints 16 y 22.)
-- ============================================================

-- ── 24.1 Logo ──
GRANT UPDATE (logo_archivo) ON empresas TO ssswap_app;
COMMENT ON COLUMN empresas.logo_archivo IS 'Logo: upload:<archivo> (backend/uploads/logos, PNG o JPG validados) o asset:<archivo> (backend/src/assets). NULL = sin logo.';

-- ── 24.2 Copia de los datos de la empresa en los documentos ──
ALTER TABLE proformas       ADD COLUMN IF NOT EXISTS empresa_datos JSONB;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS empresa_datos JSONB;
COMMENT ON COLUMN proformas.empresa_datos IS 'Datos de la empresa emisora al crear la proforma (Sprint 24). NULL en proformas anteriores: se usan los datos actuales de su empresa.';
COMMENT ON COLUMN ordenes_trabajo.empresa_datos IS 'Datos de la empresa al crear la orden (Sprint 24). NULL en ordenes anteriores: se usan los datos actuales de su empresa.';

CREATE OR REPLACE FUNCTION copiar_datos_empresa() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- La copia es historica: una vez guardada no cambia.
        IF OLD.empresa_datos IS NOT NULL THEN NEW.empresa_datos := OLD.empresa_datos; END IF;
        RETURN NEW;
    END IF;
    IF NEW.empresa_id IS NOT NULL THEN
        SELECT jsonb_build_object(
                   'nombre', e.nombre, 'nombre_comercial', e.nombre_comercial, 'razon_social', e.razon_social,
                   'ruc', e.ruc, 'direccion', e.direccion, 'telefono', e.telefono, 'email', e.email,
                   'logo_archivo', e.logo_archivo, 'copiado_at', NOW())
          INTO NEW.empresa_datos
          FROM empresas e WHERE e.id = NEW.empresa_id;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proformas_empresa_datos ON proformas;
CREATE TRIGGER trg_proformas_empresa_datos BEFORE INSERT OR UPDATE OF empresa_datos ON proformas
    FOR EACH ROW EXECUTE FUNCTION copiar_datos_empresa();
DROP TRIGGER IF EXISTS trg_ordenes_empresa_datos ON ordenes_trabajo;
CREATE TRIGGER trg_ordenes_empresa_datos BEFORE INSERT OR UPDATE OF empresa_datos ON ordenes_trabajo
    FOR EACH ROW EXECUTE FUNCTION copiar_datos_empresa();
GRANT EXECUTE ON FUNCTION copiar_datos_empresa() TO ssswap_app;

-- ── 24.3 Registro ──
INSERT INTO migraciones_registro (version, descripcion, resultado, detalle)
SELECT '24-identidad-empresa', 'Logo por empresa y copia de los datos de la empresa en proformas y ordenes nuevas', 'exito',
       jsonb_build_object('columnas', ARRAY['proformas.empresa_datos', 'ordenes_trabajo.empresa_datos'], 'trigger', 'copiar_datos_empresa')
WHERE NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '24-identidad-empresa' AND resultado = 'exito');

-- ============================================================
-- Sprint 25: Facturas de compra (comprobantes electronicos RECIBIDOS de
-- proveedores) que alimentan el inventario
--
-- Requiere los Sprints 22 a 24. Aditivo e idempotente: no borra datos.
-- Unico cambio sobre una columna existente: compras_proveedor_items.cantidad
-- y cantidad_recibida pasan de INTEGER a NUMERIC(10,2) (sin perdida: todo
-- entero cabe en NUMERIC) para comprar litros, galones o metros.
--
-- 25.1 facturas_compra: una fila por clave de acceso y empresa (UNIQUE): la
--      misma factura nunca se registra dos veces. Guarda el XML original,
--      su origen (SRI / XML cargado / manual), el estado en el SRI y el
--      estado interno (pendiente_confirmacion -> registrada).
-- 25.2 facturas_compra_detalles: los articulos del comprobante y la decision
--      tomada al confirmar (producto existente, nuevo u omitir).
-- 25.3 repuestos_codigos_proveedor: codigo del proveedor -> codigo interno.
-- 25.4 movimientos_inventario.factura_compra_detalle_id UNIQUE: cada articulo
--      de una factura genera A LO SUMO una entrada de inventario (garantia de
--      la base, ademas del bloqueo en el backend).
-- 25.5 Proteccion: una factura registrada no se borra ni se altera.
-- 25.6 Aislamiento por empresa (RLS + llaves compuestas desde multiempresa.js).
-- 25.7 Registro.
-- ============================================================

-- ── 25.0 Cantidades decimales en compras ──
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'compras_proveedor_items' AND column_name = 'cantidad') = 'integer' THEN
        ALTER TABLE compras_proveedor_items ALTER COLUMN cantidad TYPE NUMERIC(10,2);
        ALTER TABLE compras_proveedor_items ALTER COLUMN cantidad_recibida TYPE NUMERIC(10,2);
    END IF;
END $$;

-- ── 25.1 Facturas de compra ──
CREATE TABLE IF NOT EXISTS facturas_compra (
    id                          SERIAL PRIMARY KEY,
    empresa_id                  INTEGER NOT NULL DEFAULT empresa_actual(),
    clave_acceso                VARCHAR(49) NOT NULL CHECK (clave_acceso ~ '^[0-9]{49}$'),
    ambiente                    SMALLINT NOT NULL CHECK (ambiente IN (1, 2)),
    cod_doc                     VARCHAR(2) NOT NULL DEFAULT '01',
    numero                      VARCHAR(17),
    fecha_emision               DATE,
    emisor_ruc                  VARCHAR(13) NOT NULL,
    emisor_razon_social         VARCHAR(300),
    emisor_nombre_comercial     VARCHAR(300),
    emisor_direccion            VARCHAR(300),
    comprador_tipo_identificacion VARCHAR(2),
    comprador_identificacion    VARCHAR(20),
    comprador_razon_social      VARCHAR(300),
    total_sin_impuestos         NUMERIC(14,2),
    total_descuento             NUMERIC(14,2),
    total_iva                   NUMERIC(14,2),
    importe_total               NUMERIC(14,2),
    totales_impuestos           JSONB,
    estado_sri                  VARCHAR(30) NOT NULL DEFAULT 'SIN_VERIFICAR'
                                    CHECK (estado_sri IN ('AUTORIZADO', 'NO AUTORIZADO', 'ANULADO', 'PENDIENTE DE ANULAR', 'NO_ENCONTRADO', 'SIN_VERIFICAR')),
    numero_autorizacion         VARCHAR(49),
    fecha_autorizacion          TIMESTAMP WITH TIME ZONE,
    verificado_sri_at           TIMESTAMP WITH TIME ZONE,
    anulacion_verificada        BOOLEAN,
    origen_datos                VARCHAR(10) NOT NULL CHECK (origen_datos IN ('sri', 'xml', 'manual')),
    firma_valida                BOOLEAN,
    xml_original                TEXT,
    xml_sha256                  CHAR(64),
    estado                      VARCHAR(30) NOT NULL DEFAULT 'pendiente_confirmacion'
                                    CHECK (estado IN ('pendiente_confirmacion', 'registrada', 'no_registrable', 'error')),
    advertencias                JSONB NOT NULL DEFAULT '[]'::jsonb,
    ultimo_error                TEXT,
    proveedor_id                INTEGER REFERENCES proveedores(id),
    compra_id                   INTEGER UNIQUE REFERENCES compras_proveedor(id),
    consultada_por              INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    registrada_por              INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    registrada_at               TIMESTAMP WITH TIME ZONE,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_facturas_compra_clave UNIQUE (empresa_id, clave_acceso),
    CONSTRAINT chk_facturas_compra_registrada CHECK (estado <> 'registrada' OR (compra_id IS NOT NULL AND proveedor_id IS NOT NULL AND registrada_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_facturas_compra_emisor   ON facturas_compra (empresa_id, emisor_ruc);
CREATE INDEX IF NOT EXISTS idx_facturas_compra_fecha    ON facturas_compra (empresa_id, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_compra_estado   ON facturas_compra (empresa_id, estado);
COMMENT ON TABLE facturas_compra IS 'Comprobantes electronicos recibidos de proveedores (Sprint 25). Consultar no toca el inventario; solo confirmar (estado registrada) genera la compra y las entradas.';
COMMENT ON COLUMN facturas_compra.estado_sri IS 'Estado en el SRI: AUTORIZADO/NO AUTORIZADO (servicio de autorizacion), ANULADO/PENDIENTE DE ANULAR (servicio de consulta), NO_ENCONTRADO, SIN_VERIFICAR (no se pudo consultar).';
COMMENT ON COLUMN facturas_compra.origen_datos IS 'De donde salio el detalle: sri (XML autorizado descargado del SRI), xml (archivo cargado por el usuario), manual (escrito a mano, no verificado).';
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_facturas_compra') THEN
        CREATE TRIGGER set_updated_at_facturas_compra BEFORE UPDATE ON facturas_compra FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── 25.2 Detalle ──
CREATE TABLE IF NOT EXISTS facturas_compra_detalles (
    id                          SERIAL PRIMARY KEY,
    empresa_id                  INTEGER NOT NULL DEFAULT empresa_actual(),
    factura_id                  INTEGER NOT NULL REFERENCES facturas_compra(id) ON DELETE CASCADE,
    linea                       SMALLINT NOT NULL,
    codigo_principal            VARCHAR(100),
    codigo_auxiliar             VARCHAR(100),
    descripcion                 VARCHAR(300) NOT NULL,
    unidad_medida               VARCHAR(50),
    cantidad                    NUMERIC(18,6) NOT NULL CHECK (cantidad > 0),
    precio_unitario             NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
    descuento                   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    precio_total_sin_impuesto   NUMERIC(14,2) NOT NULL DEFAULT 0,
    impuestos                   JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Decision al confirmar la compra.
    accion                      VARCHAR(10) CHECK (accion IN ('existente', 'nuevo', 'omitir')),
    repuesto_id                 INTEGER REFERENCES repuestos(id),
    area                        VARCHAR(30),
    cantidad_recibida           NUMERIC(10,2) CHECK (cantidad_recibida IS NULL OR cantidad_recibida > 0),
    costo_unitario              NUMERIC(10,2) CHECK (costo_unitario IS NULL OR costo_unitario >= 0),
    CONSTRAINT uq_facturas_compra_detalles_linea UNIQUE (factura_id, linea)
);
CREATE INDEX IF NOT EXISTS idx_fc_detalles_factura  ON facturas_compra_detalles (factura_id);
CREATE INDEX IF NOT EXISTS idx_fc_detalles_repuesto ON facturas_compra_detalles (repuesto_id);

-- ── 25.3 Codigos de proveedor -> codigo interno ──
CREATE TABLE IF NOT EXISTS repuestos_codigos_proveedor (
    id              SERIAL PRIMARY KEY,
    empresa_id      INTEGER NOT NULL DEFAULT empresa_actual(),
    repuesto_id     INTEGER NOT NULL REFERENCES repuestos(id),
    proveedor_id    INTEGER NOT NULL REFERENCES proveedores(id),
    codigo          VARCHAR(100) NOT NULL CHECK (BTRIM(codigo) <> ''),
    creado_por      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_repuestos_codigos_proveedor UNIQUE (empresa_id, proveedor_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_rcp_repuesto ON repuestos_codigos_proveedor (repuesto_id);
COMMENT ON TABLE repuestos_codigos_proveedor IS 'Codigo que usa cada proveedor para un producto propio. El codigo interno (repuestos.codigo) nunca se reemplaza.';

-- ── 25.4 Movimientos de inventario ligados a la factura ──
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS factura_compra_id INTEGER REFERENCES facturas_compra(id);
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS factura_compra_detalle_id INTEGER REFERENCES facturas_compra_detalles(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_factura_detalle ON movimientos_inventario (factura_compra_detalle_id)
    WHERE factura_compra_detalle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_factura_compra ON movimientos_inventario (factura_compra_id) WHERE factura_compra_id IS NOT NULL;
COMMENT ON COLUMN movimientos_inventario.factura_compra_detalle_id IS 'Articulo de la factura de compra que origino esta entrada (UNIQUE: una sola entrada por articulo).';

-- ── 25.5 Una factura registrada no se borra ni cambia su identidad ──
CREATE OR REPLACE FUNCTION proteger_factura_compra() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.estado = 'registrada' THEN
            RAISE EXCEPTION 'La factura de compra % ya fue registrada: no se puede borrar.', OLD.clave_acceso USING ERRCODE = 'P0001';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.estado = 'registrada' AND (
        NEW.estado IS DISTINCT FROM OLD.estado OR NEW.clave_acceso IS DISTINCT FROM OLD.clave_acceso
        OR NEW.compra_id IS DISTINCT FROM OLD.compra_id OR NEW.proveedor_id IS DISTINCT FROM OLD.proveedor_id
        OR NEW.importe_total IS DISTINCT FROM OLD.importe_total OR NEW.xml_original IS DISTINCT FROM OLD.xml_original
        OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id) THEN
        RAISE EXCEPTION 'La factura de compra % ya fue registrada: no se puede modificar.', OLD.clave_acceso USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_proteger_factura_compra ON facturas_compra;
CREATE TRIGGER trg_proteger_factura_compra BEFORE UPDATE OR DELETE ON facturas_compra
    FOR EACH ROW EXECUTE FUNCTION proteger_factura_compra();

CREATE OR REPLACE FUNCTION proteger_detalle_factura_compra() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE est TEXT;
BEGIN
    SELECT estado INTO est FROM facturas_compra WHERE id = COALESCE(OLD.factura_id, NEW.factura_id);
    IF est = 'registrada' THEN
        RAISE EXCEPTION 'Los articulos de una factura de compra registrada no se pueden modificar.' USING ERRCODE = 'P0001';
    END IF;
    RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_proteger_detalle_factura_compra ON facturas_compra_detalles;
CREATE TRIGGER trg_proteger_detalle_factura_compra BEFORE INSERT OR UPDATE OR DELETE ON facturas_compra_detalles
    FOR EACH ROW EXECUTE FUNCTION proteger_detalle_factura_compra();

-- ── 25.6 Aislamiento por empresa ──
DO $$
DECLARE
    t TEXT;
    tablas TEXT[] := ARRAY['facturas_compra', 'facturas_compra_detalles', 'repuestos_codigos_proveedor'];
BEGIN
    FOREACH t IN ARRAY tablas LOOP
        PERFORM agregar_constraint_si_falta(t, 'fk_' || t || '_empresa', 'FOREIGN KEY (empresa_id) REFERENCES empresas(id)');
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (empresa_id)', 'idx_' || t || '_empresa', t);
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS aislamiento_empresa ON %I', t);
        EXECUTE format('CREATE POLICY aislamiento_empresa ON %I USING (empresa_id = empresa_actual()) WITH CHECK (empresa_id = empresa_actual())', t);
    END LOOP;
END $$;

-- RELACIONES25_INICIO (generado desde multiempresa.js: node src/config/multiempresa.js)
DO $$
BEGIN
    PERFORM agregar_constraint_si_falta('compras_proveedor', 'uq_compras_proveedor_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('facturas_compra', 'uq_facturas_compra_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('facturas_compra_detalles', 'uq_facturas_compra_detalles_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('proveedores', 'uq_proveedores_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('repuestos', 'uq_repuestos_id_empresa', 'UNIQUE (id, empresa_id)');
    PERFORM agregar_constraint_si_falta('facturas_compra', 'fk_emp_facturas_compra_proveedor_id', 'FOREIGN KEY (proveedor_id, empresa_id) REFERENCES proveedores(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('facturas_compra', 'fk_emp_facturas_compra_compra_id', 'FOREIGN KEY (compra_id, empresa_id) REFERENCES compras_proveedor(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('facturas_compra_detalles', 'fk_emp_facturas_compra_detalles_factura_id', 'FOREIGN KEY (factura_id, empresa_id) REFERENCES facturas_compra(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('facturas_compra_detalles', 'fk_emp_facturas_compra_detalles_repuesto_id', 'FOREIGN KEY (repuesto_id, empresa_id) REFERENCES repuestos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('repuestos_codigos_proveedor', 'fk_emp_repuestos_codigos_proveedor_repuesto_id', 'FOREIGN KEY (repuesto_id, empresa_id) REFERENCES repuestos(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('repuestos_codigos_proveedor', 'fk_emp_repuestos_codigos_proveedor_proveedor_id', 'FOREIGN KEY (proveedor_id, empresa_id) REFERENCES proveedores(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_inventario', 'fk_emp_movimientos_inventario_factura_compra_id', 'FOREIGN KEY (factura_compra_id, empresa_id) REFERENCES facturas_compra(id, empresa_id)');
    PERFORM agregar_constraint_si_falta('movimientos_inventario', 'fk_emp_movimientos_inventario_factura_compra_detalle_id', 'FOREIGN KEY (factura_compra_detalle_id, empresa_id) REFERENCES facturas_compra_detalles(id, empresa_id)');
END $$;
-- RELACIONES25_FIN

GRANT SELECT, INSERT, UPDATE, DELETE ON facturas_compra, facturas_compra_detalles TO ssswap_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON repuestos_codigos_proveedor TO ssswap_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ssswap_app;
GRANT EXECUTE ON FUNCTION proteger_factura_compra(), proteger_detalle_factura_compra() TO ssswap_app;

-- ── 25.7 Validaciones y registro ──
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['facturas_compra', 'facturas_compra_detalles', 'repuestos_codigos_proveedor'] LOOP
        IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = t::regclass) THEN
            RAISE EXCEPTION 'Validacion 25: % no tiene Row Level Security.', t;
        END IF;
    END LOOP;
    INSERT INTO migraciones_registro (version, descripcion, resultado, detalle)
    SELECT '25-facturas-compra', 'Facturas de compra (comprobantes recibidos) con entrada unica al inventario', 'exito',
           jsonb_build_object('tablas', ARRAY['facturas_compra', 'facturas_compra_detalles', 'repuestos_codigos_proveedor'],
                              'columnas', ARRAY['movimientos_inventario.factura_compra_id', 'movimientos_inventario.factura_compra_detalle_id'])
    WHERE NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '25-facturas-compra' AND resultado = 'exito');
END $$;


-- ============================================================
-- Sprint 26: "Crear compra" con datos del comprobante (estilo de los
-- sistemas contables): tipo y numero de documento, inventario de destino,
-- tipo de registro, sustento tributario (tabla del SRI) y vencimiento
-- elegido por el usuario.
--
-- Requiere el Sprint 25. Aditivo e idempotente: no borra datos.
-- 26.1 compras_proveedor: tipo_documento, numero_documento, area,
--      tipo_registro, sustento_tributario.
-- 26.2 compras_proveedor_items.iva_porcentaje (subtotales 15% / 0%).
-- 26.3 Datos de las compras ya registradas desde facturas (Sprint 25).
-- 26.4 Sin duplicados: un mismo documento del mismo proveedor no se
--      registra dos veces (indice unico parcial, por empresa).
-- 26.5 Registro.
-- ============================================================

-- ── 26.1 Datos del comprobante en la compra ──
ALTER TABLE compras_proveedor ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20) NOT NULL DEFAULT 'orden';
ALTER TABLE compras_proveedor ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(20);
ALTER TABLE compras_proveedor ADD COLUMN IF NOT EXISTS area VARCHAR(30);
ALTER TABLE compras_proveedor ADD COLUMN IF NOT EXISTS tipo_registro VARCHAR(20) NOT NULL DEFAULT 'inventario';
ALTER TABLE compras_proveedor ADD COLUMN IF NOT EXISTS sustento_tributario VARCHAR(2);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compras_tipo_documento') THEN
        ALTER TABLE compras_proveedor ADD CONSTRAINT chk_compras_tipo_documento
            CHECK (tipo_documento IN ('orden', 'factura', 'nota_venta', 'otro'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compras_tipo_registro') THEN
        ALTER TABLE compras_proveedor ADD CONSTRAINT chk_compras_tipo_registro
            CHECK (tipo_registro IN ('inventario', 'gasto', 'activo_fijo'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compras_sustento') THEN
        ALTER TABLE compras_proveedor ADD CONSTRAINT chk_compras_sustento
            CHECK (sustento_tributario IS NULL OR sustento_tributario ~ '^[0-9]{2}$');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compras_numero_documento') THEN
        ALTER TABLE compras_proveedor ADD CONSTRAINT chk_compras_numero_documento
            CHECK (numero_documento IS NULL OR numero_documento ~ '^[0-9]{3}-[0-9]{3}-[0-9]{9}$');
    END IF;
END $$;
COMMENT ON COLUMN compras_proveedor.tipo_documento IS 'orden (pedido al proveedor, se recibe despues), factura, nota_venta u otro comprobante.';
COMMENT ON COLUMN compras_proveedor.numero_documento IS 'Establecimiento-punto de emision-secuencial del comprobante del proveedor (001-001-000000123).';
COMMENT ON COLUMN compras_proveedor.area IS 'Inventario de destino principal (almacen) elegido al crear la compra.';
COMMENT ON COLUMN compras_proveedor.tipo_registro IS 'inventario, gasto o activo_fijo (como se registra la compra).';
COMMENT ON COLUMN compras_proveedor.sustento_tributario IS 'Codigo de sustento tributario del SRI (tabla 5 del ATS: 00-15).';

-- ── 26.2 Tarifa de IVA por item ──
ALTER TABLE compras_proveedor_items ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 15;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_compras_items_iva') THEN
        ALTER TABLE compras_proveedor_items ADD CONSTRAINT chk_compras_items_iva CHECK (iva_porcentaje >= 0 AND iva_porcentaje <= 100);
    END IF;
END $$;

-- ── 26.3 Compras ya registradas desde una factura del SRI ──
UPDATE compras_proveedor c
   SET tipo_documento = 'factura',
       numero_documento = f.numero,
       tipo_registro = 'inventario',
       sustento_tributario = COALESCE(c.sustento_tributario, '06')
  FROM facturas_compra f
 WHERE f.compra_id = c.id AND c.tipo_documento = 'orden'
   AND f.numero ~ '^[0-9]{3}-[0-9]{3}-[0-9]{9}$';

-- IVA real de los items de esas compras (de los articulos de la factura).
UPDATE compras_proveedor_items i
   SET iva_porcentaje = x.tarifa
  FROM (
        SELECT c.id AS compra_id, d.descripcion,
               COALESCE((SELECT MAX((t->>'tarifa')::numeric) FROM jsonb_array_elements(d.impuestos) t WHERE t->>'codigo' = '2'), 0) AS tarifa
          FROM facturas_compra f
          JOIN compras_proveedor c ON c.id = f.compra_id
          JOIN facturas_compra_detalles d ON d.factura_id = f.id
       ) x
 WHERE i.compra_id = x.compra_id AND i.descripcion = LEFT(x.descripcion, 200) AND x.tarifa BETWEEN 0 AND 100;

-- ── 26.4 Un documento del proveedor se registra una sola vez ──
CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_documento
    ON compras_proveedor (empresa_id, proveedor_id, tipo_documento, numero_documento)
    WHERE numero_documento IS NOT NULL AND estado <> 'cancelada';
CREATE INDEX IF NOT EXISTS idx_compras_area ON compras_proveedor (empresa_id, area);

-- ── 26.5 Registro ──
DO $$
BEGIN
    INSERT INTO migraciones_registro (version, descripcion, resultado, detalle)
    SELECT '26-crear-compra', 'Crear compra con documento, inventario, tipo de registro y sustento tributario', 'exito',
           jsonb_build_object('columnas', ARRAY['compras_proveedor.tipo_documento', 'compras_proveedor.numero_documento', 'compras_proveedor.area',
                                                'compras_proveedor.tipo_registro', 'compras_proveedor.sustento_tributario', 'compras_proveedor_items.iva_porcentaje'],
                              'indices', ARRAY['uq_compras_documento'])
    WHERE NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '26-crear-compra' AND resultado = 'exito');
END $$;

-- ═════════════════════════════════════════════════════════════
-- Sprint 28: historial de productos creados en el inventario
-- ═════════════════════════════════════════════════════════════
-- Cada producto guarda COMO nacio (a mano desde Inventario o al registrar
-- una factura de compra del proveedor) y QUIEN lo creo. Aditivo: los
-- productos existentes se clasifican con la informacion que ya habia.

-- ── 28.1 Columnas ──
ALTER TABLE repuestos ADD COLUMN IF NOT EXISTS origen_creacion VARCHAR(20);
ALTER TABLE repuestos ADD COLUMN IF NOT EXISTS creado_por INTEGER;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_repuestos_origen_creacion') THEN
        ALTER TABLE repuestos ADD CONSTRAINT chk_repuestos_origen_creacion
            CHECK (origen_creacion IS NULL OR origen_creacion IN ('manual', 'factura_compra', 'importacion'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_repuestos_creado_por') THEN
        ALTER TABLE repuestos ADD CONSTRAINT fk_repuestos_creado_por
            FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_repuestos_created_at ON repuestos (empresa_id, created_at DESC);

-- ── 28.2 Productos ya existentes ──
-- Los que nacieron de una factura de compra (linea con accion 'nuevo').
UPDATE repuestos r
   SET origen_creacion = 'factura_compra',
       creado_por = COALESCE(r.creado_por, f.registrada_por)
  FROM facturas_compra_detalles d
  JOIN facturas_compra f ON f.id = d.factura_id
 WHERE d.repuesto_id = r.id AND d.accion = 'nuevo' AND r.origen_creacion IS NULL;
-- El resto se creo a mano (o con el catalogo inicial).
UPDATE repuestos SET origen_creacion = 'manual' WHERE origen_creacion IS NULL;

COMMENT ON COLUMN repuestos.origen_creacion IS 'Como se creo el producto: manual (Inventario), factura_compra (factura del proveedor) o importacion.';
COMMENT ON COLUMN repuestos.creado_por IS 'Usuario que creo el producto (NULL en productos anteriores al Sprint 28 creados a mano).';

-- ── 28.3 Registro ──
DO $$
BEGIN
    INSERT INTO migraciones_registro (version, descripcion, resultado, detalle)
    SELECT '28-historial-productos', 'Historial de productos creados (origen y usuario)', 'exito',
           jsonb_build_object('columnas', ARRAY['repuestos.origen_creacion', 'repuestos.creado_por'])
    WHERE NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '28-historial-productos' AND resultado = 'exito');
END $$;

-- ═════════════════════════════════════════════════════════════
-- Sprint 28 (b): todo registro nuevo queda a nombre de quien lo creo
-- ═════════════════════════════════════════════════════════════
-- config/db.js fija app.usuario_id (usuario de la sesion) en cada consulta,
-- igual que app.empresa_id. usuario_actual() lo lee y se usa como valor por
-- defecto del creador: aunque un INSERT no lo mencione, queda registrado.
-- Fuera de una peticion (scripts, web publica sin sesion) queda NULL.
CREATE OR REPLACE FUNCTION usuario_actual() RETURNS INTEGER
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.usuario_id', true), '')::int $$;
GRANT EXECUTE ON FUNCTION usuario_actual() TO PUBLIC;

-- ── 28.4 Tablas que no guardaban creador ──
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['clientes', 'vehiculos', 'proveedores', 'proveedores_contactos', 'categorias_repuesto',
                             'tipos_servicio', 'sucursales', 'cuentas_dinero'] LOOP
        IF to_regclass(t) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS creado_por INTEGER', t);
            EXECUTE format('ALTER TABLE %I ALTER COLUMN creado_por SET DEFAULT usuario_actual()', t);
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_' || t || '_creado_por') THEN
                EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL',
                               t, 'fk_' || t || '_creado_por');
            END IF;
        END IF;
    END LOOP;
END $$;

-- ── 28.5 Tablas que ya tenian el usuario: si un INSERT lo omite, se toma el de la sesion ──
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('repuestos', 'creado_por'), ('repuestos_codigos_proveedor', 'creado_por'),
        ('proformas', 'usuario_id'), ('ordenes_trabajo', 'usuario_id'), ('compras_proveedor', 'usuario_id'),
        ('gastos_proveedor', 'usuario_id'), ('movimientos_inventario', 'usuario_id'), ('movimientos_dinero', 'usuario_id'),
        ('caja_movimientos', 'usuario_id'), ('cuentas_cobrar', 'usuario_id'), ('pagos_cliente', 'usuario_id'),
        ('movimientos_financieros_proveedor', 'usuario_id'), ('comprobantes_electronicos', 'creado_por')
    ) AS v(tabla, columna) LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = r.tabla AND column_name = r.columna
                      AND column_default IS NULL) THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT usuario_actual()', r.tabla, r.columna);
        END IF;
    END LOOP;
END $$;

DO $$
BEGIN
    INSERT INTO migraciones_registro (version, descripcion, resultado, detalle)
    SELECT '28-creador-registros', 'Creador por defecto (usuario de la sesion) en los registros', 'exito',
           jsonb_build_object('funcion', 'usuario_actual()',
                              'tablas', ARRAY['clientes', 'vehiculos', 'proveedores', 'proveedores_contactos', 'categorias_repuesto',
                                              'tipos_servicio', 'sucursales', 'cuentas_dinero'])
    WHERE NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '28-creador-registros' AND resultado = 'exito');
END $$;

-- ── 28.6 Correccion del nombre comercial de SS SWAP ("SSarango" -> "Sarango") ──
-- Se corrige la empresa y la copia guardada en sus proformas y ordenes
-- (la copia es historica y el trigger la protege: se desactiva solo
--  durante esta correccion puntual).
UPDATE empresas
   SET nombre_comercial = REPLACE(nombre_comercial, 'SSarango Sosa', 'Sarango Sosa')
 WHERE nombre_comercial LIKE '%SSarango Sosa%';

DO $$
BEGIN
    ALTER TABLE proformas       DISABLE TRIGGER trg_proformas_empresa_datos;
    ALTER TABLE ordenes_trabajo DISABLE TRIGGER trg_ordenes_empresa_datos;

    UPDATE proformas
       SET empresa_datos = jsonb_set(empresa_datos, '{nombre_comercial}',
                                     to_jsonb(REPLACE(empresa_datos->>'nombre_comercial', 'SSarango Sosa', 'Sarango Sosa')))
     WHERE empresa_datos->>'nombre_comercial' LIKE '%SSarango Sosa%';
    UPDATE ordenes_trabajo
       SET empresa_datos = jsonb_set(empresa_datos, '{nombre_comercial}',
                                     to_jsonb(REPLACE(empresa_datos->>'nombre_comercial', 'SSarango Sosa', 'Sarango Sosa')))
     WHERE empresa_datos->>'nombre_comercial' LIKE '%SSarango Sosa%';

    ALTER TABLE proformas       ENABLE TRIGGER trg_proformas_empresa_datos;
    ALTER TABLE ordenes_trabajo ENABLE TRIGGER trg_ordenes_empresa_datos;
END $$;


-- ============================================================
-- Sprint 29: Caja completa (estilo control de cajas)
--
-- 100 % aditivo e idempotente. No borra datos ni cambia cierres anteriores.
-- 29.1 caja_sesiones: cajero responsable (puede ser distinto de quien abre),
--      declaracion del cajero por forma de pago, resumen congelado al cerrar,
--      ajuste del cierre (para poder reabrir) e historial de reaperturas.
-- 29.2 caja_movimientos: anulacion (nunca se borran) con motivo y usuario.
-- 29.3 v_flujo_dinero deja fuera los movimientos de caja anulados.
-- 29.4 Permisos nuevos: caja:eliminar (anular movimientos manuales) y
--      caja:reabrir (reabrir una caja cerrada), para los administradores.
-- ============================================================

-- ── 29.1 Sesiones de caja ──
ALTER TABLE caja_sesiones ADD COLUMN IF NOT EXISTS cajero_id          INTEGER REFERENCES usuarios(id);
ALTER TABLE caja_sesiones ADD COLUMN IF NOT EXISTS declaracion_cierre JSONB;
ALTER TABLE caja_sesiones ADD COLUMN IF NOT EXISTS resumen_cierre     JSONB;
ALTER TABLE caja_sesiones ADD COLUMN IF NOT EXISTS ajuste_cierre_id   INTEGER REFERENCES movimientos_dinero(id) ON DELETE SET NULL;
ALTER TABLE caja_sesiones ADD COLUMN IF NOT EXISTS reaperturas        JSONB NOT NULL DEFAULT '[]'::jsonb;
UPDATE caja_sesiones SET cajero_id = usuario_apertura_id WHERE cajero_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_caja_sesiones_cajero ON caja_sesiones(cajero_id);
-- El cajero siempre es una cuenta de la misma empresa que la caja.
DO $$
BEGIN
    PERFORM agregar_constraint_si_falta('caja_sesiones', 'fk_emp_caja_sesiones_cajero_id', 'FOREIGN KEY (cajero_id, empresa_id) REFERENCES usuarios(id, empresa_id)');
END $$;
COMMENT ON COLUMN caja_sesiones.cajero_id IS 'Cajero responsable de la caja (Sprint 29). Por defecto, quien la abrio.';
COMMENT ON COLUMN caja_sesiones.declaracion_cierre IS 'Lo que el cajero declaro al cerrar por forma de pago: efectivo, cheque, transferencia, tarjeta_credito, tarjeta_debito, retencion_fuente, retencion_iva.';
COMMENT ON COLUMN caja_sesiones.resumen_cierre IS 'Totales del sistema congelados al cerrar (por forma de pago y efectivo).';
COMMENT ON COLUMN caja_sesiones.reaperturas IS 'Historial de reaperturas: cierre anterior, quien reabrio, cuando y por que.';

-- ── 29.2 Movimientos manuales anulables ──
ALTER TABLE caja_movimientos ADD COLUMN IF NOT EXISTS anulado_at       TIMESTAMP WITH TIME ZONE;
ALTER TABLE caja_movimientos ADD COLUMN IF NOT EXISTS anulado_por      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE caja_movimientos ADD COLUMN IF NOT EXISTS motivo_anulacion VARCHAR(255);
COMMENT ON TABLE caja_movimientos IS 'Ingresos y egresos de efectivo registrados durante una sesion de caja. Nunca se borran: se anulan (Sprint 29).';

-- ── 29.3 Flujo de dinero sin movimientos de caja anulados ──
CREATE OR REPLACE VIEW v_flujo_dinero AS
SELECT 'pago_cliente'::text AS origen, p.id AS origen_id, p.fecha, p.created_at AS momento,
       'ingreso'::text AS tipo, 'cobro_clientes'::text AS categoria, p.monto,
       p.metodo_pago, COALESCE(p.cuenta_dinero_id, cuenta_dinero_por_metodo(p.metodo_pago)) AS cuenta_dinero_id,
       ('Pago: ' || cc.concepto)::text AS descripcion, COALESCE(p.numero_comprobante, p.referencia)::text AS referencia,
       c.nombre::text AS tercero
FROM pagos_cliente p
JOIN cuentas_cobrar cc ON cc.id = p.cuenta_id
JOIN clientes c ON c.id = cc.cliente_id
WHERE p.anulado_at IS NULL
UNION ALL
SELECT 'pago_proveedor', m.id, m.created_at::date, m.created_at,
       'egreso', 'pago_proveedores', m.monto,
       m.metodo_pago, COALESCE(m.cuenta_dinero_id, cuenta_dinero_por_metodo(m.metodo_pago)),
       COALESCE(m.descripcion, INITCAP(m.tipo) || ' a proveedor'), m.referencia, pr.nombre_comercial
FROM movimientos_financieros_proveedor m
JOIN proveedores pr ON pr.id = m.proveedor_id
WHERE m.tipo IN ('pago','abono') AND m.estado = 'confirmado'
UNION ALL
SELECT 'gasto', g.id, g.fecha, g.created_at,
       'egreso', 'gastos_operativos', g.monto,
       g.metodo_pago, COALESCE(g.cuenta_dinero_id, cuenta_dinero_por_metodo(g.metodo_pago)),
       g.descripcion, g.numero_comprobante, pr.nombre_comercial
FROM gastos_proveedor g
LEFT JOIN proveedores pr ON pr.id = g.proveedor_id
WHERE g.estado = 'pagado'
UNION ALL
SELECT 'caja', cm.id, cm.created_at::date, cm.created_at,
       cm.tipo, CASE cm.tipo WHEN 'ingreso' THEN 'caja_ingreso' ELSE 'caja_egreso' END, cm.monto,
       cm.metodo_pago, COALESCE(cm.cuenta_dinero_id, cuenta_dinero_por_metodo(cm.metodo_pago)),
       cm.concepto, cm.referencia, NULL
FROM caja_movimientos cm
WHERE cm.anulado_at IS NULL
UNION ALL
SELECT 'pago_empleado', pe.id, pe.fecha, pe.created_at,
       'egreso', 'nomina', pe.monto_neto,
       pe.metodo_pago, pe.cuenta_dinero_id,
       (INITCAP(REPLACE(pe.tipo, '_', ' ')) || ' ' || TO_CHAR(pe.periodo, 'MM/YYYY')), pe.referencia, u.nombre
FROM pagos_empleados pe
JOIN usuarios u ON u.id = pe.usuario_id
WHERE pe.anulado_at IS NULL
UNION ALL
SELECT 'movimiento', md.id, md.fecha, md.created_at,
       md.tipo, md.categoria, md.monto,
       md.metodo_pago, md.cuenta_dinero_id,
       md.descripcion, md.referencia, NULL
FROM movimientos_dinero md
WHERE md.anulado_at IS NULL;
ALTER VIEW v_flujo_dinero SET (security_invoker = true);
COMMENT ON VIEW v_flujo_dinero IS 'Todo el dinero que entra y sale del taller: pagos de clientes, pagos a proveedores, gastos pagados, caja (sin anulados), nomina y otros movimientos.';

-- ── 29.5 Fecha de aprobacion de la proforma (venta por cobrar en el cierre de caja) ──
-- Una proforma aprobada (o convertida en orden) es una venta aunque todavia
-- no tenga pagare ni pagos: el cierre de caja la muestra como "por cobrar".
-- La fecha la pone la base al cambiar de estado; las anteriores quedan NULL.
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS aprobada_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_proformas_aprobada_at ON proformas(aprobada_at) WHERE aprobada_at IS NOT NULL;
COMMENT ON COLUMN proformas.aprobada_at IS 'Cuando la proforma paso a aprobada/convertida (Sprint 29). NULL si no esta aprobada o si se aprobo antes de este cambio.';

CREATE OR REPLACE FUNCTION marcar_aprobacion_proforma() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.estado IN ('aprobada', 'convertida') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.aprobada_at := COALESCE(NEW.aprobada_at, NOW());
        ELSIF OLD.estado NOT IN ('aprobada', 'convertida') THEN
            NEW.aprobada_at := NOW();
        ELSE
            NEW.aprobada_at := OLD.aprobada_at;   -- aprobada -> convertida conserva la fecha
        END IF;
    ELSE
        NEW.aprobada_at := NULL;
    END IF;
    RETURN NEW;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_proformas_aprobada_at') THEN
        CREATE TRIGGER trg_proformas_aprobada_at BEFORE INSERT OR UPDATE OF estado ON proformas
            FOR EACH ROW EXECUTE FUNCTION marcar_aprobacion_proforma();
    END IF;
END $$;

-- ── 29.4 Permisos de caja ──
-- CATALOGO_INICIO (generado desde permisos.js)
INSERT INTO permisos_catalogo (modulo, accion, modulo_nombre, accion_nombre, grupo, orden, solo_superadmin) VALUES
    ('dashboard', 'ver', 'Panel principal', 'Ver', 'Panel', 1, FALSE),
    ('inventario_mecanica', 'ver', 'Inventario de mecánica', 'Ver', 'Inventario', 2, FALSE),
    ('inventario_mecanica', 'crear', 'Inventario de mecánica', 'Crear', 'Inventario', 3, FALSE),
    ('inventario_mecanica', 'editar', 'Inventario de mecánica', 'Editar', 'Inventario', 4, FALSE),
    ('inventario_mecanica', 'eliminar', 'Inventario de mecánica', 'Eliminar', 'Inventario', 5, FALSE),
    ('inventario_colisiones', 'ver', 'Inventario de colisiones / pintura', 'Ver', 'Inventario', 6, FALSE),
    ('inventario_colisiones', 'crear', 'Inventario de colisiones / pintura', 'Crear', 'Inventario', 7, FALSE),
    ('inventario_colisiones', 'editar', 'Inventario de colisiones / pintura', 'Editar', 'Inventario', 8, FALSE),
    ('inventario_colisiones', 'eliminar', 'Inventario de colisiones / pintura', 'Eliminar', 'Inventario', 9, FALSE),
    ('registros_inventario', 'ver', 'Entradas y salidas de inventario', 'Ver registros', 'Inventario', 10, FALSE),
    ('registros_inventario', 'crear', 'Entradas y salidas de inventario', 'Registrar entradas / salidas', 'Inventario', 11, FALSE),
    ('registros_inventario', 'aprobar', 'Entradas y salidas de inventario', 'Devolver salidas al inventario', 'Inventario', 12, FALSE),
    ('pedidos_tienda', 'ver', 'Pedidos de la tienda', 'Ver', 'Inventario', 13, FALSE),
    ('pedidos_tienda', 'editar', 'Pedidos de la tienda', 'Atender / cancelar', 'Inventario', 14, FALSE),
    ('ordenes', 'ver', 'Órdenes de trabajo', 'Ver', 'Taller', 15, FALSE),
    ('ordenes', 'crear', 'Órdenes de trabajo', 'Crear', 'Taller', 16, FALSE),
    ('ordenes', 'editar', 'Órdenes de trabajo', 'Editar', 'Taller', 17, FALSE),
    ('ordenes', 'eliminar', 'Órdenes de trabajo', 'Eliminar', 'Taller', 18, FALSE),
    ('ordenes', 'asignar', 'Órdenes de trabajo', 'Asignar técnico', 'Taller', 19, FALSE),
    ('ordenes', 'aprobar', 'Órdenes de trabajo', 'Cambiar estado de cualquier orden', 'Taller', 20, FALSE),
    ('proformas_mecanica', 'ver', 'Proformas de mecánica', 'Ver', 'Taller', 21, FALSE),
    ('proformas_mecanica', 'crear', 'Proformas de mecánica', 'Crear', 'Taller', 22, FALSE),
    ('proformas_mecanica', 'editar', 'Proformas de mecánica', 'Editar', 'Taller', 23, FALSE),
    ('proformas_mecanica', 'eliminar', 'Proformas de mecánica', 'Eliminar', 'Taller', 24, FALSE),
    ('proformas_mecanica', 'exportar', 'Proformas de mecánica', 'Descargar PDF / Excel', 'Taller', 25, FALSE),
    ('proformas_mecanica', 'aprobar', 'Proformas de mecánica', 'Aprobar, rechazar, convertir en OT y confirmar materiales', 'Taller', 26, FALSE),
    ('proformas_colisiones', 'ver', 'Proformas de colisiones / pintura', 'Ver', 'Taller', 27, FALSE),
    ('proformas_colisiones', 'crear', 'Proformas de colisiones / pintura', 'Crear', 'Taller', 28, FALSE),
    ('proformas_colisiones', 'editar', 'Proformas de colisiones / pintura', 'Editar', 'Taller', 29, FALSE),
    ('proformas_colisiones', 'eliminar', 'Proformas de colisiones / pintura', 'Eliminar', 'Taller', 30, FALSE),
    ('proformas_colisiones', 'exportar', 'Proformas de colisiones / pintura', 'Descargar PDF / Excel', 'Taller', 31, FALSE),
    ('proformas_colisiones', 'aprobar', 'Proformas de colisiones / pintura', 'Aprobar, rechazar, convertir en OT y confirmar materiales', 'Taller', 32, FALSE),
    ('citas', 'ver', 'Citas', 'Ver', 'Taller', 33, FALSE),
    ('citas', 'editar', 'Citas', 'Confirmar / cambiar estado', 'Taller', 34, FALSE),
    ('clientes', 'ver', 'Clientes', 'Ver', 'Clientes', 35, FALSE),
    ('clientes', 'crear', 'Clientes', 'Crear', 'Clientes', 36, FALSE),
    ('clientes', 'editar', 'Clientes', 'Editar', 'Clientes', 37, FALSE),
    ('clientes', 'eliminar', 'Clientes', 'Eliminar', 'Clientes', 38, FALSE),
    ('vehiculos', 'ver', 'Vehículos', 'Ver', 'Clientes', 39, FALSE),
    ('vehiculos', 'crear', 'Vehículos', 'Crear', 'Clientes', 40, FALSE),
    ('vehiculos', 'editar', 'Vehículos', 'Editar', 'Clientes', 41, FALSE),
    ('vehiculos', 'eliminar', 'Vehículos', 'Eliminar', 'Clientes', 42, FALSE),
    ('cuentas_cobrar', 'ver', 'Pagarés y cuentas por cobrar', 'Ver', 'Clientes', 43, FALSE),
    ('cuentas_cobrar', 'crear', 'Pagarés y cuentas por cobrar', 'Crear', 'Clientes', 44, FALSE),
    ('cuentas_cobrar', 'editar', 'Pagarés y cuentas por cobrar', 'Editar (vencimiento, datos)', 'Clientes', 45, FALSE),
    ('cuentas_cobrar', 'eliminar', 'Pagarés y cuentas por cobrar', 'Eliminar / anular / reabrir', 'Clientes', 46, FALSE),
    ('pagos_clientes', 'crear', 'Registro de pagos de clientes', 'Registrar pagos', 'Clientes', 47, FALSE),
    ('pagos_clientes', 'eliminar', 'Registro de pagos de clientes', 'Anular pagos', 'Clientes', 48, FALSE),
    ('caja', 'ver', 'Caja diaria', 'Ver', 'Finanzas', 49, FALSE),
    ('caja', 'crear', 'Caja diaria', 'Registrar movimientos de caja', 'Finanzas', 50, FALSE),
    ('caja', 'aprobar', 'Caja diaria', 'Abrir y cerrar caja', 'Finanzas', 51, FALSE),
    ('caja', 'eliminar', 'Caja diaria', 'Anular movimientos manuales de caja', 'Finanzas', 52, FALSE),
    ('caja', 'reabrir', 'Caja diaria', 'Reabrir una caja cerrada', 'Finanzas', 53, FALSE),
    ('finanzas', 'ver', 'Finanzas, cuentas y nómina', 'Ver', 'Finanzas', 54, FALSE),
    ('finanzas', 'crear', 'Finanzas, cuentas y nómina', 'Crear', 'Finanzas', 55, FALSE),
    ('finanzas', 'editar', 'Finanzas, cuentas y nómina', 'Editar', 'Finanzas', 56, FALSE),
    ('finanzas', 'eliminar', 'Finanzas, cuentas y nómina', 'Anular movimientos / pagos', 'Finanzas', 57, FALSE),
    ('proveedores', 'ver', 'Proveedores, compras y gastos', 'Ver', 'Proveedores', 58, FALSE),
    ('proveedores', 'crear', 'Proveedores, compras y gastos', 'Crear', 'Proveedores', 59, FALSE),
    ('proveedores', 'editar', 'Proveedores, compras y gastos', 'Editar', 'Proveedores', 60, FALSE),
    ('proveedores', 'eliminar', 'Proveedores, compras y gastos', 'Eliminar', 'Proveedores', 61, FALSE),
    ('facturacion', 'ver', 'Facturación electrónica (SRI)', 'Ver comprobantes', 'Facturación', 62, FALSE),
    ('facturacion', 'crear', 'Facturación electrónica (SRI)', 'Preparar borradores', 'Facturación', 63, FALSE),
    ('facturacion', 'aprobar', 'Facturación electrónica (SRI)', 'Emitir y enviar al SRI', 'Facturación', 64, FALSE),
    ('facturacion', 'exportar', 'Facturación electrónica (SRI)', 'Descargar XML / RIDE y reenviar correo', 'Facturación', 65, FALSE),
    ('facturacion', 'anular', 'Facturación electrónica (SRI)', 'Notas de crédito y registro de anulaciones', 'Facturación', 66, FALSE),
    ('facturacion', 'eliminar', 'Facturación electrónica (SRI)', 'Descartar borradores', 'Facturación', 67, FALSE),
    ('facturacion_config', 'ver', 'Configuración tributaria y firma electrónica', 'Ver', 'Facturación', 68, FALSE),
    ('facturacion_config', 'editar', 'Configuración tributaria y firma electrónica', 'Editar datos tributarios, puntos de emisión y certificado', 'Facturación', 69, FALSE),
    ('facturacion_config', 'aprobar', 'Configuración tributaria y firma electrónica', 'Activar el ambiente de producción', 'Facturación', 70, FALSE),
    ('estadisticas', 'ver', 'Reportes y estadísticas', 'Ver', 'Reportes', 71, FALSE),
    ('servicios', 'ver', 'Servicios del taller', 'Ver', 'Ajustes', 72, FALSE),
    ('servicios', 'crear', 'Servicios del taller', 'Crear', 'Ajustes', 73, FALSE),
    ('servicios', 'editar', 'Servicios del taller', 'Editar', 'Ajustes', 74, FALSE),
    ('servicios', 'eliminar', 'Servicios del taller', 'Eliminar', 'Ajustes', 75, FALSE),
    ('sucursales', 'ver', 'Sucursales', 'Ver', 'Ajustes', 76, FALSE),
    ('sucursales', 'crear', 'Sucursales', 'Crear', 'Ajustes', 77, FALSE),
    ('sucursales', 'editar', 'Sucursales', 'Editar', 'Ajustes', 78, FALSE),
    ('sucursales', 'eliminar', 'Sucursales', 'Eliminar', 'Ajustes', 79, FALSE),
    ('bitacora', 'ver', 'Bitácora de operaciones', 'Ver', 'Ajustes', 80, FALSE),
    ('usuarios', 'ver', 'Usuarios y permisos de la empresa', 'Ver', 'Empresa', 81, FALSE),
    ('usuarios', 'crear', 'Usuarios y permisos de la empresa', 'Crear', 'Empresa', 82, FALSE),
    ('usuarios', 'editar', 'Usuarios y permisos de la empresa', 'Editar, activar/desactivar, permisos y restablecer acceso', 'Empresa', 83, FALSE),
    ('usuarios', 'eliminar', 'Usuarios y permisos de la empresa', 'Eliminar', 'Empresa', 84, FALSE),
    ('auditoria', 'ver', 'Auditoría de la empresa', 'Ver', 'Empresa', 85, FALSE),
    ('empresa', 'ver', 'Configuración de la empresa', 'Ver', 'Empresa', 86, FALSE),
    ('empresa', 'editar', 'Configuración de la empresa', 'Editar', 'Empresa', 87, FALSE),
    ('legal', 'ver', 'Documentos legales y aceptaciones', 'Ver documentos, aceptaciones y constancias', 'Empresa', 88, FALSE),
    ('legal', 'editar', 'Documentos legales y aceptaciones', 'Redactar borradores', 'Empresa', 89, FALSE),
    ('legal', 'aprobar', 'Documentos legales y aceptaciones', 'Publicar versiones', 'Empresa', 90, FALSE)
ON CONFLICT (modulo, accion) DO UPDATE SET
    modulo_nombre = EXCLUDED.modulo_nombre, accion_nombre = EXCLUDED.accion_nombre,
    grupo = EXCLUDED.grupo, orden = EXCLUDED.orden, solo_superadmin = EXCLUDED.solo_superadmin;
-- CATALOGO_FIN

-- Los administradores existentes reciben los permisos nuevos (una sola vez).
INSERT INTO usuario_permisos (usuario_id, modulo, accion, empresa_id)
SELECT u.id, t.modulo, t.accion, u.empresa_id
FROM usuarios u
JOIN (VALUES ('caja', 'eliminar'), ('caja', 'reabrir')) AS t(modulo, accion) ON TRUE
WHERE u.rol = 'administrador' AND u.permisos_inicializados = TRUE AND u.empresa_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '29-caja-completa' AND resultado = 'exito')
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    INSERT INTO migraciones_registro (version, descripcion, resultado, detalle)
    SELECT '29-caja-completa', 'Caja: cajero, declaracion por forma de pago, anulacion de movimientos y reapertura', 'exito',
           jsonb_build_object('columnas', ARRAY['caja_sesiones.cajero_id', 'caja_sesiones.declaracion_cierre', 'caja_sesiones.resumen_cierre',
                                                'caja_sesiones.ajuste_cierre_id', 'caja_sesiones.reaperturas', 'caja_movimientos.anulado_at'],
                              'permisos', ARRAY['caja:eliminar', 'caja:reabrir'])
    WHERE NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = '29-caja-completa' AND resultado = 'exito');
END $$;

-- ============================================================
-- Rendimiento (2026-10-18): indices de apoyo para las paginas principales
--
-- 100 % aditivo e idempotente: solo crea indices si no existen. No cambia
-- datos ni resultados; solo evita recorrer tablas completas.
--  R.1 proformas: la lista se ordena por fecha de creacion (dentro de la
--      empresa); sin indice se leia y ordenaba toda la tabla en cada pagina.
--  R.2 usuarios: la lista de clientes busca la cuenta web por LOWER(email).
--  R.3 proforma_items: el Dashboard cuenta proformas con repuestos
--      pendientes de descontar del inventario.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_proformas_empresa_creada ON proformas (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_email_lower ON usuarios (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_proforma_items_repuesto_pendiente ON proforma_items (proforma_id)
    WHERE referencia_tipo = 'repuesto' AND referencia_id IS NOT NULL;

DO $$
BEGIN
    INSERT INTO migraciones_registro (version, descripcion, resultado, detalle)
    SELECT 'rendimiento-2026-10-18', 'Indices de apoyo para listas de proformas, clientes y Dashboard', 'exito',
           jsonb_build_object('indices', ARRAY['idx_proformas_empresa_creada', 'idx_usuarios_email_lower', 'idx_proforma_items_repuesto_pendiente'])
    WHERE NOT EXISTS (SELECT 1 FROM migraciones_registro WHERE version = 'rendimiento-2026-10-18' AND resultado = 'exito');
END $$;
