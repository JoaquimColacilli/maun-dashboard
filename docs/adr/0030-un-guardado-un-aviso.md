# 0030. Un guardado, un aviso: esperar el turno en la cola no es estar sin señal

- Estado: aceptada
- Fecha: 2026-09-14
- Corrige al [0020](0020-pulido-visual.md) en cómo la cola decide «anotado sin señal».

## Contexto

El dueño guardó un contacto **con señal** y aparecieron dos avisos apilados: «Contacto anotado sin
señal: se guarda solo cuando vuelva.» y, abajo, «Contacto guardado. Estaba anotado sin señal.». El
segundo es cierto; el primero no tendría que haber salido.

## Lo que pasaba, leído en query-core 5.102.8

**El aviso no se decidía demasiado temprano.** La sospecha era que salía al arrancar la mutación,
antes de saber si iba a quedar pausada. No: `avisos-de-la-cola` avisaba con la acción `pause`, que la
mutación despacha cuando efectivamente queda en pausa. El problema es qué quiere decir esa pausa.

- `Mutation.execute` arranca el reintentador con `start()`, que llama a `pause()` si `!canStart()`.
- `canStart()` es `canFetch(networkMode) && canRun()`, y `canRun()` es `mutationCache.canRun`: con
  `scope`, solo puede correr la primera mutación pendiente del scope.
- **Una mutación que espera su turno detrás de otra se pausa igual que una sin señal**: la misma
  acción `pause` y el mismo `isPaused: true`. Cuando le toca, `runNext` la continúa y despacha
  `continue`.
- `avisos-de-la-cola` leía toda `pause` como falta de señal, y además marcaba toda `continue` como
  «estaba sin señal». Así salían los dos textos.

**Por qué con el contacto.** La hoja encola la edición del teléfono del cliente antes del guardado
del contacto (ADR 0019): el guardado nace esperando su turno. Pero no es del contacto: pasa con
cualquier mutación con aviso que salga mientras otra de la cola todavía viaja, en cualquier ancho. Los
tests lo reproducen con contacto, movimiento, cliente, proyecto y cambio de estado. En la app lo
disparan seguro la hoja de contacto con un teléfono nuevo y un proyecto guardado justo después de
crear el cliente desde el combobox, y cualquier guardado hecho con la señal lenta mientras otro viaja.

**Los dos avisos se sumaban** porque tenían claves distintas (`sin-senal` y `pendientes`).

## Decisión

- **«Sin señal» es una pausa con `onlineManager` fuera de línea.** Una pausa con señal es esperar el
  turno: no se avisa nada, y cuando termina dice «Contacto guardado.».
- **Si la señal se corta mientras espera el turno**, esa mutación no vuelve a despachar `pause`. El
  suscriptor escucha también a `onlineManager` y, al pasar a fuera de línea, anota como sin señal a
  las que estaban esperando.
- **Lo que viene de otra apertura sigue diciendo «Estaba anotado sin señal»**: se reconoce porque su
  `continue` llega sin que este suscriptor haya visto su `pending`.
- **Un guardado es un aviso que cambia de estado.** Lo anotado sin señal y lo guardado usan la misma
  clave, y `avisarEnPantalla` reemplaza en su lugar al aviso de esa clave aunque cambie el tono. Si
  lo anotado rebota al volver, el error toma su lugar (`reemplaza`) cuando ese aviso era de esa sola
  mutación.

## Lo que no se cambió

**Los formularios que se cierran con `isPaused`** (la hoja de contacto, el formulario de proyecto y
el pasaje) siguen cerrándose también cuando la pausa es por turno. Con señal eso adelanta el cierre
unos cientos de milisegundos, y un rechazo de la base llega como aviso de error en vez de verse en el
formulario abierto (ADR 0015). Cambiarlo es decidir que con señal el formulario espere también detrás
de otra mutación, y no estaba pedido.

## Objeciones

- **Con varias anotadas juntas, la primera que se guarda convierte el aviso en «guardado»** aunque
  falten otras. El indicador de sincronización sigue diciendo cuántas faltan. Contar las dos cosas en
  un mismo aviso era más texto para leer en un toast de cinco segundos.
- **«Sin señal» sigue siendo lo que cree `onlineManager`.** Con señal mala, `navigator.onLine` dice
  que hay red: la mutación sale, reintenta, y recién se pausa si el navegador avisa que se cortó. Eso
  ya era así (ADR 0012) y no cambia.
- **No se probó en el teléfono.** El caso del contacto con teléfono nuevo es determinista (la segunda
  mutación siempre sale detrás de la primera), así que lo que vio el dueño es lo que reproduce el e2e,
  pero la prueba final es suya.

## Verificación

Primero se escribieron los tests y se corrieron contra el código viejo, para ver que fallaran:

- `avisos-de-la-cola.test.ts`: 8 de 14 fallaban. Con señal, un guardado detrás de otro avisaba
  «Contacto anotado sin señal: se guarda solo cuando vuelva.»; lo mismo con movimiento, cliente,
  proyecto y cambio de estado. Ahora pasan los 14, más dos del reemplazo en `pantalla.test.ts`.
- `un-aviso-por-guardado.spec.ts`, en `celular` y `escritorio`: fallaban los 10. Con señal quedaban
  en pantalla los dos avisos de la captura del dueño; sin señal, al volver quedaban dos apilados con
  contacto, cliente, movimiento y proyecto. Ahora pasan los 10, y un observador del DOM registra que
  en todo el recorrido no apareció ningún otro texto: con señal solo «Contacto guardado.»; sin señal,
  «… anotado sin señal: se guarda solo cuando vuelva.» y después, en el mismo lugar, «… guardado.
  Estaba anotado sin señal.».
- `offline.spec.ts` sigue pasando: lo anotado antes de cerrar la app dice «Estaba anotado sin señal»
  cuando drena al reabrirla.
