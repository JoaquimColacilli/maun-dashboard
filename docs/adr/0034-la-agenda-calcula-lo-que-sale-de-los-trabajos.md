# 0034. La agenda calcula lo que sale de los trabajos; lo propio es una anotación

- Estado: aceptada
- Fecha: 2026-09-14
- Completa al [0010](0010-sincronizacion-replica-completa.md) (una tabla nueva en la réplica) y al
  [0019](0019-seguimiento-el-contacto-es-la-misma-fila.md) (una fecha más del contacto). Se aparta del
  diseño en dónde vive la agenda y en el panel del día: ver Objeciones.

## Contexto

Las fechas del taller están desparramadas en los trabajos: la visita de un contacto, la entrega
estimada de una obra y, desde ahora, hasta cuándo hay que entregar un presupuesto. El dueño las busca
ficha por ficha. Además anota cosas que no son de ningún trabajo: comprar materiales, un día de taller.
El diseño nuevo (`Agenda.dc.html`, `DiaAgenda.dc.html`) las junta en un calendario.

## Decisión

**Lo que sale de un trabajo no se guarda: se calcula.** `eventosDeLaAgenda(datos, rango)`
(`packages/domain/src/agenda.ts`) recibe los proyectos, los clientes y las anotaciones de la réplica y un
rango de fechas, y devuelve los eventos ordenados.

| Evento      | Sale de                             | Cuándo aparece                                    |
| ----------- | ----------------------------------- | ------------------------------------------------- |
| Entrega     | `proyectos.entrega_estimada`        | la obra está `en_curso`                           |
| Visita      | `proyectos.fecha_visita`            | el trabajo está en seguimiento                    |
| Presupuesto | `proyectos.vencimiento_presupuesto` | en seguimiento y todavía no `presupuesto_enviado` |

Por qué no se guarda:

- **La fecha tiene una sola fuente.** Si la entrega se copiara a una tabla de eventos, editarla en el
  proyecto obligaría a mantener la copia, y con la cola de salida y dos dispositivos las dos se separan.
  Calculado, cambiar la fecha en el proyecto mueve el evento en el acto, también sin señal.
- **Un evento guardado se puede borrar; el trabajo no.** Borrar «Entregar la cocina» de la agenda no
  cambia que la cocina se entrega ese día.
- **La misma función elige qué avisar.** `eventosParaAvisar` llama a `eventosDeLaAgenda` con
  `[hoy, hoy + anticipación]`, y la función de borde importa ese mismo código (ADR 0036). La grilla, la
  lista del día y el aviso no pueden decir cosas distintas.

**Lo propio es una fila de `anotaciones`** (`20260914120000_agenda.sql`): fecha, hora opcional, texto,
categoría (`materiales` o `taller`), trabajo opcional con foreign key compuesta dentro del household,
hecha e importante. Tiene RLS y grants por columna, entra en `bootstrap()` y `delta()`, y va por la cola
con tres mutaciones: alta (que también restaura, para deshacer), edición y baja lógica.

**`proyectos.vencimiento_presupuesto`**, fecha opcional. Se propone al pasar un contacto a «a
presupuestar» si no tenía: tres días hábiles (`DIAS_HABILES_PARA_PRESUPUESTAR`) desde la visita, o desde
hoy si la visita todavía no pasó. Se edita en la hoja del contacto. `guardar_proyecto` la escribe solo si
la clave viene en el pedido: un bundle viejo servido por el service worker no la manda y no la borra.

**Pantallas.** En el celular, lista cronológica con la tira del mes arriba. En tablet y PC, la grilla, con
dos eventos por celda en tablet y tres en la PC, y «+N más». Un evento derivado no se edita ni se borra
desde la agenda: dice de dónde sale y ofrece «Abrir el proyecto» o «Abrir el contacto». Una anotación se
tilda, se marca como importante y se borra, cada cosa con «Deshacer» en el aviso. Esas mutaciones van
`silencioso`, para que el aviso siga siendo uno solo (ADR 0030).

**El panel del día está siempre, y el calendario nunca cambia de ancho.** En tablet y PC el panel no
aparece ni desaparece:

- Sin día elegido muestra hoy, con una línea que invita a elegir otro. Es el estado vacío de un panel
  expandido por defecto, y hoy es lo más útil que se puede poner ahí.
- Elegir un día lo cambia; volver a tocar el día elegido, «Hoy» o Escape vuelven a hoy. No tiene botón
  de cerrar, porque no hay nada que cerrar.
- La grilla se dimensiona sin contar el panel. Son dos columnas fijas de una consulta de contenedor
  (`@container/agenda`): la grilla y 340 px de panel desde 58rem, 380 desde 68rem. Elegir un día no toca
  esas columnas.
- **Por debajo de 58rem, el panel aprieta demasiado la grilla y pasa a ser una capa encima de ella.** Es
  `absolute` dentro de la misma celda de la grilla CSS, que hace de bloque contenedor, así que queda
  anclada al área del calendario sin empujarlo. Aparece al elegir un día y ahí sí se cierra.

**Colores y formas.** Los colores de tesoro quedan reservados. Las categorías usan tokens propios
(`ag-*`, con su par del oscuro) y además una forma, para no depender del color: entrega cuadrado lleno,
presupuesto punteado, visita rombo, materiales círculo, taller barra.

