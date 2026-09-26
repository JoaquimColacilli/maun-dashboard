# 0034. La agenda calcula lo que sale de los trabajos; lo propio es una anotación

- Estado: aceptada
- Fecha: 2026-09-14
- Completa al [0010](0010-sincronizacion-replica-completa.md) (una tabla nueva en la réplica) y al
  [0019](0019-seguimiento-el-contacto-es-la-misma-fila.md) (una fecha más del contacto). Se aparta del
  diseño en dónde vive la agenda y en cómo se abre el día: ver Objeciones.
- Completada el 2026-09-25 por el [ADR 0071](0071-la-entrega-y-sus-fechas.md): la entrega de un
  trabajo cae en la comprometida si la hay, con su franja, y si no en la estimada.
- Enmendada el 2026-09-25 por el [ADR 0074](0074-lo-que-responde-al-tocar.md): al tildar una
  anotación, la tilde se dibuja y una línea corre sobre el texto hasta quedar tachado como siempre;
  solo en el renglón recién tildado, aunque React lo mueva al final. Destildar vuelve en el acto.

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
**Actualizado por el [0038](0038-el-embudo-del-seguimiento.md):** son cinco días hábiles, se corre al
corregir el día del relevamiento si no se la puso a mano, y no sale en la agenda con un estimativo enviado.

**Pantallas.** En el celular, lista cronológica con la tira del mes arriba, y el día en una hoja. Cada
día con cosas tiene «Anotar» en su encabezado, que abre la hoja de anotar con ese día. El día vacío lo
tiene en el cuerpo. Antes, para anotar en un día con cosas había que abrir su hoja con el ícono de
ampliar, y el dueño lo encontró molesto. En
tablet y PC, la grilla, con dos eventos por celda en tablet y tres en la PC, y «+N más». Un evento
derivado no se edita ni se borra desde la agenda: dice de dónde sale y ofrece «Abrir el proyecto» o
«Abrir el contacto». Una anotación se tilda, se marca como importante y se borra, cada cosa con
«Deshacer» en el aviso. Esas mutaciones van `silencioso`, para que el aviso siga siendo uno solo (ADR
0030).

**Los caminos a lo que sale de los trabajos.** «Anotar algo» sigue ofreciendo solo Materiales y Taller:
las visitas y las entregas no se anotan a mano. Pero para agendar una visita había que saber que se
carga desde el contacto, y eso no se ve desde la agenda. Por eso `CaminosALosTrabajos`
(`entities/agenda`) aparece abajo de las dos opciones de la hoja de anotar y en el día libre de la capa
y de la hoja del día. Explica en una línea que las visitas y las entregas salen del contacto y del
proyecto, y ofrece dos enlaces:

- **«Cargar un contacto de seguimiento»** abre la hoja de contacto encima de la agenda
  (`/seguimiento/nuevo?visita=`), con la fecha de la visita puesta.
- **«Cargar un proyecto»** abre la pantalla de proyecto nuevo (`/proyectos/nuevo?entrega=`) con la
  entrega estimada puesta. Llega sin el cálculo automático a 21 días hábiles del inicio, que la pisaría.
- **El día viaja en la URL**, como el tesoro de Finanzas: `rutaDeContactoNuevo`, `rutaDeProyectoNuevo` y
  `fechaDelEnlace` (`shared/lib/rutas.ts`), que descarta lo que no sea una fecha que existe. En la hoja
  de anotar vale la fecha elegida en ese momento; en el día libre, ese día.
- **Antes de navegar se cierra lo que estaba abierto**: la hoja de anotar, la capa o la hoja del día. Si
  la hoja de anotar es la de la ruta `/agenda/anotar` (la del botón redondo del celular), el enlace
  reemplaza esa entrada del historial en vez de cerrarla, para no navegar dos veces.
- **El enlace al proyecto no lleva fondo.** El proyecto nuevo es una pantalla y no una hoja: con fondo,
  `Marco` dibujaría la agenda en su lugar.

**Lo hecho se queda en el día, abajo de lo pendiente.** Tildar una anotación no la saca: si
desapareciera, no se sabría si se hizo o si se borró sola. Aplica en la capa de la PC, en la hoja y en
la lista del celular, y en la celda de la grilla.

- **Orden.** `conLoHechoAlFinal` la pone después de lo pendiente, y cada grupo conserva su orden.
  Desmarcarla la devuelve arriba.
