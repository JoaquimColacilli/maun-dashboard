# 0046. La vista del cliente: una lista blanca en la base, no una pantalla que esconde

Estado: aceptada, 2026-09-18.

## Contexto

El dueño lo pidió así:

> Yo voy muchas veces a la casa del cliente, cuando termino de instalar, y le tengo que cobrar. Me
> pregunta cuánto era, cuánto te debo. Me gustaría, porque queda recontra super pro, que yo abra la
> app, vaya al proyecto y le muestre. Y el acceso a las fotos, porque yo estoy grabando ahí las
> fotos, los planos, los renders, los comprobantes de transferencia.
>
> Lo que no quiero es que el cliente vea ni cuánto gano, ni cuánto diezmo, ni cuánto me costó el
> material.

Él lo imaginó como un ojito que tapa campos. Una pantalla que esconde datos los sigue teniendo
cargados: alcanza con rotar el teléfono, con que un componente se pinte antes que el toggle, o con
que el cliente toque atrás, para que aparezcan. Y hasta hoy no había **nada** de esta app que se
pudiera leer sin sesión: es la primera superficie pública, y es la única parte del sistema donde un
error se ve desde afuera.

## Decisión

### Lo que el cliente puede ver lo decide la base, enumerando campo por campo

`public.vista_del_cliente(p_proyecto_id uuid)` arma el payload con `jsonb_build_object` y **una
clave por campo**. Nunca `to_jsonb(proyecto)`. Devuelve: el nombre del taller, el nombre del
cliente, el título del trabajo, la dirección de entrega, la etapa, el presupuesto, los pagos (día,
concepto e importe), seis fechas y los archivos que el dueño marcó. Nada más sale de la base.

De `public.proyectos` viajan ocho columnas: `titulo`, `estado`, `presupuesto_centavos`,
`direccion_entrega`, `fecha_inicio`, `entrega_estimada`, `fecha_entrega` y `fecha_cobro`. Las otras
cuarenta y ocho no salen, y eso incluye los cuatro costos estimados, la distribución congelada, las
notas de obra, las tareas de presupuestar, las marcas de la agenda y el porcentaje de seña.

**Si esto fuera un `select *` con la pantalla filtrando, el día que alguien le agregue una columna a
`proyectos` esa columna quedaría expuesta sin que nadie lo decida.** Por eso hay un test que se rompe
solo: `supabase/tests/25_vista_del_cliente.sql` compara las columnas reales de `proyectos` contra dos
listas escritas a mano —las que viajan y las que no— y falla apenas aparece una que no está en
ninguna. No es una comprobación de que la función esté bien: es una comprobación de que alguien
decidió.

### El rol anónimo ejecuta una sola función y no tiene permiso sobre nada más

`public.vista_compartida(p_token text)` es la única función de la base con `grant execute` para
`anon`, y la única `security definer` de `public`. Sin elevar no llegaría a ninguna tabla, porque
`anon` no tiene ni un grant; con elevar, lo que devuelve lo decide la lista blanca, porque delega en
`public.vista_del_cliente()`, que es la misma función que llama la app.

En esta plataforma eso hay que vigilarlo: Postgres le da `execute` a `public` en toda función nueva y
Supabase se lo da además a `anon` por default privileges, así que una función que se olvide el
`revoke` le queda alcanzable a cualquiera sin sesión. `00_estructura.sql` dejó de preguntar «¿hay
alguna?» y ahora exige la lista exacta: `anon` ejecuta `public.vista_compartida(text)` y nada más.

### Las dos entradas son la misma función

Desde la app, la ficha tiene «Mostrarle al cliente» y desde ahí se llega a la misma pantalla que ve
el cliente (`/proyectos/:id/vista-cliente`). Esa pantalla llama a `public.vista_del_cliente(uuid)`,
que es **security invoker**: la RLS decide, y un trabajo de otro taller no existe. Desde el enlace,
`public.vista_compartida(text)` resuelve el token y llama exactamente a la misma función.

No hay dos implementaciones del payload. Si las hubiera, tarde o temprano él muestra una cosa en su
teléfono y el cliente ve otra. Los derivados de presentación —el camino de hitos, qué va en cifra
grande, la línea de tiempo— viven una sola vez en `@maun/domain` (`vistaDelCliente`), que es puro y
no puede filtrar nada que no le hayan pasado.

