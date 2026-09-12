# 0016. El cobro: la confirmación es el despiece, y un rechazo tiene que encontrar al usuario

Estado: aceptada, 2026-09-12. Es el cuarto paso de la fase 2D, y el primero que mueve plata de
verdad: produce asientos contables congelados que el dueño va a leer como el estado de su negocio.

## Contexto

La base ya tenía las cuatro operaciones (`cobrar_proyecto`, `cerrar_perdido`, `reabrir_proyecto`,
`reactivar_perdido`), los dos locks, la máquina de estados y los ocho códigos de rechazo. El despiece
y `liquidacionProyectada` quedaron armados en el ADR 0015. Lo que faltaba es la interfaz, y la parte
difícil no es dibujarla: es que una operación que mueve plata no puede tener los mismos modos de
falla que editar un cliente.

## La confirmación es el despiece, no un modal

El instinto es poner un «¿estás seguro?» antes de cobrar. No está.

La fricción se escalona según el tamaño del desastre: lo reversible va con deshacer, lo común con una
confirmación liviana, y el diálogo bloqueante se reserva para lo que no tiene vuelta atrás. Poner
confirmación en todo entrena a apretar aceptar en piloto automático, y entonces la única
confirmación que importaba se descarta sin leerla.

**Cobrar es reversible** (`reabrir_proyecto` existe) y esta app ya tiene algo mejor que una pregunta:
el despiece. La pantalla de cobro (`/proyectos/:id/cobrar`) muestra la tabla cortándose con los
importes reales antes de confirmar, y el botón dice el verbo: «Cobrar y repartir $700.000», nunca
«Aceptar». Debajo, en palabras, qué va a pasar con cada peso y que se puede deshacer. El texto carga
la seguridad, no el marco del diálogo.

- **Cerrar un perdido tiene su propio párrafo**, porque nadie espera que marcar un presupuesto como
  perdido le mueva los tesoros. La pantalla dice qué pasa con la seña retenida: que se reconoce como
  ingreso, que paga diezmo y no paga sueldo (los dos parámetros de `ajustes`), y que se deshace
  reactivándolo.
- **Reabrir sí lleva confirmación liviana**, porque deshace un reparto cerrado y mueve el acumulado
  del mes. Es un panel que se abre en la ficha, no un diálogo que tapa la pantalla, y dice qué se
  deshace en plata: «vuelven $70.000 del diezmo y $500.000 del hogar a la caja del taller».
- **Reabrir y reactivar explican su diferencia ahí mismo**, sin que haya que leer un ADR: reabrir
  conserva la fecha y los objetivos del cobro original, reactivar no guarda nada porque un lead que
  revive es un lead vivo.
- **La fecha del pago final y la fecha de la liquidación son dos cosas distintas.** La pantalla deja
  fechar el pago el día que el cliente transfirió, pero la liquidación es de hoy, que es la que
  decide en qué mes cae el reparto. Si no, fechar un pago la semana pasada movería el cobro de mes
  sin que nadie lo pida. En un cobro reabierto el dominio ignora las dos y usa la del cobro original.

## Un cobro encolado no está cobrado

Es el cambio arquitectónico del paso. Hasta ahora había un indicador global y un contador de cambios
pendientes, y para editar un cliente alcanza. Para plata no.

**Hay estado de sincronización por fila.** `useLiquidacionEnVuelo(proyectoId)` lee las mutaciones
pendientes y `MarcaDeLiquidacion` lo dibuja en la fila de la lista y en la ficha: un proyecto con el
cobro en la cola dice «Cobrado, sin confirmar», y su despiece lleva la marca de que el reparto
todavía no lo confirmó el servidor. Cuando el servidor contesta, recién ahí pasa a firme.

**Los saldos de Inicio son los optimistas, con la marca puesta.** La liquidación se aplica a la
réplica en `onMutate` con la fila entera congelada (`filaLiquidada`), así que los cuatro tesoros ya
la cuentan: es el número que el usuario espera ver después de cobrar. Debajo de las tarjetas,
`LiquidacionesSinConfirmar` dice cuántas hay sin confirmar y linkea a cada proyecto. El número
optimista sin la marca sería mentir; la marca sin el número optimista sería inútil.