- **Aspecto.** Va tachada, gris y más baja que una pendiente: una línea, sin el renglón de la categoría.
  En la capa y en la hoja, lo hecho va en su propia lista, «Hecho».
- **Cuentas.** El encabezado del día cuenta lo pendiente y dice aparte lo hecho («2 cosas anotadas · 1
  hecha»). Lo mismo el resumen del mes y el nombre del botón del día en la grilla («2 cosas y 1 hecha»).
- **Un día con todo hecho** no dice que está libre: dice que no queda nada pendiente.
- **No depende del gris.** El texto está tachado, la casilla está marcada, y la fila y el chip de la
  celda dicen «hecha» para el lector de pantalla.
- **El foco.** Al tildar, la fila cambia de lista y React la vuelve a montar: `useAccionesConFoco`
  devuelve el foco a su casilla.
- **«Hoy en la agenda», en Inicio, sigue mostrando solo lo pendiente.** Responde qué queda por hacer
  hoy, no qué se hizo; lo decidió el dueño.

**Actualizado por el [0042](0042-lo-hecho-de-los-trabajos-y-las-marcas.md):** lo hecho ya no es solo de
las anotaciones. La entrega entregada o cobrada y la visita con `visita_hecha` se quedan en su día igual
que una anotación tildada, y la visita, la entrega y el vencimiento se marcan como importantes con el
mismo círculo.

**En tablet y PC, la grilla del mes ocupa todo el ancho del área de contenido, siempre, y el día se abre
en una capa chica anclada a su celda**, con una punta que apunta al día, como en Google Calendar. Se ve
la relación entre lo que se tocó y lo que se abre, y tapa mucho menos que una franja fija.

- **Es un `popover="auto"` nativo.** Va a la capa superior sin pelear con el z-index, se cierra con
  Escape y tocando fuera, y tiene «Cerrar el día». No es modal y no atrapa el foco.
- **Se ubica con posicionamiento anclado de CSS, sin JavaScript de medición** (`app/styles/index.css`).
  La celda del día abierto es el ancla (`--dia-abierto`, por la marca `data-abierto`) y la grilla pone
  los bordes (`--grilla-del-mes`).
- **Por defecto abre a la derecha del día, alineada arriba.** Si no entra dentro de la grilla y de la
  ventana, `position-try-fallbacks` la da vuelta hacia arriba, hacia la izquierda o las dos cosas. Si no
  entra de ningún lado, se centra en el alto de la grilla, y como último recurso en el de la ventana.
- **Mide dos columnas y un poco** (`max(20rem, dos séptimos de la grilla + 1rem)`). El viernes, el sábado
  y el domingo tienen dos, una y ninguna columna a la derecha: nunca entra, así que abren siempre hacia
  la izquierda. De lunes a jueves siempre entra a la derecha. No es un caso raro: son tres de las siete
  columnas. En la última fila no hay lugar abajo y abre hacia arriba.
- **El alto es el del contenido**, con tope en el alto de la ventana; si no alcanza, la lista scrollea
  adentro.
- **La punta son dos triángulos anclados a la vez a la celda y a la capa.** Cada uno ocupa el hueco entre
  las dos, y el del lado que no corresponde queda con ancho cero. Así no hace falta saber de qué lado se
  abrió.
- **Tocar otro día la mueve a ese día sin cerrarla**, y vuelve a elegir el lado. Los botones de la grilla
  que abren el día son invocadores del popover con `popovertargetaction="show"`: tocarlos no cuenta como
  tocar fuera, y «mostrar» no hace nada si ya está abierta.
- **El foco.** Al abrir va a la capa. Escape y «Cerrar el día» lo devuelven al botón del día. Tocar fuera
  lo deja donde se tocó.
- **Scrollear la agenda con la capa abierta la cierra.**
- **Lo que se hace adentro avisa en la misma capa**, con su «Deshacer», como en la hoja del celular: la
  capa superior tapa los avisos globales, y tocar uno la cerraría.
- **«Anotar algo» la cierra antes de abrir la hoja.**

**Qué se encontró del soporte** (datos de MDN, `browser-compat-data`, setiembre de 2026):

- `anchor-name`, `position-anchor` y `anchor()`: Chrome y Edge 125, Firefox 147 (enero de 2026) y Safari
  26 (setiembre de 2025). `position-try-fallbacks` con `flip-block` y `flip-inline`: Chrome 128, Firefox
  147 y Safari 26. MDN lo marca como Baseline 2026, recién disponible.
