-- ============================================================
-- SSWAP — Migraciones idempotentes (corren en cada arranque)
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
SELECT 'SSWAP Ponciano Alto',
       'Av. Real Audiencia y Manuel Cordova Galarza',
       'Quito',
       '+593 99 123 4567',
       'contacto@sswap.com',
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
