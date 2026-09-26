# 0073. La app se llama NUMA; el taller sigue siendo MAUN

- Estado: aceptada
- Fecha: 2026-09-25. Cambiada el 2026-09-26, antes del merge: la dirección también se muda, a
  `numa-dashboard.netlify.app` (ver «La dirección nueva»). La primera versión la dejaba como estaba.
- Enmienda al [0068](0068-la-mesa-y-el-plano.md) (el «MAUN» de la barra lateral y del panel de
  acceso pasa a ser el logotipo, y el menú de «Cargar algo nuevo» pasa de `top-[81px]` a
  `top-[71px]`), al [0049](0049-la-vista-previa-del-enlace.md) (la imagen de la vista previa es el
  ícono del taller, `taller-512.png`, y la página del cliente trae los íconos del taller), al
  [0050](0050-la-vista-publica-no-depende-del-armazon-de-la-app.md) (el arranque del documento cambia
  además los íconos en `/v/` y `/o/`), al [0023](0023-sesion-bloqueo-con-huella-y-passkeys.md) (el
  panel de la marca, y el RP ID de las passkeys, que va con la dirección nueva), al
  [0012](0012-acceso-sesion-y-cola-de-salida.md) (el `site_url` y las redirecciones de Supabase), al
  [0020](0020-pulido-visual.md) (el nombre del logo, «NUMA, ir a Inicio») y al
  [0035](0035-un-service-worker-propio.md) (el título de respaldo y los íconos del push).
- Lo sigue el [0074](0074-lo-que-responde-al-tocar.md), el movimiento, que vino en el mismo pedido.

## Contexto

El hermano de Joaquim, que es quien usa la app todos los días, le buscó un nombre que no sea MAUN.
Escribió en Miro, con los acentos puestos: «Estuve jugando un poco con ChatGPT para inventarle un
nombre que no sea MAUN. Creo que Numa está bueno, por "NUevas MAneras" de gestionar el taller.
Contiene un guiño a MAUN, porque están las mismas letras.»

Probó logos con tres IA:

- **ChatGPT**: un aparador de línea, con patas, cuyas puertas forman una N. «Esto fue lo primero que
  creó ChatGPT, pero sigo con interacciones a ver qué surge.»
- **Meta**: «NUMA» en una letra de palo seco redonda y muy gruesa, en negro, con la bajada «FOR SMALL
  BUSINESSES · WORKSHOPS». «Esta la tiró Meta. Estoy haciendo interacciones (por si se ve infantil,
  aunque me gusta).»
- **Gemini**: el mismo estilo en azul; uno con una herramienta metida en la N y la bajada «Nuevas
  Maneras de gestionar tu taller», uno limpio, uno blanco en un círculo azul y una N sola en un
  círculo azul («Básico, pero puede funcionar»).
- Y un «NUMA» negro en una letra de palo seco geométrica, de puntas rectas.

Joaquim marcó el de Meta, y es el que queda.

## Lo que decidió Joaquim antes de empezar

1. **NUMA es el nombre de la app, no del taller.** El taller sigue siendo MAUN Muebles, su tesoro
   sigue siendo `maun`, y lo que ve un cliente no cambia, salvo la dirección del enlace (puntos 3 y 6).
   La app es la herramienta; el taller es el negocio, y el negocio no cambió de nombre.
2. **El logotipo es el de Meta, redibujado limpio sobre una grilla y sin la bajada en inglés.** La
   app habla castellano, y la bajada no suma nada adentro de la app.
3. **El cliente no ve NUMA, salvo en la dirección.** Su página es del taller y no le ofrece instalar
   la app (0049). Lo que hoy le muestra la M (la imagen de la vista previa en WhatsApp, y el ícono y la
   pestaña de `/v/` y `/o/`) sigue mostrando esa M, y los textos de respaldo siguen diciendo «MAUN» y
   «Taller MAUN». La dirección del enlace sí dice `numa-dashboard` (punto 6).
4. **El ícono es la N del logotipo, en papel sobre tinta, como hoy la M.** Una sola letra se lee en
   16 px y en la pantalla de inicio, y es el mismo dibujo que el logotipo.
5. **Adentro no se renombra nada.** `@maun/*`, las claves guardadas, la base de IndexedDB y los
   nombres de las animaciones quedan como están, y también el `name` del `package.json` y el
   `project_id` de `supabase/config.toml`. Son nombres internos: no se ven.
