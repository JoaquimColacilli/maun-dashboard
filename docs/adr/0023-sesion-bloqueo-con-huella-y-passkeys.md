# 0023. Pantallas de sesión, bloqueo con huella y passkeys

- Estado: aceptada
- Fecha: 2026-09-13

## Contexto

Las pantallas de acceso eran lo primero que ve cualquiera y eran genéricas. El dueño pidió rediseñarlas
todas (entrar, registrarse, olvidé la contraseña, restablecerla, confirmá tu mail) y sumar una más: un
bloqueo con huella al abrir la app en el celular, con el prompt saliendo solo, como en la app del
banco. Las decisiones del bloqueo vinieron tomadas; acá queda cómo se implementaron, dónde se apartó la
implementación y las objeciones.

## La pantalla de bloqueo es una barrera de uso, no una frontera de seguridad

**La seguridad real es la sesión persistida.** El refresh token sigue guardado y la app arranca
autenticada sin red, exactamente como desde el ADR 0012. El bloqueo tapa la interfaz hasta que la
persona demuestra que es ella con la huella. **Protege contra alguien que agarra el teléfono
desbloqueado, no contra un atacante con acceso al almacenamiento, que ya tendría la sesión.** Es lo
mismo que hace el bloqueo de cualquier app de banco. Borrar los datos del sitio o abrir las
herramientas de desarrollo lo saltea, y está bien que así sea: no es lo que cuida.

Dos operaciones distintas usan la misma credencial:

- **Desbloquear es local.** `navigator.credentials.get()` con `userVerification: 'required'`, un
  desafío de 32 bytes generado en el cliente, sin `rpId` (vale el dominio de la página) y sin mediación.
  El sistema operativo no entrega la aserción sin la huella, y con que la ceremonia termine bien alcanza.
  No se manda nada al servidor: funciona sin señal. Vive en `shared/lib/huella.ts`.
- **Entrar es real.** Contra Supabase, para un dispositivo nuevo o una sesión vencida, y necesita red.
  Se ofrece en el autocompletado del mail (ver abajo).

## El flujo

- **Inscripción.** Después de entrar con la contraseña en un celular con autenticador de plataforma,
  `OfertaDeHuella` pregunta una sola vez por usuario (`maun:huella-preguntada`, sobrevive a cerrar
  sesión como el tema). «Sí» registra la passkey y deja la marca local `maun:bloqueo`; «Ahora no» no
  vuelve a preguntar. Ajustes activa, desactiva y dice el estado.
- **Al abrir, el prompt sale solo.** `PantallaDeBloqueo` dispara la ceremonia en el efecto de montaje,
  una vez, y no reintenta sola: Safari reemplazó el gesto por límites de frecuencia sin umbrales
  publicados. En StrictMode de desarrollo el primer pedido se aborta y sale un segundo; en el build
  corre uno solo, y el e2e lo cuenta.
- **El botón «Usar la huella» es el respaldo**, para cuando el prompt se descartó o el navegador lo
  limitó.
- **Cancelar o fallar lleva a la contraseña, sin pasar por el taller.** La guarda (`ConBloqueo` en
  `app/router/guardas.tsx`) reemplaza todo lo que cuelga de `RutaConSesion`: ni la réplica se monta
  detrás. Con la contraseña se entra por `signInWithPassword`, que necesita red.
- **Sin señal no hay formulario que va a fallar**: dice «Sin señal solo podés entrar con la huella» y
  deja el botón de la huella. Si el sensor no responde (`NotSupportedError` y parecidos), lo dice.
- **Al cerrar sesión se borra la marca**, en `limpiarDatosLocales`, que corre también con `SIGNED_OUT`.
- **Activar la huella no bloquea la apertura en curso**: el que la activó acaba de demostrar que es él.
  La marca de «desbloqueada en esta apertura» vive en memoria y el store avisa por evento.
  - **Corregido por el ADR 0026.** En memoria, una recarga era una apertura y volvía a pedir la huella.
    Ahora la marca guarda el momento del desbloqueo y el de la salida, y se pide pasado un minuto afuera.

**Solo en celular.** El corte es el de siempre (768 px), medido sobre **el lado corto de la pantalla**
y fijado al abrir (`esCelular`): girar el teléfono no saca el bloqueo y achicar la ventana de la PC no
lo pone. El mecanismo no distingue: para tenerlo en escritorio alcanza con sacar `esCelular()` de
`ConBloqueo`, de `OfertaDeHuella` y de la sección de Ajustes.

