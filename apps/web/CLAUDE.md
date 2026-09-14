# @maun/web

React 19, Vite 8 y Tailwind 4, empaquetada como PWA. Tiene el acceso (login, registro, recuperación y el bloqueo con huella), las guardas de ruta, la réplica del household con su cola de salida, el marco con su navegación por ancho de pantalla, Inicio, Ajustes, **Clientes**, **Proyectos** (Seguimiento, Activos e Historial, con el cobro y el pasaje), **Finanzas** y **Diezmo**. Con Seguimiento (ADR 0019) quedó construido todo lo que pidió el dueño.

## Capas (FSD, ADR 0006)

```
src/
  main.ts      solo llama a arrancar()
  app/         arranque, providers, router con sus guardas y layout del shell
  pages/       una carpeta por ruta, finas: componen features y entidades
  features/    acciones del usuario (iniciar-sesion, crear-cuenta, recuperar-acceso,
               desbloquear-la-app, activar-huella,
               cerrar-sesion, configurar-taller, registrar-movimiento, ajustar-cocos,
               editar-cliente, editar-proyecto, liquidar-proyecto, seguir-contacto)
  entities/    sesion, replica (la copia del household y su contexto), tesoro, cliente,
               proyecto y movimiento
  shared/      api (Supabase), config, lib (cache, claves, plata, fechas, orden, tesoros,
               uuid, sync, huella, teclado) y ui
```

- Solo se importa hacia capas de abajo, y un slice no importa a otro de su misma capa.
- Todo se importa por el `index.ts` del slice: `@/entities/proyecto`, nunca `@/entities/proyecto/model/calculo`.
- Esas dos reglas las impone `boundaries/dependencies` y rompen el lint.
- `@maun/ui` se importa solo desde `shared/ui`; el resto del código usa `@/shared/ui`.
- Supabase (`@maun/db`, `@supabase/supabase-js`) se importa solo desde `shared/api`, que es la única puerta: ahí viven el cliente, las operaciones de auth, `sincronizar()` y las mutaciones.
- `@/` apunta a `src/`. Está definido en `tsconfig.app.json` y en `vite.config.ts`: si cambia, cambia en los dos.
- El estado del servidor vive en TanStack Query, dentro de `entities/*/api`. Las query keys llevan ids. El resto es estado local de React; no hay state manager global.
- **El catálogo de tesoros y el ordenamiento de listas también viven en `shared/lib`** (`tesoros.ts`, `orden.ts`): los usan dos slices de `entities` cada uno, y un slice no puede importar a otro. `entities/tesoro` re-exporta el catálogo, así que su API pública no cambió (ADR 0015).
- **Las claves de la réplica viven en `shared/lib/claves.ts`**, no en `entities/replica`: la mutación de cada entidad las necesita para aplicarse optimista, y un slice de `entities` no puede importar a otro. `entities/replica` las re-exporta, así que su API pública no cambió (ADR 0014).
- La plata es `Money` de `@maun/domain`: un `number` entero de centavos con brand. Nunca `BigInt` de JavaScript (ADR 0002). Para mostrarla, `formatearPesos` de `@/shared/lib`. Para cargarla, `MoneyInput` de `@/shared/ui`: entrega centavos enteros (`number | null`), así que el estado de un formulario guarda el número y no el texto (ADR 0020).

## Acceso y sesión (ADR 0012)

- Mail y contraseña, nunca enlace mágico: el taller no tiene señal y el proyecto manda dos mails por hora.
- La sesión se valida con `getClaims()` (verificación local del JWT). `getUser()` no va en el camino crítico. Sin red y con el token vencido se cae a la sesión guardada, sin verificar: la barrera real es Postgres, no la app.
- Hay **una sola suscripción** a `onAuthStateChange` para toda la app (`entities/sesion/model/store.ts`). No agregues otra por componente: remonta el estado y hace parpadear el skeleton. El callback no llama a Supabase, solo escribe estado.
- `/acceso/nueva-contrasena` exige que la sesión venga del enlace de recuperación: con la sesión abierta alcanzaría para cambiar la contraseña sin saber la anterior.
- **El registro es auto-servicio:** quien confirma su mail sale con su propio taller, creado por un trigger de `auth.users` en la misma transacción que la cuenta. No hay pantalla de "sin acceso" y no la agregues: una sesión sin taller es un alta que quedó a medias, y cae en el error genérico con reintentar.
- Tres guardas, tres preguntas distintas: `RutaPublica` (¿ya hay sesión?), `RutaConSesion` (¿hay sesión?) y `RutaConAcceso` (¿la réplica trae household?). Un error al sincronizar **no** es falta de acceso, y al revés tampoco: son mensajes distintos sobre el mismo `ErrorDeCarga`.
- `RutaConAcceso` trata `isPaused` igual que `isError`. Sin nada guardado y sin red, la query de la réplica queda **en pausa, no en error**: sin ese caso la pantalla se quedaba en el skeleton para siempre, sin mensaje y sin forma de salir.
- Rutas: `/acceso`, `/acceso/crear-cuenta`, `/acceso/recuperar`, `/acceso/nueva-contrasena` (ahí cae el enlace de recuperación), y adentro del marco `/` (Inicio), `/seguimiento`, `/proyectos`, `/clientes`, `/finanzas`, `/diezmo` y `/ajustes`.
- **La primera configuración es el estado vacío de Inicio, no un asistente** (ADR 0012). Los ajustes nacen en cero y `faltaConfigurar()` es lo que decide el texto. El formulario de `features/configurar-taller` es el mismo que va a usar Ajustes en la 2D: no lo dupliques ahí.
- Al terminar la sesión se borra la cola, el cache y el almacén de IndexedDB (`limpiarDatosLocales`). **No cuelga del botón**: también corre con el evento `SIGNED_OUT` y cuando al arrancar hay datos de otro usuario. Si no, el próximo login hereda los datos y la cola del anterior, y esa cola escribe en su household.

## Pantallas de sesión, bloqueo con huella y passkeys (ADR 0023)