6. **La dirección se muda a `numa-dashboard.netlify.app`.** Joaquim renombró el sitio de Netlify el
   26 de septiembre, cambió la configuración de Supabase y el sujeto de los avisos, y sumó la dirección
   al pedido. `maun-dashboard.netlify.app` dejó de existir y no se redirige: no quiere mantener un
   segundo sitio. La primera versión de este ADR dejaba el dominio como estaba porque es el RP ID de
   las passkeys y la dirección de cada enlace ya mandado; los dos costos se aceptan, y están en «La
   dirección nueva».

**La regla que manda: NUMA es la app; MAUN es el taller.** El nombre nuevo va donde la app habla de
sí misma: la pestaña, el manifiesto, el logo, el acceso, los avisos del sistema y la dirección. Donde
se habla del taller o de su plata, y en todo lo que ve un cliente salvo la dirección, queda lo de hoy.

## Decisión

### El dibujo

El logotipo es una línea gruesa de puntas y codos redondos sobre una grilla de 200 de alto: trazo de
44 (el 22 %), travesaño de la A de 38 (más fino, para que no pese), letras de 158, 154, 186 y 156 de
ancho, y 28 entre letra y letra. Joaquim lo superpuso a la imagen de Meta a 90 px de alto y coinciden
en un 95 %. A propósito, todas las letras llevan el mismo grosor: la imagen de Meta engorda las
diagonales de la M.

```svg
<svg viewBox="0 0 738 200" fill="none" stroke="currentColor" stroke-width="44"
  stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 178V22L136 178V22"/>
  <path d="M208 22V123A55 55 0 0 0 318 123V22"/>
  <path d="M390 178V22L461 112L532 22V178"/>
  <path d="M604 178V78A56 56 0 0 1 716 78V178"/>
  <path d="M604 126H716" stroke-width="38"/>
</svg>
```

Las medidas cierran: la N va de 0 a 158 (los ejes en 22 y 136, más medio trazo), la U de 186 a 340,
la M de 368 a 554 y la A de 582 a 738, con 28 entre cada una; la panza de la U y la cabeza de la A
tocan 200 y 0. El isotipo es el primer trazo solo, en `viewBox="0 0 158 200"`.

### Dónde vive

- **Los trazos, en `packages/ui/src/marca/trazos.ts`**, un `.ts` sin JSX: las medidas, los trazos,
  las cajas y `trazosEnSvg`, que arma los caminos para un SVG suelto. `@maun/ui` lo expone como
  `./marca`, con `@maun/source` apuntando al archivo y `types` y `default` a `dist`, como la salida
  principal. Es lo que importa el script de los íconos, que corre en Node y no puede leer `.tsx`.
- **`Logotipo` e `Isotipo`**, exportados de `@maun/ui` (`marca/Marca.tsx`), dibujan esos trazos en
  `currentColor`. Por defecto son la marca: `role="img"` y `aria-label="NUMA"`. Con `decorativa` van
  `aria-hidden`, para cuando están adentro de algo que ya se nombra. El tamaño lo da quien los usa,
  con el alto y `w-auto`.
- **Dónde va**, cada uno a la altura de las mayúsculas del texto que reemplaza. Se midió con la letra
  real, contando los píxeles de «MAUN» en Young Serif a ×4: 27,25 px a 36 px y 23 px a 30 px.
  - **La barra lateral**: el logotipo de 27 px en lugar del «MAUN» de 36 px. El pedido estimaba
    «unos 24 px» mirando una captura; se siguió la regla (la altura de las mayúsculas) y no el número.
    «Taller» queda a su derecha, apoyado en la base de las letras, y el enlace conserva `min-h-tap`.
  - **El renglón de la barra lateral bajó de 54 a 44 px** (el alto de la línea de 36 px contra el de
    la zona táctil), así que «Cargar algo nuevo» sube 10 px. Medido como en el 0068, con la cuenta de
    prueba a 1440: antes el botón empezaba en 96 y el menú en 81, 15 px arriba del borde del botón;
    ahora el botón empieza en 86 y el menú, con `top-[71px]`, en 71. Sigue a 15 px.
  - **El riel**: el isotipo de 23 px en lugar de la «M» de 30 px, adentro de la misma caja de 44 px.
    No mueve `top-[84px]`: el botón sigue en 82 y el menú en 84, como antes.
  - **El panel de acceso y de bloqueo**: el logotipo de 23 px en lugar del «MAUN» de 30 px, en
    `text-sobre-marca`, en un renglón de 30 px con 2 px arriba, que es donde empezaban las mayúsculas.
  - **`LogoAInicio`** se llama «NUMA, ir a Inicio», y el dibujo adentro va `aria-hidden`.

