# 0032. Una sola ceremonia de WebAuthn por vez

- Estado: aceptada
- Fecha: 2026-09-14
- Completa al [0023](0023-sesion-bloqueo-con-huella-y-passkeys.md) en cómo se pide la huella, y al
  [0031](0031-ninguna-pantalla-de-sesion-encierra.md) en la sesión que vence.

## Contexto

El dueño abrió la app después de un rato largo y fue directo al formulario de contraseña, sin que
apareciera el pedido de huella. Cada toque de «Probar con la huella» hacía titilar la pantalla sin
dejarlo entrar. Cerró y abrió la app, y anduvo. Su diagnóstico: dos ceremonias de WebAuthn compitiendo,
la mediación condicional del mail (pendiente) y la del bloqueo (modal), con la segunda rechazada al
instante mientras la primera sigue abierta.

## Qué se verificó del diagnóstico, y qué no

- **Dónde estaba montada la mediación condicional: solo en `/acceso`**, en el efecto de
  `FormularioDeIngreso` (`esperarHuellaDelAutocompletado`). **No en la pantalla de bloqueo.** `/acceso`
  cuelga de `RutaPublica` y el bloqueo de `RutaConSesion`: nunca están montados a la vez. Solo se
  pueden cruzar en el tiempo si la app pasa por `/acceso` justo antes del bloqueo.
- **Ese paso existe en el código, pero no lo pude reproducir.** Leído en auth-js 2.116.0: con el token
  vencido y el refresco fallando por red, `_emitInitialSession` emite `INITIAL_SESSION` con sesión nula
  desde su `catch`, y el store la tomaba como anónima (manda al acceso, que monta la condicional);
  enseguida `leerClaims` cae a la sesión guardada y monta el bloqueo. En el e2e, con la sesión vencida y
  el refresco cortado, la app **nunca** pasó por `/acceso`: rutas `["/ajustes"]`, cero pedidos
  condicionales, un pedido de huella. auth-js reintenta el refresco con espera exponencial y el orden
  real no fue el que leí. Queda como mecanismo posible, cerrado igual y cubierto con un test del store,
  **no como la causa demostrada**.
- **Una segunda ceremonia con otra pendiente se rechaza al instante: reproducido en Chromium.** Con un
  pedido colgado en el autenticador virtual, cada toque de «Probar con la huella» se rechazó en el acto
  y la pantalla alternó ocho veces entre el diseño de la huella y el del formulario en tres toques,
  cada vuelta con «La huella no se confirmó». Es el titileo que describió el dueño. El manejador de error redibujaba porque cada
  reintento cambiaba de diseño. **No verifiqué** los tests de la plataforma web ni el reporte de
  Firefox que cita el pedido: lo medido es Chromium de escritorio con el autenticador virtual.
- **300 segundos.** La ceremonia del bloqueo ya pedía `timeout: 60_000`; la condicional usa el que
  manda Supabase. Es una sugerencia que el navegador acota: por eso el tope nuevo es propio, con
  `AbortController`, y no depende de `timeout`.
- **La sesión vencida al desbloquear.** El camino existía a medias: `SIGNED_OUT` borraba la marca y
  todo lo local y la guarda mandaba al acceso, sin bucle, pero sin decir por qué. Lo reproduce el e2e.

## Decisión

**La regla: toda llamada a `navigator.credentials` pasa por `conUnaSolaCeremonia`**
(`shared/lib/ceremonia.ts`). Hoy son tres: `pedirHuella`, la mediación condicional del acceso y el
registro de la passkey (Ajustes y la oferta). La próxima pantalla que llame a WebAuthn la usa, o
vuelve el titileo.

- **Una por vez.** Antes de empezar, cancela la pendiente y espera su rechazo. Si nunca rechaza, no la
  espera para siempre: a los `ESPERA_DE_LA_CEREMONIA_ANTERIOR_MS` (2 s) sigue.
- **Un controlador nuevo por ceremonia**, y el que manda la pantalla se enlaza a él. Nunca se reusa un
  controlador cancelado.
- **Los desenlaces se distinguen**: `terminada`, `fallida` (lo rechazó la plataforma o la persona),
  `cancelada-por-la-app` (la reemplazó otra, o la canceló quien la pidió: va en silencio) y
  `sin-respuesta` (venció el tope: se ve y se reintenta). `pedirHuella` los traduce a `confirmada`,
  `cancelada`, `no-disponible`, `interrumpida` y `sin-respuesta`.
- **Tope corto: `TOPE_DE_UNA_CEREMONIA_MS`, 30 s.** Una pantalla de bloqueo colgada cinco minutos es
  peor que un fallo rápido con reintento.
- **La condicional es pasiva y sin tope propio**: espera a que la persona elija en el autocompletado,
  no desplaza a un pedido de huella, y cualquier pedido la desplaza a ella.

