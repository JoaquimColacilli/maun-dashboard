# 0071. La entrega y sus fechas: listo, la estimada, la comprometida y lo que contesta el cliente

- Estado: aceptada
- Fecha: 2026-09-25
- Completa al [0029](0029-el-estado-se-cambia-desde-la-ficha.md) (pasos de «Qué falta» que no cambian
  el estado), al [0034](0034-la-agenda-calcula-lo-que-sale-de-los-trabajos.md) y al
  [0045](0045-los-costos-estimados-lo-que-hace-falta-y-mover-en-la-agenda.md) (la entrega de la
  agenda es la comprometida si la hay, y esa no se arrastra), al
  [0042](0042-lo-hecho-de-los-trabajos-y-las-marcas.md) (listo es un día guardado en una columna), al
  [0046](0046-la-vista-del-cliente-una-lista-blanca-en-la-base.md) y al
  [0067](0067-la-vista-antes-de-aprobar.md) (la lista blanca suma listo, la comprometida y la
  coordinación, y nunca manda una fecha que ya pasó), al
  [0057](0057-las-opiniones-de-los-clientes.md) (la segunda puerta de escritura sin sesión), al
  [0058](0058-el-estimativo-y-el-relevamiento-en-el-camino-del-cliente.md) y al
  [0070](0070-el-camino-tilda-lo-que-paso.md) (la etapa listo en el camino, sin un paso nuevo), y al
  [0069](0069-el-dibujo-del-trabajo-del-cliente.md) (una escena más).

## Contexto

El hermano pidió, con sus palabras, que mientras el mueble se fabrica el cliente lea «Lo estamos
fabricando» con la «Fecha estimada de entrega», y que cuando está terminado lea «Tu mueble está
listo» y se coordine el día: o él le propone uno y el cliente lo aprueba con un botón, o el cliente
abre un calendario y marca varios días con su horario y una nota. Que se distinga la fecha estimada
de la fecha de entrega comprometida («¡Buenas noticias! Lo estamos entregando el jue 8 oct»). Y un
analítico que compare lo estimado con lo entregado y cuánto demora cada tipo de proyecto, con los
datos guardados para, más adelante, estimar solo (eso no se construye ahora).

## Lo que decidió Joaquim antes de empezar

1. **Listo es un día guardado, `listo_el`, no un estado nuevo.** El trabajo sigue en curso.
2. **Aceptar el día propuesto lo compromete solo**, sin que el taller confirme de nuevo.
3. **Dos franjas, «a la mañana» y «a la tarde»**, y una nota. Sin horas.
4. **Las fechas se escriben «jue 8 oct»**, nunca «8/10».
5. **La comprometida se puede poner también mientras se fabrica.**
6. **Las dos formas conviven** y el taller elige en cada trabajo. El calendario se abre cuando el
   taller pide los días («Pedirle sus días») o cuando el cliente no puede el día propuesto. Va de
   pasado mañana a 30 días y no tiene domingos.
7. **Lo que contesta el cliente llega a la app abierta y a Inicio.** Sin avisos al celular nuevos.
8. **Al cliente nunca se le muestra una fecha que ya pasó**, y la ficha se lo advierte al taller.
9. **El tipo de proyecto es texto libre con sugerencias.** Sin pantalla para administrarlos.
10. **El analítico no muestra números que los datos no sostienen**: con menos de cinco en un grupo,
    los casos uno por uno.

## Decisión

### La base

- Enums nuevos: `franja_de_entrega` (`manana`, `tarde`), `forma_de_coordinar` (`un_dia`,
  `sus_dias`), `respuesta_de_entrega` (`me_queda_bien`, `mis_dias`), `tipo_de_fecha` (`estimada`,
  `comprometida`) y `origen_de_la_fecha` (`taller`, `cliente`, `importada`).
- En `proyectos`: `listo_el`, `entrega_comprometida`, `entrega_comprometida_franja` y
  `tipo_de_proyecto` (de 1 a 60 caracteres, sin blancos en las puntas). Listo y la comprometida
  existen desde que se aprueba; listo no puede ser posterior a la entrega; la franja no existe sin
  su día.