- `@container anchored(fallback: …)`, la forma prevista de saber de qué lado quedó la capa para dar
  vuelta la punta: solo Chrome 143 o posterior. Firefox y Safari no lo tienen.
- Un prototipo con el mismo molde se midió en los tres motores de Playwright: Chromium 153, Firefox 155 y
  WebKit 26.6. Los siete casos (lunes, miércoles, viernes, sábado, domingo, primera y última fila), a
  1440 y a 1024 px, dieron el mismo lado, la misma dirección y la punta del mismo lado en los tres.
  Tocar otro día, tocar fuera y Escape se comportaron igual.
- Diferencias medidas:
  - **Con la capa abierta, al scrollear**, Chromium, Firefox y WebKit la trasladan junto con el día sin
    volver a elegir el lado, y se sale de la ventana.
  - **Firefox, al abrir con la agenda scrolleada,** dejaba la punta corrida si no tenía su propio
    `position-anchor`, y ubicaba mal la capa si sus límites del lado del ancla dependían de la ventana.
    La versión elegida evita las dos cosas.
  - **Escape** devuelve el foco al botón tocado en Chromium y Firefox, y al `body` en WebKit, que no
    enfoca los botones al tocarlos. Por eso la app devuelve el foco sola.
  - **`showModal`** cierra un popover abierto en los tres motores, pero WebKit no dispara `toggle`.

## Alternativas descartadas

- **Una tabla de eventos con los derivados materializados por trigger.** La base mantendría la copia,
  pero la réplica y los avisos igual leerían dos lugares, y borrar un evento seguiría siendo posible.
- **Subir `VERSION_CACHE` para que las réplicas guardadas traigan la tabla nueva.** Se lleva la cola de
  salida persistida. En su lugar, `filasDe` tolera una tabla que falta y `necesitaReconcile` pide
  `bootstrap()` si falta alguna.
- **El panel del día al costado de la grilla.** Se probó de dos formas y las dos le roban ancho: abierto
  al elegir un día, como en el diseño, encoge el calendario al aparecer; fijo mostrando hoy, a 1440 px la
  grilla medía 704 px de los 1108 disponibles.
- **Una capa fija sobre la derecha del área de la grilla**, que fue la versión anterior de este mismo PR.
  Mantenía la grilla entera, pero aparecía siempre en el mismo lugar: una franja de 340 o 380 px de punta
  a punta que tapaba el fin de semana y no tenía relación con el día tocado.
- **Un diálogo modal centrado.** Deja inerte y tapa el calendario entero: para mirar otro día hay que
  cerrarlo.
- **Medir con JavaScript** (`getBoundingClientRect` y recalcular en cada cambio de tamaño y de scroll).
  Anda en cualquier navegador con popover, pero el anclaje de CSS ya tiene soporte en los tres motores y
  resuelve solo el volteo. Quedaba como plan B si el anclaje no alcanzaba.
- **Dar vuelta la punta con `@container anchored()`.** Es lo previsto, pero solo existe en Chrome: en
  Firefox y Safari la punta quedaría del lado equivocado.
- **Dejar que la capa siga al día mientras se scrollea.** Con esta hoja de estilos, los tres motores la
  trasladan sin volver a elegir el lado, y queda cortada. WebKit la recalculaba solo si los límites del
  lado del ancla dependían de la ventana, y eso mismo ubicaba mal la capa en Firefox. Cerrarla es lo
  único que garantiza en los tres que no se salga de la ventana.

## Objeciones

- **Dónde vive la agenda.** «Dónde vive la agenda» (`MAUN Agenda.dc.html`) pone Agenda en lugar de
  Inicio en la barra del celular y muda los tesoros a Finanzas. Contradice el ADR 0024 (la barra
  inferior no se toca) y no hay diseño de Finanzas con los tesoros. El dueño eligió que Inicio se quede:
  la agenda está en la barra lateral y en el riel. En el celular, **el ícono de la agenda va al lado de
  la foto en el encabezado de Inicio**, con 44 px de área táctil, y el bloque «Hoy en la agenda» se
  queda: uno da velocidad y el otro contexto. «Anotar algo» es la primera acción del botón redondo y
  Avisos vive en Ajustes. Desde otra pantalla del celular la agenda sigue a dos toques. Mudar Inicio
  queda para otro PR, con su diseño.
