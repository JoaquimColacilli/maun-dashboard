# 0049. La vista previa del enlace la arma una función de borde, con una función de base propia

Estado: aceptada, 2026-09-19. Completa al [0046](0046-la-vista-del-cliente-una-lista-blanca-en-la-base.md).

## Contexto

El dueño pega el enlace en WhatsApp y la vista previa dice «MAUN» y «Finanzas y proyectos del
taller MAUN.». Pidió que diga el nombre del trabajo: «COCINA LUCAS».

Eso no se puede arreglar desde React. La vista previa sale de las etiquetas Open Graph del HTML
inicial, y quien la arma es el teléfono del que envía, con un `GET` simple y sin ejecutar
JavaScript. Hoy ese HTML es `index.html`, que es el mismo para todas las rutas.

## Decisión

### Una función de borde de Netlify en `/v/*`, que reescribe el `<head>`

`apps/web/netlify/edge-functions/vista-previa.ts`. Netlify procesa las funciones de borde **antes**
que las reglas de reescritura, y `context.next()` sigue la cadena: en `/v/abc` devuelve el
`index.html` de la SPA, que la función reescribe y devuelve. Toda respuesta de `/v/*` lleva las
etiquetas, **la pida quien la pida**: nada de mirar el agente de usuario. Signal se hace pasar por
WhatsApp mandando literalmente `WhatsApp/2`, y detectar por agente es una carrera que se pierde.

### Sin dependencias: una sustitución de texto, no un reescritor de HTML

El ejemplo oficial de Netlify usa un `HTMLRewriter` que se importa de una URL de terceros
(`ghuc.cc`) y corre sobre WebAssembly. Nuestro `index.html` es chico, es nuestro y lo escribimos
nosotros: tres expresiones regulares sacan el `<title>`, la descripción y el manifiesto, y un
bloque entra pegado a `<head>`. Instanciar un módulo WASM tiene costo, y el límite de Netlify es de
**50 ms de CPU por request**. La parte pura vive en `apps/web/netlify/etiquetas.ts`, fuera del
directorio de funciones —Netlify empaqueta como función cada archivo que encuentra ahí adentro— y
tiene sus tests en Vitest, que corren en `pnpm verify`.

### Una función de base nueva y mínima: `public.titulo_compartido(text)`

Devuelve el título del trabajo y el nombre del taller, y **no llama a `vista_del_cliente`**. Por dos
motivos, los dos necesarios:

1. **Qué pide quien la llama.** La vista previa queda guardada adentro del mensaje cifrado, para
   siempre, aunque el enlace se revoque. Ahí no puede ir un importe, ni la etapa (que cambia), ni
   el nombre ni la dirección del cliente. La vista devuelve justamente todo eso.
2. **Quién la llama.** La pide un rastreador, no una persona, y `vista_compartida` cuenta cada
   lectura como una visita. El contador que el dueño mira en «Compartir» contaría robots.

Es `stable`: no escribe. Un token inválido, uno revocado, uno inexistente y un trabajo perdido
devuelven **`null`**, los cuatro iguales, y la función de borde pone las etiquetas genéricas. El rol
anónimo gana permiso de ejecución sobre esta función y nada más: su lista completa pasa de una
función a dos, y de cero privilegios sobre tablas a cero privilegios sobre tablas.

### Qué dice, y qué no

`og:title` es «{trabajo} · {taller}». `og:description` es fija. `og:url` es la dirección canónica de
**esa misma página**: si apuntara a la raíz, un rastreador que lo sigue —Meta documenta que lo
hace— leería las etiquetas de la app y la vista previa diría «Finanzas». `og:image` es el ícono de
la app: PNG de 512×512 y 2,7 KB, que cumple el mínimo de 300 px, la relación de 4:1 y el tope de
600 KB que documenta Meta. El `noindex` sigue, en la etiqueta y en la cabecera.

### Que nunca rompa la página

- `onError: 'bypass'` en el `export const config` del archivo. **No es una clave válida de
  `[[edge_functions]]` en `netlify.toml`**: la doc de Netlify la documenta solo inline.
- La consulta a la base corre contra un tope de un segundo. No usa `AbortSignal`, que Netlify no
  documenta entre las APIs que soporta su runtime, sino una carrera contra `setTimeout`, que sí.
- La respuesta no se cachea en el CDN (`Netlify-CDN-Cache-Control: no-store`), así que revocar un
  enlace corta la vista previa en el momento.
- Solo `GET` y `HEAD`; cualquier otro método devuelve `undefined` y sigue la cadena.
- El token no va a ningún log.

### El escapado

`&`, `"`, `<`, `>` y `'`. Los dos primeros los exige la norma; los otros tres los exige la realidad:
un rastreador de vistas previas no usa un parser de HTML completo —el de Signal delimita la
etiqueta con una expresión regular— y un `>` adentro del contenido le rompe el match. El apóstrofo
va en numérica, `&#39;`, porque `&apos;` no existe en HTML 4 y el parser del otro lado puede no
tener la tabla completa de HTML5.

## Alternativas descartadas

- **Renderizar las etiquetas desde React.** WhatsApp no ejecuta JavaScript. Lo que pone React,
  para él no existe.
- **Detectar el agente de usuario y servir el HTML solo a los rastreadores.** Frágil, y no hace
  falta: las etiquetas no son secretas.
- **Usar `vista_compartida` para el título.** Mandaría importes y la dirección del cliente a un
  mensaje que queda guardado, y contaría robots como visitas.
- **Prerender de Netlify.** No aplica a rutas servidas por una función de borde.

## Consecuencias

- Hay que declarar `edge_functions = "apps/web/netlify/edge-functions"` en el `netlify.toml`: las
  rutas del archivo son absolutas contra el **base directory**, que en este sitio es la raíz del
  repo, no el package directory.
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` tienen que estar disponibles para el
  **scope Functions** en el panel de Netlify. La función usa solo esas dos: la URL pública y la
  clave publicable, las mismas que ya van al bundle.
- **Lo que ya salió en una vista previa queda guardado en el chat del cliente para siempre, aunque
  el enlace se revoque.** El título y la miniatura viajan adentro del mensaje cifrado. Por eso el
  título no lleva importes ni etapa.
- **El título puede llevar el nombre de un cliente**, porque así nombra él los trabajos («Cocina
  Lucas»). Es la primera vez que un nombre que el dueño escribió sale a un chat sin que él lo
  escriba ahí. Por eso la pantalla de compartir muestra, antes de mandar, la línea exacta que va a
  ver el otro.
- En local, `netlify dev` **no** pasa variables de entorno propias al sandbox de la función de
  borde, ni las de `netlify.toml` ni las del shell (verificado: la función solo ve `URL`,
  `NETLIFY_DEV`, `DENO_REGION` y un puñado más). La reescritura se prueba local; el cableado de la
  variable se confirma en una vista previa del deploy.

## Fuentes

- Netlify: orden de ejecución (funciones de borde antes que redirects), `context.next()`,
  `onError` inline, APIs soportadas del runtime, límites (50 ms de CPU) y cache por defecto.
  <https://docs.netlify.com/build/edge-functions/declarations/> y
  <https://docs.netlify.com/build/edge-functions/optional-configuration/>
- Meta, «Link previews» de WhatsApp: el `GET` simple, el `<head>` dentro de los primeros 300 KB del
  HTML, las cuatro etiquetas que lee y los requisitos de la imagen (600 KB, 300 px, 4:1).
  <https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews>
- Meta: que el rastreador sigue el `og:url` y lee las etiquetas de esa URL.
  <https://developers.facebook.com/docs/sharing/webmasters/getting-started/versioned-link/>