**Y eso resuelve el requisito que el ADR 0011 le dejaba al 2C:** como la liquidación encolada está en
la réplica con su distribución, `liquidacionesDeLaReplica` la cuenta, y el acumulado del mes que la
app usa para el cobro siguiente ya la incluye. Dos cobros del mismo mes hechos sin señal no se pisan.

**La versión sube en la fila optimista.** Sin eso, reabrir un cobro que todavía está en la cola
mandaría la versión vieja y rebotaría con `MN006` cuando la cola drene.

**Y la respuesta de un guardado no pisa una liquidación optimista.** Al cobrar registrando el pago
final salen dos mutaciones: `guardar_proyecto` y después `cobrar_proyecto`. La primera vuelve con el
proyecto todavía en `entregado`, y sin una guarda borraba el cobro de la pantalla hasta que
contestara la segunda. `aplicarSiNoEsVieja` aplica la misma regla que el delta: gana la fila que
llega salvo que traiga una versión más vieja.

## Un rechazo tiene que encontrar al usuario

Los `MN00x` son rechazos de negocio y la cola no los reintenta, que está bien. Lo que faltaba es que
lleguen. Un cobro que rebota y nadie ve es peor que un cobro que falla en la cara del usuario.

**La bandeja de avisos** (`shared/lib/avisos`) es una entrada más del cache de queries, así que se
persiste en IndexedDB con todo lo demás. Guarda los rechazos de liquidación y las liquidaciones que
volvieron ajustadas, ya traducidos, con el proyecto y la ruta para llegar.

- **El proyecto vuelve visiblemente a su estado anterior**, con la marca en la fila y el motivo en la
  ficha, que es donde el usuario lo iría a buscar.
- **Si el usuario está en la app cuando llega el rechazo, se entera en el momento**, esté donde esté:
  `AvisoDeRechazo` está montado en el marco y muestra el más nuevo con el camino al proyecto. No
  aparece si ya estás parado en esa ficha.
- **Ajustes pasa a ser el registro completo**, no el único lugar.

### Cuánto dura un rechazo, y por qué

**Hasta que el usuario lo descarta.** No vence.

Lo que había duraba 24 horas —el `gcTime` de la mutación— y, peor, **no sobrevivía a cerrar la app**:
`esPersistible` solo deja pasar lo `pending`, así que una mutación en `error` no se persiste nunca.
Un cobro rechazado a la noche no existía a la mañana siguiente.

Un reloj que borra el aviso es exactamente el modo de falla que este paso viene a cerrar: el rastro
de una operación que el usuario da por hecha, y que movió plata, no se puede evaporar solo. El costo
es que la lista puede juntar avisos viejos, y es barato: se descartan de a uno con un botón, y el
`maxAge` del persister (siete días, que se renueva con cada escritura) es el único techo.

Los avisos de ajuste no se borran solos ni cuando el proyecto se vuelve a liquidar: siguen
explicando por qué el reparto congelado es el que es. Los de rechazo sí, porque dejaron de ser
ciertos.

## Los códigos de rechazo se traducen a castellano de taller

`MN001` a `MN008` son para nosotros. `traducirRechazo(error, contexto)` (`shared/api/rechazos.ts`)
devuelve **qué pasó** y **qué hacer ahora**, en un castellano sin «versión», «distribución congelada»
ni «conflicto». El contexto es la operación (cobro, cierre, reapertura, reactivación, guardado) y el
proyecto, porque el mismo código quiere decir cosas distintas según qué estabas haciendo: `MN001` al
cobrar es «ya estaba cobrado», y `MN001` al guardar un gasto es «está cerrado, este es el camino de
salida».

El código queda a la vista pero aparte, en chico, para poder pedir ayuda con un rechazo raro. El
`detail` del `raise` no se muestra: `rechazoDeLaBase` no lo lee, y son números para depurar.

## El acumulado del mes viaja, y la base ajusta en vez de rechazar

Es la propuesta que el ADR 0011 dejó escrita, y hay que implementarla ahora porque el tope de fijos
ya es mensual: el rebote es posible hoy, sin prender el sueldo mensual.

**Necesitó una migración** (`20260912180000_acumulado_del_mes_visto.sql`), que es lo único que el
brief de este paso daba por hecho y no estaba. `cobrar_proyecto` y `cerrar_perdido` toman dos
parámetros más, `p_sueldo_previo_centavos` y `p_fijos_previo_centavos`, con default `null`.

