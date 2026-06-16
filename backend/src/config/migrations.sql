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
