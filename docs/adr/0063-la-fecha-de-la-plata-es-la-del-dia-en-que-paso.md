# 0063. La fecha de la plata es la del día en que pasó, no la del día en que se cargó

- Estado: aceptada
- Fecha: 2026-09-23
- Revisa el [0016](0016-el-cobro-y-el-rechazo-que-encuentra-al-usuario.md) (el cobro) y el
  [0017](0017-los-datos-del-sistema-viejo.md) (la apertura): la fecha del cobro la elige el dueño y lo
  anterior a la apertura se marca en vez de mover los tesoros.

## Contexto

El dueño cargó un trabajo viejo, el «Placard Nomade con Baulera», y el cobro quedó con fecha de hoy.
En Finanzas, el 23 de septiembre aparecía «Saldo final en la entrega», +$1.724.000.

**Por dónde se fechaba, verificado antes de tocar nada.** Se reprodujo en `main` (fcf68d1) con un
trabajo con pagos del 10 de julio y del 20 de agosto: cobrado sin tocar nada, quedó `fecha_cobro` del
día. `PantallaDeLiquidacion` mandaba siempre `hoyLocal()` como fecha del cobro, y el pago final que
ofrece la misma pantalla nacía con hoy sin dejar cambiarlo. La base no fechaba nada con `now()`, pero
aceptaba cualquier fecha, también una futura. Los otros caminos con el mismo problema: la seña al pasar
a Proyectos (`PantallaDePasaje`), los pagos del formulario del trabajo, el pago del relevamiento, la
seña del contacto y el cierre de un perdido.

**Dos trampas del reloj.** Postgres en Supabase corre en UTC (la base de producción devuelve
`TimeZone = UTC`), y en el navegador `toISOString()` también: en Argentina, después de las 21, los dos
dicen mañana. Y una mutación que espera en la cola sin señal llega al servidor horas después: si la base
fechara con `now()`, el cobro quedaría con el día en que volvió la señal.

**La apertura.** Los saldos arrancaron con asientos de ajuste el 2026-09-14, la foto de la plata de ese
día. Un cobro anterior ya está adentro de esa foto: si además mueve los tesoros, cuenta dos veces.

## Decisión

- **La fecha viaja con la mutación y la base no inventa ninguna.** Donde se registra plata que entró hay
  una fecha editable, con hoy por defecto; hoy es el día del dispositivo en Argentina
  (`hoyEnElTaller`, zona `America/Argentina/Buenos_Aires`), no el de UTC. La base rechaza un pago o una
  liquidación sin fecha (`MN016`) y una fecha que todavía no llegó (`MN017`); para saber qué es
  «futuro» usa `private.hoy_en_el_taller()`, el mismo día de Argentina, y en ningún lado fecha con
  `now()` ni `current_date`.
- **La liquidación toma por defecto el día del último pago**, incluido el pago final que se carga en la
  misma pantalla, y se puede cambiar. El tope mensual de los fijos y las cifras del mes salen del mes
  de esa fecha, en el dominio y en SQL: un cobro de julio cargado hoy suma en julio.
- **Reabrir conserva la fecha como valor por defecto**, y volver a cobrar usa la que se elige. Antes la
  base imponía la fecha original.
- **Lo anterior a la apertura queda en el libro sin mover los tesoros.** Si la fecha es anterior a la
  apertura, la pantalla muestra una casilla, tildada por defecto: «Esta plata ya estaba en tus saldos
  cuando empezaste con la app». Se guarda en el pago (`pagos.ya_en_la_apertura`) o en el reparto
  (`proyectos.reparto_ya_en_la_apertura`), no se deduce de la fecha. La línea queda en el libro con su
  fecha y efecto cero sobre los tesoros. Marcar algo posterior a la apertura se rechaza (`MN018`).
  Las columnas nacen en `false` para todas las filas existentes, que es lo que deja los saldos como
  están.
- **Las fechas de negocio son días.** `pagos.fecha` y `proyectos.fecha_cobro` ya eran `date`;
  `dist_liquidado_at` es un instante, pero es metadata de cuándo se congeló, no una fecha de negocio.

## Lo que había en producción (leído, no corregido)

- **El Placard.** Trabajo de 2025 (inicio 2025-09-23, entrega estimada 2025-10-22). Un solo pago,
  «Saldo final en la entrega», $1.724.000, fechado 2026-09-23 y cargado ese día a las 00:57; cobrado,
  reabierto y vuelto a cobrar el mismo día, siempre con fecha 2026-09-23. Movió MAUN +$1.724.000 por el
  pago y −$1.724.000 por el reparto; Hogar +$1.551.600 (sueldo); Diezmo +$172.400; Cocos, nada. El
  reparto quedó contado en septiembre de 2026, un mes que ya llevaba $1.093.804,20 de sueldo. La fecha
  real no está en ningún lado de la base.
- **Cinco pagos fechados antes de la apertura y cargados después**: Cocina con Mesada de Madera
  (25/7, $120.000), Escritorio (13/8, $120.000), Cocina Nazarre (28/8, $140.500), Mobiliario Biblioteca
  (3/9, $120.000) y Cocina en L (7/9, $120.000). Suman $620.500 que movieron MAUN; si esa plata ya
  estaba en los saldos de arranque, está contada dos veces.

**Cómo se corrige, por la app.** El Placard: reabrir el cobro, corregir la fecha del pago en el
formulario del trabajo, volver a cobrar con la fecha real y, si es anterior al 14 de septiembre y la
plata ya estaba en los saldos, dejar la casilla tildada. Con la casilla en el pago y en el reparto, el trabajo
queda en el libro en su mes y los cuatro saldos vuelven a como estaban antes de cargarlo. Los cinco pagos: editar cada uno y tildar la
casilla si esa plata ya estaba en los saldos; MAUN baja $620.500. Nada de esto se hizo: toca filas con
plata y lo decide el dueño.

## Alternativas descartadas

- **Fechar en el servidor con `now()`.** Rompe con la cola sin señal y con el reloj en UTC.
- **Prohibir cargar antes de la apertura**, como las fechas de bloqueo de Xero. El dueño necesita cargar
  trabajos viejos; lo que hay que evitar es contar dos veces, no cargarlos.
- **Deducir de la fecha si la plata estaba en los saldos.** La app no puede saberlo: hay trabajos
  viejos que se cobraron después de la foto. Por eso es una casilla, con el valor por defecto que evita
  contar dos veces.

## Consecuencias

- Un bundle viejo que no manda la fecha rebota con `MN016`, con el mensaje en su idioma.
- El comparador suma casos de cobros en meses pasados, reabrir y volver a cobrar en otro mes, y cobros y
  perdidos anteriores a la apertura; `29_la_fecha_del_cobro.sql` prueba la base.

## Fuentes

- Supabase, configuración de la base: el huso horario por defecto es UTC. Verificado en producción:
  `show timezone` devuelve `UTC`.
- MDN, `Date.prototype.toISOString()`: siempre en UTC.
- Xero, fechas de bloqueo (lock dates), como antecedente de proteger el corte de la apertura.
