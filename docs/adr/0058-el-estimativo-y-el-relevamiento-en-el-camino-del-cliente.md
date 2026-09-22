# 0058. El estimativo y el relevamiento en el camino del cliente

Estado: aceptada, 2026-09-21. Completa al [0046](0046-la-vista-del-cliente-una-lista-blanca-en-la-base.md)
(la lista blanca suma dos datos y el camino, un paso optativo) y corrige lo que ese ADR decía de la
entrada desde la app. Usa el embudo del [0038](0038-el-embudo-del-seguimiento.md) tal como está, sin
tocarlo.

## Contexto

El dueño miró «El camino de tu mueble» en la vista de un contacto y pidió, con sus palabras: «Se
puede poner una instancia de cuando estoy con el tema del presupuesto estimativo: poner presupuesto
estimativo enviado como una etapa anterior, y un casillero que quede en blanco de relevamiento
técnico pendiente que puede o no estar tildada según falte, para presupuestar».

Hasta acá el camino tenía cinco pasos fijos y arrancaba en el presupuesto. Un contacto con el
estimativo mandado leía «Estamos preparando tu presupuesto», igual que uno recién llegado, y nada le
decía si faltaba ir a medir. Peor: con el presupuesto ya mandado, la página seguía diciendo
«Estamos preparando tu presupuesto» y prometía «Lo próximo que vas a ver acá es el presupuesto».

## Decisión

### Un solo lugar

`vistaDelCliente()`, en `packages/domain/src/vistaCliente.ts`, es el único lugar donde una etapa
interna se traduce a lo que ve el cliente: el camino, el título grande, el casillero, la línea de
«lo próximo» y «Lo que fue pasando». La base manda datos crudos (la etapa, el día del estimativo, el
día y la marca de la visita) y la pantalla dibuja lo que el dominio decidió. El test «qué ve el
cliente en cada etapa del trabajo» fija, etapa por etapa, esas cuatro cosas, incluidas las
variantes del estimativo y del relevamiento.

### El estimativo, un paso optativo antes del presupuesto

- **Aparece solo en los trabajos que lo tuvieron**: los que están en «Estimativo enviado» y los que
  pasaron por ahí. El día es el primero en que el trabajo entró a esa etapa, leído de
  `cambios_de_estado` igual que el del presupuesto y el de la aprobación. Los demás siguen viendo
  los mismos cinco pasos.
- **Dice «Te pasamos un número estimado»**, en la voz de la página: como paso actual, como paso
  hecho y como línea de «Lo que fue pasando». Sin importe: el estimativo no guarda monto (ADR 0038)
  y la página no tiene de dónde sacarlo.
- **Mientras el trabajo está en esa etapa, tampoco viaja el precio.** `presupuesto_centavos` es el
  del presupuesto, y un trabajo que volvió de «Presupuesto enviado» a estimativo lo conserva:
  mostrarlo al lado de «Te pasamos un número estimado» sería ponerle un número que no es ese. Lo
  corta la base, no la pantalla: `precio_centavos` viaja en null y los pagos que vienen, sin
  importe, como en cualquier trabajo sin presupuesto.
- **Dentro del camino se compara por paso, no por posición** (`llegoAl(vista, 'aprobado')`). Con el
  estimativo adelante el índice se corre uno, y `hitoIndex >= 1` le habría dicho «aprobado» a un
  trabajo que está en el presupuesto: `sinPagosTodavia` lo hacía así.

### El casillero del relevamiento, adentro del paso del presupuesto

- **Va debajo del paso del presupuesto, no como un paso más**: ir a medir es lo que hace falta para
  presupuestar, no algo que el cliente espere por sí mismo. Se llama «Relevamiento técnico», con la
  palabra del dueño, y abajo dice qué significa: «Falta ir a medir para poder presupuestarte.» o
  «Ya fuimos a medir.».
- **En blanco mientras falta, y con el día acordado solo si ese día todavía no pasó** («Quedamos en
  ir el mar 22 sep»). Un día vencido sin marcar no se muestra: prometer una fecha que ya pasó es
  peor que no decir ninguna.