**Sin librería de fechas.** Las fechas son `AAAA-MM-DD` y las cuentas (`sumarDias`, `diasEntre`, el día
de la semana) se hacen en UTC en el dominio. No se usa `Temporal`.

## Alternativas descartadas

- **Una tabla de eventos con los derivados materializados por trigger.** La base mantendría la copia,
  pero la réplica y los avisos igual leerían dos lugares, y borrar un evento seguiría siendo posible.
- **Subir `VERSION_CACHE` para que las réplicas guardadas traigan la tabla nueva.** Se lleva la cola de
  salida persistida. En su lugar, `filasDe` tolera una tabla que falta y `necesitaReconcile` pide
  `bootstrap()` si falta alguna.
- **Un panel que se abre al elegir un día**, como estaba al principio y como en el diseño. Al aparecer
  encoge el calendario, y al cerrarse lo vuelve a estirar.
- **Un popover anclado al día.** Sobre una grilla de mes tapa los días de alrededor, que es justo el
  contexto que se quiere ver.
- **Un modal.** Tapa el calendario entero.

## Objeciones

- **Dónde vive la agenda.** «Dónde vive la agenda» (`MAUN Agenda.dc.html`) pone Agenda en lugar de
  Inicio en la barra del celular y muda los tesoros a Finanzas. Contradice el ADR 0024 (la barra
  inferior no se toca) y no hay diseño de Finanzas con los tesoros. El dueño eligió que Inicio se quede:
  la agenda está en la barra lateral y en el riel. En el celular, **el ícono de la agenda va al lado de
  la foto en el encabezado de Inicio**, con 44 px de área táctil, y el bloque «Hoy en la agenda» se
  queda: uno da velocidad y el otro contexto. «Anotar algo» es la primera acción del botón redondo y
  Avisos vive en Ajustes. Desde otra pantalla del celular la agenda sigue a dos toques. Mudar Inicio
  queda para otro PR, con su diseño.
- **El panel permanente le saca ancho a la grilla también cuando nadie eligió nada**: en la PC a 1440 la
  grilla mide 704 px en vez de los 1108 del contenedor. Es el precio de que no se mueva.
- **58rem y 68rem son cortes elegidos.** Con 340 px de panel, 58rem deja la grilla en unos 564 px como
  mínimo, alrededor de 80 px por día. Con la capa, mientras hay un día elegido, la mitad derecha de la
  grilla queda tapada.
- **La tira del mes scrollea de costado**, como en el diseño, y la regla del repo dice «nunca scroll
  horizontal» para los selectores. La tira no esconde opciones que haya que elegir: son los días del mes,
  con hoy a la vista. Es `role="group"` con botones `aria-pressed`, no `tablist`: no controla paneles.
- **No hay estado de error en la agenda.** Sale de la réplica, que ya está resuelta cuando la pantalla
  monta (ADR 0013): de los cuatro estados del diseño quedan tres.
- **La hora de una anotación es opcional.** Obligarla frenaba anotar «comprar tornillos».
- **Dentro de la hoja del día del celular, el deshacer es un aviso local.** La hoja es un `<dialog>`
  modal y deja inerte el aviso global, que no se podría tocar.
- **Nada se probó en un teléfono.**

## Verificación

- Dominio: `agenda.test.ts` y `fechas.test.ts`, dentro de la cobertura del 100% (172 tests).
- Base: `16_anotaciones.sql` (17), las anotaciones en `02_aislamiento.sql`, el vencimiento en
  `13_guardar_proyecto.sql` (sin la clave se conserva, vacía se borra) y las claves de `bootstrap()` y
  `delta()` en `04_sincronizacion.sql`.
- `agenda.spec.ts`, en celular y escritorio: anotar sin señal y reabrir, una entrega que no se borra y
  ofrece abrir el trabajo, tildar, marcar y borrar con deshacer, mes vacío, con datos y sin señal con
  capturas, y el recorrido con teclado. En la PC, además: los derivados en su día, mover la entrega desde
  el proyecto y ver que el evento se mueve, abrir el trabajo desde la grilla y un día con cinco cosas
  («+2 más»).
- **El ancho de la grilla, medido con `boundingBox`** en `agenda.spec.ts`:

  | Ventana             | Sin día elegido | Día elegido         | Día lleno (5) | Panel                         |
  | ------------------- | --------------- | ------------------- | ------------- | ----------------------------- |
  | 1440 px, escritorio | 704 px          | 704 px              | 704 px        | 380 px, al lado               |
  | 1024 px, tablet     | 861 px          | 861 px, con la capa | —             | 340 px, capa desde x = 633 px |

  El test falla si el ancho cambia en un solo píxel, si aparece «Cerrar el día» en la PC o si la capa
  se sale del área de la grilla.

- `destinos-en-celular.spec.ts`: el encabezado de Inicio es «Inicio», el enlace «Agenda» y el de
  Ajustes, en ese orden para el lector de pantalla. Los dos se alcanzan con Tab y abren su pantalla con
  Enter. El ícono mide 44 × 44 px, está a la izquierda de la foto y a su misma altura, es `aria-hidden` y
  no es una campana.
