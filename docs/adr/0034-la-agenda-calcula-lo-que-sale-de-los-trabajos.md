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

**Pantallas.** En el celular, lista cronológica con la tira del mes arriba, y el día en una hoja. En
tablet y PC, la grilla, con dos eventos por celda en tablet y tres en la PC, y «+N más». Un evento
derivado no se edita ni se borra desde la agenda: dice de dónde sale y ofrece «Abrir el proyecto» o
«Abrir el contacto». Una anotación se tilda, se marca como importante y se borra, cada cosa con
«Deshacer» en el aviso. Esas mutaciones van `silencioso`, para que el aviso siga siendo uno solo (ADR
0030).

**En tablet y PC, la grilla del mes ocupa todo el ancho del área de contenido, siempre, y el panel del
día va encima.**

- El panel no le saca ancho a la grilla ni abierto ni cerrado: es una capa `absolute` anclada a la
  derecha del área de la grilla, que la envuelve en un contenedor `relative`. Mide 340 px, y 380 desde
  1280 px de ventana.
- Arranca cerrado. Se abre al tocar un día, «+N más» o una anotación de la celda.
- Tiene «Cerrar el día» en todos los anchos, y Escape lo cierra.
- Al abrirse, el foco va al panel; al cerrarse, vuelve al botón del día.
- No es modal: el resto del mes sigue a la vista, y tocar otro día cambia el panel sin cerrarlo.

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
- **El panel del día al costado de la grilla.** Se probó de dos formas y las dos le roban ancho: abierto
  al elegir un día, como en el diseño, encoge el calendario al aparecer; fijo mostrando hoy, a 1440 px la
  grilla medía 704 px de los 1108 disponibles.
- **Un diálogo modal centrado.** Era lo más simple y el componente existe, pero deja inerte y tapa el
  calendario entero: para mirar otro día hay que cerrarlo. La capa deja a la vista y tocable la mayor
  parte del mes, y es el mismo mecanismo que ya andaba para el contenedor angosto, extendido a todos los
  anchos en vez de tener dos comportamientos.
- **Un popover anclado al día.** Sobre una grilla de mes tapa los días de alrededor, que es justo el
  contexto que se quiere ver.

## Objeciones

- **Dónde vive la agenda.** «Dónde vive la agenda» (`MAUN Agenda.dc.html`) pone Agenda en lugar de
  Inicio en la barra del celular y muda los tesoros a Finanzas. Contradice el ADR 0024 (la barra
  inferior no se toca) y no hay diseño de Finanzas con los tesoros. El dueño eligió que Inicio se quede:
  la agenda está en la barra lateral y en el riel. En el celular, **el ícono de la agenda va al lado de
  la foto en el encabezado de Inicio**, con 44 px de área táctil, y el bloque «Hoy en la agenda» se
  queda: uno da velocidad y el otro contexto. «Anotar algo» es la primera acción del botón redondo y
  Avisos vive en Ajustes. Desde otra pantalla del celular la agenda sigue a dos toques. Mudar Inicio
  queda para otro PR, con su diseño.
- **Mientras el panel está abierto tapa las columnas de la derecha de la grilla**: en las capturas de
  1440 y de 1024 px, parte del viernes, el sábado y el domingo. Para tocar un día que quedó debajo, se
  cierra.
- **El panel no atrapa el foco.** Con Tab se sale a la grilla, a propósito, para poder elegir otro día.
  Escape lo cierra mientras el foco esté en la grilla o en el panel, no desde el encabezado.
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
- **El ancho de la grilla, medido con `boundingBox`** contra el ancho del encabezado de la pantalla, que
  es el área de contenido:

  | Ventana | Área de contenido | Grilla, panel cerrado | Grilla, panel abierto | Panel                    |
  | ------- | ----------------- | --------------------- | --------------------- | ------------------------ |
  | 1440 px | 1108 px           | 1108 px               | 1108 px               | 380 px, desde x = 1002,5 |
  | 1024 px | 861 px            | 861 px                | 861 px                | 340 px, desde x = 633    |

  El test falla si la grilla no mide el área de contenido o si cambia en un solo píxel al abrir el panel.
  En los dos anchos recorre el foco: al abrir va al panel; «Cerrar el día» y Escape lo devuelven al botón
  del día, también cuando se abrió desde «+N más».

- Las tres capturas del celular (lista, sin señal y mes vacío) salieron idénticas byte a byte, por
  SHA-256, antes y después de cambiar el panel. Esa comparación se hizo a mano, fuera del test.
- `destinos-en-celular.spec.ts`: el encabezado de Inicio es «Inicio», el enlace «Agenda» y el de
  Ajustes, en ese orden para el lector de pantalla. Los dos se alcanzan con Tab y abren su pantalla con
  Enter. El ícono mide 44 × 44 px, está a la izquierda de la foto y a su misma altura, es `aria-hidden` y
  no es una campana.
