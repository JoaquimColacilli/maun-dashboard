# 0014. Clientes: el primer camino de escritura, y las dos deudas que se saldaron antes

Estado: aceptada, 2026-09-11. Es el segundo paso de la fase 2D: la primera pantalla que escribe.

## Contexto

Todo lo anterior era lectura. Clientes va antes que Proyectos aunque se use mucho menos: la foreign key compuesta `(household_id, cliente_id)` hace que el formulario de proyecto necesite el selector de clientes, y un CRUD barato es el lugar para ensayar el camino de escritura antes de la pantalla grande.

Antes de escribir una línea de pantalla se saldaron dos deudas que hacían que cada paso se validara a ojo.

## La sesión de Playwright

El agente anterior no pudo correr seis de siete validaciones porque Playwright no tenía credenciales. Ahora hay una cuenta de prueba con su propio taller:

- `E2E_EMAIL` y `E2E_PASSWORD` viven en `apps/web/.env` **sin prefijo `VITE_`**, y están en `.env.example` con la razón escrita al lado: todo lo que empieza con `VITE_` termina en el bundle que se baja el navegador, y `vite.config.ts` corta el build si eso parece un secreto. Los tests corren en Node y las leen de `process.env`.
- Un proyecto `setup` entra una sola vez por el formulario de verdad y guarda el `storageState`; los proyectos `celular` y `escritorio` lo reusan. Los de acceso (`acceso-celular`, `acceso-escritorio`) siguen corriendo sin sesión, que es lo que prueban.
- **Cada test con sesión vacía los clientes del taller de prueba antes de empezar**, por REST y con baja lógica, que es lo único que la base le permite al cliente. Por eso `workers: 1`: los cinco proyectos comparten un household, y en paralelo el vaciado de uno se llevaría las filas del otro. La suite tarda un minuto; la alternativa era un household por worker, que es más partes para sostener por un minuto.

**El e2e corre contra el build, no contra el dev server.** El service worker solo existe en el artefacto real, y sin él "cerrar la app y reabrirla sin señal" no se puede probar, que es medio producto. El `webServer` de Playwright hace `vite build && vite preview`.

### Lo que eso encontró el primer día

`onlineManager` de TanStack arranca con `#online = true` fijo y solo cambia con los eventos `online`/`offline` de `window`: **nunca lee `navigator.onLine`** (verificado en query-core 5.102.8, no de memoria). Abrir la app con el celular ya en modo avión —la mañana en el taller, que es el caso del ADR 0012— la dejaba creyendo que hay red:

- el indicador decía "Sincronizando 1 cambio…" en vez de "Sin conexión", que es exactamente la mentira que el ADR 0010 prohíbe;
- y peor, con `networkMode: 'online'` la mutación no quedaba en pausa: salía, fallaba, gastaba sus reintentos y terminaba rechazada, con la fila optimista revertida. El cambio del usuario se perdía.

El arreglo es una línea, `onlineManager.setOnline(navigator.onLine)` al crear el query client, con su test. Los eventos lo mantienen al día después. Esto estaba desde la 2C y no lo vio nadie porque no había forma de entrar con Playwright: es el argumento de por qué esta deuda se pagó primero.

## El libro mayor contra SQL

Era la deuda más cara del repo y la marcaba el propio ADR 0013. `scripts/comparacion.ts` ahora compara la tercera regla duplicada:

- **El TypeScript lee lo que lee la app**: `public.bootstrap()` arma la réplica, `datosDelLibro` la traduce y `asientosDelLibro` produce los asientos. Filtrar las filas borradas a mano en el comparador habría sido copiar ahí el `where` de la vista, que es justo una de las mitades que puede diverger.
- Se comparan **los asientos como multiconjunto** (la vista es un `union all` y repite el mismo id con distinta contrapartida) **y los cuatro saldos por tesoro**, que son los números más visibles de la app.
- Corre sobre cinco escenarios propios (los seis tipos de movimiento, borrados de movimiento, de pago, de gasto y de proyecto, cobrados, perdidos con y sin seña, escalones en cero, y una reapertura) **más los doce escenarios de liquidación que ya existían**, y sobre el libro del seed.
- El household del seed no tiene miembros a propósito (ADR 0012), así que para leerlo por el camino real —bajo RLS— el comparador se crea uno y lo deshace en el mismo savepoint.

**Se verificó que el comparador puede fallar.** Poniendo en `asientosDelLibro` el filtro del archivo de migración original (`estado = 'cobrado'` en vez de `in ('cobrado','perdido')`), la comparación se pone en rojo y dice, entre otras cosas, `saldo de diezmo: SQL 7320000, TS 0`. Un test que no se probó fallando no prueba nada.

## Clientes

**Formularios: React Hook Form con resolver de Zod.** Zod ya estaba para las variables de entorno.

**Solo el nombre es obligatorio**, y eso es la regla, no una concesión: cuando lo llama un desconocido por teléfono no tiene el CUIT a mano. Frenan exactamente dos cosas, y no por gusto sino porque son `check` de la base: el formato del CUIT (`NN-NNNNNNNN-N`) y el del email. Un rechazo definitivo no se reintenta y **tapa la cola, que drena de a una** (ADR 0012): dejar pasar algo que la base va a rechazar sería peor que frenarlo en el formulario.

**El CUIT avisa, no bloquea.** `revisarCuit` vive en `@maun/domain` con sus tests. Devuelve cuatro estados en vez de un booleano, y el que importa es `ambiguo`: cuando el módulo 11 da 10 las convenciones en uso difieren entre tratarlo como inválido y mapearlo a 9, así que el dominio **devuelve `null` en vez de elegir una** y la app lo dice con esas palabras. El prefijo equivocado y el verificador que no cierra también son advertencias: un CUIT matemáticamente válido tampoco garantiza que esté inscripto, así que la validación nunca es definitiva.

