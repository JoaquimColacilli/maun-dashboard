# @maun/db

Tipos generados de Postgres (`src/database.types.ts`), `crearClienteMaun` (la factory del cliente de Supabase), la réplica del household que usa la app, las llamadas de la agenda y los avisos, los tests de la función de borde `supabase/functions/avisos`, y las herramientas de base en `scripts/`: el runner de pgTAP, el ensayo de migraciones, el snapshot del esquema, la generación de tipos, el seed, el alta de households y la migración de una sola vez desde el sistema viejo (`db:migrar`).

## El cliente

`crearClienteMaun` usa PKCE, persiste la sesión en `maun.sesion` y prende las passkeys de Supabase con `auth: { experimental: { passkey: true } }` (ADR 0023). Son beta y la API puede cambiar sin aviso; sin el flag, todos los métodos de passkeys tiran. Las passkeys se activan además en el proyecto (Authentication → Passkeys, con el RP ID en dominio pelado).

## La réplica del household

`src/replica.ts` es la copia local del household y la lógica que la mantiene al día (ADR 0010). Es pura y sin dependencias: se testea con `src/replica.test.ts`, sin base.

- `leerLote()` valida lo que devuelven `bootstrap()` y `delta()` antes de creerle: id, version y deleted_at por fila.
- `aplicarLote(replica, lote, modo)` reemplaza entera con `reconcile` y mezcla con `delta`. En la mezcla gana la fila que llega salvo que traiga una `version` más vieja, que es lo que produce el solape de cinco minutos.
- `aplicarFilaLocal` y `quitarFilaLocal` son la aplicación optimista de la cola de salida y su vuelta atrás cuando la base rechaza.
- `necesitaReconcile(replica, ahora)` decide entre `bootstrap()` y `delta()`: reconcile completo al entrar y cada 24 horas.
- `filaPorId(replica, tabla, id)` es la lectura puntual, y `faltaConfigurar(ajustes)` responde si el taller todavía está en cero: es lo que decide el estado vacío de la primera configuración (ADR 0012).
- `src/sincronizacion.ts` son las llamadas (`traerBootstrap`, `traerDelta`, `guardarMovimiento`, `guardarAjustes`, `guardarNombreDelTaller`, `guardarProyecto`) y `src/errores.ts` clasifica los rechazos: los `MNxxx` y el `42501` no se reintentan. Las ediciones mandan solo las columnas que cambiaron; `COLUMNAS_DE_AJUSTES` es la lista con grant, y sale del tipo generado.
- Un fallo de `fetch` no llega como excepción: PostgREST lo devuelve como un objeto con `code` vacío. `debeReintentarse` lee ese `code` vacío como «no hubo respuesta de la base» (red, timeout o un 5xx) y lo reintenta.
- La conversión de `bigint` a `Money` vive en `src/dinero.ts`, en un solo lugar.
- `src/vistas.ts` traduce la réplica para el dominio. `totalesPorProyecto` vive ahí y no en una pantalla: son los dos números que la app le manda a `cobrar_proyecto`, y si divergen de la suma de la base el cobro rebota con `MN006`. El comparador los verifica por el camino real (ADR 0015).
- `guardarProyecto` llama al RPC `guardar_proyecto`, que guarda el proyecto con sus pagos y sus gastos en una transacción. Es la única forma de escribir pagos y gastos: no hay mutaciones sueltas para ellos (ADR 0015).
- `liquidarProyecto` y `revertirLiquidacion` son las cuatro operaciones que tocan la distribución congelada. **El pedido lleva el acumulado del mes que vio la app** (`sueldoPrevioCentavos` / `fijosPrevioCentavos`): si no es el de la base, la liquidación vuelve **ajustada** —congelada con el acumulado del servidor— en vez de rechazada con `MN006`. Se detecta comparando `dist_sueldo_previo_centavos` de la fila que vuelve contra lo que se mandó; la respuesta no trae marca (ADR 0016).

## La agenda y los avisos (ADR 0034 y 0036)

