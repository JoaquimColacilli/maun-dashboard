# 0019 — Seguimiento: el contacto es la misma fila, sin tablero

Estado: **aceptada**. Fecha: 2026-09-12.

## Contexto

El dueño lo pidió en dos audios: una sección para los contactos de posibles trabajos, donde viva la
visita del relevamiento, donde quede registrada la plata que cobra en esa visita, y desde donde el
trabajo pase a Proyectos cuando lo aprueban. En Proyectos, solo los aprobados.

El HTML viejo lo obligaba a pedirlo. `guardarProy()` frena con `alert('Falta el presupuesto.')`, así
que un trabajo recién relevado no se puede guardar sin inventar un número. Y cargarle la seña lo
promueve solo: `pagos.length>0 && estado==='presupuestado' ? 'en_curso' : estado`. La lista de
proyectos se llenaba de cosas que no eran proyectos y encima decían "en curso".

Lo que ya había en la base, verificado antes de construir:

- **El enum y la máquina de estados son de la 2A.** Hay cuatro estados de seguimiento (`contacto`,
  `relevamiento`, `a_presupuestar`, `presupuesto_enviado`), se va y viene entre ellos, y desde
  cualquiera se pasa a `en_curso`. `presupuesto_centavos` es nullable desde el primer día.
- **Ningún estado cambia solo.** `guardar_proyecto` guarda el estado que manda la app; no hay
  promoción automática por pagos.
- **Los pagos entran a MAUN en cualquier estado**, igual que en el HTML.
- **Los gastos salen de MAUN en cualquier estado, y eso NO es como el HTML.** El HTML los metía
  adentro de `if(p.estado!=='presupuestado')`. La vista `libro_mayor` no mira el estado, y el ADR
  0011 lo decidió así a propósito: la base de un perdido es "la seña retenida menos los gastos
  cargados contra el lead", porque la nafta de la visita es un gasto real. **No se cambió.** Ver
  "Lo que queda para decidir".
- **Activos ya filtraba por fase.** Un contacto nunca apareció mezclado; lo que aparecía era una
  pestaña Seguimiento que decía que todavía no existía.

## Decisiones

### 1. Un contacto es una fila de `proyectos` en fase de seguimiento

No hay tabla de leads ni mutación propia. El contacto se guarda con `guardar_proyecto` como cualquier
agregado (ADR 0015), la seña es un `pago` de ese agregado, y aprobarlo es cambiarle el estado. Por eso
**la seña viaja sin hacer nada**: el pasaje manda `pagos: []`, la base no borra lo que no vino en el
pedido, y el pago sigue siendo la misma fila con el mismo id. Cero migraciones.

### 2. Una lista, no un tablero

Implementado como pedía el brief, por sus motivos: una persona, pocos contactos, un tablero que
depende de que alguien arrastre tarjetas y un bundle bajo la lupa. Los estados se ven (insignia, filtro
y un selector de etapa en la ficha) pero no organizan la pantalla.

### 3. El orden es "lo que hace más que espera", y la espera sale de `updated_at`

`contactosEnOrden` ordena por la **última actividad**: el `updated_at` más nuevo entre la fila, sus
pagos y sus gastos (`ultimasActividades`). Los hijos cuentan porque cargar la seña es tocar el
contacto, y `proyectos.updated_at` no se mueve cuando solo cambia un pago. Más vieja, más arriba. El
desempate es por id.

**Decisión propia:** un contacto con la visita agendada para más adelante **va al final**, ordenado
por fecha de visita. No está esperando nada de él: tiene fecha. Mezclarlo por antigüedad lo pondría
arriba de todo justo cuando no hay nada que hacer.

### 4. El próximo paso se deriva: sin campo nuevo

`situacionDelContacto` lo arma del estado y de la fecha de visita: "Falta agendar la visita", "Ir a
relevar el vie 18 sep", "Falta pasar lo relevado a presupuestar", "Falta presupuestar", "Falta llamar
para saber". La espera se escribe como una frase: «Presupuesto enviado hace 9 días, sin respuesta».
**A los siete días sin moverse la tarjeta se marca**. El umbral es el del diseño
(`Seguimiento.dc.html`, el copo de "Sin novedades hace N días").

### 5. El formulario liviano: cliente, teléfono, qué pide, visita, seña y notas

- **El teléfono vive en el cliente**, que es donde lo usan Llamar y WhatsApp. Si cambia, la hoja
  encola una edición del cliente **antes** del guardado del contacto; la cola drena en orden.
