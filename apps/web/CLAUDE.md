# @maun/web

React 19, Vite 8 y Tailwind 4, empaquetada como PWA. Hoy tiene el acceso (login, registro, recuperación), las guardas de ruta, la réplica del household con su cola de salida, y una pantalla de inicio técnica que muestra lo replicado, configura el taller y deja cargar un movimiento. Las pantallas de negocio llegan en la fase 2D.

## Capas (FSD, ADR 0006)

```
src/
  main.ts      solo llama a arrancar()
  app/         arranque, providers, router con sus guardas y layout del shell
  pages/       una carpeta por ruta, finas: componen features y entidades
  features/    acciones del usuario (iniciar-sesion, crear-cuenta, recuperar-acceso,
               cerrar-sesion, configurar-taller, registrar-movimiento)
  entities/    sesion (estado y contexto) y replica (la copia del household)
  shared/      api (Supabase), config, lib (cache, plata, fechas, uuid, sync) y ui
```

- Solo se importa hacia capas de abajo, y un slice no importa a otro de su misma capa.
- Todo se importa por el `index.ts` del slice: `@/entities/proyecto`, nunca `@/entities/proyecto/model/calculo`.
- Esas dos reglas las impone `boundaries/dependencies` y rompen el lint.
- `@maun/ui` se importa solo desde `shared/ui`; el resto del código usa `@/shared/ui`.
- Supabase (`@maun/db`, `@supabase/supabase-js`) se importa solo desde `shared/api`, que es la única puerta: ahí viven el cliente, las operaciones de auth, `sincronizar()` y las mutaciones.
- `@/` apunta a `src/`. Está definido en `tsconfig.app.json` y en `vite.config.ts`: si cambia, cambia en los dos.
- El estado del servidor vive en TanStack Query, dentro de `entities/*/api`. Las query keys llevan ids. El resto es estado local de React; no hay state manager global.
- La plata es `Money` de `@maun/domain`: un `number` entero de centavos con brand. Nunca `BigInt` de JavaScript (ADR 0002). Para mostrarla y leerla, `formatearPesos` y `parsearPesos` de `@/shared/lib`.

## Acceso y sesión (ADR 0012)

- Mail y contraseña, nunca enlace mágico: el taller no tiene señal y el proyecto manda dos mails por hora.
- La sesión se valida con `getClaims()` (verificación local del JWT). `getUser()` no va en el camino crítico. Sin red y con el token vencido se cae a la sesión guardada, sin verificar: la barrera real es Postgres, no la app.
- Hay **una sola suscripción** a `onAuthStateChange` para toda la app (`entities/sesion/model/store.ts`). No agregues otra por componente: remonta el estado y hace parpadear el skeleton. El callback no llama a Supabase, solo escribe estado.
- `/acceso/nueva-contrasena` exige que la sesión venga del enlace de recuperación: con la sesión abierta alcanzaría para cambiar la contraseña sin saber la anterior.
- **El registro es auto-servicio:** quien confirma su mail sale con su propio taller, creado por un trigger de `auth.users` en la misma transacción que la cuenta. No hay pantalla de "sin acceso" y no la agregues: una sesión sin taller es un alta que quedó a medias, y cae en el error genérico con reintentar.
- Tres guardas, tres preguntas distintas: `RutaPublica` (¿ya hay sesión?), `RutaConSesion` (¿hay sesión?) y `RutaConAcceso` (¿la réplica trae household?). Un error al sincronizar **no** es falta de acceso, y al revés tampoco: son mensajes distintos sobre el mismo `ErrorDeCarga`.
- Rutas: `/acceso`, `/acceso/crear-cuenta`, `/acceso/recuperar`, `/acceso/nueva-contrasena` (ahí cae el enlace de recuperación), `/` (inicio) y `/verificacion` (pantalla técnica de tokens, pública).
- **La primera configuración es el estado vacío de Inicio, no un asistente** (ADR 0012). Los ajustes nacen en cero y `faltaConfigurar()` es lo que decide el texto. El formulario de `features/configurar-taller` es el mismo que va a usar Ajustes en la 2D: no lo dupliques ahí.
- Al terminar la sesión se borra la cola, el cache y el almacén de IndexedDB (`limpiarDatosLocales`). **No cuelga del botón**: también corre con el evento `SIGNED_OUT` y cuando al arrancar hay datos de otro usuario. Si no, el próximo login hereda los datos y la cola del anterior, y esa cola escribe en su household.

## Offline (ADR 0005 y 0010)