- **Si no viene el acumulado (`null`), todo sigue estricto como antes.** Es lo que hace que la
  migración sea retrocompatible: un bundle viejo servido por el service worker sigue andando, y las
  308 pruebas que ya existían pasaron sin tocarles una línea.
- **Si viene y coincide con el de la base, todo sigue estricto como antes.**
- **Si viene y difiere**, la base verifica que la cuenta de la app sea correcta **con lo que la app
  vio** —los topes contra su propio acumulado, y la cascada contra sus propios topes— y recién
  entonces recalcula con el acumulado suyo y congela eso.

Así **no se pierde el `MN008`**, que es lo que detecta una app desactualizada aplicando otra regla:
se sigue exigiendo que la app haya calculado bien, solo que contra las entradas que ella tenía. Lo
único que se acepta es una diferencia que la app no podía prever.

**La respuesta no cambió de forma.** La fila congelada ya traía `dist_sueldo_previo_centavos` y
`dist_fijos_previo_centavos`: comparándolos contra lo que se mandó, la app sabe que la liquidación
salió ajustada, y con los escalones tiene la diferencia en plata. `ajusteDeLaLiquidacion` hace esa
cuenta y el aviso la cuenta en palabras: «Costos fijos: esperabas $250.000 y quedó en $120.000,
porque el mes ya llevaba $130.000 de otra liquidación».

**El reenvío de una liquidación ajustada necesitó su propia rama.** Los topes y los cuatro escalones
congelados no son los que mandó la app —ese es justamente el ajuste—, así que la guarda de reenvío
estricta no lo reconocía y el reintento habría rebotado con `MN001`. La rama nueva lo reconoce por
las entradas que la app sí controla, y solo cuando el acumulado congelado difiere del que se mandó,
que es la definición de ajustada.

## El despiece animado

Es el único momento orquestado de la app, como pedía el brief de diseño: el tablero cortándose en
las piezas de cada tesoro al volver de confirmar el cobro.

- **CSS puro**, sin librería ni JavaScript: `clip-path` y `opacity`, que no piden layout, con un
  retraso por pieza (`--dur-corte`, `--dur-corte-stagger`, ya en los tokens).
- **No bloquea nada.** La pantalla se usa mientras corre.
- **`prefers-reduced-motion` ya estaba resuelto en `theme.css`**: las dos duraciones pasan a `0ms` y
  hay un barrido global de `animation-duration`. La animación aparece entera, sin caso especial.
- **Se anima una sola vez**, por el `state` de la navegación: volver a entrar a la ficha muestra el
  tablero quieto.

## El camino del gasto tardío

Requisito del ADR 0011: cuando el gasto se carga contra un perdido ya cerrado, la app no puede
quedarse en el «no».

**El rechazo por el que se empezó a construir esto no se puede provocar desde el formulario.** El
e2e lo encontró: `PantallaDeProyecto` ya bloqueaba los pagos y los gastos de un proyecto liquidado,
con un aviso que decía «para corregirlos hay que reabrirlo» y **ningún botón**. Eso era exactamente
el callejón sin salida que el ADR 0011 quiere evitar, solo que un paso antes de donde lo
buscábamos: el usuario nunca llega al `MN001`, llega a un campo deshabilitado.

Así que el camino de salida cuelga del aviso, no del rechazo. El botón dice «Reactivarlo para poder
cargarlo» (o «Reabrir el cobro para corregirlo»), y **los campos se desbloquean ahí mismo**, porque
la reversión se aplica optimista a la réplica y el formulario se entera solo. Al guardar, la app
lleva derecho a `/cerrar` (o a `/cobrar`) en vez de a la ficha: así el usuario **ve el reparto nuevo
antes de confirmarlo**, que es el principio de todo este paso, en vez de que se lo rehagan por
detrás.

Tres cosas hay que mover con la reversión, o el guardado siguiente rebota:

- **la versión que se va a mandar**, porque la reversión la subió y el formulario guarda la que tenía
  al abrir (que es a propósito: es lo que detecta que alguien lo cambió desde otro lado);
