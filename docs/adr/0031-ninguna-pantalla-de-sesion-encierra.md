# 0031. Ninguna pantalla de sesión encierra

- Estado: aceptada
- Fecha: 2026-09-14
- Completa al [0023](0023-sesion-bloqueo-con-huella-y-passkeys.md) y al
  [0012](0012-acceso-sesion-y-cola-de-salida.md).

## Contexto

Si la huella falla, la pantalla de bloqueo deja el formulario de contraseña de esa cuenta y nada más.
Si quien tiene el teléfono no es el dueño, o es el dueño y no se acuerda la contraseña, no hay
salida. Sin señal es peor: la contraseña no se ofrece (ADR 0023) y queda solo «Probar con la huella».
El dueño pidió «Entrar con otra cuenta», y que antes de cerrar se diga qué pasa con los cambios que
no se sincronizaron, porque cerrar sesión borra la réplica y la cola (`limpiarDatosLocales`).

## Decisión

**«Entrar con otra cuenta» está en las dos pantallas de bloqueo**, al abrir y al volver de segundo
plano, en todas sus fases, también sin señal.

- Vive en `features/cerrar-sesion` (`EntrarConOtraCuenta`), al lado de `BotonSalir`. La pantalla de
  bloqueo no puede importarla (un slice no importa a otro de su capa), así que la recibe como
  `otraCuenta` y la pone `ConBloqueo`, en `app/router`.
- **Con la cola vacía cierra la sesión y lleva al acceso**, sin preguntar: no hay nada que perder,
  y la réplica se vuelve a bajar al entrar.
- **Con cambios en la cola, antes dice cuántos son y qué pasa con ellos**: «Hay 1 cambio de este
  teléfono sin sincronizar. Si entrás con otra cuenta, se borra de este teléfono y no llega al taller:
  no hay forma de recuperarlo. Para no perderlo, entrá con la huella y esperá a que vuelva la señal
  para que se sincronice.» (con señal ofrece también la contraseña). El botón dice el costo: «Borrar
  el cambio y salir». Al lado, «No, volver».
- **El conteo está vivo** (`useIsMutating`): con señal la cola drena aunque la app esté bloqueada, y si
  llega a cero mientras se lee el aviso, el aviso se va solo.
- **Sin señal también sale**: `salir()` ya cae a `scope: 'local'` (ADR 0012). Se sale del teléfono; la
  sesión en el servidor vence sola.

## El recorrido: dónde más se podía quedar encerrado

Se buscó en el código cada pantalla de sesión y cada guarda, y cada estado del que solo se sale con
algo que puede no llegar nunca. Los dos que siguen se reprodujeron en el e2e antes de arreglarlos.

| Pantalla                                      | Cuándo                                          | Antes                                             | Ahora                                                           |
| --------------------------------------------- | ----------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| Bloqueo                                       | La huella falla                                 | Solo la contraseña de esa cuenta                  | Además, «Entrar con otra cuenta»                                |
| Bloqueo sin señal                             | La huella falla o no responde                   | Ninguna                                           | «Entrar con otra cuenta», con el aviso de lo que se pierde      |
| «Abriendo la app» (guardas, nueva contraseña) | Token vencido y el refresco no contesta         | **Ninguna, para siempre** (más de 25 s en el e2e) | A los 10 s abre con la sesión guardada, sin verificar           |
| «Trayendo los datos del taller»               | Primera carga en el dispositivo y no contesta   | **Ninguna, para siempre** (más de 25 s en el e2e) | A los 15 s, sin cortar la carga: «Reintentar» y «Cerrar sesión» |
| «No pudimos leer tus datos»                   | La carga falló                                  | Reintentar y cerrar sesión                        | Igual                                                           |
| Nueva contraseña                              | Enlace inválido, o abierta sin venir del correo | «Pedir otro enlace» o «Volver al taller»          | Igual                                                           |
| «Revisá tu correo»                            | Después del alta o del pedido                   | Cambiar el mail y reenviar                        | Igual                                                           |
| Acceso sin señal                              | Sin cuenta abierta en el teléfono               | Dice que sin señal no se entra                    | Igual: es esperar la señal, no un encierro                      |
| Oferta de la huella                           | Registrando la huella                           | «Ahora no» deshabilitado hasta que termine        | Lo resuelve la ceremonia única (ADR 0032)                       |

**«Abriendo la app».** Con el token vencido, `supabase-js` intenta refrescarlo antes de contestar
`getClaims`, `getSession` e incluso el evento inicial, y ese pedido no tiene tiempo de espera. Con la
señal del taller, que conecta y no contesta, la guarda se quedaba en el skeleton. Ahora el store de la
sesión espera `TOPE_PARA_VALIDAR_LA_SESION_MS` (10 s) y, si todavía no sabe, usa la sesión guardada
en el dispositivo (`claimsGuardados`): es el mismo escalón que el ADR 0012 ya usa sin red. Si la
validación contesta después, manda ella: una sesión que ya no sirve sale al acceso.

**«Trayendo los datos del taller».** Solo pasa la primera vez en un dispositivo, sin réplica guardada:
`bootstrap()` no tiene tiempo de espera y la guarda no tenía otra salida que cerrar la app. Pasados
15 s se ofrece reintentar y cerrar sesión debajo del skeleton, que sigue esperando.

## Objeciones

- **Cerrar sesión se lleva el bloqueo con huella.** `limpiarDatosLocales` borra la marca (ADR 0023) y
  la oferta no se repite (`maun:huella-preguntada`). El dueño que sale por error y vuelve a entrar con
  su contraseña tiene que reactivarla en Ajustes.
- **Abrir con la sesión guardada a los 10 s es abrir sin verificar.** Una sesión revocada muestra la
  copia local hasta que el servidor conteste. Es lo que el ADR 0012 ya acepta sin red, y la barrera
  real sigue siendo Postgres. Los 10 y los 15 segundos son números elegidos, no medidos con la señal
  del taller.
- **Nada se probó en un teléfono.**

## Verificación

- `store.test.ts`: el tope abre con la sesión guardada, sin sesión guardada va al acceso, una
  validación a tiempo no deja que el tope haga nada, y una validación tardía que dice que la sesión no
  sirve saca al acceso.
- `bloqueo.spec.ts`, en `celular`: con la cola vacía sale directo al acceso y borra la marca; con un
  cliente cargado sin señal, el bloqueo sin señal muestra el aviso con «Hay 1 cambio…», «No, volver»
  vuelve a la pantalla de bloqueo, y «Borrar el cambio y salir» lleva al acceso sin que el cliente
  llegue nunca a la base.
- `callejones-de-sesion.spec.ts`: con el refresco del token colgado y la sesión vencida la app queda en
  Inicio con la copia guardada, y con `bootstrap()` colgado aparecen «Reintentar» y «Cerrar sesión».
  Los dos fallaban antes del cambio.