### Los íconos

Salen del trazo de la N con `apps/web/scripts/iconos.ts`, que corre con
`pnpm --filter @maun/web iconos` (`node --conditions=@maun/source scripts/iconos.ts`, como
`db:migrar`). Importa `@maun/ui/marca` y `chromium` de `@playwright/test`, arma cada SVG con
`scripts/iconos/dibujo.ts` y lo pasa a PNG con el Chromium que ya está instalado. El ICO se escribe a
mano: una cabecera de 22 bytes y el PNG adentro. Tinta `#141414` y papel `#ffffff`, que son `--color-ink` y `--color-paper` en claro.

| Archivo                     | Lado | Cómo es                                                                                           | Peso    |
| --------------------------- | ---- | ------------------------------------------------------------------------------------------------- | ------- |
| `numa.svg`                  | 512  | cuadrado con `rx` 96 en tinta y la N en papel al 58 %; en oscuro, cuadrado `#ededed` y N en tinta | 474 B   |
| `favicon.ico`               | 32   | `numa.svg` en claro                                                                               | 668 B   |
| `numa-192.png`              | 192  | cuadrado redondeado con las esquinas transparentes, N al 50 %                                     | 3,6 KB  |
| `numa-512.png`              | 512  | lo mismo: de 13 a 499, radio 81                                                                   | 10,4 KB |
| `numa-enmascarable-512.png` | 512  | tinta de borde a borde, N al 48 %, adentro del círculo seguro                                     | 6,4 KB  |
| `numa-apple-180.png`        | 180  | tinta de borde a borde, opaco, N al 50 %                                                          | 2,1 KB  |
| `numa-insignia-96.png`      | 96   | fondo transparente, N blanca al 70 %                                                              | 1,2 KB  |

- **Los nombres son nuevos a propósito.** No se confunden con los de la M, y Chrome decide que un
  ícono cambió si cambió el campo `icons` del manifiesto (la URL o sus datos): si algún día cambia el
  dibujo, cambia el nombre.
- **La N del enmascarable entra en el círculo de radio 40 %**: mide 245,8 de alto por 194,1 de ancho,
  y la media diagonal (156,6) queda debajo del radio (204,8). Se miró recortado.
- **El de inicio del iPhone y el enmascarable son opacos** (PNG sin canal alfa): iOS pinta de negro
  lo transparente de un `apple-touch-icon`.
- **La insignia es la N sola sobre transparente.** Android dibuja la insignia con la transparencia;
  la de antes, `pwa-64x64.png`, era opaca y se veía un cuadrado lleno.
- **Los de la M que ve el cliente cambian de nombre con `git mv`**: `pwa-512x512.png` pasa a
  `taller-512.png`, `favicon.svg` a `taller.svg`, `apple-touch-icon-180x180.png` a `taller-180.png` y
  `favicon.ico` a `taller.ico`. El `favicon.ico` nuevo es la N. `maskable-icon-512x512.png` se borra.
- **`pwa-64x64.png` y `pwa-192x192.png` se borran.** La primera versión los dejaba una versión para el
  service worker viejo, que los pide para los avisos. Pero ese worker los pide a su propio origen, la
  dirección vieja, que ahora contesta 404: en la nueva no los usaba nadie.
- **`scripts/iconos.test.ts` lee los archivos**: que cada ícono del manifiesto y del `index.html`
  exista y mida lo que dice (el ICO por su cabecera), que el de inicio y el enmascarable sean opacos,
  que los del manifiesto tengan las esquinas transparentes, que la insignia sea la N blanca sobre
  transparente, que `numa.svg` sea exactamente lo que arma el script con los trazos de hoy, que la
  tinta y el papel sean los de `theme.css`, y que existan `IMAGEN_DE_LA_VISTA` y los cuatro del
  taller, con la M. Un cambio en los trazos sin regenerar los íconos lo rompe.

### El manifiesto, el `head` y el push

- **`vite.config.ts`**: `id: '/'`; `name` y `short_name` «NUMA»; `description` «Nuevas maneras de
  gestionar el taller.»; los íconos nuevos; e `includeAssets` con los tres del `head` de la app y los
  tres del taller. `start_url`, `scope`, los colores y los nombres del manifiesto y del service worker
  no se tocan.
  - **El `id` no salva a la app instalada de antes**: el `id` es una URL que se resuelve contra el
    origen (W3C), así que en la dirección nueva la app es otra igual. Lo que hace es fijar la de ahora
    desde su primera instalación: sin `id`, la identidad es el `start_url`, y cambiarlo más adelante
    crearía otra app.