- **Toda pantalla de sesión es `PantallaDeAcceso`** (`shared/ui`): el tablero con el canto de los tesoros y el formulario. En el celular toma el alto y el desplazamiento del `visualViewport` (`useVentanaVisible`), no `min-h-dvh`: `#root` tiene `overflow: hidden` y sin eso el teclado cortaba el formulario. Al enfocar un campo acomoda primero el botón de enviar y después el campo.
- **Todo campo de contraseña es `CampoDeContrasena`.** El ojo que desaparecía era el `::-ms-reveal` de Edge, que ahora está escondido. En el e2e, `getByLabel('Contraseña', { exact: true })`: el botón se llama «Mostrar la contraseña» y sin `exact` son dos elementos.
- Autocompletado: `username webauthn` en el mail del login, `username` en los otros mails, `current-password` al entrar y `new-password` al registrarse y al restablecer.
- **`mensajeDeAcceso` nunca devuelve el `message` de un error**: lo que no está traducido dice el código entre paréntesis. Un código nuevo va a `POR_CODIGO`. Supabase no da error con un mail ya registrado (`esAltaRepetida`), y un enlace vencido vuelve en la URL (`errorDelEnlace`).
- **`PASSWORD_RECOVERY` lo escucha `clienteMaun()` al crear el cliente** (`vinoPorRecuperacion`). No lo muevas a una suscripción de componente: el canje del código puede terminar antes de que monte la pantalla, y el evento no se repite.
- **El bloqueo es una barrera de uso, no una frontera de seguridad.** `ConBloqueo` (en `guardas.tsx`) reemplaza todo lo que cuelga de `RutaConSesion`, réplica incluida. `esCelular()` mide el lado corto de la pantalla y se fija al abrir. La marca `maun:bloqueo` es por usuario y la borra `limpiarDatosLocales`.
- **La ceremonia local (`pedirHuella`) sale una vez por montaje y no se reintenta sola**: Safari limita la frecuencia sin publicar umbrales. El reintento es el botón. Si la página no tiene el foco, espera el `focus` antes de pedir.
- **Activar la huella marca la apertura en curso como desbloqueada.** Si no, la guarda bloquearía la app en el mismo momento en que el usuario la activa.
- **La huella se pide cada vez que se sale y se vuelve a entrar** (ADR 0026 y 0028). Volver de segundo plano bloquea si la app estaba abierta cuando se ocultó; abrirla bloquea siempre. No hay minuto de gracia: el dueño lo probó y lo quiere así. **No lo cambies por `sessionStorage`**: sobrevive a la restauración de la app y el bloqueo deja de existir.
- **La única apertura sin huella es una recarga de verdad**: tipo de navegación `reload`, página no descartada (`document.wasDiscarded`) y a menos de `TOPE_DE_UNA_RECARGA_MS` (15 s) de la última vez adentro. La recarga misma anota `salioEn` al descargarse, por eso `salioEn` se escribe al ocultarse estando a la vista y nunca en un `pagehide` con el documento ya oculto: cerrar desde recientes una app que estaba hace rato afuera no puede renovar el momento. Ensanchar el tope deja pasar las restauraciones que Android informa como recarga.
- **Desbloquear y activar el bloqueo borran la salida pendiente** (`salioAbierta`): el pedido de la huella del sistema puede ocultar la página, y sin eso desbloquear volvería a bloquear apenas la página vuelve a la vista.
- **Toda forma nueva de desbloquear pasa por `marcarDesbloqueada`**, que es la que anota el momento. Los listeners los prende `ConBloqueo` con `vigilarElBloqueo()`; no los registres al importar el módulo.
- **Volver a bloquear no desmonta la app.** Al abrir, `ConBloqueo` reemplaza todo por `PantallaDeBloqueo`; al volver de segundo plano monta `BloqueoAlVolver`, un `<dialog>` modal encima de la app, para no perder lo que se estaba cargando. Tiene que ser `<dialog>`: una hoja abierta deja inerte todo lo que no sea el modal de más arriba.
- **El gesto nativo de tirar hacia abajo sigue apagado**: `overscroll-behavior-y: none` en `html` y `body`. El service worker está en `prompt` y solo recarga después de tocar «Actualizar». El gesto propio sincroniza sin recargar (ADR 0027, abajo).
- Passkeys: el opt-in experimental está en `crearClienteMaun`. El autocompletado del mail (`esperarHuellaDelAutocompletado`) es la ceremonia en dos pasos, porque `signInWithPasskey` no admite mediación condicional. Es silenciosa salvo cuando falla la verificación.
- **`IndicadorSync` vive en `Marco`, no en `Shell`**: en las pantallas de sesión no hay nada que sincronizar, y tapaba el botón de la huella.
- **Ninguna pantalla de sesión encierra** (ADR 0031). El bloqueo tiene «Entrar con otra cuenta» (`EntrarConOtraCuenta`, de `features/cerrar-sesion`, que pone `ConBloqueo`): con la cola vacía sale directo, con cambios dice antes cuántos se pierden. Validar la sesión tiene tope (`TOPE_PARA_VALIDAR_LA_SESION_MS`): pasado, abre con la sesión guardada. La primera carga del taller, a los 15 s, ofrece reintentar o cerrar sesión sin cortarla (`CargaQueTarda`). **Un estado de espera nuevo en una guarda lleva su salida**: lo que espera a la red puede no terminar nunca.

## Tirar para actualizar (ADR 0027)

