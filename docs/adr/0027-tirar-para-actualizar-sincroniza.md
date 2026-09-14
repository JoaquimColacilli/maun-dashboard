# 0027. Tirar para actualizar: sincroniza, no recarga

- Estado: aceptada
- Fecha: 2026-09-13
- Se apoya en el [0026](0026-el-bloqueo-cuenta-el-tiempo-afuera.md), que apagó el gesto nativo, y en
  el [0010](0010-sincronizacion-replica-completa.md).

## Contexto

En la app instalada, el dueño quiere tirar hacia abajo para actualizar, como en una app nativa. El
gesto nativo está apagado desde el 0026 (`overscroll-behavior-y: none` en `html` y `body`): recargaba
el documento, y una recarga vuelve a montar la app y puede pedir la huella.

## Decisión

**Al soltar, la app sincroniza. No recarga el documento.** Es la decisión que sostiene todo lo demás,
y la que alguien puede revertir sin querer:

- Recargar monta la app de cero y pasa por el bloqueo: tirar para actualizar sería el gesto que
  bloquea la app.
- Recargar no trae nada nuevo. El documento está precacheado por el service worker y los datos están
  en la réplica del dispositivo (ADR 0005 y 0010). Lo único que puede haber cambiado está del otro lado
  de la red.
- Lo que pide el gesto es «traeme lo último»: drenar la cola y traer el delta, que la app ya sabe
  hacer.

**El gesto nativo sigue apagado**, y el e2e cuenta los pedidos de tipo documento durante el gesto:
tienen que ser cero.

### Qué hace sincronizar

`sincronizarAhora` (`entities/replica`) es una sola, para el gesto y para el botón de Ajustes:

1. Relee `navigator.onLine` y se lo pasa a `onlineManager`. Si el evento `online` no llegó (la app
   estaba congelada en segundo plano, por ejemplo), la cola seguía creyendo que no había señal.
2. **Sin señal no sale a la red.** Devuelve el estado de la cola, que el indicador escribe con el
   vocabulario de siempre: «Sin conexión. 1 cambio se va a sincronizar cuando vuelva la señal.»
3. **Con señal drena la cola y trae la réplica a la vez**: `reanudarCola`, que ahora devuelve la
   promesa de toda la cola, y `refetchQueries` de `['replica', usuarioId]`, que corre `sincronizar()`
   (delta, o reconcile si toca). El orden de la cola lo sigue dando el scope, y la mezcla ya se aplica
   sobre el cache fresco (ADR 0010).
4. **Espera como máximo diez segundos.** Si la réplica sigue viajando, dice «El servidor tarda en
   responder. Sigue intentando solo.» Nunca queda un indicador girando.

El desenlace sale de la cola real (`calcularEstadoSync`): «Todo sincronizado.» solo si no queda nada
pendiente ni rechazado.

### El gesto

`useTirarParaActualizar(actualizar, contenedor, deshabilitado)` (`shared/lib`) escucha los toques del
`<main>` de `Marco`, que es el que scrollea: la raíz está fija y el documento no se mueve. Arranca
solo con el `scrollTop` en cero y el dedo yendo hacia abajo.

| Número                            | Valor                                            |
| --------------------------------- | ------------------------------------------------ |
| Umbral para sincronizar           | 64 px de tirón                                   |
| Tirón máximo                      | 96 px                                            |
| Resistencia                       | 0,5: el tirón es la mitad de lo que baja el dedo |
| Mínimo mostrando «Sincronizando…» | 500 ms                                           |
| Desenlace a la vista              | 1,2 s                                            |
| Vuelta                            | 220 ms, lo mismo que `--dur-medium`              |

Los cuatro primeros son los de referencia del pedido, sin cambios. Los dos últimos no estaban.

- La distancia y la fase son estado. Lo que decide (dónde apoyó el dedo, el tirón, si ya empezó, si
  está sincronizando) va en referencias, y la distancia se publica una vez por cuadro con
  `requestAnimationFrame`.
- El indicador es un componente propio adentro del `<main>` (`TirarParaActualizar`): el que se vuelve a
  dibujar en cada cuadro es él, no `Marco` con todas las pantallas.
- Cuelga del borde de arriba del contenido con `sticky top-0` y alto cero: no empuja nada.
- **Los estados se distinguen por la forma.** Tirando: una flecha hacia abajo que gira con el avance y
  un anillo que se llena. Listo para soltar: el círculo lleno, la flecha hacia arriba y «Soltá para
  actualizar». Sincronizando: las flechas en círculo girando. Desenlace: tilde, nube tachada, alerta o
  reloj, con su texto.

### Listeners pasivos: lo que se midió