- `src/agenda.ts` convierte filas en los datos del dominio: `datosDeLaAgendaDeLaReplica` para la app, `datosDeLaAgenda` para la función de borde. Es la misma función a propósito: lo que muestra la agenda y lo que se avisa no pueden divergir.
- `src/avisos.ts` son las llamadas de los avisos: las funciones de suscripción y preferencias, y la función de borde (`GET` y `/probar`). Valida lo que vuelve antes de creerle (`leerEstadoDeLosAvisos`).
- **Las suscripciones y las preferencias viven en `private`, sin `household_id` y fuera de la réplica.** `00_estructura.sql` no las cubre; las cubren `17_suscripciones_de_avisos.sql`, `18_envio_de_avisos.sql` y `19_trabajo_de_los_avisos.sql`.
- **La función de borde vive en `supabase/functions/avisos`** y corre en Deno. `deno.json` apunta `@maun/domain` al código fuente y `web-push` a `npm:web-push@3.6.7`; `deno.lock` se commitea. Queda fuera del `tsconfig` raíz. `tests/funciones.test.ts` corre `deno check` y `deno test` con el Deno del devDependency, así que entra en `pnpm verify`.
- Deploy: `pnpm --filter @maun/db sb functions deploy avisos --use-api --no-verify-jwt`. `verify_jwt = false` porque el trabajo programado entra con su secreto y `/probar` valida el token del usuario por su cuenta.
- **Secretos, nunca en el repo.** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` y `AVISOS_SECRETO` en los secretos de la función (`sb secrets set --env-file <archivo fuera del repo>`); `avisos_url` y `avisos_secreto` en Vault, que los lee `private.pedir_los_avisos()`. Rotar las VAPID deja sin avisos a todos los dispositivos hasta que cada uno vuelva a activarlos.
- **El trabajo `avisos-de-la-manana`** (pg_cron, cada 15 minutos) llama a `private.pedir_los_avisos()`. A quién le toca lo decide `private.avisos_por_mandar(ahora)` con la zona de cada persona, desde su hora y durante tres horas, una vez por día local.

## El alta de una cuenta

El taller se crea solo. Un trigger sobre `auth.users` llama a `private.crear_taller_del_usuario()` cuando el mail queda confirmado, y esa función deja household, membresía de titular y ajustes en cero **en la misma transacción que la cuenta**: si falla, falla el alta entera (ADR 0012). Dos cosas que hay que tener presentes al tocarla:

- **Un error ahí adentro rompe todos los registros, no uno.** Nada de lo que venga de afuera entra sin pasar por una constante o una validación: el nombre del taller es fijo justamente por eso. `supabase/tests/12_alta_de_cuenta.sql` fuerza un fallo y verifica que no quede ni cuenta ni household huérfano.
- **`authenticated` no tiene insert ni update sobre `household_members`.** Las membresías las crea únicamente el trigger; de `households` el usuario solo escribe `nombre`.

El script queda para diagnóstico y reparación, y es el punto de extensión de las invitaciones:

```sh
pnpm --filter @maun/db db:household --listar
pnpm --filter @maun/db db:household --email <mail> --nombre "<taller>"
```

`--listar` muestra los usuarios de Auth, si confirmaron el mail y a qué household pertenecen. El alta es idempotente: si la cuenta ya tiene household, avisa y no cambia nada.

El alta mira también las membresías borradas. Si a la cuenta le revocaron el acceso, no crea otro household: el viejo quedaría con datos y sin ningún miembro vivo, invisible por RLS. Avisa y la reparación queda a mano.

## La migración del sistema viejo (ADR 0017)

`scripts/migrar.ts` trae los datos del HTML viejo a un household vacío, una sola vez. La lógica vive en `scripts/migracion/` (entrada, clientes, plan, escritura e informe) y se prueba en `tests/migracion.test.ts`, en rollback, con el JSON armado a mano de `tests/datos/sistema-viejo.json`.

1. En la PC del taller, con el HTML abierto, en la consola del navegador:

   ```js
   copy(
     JSON.stringify({
       maun3_p: localStorage.getItem('maun3_p'),
       maun3_m: localStorage.getItem('maun3_m'),
       maun3_c: localStorage.getItem('maun3_c'),
     }),
   );
   ```

   Pegalo en un archivo **fuera del repo**. Las tres claves pueden quedar como texto: el script las parsea. También lee el backup con `proyectos`, `movimientos` y `config`. Una clave que falta corta como dato sucio: no se lee como vacía (ADR 0017).

2. Anotá los cuatro saldos que muestra Finanzas ese día, tal cual, DIEZMO con su signo.
3. El ensayo, que no escribe nada: `pnpm --filter @maun/db db:migrar --archivo <json> --household <id> --hogar=<saldo> --maun=<saldo> --diezmo=<saldo> --cocos=<saldo>`. Los saldos van con `=` para que uno negativo no se lea como otra opción.
4. Leé el informe, que queda al lado del JSON. Si un grupo de clientes está mal, `--separar "<nombre exacto>"`. Si los insumos de un proyecto son anotaciones y no gastos, `--insumos-como-notas <id viejo>`: pasan a las notas del proyecto. Un presupuestado con presupuesto de $1 entra solo sin presupuesto y a presupuestar. Si el dueño ya tiene ajustes o un saldo real de Cocos que no estaban en el sistema viejo, `--sueldo-despues`, `--fijos-despues`, `--meta-cocos-despues`, `--tasa-cocos-despues` (los cuatro juntos) y `--cocos-despues=<saldo real>` los aplican al final de la misma transacción: Cocos se ajusta por la diferencia contra el saldo que quedó, no por un importe. Si hay datos sucios, se corrigen en el JSON: el script no los arregla solo.
5. La misma línea con `--escribir`: pregunta por los clientes antes de tocar nada, muestra todo y pide `confirmo` antes del `commit`.

Lo que no hay que romper:

- **Escribe como el titular del household**, con el rol `authenticated` y sus claims, no como el dueño de la base. Pasa por la RLS, los grants, los triggers y `cobrar_proyecto`. No lo cambies por `update` directos como los del seed: es la puerta de atrás que el ADR 0017 descarta.
- **Un cobrado entra como `entregado` y se cobra con `cobrar_proyecto`.** El check `proyectos_liquidado_con_distribucion` no deja un cobrado sin distribución, y la guarda de pagos no deja cargarle pagos a un proyecto liquidado.
- **Se niega sobre un household con cualquier fila**, borradas incluidas, y si el titular pertenece a más de un household: `household_actual()` elige con `limit 1`.
- El informe y el JSON tienen datos reales del taller y no se commitean. `.gitignore` ignora `informe-migracion-*.md`.
- Los tests corren `migrar()`, no la CLI: las preguntas de la terminal y el `commit` final no se prueban, porque escribirían en producción.

## Supabase CLI

No es una dependencia del repo: el paquete de npm baja un binario en el postinstall en cada instalación, incluidos los deploys de Netlify. Se instala en la máquina:

- Windows: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` y `scoop install supabase`
- macOS/Linux: `brew install supabase/tap/supabase`