- **el estado del formulario**, que seguía diciendo `perdido` y habría salido como `MN007`;
- **a dónde ir al guardar**.

El `MN001` sigue teniendo su traducción con el camino en palabras, para cuando llega de verdad: el
proyecto se liquidó desde otro dispositivo mientras el formulario estaba abierto.

Se descartó **encadenar reactivar, guardar y cerrar en un solo botón**. Se llegó a escribir, mirando
la réplica en cada paso para que funcionara sin señal. Dos motivos para no dejarlo: el usuario
todavía no escribió el gasto cuando aprieta el botón (los campos están bloqueados), así que el
encadenado no le ahorra el paso que importa; y cerrar por detrás sin mostrar el reparto nuevo
contradice la decisión de arriba.

## Objeciones

- **La comparación de una liquidación ajustada es más floja que la del resto.** El comparador verifica
  que lo que la base congela con un acumulado viejo sea lo que calcula `calcularLiquidacion` con el
  mes completo, y eso es fuerte. Lo que **no** tiene gemela en TypeScript es la decisión de ajustar:
  «cuándo la base recalcula en vez de rechazar» vive solo en SQL. Un cambio ahí no lo frena el
  comparador; lo frenan `14_acumulado_visto.sql` y el e2e, que son pruebas de casos, no de
  equivalencia.

- **`MN008` sobre los topes es un código prestado.** Cuando la app manda un acumulado y los topes no
  salen de él, la respuesta es `MN008` («actualizá la app») y no `MN006`, porque es la app aplicando
  otra regla. Es la lectura correcta del código, pero el mensaje de `MN008` habla de la distribución
  y ahora también cubre los topes. Se separaría con un código nuevo el día que haya otro consumidor.

- **La animación no se perfiló.** `clip-path` es una propiedad que los navegadores modernos animan en
  el compositor cuando no hay cambios de layout alrededor, y acá no los hay. Pero es un razonamiento,
  no una medición: no se corrió un trace.

- **El aviso global muestra uno solo.** Si rebotan dos liquidaciones seguidas, el usuario ve la más
  nueva y la otra lo espera en la ficha y en Ajustes. Con un usuario y un cobro por vez alcanza; con
  más habría que apilarlos.

- **La bandeja de avisos no distingue dispositivos.** Se persiste local, así que un rechazo visto en
  la PC no aparece en el celular. Es coherente con que la cola también sea local —el rechazo es de la
  mutación que salió de _este_ dispositivo— pero conviene decirlo.

## Alternativas descartadas

- **Un modal de «¿estás seguro?» antes de cobrar.** Ver arriba: entrena a descartar sin leer, y el
  despiece es una confirmación mejor porque se lee.
- **Mostrar los saldos sin las liquidaciones encoladas.** Sería el número «seguro», y es el que el
  usuario no espera: acaba de cobrar y el tesoro no se movió.
- **Guardar el rechazo en la mutación y subirle el `gcTime`.** No alcanza: una mutación en `error` no
  se persiste, así que cerrar la app se lo lleva igual.
- **Que la base devuelva una marca de «ajustada».** Habría que cambiarle el tipo de retorno a las dos
  funciones. La fila congelada ya alcanza para saberlo.
- **Liquidar siempre en línea.** Ata la operación más importante del taller a la red, y el cobro pasa
  en lo del cliente, donde no hay señal.
- **Que la app mande la cascada sin el tope aplicado y la base calcule todo.** Pierde el `MN008`.
- **Encadenar el gasto tardío esperando las respuestas del servidor.** Sin señal no resuelve nunca.

## Consecuencias

- `vaciarTaller` del e2e **descongela antes de borrar**: reabre los cobrados y reactiva los perdidos.
  Sin eso, desde este paso la suite empieza a fallar el borrado de clientes con `MN003`.
- Toda liquidación nueva tiene que aplicarse optimista a la réplica con la fila entera congelada, o
  el acumulado del mes deja de contarla y vuelve el rebote que este cambio resuelve.
- La firma de las dos funciones de liquidación cambió. Un llamador que no mande el acumulado sigue
  andando, pero no se beneficia del ajuste.
- Los mensajes de los `MN00x` viven ahora en `shared/api/rechazos.ts` y no en el `raise` de SQL. El
  texto de la base queda como respaldo para lo que no esté traducido.
