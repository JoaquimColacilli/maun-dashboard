# 0040. Un formulario en hoja pregunta antes de descartar, y solo si hay algo que perder

- Estado: aceptada
- Fecha: 2026-09-15
- Toca `Hoja` y las hojas por ruta ([0020](0020-pulido-visual.md)).

## Contexto

El dueño escribía en «Anotar algo», tocaba afuera sin querer y la hoja se cerraba con lo escrito. Pidió que
pregunte antes de descartar, pero solo cuando haya algo que perder, y con el mismo criterio para Escape y
para la cruz. Vale para todo formulario que se abra en hoja.

## Decisión

- `Hoja` recibe `conCambios`. En `false`, que es lo que traen las hojas que no son formularios, se cierra como
  siempre. En `true`, tocar afuera, Escape, la cruz y el «Cancelar» del formulario muestran «¿Cerrar sin
  guardar?» con «Seguir editando», que se lleva el foco, y «Descartar».
- El «Cancelar» es del formulario, no de la hoja: la hoja le pasa `pedirCierre` cuando `children` es una
  función. Así los cuatro caminos pasan por el mismo lugar.
- **La pregunta va adentro del mismo `<dialog>`, abajo, y no en un segundo modal.** Un `showModal` encima de
  otro complica el foco y la salida animada, y en el celular la pregunta queda donde está el pulgar. Con la
  pregunta a la vista, tocar afuera no hace nada y Escape es seguir editando.
- **Chrome no deja frenar un segundo Escape si no hubo otro gesto en el medio:** manda un `cancel` que no
  se puede cancelar y enseguida cierra el `<dialog>`. La hoja ignora ese `cancel`, se vuelve a abrir en el
  `close` y recién ahí decide: con la pregunta a la vista, sigue editando; sin ella, pregunta. Antes de
  este cambio el `cancel` cerraba la pregunta y el `close` la volvía a abrir. Lo encontró el e2e; el test
  unitario manda los dos eventos.
- **Una hoja que se vuelve a abrir mientras todavía sale se monta de nuevo:** `ConSalida` le da una key a
  cada apertura. Sin eso, la segunda apertura heredaba el estado de la primera, y «Editar el contacto»
  reabierta en esos 400 ms no se cerraba al guardar.
- **«Algo que perder» es distinto de lo que había al abrir**, campo por campo (`hayCambios`), con los textos
  recortados: escribir espacios no cuenta, y escribir y borrar vuelve a no tener cambios. Editar algo ya
  cargado y no tocar nada tampoco pregunta. El formulario con react-hook-form usa `isDirty`, que compara
  igual contra los valores con que abrió.

## Inventario

| Hoja                                              | Componente           | Qué hace ahora                                                            |
| ------------------------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| Anotar algo                                       | `HojaDeAnotacion`    | Pregunta: texto, categoría, día, hora, trabajo e importante.              |
| Cargar contacto y Editar el contacto              | `HojaDeContacto`     | Pregunta: cliente, teléfono, qué pide, visita, seña, vencimiento y notas. |
| Cliente nuevo y Editar cliente                    | `HojaDeCliente`      | Pregunta con `isDirty`.                                                   |
| Cargar un movimiento y Editar el movimiento       | `HojaDeMovimiento`   | Pregunta: tipo, categoría, qué fue, monto y fecha.                        |
| Encuadrar la foto                                 | `FormularioDePerfil` | No pregunta: ver abajo.                                                   |
| ¿Borrás el proyecto, el contacto o el cliente?    | confirmaciones       | No es un formulario: se cierra como siempre.                              |
| La oferta de la huella                            | `OfertaDeHuella`     | No tiene campos.                                                          |
| Ordenar por                                       | `ProyectosPage`      | Elegir un orden se aplica en el momento.                                  |
| El detalle de un movimiento, el visor de imágenes | solo lectura         | No hay nada que perder.                                                   |
| El día de la agenda (hoja y capa)                 | `AgendaPage`         | Es una lista. «Anotar» abre la hoja de anotar, que pregunta.              |

## Lo que queda afuera

- **El botón atrás del navegador en las hojas por ruta** (`/seguimiento/nuevo`, `/finanzas/nuevo`,
  `/agenda/anotar`). Cerrar esas hojas es volver atrás (0020), y el atrás cambia la ruta sin pasar por la
  hoja: se cierra sin preguntar. Frenarlo pide bloquear la navegación del router y decidir qué hace el gesto
  de volver del celular. Queda para otro cambio. En esas hojas, tocar afuera, Escape, la cruz y «Cancelar» sí
  preguntan.
- **La pantalla de proyecto** (nuevo y editar). No es una hoja: es una pantalla con ruta que en el celular
  ocupa todo, y su «Cancelar» sale sin preguntar. Aplicarle el criterio pide lo del punto anterior, y antes
  hay que revisar que los campos que completa sola (la entrega estimada y el comprobante) no cuenten como un
  cambio. No lo verifiqué, así que no lo toqué.
- **Encuadrar la foto de perfil.** No se escribe nada: perder el encuadre es volver a elegir la foto. Mientras
  sube, la hoja ya no se deja cerrar.
- **Los caminos de «Anotar algo»** (cargar un contacto o un proyecto para ese día) cierran la hoja sin
  preguntar: son un pedido explícito de ir a otro formulario. Que lo escrito viaje al otro formulario sería
  otro cambio.

## Consecuencias

- Un formulario nuevo en `Hoja` pasa `conCambios` y, si tiene «Cancelar», usa `pedirCierre`. Sin eso se
  cierra sin preguntar, como antes: no hay un valor por defecto que pregunte, porque la mayoría de las hojas
  no son formularios.
- Los e2e están en `formularios.spec.ts`: sin cambios, con cambios, y los caminos de cerrar.