**Se apartó:** la credencial conocida. `registerPasskey` devuelve el UUID de la passkey en Supabase,
no el id de la credencial WebAuthn. El id se anota en el primer desbloqueo que sale bien y desde ahí
se pide con `allowCredentials` y `transports: ['internal']`, para que Android vaya directo a la huella.
El primer desbloqueo puede mostrar antes el selector de cuentas. Se prefirió eso a reemplazar
`registerPasskey` por la ceremonia en dos pasos.

## Passkeys de Supabase

- **Es beta y experimental** (desde el 2026-05-28): la API puede cambiar sin aviso. `crearClienteMaun`
  prende `auth: { experimental: { passkey: true } }`. supabase-js ya estaba en 2.116.0, más nuevo que el
  2.105.0 que pide; no se actualizó nada y no hay dependencias nuevas.
- **La mediación condicional no está en `signInWithPasskey`**: se arma con `auth.passkey.startAuthentication`,
  `navigator.credentials.get({ mediation: 'conditional' })` y `verifyAuthentication`. El mail lleva
  `autocomplete="username webauthn"`. Es una mejora pasiva: si el servidor no da el desafío o el
  navegador no puede, no se muestra nada. Solo un fallo al verificar, cuando la persona ya eligió su
  passkey, llega a la pantalla.
- **Los tipos JSON de WebAuthn de auth-js no calzan con los de `lib.dom`** (tipan las extensiones con
  `ArrayBuffer`). La aserción se arma campo por campo, sin extensiones.
- **La configuración del proyecto está pendiente.** Verificado el 2026-09-13 con la API de
  administración: `passkey_enabled = false` y RP ID vacío. Hasta que se active en Authentication →
  Passkeys, el servidor responde `passkey_disabled` y la app lo traduce.

## El rediseño

- **Un molde, `PantallaDeAcceso`**: un tablero oscuro con la marca y un formulario, unidos por el canto
  de los cuatro tesoros (las mismas piezas proporcionales y el mismo `maun-corte` del despiece, una
  sola vez por carga). En escritorio van lado a lado con filas compartidas por subgrid; en celular, el
  tablero arriba y el formulario abajo, al alcance del pulgar.
- **El teclado.** `#root` es `fixed` con `overflow: hidden`, y la pantalla vieja no scrolleaba: con el
  teclado abierto lo de abajo quedaba cortado. Ahora el contenedor toma el alto y el desplazamiento del
  `visualViewport` (`useVentanaVisible`), el tablero se achica a la marca y, al enfocar, se acomoda
  primero el botón de enviar y después el campo. No se tocó `interactive-widget` en el viewport: cambia
  toda la app y iOS no lo soporta.
- **Una sola contraseña al registrarse y al restablecer**: el botón de ver reemplaza a «Repetí».
- **«Revisá tu correo» es un registro, no un festejo**: el mail escrito, «Cambiar», reenviar con cuenta
  regresiva y la advertencia de los pocos mails por hora.

## El botón de ver la contraseña

**No existía en la app: era el de Edge** (`::-ms-reveal`). Verificado en Edge: aparece al tipear, se va
al perder el foco y no vuelve hasta vaciar el campo, ni aparece con un valor autocompletado o puesto
por script. Se esconde en `theme.css` y `CampoDeContrasena` trae el propio, siempre presente, con
`aria-pressed` y el nombre fijo «Mostrar la contraseña». No le saca el foco al campo, conserva el
cursor y vuelve a ocultar al enviar, para que el gestor lo guarde como contraseña.

## Los mensajes

Ningún rechazo del acceso llega en inglés: los códigos de Auth, de passkeys y de WebAuthn tienen su
castellano, y lo que no se conoce dice el código entre paréntesis. Dos casos que antes no se veían:

- **Un mail ya registrado no da error**: Supabase devuelve un usuario sin identidades. `crearCuenta` lo
  detecta (`esAltaRepetida`).
- **Un enlace vencido vuelve con `error_code` en la URL.** `/acceso` y `/acceso/nueva-contrasena` lo
  traducen y limpian la dirección.

## Lo que se encontró por el camino