- **`index.html`**: `<title>NUMA</title>`, la misma descripción, `favicon.ico` con `sizes="32x32"`,
  `numa.svg` y `numa-apple-180.png`. No se suman `apple-mobile-web-app-title` ni `application-name`
  (ver alternativas).
- **`sw.ts`**: el título de respaldo de un push dice «NUMA», el ícono es `numa-192.png` y la insignia
  `numa-insignia-96.png`.

### Lo que ve el cliente

- **`conLasEtiquetas`** saca los íconos de la app del `head` de `/v/` y `/o/`, junto con el título, la
  descripción y el manifiesto, y pone los tres del taller en el bloque que agrega:
  `taller.ico` (48×48), `taller.svg` y `taller-180.png`. `IMAGEN_DE_LA_VISTA` pasa a
  `/taller-512.png`, el mismo PNG de 512 y 2,7 KB de siempre con otro nombre.
- **El arranque del documento** hace lo mismo en el navegador cuando la función de borde no corrió:
  además de sacar el manifiesto, cambia los tres íconos por los del taller. `etiquetas.test.ts` ata
  los dos: las mismas URL viejas y las mismas nuevas.
- **La pestaña de `/v/` pone su título** con `comoSeVeEnWhatsapp`, el espejo de la función de borde:
  «Cocina Lucas · MAUN Muebles», o «MAUN» mientras carga o si el enlace no sirve. Así, si la función
  de borde no corre, la pestaña del cliente no queda diciendo el «NUMA» del `index.html` crudo. La
  encuesta ya lo hacía. La vista previa de adentro de la app no lo toca.
- **`TITULO_GENERICO`, su espejo en `compartir.ts` y la firma «Taller MAUN» quedan como están.**
- **La dirección del enlace ahora dice `numa-dashboard`**, también en la tarjeta de la vista previa de
  WhatsApp, que muestra el dominio. La página, su título, la vista previa y los íconos siguen siendo del
  taller.

### La dirección nueva

**Qué se mudó.** Afuera del repo, lo hizo Joaquim el 26 de septiembre: el nombre del sitio de Netlify;
en Supabase, el `site_url` y las redirecciones permitidas (`http://localhost:5173/**`,
`https://numa-dashboard.netlify.app/**` y `https://*--numa-dashboard.netlify.app/**`); y el secreto
`VAPID_SUBJECT` de la función de avisos. Las claves VAPID y `AVISOS_SECRETO` no cambiaron. Adentro del
repo, `supabase/config.toml` (que espeja producción) y los datos de prueba de `etiquetas.test.ts`,
`errores.test.ts`, `vuelta-por-un-aviso.test.ts` y el test de la función de avisos; el texto de la
pantalla de compartir para los enlaces de antes del 0052; y se borran `pwa-64x64.png` y
`pwa-192x192.png`. **El código de la app no escribe la dirección en ningún lado**: los enlaces
(`enlaceDelCliente`, `enlaceDeLaEncuesta`) y las vueltas de los correos salen de `location.origin`, y la
función de borde arma `og:url` y la imagen con el origen del pedido. Así que la app ya los arma con la
dirección nueva.

**Qué se pierde al cambiar de origen.** Todo lo que el navegador guarda es por origen, y
`numa-dashboard.netlify.app` es otro. En cada aparato, la app de la dirección nueva arranca vacía:

- **La sesión** (`maun.sesion`): hay que entrar de nuevo con el mail y la contraseña, y eso necesita
  señal.
- **Lo que no se sincronizó**: la cola vive en la base `maun` de IndexedDB del origen viejo, y la app
  nueva no la ve. Se manda desde la app vieja, con señal, antes de dejarla.
- **La app instalada**: la de la dirección nueva es otra app, y se instala de nuevo en cada aparato. La
  vieja no se actualiza nunca más: su service worker pide `sw.js` a un sitio que contesta 404.
- **La suscripción de los avisos**: es una por aparato y por origen (0036). En la nueva hay que
  activarlos otra vez. La vieja sigue anotada en la base, y mientras el worker viejo siga registrado le
  pueden seguir llegando (se razona; no se probó). Se va si se apagan desde la app vieja («Apagar los
  avisos en este dispositivo», que la da de baja en la base) o si se borran los datos del sitio viejo:
  ahí el servicio de push contesta 404 o 410 y la función la borra sola (`envio.ts`).
