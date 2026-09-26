# 0073. La app se llama NUMA; el taller sigue siendo MAUN

- Estado: aceptada
- Fecha: 2026-09-25
- Enmienda al [0068](0068-la-mesa-y-el-plano.md) (el «MAUN» de la barra lateral y del panel de
  acceso pasa a ser el logotipo, y el menú de «Cargar algo nuevo» pasa de `top-[81px]` a
  `top-[71px]`), al [0049](0049-la-vista-previa-del-enlace.md) (la imagen de la vista previa es el
  ícono del taller, `taller-512.png`, y la página del cliente trae los íconos del taller), al
  [0050](0050-la-vista-publica-no-depende-del-armazon-de-la-app.md) (el arranque del documento cambia
  además los íconos en `/v/` y `/o/`), al [0023](0023-sesion-bloqueo-con-huella-y-passkeys.md) (el
  panel de la marca), al [0020](0020-pulido-visual.md) (el nombre del logo, «NUMA, ir a Inicio») y al
  [0035](0035-un-service-worker-propio.md) (el título de respaldo y los íconos del push).

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
   sigue siendo `maun`, y lo que ve un cliente no cambia (punto 3). La app es la herramienta; el
   taller es el negocio, y el negocio no cambió de nombre.
2. **El logotipo es el de Meta, redibujado limpio sobre una grilla y sin la bajada en inglés.** La
   app habla castellano, y la bajada no suma nada adentro de la app.
3. **El cliente no ve NUMA.** Su página es del taller y no le ofrece instalar la app (0049). Lo que
   hoy le muestra la M (la imagen de la vista previa en WhatsApp, y el ícono y la pestaña de `/v/` y
   `/o/`) sigue mostrando esa M, y los textos de respaldo siguen diciendo «MAUN» y «Taller MAUN».
4. **El ícono es la N del logotipo, en papel sobre tinta, como hoy la M.** Una sola letra se lee en
   16 px y en la pantalla de inicio, y es el mismo dibujo que el logotipo.
5. **Adentro no se renombra nada.** `@maun/*`, las claves guardadas, la base de IndexedDB, los
   nombres de las animaciones y el dominio `maun-dashboard.netlify.app` quedan como están. Cargan
   datos o identidad, y el dominio es el de las passkeys y el de cada enlace ya mandado.

**La regla que manda: NUMA es la app; MAUN es el taller.** El nombre nuevo va donde la app habla de
sí misma: la pestaña, el manifiesto, el logo, el acceso y los avisos del sistema. Donde se habla del
taller o de su plata, y en todo lo que ve un cliente, queda lo de hoy.

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

- **Los nombres son nuevos a propósito.** Chrome decide que un ícono cambió si cambió el campo
  `icons` del manifiesto (la URL o sus datos); con el mismo nombre y otro dibujo, lo daría por igual.
- **La N del enmascarable entra en el círculo de radio 40 %**: mide 245,8 de alto por 194,1 de ancho,
  y la media diagonal (156,6) queda debajo del radio (204,8). Se miró recortado.
- **El de inicio del iPhone y el enmascarable son opacos** (PNG sin canal alfa): iOS pinta de negro
  lo transparente de un `apple-touch-icon`.
- **La insignia es la N sola sobre transparente.** Android dibuja la insignia con la transparencia;
  la de antes, `pwa-64x64.png`, era opaca y se veía un cuadrado lleno.
- **Los de la M que ve el cliente cambian de nombre con `git mv`**: `pwa-512x512.png` pasa a
  `taller-512.png`, `favicon.svg` a `taller.svg`, `apple-touch-icon-180x180.png` a `taller-180.png` y
  `favicon.ico` a `taller.ico`. El `favicon.ico` nuevo es la N. `maskable-icon-512x512.png` se borra.
- **`pwa-64x64.png` y `pwa-192x192.png` quedan en `public/` sin referencias, por una versión.** El
  service worker viejo, activo hasta que él toca «Actualizar», los sigue pidiendo para los avisos. **Se
  borran en el próximo PR que toque `public/`.**
- **`scripts/iconos.test.ts` lee los archivos**: que cada ícono del manifiesto y del `index.html`
  exista y mida lo que dice (el ICO por su cabecera), que el de inicio y el enmascarable sean opacos,
  que los del manifiesto tengan las esquinas transparentes, que la insignia sea la N blanca sobre
  transparente, que `numa.svg` sea exactamente lo que arma el script con los trazos de hoy, que la
  tinta y el papel sean los de `theme.css`, y que existan `IMAGEN_DE_LA_VISTA` y los cuatro del
  taller, con la M. Un cambio en los trazos sin regenerar los íconos lo rompe.

