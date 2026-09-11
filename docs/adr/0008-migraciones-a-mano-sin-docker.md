# 0008. Migraciones escritas a mano, sin Docker, en un solo proyecto

Estado: aceptada, 2026-09-11. Reemplaza a [0007](0007-esquema-declarativo.md).

## Contexto

En esta máquina no hay Docker y no lo va a haber. El ADR 0007 asumía un stack local que no existe. Lo que se probó con el CLI 2.117.0 contra el proyecto remoto:

| Comando                                   | Sin Docker  | Nota                                                                    |
| ----------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `supabase db push`, `migration list`      | Anda        | Entra con un rol de login temporal que crea el CLI; no pide contraseña. |
| `supabase gen types --linked`             | Anda        | Va por la Management API.                                               |
| `supabase db lint --linked`               | Anda        |                                                                         |
| `supabase db query --linked`              | Anda        | SQL por la Management API. Útil para inspeccionar.                      |
| `supabase test db --linked`               | **No anda** | Se conecta, pero después busca la imagen de Docker de `pg_prove`.       |
| `supabase db dump`                        | **No anda** | Corre `pg_dump` en un contenedor: falla antes de conectarse.            |
| `db diff`, `db pull`, esquema declarativo | **No anda** | Levantan una shadow database en un contenedor.                          |

Además, el dueño decidió trabajar con **un solo proyecto**, que es producción: la base está vacía, el cliente es su hermano, y partir el setup en dos hoy no paga lo que cuesta. La integración de GitHub del proyecto quedó apagada a propósito, para que no aplique migraciones por su cuenta mientras se aplican con `db push`.

## Decisión

**Migraciones a mano.** Se escriben en `supabase/migrations/<timestamp>_<nombre>.sql`, chicas y pensadas para leerse: no hay un diff que las genere, así que la revisión humana del SQL es la red. Una migración aplicada no se edita nunca; un cambio es una migración nueva. Los `comment on` y los comentarios que explican una policy o un índice van en el SQL, que no tiene ADR al lado.

**El flujo, siempre en este orden:**

1. Escribir la migración.
2. `pnpm --filter @maun/db db:ensayo`: abre una transacción contra la base real, aplica las migraciones pendientes, corre toda la suite de pgTAP y hace **rollback siempre**. Es el reemplazo de la shadow database: la migración se prueba contra el mismo Postgres, con los mismos roles y extensiones, sin dejar nada.
3. Si la migración es destructiva y toca una tabla con datos, **se frena y se consulta al dueño** antes de seguir (ver abajo).
4. `supabase db push`.
5. `pnpm --filter @maun/db gen:types` y `pnpm --filter @maun/db db:esquema`, y se commitean los dos archivos generados.
6. `supabase db advisors --linked` y `pnpm verify`.

**pgTAP con un runner propio.** Como `supabase test db` necesita Docker, la suite la corre un test de Vitest en `packages/db` que se conecta con `pg` (node-postgres) al pooler del proyecto. Por cada archivo de `supabase/tests/` abre una transacción, ejecuta `_preludio.sql` (pgTAP y los helpers de identidad), ejecuta el archivo y hace rollback, pase lo que pase. Los archivos no pueden controlar la transacción: el runner rechaza `begin`, `commit`, `rollback` y parecidos antes de ejecutar, y después compara el id de transacción del principio y del final para detectar un commit que se haya colado. Está dentro de `pnpm verify` y no depende de nada instalado en el sistema.

**Snapshot del esquema.** `supabase db dump` no anda, así que `pnpm --filter @maun/db db:esquema` lee el catálogo de Postgres y escribe `supabase/esquema.sql`: tablas, columnas, constraints, índices, triggers, policies, grants, vistas y funciones de `public` y `private`, en orden determinístico. No se aplica: es la vista del estado final. Un test de `pnpm verify` lo compara contra la base viva y falla si difieren. Así se detecta tanto un `db push` sin snapshot regenerado como un cambio hecho desde el dashboard.

**Condiciones de trabajar contra producción**, pedidas por el dueño:

- Los tests corren siempre dentro de una transacción que termina en rollback. Lo garantiza el runner, no la disciplina de quien escribe el test.
- El seed vive en su propio household (`5eed0000-0000-7000-8000-000000000001`, todos sus ids empiezan con `5eed0000`). `supabase/seed-borrar.sql` borra ese household y nada más, con `where`. Nada de `truncate` ni de `delete` sin `where`.
- **Migración destructiva sobre una tabla con datos: se frena y se avisa.** Cuenta como destructiva: `drop` de tabla, columna, tipo o función que algo usa; achicar un tipo o un enum; agregar `not null` o un `check` a una columna existente; cualquier `update` o `delete` de datos; renombrar. Antes del `db push` se cuenta con `supabase db query --linked` si las tablas afectadas tienen filas.

**El CLI no depende de la sesión global.** El CLI guarda una sola sesión por máquina, y en esta máquina se trabaja también en otro proyecto con otra cuenta: la sesión se pisa cada vez que esa otra cuenta hace login. Por eso el repo usa su propio token. `supabase/.env` (ignorado por git) tiene `SUPABASE_ACCESS_TOKEN` de la cuenta dueña de la organización de maun, y todo comando del CLI se corre con `pnpm --filter @maun/db sb <comando>`, que carga ese token en el entorno del proceso antes de llamar a `supabase`. No se da por sentado que el CLI lea `supabase/.env` solo. Los scripts que llaman al CLI (`gen:types`) hacen lo mismo.