El pedido era cancelar el `touchmove` solo mientras se tira, y antes probar si hacía falta. Se probó
en Chromium 153 con toques de verdad (`Input.dispatchTouchEvent` de CDP) sobre una página con la misma
estructura: raíz fija, `<main>` que scrollea y `overscroll-behavior-y: none` en `html` y `body`.

| Recorrido                             | Pasivo                  | Cancelando |
| ------------------------------------- | ----------------------- | ---------- |
| Arriba de todo: bajar 120 px y soltar | `scrollTop` queda en 0  | 0          |
| Arriba de todo: bajar 120 y volver 80 | 0                       | 0          |
| Arriba de todo: bajar 80 y subir 140  | 0                       | 0          |
| A mitad del scroll: bajar 120         | 400 → 295, scroll común | 400 → 295  |

En ningún caso se movió la raíz ni hubo recarga. **Cancelar no cambia nada**: el navegador engancha
el gesto a la ventana, que no scrollea, y no hay rebote ni recarga nativa que impedir. Los cuatro
listeners (`touchstart`, `touchmove`, `touchend`, `touchcancel`) son pasivos, y el scroll nunca espera
a JavaScript.

**Tiene una condición, y también está medida: el `<main>` no lleva `overscroll-behavior`.** Con
`overscroll-behavior-y: none` en el `<main>`, el gesto se engancha al `<main>`: con listeners pasivos,
volver 80 px scrollea el contenido 78 px, y pasar el inicio lo scrollea 136. Cancelando quedan en 0 y 60. `tirar-para-actualizar.spec.ts` lo cuida: tirar y volver tiene que dejar el `scrollTop` en cero.

### Dónde aplica

- Solo con `useAnchoDePantalla() === 'movil'`, el mismo corte que elige la barra inferior.
- Solo en las pantallas que leen de la réplica (`seActualizaTirando`): Inicio, Seguimiento, Proyectos,
  Clientes, Finanzas, Diezmo, la ficha de proyecto o contacto y la de cliente. No en Ajustes ni en los
  formularios de pantalla completa, el cobro, el cierre o el pasaje.
- **Deshabilitado** con una ruta de hoja o con algo en curso (`useAlgoEnCurso`): toda `Hoja` mientras
  está abierta, `BloqueoAlVolver`, las notas de un proyecto con cambios que todavía no salieron y el
  presupuesto a medio cargar de un contacto. La pantalla de bloqueo al abrir reemplaza todo el marco:
  ahí el gesto no existe.
- La bandera hace falta de verdad: las hojas que abre una pantalla viven, en el DOM, adentro del
  `<main>`. Sus toques llegan al listener aunque la hoja se pinte en la top layer.
- **Un tirón que empieza durante la transición entre pantallas no llega al `<main>`.** Mientras dura
  la view transition (250 ms), el navegador entrega los toques a la raíz, y un gesto táctil conserva
  el destino de su primer toque. Con cualquier otro toque en esos 250 ms pasa lo mismo. Se encontró en
  el e2e y no se corrigió: escuchar en el documento obligaría a adivinar, durante la transición, si
  el dedo está sobre el contenido o sobre la barra.

### Accesibilidad

- **Ajustes, en «Este dispositivo», tiene «Sincronizar ahora»**, que llama a la misma función y escribe
  el desenlace en una región `aria-live`. Es el camino sin gesto, en todos los anchos.
- El indicador del gesto es `aria-hidden`. Con lector de pantalla el arrastre de un dedo lo toma el
  lector, así que el gesto no está a su alcance, y el estado real ya lo anuncia `IndicadorSync`. Así
  tampoco hay un segundo `role="status"` diciendo «Sin conexión».
- Con `prefers-reduced-motion` la flecha no gira: pasa de hacia abajo a hacia arriba en el umbral, y
  las flechas de sincronizar quedan quietas (`motion-safe:`). El indicador sigue al dedo igual: es
  manipulación directa, no una animación.

## Dónde se aparta del pedido

- **El botón para sincronizar sin el gesto está en Ajustes, no en `IndicadorSync`.** El indicador
  flotante desaparece cuando todo está sincronizado (ADR 0013), que es justo cuando uno quiere
  preguntar si hay algo nuevo. Con cambios pendientes ya está sincronizando, y sin señal un botón no
  puede hacer nada. «Este dispositivo» muestra el estado siempre.
- **El hook devuelve más de lo pedido**: además de la distancia, el avance y si está sincronizando,
  la fase (la vuelta necesita seguir dibujada 220 ms) y el desenlace.
- **La zona segura de arriba no la aplica ningún contenedor.** El pedido decía que la aplica el padre;
  en el marco no hay ningún `env(safe-area-inset-top)`, solo en `PantallaDeAcceso`. El indicador no la
  suma: se ubica desde el borde de arriba del `<main>`, así que si mañana el marco la aplica, la sigue
  sin contarla dos veces.
