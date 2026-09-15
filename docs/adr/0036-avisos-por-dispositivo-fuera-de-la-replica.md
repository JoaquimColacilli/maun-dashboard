# 0036. Avisos: una suscripción por dispositivo, fuera de la réplica

- Estado: aceptada
- Fecha: 2026-09-14
- Se apoya en el [0034](0034-la-agenda-calcula-lo-que-sale-de-los-trabajos.md) (qué avisar) y en el
  [0035](0035-un-service-worker-propio.md) (el service worker). Es una excepción declarada al
  [0010](0010-sincronizacion-replica-completa.md) y al [0013](0013-shell-navegacion-e-inicio.md).

## Contexto

El dueño quiere que el teléfono le avise a la mañana qué entrega, qué visita y qué presupuesto vence. A
esa hora la app no está abierta: el aviso lo tiene que mandar un servidor, por Web Push. Hasta ahora,
todo dato vive en la réplica del household y toda escritura pasa por la cola (ADR 0010).

## Decisión

**Una suscripción es una fila por dispositivo, y no es parte de la réplica.**
`private.suscripciones_de_avisos` guarda el usuario, el endpoint (único), las dos claves del navegador,
el último envío y el último día avisado. No tiene `household_id`, no entra en `bootstrap()` ni en
`delta()` y la app no la escribe por la cola. Por qué:

- **Es del dispositivo y de la persona, no del taller.** La réplica copia todo el taller a todos los
  dispositivos del household: cada teléfono tendría las credenciales de push de los otros, y también
  las tendría un miembro futuro.
- **Suscribirse necesita red de todos modos**: el navegador habla con su servicio de push antes de que
  haya algo que guardar. La cola no agrega nada, y un alta encolada que drena tarde podría reasignar un
  endpoint que ya cambió.
- **Dos dispositivos son dos filas, y los dos reciben.** Registrar un endpoint desde otra cuenta lo pasa
  a la cuenta de la sesión y reinicia su último envío: si no, el teléfono seguiría recibiendo los avisos
  del anterior.

Las preferencias son de la persona, una fila por usuario (`private.preferencias_de_avisos`): la zona
horaria **sin default**, la hora (07:30) y qué avisa con cuánta anticipación. Las dos tablas están en
`private`, sin grants. Se tocan solo por funciones `security definer` que toman el usuario de la sesión,
con envoltorios `security invoker` en `public`: `registrar_suscripcion`, `dar_de_baja_suscripcion`,
`estado_de_mis_avisos` y `guardar_preferencias_de_avisos`.

**La función de borde `avisos`** corre en Deno, manda con el paquete de npm `web-push` 3.6.7 y habla con
la base por `fetch`, sin supabase-js.

- `GET` dice si el servidor tiene claves y trae la clave pública. Con eso la pantalla sabe si puede
  ofrecer los avisos, y la clave llega al cliente sin entrar al bundle.
- `POST` con el secreto del trabajo manda lo que toca. Un 404 o un 410 del servicio de push borran la
  suscripción. Cualquier otro error no la marca, así que la vuelta siguiente reintenta.
- `POST /probar` con el token del usuario manda una prueba a este dispositivo.
- Qué avisar lo decide `eventosParaAvisar` del dominio, importado del código fuente, sobre las filas que
  arma la misma `datosDeLaAgenda` que usa la app.

**El trabajo programado.** pg_cron corre `avisos-de-la-manana` cada 15 minutos y llama a
`private.pedir_los_avisos()`, que hace `net.http_post` a la función con la URL y el secreto que están en
Vault; sin ellos no pide nada. **La hora de cada persona la calcula la base**:
`private.avisos_por_mandar(ahora)` hace `ahora at time zone zona` con la zona que eligió, y le toca
desde su hora y durante tres horas, una vez por día local (`ultimo_dia_avisado`). Las claves VAPID están
en los secretos de la función. Nada de eso está en el repo.

**La pantalla** (`/ajustes/avisos`) sale de `faseDeLosAvisos`:

| Fase         | Qué muestra                                                                            |
| ------------ | -------------------------------------------------------------------------------------- |
| Sin claves   | Que el servidor todavía no puede mandar, y que la agenda anda igual                    |
| Sin instalar | En el iPhone abierto desde Safari: que es un requisito del sistema y cómo agregarla    |
| Sin soporte  | Que ese navegador no recibe avisos                                                     |
| Denegado     | Los pasos para habilitarlo a mano y «Ya lo habilité»                                   |
| Sin pedir    | Dónde vivís y «Activar los avisos»                                                     |
| Activos      | Qué avisa, anticipación, hora, zona, «Probar», el último envío y apagar en este equipo |

- **El permiso se pide recién al tocar «Activar los avisos»**, con `Notification.requestPermission()`
  como primera instrucción del toque, antes de cualquier `await`. Nunca al abrir la app.
- **La zona se pregunta, no se adivina.** La primera vez el select arranca vacío y sin elegirla no se pide
  el permiso. Si la persona ya eligió en otro dispositivo, viene esa.
- Abajo de todo, siempre: es un recordatorio de mejor esfuerzo.