Versión fijada: **2.117.0**. No hay CI que la imponga: mantené la local en esa versión (`supabase --version`) y, si se sube, actualizá este número en el mismo PR.

**No hay Docker** (ADR 0008). Andan `db push`, `migration list`, `gen types --linked` y `db lint --linked`: entran con un rol de login temporal, sin contraseña. No andan `start`, `db diff`, `db pull`, `db reset`, `db dump` ni `test db`.

**El CLI se corre con `pnpm --filter @maun/db sb <comando>`** (por ejemplo `sb db push`, `sb migration list --linked`, `sb db advisors --linked`). El wrapper carga `SUPABASE_ACCESS_TOKEN` de `supabase/.env` en el entorno del proceso: la sesión global de la máquina se pisa con otra cuenta y no se usa. Si aparece un 403, el token del repo dejó de valer: avisale al usuario.

## Un solo proyecto, y es producción

- Los tests corren siempre en una transacción que termina en rollback. Lo garantiza el runner: un archivo de `supabase/tests/` no puede tener `begin`, `commit` ni `rollback`.
- El seed vive en el household `5eed0000-0000-7000-8000-000000000001`. `db:seed` lo carga (y antes lo borra), `db:seed:borrar` lo borra. Nada de `truncate` ni de `delete` sin `where`.
- **Antes de aplicar una migración destructiva sobre una tabla con datos, se frena y se consulta al dueño.** Destructiva: `drop`, renombrar, achicar un tipo o un enum, agregar `not null` o `check` a una columna existente, `update` o `delete` de datos.

## Cambiar el esquema