- **El enlace de recuperación podía perder el aviso.** `QueryProvider` crea el cliente al montar y el
  canje del código empezaba ahí; si terminaba antes de que la pantalla lazy se suscribiera, el
  `PASSWORD_RECOVERY` se perdía y decía «Esta pantalla se abre desde el correo». Reproducido con el
  canje instantáneo. El cliente ahora lo escucha al crearse (`vinoPorRecuperacion`).
- **El indicador de sincronización tapaba el botón de la huella** sin señal, y decía «estás viendo lo
  último que se sincronizó» donde no se ve nada. Se mudó de `Shell` a `Marco`.

## Objeciones

- **Atar el desbloqueo a la passkey del servidor** hace que activar el bloqueo necesite señal, la
  configuración del proyecto y el dominio de producción. Una credencial solo local, creada con
  `navigator.credentials.create()`, andaría en cualquier dirección y sin red, a costa de registrar la
  huella dos veces. Se implementó lo pedido.
- **El RP ID `maun-dashboard.netlify.app` deja afuera a `localhost` y a los deploy previews**
  (`deploy-preview-N--maun-dashboard.netlify.app` no es subdominio, y `netlify.app` es sufijo público).
  Para probar la rama en el teléfono: o producción, o un RP ID temporal `localhost` con el teléfono por
  USB y reenvío de puertos de Chrome. Cambiar el RP ID invalida las passkeys ya creadas.
- **Supabase registra con `userVerification: 'preferred'`.** En Android la huella se pide igual, y el
  desbloqueo local exige `required`, pero el servidor no lo garantiza.
- **Desactivar el bloqueo no borra la passkey del servidor**: sigue sirviendo para entrar desde el
  autocompletado. Volver a activarlo reconoce la credencial repetida y la confirma con la huella en vez
  de duplicarla.
- **El bloqueo es al abrir, no al volver de segundo plano.** Monzo vuelve a pedir después de cinco
  minutos afuera; acá no, porque el pedido fue «al abrir».
  - **Resuelta por el ADR 0026**: se pide también al volver de segundo plano, pasado un minuto.
- **Nada de esto se probó en un teléfono.** Que Chrome en Android dispare el `get()` modal al cargar,
  sin gesto, no está confirmado en ninguna fuente primaria (sí que exige que la página tenga el foco).
  Que la ceremonia ande en modo avión con una passkey de Google Password Manager tampoco. El teclado
  se probó achicando el viewport, que emula `resizes-content` y no el `resizes-visual` real de Chrome.

## Alternativas descartadas

- **`uiMode: 'immediate'`**: exige gesto y sirve para sondear credenciales, no para desbloquear.
- **Desbloquear con `signInWithPasskey`**: necesita red, que es justo lo que falta en el taller.
- **Un botón «Entrar con passkey» en el login**: el autocompletado hace lo mismo sin sumar nada.
- **Fijar el botón de enviar abajo con `interactive-widget=resizes-content`**: cambia toda la app, iOS
  no lo soporta y sin él el botón queda debajo del teclado.

## Consecuencias

- El bundle, medido con `vite build` sobre main y sobre esta rama:

  | Chunk                      | main                       | Esta rama                  |
  | -------------------------- | -------------------------- | -------------------------- |
  | Aplicación                 | 236,52 kB (62,97 kB gzip)  | 244,89 kB (65,16 kB gzip)  |
  | Pantallas de acceso (`ui`) | 39,75 kB (13,48 kB gzip)   | 55,60 kB (18,96 kB gzip)   |
  | Vendor                     | 746,36 kB (218,65 kB gzip) | 747,63 kB (219,09 kB gzip) |
  | CSS                        | 51,83 kB (10,57 kB gzip)   | 53,91 kB (10,91 kB gzip)   |
  | Precache                   | 29 entradas, 1163,10 KiB   | 29 entradas, 1189,73 KiB   |

  **El opt-in de passkeys no mueve el vendor**: es un flag que se lee en tiempo de ejecución, y los
  métodos de passkeys son de la clase de auth-js 2.116.0, que ya estaba entera en main. Los 1,27 kB
  que suma el vendor son los tres íconos nuevos de lucide (el ojo, el ojo tachado y la huella).

- El e2e prueba la huella con el autenticador virtual del protocolo de DevTools y las respuestas de
  Supabase simuladas; cerrar sesión intercepta el `logout` para no revocar la sesión de la cuenta de
  prueba.
- Toda pantalla de sesión nueva es un `PantallaDeAcceso`, y todo campo de contraseña un
  `CampoDeContrasena`.