- **Tildado cuando se fue**, con el día si está cargado; ese día entra en «Lo que fue pasando» como
  «Fuimos a medir». La visita de hoy no se da por hecha hasta que termina el día o hasta que el
  dueño toca «Ya fui a relevar»: a la mañana todavía no fueron.
- **Sale de lo que ya existe, sin campo nuevo**: `fecha_visita`, `visita_hecha` y la etapa.

| Etapa                            | Sin visita cargada | Visita de hoy o futura | Visita pasada, sin marcar | Marcada («Ya fui a relevar») |
| -------------------------------- | ------------------ | ---------------------- | ------------------------- | ---------------------------- |
| Contacto, relevamiento           | En blanco, sin día | En blanco, con el día  | En blanco, sin día        | Tildado, con su día          |
| Estimativo enviado               | En blanco, sin día | En blanco, con el día  | Tildado, con su día       | Tildado, con su día          |
| A presupuestar y todas las demás | No aparece         | En blanco, con el día  | Tildado, con su día       | Tildado, con su día          |

La diferencia entre las filas es la del embudo. En contacto y en relevamiento, una visita pasada sin
marcar no prueba que se haya ido: el paso a presupuestar lo da «Ya fui a relevar». Con el estimativo
enviado, la app ya la cuenta como hecha (`yaSeRelevo`, y la fila «Estimativo enviado, visita pasada»
del ADR 0038). De presupuestar en adelante, un trabajo sin visita cargada es uno que no la necesitó.

- **El caso que los datos no separan.** En contacto y con el estimativo enviado, sin visita cargada,
  nada distingue «hace falta medir y no se hizo» de «no hace falta». La página dice lo primero porque
  es lo que la app ya le dice al dueño en esas dos etapas («Falta agendar la visita», «Si avanza,
  falta agendar la visita»): el cliente lee lo mismo que él. Cuando no hace falta, lo que existe
  alcanza para decirlo: pasar el trabajo a «A presupuestar» sin visita, y el casillero desaparece.
  La ayuda «Cómo lo ve tu cliente» lo explica. Ver la objeción.
- **El vencimiento del presupuesto no suma nada acá.** Sale del día de la visita cuando la hubo y del
  día en que el trabajo pasó a presupuestar cuando no, así que no separa un caso del otro. Tampoco
  viaja: es un plazo del dueño, no una promesa al cliente.

### «Lo próximo», por etapa

| Lo que ve el cliente                       | Lo próximo                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| El estimativo, falta ir a medir            | Si seguimos adelante, lo próximo es ir a medir para pasarte el presupuesto. |
| El estimativo, ya se midió                 | Si seguimos adelante, lo próximo que vas a ver acá es el presupuesto.       |
| El presupuesto en preparación, falta medir | Lo próximo es ir a medir, para poder pasarte el presupuesto.                |
| El presupuesto en preparación              | Lo próximo que vas a ver acá es el presupuesto.                             |
| El presupuesto mandado                     | Lo próximo es que lo apruebes y dejes la seña.                              |
| Aprobado, en la cola del taller            | Lo próximo que vas a ver acá es el arranque de la fabricación.              |
| En fabricación                             | Lo próximo que vas a ver acá es la entrega.                                 |
| Entregado, con saldo                       | Lo próximo que vas a ver acá es el pago del saldo.                          |
| Saldado                                    | Nada.                                                                       |

Con el presupuesto mandado, el título grande pasa a decir «Te pasamos el presupuesto». **Ninguna
línea tiene fecha**, y el test por etapa exige que no tenga ni un dígito: el único día que la página
promete es el de la visita, y solo mientras no pasó.

### La lista blanca