- **La huella y las passkeys.** El bloqueo con huella desbloquea con una credencial del dominio de la
  página (`get()` sin `rpId`, 0023), así que en la nueva hay que activarlo de nuevo. Las passkeys van
  atadas al RP ID: las creadas con `maun-dashboard.netlify.app` no sirven más.
- **Los enlaces de antes del 0052 que la app recordaba en el navegador** (`maun:enlaces` del origen
  viejo). Si la base no tiene la dirección de alguno (`token` en null), la app nueva no la puede
  mostrar: queda «Crear uno nuevo», que no le rompe nada a nadie porque el viejo ya no anda. La
  pantalla de compartir lo dice así («la dirección quedó solo en la app de antes»); antes decía que
  abrir el trabajo en el aparato donde se creó la traía, y en la dirección nueva eso ya no pasa (0052).
- Además arrancan de cero el tema elegido, la oferta de la huella y las novedades vistas.

**La app instalada vieja puede seguir abriendo desde su caché.** Su service worker sirve el `index.html`
guardado, y la app habla con Supabase, que no cambió de dirección: puede mandar lo pendiente, y también
seguir usándose por error. Que abra se razona de la especificación de Service Workers (una
actualización que falla deja el worker que estaba); no se probó. Se usa para sincronizar y se
desinstala.

**Los enlaces ya mandados con `maun-dashboard` dejan de andar**, sin redirección: `/v/…` y `/o/…`
contestan el 404 de texto de Netlify, sin vista previa. Él los vuelve a mandar desde la app, que ya los
arma con la dirección nueva: el de la página, desde «Mostrarle al cliente» en la ficha (en el
celular, el ícono del ojo), y el de la encuesta, desde «Copiar el enlace». Si la base tiene el token, es el mismo enlace con otra dirección y
el cliente ve la misma página. Un QR del enlace que ya haya mandado o impreso tampoco anda.

### Lo que dice maun y no se renombra

Son nombres internos: no se ven. La primera versión decía además que las claves y la base del navegador
cargan datos, y que renombrarlas dejaría al dueño afuera o perdería lo pendiente. Con la dirección nueva
todo eso arranca vacío igual (ver arriba), así que en esta mudanza renombrarlas no costaría datos. No se
renombran porque no cambian nada para el dueño y porque Joaquim lo decidió así: sería tocar código,
tests y el service worker por un nombre. Lo de la base sí carga datos.

| Qué                                                                                         | Qué es                                                                                  |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| La base de IndexedDB `maun`                                                                 | La caché de la réplica y la cola de lo que falta guardar                                |
| `maun.sesion`                                                                               | La sesión de Supabase                                                                   |
| `maun:bloqueo`, `maun:huella-preguntada`                                                    | El bloqueo con huella, y si ya se le ofreció                                            |
| `maun:enlaces`                                                                              | Los puentes de los enlaces de antes del 0052 y los de la encuesta que esperan a la base |
| `maun:tema` (también en el script de `index.html`)                                          | El tema elegido                                                                         |
| `maun:novedades-vistas`                                                                     | La última versión cuyas novedades vio                                                   |
| `MAUN_VUELTA_POR_UN_AVISO`                                                                  | El mensaje del service worker cuando se toca un aviso                                   |
| Los ajustes `maun.*` de Postgres, el tesoro `maun`                                          | Datos y reglas de la base; el tesoro es del taller                                      |
| `@maun/*` (73 menciones en 30 archivos SQL), `clienteMaun`                                  | Los paquetes del repo y el cliente de Supabase                                          |
| Los `@keyframes maun-*`                                                                     | Las animaciones; las nuevas del 0074 siguen la misma serie                              |
| `maun-dashboard` en el `name` de `package.json` y el `project_id` de `supabase/config.toml` | El nombre del repo y el del proyecto para el CLI                                        |

## Cómo se instala en cada plataforma

Nada de esto se puede probar desde el repo: depende del teléfono y del navegador. Lo que sigue es lo
que dicen las fuentes, leídas el 25 de septiembre de 2026, con lo que no dicen marcado.

- **No hay actualización: hay una app nueva.** Con otro origen, el navegador no relaciona la app de
  `numa-dashboard` con la de `maun-dashboard` (W3C: el `id` se resuelve contra el origen del
  `start_url`), y la vieja no recibe más un manifiesto. Lo que la primera versión averiguó sobre cómo
  Chrome actualiza el nombre y el ícono de una app instalada (el diálogo de Chrome 144, la bandera
  `PwaUpdateDialogForIcon` de `WebApkUpdateManager.java` que en Android deja el ícono viejo) ya no
  aplica.