- **Al crear, la etapa sale de la fecha de visita** (`etapaAlGuardarElContacto`): sin fecha es
  `contacto`, con fecha de hoy en adelante es `relevamiento`, y con fecha pasada es `a_presupuestar`.
  Es el caso del audio: vuelve de la visita, la carga con la seña y ya queda a presupuestar. Una vez
  que avanzó, editar la fecha no le cambia la etapa.
- **La seña se edita acá si hay cero o un pago.** Con uno es ese mismo pago (mismo id). Vaciarlo
  manda la baja marcada. Con varios, el campo muestra el total y manda al detalle: la hoja no puede
  saber cuál de todos es "la seña".
- **Sin presupuesto.** Llega en el paso "Mandé el presupuesto", que pide el monto como opcional, o en
  el pasaje.

### 6. Aprobar es una pantalla, no una opción de un desplegable

`/proyectos/:id/aprobar`, hermana de `/cobrar` y `/cerrar`. Ahí aparecen los campos de la obra:
presupuesto aprobado, forma de pago, inicio, entrega estimada a 21 días hábiles, dirección y
comprobante. Arriba se ven la seña ya cobrada y el saldo.

- **El presupuesto es obligatorio en el pasaje**, aunque la base lo acepte null. Un proyecto activo
  sin presupuesto no tiene saldo, que es lo primero que el dueño mira de una obra. Es decisión mía:
  el brief no lo decía.
- **La pantalla decide si deja entrar una sola vez, al montarse.** La fila optimista pasa a
  `en_curso` antes de que la base conteste; si la guarda mirara en cada render, desmontaría el
  formulario antes de que un rechazo pudiera verse en él.

### 7. Perder es `cerrar_perdido`, que ya existía

La ficha lleva a `/proyectos/:id/cerrar` y dice antes qué pasa con la seña. No hubo nada que agregar.

### 8. La ficha del contacto es `/proyectos/:id`, que elige la vista por la fase

No hay `/seguimiento/:id`. Todo lo que ya enlaza a un proyecto sigue funcionando con un contacto: los
avisos de rechazo, el cierre, la ficha del cliente y `rutaDelProyecto`. Y cuando el contacto se
aprueba o se pierde, la misma URL muestra la otra vista sin redirecciones: es literalmente "se pasan
de una pestaña a la otra cuando cambian de estado".

### 9. La fila optimista de un guardado sube la versión

Esto es arquitectura, y lo encontró el diseño del flujo, no un test. `conElAgregado` aplicaba la fila
con la `version` vieja. Con el formulario grande no se notaba, porque se guarda una vez y se sale.
Seguimiento son pasos de un toque: "Ya fui a relevar" y enseguida "Mandé el presupuesto", sin señal.
El segundo pedido salía con la misma versión que el primero, la base ya la había subido y rebotaba con
`MN006`.

- **`versionDelGuardado`** sube la versión en uno **solo si cambia alguna columna del proyecto**, que
  es exactamente cuando la sube `private.mantener_metadatos`. Un guardado que solo toca pagos no la
  sube, y la base tampoco. Lo mismo vale para la mutación de notas.
- **La respuesta se aplica salvo que haya algo más nuevo que las dos cosas**: la versión que dejó
  esta mutación y la que devolvió la base. Es la generalización de `aplicarSiNoEsVieja`. Conserva el
  caso del ADR 0016 (el guardado del pago final no pisa la liquidación optimista) y además corrige una
  fila local desfasada cuando la base devuelve una versión menor que la esperada.
- **Verificado en el e2e de modo avión:** crear el contacto con seña, «Mandé el presupuesto» y un
  cambio de etapa, las tres sin señal, drenan en orden y ninguna rebota.
- **Probablemente cierra un agujero que ya estaba, pero eso es razonado, no probado.** Reactivar un
  perdido desde el formulario, cambiar además una columna y guardar dejaba la versión local una atrás
  del servidor. El cierre que seguía debería haber rebotado con `MN006`. No escribí el test que lo
  reproduce contra el código viejo.

### 10. Proyecto nuevo solo ofrece estados de obra

El formulario grande, en un alta, ya no ofrece los estados de seguimiento: un contacto entra por
Seguimiento. Editar un contacto con el formulario grande (para cargarle un gasto) sigue ofreciendo sus
transiciones válidas.

### 11. El marco no le roba el foco a una hoja abierta por ruta

`Marco` enfoca el `<main>` en cada cambio de ruta. Con `/seguimiento/nuevo`, el efecto del marco
corría después del de la hoja y le sacaba el foco al campo de cliente. Ahora no enfoca el `<main>` si
el foco ya está adentro de un `role="dialog"`. La hoja de movimientos de Finanzas tenía el mismo
problema y queda arreglada de rebote.