1. Escribí una migración nueva en `supabase/migrations/<AAAAMMDDhhmmss>_<nombre>.sql`. Chica y legible: nadie la genera, así que la revisión del SQL es la red. Una migración aplicada no se edita nunca.
2. Toda tabla nueva llega con RLS, sus policies (roles en `to`), grants explícitos por columna, el trigger `private.mantener_metadatos()`, `household_id`, un índice `(household_id, updated_at)`, índices para sus foreign keys y sus tests. `00_estructura.sql` falla si falta algo de eso. Si la tabla es sincronizable, sumala a `bootstrap()`, `delta()` y a `tables_are` en ese mismo test.
3. `pnpm --filter @maun/db db:ensayo` aplica las migraciones pendientes, corre toda la suite de pgTAP y compara `@maun/domain` contra sus gemelas de SQL (`scripts/comparacion.ts`), todo en una transacción contra la base real que termina en rollback. Corre con `node --conditions=@maun/source` para leer el dominio desde su código fuente. Tiene dos variantes:
   - **`-- --seed`** carga también el seed antes de los tests.
   - **`-- --recargar-seed`** borra el seed antes de migrar y lo recarga después, y verifica cada liquidación del seed contra el dominio. Es el ensayo de la secuencia `db:seed:borrar` → `db push` → `db:seed`, la que se usa cuando una migración agrega invariantes que el seed viejo no cumple. Esa secuencia solo vale mientras no haya más datos que el seed.
4. `pnpm --filter @maun/db sb db push`.
5. `pnpm --filter @maun/db gen:types` y `pnpm --filter @maun/db db:esquema`. Commiteá `src/database.types.ts` y `supabase/esquema.sql`: ninguno de los dos se edita a mano.
6. `pnpm --filter @maun/db sb db advisors --linked` y `pnpm verify`.

`supabase/esquema.sql` es la vista del estado final del esquema: `public`, `private` y **los triggers sobre `auth.users`**, que no son nuestra tabla pero sostienen el alta de cuentas. `tests/esquema.test.ts` lo compara contra la base viva: si falla, o faltó el paso 5 o alguien cambió la base por fuera del repo. Nunca se toca el esquema desde el SQL Editor del dashboard.

## Tests de Vitest que tocan la base

- `tests/pgtap.test.ts`: la suite de pgTAP, un archivo por transacción, siempre en rollback.
- `tests/esquema.test.ts`: `supabase/esquema.sql` contra la base viva.
- `tests/dominio-vs-sql.test.ts`: la misma comparación que corre el ensayo (`scripts/comparacion.ts`), ahora contra la base ya migrada, todo en rollback. Cubre:
  - la cascada, los topes, los rangos, los estados, las transiciones, las liquidaciones y las reversiones;
  - las liquidaciones reales paso a paso, calculadas como las calcula la app. Un paso con `sinVer` son las claves de los proyectos cuya liquidación la app todavía no replicó: manda el acumulado del mes sin contarlas, y lo que la base congela se compara igual contra el dominio con el mes completo, que es como se verifica el ajuste (ADR 0016);
  - cada liquidación del seed;
  - **el libro mayor**: los asientos de la vista contra `asientosDelLibro`, como multiconjunto, y los cuatro saldos por tesoro. El lado de TypeScript lee por el camino real (`bootstrap()` → réplica → `datosDelLibro`), así que el `where` de la vista no está copiado en el comparador. Corre sobre los escenarios del libro y también sobre los de liquidación, y sobre el seed (ADR 0014).
    **Los archivos de test corren de a uno** (`fileParallelism: false` en `vitest.config.ts`). Hay una sola base, y el comparador y los tests de concurrencia trabajan los dos sobre el household del seed: en paralelo, la liquidación de uno queda esperando un lock del otro y `una liquidación espera a una edición de los ajustes en curso` falla con un pid que no es el que esperaba. No es flakiness de timing, es la misma fila desde dos archivos, y aparece recién cuando el comparador crece lo suficiente como para solaparse. Los tests de concurrencia abren sus propias conexiones, así que no pierden nada.

- `tests/concurrencia.test.ts`: conexiones reales, y todo lo que escriben termina en rollback. Prueban que:
  - la liquidación toma `for update` sobre el proyecto antes de leer pagos o gastos;
  - la guarda de un pago espera a la liquidación;
  - dos liquidaciones del mismo household se esperan en la fila de ajustes;
  - una liquidación espera a una edición de los ajustes.

  Cada test falla si falta el lock que prueba. Usan proyectos del seed (`5eed…020002` entregado, `5eed…020011` en contacto) como datos commiteados que las sesiones ven. Solo corren contra migraciones ya aplicadas: otra sesión no ve DDL sin commitear.