- **Al soltar, sincroniza: nunca recarga el documento.** Recargar monta la app de cero y pide la huella, y no trae nada: el documento está precacheado y los datos, en la réplica. Si te encontrás escribiendo `location.reload()` o `navigate(0)` para traer datos, es `sincronizarAhora` (`entities/replica`): drena la cola y trae la réplica. La usan el gesto y «Sincronizar ahora» de Ajustes, que es el camino sin gesto.
- `useTirarParaActualizar` (`shared/lib`) escucha el `<main>` de `Marco` con **listeners pasivos**: se midió que cancelar no cambia nada, porque el gesto se engancha a la ventana, que no scrollea. **No le pongas `overscroll-behavior` al `<main>`**: con `none` ahí el gesto se engancha al `<main>` y volver el dedo scrollea el contenido (78 px de 80). Si alguna vez hace falta, el `touchmove` tiene que cancelarse mientras se tira.
- Dónde aplica lo decide `seActualizaTirando` (`app/layout`), solo en el ancho `movil`. Se apaga con una ruta de hoja o con `useHayAlgoEnCurso()`. **Toda `Hoja` y `BloqueoAlVolver` ya se anotan; un formulario en línea nuevo en esas pantallas se anota con `useAlgoEnCurso(conCambios)`.** Hace falta: las hojas de una pantalla viven en el DOM adentro del `<main>` y sus toques llegan al listener.
- Sin señal no sale a la red y lo dice con `describirEstadoSync`. Con señal espera hasta diez segundos (`TOPE_DE_LA_SINCRONIZACION_MS`) y después dice que sigue intentando: nunca queda girando.
- `reanudarCola` devuelve la promesa de toda la cola y se cumple cuando drenó. El orden lo sigue dando el scope.
- El indicador es `aria-hidden` (el estado real lo anuncia `IndicadorSync`), cuelga del borde de arriba del `<main>` y no suma `env(safe-area-inset-top)`, que hoy no aplica ningún contenedor del marco.

## Pantallas y navegación (ADR 0013)

- **La app renderiza desde la réplica local, nunca desde la red.** La réplica llega por contexto (`useReplicaDelTaller()`), provista por `RutaConAcceso`, que ya la tiene resuelta antes de dejar pasar. **Ninguna pantalla adentro del marco tiene estado de carga**: si te encontrás escribiendo un skeleton para una de ellas, la pantalla no puede quedarse sin datos y el skeleton está de más.
- Sin `lazy` ni Suspense con spinner para las pantallas del taller: se importan directo. El code splitting queda para las de acceso, que son las únicas que dependen de la red.
- **En el celular, Ajustes se abre desde el avatar del encabezado de Inicio** (ADR 0024): es el único destino del sidebar sin lugar en la barra inferior, y ahí vive el registro de lo que la base rechazó. La barra inferior no se toca. Si un destino nuevo no entra en ella, el avatar pasa a abrir una hoja corta desde abajo con los que falten. `destinos-en-celular.spec.ts` recorre el camino a cada uno.
- `app/layout/destinos.ts` es el modelo de la navegación: los destinos, cuáles se ven en cada ancho y `destinoResaltado`, que marca Proyectos cuando estás en Seguimiento y no hay destino propio. `Navegacion.tsx` elige **una sola** de las tres barras con `matchMedia`: tres `<nav>` en el DOM son tres landmarks.
- El foco y el anuncio al cambiar de ruta los hace `Marco.tsx` sobre el `<main>`, no cada pantalla. Las pantallas **no** renderizan `<main>`: ya hay uno.
- Las transiciones van con `conTransicion()` (`document.startViewTransition` + `flushSync`), nunca con el componente `<ViewTransition>` de React.
- El nodo raíz está anclado con `position: fixed; inset: 0` por el problema de `100vh` en PWA instalada.
- **La holgura de abajo se mide, nunca se escribe como número** (ADR 0025). Todo lo que flota abajo vive en un solo pie fijo de `Marco` (`data-lo-que-flota-abajo`): el indicador de sincronización y, en el celular, la barra con el botón redondo **en flujo**, así que el rectángulo del pie es la huella completa. `useHolguraInferior` lo mide con `ResizeObserver` (border-box) y los eventos de tamaño, y de esa medición salen los dos consumidores:
  - el padding inferior del `<main>`: desde el borde de arriba del pie hasta el fondo **del `<main>`**, no de la ventana. En el Samsung el `<main>` se sale de la ventana y medir contra la ventana dejaba el final tapado;
  - `--holgura-inferior`: desde el borde de arriba del pie hasta el fondo de la ventana. Todo lo que se ancla con `position: fixed` sobre el contenido la usa (`bottom-(--holgura-inferior)`): hoy, los avisos y el menú de cargar.
- **Un elemento nuevo que flote abajo va adentro del pie o se ancla con `--holgura-inferior`.** No sumes otro `ResizeObserver` ni un `calc` con píxeles: dos cuentas se separan. Si lo que se agrega es una capa a pantalla completa (como la pantalla de proyecto del celular), tapa la barra y no consume nada.
- **El fondo de la píldora tiene `backdrop-filter`, que crea un contexto de apilamiento**: lo que va encima (los botones, el botón redondo) necesita `relative` o queda pintado debajo. `destinos-en-celular.spec.ts` lo verifica.
- `lo-que-flota-abajo.spec.ts` recorre 16 pantallas hasta el final del scroll, con y sin señal, con zona segura de 0 a 48 px, la raíz más alta que la ventana y letra grande, y falla si hay **texto o controles** del contenido debajo de algo flotante. Guarda capturas de cada pantalla: mirálas, la medición no ve todo.
- Las búsquedas de Clientes y Proyectos filtran la réplica en memoria desde la primera letra, **sin debounce**: no hay red de por medio que cuidar.
- **La barra «Sueldo del mes» de Inicio sale de `sueldoDelMes`, no de `resumenDelMes`.** El tope de sueldo es por cobro, así que cada cobro del mes espera su propio sueldo y la barra nunca pasa del 100% (ADR 0011). **El mensaje de arriba lee lo mismo que la barra** (`faltaDelSueldo`): con un cobro entero y uno a medias no dice «cubierto» (ADR 0020).
- **Las cifras del mes no cuentan los `ajuste`** (`resumenMensual`): la apertura de la migración acomoda el saldo, no es plata que entró ni que se gastó ese mes (ADR 0020).
- **Todas las pantallas van adentro de `Pagina`** (`@/shared/ui`): el ancho, los márgenes y el padding son uno solo. Si una pantalla necesita una columna más angosta, la angosta adentro (`[&>*]:max-w-[720px]`), no cambia el molde.
- **Un proyecto sin presupuesto no tiene saldo: `saldo` es `null`**, y se muestra «—», no «Sin saldo» en verde. «Sin saldo» es que ya pagó todo.
- **El scroll es del `<main>`, no de la ventana**: el nodo raíz está anclado con `position: fixed`, así que `window.scrollTo` no hace nada. `useScrollPorPantalla` (en `Marco`) guarda la posición del `<main>` por entrada del historial: al ir a otra pantalla arranca arriba y con el botón atrás vuelve a donde estaba. Cambiar solo los parámetros de la misma pantalla (un filtro) no lo mueve, y abrir una hoja por ruta tampoco, porque la ubicación visible sigue siendo la del fondo.
- **Los filtros que tienen que sobrevivir a un enlace van en la URL.** Hogar, Maun y Cocos llegan a Finanzas con `?tesoro=` (`rutaDeFinanzasDelTesoro`); Finanzas lo lee con `tesoroDelParametro`, que ignora cualquier valor que no sea un tesoro. Cambiar el chip reemplaza la entrada del historial, así que atrás vuelve a Inicio y no a cada chip. El mes, el sentido y el texto siguen en estado local y el mes arranca en el mes en curso. Diezmo tiene su propia pantalla y no pasa por Finanzas.
- **Ajustes está agrupado por tema**: a la izquierda vos y este dispositivo (perfil, apariencia, sincronización, rechazos) y a la derecha el taller (reparto y metas, Cocos). Cuenta va última, también en una sola columna.