### 12. `Despiece.dc` no se construye

No es una pantalla: es la especificación de un componente (`$preview` de 480×360, sin cabecera ni
navegación), y ese componente ya existe como `DistribucionDespiece`, en la ficha y en el cobro desde
los pasos 8 y 9. Además calcula sobre el **presupuesto** (`M.despiece(p)`), que es el error 1 del ADR 0003. Lo único que tiene y no se portó son las cotas de carpintería arriba y abajo del tablero y la
franja rayada de "no alcanza". Son decoración: el dato, "faltan $X", ya está en la leyenda.

## Lo que queda para decidir

**Los gastos de un contacto mueven la caja desde que se cargan.** El HTML los postergaba hasta que el
trabajo dejaba de estar presupuestado. La base de hoy los cuenta al cargarlos, y el e2e lo deja escrito
así. Lo mantengo por tres razones:

- la plata salió de verdad;
- el cierre como perdido ya los descuenta de la seña (ADR 0011);
- postergarlos haría que un gasto se mueva de mes según cuándo se apruebe el trabajo.

Si el dueño prefiere lo del HTML, es un cambio en la vista `libro_mayor`, en `lineasDelLibro` y en el
comparador, con migración.

## Objeciones

- **`updated_at` no es "último contacto con el cliente".** Cualquier edición reinicia el reloj.
  Corregir un error de tipeo en las notas hace que un presupuesto enviado hace nueve días diga "hoy".
  La base ya tiene `proyectos.ultimo_contacto` (una fecha, con su `comment on`) que ninguna pantalla
  llena. La salida sin campo nuevo para el usuario sería que los pasos ("Ya fui a relevar", "Mandé el
  presupuesto") la escriban solos y que la espera se cuente desde ahí. No lo hice porque el brief pedía
  `updated_at` explícitamente.
- **Un relevamiento con la visita ya pasada es ambiguo.** No se sabe si fue. La app asume que sí y
  pide pasarlo a presupuestar. Sin un campo más no hay forma de distinguirlo.
- **El orden en el e2e se prueba con segundos de diferencia, no con días.** La base pone `updated_at`
  con su reloj y no hay grant para escribirlo, así que no se puede fabricar un contacto de hace nueve
  días. El orden por días y los textos están cubiertos con tests unitarios. En el e2e se usa el reloj
  del navegador adelantado para ver el texto.

## Alternativas descartadas

- **Una tabla de leads que al aprobarse crea el proyecto.** Obliga a mover la seña de una tabla a otra,
  que es justo lo que no puede pasar: se duplica, o se pierde si la cola corta a mitad.
- **Un campo "próximo paso".** Un campo más para llenar, para quien menos ganas tiene de llenar campos.
- **Un tablero de columnas arrastrables.** Ver la decisión 2.
- **`/seguimiento/:id` con redirección a `/proyectos/:id` al aprobarse.** Dos rutas para la misma fila
  y todos los enlaces existentes apuntando a la equivocada.
- **Aprobar desde el selector de etapa.** Es el "cambio de estado en un desplegable perdido" que el
  pedido quería evitar, y dejaría un proyecto activo sin presupuesto ni fechas.

## Consecuencias

- Cero migraciones y cero dependencias nuevas.
- **El bundle**, medido con `vite build` sobre main y sobre este paso:

  | Chunk      | Antes                      | Después                    |
  | ---------- | -------------------------- | -------------------------- |
  | Aplicación | 187,17 kB (49,25 kB gzip)  | 216,12 kB (55,45 kB gzip)  |
  | Vendor     | 736,55 kB (215,87 kB gzip) | 736,55 kB (215,87 kB gzip) |
  | CSS        | 36,70 kB (8,04 kB gzip)    | 37,26 kB (8,13 kB gzip)    |
  | Precache   | 29 entradas, 1082,25 KiB   | 29 entradas, 1111,07 KiB   |

  El vendor tiene el mismo hash antes y después: no entró nada de `node_modules`. El paso cuesta
  6,2 kB comprimidos de código propio.

- `features/seguir-contacto` es el slice nuevo: la hoja liviana, el avance por etapas y la pantalla
  del pasaje. Las notas con autoguardado y el borrado con confirmación se mudaron de la ficha del
  proyecto a `features/editar-proyecto`, porque ahora los usan las dos fichas.
- Los botones de llamar y WhatsApp (`AccionesDeContacto`) viven en `entities/cliente`, al lado de los
  enlaces que arman.
