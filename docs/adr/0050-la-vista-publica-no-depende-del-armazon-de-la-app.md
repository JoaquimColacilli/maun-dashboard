# 0050. La vista pública no depende del armazón de la app

Estado: aceptada, 2026-09-19. Corrige al [0013](0013-shell-navegacion-e-inicio.md) en el alcance
del anclaje de la raíz, y al [0035](0035-un-service-worker-propio.md) en el respaldo de navegación.
Actualizado por el [0061](0061-el-aviso-de-version-sale-del-registro.md): quien registra el service
worker ya no es `AvisoActualizacion` sino el módulo de la versión nueva, que `arrancar()` no prende
en `/v/` ni en `/o/`. El cliente sigue sin registrar nada.

## Contexto

El hermano del dueño tocó el enlace de un cliente desde WhatsApp, con la app instalada, y la
página quedó clavada en la primera pantalla: no scrolleaba. Las fotos estaban compartidas y no las
veía, porque están abajo.

Medido con el dedo por CDP, a 390×844:

| entrada                                                          | scrollea         | recorrido con el dedo | el final se ve                              |
| ---------------------------------------------------------------- | ---------------- | --------------------- | ------------------------------------------- |
| el enlace, en una pestaña, sin sesión                            | **nadie**        | **0 px**              | **no** (el final a 1975 px, ventana de 844) |
| el enlace, con la sesión del dueño y el service worker sirviendo | **nadie**        | **0 px**              | **no**                                      |
| el botón de la ficha, adentro de la app                          | `main#contenido` | 1325 px               | sí                                          |

La causa es una sola y está en el CSS: `#root` es `position: fixed; inset: 0; height: 100dvh;
overflow: hidden`. Se escribió para el `Marco`, que crea su propio contenedor con `overflow-y:
auto`. Toda pantalla de la app tiene el suyo: las del taller en `Marco`, las de acceso en
`PantallaDeAcceso` (`h-full overflow-y-auto`, que es lo que ya había arreglado esta misma trampa en
las pantallas de sesión, [ADR 0023](0023-sesion-bloqueo-con-huella-y-passkeys.md)). `/v/:token` es
la única que no lo tiene. **No depende del teléfono ni del modo instalado: depende de por dónde entró.**

En Android, con la app instalada, un enlace dentro del `scope` del manifiesto se abre en la app, y
el `scope` es un prefijo: no hay forma de excluir `/v/`. Así que la página tiene que andar ahí.

## Decisión

**La vista pública fluye y scrollea el que la contiene. En `/v/` la contiene el documento.**

- El anclaje de la raíz se apaga con una marca que pone el script de arranque de `index.html`
  —`document.documentElement.dataset.vista = 'publica'`— **antes de que React monte nada**. Una
  regla que dependa de que la pantalla ya haya renderizado llega tarde. Con la marca puesta, `#root`
  vuelve a `position: static; height: auto; overflow: visible`, y `overscroll-behavior-y` vuelve a
  `auto`: el gesto nativo de tirar hacia abajo es correcto en una página que abren desconocidos.
- **En `/v/` no se monta nada que dependa de la sesión del dueño.** `App` elige el proveedor por la
  ruta: la vista pública lleva un `QueryClientProvider` pelado, sin persistencia en IndexedDB, sin
  `escucharSesion`, sin cola de salida y sin las mutaciones registradas. En el navegador del
  cliente no queda nada guardado (verificado: ni una base de IndexedDB, y en `localStorage` solo el
  tema).
- **Por el enlace, la base se consulta siempre como anónimo.** `vistaCompartida` usa un cliente de
  Supabase propio, sin sesión (`persistSession: false`). Antes usaba el de siempre, y con la sesión
  del dueño guardada en ese navegador el RPC se ejecutaba como `authenticated` (medido). El dueño
  que abre su propio enlace tiene que ver exactamente lo que ve el cliente.
- **`/v/` sale del respaldo de navegación del service worker** (`denylist`). Esa página necesita red
  igual, porque sus datos se piden en el momento; servirla desde el precache la ata al ciclo de
  actualización de la app del dueño. El HTML de `/v/` sale siempre de Netlify, igual para todos.
- **Un cliente que entra por `/v/` no registra el service worker ni recibe el manifiesto.** Lo
  primero ya era así —`AvisoActualizacion`, que es quien registra, vive en `Shell`, y `/v/` está
  afuera— y ahora está verificado. Lo segundo es nuevo: el link al manifiesto lo inyecta
  vite-plugin-pwa en el `index.html` de todas las rutas, y en `/v/` lo saca la función de borde
  (ADR 0049), más el script de arranque para los entornos donde esa función no corre.

## Alternativas descartadas

- **Copiar el `h-full overflow-y-auto` de `PantallaDeAcceso`.** Anda, pero deja la página adentro
  de una caja de alto fijo: la barra del navegador no se esconde al bajar, buscar en la página
  scrollea mal y el teclado tapa. Para una página que abren desconocidos en cualquier navegador,
  que scrollee el documento es lo más robusto que hay.
- **Mover la app a un `scope` más angosto** (`/app/`), para que el enlace se abra en el navegador y
  no adentro de la app instalada. Arregla el síntoma de raíz, pero cambia la URL de todo y obliga
  al dueño a reinstalar. Queda como salida de fondo si algún día molesta otra cosa del modo
  instalado.
- **El enlace en otro dominio.** Lo mismo, con un certificado y un deploy más.
- **`display_override` o el manejo de enlaces declarativo.** Experimental; no se puede prometer.

## Consecuencias

- Hay un prefijo, `/v/`, escrito en tres lugares que no pueden divergir: el script de arranque de
  `index.html`, el `denylist` del service worker y `PREFIJO_DE_LA_VISTA_PUBLICA`. Un test compara
  los tres contra la constante.
- La regla nueva, para cualquier pantalla futura: **la única ruta afuera de `Shell` no hereda nada
  del armazón**, y eso incluye el CSS de la raíz, los proveedores y el cliente de la base.
- **Al hermano el arreglo le llega cuando actualice.** La app instalada tiene el service worker
  viejo, que le sirve el `index.html` viejo. Al abrir la app con señal, el service worker nuevo se
  descarga y queda en espera; entonces aparece «Hay una versión nueva» y él toca «Actualizar». No
  hay que desinstalar nada. Hasta ese momento, un enlace que toque desde WhatsApp sigue sin
  scrollear; si lo necesita antes, abrirlo desde el navegador (mantener apretado el enlace y
  «Abrir en Chrome») ya anda, porque ahí el HTML sale de Netlify.
- **Lo que no se pudo reproducir**: `display-mode: standalone` de verdad. `Emulation.setEmulatedMedia`
  acepta `display-mode` y lo ignora (`matchMedia` sigue diciendo `browser`), y Playwright no deja
  manejar una ventana abierta con `--app=`. No hace falta para este caso: el CSS del repo no
  consulta `display-mode` en ningún lado, y el problema se reproduce en una pestaña.