## Offline (ADR 0005 y 0010)

- `app/providers/query-client.ts` configura `networkMode: 'offlineFirst'` para queries, `'online'` para mutaciones (con `'offlineFirst'` una mutación sin red falla en vez de quedar en cola) y un `gcTime` de 7 días, igual al `maxAge` del persister.
- El cache se persiste en IndexedDB con structured clone (`shared/lib/cache/persister.ts`). No lo cambies por un persister de localStorage: es síncrono y chico.
- Toda mutación que pueda quedar en cola necesita tres cosas: su `mutationKey`, su `mutationFn` registrada en `app/providers/mutaciones-persistibles.ts` y **`scope: COLA_DE_SALIDA`**. Sin lo segundo, `resumePausedMutations()` falla con "No mutationFn found"; sin lo tercero, la cola drena en paralelo y dos cambios del mismo mes se pisan.
- Se persiste **toda mutación pendiente**, pausada o no (`esPersistible`), y al restaurar se llama a `reanudarCola`, que continúa primero las que quedaron a mitad de envío. El default de TanStack guarda solo lo pausado, y con señal mala una mutación sale sin pausarse.
- **El `onMutate` de toda mutación encolable termina en `await guardarCacheAhora()`**, después de aplicar la fila optimista. `PersistQueryClientProvider` guarda solo, pero sin esperar a nadie: la escritura a IndexedDB puede quedar a mitad de camino si la app se recarga en ese instante, y ahí se pierden las dos cosas que no se pueden perder, la mutación en cola y la fila optimista que la acompaña (al restaurar, `reanudarCola` reenvía la mutación pero **no** vuelve a correr `onMutate`). Esperarlo cuesta milisegundos y garantiza que nada sale a la red antes de estar en disco. Lo mismo hacen `anotarAviso` y `descartarAviso`, que por eso devuelven una promesa (ADR 0018).
- `onMutate` cancela las sincronizaciones en vuelo antes de tocar el cache, y `sincronizar()` mezcla sobre el cache fresco: si no, la respuesta de la base pisa lo que la cola escribió mientras tanto.
- La réplica del household es una sola entrada del cache (`['replica', usuarioId]`). Se arma con `bootstrap()` y se mantiene con `delta(cursor)`; el reconcile completo corre al entrar y cada 24 horas, salvo que haya cola pendiente. Las pantallas leen de ahí: nada consulta PostgREST por su cuenta.
- Forma de las mutaciones (ADR 0010): alta, upsert de la fila completa por id (UUIDv7 generado en el cliente con `uuidv7()`); edición, update por id con solo las columnas que cambiaron; baja, update de `deleted_at` con la marca fijada al encolar. `ajustes` solo se edita.
- Cada mutación se aplica optimista a la réplica con `aplicarFilaLocal` y, si la base la rechaza, se saca con `quitarFilaLocal`.
- Los rechazos con SQLSTATE `MNxxx` y `42501` no se reintentan: se le muestran al usuario. Tampoco se reintenta ningún otro SQLSTATE definitivo (una violación de check nunca va a andar y tapa la cola, que drena de a una). La red, los timeouts y las clases transitorias sí.
- **Un corte de red no llega como `TypeError`.** PostgREST devuelve un objeto con `code` vacío y el mensaje del `fetch` adentro («Failed to fetch», «Load failed»…). `esFalloDeRed` lo reconoce por ese par: sin eso, la pantalla mostraba «TypeError: Failed to fetch» en vez de «sin conexión».
- Nunca muestres "guardado" para una mutación en cola. Para el estado real usá `useEstadoSync` y `describirEstadoSync` de `@/shared/lib`. El `IndicadorSync` global es el que lo dice y **desaparece cuando no hay nada pendiente**: en un test, que no esté es la señal de que ya llegó a la base.
- **Las confirmaciones salen de la cola, no del formulario** (`app/providers/avisos-de-la-cola.ts`, ADR 0020). La mutación lleva `meta: metaDeAvisos('clienteNuevo')` y el suscriptor del `MutationCache` decide qué decir: «guardado» solo con `success`, «anotado sin señal» con `pause`, y el error con el motivo traducido. La `meta` se deshidrata con la mutación, así que una que drena después de reabrir la app avisa igual. Si el formulario muestra su propio rechazo mientras está abierto, `errorEnPantalla: true` evita la alerta repetida.
- **Una pausa no es falta de señal** (ADR 0030). query-core pausa igual a una mutación sin red y a una que espera su turno en el `scope` (`canStart` = red y `canRun`). «Anotado sin señal» sale solo con `pause` y `onlineManager` fuera de línea; con señal es esperar el turno y no avisa. Si la señal se corta mientras espera, lo anota el suscriptor de `onlineManager`. **Un guardado produce un aviso que cambia de estado**: lo anotado y lo guardado comparten clave, y `avisarEnPantalla` reemplaza en su lugar al de la misma clave aunque cambie el tono (`reemplaza` para que un error tome el lugar de otra clave).
- **El `meta` de una mutación pendiente se reaplica en cada render del componente que la usa** (`MutationObserver.setOptions` de query-core 5.102.8 le pisa las opciones a la mutación en curso). No lo armes con datos que la misma mutación saca de la réplica: la ficha de cliente armaba el `sujeto` con el cliente que la baja optimista borra, y un render en el medio dejaba el aviso de error diciendo «Este trabajo» en vez del nombre. Guardá el último valor conocido.
- Lo transitorio va en un solo `role="status"` y cada error en su `role="alert"`: el lector anuncia lo primero cuando puede y lo segundo en el acto. El tono no depende del color: cada aviso lleva su ícono y su verbo.
- `crearQueryClient()` siembra `onlineManager` con `navigator.onLine`. **No lo saques**: `onlineManager` arranca en `true` fijo y solo cambia con los eventos de `window`, así que abrir la app ya sin señal la dejaba creyendo que hay red, con las mutaciones fallando en vez de encolarse (ADR 0014).
- Un rechazo definitivo tapa la cola, que drena de a una. Por eso el formulario frena lo que la base rechazaría por `check` (el formato del CUIT y el del email) aunque el resto de la validación solo advierta.
- Si cambia la forma de los datos persistidos, subí `VERSION_CACHE`.
- El service worker precachea solo el shell: no agregues `runtimeCaching` para la API de Supabase.
- **La foto de perfil es la única escritura que no pasa por la cola** (ADR 0022): la cola maneja mutaciones de JSON, no archivos. `FormularioDePerfil` recorta y achica en el navegador (`features/editar-perfil/model`) y `subirFotoDeLaPersona` sube con `upsert` a `fotos-de-perfil/{usuario}/foto` y guarda la URL con `cacheNonce` en `user_metadata.foto`. Sin señal no abre el selector y lo dice. `esFalloDeRed` reconoce el `StorageUnknownError` de storage-js. Otro dispositivo ve la foto nueva recién cuando renueva la sesión, igual que el nombre.
- El bundle se parte en dos: el vendor en su propio chunk y el código de la app en otro (`manualChunks` en `vite.config.ts`). No baja el arranque, pero un cambio de pantalla deja de obligar a rebajar el bundle entero del precache (ADR 0015).