- `private.cuidar_las_fechas_de_la_entrega()`, un before trigger que deja las fechas coherentes con
  el estado sin que nadie tenga que acordarse: antes de aprobar no hay listo ni comprometida, en
  curso no hay fecha de entrega, y sin comprometida no hay franja.
- **`propuestas_de_entrega`**: lo que el taller le pide al cliente. A lo sumo una abierta por trabajo
  (índice único parcial). Una guarda (`MN021`) no deja proponer si el trabajo no está listo, si la
  entrega ya está comprometida o si el día no es desde mañana. Comprometer la entrega, dejar de estar
  listo o salir de en curso la cierra sola.
- **`respuestas_de_entrega`**: lo que contesta el cliente, atado a la propuesta que contesta. El
  taller solo puede marcarla leída.
- **`cambios_de_fecha`**: la historia de la estimada y la comprometida de cada trabajo, con quién la
  decidió (el taller o el cliente), el día y cuántos trabajos había en curso y sin terminar. La
  escribe un trigger; nadie la edita. Los trabajos que ya estaban aprobados con una estimada
  entraron con una fila `importada`: es la fecha que tenían, no necesariamente la primera.
- **`proponer_la_entrega(p_proyecto_id, p_propuesta)`**, del dueño, cierra la abierta y abre la
  nueva en una transacción, y con `null` solo cierra. Es idempotente por el id.
- **`responder_la_entrega(p_token, p_respuesta)`**, la quinta función que puede llamar alguien sin
  sesión. Valida con su gemela del dominio (`validarRespuestaDeEntrega` ↔
  `private.validar_respuesta_de_entrega`), rechaza con `MN020` y el motivo en el detalle, contesta
  `guardada`, `ya_confirmada` o `cambio` (si la propuesta que tenía abierta el cliente ya no es la
  vigente), y con «me queda bien» compromete la entrega con origen `cliente`. Hasta 20 respuestas por
  pedido, 10 días y 500 caracteres de nota.
- `vista_del_cliente` suma listo en las fechas y una clave `entrega` con la comprometida (solo si no
  pasó), la propuesta abierta (solo si su día no pasó) y la última respuesta a ella.

### El dominio

- La vista del cliente tiene una etapa más, `listo`: en curso con `listo_el`. El titular dice «Tu
  mueble está listo», el paso 4 dice «Listo para entregar» y «lo próximo» dice qué falta según la
  coordinación. No hay paso nuevo en el camino.
- Con una comprometida que no pasó, el titular es la buena noticia y la tarjeta dice «Entrega
  confirmada» con su franja. Si pasó, no se muestra: la tarjeta dice «Entrega» «A confirmar».
- La agenda pone la entrega en la comprometida si la hay, con su franja y sin hora, y esa no se
  puede arrastrar.
- `analisisDeEntregas`: para cada trabajo entregado, la primera estimada, el desvío, si acertó
  (hasta tres días), si cumplió la comprometida, cuánto tardó del arranque a la entrega y a listo, y
  cuántos trabajos había en curso al aprobarlo. Resume con los casos uno por uno por debajo de 5, la
  mediana desde 5, las cuentas «k de n» desde 10 y el porcentaje desde 20.

### La página del cliente

- «Coordinemos la entrega» aparece solo con el mueble listo, sin comprometida y con algo pedido.
  Con un día propuesto: «Me queda bien» y «No puedo ese día»; con sus días pedidos, o si no puede,
  el calendario.
- El calendario son botones con `aria-pressed` de 44 px, con el nombre del día completo para quien
  lo escucha; los días que no se pueden elegir no son botones. Marcar un día lo suma con la mañana y
  la tarde; se destilda una franja, y sin ninguna el día se va. Hasta diez.
- Se manda por POST y no se guarda nada en el navegador. Sin señal, lo marcado queda en pantalla y
  el reintento usa el mismo id, así que no se duplica.
- En la vista previa del taller los botones andan pero no mandan nada: «Acá no se guarda nada: así
  lo ve tu cliente.»
