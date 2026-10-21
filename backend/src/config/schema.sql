-- ============================================================
-- SS SWAP — Schema PostgreSQL
-- Sprint 1: Usuarios, Inventario + Portal Publico
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Usuarios ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    rol         VARCHAR(20)  NOT NULL DEFAULT 'cliente'
                    CHECK (rol IN ('administrador','tecnico','recepcionista','cliente')),
    estado      VARCHAR(20)  NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo','suspendido','bloqueado')),
    telefono    VARCHAR(20),
    cedula      VARCHAR(20),
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Categorias de repuesto ───────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias_repuesto (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Repuestos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repuestos (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(50)  NOT NULL UNIQUE,
    nombre          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    categoria_id    INTEGER REFERENCES categorias_repuesto(id) ON DELETE SET NULL,
    precio_compra   NUMERIC(10,2) NOT NULL DEFAULT 0,
    precio_venta    NUMERIC(10,2) NOT NULL DEFAULT 0,
    stock_actual    INTEGER NOT NULL DEFAULT 0,
    stock_minimo    INTEGER NOT NULL DEFAULT 5,
    unidad_medida   VARCHAR(30) NOT NULL DEFAULT 'unidad',
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    imagen_url      TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Movimientos de inventario ────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id              SERIAL PRIMARY KEY,
    repuesto_id     INTEGER NOT NULL REFERENCES repuestos(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada','salida')),
    cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
    stock_anterior  INTEGER NOT NULL,
    stock_nuevo     INTEGER NOT NULL,
    motivo          VARCHAR(255),
    referencia      VARCHAR(100),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Trigger updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_usuarios') THEN
        CREATE TRIGGER set_updated_at_usuarios
            BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_repuestos') THEN
        CREATE TRIGGER set_updated_at_repuestos
            BEFORE UPDATE ON repuestos FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
END $$;

-- ── Indices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_repuestos_codigo ON repuestos(codigo);
CREATE INDEX IF NOT EXISTS idx_repuestos_nombre ON repuestos(nombre);
CREATE INDEX IF NOT EXISTS idx_mov_repuesto     ON movimientos_inventario(repuesto_id);
CREATE INDEX IF NOT EXISTS idx_mov_fecha        ON movimientos_inventario(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_email   ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol     ON usuarios(rol);

-- ── Seed: categorias ─────────────────────────────────────────
INSERT INTO categorias_repuesto (nombre, descripcion) VALUES
    ('Aceites y Lubricantes', 'Aceites de motor, caja y diferenciales'),
    ('Filtros',               'Filtros de aire, aceite y combustible'),
    ('Frenos',                'Pastillas, discos, liquido de frenos'),
    ('Suspension',            'Amortiguadores, rotulas, bujes'),
    ('Electrico',             'Baterias, alternadores, bujias'),
    ('Correas y Cadenas',     'Correas de distribucion y accesorios'),
    ('Consumibles',           'Materiales de uso diario del taller')
ON CONFLICT DO NOTHING;

-- ── Seed: usuario admin (password en seed.js) ───────────────
INSERT INTO usuarios (nombre, email, password, rol) VALUES
    ('Administrador SS SWAP', 'admin@ssswap.com',
     '$2b$10$PLACEHOLDER_REPLACED_BY_SEED', 'administrador')
ON CONFLICT (email) DO NOTHING;

-- ── Seed: repuestos de ejemplo ───────────────────────────────
INSERT INTO repuestos (codigo, nombre, descripcion, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, unidad_medida) VALUES
    ('ACE-5W30-1L',  'Aceite Motor 5W-30 Sintetico 1L',   'Aceite sintetico para motores modernos',  1,  8.50, 12.00, 24, 10, 'litro'),
    ('FIL-ACE-001',  'Filtro de Aceite Universal',          'Compatible Toyota/Hyundai',               2,  4.20,  7.00, 15,  5, 'unidad'),
    ('FRE-PAS-DEL',  'Pastillas de Freno Delanteras',       'Pastillas ceramicas eje delantero',       3, 18.00, 30.00,  8,  4, 'juego'),
    ('ELC-BUJ-NGK4', 'Bujias NGK BKR6E juego x4',          'Juego 4 bujias estandar',                 5, 12.00, 20.00, 20,  8, 'juego'),
    ('FIL-AIR-002',  'Filtro de Aire Panel Generico',       'Motores 1.4 a 2.0',                       2,  3.80,  6.50, 10,  4, 'unidad'),
    ('ACE-ATF-1L',   'Aceite de Caja ATF Dexron III 1L',   'Transmisiones automaticas',               1,  9.00, 14.00, 12,  5, 'litro'),
    ('SUS-AMO-DEL',  'Amortiguador Delantero Generico',     'Par delantero compatible multimarca',     4, 45.00, 75.00,  4,  2, 'par'),
    ('FRE-LIQ-500',  'Liquido de Frenos DOT4 500ml',       'Frenos hidraulicos',                      3,  5.50,  9.00, 18,  6, 'unidad')
ON CONFLICT (codigo) DO NOTHING;