## Sistema de diseño

- Las pantallas se portan desde `design-reference/*.dc.html`, con el mismo markup y los mismos tokens. Cada pantalla tiene cuatro estados (cargando, vacío, con datos y error) y tres anchos (390, tablet y 1440).
- Solo se usan utilidades de tokens: `bg-ink`, `text-text-2`, `bg-hogar-tint`, `text-money-lg`, `rounded-panel`, `h-button`, `px-(--page-pad-mobile)`. Los colores y tamaños por defecto de Tailwind no existen, y no hay hex sueltos.
- Los componentes de `design-reference/src/components/app` conocen el dominio: van a `entities` o a `features`, no a `packages/ui`.
- **Nada se sale de su contenedor en 320 px**, y 360 tiene que verse cómodo. Lo que puede vivir en una columna (el formulario de proyecto, los tríos de importes, las filas de dos campos, los selectores segmentados) se adapta con consultas de contenedor, no con `sm:`/`md:` del viewport: el mismo formulario va a ancho completo en el celular y en media pantalla en la PC. Un selector que no entra pasa a dos filas; **nunca scroll horizontal**, que esconde opciones. `@container` va en un ancestro, no en el mismo elemento que usa `@sm:`.
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
- El household de prueba se vacía con `vaciarTaller` (proyectos primero, después clientes): la base rechaza con `MN003` la baja de un cliente con proyectos vivos.
- Playwright en `e2e/`, con cinco proyectos: `setup`, `acceso-celular` y `acceso-escritorio` (sin sesión, en `e2e/sin-sesion/`), y `celular` y `escritorio` (con sesión, en `e2e/con-sesion/`).
  - La primera vez hay que instalar chromium: `pnpm --filter @maun/web exec playwright install chromium`.
  - Necesita `apps/web/.env` con `VITE_SUPABASE_URL`, la publishable key y **`E2E_EMAIL` / `E2E_PASSWORD`**, que van sin prefijo `VITE_` porque no entran al bundle. Están en `.env.example`.
  - `setup` entra una vez por el formulario de verdad y guarda el `storageState`; los dos proyectos con sesión lo reusan.
  - **Corre contra el build (`vite build && vite preview`), no contra el dev server**: el service worker solo existe en el artefacto real, y sin él no se puede probar cerrar la app y reabrirla sin señal.
  - `workers: 1`: los proyectos comparten el household de la cuenta de prueba y cada test con sesión lo vacía antes de empezar (`e2e/apoyo/taller.ts`).
  - Ese taller se vacía en cada corrida: no lo uses para mirar datos a mano.

## Proyectos (ADR 0015)

