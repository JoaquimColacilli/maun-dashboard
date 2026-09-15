# 0042. Lo hecho de los trabajos se queda en la agenda, y sus marcas son columnas

- Estado: aceptada
- Fecha: 2026-09-15
- Completa al [0034](0034-la-agenda-calcula-lo-que-sale-de-los-trabajos.md) (lo hecho se queda en el
  día y la marca de importante) y al [0038](0038-el-embudo-del-seguimiento.md) (la visita y las etapas).
  Sigue el precedente de las tareas de presupuestar del 0038: un conjunto chico y fijo de marcas sobre un
  trabajo son columnas booleanas.

## Contexto

El dueño marcó un proyecto como entregado y la entrega desapareció del calendario. Con una anotación
tildada pasa lo contrario: queda tachada en su día, y eso le sirve para saber que la hizo y que no se
borró sola. Pidió lo mismo para las entregas y las visitas, y poder marcar una visita o una entrega como
importante, igual que una anotación.

**Lo que había, verificado antes de tocar nada.** `eventosDeLaAgenda` arma cada evento derivado según el
estado del trabajo:

- La **entrega** sale solo con la obra `en_curso`. Al entregar, desaparece. Es lo que vio el dueño.
- La **visita** sale mientras el trabajo está en seguimiento, en cualquiera de sus cinco etapas. «Ya fui a
  relevar» no la hacía desaparecer; desaparecía al aprobar o perder el contacto. Mientras tanto, una
  visita ya hecha quedaba pendiente y, con la fecha pasada, en rojo: «atrasada, era hace N días».
- El **vencimiento del presupuesto** desaparece al mandar el presupuesto o el estimativo.

**De dónde podía salir «hecho».** La entrega tiene una señal confiable: a `entregado` solo se llega con
«Ya lo entregué», a `cobrado` solo desde entregado, y «Volvió al taller» la devuelve a `en_curso`: el
estado dice de verdad si está entregada. La visita no tenía ninguna. `fecha_visita` es una sola columna:
«Ya fui a relevar» guarda ahí el día real y cambia la etapa, y corregir el día después edita la misma
columna. El único «ya fue» era `yaSeRelevo`, que mira la etapa, y el 0019 ya lo decía: «Un relevamiento
con la visita ya pasada es ambiguo. Sin un campo más no hay forma de distinguirlo».

## Decisión

**Todo evento de la agenda lleva `hecha` e `importante`**, propio o derivado. Lo hecho se ve igual en
los dos: se queda en su día, abajo de lo pendiente, tachado, más bajo y en la lista «Hecho». Las cuentas
(`resumenDelMes`, `resumenDelDia`, `cuentaDelDia`) cuentan lo pendiente y dicen aparte lo hecho; un día
con todo hecho dice que no queda nada pendiente, no que está libre; lo hecho no tiene urgencia; y los
avisos de la mañana no lo avisan.

**`hecha` sale de un hecho, nunca de la posición en el embudo.**

| Evento      | Pendiente                         | Hecha                                         |
| ----------- | --------------------------------- | --------------------------------------------- |
| Entrega     | la obra está `en_curso`           | la obra está `entregado` o `cobrado`          |
| Visita      | el trabajo está en seguimiento    | `proyectos.visita_hecha`, en cualquier estado |
| Presupuesto | como antes (no cambia, ver abajo) | nunca                                         |

- **La entrega hecha queda en el día de la entrega estimada**, donde estaba, no en el de la entrega real.
  Una entrega de una obra perdida o vuelta a presupuesto no sale: no se hizo.
- **`visita_hecha` es una columna nueva, decidida con el dueño.** La escribe `guardar_proyecto` junto con
  la fecha de la visita, y solo si la clave viene en el pedido, como el vencimiento: un bundle viejo no
  la borra. Cambiar de etapa no la toca. La prenden «Ya fui a relevar», cargar un contacto con la visita
  ya pasada (el caso del audio del 0019) y «Pasar a presupuestar» desde un estimativo con la visita ya
  pasada. La hoja del contacto tiene la casilla «Ya fui a relevar» para corregirla, y mover la visita a
  un día que todavía no llegó la apaga, en la hoja y en el formulario grande. La visita hecha se sigue
  viendo aunque el contacto se apruebe o se pierda.