**Conexión directa verificada.** Los scripts y los tests se conectan con `pg` al pooler usando `SUPABASE_DB_PASSWORD` del mismo archivo, con TLS verificado contra la raíz de Supabase fijada en el repo (ver "Raíz TLS").

## Qué se pierde y cómo se compensa

- **Una sola vista del estado final.** Con el esquema declarativo, `supabase/schemas/` era el lugar donde leer el esquema completo. Ahora ese lugar es `supabase/esquema.sql`: generado desde la base, no escrito a mano, y verificado en cada `pnpm verify`.
- **El diff automático.** Nadie genera la migración: se escribe. Se compensa con migraciones chicas y con el ensayo en transacción, que corre la suite completa contra lo que la migración deja.
- **Un entorno aislado.** No hay base local ni proyecto de dev: los tests corren contra producción. Se compensa con el rollback obligatorio y con que la suite crea sus propias identidades y datos dentro de la transacción. Mientras dura un test, las filas que toca quedan bloqueadas unos milisegundos.

## Raíz TLS

El pooler presenta una cadena firmada por una CA privada de Supabase, que el store de certificados de Node no reconoce. Con `rejectUnauthorized: false` cualquiera en la misma red podía hacerse pasar por la base y quedarse con la contraseña de `postgres`. Por eso la raíz está fijada en `packages/db/certs/supabase-root-2021-ca.crt` y la conexión la exige.

- **Qué es:** `Supabase Root 2021 CA`, SHA-256 `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`. Se verificó el 2026-09-11 por dos caminos independientes: la que presenta el pooler y la que publica Supabase (`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`, que es la misma que se baja del dashboard en Database → Settings → SSL Configuration).
- **Cuándo vence:** el **2031-04-26**. Supabase la puede rotar antes, sin aviso a este repo.
- **Qué pasa si rota:** todo lo que se conecta con `pg` falla con un error de verificación de certificado (`self-signed certificate in certificate chain` o `unable to get local issuer certificate`). Eso incluye los tests de `pnpm verify`, el ensayo, el seed y el snapshot. La app no se ve afectada: habla con la API por HTTPS con certificados públicos. El CLI tampoco.
- **Aviso previo:** un test de `pnpm verify` (`tests/runner.test.ts`) falla cuando faltan menos de 90 días para el vencimiento.
- **Cómo se renueva:**
  1. `pnpm --filter @maun/db db:ca` muestra la cadena que presenta hoy el pooler y dice si la raíz fijada sigue en ella.
  2. Bajar la raíz nueva del dashboard (o de la URL de arriba) y comparar su SHA-256 con la raíz que muestra `db:ca`. Tienen que coincidir por los dos caminos: nunca se confía en un certificado que llegó solo por la conexión que se quiere proteger.
  3. Reemplazar el archivo de `packages/db/certs/`, actualizar `CA_DE_SUPABASE` en `scripts/conexion.ts` si cambia el nombre, y actualizar esta sección.
  4. Nunca volver a `rejectUnauthorized: false`, ni siquiera por un rato.

## Riesgos conocidos

- **Default privileges de la plataforma.** En `public`, el rol `postgres` tiene default privileges que dan todo a `anon`, `authenticated` y `service_role` sobre cada tabla, vista, secuencia y función nueva, aunque "Automatically expose new tables" esté apagado. Cada migración revoca en la misma sentencia de alta lo que no corresponde, y `00_estructura.sql` falla si `anon` termina con algún privilegio. `service_role` conserva sus grants: saltea RLS de todas formas y la app no lo usa.
- **Funciones de la plataforma en `public`.** "Enable automatic RLS" instala `public.rls_auto_enable()`, un event trigger que activa RLS en toda tabla nueva. Los chequeos de funciones y el snapshot excluyen las funciones que devuelven `event_trigger`: Postgres no deja llamarlas por fuera de un event trigger.

- **El plan Free no incluye backups.** Hoy no hay nada que perder. **Esta decisión se revisa cuando haya datos reales**, antes de que el taller cargue su primer mes. Salidas: pasar a plan Pro (backups diarios), sumar un segundo proyecto de dev para dejar de probar contra producción, o un export periódico de los datos del household con un script de Node (no con `pg_dump`, que acá necesita Docker).
- Un error en una migración se descubre en producción si el ensayo no lo cubre. Por eso toda tabla nueva llega con sus tests, y la suite estructural (`00_estructura.sql`) exige RLS, policies, grants e índices para cualquier tabla, incluso las que se agreguen después.

## Alternativas descartadas

- **Dos proyectos, dev y producción.** Es lo correcto cuando hay datos que proteger; hoy la base está vacía. Se retoma junto con los backups.
- **Instalar Docker.** No está disponible en esta máquina.
- **`supabase test db`.** Necesita Docker para `pg_prove`. Además deja en cada archivo la responsabilidad de hacer rollback.
- **Seguir con el esquema declarativo y escribir el diff a mano.** Serían dos fuentes de verdad que nadie mantiene sincronizadas.