- **Sincronizar reescribe `onlineManager` con `navigator.onLine`.** No estaba pedido. Es la idea del
  ADR 0014, que lo siembra al abrir, aplicada en el momento en que el usuario pide la verdad.

## Cómo se verifica

**Con toques de verdad para Chromium**: `tirar-para-actualizar.spec.ts`, en el proyecto `celular`,
con `Input.dispatchTouchEvent` de CDP y contra el build con el service worker.

| Caso                          | Qué mide                                                                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Soltar antes del umbral       | «Tirá para actualizar» a la vista; al soltar desaparece. Cero pedidos de `delta` o `bootstrap`, cero documentos, y el `scrollTop` en 0 después de tirar y volver.                                                                             |
| Soltar pasado el umbral       | «Soltá para actualizar». Un cliente creado por REST después de cargar la app aparece sin recargar. Los estados en orden, «Sincronizando…» a la vista 502 y 504 ms en dos corridas, cero documentos, y una marca puesta en `window` sigue ahí. |
| A mitad del scroll            | El `scrollTop` baja como siempre y el indicador no aparece nunca.                                                                                                                                                                             |
| Sin conexión                  | «Sin conexión. Estás viendo lo último que se sincronizó.», nunca «sincronizando», termina solo y no hay pedidos.                                                                                                                              |
| Con un cambio en la cola      | Con el evento `online` callado la cola sigue parada; después del gesto el cliente llega a la base, una sola vez.                                                                                                                              |
| Con una hoja abierta          | Tirar sobre la hoja y sobre el fondo no produce ningún estado ni pedido.                                                                                                                                                                      |
| Con el bloqueo con huella     | Actualizar no pide la huella ni recarga. Con la app bloqueada al volver, el gesto no hace nada.                                                                                                                                               |
| Zona segura de arriba, 0 y 47 | El indicador queda a 24 px del borde del `<main>` en los dos casos, el borde está en 0 y en el centro del indicador lo de más arriba es el indicador.                                                                                         |
| Movimiento reducido           | La flecha que gira está oculta y el ícono de sincronizar no tiene animación (`none`); sin la preferencia es `maun-spin`.                                                                                                                      |

**Se comprobó que fallan con el error puesto.** Con el gesto siempre habilitado, el de la hoja ve
`tirando`, `listo-para-soltar`, `sincronizando` y `desenlace`. Con `overscroll-behavior-y: none` en el
`<main>`, tirar y volver deja el contenido scrolleado 85 px. Sin releer `navigator.onLine`, la cola no
drena.

**Con los ojos**: capturas de los cuatro estados en claro, en oscuro y con movimiento reducido, sin
señal y con la zona segura de arriba en 47 px.

**Tests de unidad**: el hook (umbral, máximo, elasticidad, tiempo mínimo, contenedor scrolleado, dedo
hacia arriba, dos dedos, deshabilitado a mitad del tirón, sin doble sincronización, falla),
`sincronizarAhora` (sin señal, drena y trae, rechazo, fallo, tope), las rutas con el gesto, el
registro de lo que está en curso, los textos del desenlace y que `reanudarCola` se cumple cuando la
cola drenó.

**Lo que es razonamiento y no prueba**: todo lo que depende del teléfono. El estiramiento de Android,
que el Samsung enganche el gesto a la ventana como Chromium, y cómo se sienten con el dedo los 64 px.

## Objeciones

- **Nada se probó en un teléfono.** Los toques del e2e son reales para Chromium, pero Chromium
  headless no tiene el estiramiento de Android ni la recarga nativa. Que los listeners pasivos
  alcancen depende de que el Samsung enganche el gesto a la ventana como Chromium. Si al tirar se ve
  el contenido estirarse o moverse, el `touchmove` tiene que pasar a cancelarse mientras se tira.
- **«Con cambios sin guardar» cubre los dos formularios en línea que hay hoy en esas pantallas.** Uno
  nuevo tiene que anotarse con `useAlgoEnCurso`. Si no, el gesto sincroniza con el formulario abierto:
  no pierde lo escrito, porque sincronizar no desmonta nada, pero el pedido era que no pase.
- **Los diez segundos de tope son un número elegido**, no medido con la señal del taller.
- **Sin señal, el texto ocupa dos renglones y tapa el título de la pantalla** mientras está a la
  vista, unos dos segundos. Se vio en las capturas. Es el texto de `describirEstadoSync`, que se reusó
  a propósito; acortarlo solo para el indicador sería un segundo vocabulario.

## Consecuencias

- Nunca `location.reload()` ni `navigate(0)` para traer datos nuevos: se sincroniza.
- Un formulario en línea nuevo en una pantalla con el gesto se anota con `useAlgoEnCurso`.
- El `<main>` no lleva `overscroll-behavior`, o los listeners pasivos dejan de alcanzar.