### El enlace: token propio, guardado hasheado, sin caducidad

`public.enlaces_publicos` guarda el **sha256 del token**, nunca el token. El token son 24 bytes
aleatorios en base64url (32 caracteres, 192 bits) generados en el navegador; el id del trabajo no
sirve como secreto porque es un UUIDv7 y codifica el momento en que se creó.

**Sin caducidad automática.** Acá hay una tensión real y vale escribirla: un enlace que vive mucho es
un secreto que nadie puede retirar, y uno que caduca rápido es hostil para el que lo usa. Para este
caso gana no caducar, porque el uso que viene es compartirlo al inicio de una obra que dura meses: un
enlace que se vence a la mitad solo genera que el cliente llame para pedir otro, y el que atiende ese
llamado es el dueño. La contrapartida se cubre con revocación explícita: dar de baja el enlace, o
generar uno nuevo, apaga el anterior. Un solo enlace vivo por trabajo, con un índice único parcial; y
generar uno nuevo apaga el viejo **en su propia sentencia**, antes de insertar, por lo que enseñó el
ADR 0043 sobre los índices únicos parciales.

**Un enlace inválido, revocado, de un trabajo borrado o de un trabajo dado por perdido contestan
exactamente lo mismo**: `MN010`, «Este link no funciona», sin decir si el trabajo existe ni el nombre
de nadie. Un trabajo perdido se comporta como un enlace muerto a propósito: decirle al cliente que su
trabajo «se perdió» es contarle una decisión del taller.

### El token se muestra una sola vez

La base guarda la huella, así que la app no puede reconstruir la dirección del enlace. El token en
claro queda en **el dispositivo donde se creó** (`localStorage`, `maun:enlaces`), como el tema y la
marca del bloqueo: es estado del dispositivo, no va a la réplica ni a la cola, y `limpiarDatosLocales`
lo borra al cerrar sesión. Desde otro dispositivo la pantalla dice que el enlace sigue activo y que
la dirección quedó en el que lo creó, y ofrece generar uno nuevo.

Es una divergencia deliberada del diseño, que mostraba la dirección siempre. La alternativa —guardar
el token en claro— tira abajo la única propiedad que importa: que con lo que hay en la base no se
puedan fabricar enlaces.

### Los archivos se marcan de a uno, y nacen privados

El pedido tenía una ambigüedad: quiere que se vean los planos y no quiere que se vea el despiece, y
un plano de despiece en PDF le muestra al cliente cuántas placas y de qué medida, que es media cuenta
de lo que le costó. La resuelve él, archivo por archivo: `archivos.visible_para_cliente`, **apagado
por defecto y sin grant de `insert`**, así que ningún camino puede subir un archivo ya compartido. El
día que suba el comprobante de lo que le pagó a su proveedor está oculto porque sí, no porque se
acordó de tildarlo.

**Limitación que se anota, no se esconde: el bucket de archivos es público** (ADR 0039). Un archivo
que él no marcó sigue siendo alcanzable por quien tenga su URL exacta, que es
`{household}/{proyecto}/{archivo}.webp` con tres UUID. No es una regresión —es la protección que los
archivos ya tenían— pero tampoco es privacidad: es que nadie adivina tres UUID. Hacerlo privado de
verdad costaría servir cada archivo con una URL firmada, y eso significa perder el cache del CDN
(ADR 0039: «no uses URL firmadas ni `download()`: no cachean y todo sale como tráfico sin cache»),
agregar una ronda a la base por cada imagen y decidir qué pasa cuando la URL firmada vence mientras
el cliente mira la página. Queda anotado para el día que haga falta.

### Nada de esto se indexa

Tres capas, porque cada una tapa lo que la otra no:

- `<meta name="robots" content="noindex, nofollow, noarchive, noimageindex">` en `index.html`, que
  viaja en el HTML servido y la ve un buscador antes de ejecutar nada;
- `X-Robots-Tag` con lo mismo para todas las rutas en `netlify.toml`, porque un buscador que no
  ejecuta JavaScript ve la cabecera primero, y porque la cabecera también cubre los archivos;
- `robots.txt` con `Disallow: /`, que pide no rastrear.

