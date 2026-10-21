-- ============================================================
-- SS SWAP - Rendimiento para Supabase (SQL Editor)
-- Indices de apoyo para las paginas principales (Proformas, Clientes,
-- Dashboard). Aditivo e idempotente: se puede correr mas de una vez.
-- Copia exacta del bloque "Rendimiento (2026-10-18)" de
-- backend/src/config/migrations.sql.
-- ============================================================

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
