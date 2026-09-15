# 0041. La versión es una fecha, y las novedades salen de un archivo y aparecen solas una vez

- Estado: aceptada
- Fecha: 2026-09-15
- Usa el mismo popover que la capa del día de la agenda
  ([0034](0034-la-agenda-calcula-lo-que-sale-de-los-trabajos.md)) y guarda en el dispositivo, como el tema y
  la marca del bloqueo.

## Contexto

El dueño usa la app desde hace dos días y le van a seguir llegando cambios. Joaquim quiere que los vea: un
número de versión a la vista y, cuando la app se actualiza, qué cambió. No lo pidió el dueño.

## Decisión

### La versión es la fecha

- Se lee «Versión del 15 de septiembre de 2026». El criterio es que un carpintero la lea y sepa cuál es más
  nueva. Una fecha con el mes en palabras se entiende sin saber nada de programas y se ordena sola: la que
  está más adelante en el calendario es la más nueva. «0.4.2» no dice nada, y «4.10» contra «4.9» engaña.
- Se escribe `AAAA-MM-DD`. Si sale otra versión el mismo día, `AAAA-MM-DD.2`, que se lee con un «(2)».

### Una sola fuente

- **La versión de la app es la de la entrada más nueva** de `apps/web/src/features/ver-novedades/model/novedades.ts`.
  Agregar la entrada es subir la versión: no hay un segundo número que se olvide. El `package.json` sigue en
  `0.0.0`, porque el paquete es privado y nadie lo lee.
- Un PR sin nada visible no agrega entrada, y por eso no cambia la versión. La versión marca lo que el dueño
  puede notar, no cada deploy.
- **Es un archivo del repositorio, no una tabla**: se compila con la app, anda sin señal, es igual para todos
  y no pasa por la réplica ni por la red.
- `novedades.test.ts` hace cumplir lo que se puede medir: que la versión sea una fecha real, que vayan de la
  más nueva a la más vieja, de una a cuatro líneas de hasta 200 caracteres terminadas en punto, sin emojis,
  y sin una lista de palabras técnicas ni menciones a una IA. Si algo es visible para el dueño y está dicho
  en su idioma no se puede medir: queda en la regla de `AGENTS.md` y del `CLAUDE.md` de `apps/web`.

### Cuándo aparecen solas

- **Lo que va una sola vez es la interrupción, no el contenido.** La versión vista es estado del dispositivo
  (`maun:novedades-vistas` en `localStorage`), como el tema y la marca del bloqueo. No entra a la réplica ni a
  la cola.
- Al abrir la app, si la versión anotada es más vieja que la actual, se muestran las entradas posteriores y
  se anota la actual en ese momento. Cerrarlas sin leerlas no las trae de vuelta solas.
- El momento natural es justo después de «Actualizar»: la recarga abre la app nueva con la versión vieja
  anotada. No hizo falta tocar el aviso de actualización.
- **Sin nada anotado, decide la sesión.** Si al abrir la app ya había una sesión guardada, es alguien que
  venía usando la versión anterior en ese dispositivo, que es el caso del dueño con esta primera entrega: ve
  la última. Si la sesión empieza recién, entrando con la contraseña, todo es nuevo para esa persona: se
  anota la versión sin interrumpir.
- Espera a que no haya nada en curso (`useHayAlgoEnCurso`: una hoja abierta o un formulario a medio cargar),
  para no abrirse encima.

### Cómo se ven

- **Un popover, no un `<dialog>` modal.** No vuelve inerte el resto de la pantalla, tocar afuera o Escape lo
  cierra, y la app se sigue usando. En el celular se dibuja desde abajo, con la forma de las hojas; en la PC y
  en la tablet, como capa al lado de la navegación.
- Se vuelven a abrir tocando la versión: en el pie de la barra lateral, debajo de los datos de la cuenta,
  que existe solo en la PC, y al final de Ajustes, en todos los tamaños. Abiertas así muestran la historia
  entera.

### Sin entrada de presentación

Evalué una entrada anterior, corta, que dijera qué es la app para quien viene del sistema viejo. No va:

- Quien entra por primera vez con la contraseña no ve novedades solas, así que no la leería nadie que la
  necesite. El único usuario ya usa la app.
- Contar qué es la app no cambia lo que él puede hacer, que es la regla para que algo sea una novedad.

## Consecuencias y objeciones

- **«Hoja desde abajo» no es la `Hoja` de la app.** `Hoja` es un `<dialog>` modal y el pedido es que esto no
  bloquee, así que usé el popover con la forma de la hoja. Con la `Hoja` real el fondo queda bloqueado hasta
  cerrarla.
- **«Tres o cuatro líneas» lo tomé como cuatro renglones de hasta 200 caracteres.** En el celular cada uno
  ocupa tres o cuatro renglones de pantalla. Si se quiere más corto, se baja el tope del test.
- **La fecha es la del PR, no la del deploy.** Si se mergea días después, la versión dice el día en que se
  escribió. El orden no se rompe: dos PR que agregan entrada chocan en git en la misma línea, y el test exige
  que vayan de la más nueva a la más vieja.
- **Una hoja que se abre cierra el popover**, porque así funciona la capa superior del navegador. Como la
  versión se anota al mostrarlas, si eso pasa se pierde la interrupción, pero no el contenido.
- **Salir y volver a entrar sin recargar** cuenta como sesión que ya estaba al abrir. Con una sola persona no
  cambia nada.