- **Al mandar, el calendario se cierra solo.** Pasa a «Nos pasaste estos días. Vamos a elegir uno y
  te lo confirmamos en esta página.», con la lista, la nota y «Cambiar mis días». Al cambiarlos,
  «Dejarlos como estaban» vuelve sin mandar nada. En la vista previa hace el mismo recorrido sin
  escribir, y «Me queda bien» cuenta lo que vería el cliente, con «Volver a empezar».
- La página usa el día del taller, no el del teléfono del cliente, para calcular lo que se puede
  elegir y lo que ya pasó.

### La app del taller

- En «Qué falta», «Ya está listo» y «Todavía no está listo» escriben `listo_el` sin cambiar el
  estado. «Ya lo entregué» anota hoy aunque hubiera una fecha vieja.
- El panel «La entrega» de la ficha muestra la estimada y la comprometida, cada una con su cambio;
  con el mueble listo, proponer un día o pedirle sus días, lo que contestó con un botón por cada
  franja para confirmar, «La aceptó …» cuando la comprometida vino del cliente, y el acceso a cómo
  lo ve. Si una fecha pasó, lo advierte.
- Listo y la comprometida se escriben por su lado, un update de esas columnas solas (como los costos
  del 0045), no por `guardar_proyecto`: así el formulario abierto no pisa lo que contestó el cliente.
  `guardar_proyecto` igual las acepta si vienen. El tipo de proyecto va con el formulario.
- Pedirle el día necesita señal, como crear el enlace: un pedido que no está en la base no lo ve el
  cliente. Lo demás va por la cola.
- Inicio muestra «Cintia aceptó el jue 8 oct» o «Cintia te pasó sus días» hasta que se abre la
  ficha, que las da por leídas. La entrega más próxima es la comprometida si la hay. Las listas
  muestran la insignia «Listo» y ordenan por la entrega.

### El analítico

`/proyectos/analitico`, desde una tarjeta de Historial que aparece si hay algo entregado. Qué tan
preciso es estimando, cuánto tarda por tipo de proyecto, según cuántos trabajos tenía en curso, y
trabajo por trabajo detrás de «Ver los números» (abierto con menos de cinco).

## Lo que decidí yo

- La puerta del cliente corre las guardas diferidas en el momento (`set constraints all
immediate`) y las vuelve a diferir: al commit correrían como `anon` y cortarían con `42501`. Toda
  constraint diferible nace diferida, y un test lo exige.
- El tamaño de lo que manda el cliente (16 KB) se mira antes de la gemela y no es parte de ella.
- Las gemelas aceptan solo años 2xxx.
- Proponer sobre un trabajo borrado es `MN002`, como en el resto.
- El dueño solo puede cerrar o borrar una propuesta; la baja de un trabajo borra sus respuestas y su
  historia con una función `security definer`.
- `created_at` de la historia y de las respuestas es `clock_timestamp()`, para que el orden dentro de
  una misma transacción sea el real.
- «Volvió al taller» también deja una fila de la estimada: entra de nuevo en curso.
- Una nota sola, sin días, es una respuesta válida.
- Las respuestas que llegan con la ficha abierta también se dan por leídas: se están viendo.
- El seed suma un placard listo con un día propuesto en 2030, para que no venza.
- La grilla del mes pasó de la agenda a `shared/lib` para que la use también la página del cliente.

### Lo que apareció al probarlo

Joaquim probó la página y el botón de mandar se podía tocar una y otra vez. Pasaba en dos casos:

- **En la vista previa del taller**, donde mandar no escribe y la sección quedaba igual.
- **En la página del cliente, al volver a mandar los mismos días** con «Cambiar mis días».

La sección esperaba a que volviera la vista para pasar a lo mandado: se remontaba con una clave que
incluía la respuesta. Con la misma respuesta, la clave no cambiaba y el calendario seguía abierto.

Ahora la clave es solo la propuesta, y al mandar la sección pasa a lo mandado por su cuenta, con un
id nuevo para la próxima vez. Mientras manda, el botón se apaga y un segundo toque no sale. Pasar a
lo mandado no espera a que vuelva la vista; si esa relectura falla, igual queda cerrado.