- **La capa tapa días vecinos**: abierta en un lunes tapa parte del martes y del miércoles. Para tocar
  un día que quedó debajo, primero se cierra, con Escape o tocando fuera.
- **Pide navegadores recientes**: Chrome o Edge 125, Firefox 147, Safari 26. En uno anterior, `@supports`
  la deja centrada en la ventana y sin punta: se usa igual, pero pierde la relación con el día.
- **Scrollear la cierra**, también cuando el scroll lo provoca el teclado al llevar el foco a un día que
  no se veía. El día sigue enfocado y Enter la vuelve a abrir.
- **Anotar desde la capa la cierra.** La hoja es modal y `showModal` cierra los popover en los tres
  motores; como WebKit no avisa con `toggle`, la app la cierra antes de abrir la hoja. Lo anotado
  aparece en la celda y en el aviso global.
- **La capa no atrapa el foco.** Con Tab se sale a la grilla, a propósito, para poder elegir otro día.
  Escape la cierra desde cualquier lado de la pantalla, porque lo maneja el navegador.
- **Los caminos no vuelven a la agenda.** Guardar el contacto o el proyecto lleva a su ficha, como en el
  resto de la app, y cancelar el proyecto lleva a Proyectos. Cancelar el contacto sí vuelve a la agenda,
  porque es una hoja encima de ella.
- **La fila del día vacío en la lista del celular no muestra los caminos.** Tiene «Anotar», que abre la
  hoja con los caminos; sumarlos a cada fila vacía cargaba la lista.
- **La tira del mes scrollea de costado**, como en el diseño, y la regla del repo dice «nunca scroll
  horizontal» para los selectores. La tira no esconde opciones que haya que elegir: son los días del mes,
  con hoy a la vista. Es `role="group"` con botones `aria-pressed`, no `tablist`: no controla paneles.
- **No hay estado de error en la agenda.** Sale de la réplica, que ya está resuelta cuando la pantalla
  monta (ADR 0013): de los cuatro estados del diseño quedan tres.
- **La hora de una anotación es opcional.** Obligarla frenaba anotar «comprar tornillos».
- **Dentro de la hoja del día del celular y de la capa de la PC, el deshacer es un aviso local.** La hoja
  es un `<dialog>` modal que deja inerte el aviso global, y la capa lo tapa.
- **Nada se probó en un teléfono, ni en un Firefox o un Safari de verdad.** Los tres motores se midieron
  con las versiones de Playwright: primero el prototipo, y después los tests de la capa y del teclado de
  `agenda.spec.ts` contra la app, con una config de Playwright que no quedó en el repo. El e2e del repo
  corre solo en Chromium.

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
- **La capa del día**, medida con `boundingBox` en `agenda.spec.ts` (Chromium de Playwright), en los
  siete casos y en dos ventanas. El test falla en cualquiera de estos casos:
  - la capa se sale de la ventana o tapa la celda;
  - abre del lado equivocado para su columna;
  - la punta no toca la celda o no queda adentro de la capa y de la celda;
  - la primera fila no abre hacia abajo o la última no abre hacia arriba;
  - la grilla cambia de ancho.

  Días de setiembre de 2026:

  | Caso                                        | 1440 × 900, grilla 1108 px                                                     | 1024 × 768, grilla 861 px                                                    |
  | ------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
  | Lunes 14                                    | derecha, abajo; 332,6 × 292,5 en x = 444,6                                     | derecha, abajo; 320 × 292,5 en x = 246,8                                     |
  | Miércoles 9                                 | derecha, abajo; 332,6 × 250,8 en x = 760,9                                     | derecha, abajo; 320 × 250,8 en x = 492,6                                     |
  | Viernes 11                                  | izquierda, abajo; en x = 563,5                                                 | izquierda, abajo; en x = 272,4                                               |
  | Sábado 12                                   | izquierda, abajo; en x = 721,6                                                 | izquierda, abajo; en x = 395,3                                               |
  | Domingo 13                                  | izquierda, abajo; en x = 879,8                                                 | izquierda, abajo; en x = 518,1                                               |
  | Primera fila, martes 1                      | derecha, abajo; en x = 602,8                                                   | derecha, abajo; en x = 369,7                                                 |
  | Última fila, miércoles 30, con cuatro cosas | derecha, arriba; 332,6 × 431,5, de y = 285 a 716,5 (la celda termina en 716,5) | derecha, arriba; 320 × 431,5, de y = 257 a 688,5 (la celda termina en 688,5) |

  La grilla midió lo mismo que el área de contenido con la capa cerrada y abierta en los catorce casos:
  1108 y 861 px. En cada uno la capa se cierra con Escape y el foco vuelve al botón del día.