- **El proyecto es un agregado: se guarda entero, con sus pagos y sus gastos, por `guardar_proyecto`.** Una sola mutación en la cola, una sola transacción en la base. No hay mutaciones sueltas de pagos ni de gastos, y no las agregues: el orden de la foreign key, la atomicidad y la cola que drena de a una son el motivo.
- La edición manda la fila entera del proyecto y la `version` que vio el usuario. Si la base cambió, rechaza con `MN006`. **Las filas hijas que el usuario sacó viajan marcadas con `borrado` en el mismo array, y solo las que existían**: la base nunca borra lo que el cliente no vio, porque `proyectos.version` no se mueve cuando solo cambian sus hijos.
- Una baja de fila hija lleva **solo su id**. El tipo `BajaDeFilaHija` lo hace irrepresentable de otra forma: mandar una fecha vacía rompía la llamada entera con un `22007` sin mensaje.
- **El formulario no se cierra hasta que la mutación resuelve o queda en pausa.** Con señal, un rechazo se ve ahí, con lo que el usuario escribió todavía en pantalla; sin señal, la mutación se pausa y el formulario se cierra igual.
- El select de estado ofrece solo el estado actual y sus transiciones válidas (`estadosDisponibles`): un estado inválido rebota con `MN007`, que es definitivo y tapa la cola.
- **En la ficha el estado se cambia con acciones, no con la insignia** (ADR 0029). `cambiosDeEstado` saca los destinos de `TRANSICIONES` y nunca ofrece `cobrado` ni `perdido`: cobrar y dar por perdido siguen afuera del panel, con sus pantallas. No escribas a mano en una pantalla qué estados se ofrecen. Las dos fichas usan `PanelDePaso` y guardan con `guardadoDeUnPaso`, que ya pasa por `ultimoContactoAlGuardar`. Lo que retrocede va a la derecha: si ocupara el lugar de lo que avanza, un doble toque desharía el paso.
- **El foco de una fila nueva lo pone `shouldFocus` de `useFieldArray`.** No agregues otro foco propio: compiten y el que llega tarde escribe en el campo equivocado.
- Las tres pestañas (`Seguimiento · Activos · Historial`) son rutas, no estado local: `/seguimiento` y `/proyectos` montan la misma pantalla. No hay `pages/seguimiento`.
- `despieceDelProyecto` y `DistribucionDespiece` los comparten la ficha y la pantalla de cobro: lo que cambia entre las dos es el modo (`real` o `proyeccion`), no la cuenta. La proyección sale de `calcularLiquidacion` del dominio, nunca del `despiece` del diseño, que reparte sobre el presupuesto.
- **El ordenamiento de listas es `shared/lib/orden.ts`**, compartido con Clientes. Lo que falta va al final en los dos sentidos y el desempate es estable. Si agregás una columna, es un `Criterio` más, no otro `sort`.
- `entregaEstimada` cuenta solo días de semana: acepta feriados por parámetro, pero **nadie le pasa una lista todavía**.

## Cobrar y liquidar (ADR 0016)

- **Cobrar y dar por perdido son pantallas propias** (`/proyectos/:id/cobrar` y `/cerrar`), no un botón con un modal. **No agregues un «¿estás seguro?»**: lo que confirma es el despiece con los importes reales, y el botón dice el verbo. Reabrir sí lleva confirmación liviana, porque deshace un reparto cerrado.
- **Toda liquidación se aplica optimista a la réplica con la fila entera congelada** (`filaLiquidada`), no solo con el estado. Si no, `liquidacionesDeLaReplica` deja de contarla, el acumulado del mes queda corto y el cobro siguiente rebota con `MN006`. Es el requisito que el ADR 0011 le dejaba al 2C.
- **La fila optimista sube la `version`.** Reabrir un cobro que todavía está en la cola manda la versión que el servidor va a tener cuando drene, no la que había antes.
- **La respuesta de un guardado no pisa una liquidación optimista** (`aplicarSiNoEsVieja`): al cobrar con pago final salen dos mutaciones y la primera vuelve con el proyecto todavía en `entregado`.
- **Un cobro encolado no está cobrado.** El indicador global no alcanza para plata: `MarcaDeLiquidacion` da el estado por fila y la distribución se muestra marcada como provisoria (`provisoria` de `DistribucionDespiece`). Los saldos de Inicio son los optimistas, con `LiquidacionesSinConfirmar` debajo diciendo cuántas faltan confirmar.
- **Los rechazos y los ajustes van a la bandeja de avisos** (`shared/lib/avisos`), que se persiste y **dura hasta que el usuario la descarta**. No uses el `gcTime` de la mutación para eso: una mutación en `error` no se persiste (`esPersistible` solo deja pasar `pending`), así que cerrar la app se la lleva.
- **Nunca muestres un `MNxxx` ni la palabra «versión».** `traducirRechazo(error, contexto)` de `@/shared/api` devuelve qué pasó y qué hacer; el contexto (la operación y el proyecto) es lo que distingue un `MN001` al cobrar de un `MN001` al guardar un gasto.
- **La app manda el acumulado del mes que vio** (`liquidacion.previo`). Si no es el de la base, la liquidación vuelve **ajustada**, no rechazada: se compara `dist_sueldo_previo_centavos` contra lo que se mandó (`ajusteDeLaLiquidacion`) y se explica la diferencia en plata.
- **El formulario bloquea los pagos y los gastos de un proyecto liquidado, y ese aviso lleva el botón para descongelarlo.** No es un adorno: sin él es un callejón sin salida, que es lo que el ADR 0011 prohíbe. Al descongelar desde ahí hay que mover tres cosas o el guardado siguiente rebota: la versión que se va a mandar (la reversión la subió), el `estado` del formulario (seguía en `perdido`, y eso sale `MN007`) y a dónde ir al guardar, que pasa a ser la pantalla de liquidación.
- El corte se anima con `clip-path` y un retraso por pieza, una sola vez, por el `state` de la navegación. `prefers-reduced-motion` ya lo neutraliza `theme.css`: no agregues un caso especial.
- **`vaciarTaller` del e2e descongela antes de borrar** (`descongelarProyectos`): un liquidado con pagos o gastos no se borra (`MN001`) y sin borrarlo tampoco se borra su cliente (`MN003`).
- `useLiquidacionEnVuelo` filtra **todas** las mutaciones pendientes, y el guardado del agregado también lleva un `pedido`: lo que distingue a una liquidación es que el suyo trae `proyectoId`. Si agregás otra mutación con esa forma, ajustá el filtro.

## Finanzas, el diezmo y los movimientos (ADR 0018)

- **El libro se arma con `lineasDelTaller`, no con `asientosDelLibro`.** Una línea es una operación
  (una transferencia es **una** fila, con `desde` y `hacia`); un asiento es un lado. Los saldos siguen
  saliendo de los asientos. Si agregás algo al libro, agregalo a la línea: `asientosDelLibro` es
  `lineasDelLibro(...).flatMap(asientosDeLaLinea)` y no puede divergir.