## Desvíos del pedido

- **La tarjeta del analítico en Historial aparece aunque no haya nada cobrado.** El análisis cuenta
  también los entregados sin cobrar, que viven en Activos; con Historial vacío no había cómo llegar.

## Objeciones

- **«Me queda bien» compromete solo** (decisión 2). Si el taller propuso un día y después lo ocupó
  con otro trabajo, el cliente lo puede aceptar igual mientras el pedido siga abierto. Cambiar el
  pedido cierra el anterior y un día que pasó se esconde, pero conviene revisar los pedidos
  abiertos.
- **Sin aviso al celular** (decisión 7). Si la app no está abierta, un «me queda bien» que ya
  comprometió el día se ve recién al abrirla. Con los avisos que ya existen sería poco trabajo.
- **Listo se marca con el día de hoy.** No se puede poner otro día desde la app; si se marcó por
  error, «Todavía no está listo» y otra vez.
- **Las franjas no tienen horas** (decisión 3). «A la tarde» puede ser distinto para cada uno.
- **El tipo es texto libre** (decisión 9). «Placard» y «placard» se juntan, «Placares» no.
- **La primera estimada de los trabajos que ya estaban en curso es importada.** El analítico lo
  aclara, pero entra en la cuenta.
- **«Del arranque» usa la fecha de inicio**, que muchos trabajos traen del sistema anterior (la
  objeción del 0070): esos tiempos pueden salir raros.

## Alternativas descartadas

- **Listo como estado.** Rompía el embudo, los filtros y el cobro, y es un día, no una etapa.
- **Un paso nuevo en el camino del cliente.** Quedó afuera del pedido; el paso 4 cambia de texto.
- **Escribir listo y la comprometida por el formulario.** Con el formulario abierto, lo que contesta
  el cliente quedaba pisado o en conflicto.
- **Encolar el pedido al cliente.** Un pedido que no llegó a la base no existe para él.
- **Un calendario con `role="grid"` y flechas.** Con veintitantos días, botones con Tab alcanzan y
  cualquier lector los entiende igual.

## Consecuencias

- Una fecha nueva del trabajo que el cliente pueda ver pasa por la lista blanca de la vista y por
  el trigger de la historia si sirve para el analítico.
- `MN020` es de la puerta del cliente y `MN021` de la guarda de la propuesta.
- Estimar la fecha solo, más adelante, sale de `cambios_de_fecha` (la carga del taller está
  guardada en cada cambio).

## Cómo se verificó

- pgTAP: `33_la_entrega_y_sus_fechas` (69) y `34_la_puerta_de_la_entrega` (56), más los ajustes de
  estructura, anónimos, aislamiento, sincronización, vista, encuesta, aviso de cambios y la vista
  antes de aprobar.
- Concurrencia con conexiones reales: dos «me queda bien» a la vez y una propuesta nueva que espera
  a la respuesta que se está guardando.
- Las gemelas de la validación, en casos fijos y 2000 al azar con las dos formas.
- Dominio al 100%. Tests de la app para la réplica, los lectores, las mutaciones, la página del
  cliente, la ficha, Inicio y el analítico.
- E2E: `sin-sesion/coordinar-la-entrega` (el día propuesto, sus días, sin señal, el pedido que
  cambió, solo con el teclado, nada guardado en el navegador) y `con-sesion/la-entrega` (listo y la
  vista previa, la respuesta que llega sola, confirmar un día, «Qué falta», la agenda y el analítico
  con 4, 6 y 12 trabajos), en celular y escritorio. La suite entera, con los specs que cambiaron por
  esto (las acciones de «Qué falta», «Entrega estimada», la ayuda de ocho láminas y el orden por la
  entrega): 548 pasan, 91 salteadas de un solo ancho, ninguna falla.
- El e2e encontró dos cosas que se arreglaron antes de cerrar: la tarjeta del analítico no aparecía
  con Historial vacío (el desvío de arriba), y «Ver los números» quedaba abierto si la pantalla se
  armaba primero con menos de cinco trabajos.