- `app/providers/query-client.ts` configura `networkMode: 'offlineFirst'` para queries, `'online'` para mutaciones (con `'offlineFirst'` una mutación sin red falla en vez de quedar en cola) y un `gcTime` de 7 días, igual al `maxAge` del persister.
- El cache se persiste en IndexedDB con structured clone (`shared/lib/cache/persister.ts`). No lo cambies por un persister de localStorage: es síncrono y chico.
- Toda mutación que pueda quedar en cola necesita tres cosas: su `mutationKey`, su `mutationFn` registrada en `app/providers/mutaciones-persistibles.ts` y **`scope: COLA_DE_SALIDA`**. Sin lo segundo, `resumePausedMutations()` falla con "No mutationFn found"; sin lo tercero, la cola drena en paralelo y dos cambios del mismo mes se pisan.
- Se persiste **toda mutación pendiente**, pausada o no (`esPersistible`), y al restaurar se llama a `reanudarCola`, que continúa primero las que quedaron a mitad de envío. El default de TanStack guarda solo lo pausado, y con señal mala una mutación sale sin pausarse.
- `onMutate` cancela las sincronizaciones en vuelo antes de tocar el cache, y `sincronizar()` mezcla sobre el cache fresco: si no, la respuesta de la base pisa lo que la cola escribió mientras tanto.
- La réplica del household es una sola entrada del cache (`['replica', usuarioId]`). Se arma con `bootstrap()` y se mantiene con `delta(cursor)`; el reconcile completo corre al entrar y cada 24 horas, salvo que haya cola pendiente. Las pantallas leen de ahí: nada consulta PostgREST por su cuenta.
- Forma de las mutaciones (ADR 0010): alta, upsert de la fila completa por id (UUIDv7 generado en el cliente con `uuidv7()`); edición, update por id con solo las columnas que cambiaron; baja, update de `deleted_at` con la marca fijada al encolar. `ajustes` solo se edita.
- Cada mutación se aplica optimista a la réplica con `aplicarFilaLocal` y, si la base la rechaza, se saca con `quitarFilaLocal`.
- Los rechazos con SQLSTATE `MNxxx` y `42501` no se reintentan: se le muestran al usuario. Tampoco se reintenta ningún otro SQLSTATE definitivo (una violación de check nunca va a andar y tapa la cola, que drena de a una). La red, los timeouts y las clases transitorias sí.
- Nunca muestres "guardado" para una mutación en cola. Para el estado real usá `useEstadoSync` y `describirEstadoSync` de `@/shared/lib`.
- Si cambia la forma de los datos persistidos, subí `VERSION_CACHE`.
- El service worker precachea solo el shell: no agregues `runtimeCaching` para la API de Supabase.

## Sistema de diseño

- Las pantallas se portan desde `design-reference/*.dc.html`, con el mismo markup y los mismos tokens. Cada pantalla tiene cuatro estados (cargando, vacío, con datos y error) y tres anchos (390, tablet y 1440).
- Solo se usan utilidades de tokens: `bg-ink`, `text-text-2`, `bg-hogar-tint`, `text-money-lg`, `rounded-panel`, `h-button`, `px-(--page-pad-mobile)`. Los colores y tamaños por defecto de Tailwind no existen, y no hay hex sueltos.
- Los componentes de `design-reference/src/components/app` conocen el dominio: van a `entities` o a `features`, no a `packages/ui`.
- El error de un campo va en el `error` de su `Campo`, que lo ata con `aria-describedby` y marca el input inválido. El `<p role="alert">` suelto queda solo para lo que no es de ningún campo, y nunca los dos a la vez: serían dos alertas.
- `Cargando` y `Aviso` viven en `shared/ui` porque los usan `app/` y `pages/`. `Cargando` lleva `role="status"` y su texto para el lector de pantalla.
- `design-reference/src/lib/format.ts` calcula la cascada sobre el presupuesto: no se porta, se usa `@maun/domain`.
- `Login.dc.html` está dibujado para enlace mágico: se portó el layout y se cambió el texto (ADR 0012).

## Entorno

- Las variables se validan con zod en `shared/config/env.ts`, al arrancar (`app/arranque.tsx`). Si falta una, la app muestra cuál y no monta.
- Para agregar una variable, sumala en tres lugares: el esquema, `.env.example` y el `env` de las tareas `build` y `e2e` en `turbo.json`. Turbo no les pasa a las tareas las variables que no están declaradas.
- `index.html` usa `%VITE_SUPABASE_URL%` en el `preconnect`: Vite lo reemplaza al construir.
- `vite.config.ts` corta el build si una variable `VITE_` parece secreta: su nombre tiene `SECRET` o `SERVICE_ROLE`, o su valor es `sb_secret_...` o un JWT de service_role.

## Tests

- Vitest y Testing Library, al lado del archivo (`*.test.ts[x]`).
- `shared/lib/cache/cola.test.ts` es el test de la cola: usa IndexedDB de verdad (`fake-indexeddb`) y prueba que sin red la mutación queda en pausa, sobrevive a cerrar la app y se aplica en orden al volver la señal.
- Playwright en `e2e/`, con dos proyectos: celular (390) y escritorio (1440).
  - La primera vez hay que instalar chromium: `pnpm --filter @maun/web exec playwright install chromium`.
  - El dev server necesita `apps/web/.env`.
  - Cubre lo que no necesita credenciales: la redirección al login, la validación del formulario y la navegación entre las pantallas de acceso. Entrar de verdad necesita un usuario y mails reales.
