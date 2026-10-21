-- Supabase: corrige el nombre comercial "SS Swap - SSarango Sosa" -> "SS Swap - Sarango Sosa"
-- en la empresa y en la copia guardada de sus proformas y ordenes de trabajo.
-- Se puede correr mas de una vez sin problema.
BEGIN;

UPDATE empresas
   SET nombre_comercial = REPLACE(nombre_comercial, 'SSarango Sosa', 'Sarango Sosa')
 WHERE nombre_comercial LIKE '%SSarango Sosa%';

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

COMMIT;

-- Verificacion: debe mostrar "SS Swap - Sarango Sosa Intercambio Inteligente"
SELECT nombre, nombre_comercial FROM empresas;
