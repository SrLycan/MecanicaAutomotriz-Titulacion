# SS SWAP — Procedimiento de recuperación ante fallos

> Regla de oro: **nunca se restaura sobre producción de forma automática ni "por si acaso"**.
> Primero se restaura en una base nueva, se revisa, y solo entonces se decide.

## 0. Qué hay respaldado
Cada respaldo (`npm run respaldo`, automático o desde **Plataforma › Respaldos**) genera en
`BACKUP_DIR` (por defecto `respaldos/`, fuera de git):

| Archivo | Contenido |
|---|---|
| `ssswap_<fecha>_<tipo>.dump` (pg_dump) o `.json.gz` (motor json) | Base de datos completa, todas las empresas |
| `..._uploads.tar.gz` | Carpeta `backend/uploads/` (fotos de perfil, logos, adjuntos) |
| `.manifest.json` | Versión del sistema, commit de git, fecha, SHA-256 de cada archivo y filas por tabla |
| `.enc` (si hay `BACKUP_ENCRYPTION_KEY`) | Los mismos archivos cifrados con AES-256-GCM |

Cada respaldo queda en `respaldos_registro` (éxito/error, tamaño, duración) y visible en la plataforma.
La retención borra solo archivos `ssswap_*` más viejos que `BACKUP_RETENTION_DAYS` y **siempre conserva
los `BACKUP_MIN_KEEP` más recientes**.

**Guarda la `BACKUP_ENCRYPTION_KEY` fuera del servidor** (gestor de contraseñas). Sin ella, un respaldo
cifrado no se puede abrir. Copia periódicamente la carpeta de respaldos a otro disco o nube.

## 1. Detectar y contener
1. Identifica qué falló: ¿app caída, datos borrados/dañados, servidor perdido, credenciales filtradas?
2. Si hay datos dañándose, **detén la escritura**: apaga el backend o pon el sitio en mantenimiento.
3. Anota la hora aproximada del incidente (sirve para elegir el respaldo correcto).
4. Revisa **Plataforma › Sistema** (errores recientes, migraciones) y **Plataforma › Auditoría**.

## 2. Respaldar el estado actual (aunque esté dañado)
```bash
npm run respaldo -- --tipo previo_restauracion
```
Así siempre se puede volver atrás si la restauración empeora algo.

## 3. Elegir el respaldo
```bash
npm run respaldo -- --listar
```
Elige el último respaldo **anterior** al incidente y con estado éxito.

## 4. Restaurar en una base NUEVA (recomendado)
```bash
npm run restaurar -- --clave ssswap_AAAAMMDD-HHMMSS_tipo --destino ssswap_restaurada
```
El script verifica el SHA-256 del manifiesto, descifra si hace falta, restaura, compara las filas por
tabla con el manifiesto, busca registros huérfanos en todas las llaves foráneas y comprueba que RLS
siga activo. Si algo no cuadra, lo informa y no se debe usar esa base.

## 5. Revisar la base restaurada
- Arranca un backend de prueba con `DB_NAME=ssswap_restaurada` en otro puerto e inicia sesión.
- Confirma por empresa: clientes, órdenes, inventario, proformas, cuentas y caja.
- Comprueba que cada empresa solo ve lo suyo.

## 6. Pasar a producción (solo con autorización del responsable)
Opción A (preferida): apuntar el `.env` de la aplicación a `ssswap_restaurada` y reiniciar.

Opción B: sobrescribir la base de la aplicación. El script exige `--confirmar-produccion`, escribir a
mano el nombre de la base, y hace antes un respaldo `previo_restauracion` (si ese respaldo falla, no
restaura nada):
```bash
npm run restaurar -- --clave ssswap_AAAAMMDD-HHMMSS_tipo --destino "nombre_de_la_base" --confirmar-produccion
```

## 7. Restaurar los archivos subidos
El script de restauración **solo restaura la base de datos**. Los archivos se recuperan a mano:
copia antes la carpeta `backend/uploads/` actual y luego, desde `backend/`:
```bash
tar -xzf ../respaldos/ssswap_AAAAMMDD-HHMMSS_tipo_uploads.tar.gz
```
(Si el respaldo está cifrado `.enc`, primero hay que descifrarlo con la misma `BACKUP_ENCRYPTION_KEY`.)

## 8. Verificar después de restaurar
- `npm run respaldo:probar` debe terminar bien.
- Inicia sesión con una cuenta de cada empresa y revisa la web pública.
- Revisa **Plataforma › Sistema** (sin errores nuevos) y **Plataforma › Respaldos**.

## 9. Si el problema fueron credenciales filtradas
- Cambia `JWT_SECRET` (cierra todas las sesiones), la contraseña de la BD y las claves de APIs.
- Restablece el acceso de las cuentas afectadas desde Usuarios / Plataforma.
- Revisa **Auditoría** para ver qué se hizo con esas cuentas.

## 10. Supabase
Supabase no permite crear bases nuevas en el mismo proyecto: para la prueba de restauración apunta
`RESTORE_TEST_HOST/PORT/USER/PASSWORD` a un PostgreSQL local o de pruebas. Los respaldos propios de
Supabase (panel *Database › Backups*) son una capa adicional, no un reemplazo.

## 11. Después del incidente
Registra qué pasó, cuándo, qué respaldo se usó, qué datos se perdieron (entre el respaldo y el
incidente) y qué se cambia para que no se repita.

## Prueba periódica (al menos una vez al mes)
```bash
npm run respaldo:probar
```
Restaura el último respaldo en la base temporal `ssswap_prueba_restauracion`, verifica conteos,
huérfanos y RLS, y la borra. Nunca toca la base de producción. El resultado queda en
`respaldos_registro` y en **Plataforma › Respaldos**.

## Sprint 23 (facturación electrónica y documentos legales)
- La migración es aditiva. Para volver al código anterior basta con desplegar el ZIP previo: el código viejo ignora las tablas nuevas.
- **No borre** `comprobantes_electronicos`, `comprobante_eventos` ni `aceptaciones_legales` si ya hay facturas autorizadas o aceptaciones reales. Son evidencia tributaria y contractual que debe conservarse.
- El certificado `.p12` está cifrado con `SRI_CERT_KEY`. Si restaura la base en otro servidor, configure la misma llave; si no, cargue de nuevo el certificado.

