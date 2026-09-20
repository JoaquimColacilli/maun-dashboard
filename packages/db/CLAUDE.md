# @maun/db

Tipos generados de Postgres (`src/database.types.ts`), `crearClienteMaun` (la factory del cliente de Supabase), la réplica del household que usa la app, las llamadas de la agenda, los avisos y la vista del cliente, los tests de la función de borde `supabase/functions/avisos`, y las herramientas de base en `scripts/`: el runner de pgTAP, el ensayo de migraciones, el snapshot del esquema, la generación de tipos, el seed, el alta de households y la migración de una sola vez desde el sistema viejo (`db:migrar`).

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
- `guardarProyecto` llama al RPC `guardar_proyecto`, que guarda el proyecto con sus pagos, sus gastos y sus **opciones de presupuesto** en una transacción. Es la única forma de escribir esas tres hijas: no hay mutaciones sueltas para ellas (ADR 0015 y 0043).
- **`p_opciones` lleva default `null`, que quiere decir «no toques las opciones».** Por eso la firma cambió con `drop` y `create` y no con `or replace`, y por eso un bundle viejo de tres argumentos sigue andando sin borrarlas (ADR 0043).
- **`p_necesidades` es la quinta, con el mismo default `null` y el mismo motivo** (ADR 0045). `public.necesidades` son los herrajes y las herramientas que hacen falta para un trabajo, con `tipo`, `nombre`, `cantidad` opcional y `listo`. Hija del agregado como las opciones: **no le agregues una mutación propia**.
- **Los cuatro costos estimados (`costo_*_centavos`) NO los escribe `guardar_proyecto`**, aunque vengan en el pedido: van por `guardarCostosEstimados`, un update de sus columnas solas, como las marcas de la agenda. Así guardar el agregado no los pisa y ellos no pisan el agregado. **Null no es cero**: null es «todavía no lo estimé». El grant es solo de `update`, a propósito.
- **`entrega_hora` y `visita_hora` sí las escribe `guardar_proyecto`**, con el patrón de la clave presente y **leídas como texto**: un `<input type="time">` vacío manda `""` y un cast directo corta con `22007` (ADR 0015).
- **Con opciones vivas, el presupuesto del trabajo lo deriva la base**, no el cliente: es el de la opción aprobada, o null si no hay ninguna. Lo garantiza `private.validar_presupuesto_aprobado`, un trigger de constraint **diferido** sobre `proyectos` y sobre `opciones_de_presupuesto`, que rechaza con `MN009`. Es diferido porque adentro de una transacción el proyecto se escribe antes que sus hijas y a mitad de camino el par todavía no cierra.
- **Un constraint diferido no falla dentro de un test de pgTAP**, que termina siempre en rollback y nunca llega al commit: para verlo fallar hay que adelantar el chequeo con `set constraints all immediate` dentro del mismo bloque que hace el cambio (`23_opciones_y_sena.sql`).
- **Un índice único parcial no se puede diferir** (solo un constraint puede, y un único parcial no puede serlo): se evalúa fila por fila, apenas se escribe cada una. Si un `insert ... on conflict` mueve una marca única de una fila a otra en la misma sentencia, **el orden entre filas no está definido** y a veces hay dos prendidas a la vez: corta con `23505`, que es definitivo, no tiene traducción y tapa la cola. Lo que corresponde es **apagar antes, en su propia sentencia**, como hace `guardar_proyecto` con `aprobada` (ADR 0043).
- **Un test verde sobre una sentencia con orden indefinido no prueba nada.** Ese `23505` pasó dos veces en pgTAP y una en el e2e de escritorio antes de aparecer en el de celular. El caso que lo cubre tiene que ser el que falla siempre, no el que falla a veces: mandar la fila nueva **sin** mandar la que hay que apagar.
- `liquidarProyecto` y `revertirLiquidacion` son las cuatro operaciones que tocan la distribución congelada. **El pedido lleva el acumulado del mes que vio la app** (`sueldoPrevioCentavos` / `fijosPrevioCentavos`): si no es el de la base, la liquidación vuelve **ajustada** —congelada con el acumulado del servidor— en vez de rechazada con `MN006`. Se detecta comparando `dist_sueldo_previo_centavos` de la fila que vuelve contra lo que se mandó; la respuesta no trae marca (ADR 0016).

## La vista del cliente (ADR 0046)