Dos datos más, enumerados como el resto: `fechas.estimativo` y `visita`, con `dia` y `hecha`. La hora
de la visita no viaja. `25_vista_del_cliente.sql` los cubre: `fecha_visita` y `visita_hecha` pasan a
la columna de las que viajan en la clasificación (la que se rompe al aparecer una columna nueva);
`visita_hora`, `vencimiento_presupuesto` y `ultimo_contacto` quedan afuera y entran como agujas que
no pueden aparecer en el JSON; las claves son exactamente doce, las fechas siete y la visita dos; un
trabajo en estimativo con presupuesto guardado no manda ni ese número ni su seña; y las dos entradas
devuelven el mismo texto byte por byte. La migración no toca ninguna tabla: los permisos del rol
anónimo quedaron idénticos y la función conserva los suyos (security invoker, solo `authenticated`).

El lector de `@maun/db` lee las dos claves nuevas y, si no vienen, entiende que no hubo estimativo ni
visita; el dominio tolera lo mismo en una vista guardada en el aparato por la versión anterior.

### La entrada desde la app, corregida

El ADR 0046 decía que desde la ficha se llega a «la misma pantalla que ve el cliente». Es el mismo
contenido, del mismo componente y de la misma función, pero **adentro del marco de la app**: con la
barra de navegación (flotante abajo en el celular, al costado en la computadora), con «Volver» y el
QR arriba, y con el scroll en `main#contenido`, que reserva abajo la holgura medida del ADR 0025. La
del enlace fluye en el documento y no tiene barra (ADR 0050).

La captura que mostró la barra encima de la vista estaba tomada arriba de todo de la página: lo que
tapaba era el medio, que seguía abajo, como pasa en cualquier pantalla de la app mientras se
scrollea. Al final del scroll no quedaba nada tapado, y la cuenta no cambió. Lo que sí cambió es la
prueba: `lo-que-flota-abajo.spec.ts` recorre ahora las dos entradas desde la app (una obra y un
contacto) en todas sus condiciones y, además de buscar texto y controles debajo de lo que flota,
mide que el último párrafo de la vista termine arriba de la barra.

## Alternativas descartadas

- **El relevamiento como un paso más del camino.** El dueño pidió un casillero y no una etapa, y
  tiene razón: el cliente no espera la visita por sí misma, la espera porque sin medir no hay
  presupuesto.
- **Un campo «no hace falta medir».** Ver la objeción.
- **Decidir el casillero en la base.** Repartiría la traducción de etapas entre la función y el
  dominio, que es lo que el pedido prohibió, y obligaría a mandar un estado armado en lugar del dato.

## Objeciones

- **Un contacto o un estimativo que no va a necesitar medir lee «Falta ir a medir» hasta que el
  dueño lo pasa a presupuestar.** Con los datos de hoy no hay cómo saberlo antes. El campo mínimo
  sería un booleano en `proyectos`, «No hace falta ir a medir», marcado en la hoja del contacto al
  lado de la Visita. No lo agregué porque tendría que cambiar también la sugerencia del embudo, que
  seguiría pidiéndole «Agendar la visita», y esa es una decisión del dueño sobre su manera de
  trabajar, no un detalle de la página.
- **Los trabajos que pasaron por el estimativo antes del 18 de septiembre no tienen ese día**, porque
  `cambios_de_estado` empezó a guardarse ese día (ADR 0046). Los que ya salieron de esa etapa no ven
  el paso; los que siguen en «Estimativo enviado» lo ven sin fecha.
- **Nada se probó en un teléfono de verdad**: las capturas y las medidas son de Chromium emulando
  celular y computadora.

## Verificación

- Dominio: `vistaCliente.test.ts`, con un caso por etapa (el camino, el título, el casillero y «lo
  próximo»), el casillero, la línea de tiempo y la tolerancia a una vista vieja. Cobertura del 100 %.
- Base: `25_vista_del_cliente.sql` (111), ensayada en rollback contra producción antes de aplicar:
  ninguna fila de las 64 tablas cambió, los 38 trabajos vivos devolvían exactamente lo mismo salvo
  las dos claves nuevas (el único en estimativo no tenía precio guardado), y los permisos del rol
  anónimo eran los mismos antes y después.
- Lector: `packages/db/src/vistaCliente.test.ts`. App: `VistaDelCliente.test.tsx` y
  `AyudaDeLaVista.test.tsx`. e2e: `lo-que-flota-abajo.spec.ts`.