**Deno como devDependency de `@maun/db`** (2.9.6, con su postinstall en `allowBuilds`). Es una
dependencia más que las esperadas, las del service worker y `web-push`. Sirve para correr `deno check` y
`deno test` de la función dentro de `pnpm verify`: sin eso, la función no tendría typecheck ni tests en
el único paso que el repo exige.

## Alternativas descartadas

- **Las suscripciones en una tabla del household, replicada.** Por lo de arriba.
- **Una suscripción por usuario.** El segundo dispositivo pisaría al primero.
- **Adivinar la zona con `Intl`.** El que manda es un servidor, y la zona de un teléfono de viaje no es
  la de la casa.
- **Calcular la hora en la función.** La base ya tiene las zonas y filtra antes de mandar filas.
- **Una librería de push de JSR.** `web-push` de npm es la que tiene el cifrado probado.
- **Una campana en el encabezado.** Una campana promete una bandeja de mensajes, y la app no tiene
  ninguna: los avisos son push, y lo que existe es una pantalla de configuración que vive en Ajustes, a
  un toque del avatar. Una campana que abre una pantalla de configuración es una promesa falsa: la
  primera vez que se toque esperando ver qué avisó, aparecen interruptores. Si alguna vez hace falta ver
  el historial de lo avisado, eso es una bandeja de verdad y va en su propio paso. El acceso rápido del
  encabezado de Inicio, en el celular, es a la agenda (ADR 0034).
- **«Avisos» como destino aparte en la barra lateral de la PC.** Ajustes ya está ahí y es donde vive la
  configuración.

## Objeciones

- **Es de mejor esfuerzo, y Ajustes lo dice.** El programador puede saltear una vuelta sin avisar: la
  ventana de tres horas cubre vueltas perdidas, no una mañana entera. En el plan gratuito, el proyecto se
  pausa a los siete días sin actividad y los avisos se cortan en silencio. El servicio de push de cada
  navegador puede demorarlos.
- **Una vez por día, aunque no haya nada.** Si a esa hora no hay nada que avisar, el día se marca igual:
  una anotación para hoy cargada a las 9 no genera otro aviso. Cambiar la hora después del envío tampoco
  lo repite.
- **La anticipación es una ventana, no un día.** «El día anterior» avisa también el mismo día, para que
  una entrega no desaparezca del aviso justo cuando toca. El diseño se puede leer como «solo el día
  anterior».
- **La pantalla necesita señal.** Es la única del marco con carga y error propios, porque no sale de la
  réplica (ADR 0013).
- **Tres diferencias con el diseño.** La zona se pregunta antes de activar, porque el registro la
  necesita y el permiso tiene que pedirse en el toque. El paso de agregar a inicio es solo del iPhone,
  donde es obligatorio, y no de Android. «Apagar los avisos en este dispositivo» no está en el diseño y
  la baja lo necesita.
- **Rotar las claves VAPID deja sin avisos a todos los dispositivos** hasta que cada uno los vuelva a
  activar.
- **El trabajo corre cada 15 minutos aunque nadie esté suscripto**: 96 pedidos por día a una función que
  responde enseguida.
- **El e2e no se suscribe a un servicio de push real.** Simula `PushManager` y el permiso, y registra
  endpoints `https://push.example/e2e-…` que da de baja al terminar. Si una corrida se corta, pueden
  quedar filas que el trabajo intentará y contará como fallidas.
- **Que un aviso llegue a un teléfono de verdad no está probado**, ni el iPhone, ni el diálogo de permiso
  real, ni tocar la notificación.

## Verificación

- pgTAP: `17_suscripciones_de_avisos.sql` (24: dos dispositivos son dos filas, reasignación entre
  cuentas, baja solo de lo propio, zona inexistente, endpoint sin https, claves que no son del navegador,
  sin sesión, fuera de la réplica); `18_envio_de_avisos.sql` (12: la prueba a un dispositivo o a todos,
  nunca a otro, el día anotado sin envío, el 410 que borra); `19_trabajo_de_los_avisos.sql` (12: a quién
  le toca con Buenos Aires y Madrid a distintas horas UTC, la ventana de tres horas, una vez por día, el
  día local a las 23 y el trabajo agendado).
- Deno, 12 tests de la función: el 410 y el 404 podan, un 500 no; sin claves no hace nada; el secreto del
  trabajo; `/probar` sin sesión; y `web-push` cifrando para una suscripción real.
- Vitest: la lectura del estado y las llamadas en `@maun/db`; las fases, la zona y la activación en la
  app. `ActivarLosAvisos.test.tsx` comprueba que el permiso se pide dentro del mismo click y no al
  mostrarse.
- `avisos.spec.ts`, en celular y escritorio: sin claves; la zona que se pregunta y el permiso pedido una
  vez y con activación del usuario; el registro y la baja contra la base; el permiso negado; las
  preferencias guardadas; el recorrido con teclado; el iPhone sin instalar; y el push entregado al
  service worker.
- Contra producción, con scripts fuera del repo: el `GET` dio `configurado: false` antes de cargar las
  claves y `true` después; registrar y dar de baja pasó la fila de 0 a 1 y a 0; con un endpoint que
  responde 410, `/probar` devolvió `podados: 1` y la fila desapareció; `pedir_los_avisos()` a mano
  recibió `200 {"configurado":true,…}` de la función; y el trabajo registra corridas `succeeded` cada 15
  minutos.
