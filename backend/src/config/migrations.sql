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
INSERT INTO categorias_repuesto (nombre, descripcion, area) VALUES
    ('Pinturas',             'Pinturas base, bicapa y tricapa',                 'colisiones'),
    ('Masillas',             'Masillas de relleno y acabado',                   'colisiones'),
    ('Lijas y Abrasivos',    'Lijas al agua/seco, discos, esponjas abrasivas',  'colisiones'),
    ('Primers y Barnices',   'Fondos, primers, selladores y barnices (clear)',  'colisiones'),
    ('Diluyentes y Solventes','Thinner, reductores, desengrasantes',            'colisiones'),
    ('Materiales de Reparacion','Cintas, plasticos, enderezado y otros insumos','colisiones')
ON CONFLICT (nombre) DO NOTHING;

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