- **Los pasos, en este orden.** En cada aparato, en la app vieja y con señal: que mande lo pendiente
  (hasta «Todo sincronizado.») y apagar ahí los avisos («Apagar los avisos en este dispositivo»), que
  necesita la sesión. Con todos los aparatos así, «Cerrar sesión» en una app vieja, que cierra en todos
  lados. Después, en cada aparato: instalar la nueva desde la dirección nueva, entrar, activar los
  avisos y la huella, desinstalar la vieja y borrar los datos del sitio viejo desde el navegador.
- **En la compu**: Chrome titula la ventana «nombre - título», salvo que el título ya empiece con el
  nombre: como el título es «NUMA», la ventana dice «NUMA» (el código de Chromium usa `name`, y acá es
  igual al corto).
- **En Android**: los datos viven en el perfil del navegador, no en el WebAPK (web.dev, «WebAPKs on
  Android»). Que desinstalar el WebAPK viejo no borre los datos del sitio viejo se razona de eso: la
  fuente no lo dice. Por eso los datos del sitio viejo se borran aparte, desde el navegador.
- **En Samsung Internet** no hay documentación actual sobre esto.
- **En el iPhone**: `apple-touch-icon` le gana a los íconos del manifiesto (WebKit, «Web Push for Web
  Apps on iOS and iPadOS»), por eso existe `numa-apple-180.png`. **Que cada instalación tenga su propio
  almacenamiento no lo dicen las dos fuentes de WebKit que se leyeron**: dicen que los permisos de
  avisos se manejan por web app. Con otra dirección, el almacenamiento es otro igual.
- **Safari toma el SVG de la pestaña desde la 26** (caniuse; WebKit, WWDC25). Antes usa otro de los
  íconos del `head`; caniuse no dice cuál.

### Lo que queda fuera del repo

- **Las passkeys.** Lo que ata una passkey es el RP ID, y Supabase lo dice sin vueltas: cambiarlo deja
  inservibles todas las passkeys. El RP ID es el dominio entero porque `netlify.app` está en la lista
  de sufijos públicos, así que con la dirección nueva tiene que ser `numa-dashboard.netlify.app`.
  **Verificado el 26 de septiembre con la API de administración**: `passkey_enabled` en verdadero,
  `webauthn_rp_id` `numa-dashboard.netlify.app`, `webauthn_rp_origins`
  `https://numa-dashboard.netlify.app` y `webauthn_rp_display_name` «NUMA». Las passkeys que se hayan
  creado con el RP ID viejo no sirven más; el 0023 las encontró apagadas el 13 de septiembre, y no se
  sabe si se prendieron antes con el viejo. `rp.name` es solo para mostrar (WebAuthn nivel 3, W3C, 25
  de agosto de 2026: «many clients do not display it»).
- **El sujeto de los avisos** (`VAPID_SUBJECT`) es un contacto para los servicios de push; lo que ata
  una suscripción es la clave pública VAPID, que no cambió, así que las suscripciones anotadas siguen
  valiendo (se razona: el navegador crea la suscripción con esa clave, `applicationServerKey`; no se
  probó). Su valor no se puede leer desde afuera: la lista de secretos muestra solo una huella.
- **Los correos de acceso** se editan en el panel de Supabase. El remitente solo aparece como parte de
  un SMTP propio. Desde el 3 de junio de 2026 un proyecto gratis **nuevo** que manda con el correo de
  Supabase no puede editar las plantillas; los de antes de esa fecha y los que usan SMTP propio sí.
  No se sabe desde el repo en qué caso está este proyecto.
- **Netlify**: cambiarle el nombre al sitio cambia la dirección y la vieja no redirige (foro de
  Netlify, 2023). Verificado con `curl.exe` el 26 de septiembre: `maun-dashboard.netlify.app` contesta
  404 en `/`, en `/sw.js`, en `/v/…` y en `/o/…`, y `numa-dashboard.netlify.app` contesta 200, con la
  función de borde armando `og:url` con la dirección nueva. **Si otra cuenta puede tomar el nombre
  viejo no está documentado**: en el foro, un nombre borrado quedó retenido hasta que soporte lo liberó
  (agosto de 2026), y un usuario (no alguien de Netlify) dice que borrar un sitio libera el nombre. Ver
  la primera objeción.

## Alternativas descartadas