**El teléfono se guarda como lo escribe el usuario** y se normaliza solo para armar el enlace de WhatsApp (el 0 de adelante y el 15 del medio). Rechazar las formas en que un número argentino se escribe a mano es hostil.

**El selector de clientes: `useCombobox` de Downshift.** Es el patrón ARIA más propenso a errores que existe y el sistema de diseño es propio, así que un hook sin estilos es lo que encaja. Tres estados: buscando, elegido con sus datos resumidos al lado, y creando uno nuevo. **Crear desde el combobox pide solo el nombre**, que es coherente con la regla de arriba y evita anidar una hoja modal adentro de otra en un celular.

**Optimismo por el cache, no con `useOptimistic`** (ADR 0013). Dos mutaciones, como manda el ADR 0010: el alta es un upsert de la fila completa por id (UUIDv7 del cliente), la edición es un update con **solo las columnas que cambiaron**, y los valores previos viajan en las variables, no en el contexto, porque el contexto no se persiste.

**Las query keys de la réplica bajaron a `shared/lib`.** `entities/cliente/api` necesita `claveDeTodaReplica()` para aplicar la mutación optimista, y `entities` no puede importar `entities`: la regla del repo es que lo que usan dos slices baja, no se importa de costado. `entities/replica` las sigue re-exportando, así que su API pública no cambió. Es lo que va a necesitar cada entidad que escriba de acá en adelante: proyectos, pagos, gastos.

**Ninguna de las dos pantallas tiene estado de carga**, porque leen de la réplica por contexto. La ficha sí tiene un estado de "ese cliente no está", que no es carga: es un enlace a un cliente borrado desde otro dispositivo.

## Objeciones

- **Hay dos piezas que ninguna pantalla de este paso usa: el combobox y `EnlaceACliente`.** Las dos las pide el brief y las dos están hechas y probadas, pero hasta que exista el formulario de proyecto y las pantallas que muestran el nombre de un cliente al pasar, son API pública sin un solo llamador en la app. Prefiero decirlo: si el paso siguiente cambia de idea sobre cómo se elige un cliente, el combobox se tira. El argumento a favor —el modelo de datos acá es simple, y el combobox es el patrón ARIA más fácil de romper— es real; el costo también. Hoy el nombre del cliente lleva a su ficha desde el único lado donde aparece, que es la fila de la lista, y `rutaDelCliente` es la ruta compartida.

- **El bundle: los íconos no eran el problema.** Se verificó antes de tocar nada: `lucide-react` se importa desde el barrel, pero Vite lo tree-shakea bien y en el bundle hay 47 nodos de path, o sea los íconos que se usan, no la librería. Con 29 íconos pesa 22 kB sin minificar, menos del 1,5%. La causa del salto de 677 kB repartidos a 713 kB en un solo chunk es la decisión del ADR 0013 de importar las pantallas del taller directo, que es deliberada.

  **Lo que sí es peso muerto es Supabase.** Medido sobre el build, en bytes sin minificar: `realtime-js` 56 kB, `phoenix` 41 kB, `storage-js` 42 kB y `functions-js` 6 kB, unos **145 kB de código que la app no usa nunca**. No se puede tree-shakear: `SupabaseClient` instancia `this.realtime` y `this.storage` en el constructor. Sacarlo es cambiar `crearClienteMaun` por `@supabase/auth-js` más `@supabase/postgrest-js` directo, que toca la única puerta a Supabase del repo y merece su propio ADR y su propio paso. No se hizo acá.

  Lo demás es lo que la app es: `react-dom` 537 kB, `react-router` 203 kB, `auth-js` 176 kB, `zod` 139 kB. Este paso suma 65 kB (713 → 778 kB sin comprimir, 227 kB con gzip): `react-hook-form` 75 kB, las dos pantallas y la entidad 51 kB, `downshift` y el resolver el resto.

  **La recomendación, para cuando se decida:** separar el chunk de vendor del de la app. No baja un byte del primer arranque, pero la app es una PWA que precachea el shell, y hoy cualquier cambio de una pantalla obliga a bajar los 778 kB de nuevo. Con el vendor aparte, un cambio de código son 20 kB. No agrega ningún spinner —no hay `lazy`, los chunks van todos en el precache y con `modulepreload`—, así que no toca la decisión del aterrizaje. No lo hice porque no era lo que estaba pedido y cambia la forma del build.

- **`workers: 1` es un impuesto que paga toda la suite** por un problema de dos specs. Si la suite crece mucho, la salida es un household por worker.

## Consecuencias

- El e2e ahora construye la app antes de correr: `pnpm e2e` tarda unos 20 segundos más y prueba el artefacto real, service worker incluido.
- Las credenciales de la cuenta de prueba son una variable más que hay que tener en `.env`. Sin ellas los tests con sesión fallan con un mensaje que dice cuál falta y por qué no lleva `VITE_`.
- La comparación del libro mayor suma unos 20 segundos a `pnpm verify`.
- El taller de la cuenta de prueba se vacía en cada corrida: no se usa para mirar datos a mano.
- `Campo` de `@maun/ui` acepta `ref` (pasó a `ComponentPropsWithRef`), que es lo que React Hook Form necesita para registrar un input.
- Quedó sin hacer, y es trabajo del paso que viene: borrar un cliente desde la interfaz. La base lo soporta (baja lógica, con `MN003` si tiene proyectos vivos) y el e2e la usa para limpiar, pero no hay botón.