### El manifiesto, el `head` y el push

- **`vite.config.ts`**: `id: '/'`, que es el que el navegador calcula hoy a partir del `start_url`
  (W3C: sin `id`, el `id` es el `start_url`); `name` y `short_name` «NUMA»; `description` «Nuevas
  maneras de gestionar el taller.»; los íconos nuevos; e `includeAssets` con los tres del `head` de la
  app y los tres del taller. `start_url`, `scope`, los colores y los nombres del manifiesto y del
  service worker no se tocan: mover el manifiesto o cambiar el `start_url` sin `id` es lo que rompe la
  identidad de una app instalada.
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

### Lo que dice maun y no se renombra

| Qué                                                        | Por qué no                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| La base de IndexedDB `maun` (la caché y la cola)           | Otra base es otra base: lo que faltaba guardar quedaría en la vieja, sin nadie que lo mande            |
| `maun.sesion`                                              | Es la sesión de Supabase: cambiarla deja al dueño afuera, y sin señal no puede volver a entrar         |
| `maun:bloqueo`, `maun:huella-preguntada`                   | El bloqueo con huella dejaría de estar activo, o la oferta volvería a aparecer                         |
| `maun:enlaces`                                             | Los puentes de los enlaces viejos (0052) y los de la encuesta que esperan a la base                    |
| `maun:tema` (también en el script de `index.html`)         | Volvería al tema del sistema                                                                           |
| `maun:novedades-vistas`                                    | Volverían a aparecer todas las novedades                                                               |
| `MAUN_VUELTA_POR_UN_AVISO`                                 | Lo manda el service worker viejo hasta que se actualiza: con otro nombre, esa vuelta pediría la huella |
| Los ajustes `maun.*` de Postgres, el tesoro `maun`         | Son datos y reglas de la base, y el tesoro es del taller                                               |
| `@maun/*` (73 menciones en 30 archivos SQL), `clienteMaun` | Nombres internos: renombrarlos no cambia nada que se vea y toca todo el repo                           |
| Los `@keyframes maun-*`                                    | Nombres internos; los nuevos del 0074 siguen la misma serie                                            |
| `maun-dashboard.netlify.app`                               | Es el RP ID de las passkeys y la dirección de cada enlace ya mandado                                   |

## Cómo se actualiza en cada plataforma

Nada de esto se puede probar desde el repo: depende del teléfono y del navegador. Lo que sigue es lo
que dicen las fuentes, leídas el 25 de septiembre de 2026, con lo que no dicen marcado.

- **Primero, «Actualizar».** Hasta que corre la versión nueva, el service worker viejo sirve el
  `index.html` viejo, con el manifiesto de MAUN, y el navegador no ve nada que actualizar.
- **La identidad no cambia.** Con `id: '/'` y `start_url: '/'`, el `id` es el mismo que calculaba el
  navegador sin `id` (W3C, algoritmo de procesamiento del `id`; Chrome, «Uniquely identifying PWAs»).
  Chrome recomienda confirmar el «Computed App Id» en DevTools; no se pudo hacer contra la app
  instalada del dueño.
- **En la compu (Chrome 144, enero de 2026)**: el nombre y el ícono son campos «sensibles» y no se
  aplican solos: aparecen en el menú de los tres puntos como «Review app update» para que el usuario
  los acepte. Un ícono que cambia menos del 10 % se aplica solo; este cambia entero. Chrome titula la
  ventana «nombre - título», salvo que el título ya empiece con el nombre: como el título es «NUMA»,
  la ventana dice «NUMA». (El pedido decía el nombre corto; el código de Chromium usa `name`, y acá
  son iguales.)
- **En Android (Chrome)**: el código de Chromium pide confirmar el nombre nuevo con un diálogo, y un
  ícono que difiere un 11 % o más **no se aplica** salvo que esté prendida la bandera
  `PwaUpdateDialogForIcon`, que viene apagada (`WebApkUpdateManager.java`, `chrome_features.cc`). El
  blog de Chrome 144 dice que en Android se pide confirmación solo si el cambio de ícono es grande,
  lo que se lee como un diálogo; el código de `main` dice que sin la bandera se conserva el ícono
  viejo. Google puede prender la bandera desde el servidor, y eso no se ve desde afuera. **Que haya
  que desinstalar y reinstalar para ver el ícono nuevo es una deducción del código, no una frase de
  ninguna fuente.** Los datos viven en el perfil del navegador, no en el WebAPK (web.dev, «WebAPKs on
  Android»); que sobrevivan a desinstalar el WebAPK tampoco lo dice la fuente, se razona de eso.