- **Renombrar `@maun/*` o las claves guardadas.** Ver la tabla: no se ven, y renombrarlos toca todo el
  repo.
- **Mantener un segundo sitio que redirija el nombre viejo.** Un sitio chico en `maun-dashboard` con
  una redirección de `/v/*` y `/o/*` a la dirección nueva haría que los enlaces ya mandados sigan
  andando. Joaquim no quiere mantener un segundo sitio: es otro deploy, otra configuración y otro lugar
  donde algo se rompe sin que nadie lo mire. Y no resuelve lo de adentro: una redirección no muda la
  sesión, la cola, la suscripción ni la huella, que quedan en el origen viejo; la app instalada tendría
  que reinstalarse igual. Los enlaces se vuelven a mandar desde la app.
- **Seguir con el texto en Young Serif.** «NUMA» escrito con la letra de los títulos no es una marca:
  cambia con la letra, no se puede hacer ícono y no se parece a lo que eligió el hermano.
- **La bajada «FOR SMALL BUSINESSES · WORKSHOPS»**, ni traducida. Está en inglés, y un eslogan adentro
  de la app no le dice nada a quien ya la usa.
- **El aparador de ChatGPT como ícono.** A 16 px las puertas no se leen como N, y es un mueble: el
  0069 sacó los muebles de lo que ve el cliente porque nunca son el suyo.
- **La N en un círculo azul.** El azul es de un tesoro (cocos) y los colores de tesoro son para la
  plata (0068).
- **`apple-mobile-web-app-title` y `application-name`.** El título ya dice NUMA, y en `/v/` y `/o/`
  le pondrían el nombre de la app al celular del cliente si agregara la página a su inicio.
- **Un ícono `monochrome`.** No lo pidió nadie y no cambia lo que se ve en el Samsung.
- **NUMA en la vista previa del cliente.** Su página es del taller.

## Objeciones

- **Si otra cuenta toma el nombre `maun-dashboard`, puede leer lo que quedó en el origen viejo.** Todo
  lo que la app guardó en `maun-dashboard.netlify.app` sigue en cada aparato: la sesión (con su token
  de renovación) y la réplica con la plata del taller. Quien sirva código en esa dirección lo puede
  leer, y la app instalada vieja lo cargaría sola: su service worker pide `sw.js` a esa dirección para
  actualizarse. Que Netlify deje tomar el nombre no está documentado (ver «Netlify»), así que es un
  riesgo, no un hecho. Se cierra así: con todos los aparatos sincronizados, **«Cerrar sesión» en una app
  vieja**, que con señal cierra la sesión en todos lados (`signOut` global) y deja inservible cualquier
  token guardado, también el de los otros aparatos (por eso va antes de entrar en la nueva); y en cada
  aparato, **borrar los datos del sitio viejo** desde el navegador. Otra forma, que no es
  mantener una redirección, es reservar el nombre con un sitio vacío; Joaquim eligió no tener un
  segundo sitio.
- **La novedad no le va a aparecer sola.** La app vieja no puede actualizarse, y en la nueva, la
  primera vez que abre, no hay sesión guardada: `tomarNovedadesSinVer` anota la versión y no muestra
  nada, como a cualquiera que recién llega (0041). Lo del cambio de dirección se lo tiene que contar
  Joaquim; la novedad queda para leer desde «Versión del …».
- **La app vieja sigue viva desde su caché.** Sirve para mandar lo pendiente, pero también se puede
  seguir usando por error, y mientras su worker siga registrado le pueden llegar avisos repetidos. Por
  eso los pasos apagan los avisos en la vieja, la desinstalan y borran sus datos.
- **La barra lateral quedó con el logotipo más alto de lo que estimaba el pedido** (27 px contra
  «unos 24»). Es la altura de las mayúsculas del «MAUN» que reemplaza, medida con la letra real. Si
  se ve grande, es un número en `Navegacion.tsx`.
- **Nada de esto se probó en un teléfono.**

## Cómo se verificó

- `@maun/ui`: 7 tests de la marca (`Marca.test.tsx`): el nombre accesible, el `currentColor`, los
  trazos y el travesaño, el isotipo como primer trazo, y la versión decorativa.
- `scripts/iconos.test.ts`, 8 tests, sobre los archivos de verdad (un decodificador de PNG de 60
  renglones con `zlib`, sin dependencias).
- `etiquetas.test.ts`: los íconos del taller en `/v/` y `/o/`, el título «MAUN» del enlace muerto, que
  no quede ni «NUMA» ni la descripción nueva, y el script del `index.html` atado a las mismas URL.
  `VistaPublicaPage.test.tsx`: la pestaña de `/v/`. `Navegacion.test.tsx` y `PantallaDeAcceso.test.tsx`:
  los lugares del logo.