## Conexión

Los scripts y los tests se conectan con `pg` al pooler (`supabase/.temp/pooler-url`, lo escribe `supabase link`) usando `SUPABASE_DB_PASSWORD` de `supabase/.env`, que está en el `.gitignore`. `SUPABASE_DB_URL` en el entorno la reemplaza entera. Sin eso, `pnpm verify` falla con un mensaje que dice qué falta.

## RLS (ADR 0004)

- RLS activo en todas las tablas, sin excepción, con aislamiento por `household_id`.
- `(select auth.uid())`, nunca `auth.uid()` suelto.
- Helpers `security definer stable` en el schema `private`, que la API no expone. Pertenencia: `household_id = any (array(select private.user_household_ids()))`. No `in (select ...)`: en una policy no entra en el índice (`06_planes.sql` lo verifica).
- El `household_id` lo pone el default `private.household_actual()`: el cliente no tiene grant sobre esa columna.
- Índice sobre toda columna que aparezca en una policy. Cada policy nombra sus roles en `to`.
- Roles en `app_metadata` o en una tabla, nunca en `user_metadata`.
- Vistas sobre tablas protegidas con `security_invoker = true`.
- Postgres da `execute` a `public` en toda función nueva, y Supabase se lo da además a `anon` y a `authenticated` por default privileges: el revoke de una función de `public` tiene que nombrar a los tres (`from public, anon, authenticated`). `00_estructura.sql` lo verifica.

## Convenciones de SQL

- Plata en `bigint` con sufijo `_centavos`. Nada de `numeric` ni `float` para importes.
- `comment on table` y `comment on column` para todo lo que no sea obvio: es metadata real de la base.
- Un `check` que evalúa a null pasa. Si la condición puede dar null, envolvela en `coalesce(..., false)`.
- Los cuerpos de función van entre `$$`, no con `begin atomic`: el runner busca `begin`, `commit` y `rollback` sueltos, y el `end` de un `begin atomic` lo confundiría.
- Ninguna migración ni el seed controlan la transacción: el ensayo los corre todos en la suya y los rechaza si traen `begin` o `commit`.
- El ensayo corre todas las migraciones pendientes en una sola transacción: agregar un valor a un enum y usarlo en una migración posterior falla en el ensayo aunque `db push` ande. En ese caso, ensayá en dos tandas.
- `jsonb_to_recordset` castea todas las columnas de todas las filas antes de que el `where` filtre nada: una fila que solo necesita su id no puede viajar con un texto vacío en una columna `date`. Leé esas columnas como `text` y casteá donde se usan (ADR 0015).
- `insert ... on conflict (id) do update` evalúa los `check` de la tabla sobre la fila propuesta antes de resolver el conflicto: si el check depende de columnas que el upsert no manda, el alta y la edición van por separado (ADR 0015).
- Una guarda que lee otra fila para decidir (el proyecto de un pago, el cliente de un proyecto, los ajustes de una liquidación) la bloquea antes de leerla: sin eso, una operación concurrente pasa con el estado viejo. La liquidación bloquea el proyecto y después los ajustes, en ese orden.
- Rechazos de negocio con SQLSTATE de la clase `MN` (tabla en ADR 0010). Si el usuario puede hacer algo para destrabarlo, el `hint` lo dice. **El `detail` no llega nunca a la interfaz**: `rechazoDeLaBase` lee `code`, `message` y `hint`, y nada más. Desde el ADR 0016 la app traduce los `MN00x` por su cuenta (`shared/api/rechazos.ts`) y el texto del `raise` queda como respaldo de lo que no esté traducido.
- **Cambiarle la firma a una función expuesta es `drop` y `create`, no `create or replace`**: con una lista de argumentos distinta, `or replace` deja las dos y la llamada queda ambigua. Y el `drop` se lleva los grants, así que el `revoke`/`grant` se repite. Agregar parámetros **con default** es lo que hace el cambio retrocompatible: un bundle viejo servido por el service worker sigue llamando con los de antes.
- `supabase-js` devuelve `bigint` como `number` y los tipos generados lo tipan así: la conversión a `Money` (entero con brand, ADR 0002) se hace acá, en un solo lugar.