- **Las visitas que ya se habían relevado se marcaron una vez**, en la misma migración: visita pasada y
  trabajo a presupuestar, con presupuesto enviado, en curso, entregado o cobrado. Sale de la etapa, pero
  una sola vez y como dato guardado. Afuera quedaron el estimativo, que a veces se manda antes de ir, y
  el perdido. Fueron 2 filas fuera del seed.
- **El vencimiento del presupuesto queda como estaba**, decidido con el dueño: desaparece al mandarlo. Es
  un plazo, no algo que pasó, y su único «hecho» posible es la etapa.

**Las marcas de importante son tres columnas de `proyectos`**: `visita_importante`,
`entrega_importante` y `presupuesto_importante`. Se tildan de a una con un update de su columna sola,
por la cola (`MUTACION_DE_MARCAS`), como las tareas; `guardar_proyecto` no las escribe, así que guardar
el agregado no las pisa. En la agenda se marcan con el mismo círculo, en el mismo lugar y con el mismo
color que una anotación, y el filtro «Marcado» trae las tres clases.

**El umbral, para el próximo.** Las columnas escalan mientras se cumplan las dos cosas: el conjunto de
eventos derivados es chico y fijo (hoy tres, `CATEGORIAS_DERIVADAS`), y un trabajo tiene a lo sumo uno de
cada uno. **Si aparece un cuarto tipo de evento derivado, o un trabajo puede tener más de uno del mismo
tipo (dos visitas, entregas parciales), no se agrega otra columna:** se pasa a una tabla de marcas con
clave `(household_id, proyecto_id, categoria)` (más la fecha si hay varios por trabajo), con RLS, en la
réplica y por la cola, y las columnas se migran a ella. Lo mismo vale para lo hecho: una segunda señal
guardada de «hecho» es el aviso de que conviene la tabla.

## Decidido por mi cuenta

- **El vencimiento también se marca como importante.** Es la tercera de las tres categorías derivadas:
  con la marca en las tres, el mapa `COLUMNA_DE_LA_MARCA` es exhaustivo sobre `CategoriaDerivada`, ninguna
  fila derivada queda sin el círculo y no hay un caso especial en la pantalla. Cuesta una columna más,
  dentro del umbral. La marca se conserva cuando el presupuesto se manda, aunque el evento deje de verse.
- **El lector de pantalla dice qué es «hecho» para cada cosa**: «, hecha» en una anotación, «, entregada»
  en una entrega y «, ya fuiste» en una visita. No depende del gris ni del tachado.
- **Una derivada hecha, en el día, es una fila baja** como la anotación tildada: sin el recuadro de dónde
  sale, con el círculo de la marca y un botón «Abrir el proyecto: …» en lugar del de borrar.
- **`yaSeRelevo` mira también `visita_hecha`**: con la visita hecha, la ficha y la hoja dicen
  «Relevamiento» y «Día que fuiste a relevar» aunque el contacto haya vuelto a relevamiento.
- **La tira de días del celular cuenta como la grilla** («2 cosas y 1 hecha») en vez de sumar todo.
- **«Hoy en la agenda», en Inicio, sigue mostrando solo lo pendiente**, ahora también sin las derivadas
  hechas (0034).

## Alternativas descartadas

- **Deducir la visita hecha de la etapa.** Volver de «a presupuestar» a «relevamiento» la des-completaría,
  y el dueño fue.
- **Deducirla de la fecha pasada.** No depende del embudo, pero marca como hecha una visita que no fue.
- **Una tabla de marcas desde ya.** Tres columnas fijas sobre un trabajo que tiene a lo sumo una de cada
  una son el precedente de las tareas; la tabla suma RLS, réplica y una mutación de alta y baja por un
  conjunto que no crece.
