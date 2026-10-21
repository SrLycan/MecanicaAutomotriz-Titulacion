-- ============================================================
-- SS SWAP - LIMPIEZA TOTAL DE DATOS (Supabase, SQL Editor)
--
-- Deja la base "como nueva" SIN tocar la estructura (tablas, vistas,
-- funciones, RLS y triggers siguen iguales).
--
-- SE CONSERVA:
--   * Las cuentas con rol superadministrador y sus permisos.
--   * La empresa propia de cada superadministrador (p. ej. SS SWAP) con
--     sus datos comerciales, logo, sucursales, configuracion SRI y puntos
--     de emision, tipos de servicio, categorias de repuesto, cuentas de
--     dinero (Caja/Banco) y documentos legales.
--   * Catalogos globales: cat_*, permisos_catalogo, plataforma_proveedor y
--     migraciones_registro (para que las migraciones no se repitan).
--
-- SE BORRA (y los ids vuelven a empezar en 1):
--   clientes, vehiculos, citas, ordenes, proformas, inventario (repuestos y
--   movimientos), proveedores, compras, facturas de compra, caja, dinero,
--   cuentas por cobrar, pagos, nomina, comprobantes electronicos,
--   auditoria, errores, respaldos registrados, accesos de soporte,
--   contratos y aceptaciones legales; todos los usuarios que NO son
--   superadministrador y todas las demas empresas.
--   Los contadores (numero de proforma, referencia, secuenciales SRI)
--   vuelven a 0.
--
-- ANTES DE CORRERLO: descarga un respaldo en Supabase
--   (Database > Backups) o con:  npm run respaldo
-- Todo va en UNA transaccion: si algo falla no se borra nada.
-- Probado primero en una copia de la base local.
-- ============================================================

BEGIN;

-- ── 0. Comprobaciones de seguridad ──
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE rol = 'superadministrador') THEN
        RAISE EXCEPTION 'No hay ningun superadministrador: no se limpia (te quedarias sin acceso).';
    END IF;
    -- Un comprobante AUTORIZADO en produccion ya existe en el SRI: reiniciar
    -- su numeracion haria que el SRI rechace las siguientes facturas.
    IF EXISTS (SELECT 1 FROM comprobantes_electronicos WHERE ambiente = 2 AND estado = 'autorizado') THEN
        RAISE EXCEPTION 'Hay facturas electronicas AUTORIZADAS en produccion. No se limpia: esas son facturas reales.';
    END IF;
END $$;

-- ── 1. Vaciar todas las tablas de movimiento ──
-- TRUNCATE (sin CASCADE) vacia todo de golpe y reinicia los ids. Si alguna
-- otra tabla dependiera de estas, falla y no se borra nada.
TRUNCATE TABLE
    accesos_soporte, aceptaciones_legales, auditoria_seguridad, errores_sistema, respaldos_registro,
    notificaciones_legales, contratos_empresa,
    citas, solicitudes_producto, ordenes_historial, ordenes_trabajo,
    proforma_items, proforma_zonas_danadas, proformas,
    cuentas_cobrar, pagos_cliente,
    comprobante_eventos, comprobante_detalles, comprobantes_electronicos,
    facturas_compra_detalles, facturas_compra,
    compras_proveedor_items, compras_proveedor, gastos_proveedor, movimientos_financieros_proveedor,
    repuestos_codigos_proveedor, proveedores_contactos, proveedores,
    movimientos_inventario, repuestos,
    caja_movimientos, caja_sesiones, movimientos_dinero,
    pagos_empleados, empleados_perfil,
    vehiculos, clientes
RESTART IDENTITY;

-- ── 2. Usuarios: solo quedan los superadministradores ──
-- (sus permisos se conservan; los de los demas se borran primero)
DELETE FROM usuario_permisos WHERE usuario_id IN (SELECT id FROM usuarios WHERE rol <> 'superadministrador');
UPDATE usuario_permisos SET otorgado_por = NULL
 WHERE otorgado_por IN (SELECT id FROM usuarios WHERE rol <> 'superadministrador');
DELETE FROM usuarios WHERE rol <> 'superadministrador';

-- ── 3. Empresas: solo queda la empresa propia de los superadministradores ──
CREATE TEMP TABLE _empresas_conservadas ON COMMIT DROP AS
    SELECT DISTINCT empresa_id AS id FROM usuarios WHERE empresa_id IS NOT NULL;

ALTER TABLE documento_legal_versiones DISABLE TRIGGER trg_proteger_version_legal;
DELETE FROM documento_legal_versiones WHERE empresa_id IS NOT NULL AND empresa_id NOT IN (SELECT id FROM _empresas_conservadas);
ALTER TABLE documento_legal_versiones ENABLE TRIGGER trg_proteger_version_legal;
DELETE FROM documentos_legales   WHERE empresa_id IS NOT NULL AND empresa_id NOT IN (SELECT id FROM _empresas_conservadas);
DELETE FROM sri_puntos_emision   WHERE empresa_id NOT IN (SELECT id FROM _empresas_conservadas);
DELETE FROM sri_configuracion    WHERE empresa_id NOT IN (SELECT id FROM _empresas_conservadas);
DELETE FROM cuentas_dinero       WHERE empresa_id NOT IN (SELECT id FROM _empresas_conservadas);
DELETE FROM categorias_repuesto  WHERE empresa_id NOT IN (SELECT id FROM _empresas_conservadas);
DELETE FROM tipos_servicio       WHERE empresa_id NOT IN (SELECT id FROM _empresas_conservadas);
DELETE FROM sucursales           WHERE empresa_id NOT IN (SELECT id FROM _empresas_conservadas);
DELETE FROM empresa_secuencias   WHERE empresa_id NOT IN (SELECT id FROM _empresas_conservadas);
DELETE FROM usuario_permisos     WHERE empresa_id NOT IN (SELECT id FROM _empresas_conservadas);
DELETE FROM empresas             WHERE id NOT IN (SELECT id FROM _empresas_conservadas);

-- ── 4. Contadores en cero (proformas, referencias, secuenciales SRI) ──
UPDATE empresa_secuencias SET valor = 0;
SELECT setval(c.oid, 1, false)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'S'
   AND c.relname IN ('proformas_numero_seq', 'repuestos_referencia_seq');

-- ── 5. Resumen: lo que queda ──
SELECT 'empresas' AS tabla, COUNT(*) AS filas FROM empresas
UNION ALL SELECT 'usuarios (superadmin)', COUNT(*) FROM usuarios
UNION ALL SELECT 'sucursales', COUNT(*) FROM sucursales
UNION ALL SELECT 'clientes', COUNT(*) FROM clientes
UNION ALL SELECT 'repuestos', COUNT(*) FROM repuestos
UNION ALL SELECT 'proformas', COUNT(*) FROM proformas
UNION ALL SELECT 'caja_sesiones', COUNT(*) FROM caja_sesiones;

COMMIT;