- **El filtro por sentido tiene cuatro opciones, no tres**: Todo, Entradas, Salidas y Entre tesoros.
  Una transferencia no es un ingreso ni un gasto y no se muestra como si lo fuera.
- **El saldo de DIEZMO no se muestra como número con signo en ningún lado.** `estadoDelDiezmo` (dominio)
  dice la situación y `fraseDelDiezmo` la escribe: «Debés $X», «Estás al día», «Pagaste $X de más». Si
  aparece un lugar nuevo donde se vea el diezmo, va la frase, no el saldo.
- **Los ocho tipos manuales salen del catálogo `CLASE`** de `entities/movimiento`: cada clase fija
  `tipo`, `desde` y `hacia`, así que el formulario no puede armar una combinación que el `check`
  `movimientos_forma_segun_tipo` rechace. Para agregar un tipo, se agrega una clase.
- **Lo derivado de un proyecto y los ajustes no se editan ni se borran**, y eso se ve **antes**: la
  ficha de sólo lectura muestra Editar y Borrar deshabilitados con el motivo y el camino. No saques
  los botones: ausentes no explican nada.
- Sin virtualización de listas y sin librería de gráficos. El gráfico del mes es `aria-hidden` y la
  tabla con los mismos números vive detrás de «Ver los números», visible para cualquiera.

## Seguimiento (ADR 0019)

- **Un contacto es una fila de `proyectos` en fase de seguimiento.** No tiene tabla ni mutación
  propia: todo pasa por `MUTACION_DE_PROYECTO`, y la seña es un pago del agregado. No agregues una
  tabla de leads: la seña tendría que mudarse al aprobar, y eso es lo que no puede pasar.
- **La ficha es `/proyectos/:id` y elige la vista por la fase** (`FichaDeContacto` o la de obra). No
  agregues `/seguimiento/:id`: los avisos, el cierre y `rutaDelProyecto` ya apuntan a la otra.
- **El orden y el próximo paso se derivan, no se cargan.** La espera cuenta desde
  `proyectos.ultimo_contacto`, que escriben solos los pasos y no las ediciones: cargar el contacto,
  cambiar de etapa y aprobarlo pasan por `ultimoContactoAlGuardar`. Si está vacío, cuenta desde el día
  de `ultimasActividades` (el `updated_at` más nuevo entre la fila, sus pagos y sus gastos).
  `contactosEnOrden` ordena por ese día y después por la última actividad, y `situacionDelContacto`
  escribe la frase. Las visitas agendadas van al final. **Un paso nuevo que cambie la etapa tiene que
  pasar por `ultimoContactoAlGuardar`**, o la espera vuelve a mentir.
- **El pasaje (`/proyectos/:id/aprobar`) manda `pagos: []`**: la seña no se toca, así que no viaja ni
  se duplica. `ProyectoPasajePage` decide si deja entrar **al montarse**, con un `useState`: la fila
  optimista pasa a `en_curso` antes de la respuesta, y una guarda por render desmontaría el formulario
  antes de que un rechazo se viera.
- **La fila optimista de un guardado y de las notas sube la `version` si cambia alguna columna**
  (`versionDelGuardado`). Sin eso, dos pasos seguidos sin señal rebotan con `MN006`. La respuesta se
  aplica salvo que la réplica tenga algo más nuevo que la versión que dejó esta mutación y que la que
  devolvió la base.
- **El teléfono vive en el cliente.** La hoja liviana encola la edición del cliente antes del guardado
  del contacto.
- **La seña se edita desde la hoja solo si hay cero o un pago.** Con varios, el campo muestra el total y
  manda al detalle.
- **`Marco` no enfoca el `<main>` si el foco ya está adentro de un `dialog[open]`**: si no, una hoja
  abierta por ruta (`/seguimiento/nuevo`, `/finanzas/nuevo`) perdía el foco del primer campo.
- **Una hoja por ruta se abre encima de la pantalla desde la que se abrió** (`shared/lib/hojas.ts`,
  ADR 0020). El link manda `state={conFondo(location)}`, `Marco` renderiza las pantallas con esa
  ubicación de fondo y las hojas en su propia capa. Cerrar es `useCerrarHoja()`: con fondo es volver
  atrás (así el botón atrás del navegador la cierra), y entrando directo por la URL cae en el fondo por
  defecto de `HOJAS_POR_RUTA`. No vuelvas a un `?volverA=`: el fondo viaja en el `state`.
- **Toda hoja es `Hoja` de `@/shared/ui`**, un `<dialog>` nativo con `showModal`, y entra y sale con
  CSS (`@starting-style` y `transition-behavior: allow-discrete`). Para que la salida se vea, quien la
  abre la envuelve en `ConSalida`, que la deja montada hasta que termina la transición. jsdom no tiene
  `showModal`: el polyfill vive en `vitest.setup.ts`.
- **Los gastos de un contacto salen de MAUN desde que se cargan** (ADR 0011). Es una diferencia
  deliberada con el sistema viejo, decidida con el dueño (ADR 0019), y el e2e la deja escrita: no la
  «arregles».
- Proyecto nuevo solo ofrece estados de obra: un contacto entra por Seguimiento.

## Cosas que muerden en el e2e