- **`public.vista_del_cliente(uuid)` es la lista blanca**: enumera campo por campo lo que el cliente puede ver y **nunca devuelve la fila entera**. Si alguna vez se convierte en un `to_jsonb(proyecto)`, cada columna nueva de `proyectos` queda expuesta sin que nadie lo decida. Es **security invoker**: desde la app la llama el dueño y la RLS decide.
- **`public.vista_compartida(text)` es la puerta del enlace y la única función de la base que `anon` puede ejecutar**, y la única `security definer` de `public`. Resuelve el token contra su sha256 y delega en la anterior. `00_estructura.sql` exige la lista exacta de las dos cosas: si aparece otra función alcanzable por `anon`, falla.
- **`supabase/tests/25_vista_del_cliente.sql` se rompe apenas aparece una columna nueva en `proyectos`**: compara las columnas reales contra dos listas escritas a mano, las que viajan y las que no. No prueba que la función esté bien; prueba que alguien decidió.
- **`public.enlaces_publicos` guarda las dos cosas: `token_hash` y `token`.** El hash es con lo que `vista_compartida()` resuelve lo que llega por la URL; el token en claro está para que el dueño vea la dirección desde cualquiera de sus aparatos (ADR 0052). Dos checks lo cuidan: la forma, y que su sha256 sea `token_hash`, así que ahí no se puede guardar la dirección de otro enlace. `anon` no tiene grant sobre esta tabla y ninguna `security definer` devuelve esa columna. Un volcado, en cambio, sí trae enlaces que funcionan. Un solo enlace vivo por trabajo (índice único parcial), y generar uno nuevo **apaga el anterior en su propia sentencia** antes de insertar, por lo del ADR 0043. Sin caducidad: se revoca con `revocado_at`. `visitas` y `ultima_visita_at` las escribe la función elevada y no tienen grant.
- **`public.cambios_de_estado` la escribe un trigger `security definer` y nadie más**: `authenticated` solo tiene `select`. Guarda cada cambio de etapa venga de donde venga. **No está en la réplica** a propósito: todavía no hay pantalla que la lea y es la única tabla que crece sin techo. De ahí salen las dos fechas que la vista del cliente no podría reconstruir: cuándo se mandó el presupuesto y cuándo se aprobó.
- **`archivos.visible_para_cliente` solo tiene grant de `update`**, no de `insert`: un archivo nace privado y se comparte después.
- **Cómo te paga: `proyectos.cobro_sena` y `.cobro_saldo`** (ADR 0053), las dos `forma_de_cobro[]` y las dos nullable. **Null no es vacío: es «sin configurar»**, y el valor por defecto lo calcula `private.formas_de_cobro()` según si el taller tiene alias o CBU en Ajustes. El `check` enumera las tres combinaciones legales, envuelto en `coalesce(..., false)` porque comparar un arreglo con un null adentro da null. **Grant solo de `update`**: `guardar_proyecto` no las escribe, como los costos estimados.
- **Dos gemelas nuevas, y el comparador las ata** (ADR 0053): `private.formas_de_cobro()` ↔ `formasDeCobro()` y `private.pagos_por_delante()` ↔ `pagosPorDelante()`, las dos en `scripts/comparacion.ts`. Las dos viven en `private` con `grant execute` a `authenticated` y nada para `anon`, porque `vista_del_cliente()` es security invoker y las llama (como `private.ruta_del_archivo()`). **El ADR 0043 decía que la seña no tiene gemela en SQL; desde que la vista pública dice cuánto es el pago que toca, la tiene.**
- **Los datos de la cuenta viajan solo si el pago que toca AHORA se ofrece por transferencia.** La clave `cobro` no desaparece: viaja con sus cuatro campos en null. Lo que no se muestra, no se manda.

## La agenda y los avisos (ADR 0034 y 0036)

- `src/agenda.ts` convierte filas en los datos del dominio: `datosDeLaAgendaDeLaReplica` para la app, `datosDeLaAgenda` para la función de borde. Es la misma función a propósito: lo que muestra la agenda y lo que se avisa no pueden divergir.
- **`COLUMNA_DE_LA_FECHA` dice de qué columna del proyecto sale la fecha de cada evento derivado** (ADR 0045). Es la única columna donde esa fecha puede vivir, así que arrastrar el evento en la agenda escribe ahí, por `guardadoDeUnPaso`. `horaDeLaEntrega` y `horaDeLaVisita` leen las horas tolerando una fila guardada antes de las columnas.
- **`src/agenda.ts` no importa nada que no corra en Deno**: la función de borde lo importa por ruta. Por eso las columnas de las marcas (`COLUMNAS_DE_MARCAS`, `COLUMNA_DE_LA_MARCA`) viven ahí y `sincronizacion.ts`, que trae el cliente de Supabase, las importa de ahí y no al revés. `visitaHecha` y `marcadaComoImportante` leen las columnas nuevas tolerando una fila que no las trae (ADR 0042).
- **`visita_hecha` la escribe `guardar_proyecto` solo si la clave viene en el pedido; las marcas de importante no las escribe nunca** (`guardarMarcasDeLaAgenda`, una columna por update). `22_lo_hecho_y_las_marcas.sql` lo verifica.
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

`supabase/esquema.sql` es la vista del estado final del esquema: `public`, `private`, **los triggers sobre `auth.users`**, que no son nuestra tabla pero sostienen el alta de cuentas, y **los buckets y las políticas de `storage.objects`** (las fotos de perfil y los archivos de los trabajos, ADR 0022 y 0039). Un bucket nuevo agrega sus políticas a la lista de `15_fotos_de_perfil.sql`, que exige exactamente las que hay. `tests/esquema.test.ts` lo compara contra la base viva: si falla, o faltó el paso 5 o alguien cambió la base por fuera del repo. Nunca se toca el esquema desde el SQL Editor del dashboard.

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
- **El cuerpo de una función se guarda tal cual en la base, finales de línea incluidos.** Una migración escrita con CRLF deja CRLF adentro de `pg_proc.prosrc` y después `tests/esquema.test.ts` falla con un diff que a la vista es idéntico. Los archivos de `supabase/migrations/` van con LF (ADR 0053).
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