- **La función de borde, antes y después.** Antes, `curl.exe` a producción en `/v/` (el 25, todavía en
  `maun-dashboard`) devolvió
  `og:title` «MAUN», `og:image` `/pwa-512x512.png` y los íconos `/favicon.ico`, `/favicon.svg` y
  `/apple-touch-icon-180x180.png` (la M). Después, `conLasEtiquetas` sobre el `dist/index.html` del
  build: `og:image` `/taller-512.png`, los tres íconos del taller, ningún «NUMA» y ningún manifiesto.
  Sin función de borde (`vite preview`), el arranque del documento dejó en `/v/` y `/o/` los tres del
  taller, sin manifiesto, y los títulos «MAUN» y «Encuesta»; en `/`, los de NUMA y «NUMA».
- **Las capturas**, miradas una por una: cada ícono en su tamaño y a ×4, en claro y en oscuro (la
  insignia sobre la mesa oscura, el enmascarable recortado al 40 %); el acceso a 390, 1024 y 1440, el
  riel a 1024 y la barra lateral a 1440, en claro y en oscuro.
- **La dirección nueva**, el 26 de septiembre: `git grep` de `maun-dashboard` deja solo el `name` del
  `package.json`, el `project_id`, y los ADR, `AGENTS.md` y `apps/web/CLAUDE.md`, que la nombran como la
  dirección de antes; la configuración de Auth de producción,
  leída con la API de administración y el token del repo, trae el `site_url`, las tres redirecciones y
  las passkeys con el RP ID nuevo; `curl.exe` a las dos direcciones (ver «Netlify»); y los tests con los
  datos nuevos, incluido el de la función de avisos en Deno.

## Fuentes

Leídas el 25 de septiembre de 2026.

- W3C, Web Application Manifest (borrador del 13 de agosto de 2026), el miembro `id` y la zona segura
  de los íconos enmascarables: <https://www.w3.org/TR/appmanifest/>
- Chrome, «Uniquely identifying PWAs with the web app manifest id property»:
  <https://developer.chrome.com/docs/capabilities/pwa-manifest-id>
- Chrome, «Improvements to web app updates» (21 de enero de 2026, Chrome 144):
  <https://developer.chrome.com/blog/improvements-to-web-app-updates>
- web.dev, «How Chrome handles updates to the web app manifest» (2024, anterior a Chrome 144):
  <https://web.dev/articles/manifest-updates>; «WebAPKs on Android»:
  <https://web.dev/articles/webapks>; «Adaptive icon support in PWAs with maskable icons»:
  <https://web.dev/articles/maskable-icon>
- Chromium, `WebApkUpdateManager.java`, `chrome_features.cc` y `web_app_browser_controller.cc`
  (rama `main`): <https://github.com/chromium/chromium/blob/main/chrome/android/java/src/org/chromium/chrome/browser/webapps/WebApkUpdateManager.java>,
  <https://github.com/chromium/chromium/blob/main/chrome/browser/ui/web_applications/web_app_browser_controller.cc>
- WebKit: <https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/>
  y <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>
- Evil Martians, «How to Favicon in 2026» (21 de enero de 2026):
  <https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs>
- RealFaviconGenerator, «Apple Touch icon turns black»:
  <https://realfavicongenerator.net/blog/apple-touch-icon-turns-black>
- caniuse, SVG favicons: <https://caniuse.com/link-icon-svg>
- W3C, Web Authentication nivel 3 (recomendación del 25 de agosto de 2026):
  <https://www.w3.org/TR/webauthn-3/>; lista de sufijos públicos:
  <https://publicsuffix.org/list/public_suffix_list.dat>
- Supabase: <https://supabase.com/docs/guides/auth/passkeys>,
  <https://supabase.com/docs/guides/auth/auth-email-templates>,
  <https://supabase.com/docs/guides/auth/auth-smtp>,
  <https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier>
- Netlify, foro: <https://answers.netlify.com/t/rename-site-will-the-old-url-redirect/87916>,
  <https://answers.netlify.com/t/subdomain-release-request-cursoekklesialogos-netlify-app/167521> y
  <https://answers.netlify.com/t/use-existing-site-name-for-a-new-app/88735> (leídos el 26 de
  septiembre)
- Meta, vistas previas de WhatsApp:
  <https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews>