**La pantalla de bloqueo es una máquina de estados** (`features/desbloquear-la-app/model/fase.ts`):

- Pide sola **una vez**, al montarse, y solo desde el estado inicial (un segundo montaje del mismo
  arranque, el de StrictMode, reemplaza al primero).
- **Una falla cae al formulario con su motivo y ahí se queda.** Ningún evento que no sea un toque
  vuelve a pedir la huella: ni un montaje, ni un resultado viejo.
- **Reintentar desde el formulario no vuelve al diseño de la huella**: el mismo botón pasa a «Esperando
  la huella…». Si falla otra vez, cambia la bajada, no la pantalla.
- **Una cancelación propia no dice que la huella falló** (motivo `interrumpida`).
- **Al desmontar cancela lo que haya pendiente.** Ajustes y la oferta también, y «Ahora no» ya no queda
  deshabilitado mientras se registra: cancela y cierra.

**La mediación condicional en la pantalla de bloqueo: no corre, y no corría.** Se dejó en el acceso,
donde hay un mail que autocompletar. Ahora además no puede competir con la huella.

**La sesión.**

- Un evento sin sesión que no es un cierre (el `INITIAL_SESSION` nulo por un fallo de red) ya no cambia
  el estado: decide la validación, que tiene su tope (ADR 0031). Así la app no pasa por `/acceso` antes
  del bloqueo.
- **Un cierre que no pidió el usuario llega como `vencida`**: `salir()` marca que la salida es pedida,
  y cualquier otro `SIGNED_OUT` es un cierre solo. La guarda manda al acceso y el acceso lo dice: «La
  sesión de este teléfono se cerró: venció o se cerró desde otro lado.». No hay bucle: el cierre borra
  la marca del bloqueo, así que recargar no vuelve a pedir la huella.

## Objeciones

- **«Esperar el rechazo» es esperar a que se rechace la promesa de JavaScript.** Si el sistema del
  teléfono tarda más en soltar el sensor, la ceremonia nueva puede rebotar igual. Ahí la pantalla
  muestra la falla sin titilar y se reintenta con un toque, pero no hay forma de esperar a que el
  sistema termine: no lo avisa.
- **Una ceremonia que no es de la app** (otra pestaña, una extensión) no se puede cancelar desde acá.
  Es el caso del e2e del sensor ocupado: se muestra la falla, se reintenta, y entra cuando se libera.
- **30 segundos es un número elegido.** Si el dueño tarda más en apoyar el dedo, ve «no respondió» y
  vuelve a tocar.
- **La causa del titileo en el teléfono no está demostrada.** Lo reproducido es el mecanismo
  (Chromium rechaza una ceremonia con otra pendiente, y la pantalla vieja titilaba). Qué ceremonia
  quedó pendiente en el Samsung no lo sé: la condicional por el paso por `/acceso` no se reprodujo.
- **Nada se probó en un teléfono.**

## Verificación

Los e2e nuevos se corrieron primero contra el código viejo.

| Caso (`bloqueo.spec.ts`, celular)              | Antes                                                        | Ahora                                                   |
| ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| Ceremonia propia colgada y un toque encima     | Pasaba: silencio y un solo diseño                            | Pasa igual                                              |
| Otra ceremonia ocupa el sensor, tres toques    | **Fallaba**: 8 diseños alternados y 4 veces «no se confirmó» | Un solo cambio, huella → formulario; al liberarse entra |
| Sesión vencida con el refresco cortado por red | Pasaba: nunca pasó por `/acceso`, cero condicionales         | Pasa igual (no reproduce el cruce)                      |
| La sesión deja de servir al desbloquear        | **Fallaba**: llegaba al acceso sin decir por qué             | Acceso con el mensaje; recargar no pide la huella       |

- `ceremonia.test.ts`: la nueva espera el rechazo de la pendiente, tres seguidas corren solo la última
  con señales distintas, cancelar desde afuera es cancelación propia, el tope de 30 s, el rechazo de la
  plataforma como falla, la condicional pasiva en los dos sentidos y la anterior que nunca suelta.
- `fase.test.ts`: una sola vez al abrir, la falla que se queda en el formulario, el reintento que no
  vuelve al diseño de la huella, los resultados viejos, la cancelación propia sin «falló» y la
  contraseña elegida.
- `huella.test.ts`, `activar.test.ts` y `store.test.ts`: la huella interrumpida, un pedido encima de
  otro colgado, el registro cancelado al salir de la pantalla, el evento sin sesión que no manda al
  acceso y la sesión vencida que conserva su motivo.
- El resto de `bloqueo.spec.ts` (17 casos) y los e2e sin sesión (17, con la mediación condicional del
  acceso) siguen pasando.