- **Antes de `context.setOffline(true)` hay que esperar dos cosas**: `navigator.serviceWorker.ready`, porque el service worker es el que sirve el shell al reabrir, y que la réplica ya esté guardada en IndexedDB. Sin lo segundo, reabrir sin señal encuentra el dispositivo vacío.
- **`page.goto` reinicia la app**, y una mutación recién encolada puede no haber llegado todavía a IndexedDB: un cobro sin señal seguido de un `goto` se pierde. Para encadenar dos operaciones sin señal, navegá por la interfaz (los `Link`) en vez de recargar. Cerrar y reabrir la app sí se prueba, pero después de esperar a que el cambio esté aplicado.
- **PostgREST rechaza un `PATCH` sin filtro** con un `21000` («UPDATE requires a WHERE clause»), aunque la RLS ya deje una sola fila a la vista: los helpers que editan por REST llevan el filtro igual.
- El navegador **normaliza `0ms` a `0s`** al leer una custom property computada: para afirmar sobre una duración, comparar el número y no el texto.
- **`saldosEnInicio` vive en `e2e/apoyo/pantalla.ts`** y la tarjeta de DIEZMO no trae importe cuando está al día: el helper devuelve 0 en ese caso y negativo cuando dice «de más». Un helper que asume «siempre hay un `$`» se rompe con el taller vacío.
- **Un cambio hecho por REST después de que la app cargó no aparece con un `page.goto`.** La réplica tiene `staleTime` de 60 s: al volver a montar, TanStack la considera fresca y no refetchea. O se hace el cambio **antes** del primer `goto`, o se cambia desde la interfaz.
- **`contactoPorRpc` crea el cliente como «Cliente de {título}»**, así que `getByRole('link', { name: título })`
  sin `exact: true` encuentra dos enlaces (el del trabajo y el del cliente) y rompe por modo estricto.
- **La primera carga de un contexto nuevo puede pasar de cinco segundos** en «Trayendo los datos del
  taller»: no hay nada en IndexedDB y la réplica sale de `bootstrap()`. Un recorrido con `Tab` que
  arranca ahí no encuentra nada. `abrir()` de `seguimiento.spec.ts` espera al `<main>` antes de seguir.
- **`page.clock.setFixedTime` antes del `goto` manda al login**: con el reloj adelantado días, el token
  guardado está vencido. Para probar «hace N días» se adelanta el reloj **después** de que la app cargó y
  se fuerza un render navegando (una pestaña y vuelta).
- **`getByRole('status')` no es el indicador de sincronización a secas.** Los avisos viven en un `role="status"` que está siempre en el DOM, y `Cargando` también es un `status`. Usá `indicadorDeSync(page)` y `avisosEnPantalla(page)` de `apoyo/pantalla.ts`. Para esperar a que la cola drene conviene preguntarle a la base (`expect.poll` sobre un helper de `apoyo/taller.ts`), que además es la afirmación que importa.
- **`listoParaCortar` espera una señal positiva**: el `<main>` a la vista y ningún `Cargando`. Esperar solo a que el indicador se vaya no alcanza: con la réplica todavía bajando el indicador no está, y cortar ahí deja el dispositivo vacío («No pudimos leer tus datos»).
- **`not.toContainText` sobre un locator que no existe falla** («element(s) not found»). Para decir que un aviso no apareció, `filter({ hasText })` y `toHaveCount(0)`.
- **`request.postDataBuffer()` no trae el cuerpo de una subida multipart con un `Blob`**: da `null`. Para medir lo que sube la app, `foto.spec.ts` envuelve `fetch` con `addInitScript` y anota el tamaño, el tipo y el SHA-256 del archivo; con la huella se comprueba que la URL nueva sirve la foto nueva.
- `foto.spec.ts` escribe en Storage con la cuenta de prueba: la subida corre una vez por corrida, solo en `escritorio`. `scroll.spec.ts` corre en `celular`, porque en 1440×900 Inicio no llega a scrollear.
- **La huella se prueba con el autenticador virtual del protocolo de DevTools** (`e2e/apoyo/huella.ts`). La sesión de CDP y el autenticador se crean antes de navegar, y las respuestas de passkeys de Supabase se simulan: con el RP ID de producción, `localhost` no puede registrar nada.
- **Cerrar sesión en un test intercepta `**/auth/v1/logout**`.** `signOut()` es global y revocaría la sesión guardada que usan los demás proyectos.
- **Chromium headless nunca pasa una página a segundo plano.** Para probar el bloqueo al volver, `visibilidadControlable` (`apoyo/huella.ts`) reemplaza `document.visibilityState` antes de cargar y `aSegundoPlano`/`alFrente` disparan el evento. El tiempo afuera va con `page.clock.install()` antes del primer `goto` y `fastForward`; el reloj es del contexto entero, así que un segundo `install` en el mismo test va en `context.clock` antes de abrir la página nueva. **Al recargar, el navegador dispara su propio `visibilitychange`**, que con la visibilidad reemplazada llega como «oculta» por segunda vez: por eso la app anota la salida solo en la transición de visible a oculta, y un test que lo cambie vuelve a renovar el momento en cada recarga.
- **Los toques se prueban con `Input.dispatchTouchEvent` de CDP** (`tirar-para-actualizar.spec.ts`), en el proyecto `celular`, que tiene `hasTouch`. **Después de navegar con la barra, esperá a que termine la view transition** (`document.activeViewTransition`): un toque que empieza durante la transición va a la raíz, y todo ese gesto sigue yendo ahí.
- **Para simular que el evento `online` no llegó, el listener que lo calla se registra con `addInitScript`.** Se comprobó que uno de captura agregado después de que cargó la app no frena a `onlineManager`, que ya estaba escuchando en `window`.
- **Con `page.clock.install()` una recarga no se ve como recarga.** Con el reloj instalado, recargar estando adentro pedía la huella; sin el reloj, no (lo más probable es que el reloj falso reemplace `performance` y la entrada de navegación no llegue). La recarga sin huella se prueba sin reloj, y el «rato largo adentro» se escribe en la marca.
- **Después de `page.reload()` con `context.setOffline(true)`, `navigator.onLine` vuelve a dar `true`** (medido en el bloqueo): la app arranca creyendo que hay señal. Para que se entere, `window.dispatchEvent(new Event('offline'))`, que es lo que escucha `onlineManager`.
- Chromium headless sin autenticador rechaza la mediación condicional con `NotSupportedError`. La app lo calla; un test que espera la ceremonia necesita el autenticador virtual.
- **Un `vite preview` que quedó levantado en el 4173 se reusa** (`reuseExistingServer`), y el e2e corre contra un build viejo. Bajalo antes de correr.