- **Tocar otro día.** Del lunes 14 al domingo 20 sin cerrar, la capa pasó de la derecha (x = 444,6) a la
  izquierda (x = 879,8) sin ningún `toggle` de cierre. «Cerrar el día» devuelve el foco al domingo, y
  tocar el título de la pantalla la cierra.
- **Scroll.** Scrollear el `<main>` 120 px con la capa abierta, a 1024 × 560, la cierra.
- **Teclado.** Enter en el día abre la capa y la enfoca. Tab llega a la casilla y a «Cerrar el día».
  Escape y Enter en «Cerrar el día» devuelven el foco al día.
- **Celular.** Las tres capturas (lista, sin señal y mes vacío) salieron idénticas byte a byte, por
  SHA-256, antes y después del cambio. La comparación se hizo a mano, fuera del test.
- **Firefox y WebKit.** Los mismos tests de la capa (los siete casos a 1440 y a 1024 px, tocar otro día
  y el scroll) y el recorrido con teclado pasaron también en Firefox 155 y WebKit 26.6 de Playwright,
  contra el build de la app, con los mismos lados y las mismas posiciones. A 1024 px el área de
  contenido mide 876 px en esos dos motores y 861 en Chromium, por el ancho de la barra de scroll. En los
  tres, la grilla midió el área completa.
- **Lo hecho.** `agenda.spec.ts`, en celular y escritorio, con dos pendientes y una hecha en el mismo
  día:
  - En la lista del celular y en la celda de la grilla, lo hecho va último y dice «, hecha». El botón del
    día se llama «lun 14 de septiembre, hoy: 2 cosas y 1 hecha».
  - En la capa y en la hoja dice «2 cosas anotadas · 1 hecha», con dos filas en la lista de lo
    pendiente y una en «Hecho», con su casilla marcada.
  - La fila hecha mide 45 px de alto y la pendiente 67,1 px, en los dos anchos. En la celda, el chip hecho
    mide 20 px y el pendiente 24 px.
  - El texto hecho tiene `text-decoration-line: line-through`, y el pendiente, `none`.
  - Marcar con Space baja la fila a «Hecho», la tacha y deja el foco en su casilla. Desmarcar con un toque
    la devuelve arriba, sin tachar y con el foco en su casilla. La base refleja los dos cambios.
  - En el árbol de accesibilidad, la casilla hecha aparece como `checkbox "…" [checked]` dentro de la
    lista «Hecho». El recorrido con Tab pasa primero por las pendientes, «sin marcar», y después por la
    hecha, «marcada».
  - Un día con todo hecho dice «2 hechas» y «No queda nada pendiente para este día», no «Este día está
    libre».

  No se probó con un lector de pantalla de verdad: se revisó el árbol de accesibilidad que expone
  Chromium y el recorrido con Tab.

- **Los caminos.** `agenda.spec.ts`, en celular y escritorio:
  - Desde «Anotar algo», que en la PC es la hoja abierta por estado y en el celular la de la ruta, la hoja
    sigue con dos opciones. El camino al contacto abre «Cargar contacto» con la visita del día elegido en
    la URL y en el campo, y la hoja de anotar ya no está. Guardado, la visita aparece ese día en la agenda.
  - Desde el día libre de la capa y de la hoja, el camino al proyecto abre la pantalla con la entrega
    estimada de ese día y sin la ayuda del cálculo automático. Guardado, la entrega aparece ese día.
  - Unitarios: las rutas y `fechaDelEnlace` en `rutas.test.ts`, la visita inicial en `contacto.test.ts` y la
    entrega inicial en `formulario.test.ts`.
- `destinos-en-celular.spec.ts`: el encabezado de Inicio es «Inicio», el enlace «Agenda» y el de
  Ajustes, en ese orden para el lector de pantalla. Los dos se alcanzan con Tab y abren su pantalla con
  Enter. El ícono mide 44 × 44 px, está a la izquierda de la foto y a su misma altura, es `aria-hidden` y
  no es una campana.