`robots.txt` solo no alcanza: pide no rastrear, pero no prohíbe indexar una URL que llegó por otro
lado. La app entera va con `noindex`, no solo `/v/`: adentro está el taller.

### Se empiezan a registrar los cambios de etapa, aunque todavía no los muestre nada

La línea de tiempo que el cliente va a ver se **deriva** casi entera de fechas que ya existen:
`fecha_inicio`, `entrega_estimada`, `fecha_entrega`, `fecha_cobro`, `fecha_visita`,
`vencimiento_presupuesto`, `ultimo_contacto` y la fecha de cada pago. Faltan dos momentos que no se
pueden reconstruir después: **cuándo le mandó el presupuesto** y **cuándo lo aprobó**. Los dos son
«cuándo pasó de una etapa a otra», y eso no estaba guardado en ningún lado.

`public.cambios_de_estado` lo guarda desde ahora. Lo escribe un trigger `security definer` sobre
`proyectos`, así que no importa por dónde entre el cambio (el agregado, el cobro, la reapertura) y la
app no puede forjarlo ni corregirlo: solo tiene `select`. No está en la réplica, porque todavía no
hay pantalla que lo lea y es la única tabla que crece sin techo; cuando la línea de tiempo entre en
la app, entra.

**Lo que el cliente ve de esa historia es curado, no todo.** La vista pública lee exactamente dos
cosas del registro: la primera vez que el trabajo entró en `presupuesto_enviado` y la primera vez que
entró en `en_curso`. Si el dueño corrige un presupuesto, vuelve una etapa atrás o reabre un cobro,
eso queda guardado y no viaja. Es la misma lista blanca de los campos, aplicada a los eventos.

## Alternativas descartadas

- **La pantalla esconde y el payload viene entero.** Es lo que pidió el dueño y es lo que no hay que
  hacer: lo que no viaja no se puede filtrar por error.
- **Armar el payload en el cliente, desde la réplica.** Funcionaría sin señal, que es justo lo que
  falta (ver la objeción), pero serían dos implementaciones de la lista blanca y la del navegador no
  la protege de nada: el que abre el enlace no tiene réplica.
- **Una función de borde en Deno en vez de una función de Postgres.** Otro runtime, otro secreto,
  otro deploy, y la lista blanca terminaría igual escrita a mano. La base ya sabe hacer esto.
- **Firmar la URL de cada archivo.** Ver arriba: se pierde el CDN y no se gana tanto.
- **Caducidad de 30 días con renovación.** Hostil para el uso real, que dura meses.
- **Un enlace por cliente en vez de por trabajo.** El cliente vería trabajos que todavía no le
  mostró, y revocarlo le sacaría todos.

## Consecuencias

- Agregar una columna a `proyectos` rompe `25_vista_del_cliente.sql` hasta que alguien la clasifique.
  Es a propósito y es barato: dos segundos de pensar y una línea.
- Una función nueva en `public` que se olvide el `revoke` rompe `00_estructura.sql`, que ahora exige
  la lista exacta de lo que `anon` ejecuta.
- **La vista abierta desde adentro de la app necesita señal la primera vez.** Es la objeción que
  queda abierta: el momento exacto que el dueño describió —terminar de instalar en la casa del
  cliente— es donde peor señal hay. La atenúa el cache: la pantalla que ya abrió una vez se guarda y
  vuelve a mostrarse sin señal, con un aviso arriba que dice que puede no estar al día. No la
  resuelve. Si molesta en la práctica, lo que corresponde es que el payload lo firme la base y la app
  lo guarde entero, no que el navegador lo arme de nuevo.
- El enlace cuenta las visitas (`visitas`, `ultima_visita_at`), y esa cuenta la escribe la función
  elevada. Es la única escritura que hace alguien sin sesión en toda la base.
- Del diseño quedaron afuera dos cosas por falta de datos: la bajada del taller y el botón de
  escribirle por WhatsApp desde la página del cliente. `households` solo guarda el nombre, y no se
  inventa un teléfono. El visor de imágenes del diseño se reemplazó por abrir el archivo en otra
  pestaña: un modal menos en una página pública, y en el celular es lo que la gente espera.
- `MN010` se suma a la tabla de rechazos del ADR 0010.