- **Tildar la visita o la entrega desde la agenda.** La entrega hecha es un estado, que se cambia desde la
  ficha con su fecha; un derivado no se edita desde la agenda (0034). La visita se corrige donde vive su
  fecha, en la hoja del contacto.

## Objeciones

- **La entrega hecha figura en el día prometido, no en el día que se entregó.** Es lo pedido («en el mismo
  día en el que estaba»). Si entregó tres días antes, la agenda la muestra tachada en el día estimado.
- **El update de las visitas subió la versión de esas 4 filas.** Un guardado de esos trabajos que hubiera
  quedado sin señal en un teléfono al momento del deploy rebota con «cambió desde que lo abriste».
- **La visita hecha se prende sola en tres caminos que implican que fuiste** (relevar, cargar con fecha
  pasada, pasar a presupuestar con la visita pasada). Si alguno no lo implica en el uso, se destilda.
- **Los meses pasados se llenan**: cada obra entregada o cobrada vuelve a mostrar su entrega. En la celda
  lo hecho va al final, así que lo pendiente se sigue viendo primero, pero cuenta para el «+N más».
- **El vocabulario no se tocó.** El barrido encontró que el evento se llama «Visita» en el filtro y
  «Relevamiento» en la fila, en la grilla y en el aviso, y que «Relevamiento» es también una etapa. Queda
  para decidir con el dueño.
- **Nada se probó en un teléfono ni con un lector de pantalla de verdad**: se revisó el árbol de
  accesibilidad de Chromium y el recorrido con Tab.

## Consecuencias

- Una migración (`20260915200000_lo_hecho_y_las_marcas.sql`) y la función de avisos desplegada de nuevo,
  porque importa el dominio al desplegarse.
- **El bundle**, medido con `vite build` sobre main y sobre esta rama:

  | Chunk      | main                       | Esta rama                  |
  | ---------- | -------------------------- | -------------------------- |
  | Aplicación | 355,03 kB (96,72 kB gzip)  | 359,07 kB (97,89 kB gzip)  |
  | `ui`       | 74,36 kB (24,80 kB gzip)   | 74,95 kB (24,93 kB gzip)   |
  | Vendor     | 751,46 kB (220,18 kB gzip) | 751,96 kB (220,28 kB gzip) |
  | CSS        | 64,76 kB (13,29 kB gzip)   | 64,80 kB (13,29 kB gzip)   |
  | Precache   | 29 entradas, 1329,96 KiB   | 29 entradas, 1335,01 KiB   |

  No entró ninguna dependencia nueva. Los textos del cambio están en el chunk de la aplicación y el dominio
  de la agenda en `ui`.

## Verificación

- Dominio: `agenda.test.ts` (entrega pendiente y hecha por estado, volver al taller, visita hecha en los
  ocho estados y en las cinco etapas, marcas por categoría y avisos sin lo hecho), con cobertura del 100%.
- Base: `22_lo_hecho_y_las_marcas.sql` (20): defaults, la visita hecha solo con la clave, cambiar de etapa
  no la des-completa, el reenvío, destildarla, las marcas por columna sin que `guardar_proyecto` las pise,
  otro taller y sin sesión. El ensayo con toda la suite y el comparador pasó antes del `db push`.
- Deno: la visita de hoy relevada no se avisa y la misma sin relevar sí.
- App: `calendario.test.ts`, `marcas.test.ts`, `contacto.test.ts`, `relevamiento.test.ts`,
  `seguimiento.test.ts` y `formulario.test.ts`.
- e2e (`hecho-y-marcado.spec.ts`, celular y escritorio): entregar y volver al taller, la visita hecha a
  través de las etapas y destildada en la hoja, las tres marcas y el filtro, y el recorrido con teclado.
  Deja capturas y el árbol de accesibilidad del día en el log. La suite completa: 285 pasaron, 66
  omitidos, ninguno falló.
- **El nombre accesible de una fila hecha** sale del texto más la palabra de lo hecho, en dos elementos:
  Chromium lo arma con un espacio antes de la coma («Entregar E2E Placard entregado , entregada»). Se lee
  igual; los tests lo toleran.
