-- ============================================================
-- SS SWAP - Sprint 29 para Supabase (SQL Editor)
-- Caja completa: cajero, declaracion por forma de pago, anulacion de
-- movimientos manuales, reapertura y permisos caja:eliminar / caja:reabrir.
-- Aditivo e idempotente: se puede correr mas de una vez.
-- Copia exacta del bloque Sprint 29 de backend/src/config/migrations.sql.
-- ============================================================

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