- **En Samsung Internet** no hay documentación actual sobre esto.
- **En el iPhone**: `apple-touch-icon` le gana a los íconos del manifiesto (WebKit, «Web Push for Web
  Apps on iOS and iPadOS»), por eso existe `numa-apple-180.png`. **Que el nombre y el ícono queden
  fijos al agregarla a inicio, y que cada instalación tenga su propio almacenamiento, no lo dicen las
  dos fuentes de WebKit que se leyeron**: dicen que el nombre se puede editar al agregarla y que los
  permisos de avisos se manejan por web app. Los pasos del informe (agregar la nueva, entrar, activar
  avisos y huella, recién ahí borrar la vieja) son el camino prudente aunque eso no esté confirmado.
- **Safari toma el SVG de la pestaña desde la 26** (caniuse; WebKit, WWDC25). Antes usa otro de los
  íconos del `head`; caniuse no dice cuál.

### Lo que queda fuera del repo

- **Las passkeys.** `rp.name` es solo para mostrar, y la recomendación de WebAuthn nivel 3 (W3C, 25 de
  agosto de 2026) lo da por obsoleto porque «many clients do not display it». Lo que ata una passkey es
  el RP ID, y Supabase lo dice sin vueltas: cambiarlo deja inservibles todas las passkeys. El RP ID es
  `maun-dashboard.netlify.app` entero porque `netlify.app` está en la lista de sufijos públicos. En
  Supabase, Authentication → Passkeys, el «Relying Party Display Name» puede pasar a NUMA sin tocar el
  RP ID. El 0023 las encontró apagadas el 13 de septiembre; no se volvió a mirar.
- **Los correos de acceso** se editan en el panel de Supabase. El remitente solo aparece como parte de
  un SMTP propio. Desde el 3 de junio de 2026 un proyecto gratis **nuevo** que manda con el correo de
  Supabase no puede editar las plantillas; los de antes de esa fecha y los que usan SMTP propio sí.
  No se sabe desde el repo en qué caso está este proyecto.
- **Netlify**: cambiarle el nombre al sitio cambia la dirección y la vieja no redirige (foro de
  Netlify, 2023). Es otra razón para no tocarlo, además de las passkeys y los enlaces.

## Alternativas descartadas

- **Renombrar `@maun/*`, las claves guardadas o el dominio.** Ver la tabla: cargan datos o identidad.
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

- **La barra lateral quedó con el logotipo más alto de lo que estimaba el pedido** (27 px contra
  «unos 24»). Es la altura de las mayúsculas del «MAUN» que reemplaza, medida con la letra real. Si
  se ve grande, es un número en `Navegacion.tsx`.
- **Para ver el ícono nuevo en Android probablemente haya que reinstalar.** La novedad lo dice así
  porque es lo que sale del código de Chromium, pero ninguna fuente lo escribe, y el blog de Chrome 144
  sugiere un diálogo. Si en el Samsung aparece un diálogo para aceptar el ícono, alcanza con eso.
- **Un cliente que ya tenía la pestaña de `/v/` abierta** ve la M del taller igual que antes: la M no
  cambió, cambió su nombre de archivo. Uno que guardó la página en favoritos puede tener la M vieja en
  la caché del navegador; es la misma imagen.
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
- **La función de borde, antes y después.** Antes, `curl.exe` a producción en `/v/` devolvió
  `og:title` «MAUN», `og:image` `/pwa-512x512.png` y los íconos `/favicon.ico`, `/favicon.svg` y
  `/apple-touch-icon-180x180.png` (la M). Después, `conLasEtiquetas` sobre el `dist/index.html` del
  build: `og:image` `/taller-512.png`, los tres íconos del taller, ningún «NUMA» y ningún manifiesto.
  Sin función de borde (`vite preview`), el arranque del documento dejó en `/v/` y `/o/` los tres del
  taller, sin manifiesto, y los títulos «MAUN» y «Encuesta»; en `/`, los de NUMA y «NUMA».
- **Las capturas**, miradas una por una: cada ícono en su tamaño y a ×4, en claro y en oscuro (la
  insignia sobre la mesa oscura, el enmascarable recortado al 40 %); el acceso a 390, 1024 y 1440, el
  riel a 1024 y la barra lateral a 1440, en claro y en oscuro.

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
- Netlify, foro: <https://answers.netlify.com/t/rename-site-will-the-old-url-redirect/87916>
- Meta, vistas previas de WhatsApp:
  <https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews>
