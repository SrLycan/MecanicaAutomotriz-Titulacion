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
