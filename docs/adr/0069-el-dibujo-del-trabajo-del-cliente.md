# 0069. El dibujo del trabajo del cliente: el proceso, no el mueble

- Estado: aceptada
- Fecha: 2026-09-25
- Enmienda al [0068](0068-la-mesa-y-el-plano.md): «Tu mueble» y Gracias dejan de dibujar un mueble, el
  lienzo centra el dibujo también de costado, y `MuebleEnEtapa` y `Carcasa` se van.
- Completada el 2026-09-25 por el [ADR 0071](0071-la-entrega-y-sus-fechas.md): la escena `listo`,
  la hoja con la vuelta marcada en el calendario, para el mueble terminado que espera su día.

## Contexto

Con el 0068 ya mergeado, el dueño miró la página del cliente (`/v/…` y «Así la ve tu cliente») y marcó
tres cosas:

1. **El dibujo de «Tu mueble» no estaba centrado en su lámina.** Quedaba corrido a la izquierda, en el
   celular y en la compu.
2. **El mueble dibujado no era el mueble del cliente.** `MuebleEnEtapa` dibujaba siempre la misma
   cómoda de dos puertas, en plano, en el taller, terminada o pagada. Un cliente que encargó una cocina
   o un placard ve otro mueble y se confunde. El pedido: nada de muebles, porque nunca se va a saber qué
   mueble es; una iconografía general que sirva para cualquier trabajo, dentro del mismo sistema de
   ilustraciones.
3. **Con todo pagado, la tarjeta de datos mostraba la seña y no el total.**

## Lo investigado

### Por qué quedaba corrido

`Lienzo` arrancaba el `viewBox` en el borde izquierdo de lo dibujado menos el aire (4). Con el ancho
libre daba igual, pero las escenas usan el ancho fijo de 160: un dibujo de 110 de ancho quedaba pegado a
la izquierda: 4 de aire de un lado y 46 del otro. El alto ya se centraba. Afectaba a todas las escenas de
ancho fijo, no solo al mueble; se notaba más ahí porque la lámina de «Tu mueble» es ancha.

### Tres direcciones

Tres diseñadores trabajaron en paralelo, cada uno con una dirección, y un juez los comparó a 224 px (el
ancho de la lámina en el celular), en claro y en oscuro:

- **El proceso** («la mesa del taller, paso a paso»): cada hito se dibuja con el objeto que está sobre
  la mesa en ese momento. El anotador de la primera cuenta, la hoja del presupuesto, los tableros
  comprados, el serrucho en el corte, la casa del cliente y la tarjeta firmada.
- **El material que avanza**: la misma placa pasa de trazos a medida, a marcada, a cortada y a apilada.
  Es la serie más pura, pero no acompaña la frase: la placa de trazos no dice «número estimado», la
  marcada no dice «recibimos la seña» y un atado de tablas contradice «ya está instalado en tu casa».
  Además repetía escenas que el dueño ya tiene (el tablero con ejes de `sin-historial`, la pila de
  `sin-movimientos`).
- **Dos lugares**: el taller y la casa unidos por un camino, y lo que viaja entre los dos. Es la más
  narrativa y la que mejor generaliza, pero a 224 px lo que cambia de un hito a otro mide 15 a 20 px, el
  galpón con chimenea se lee como fábrica y la masa queda corrida hacia el taller.

Los sistemas de seguimiento que se revisaron (Uber Eats, el de Domino's, los íconos de estado de pedido)
coinciden en lo mismo: se ilustra el proceso, no el producto. Uber Eats dibuja un batidor en un bol para
«preparando», no la comida.

El juez eligió el proceso (8 sobre 10, contra 6 y 5) y pidió rehacer dos escenas: la pila atada se leía
como paquete o pallet, y el mango macizo del serrucho era la mancha de tinta más grande del sistema.

## Decisión

### Siete escenas del trabajo, ninguna con un mueble

`TrabajoEnEtapa` (`packages/ui`) recibe una `etapa` y dibuja:

| Etapa         | Qué dibuja                                                                   | Cuándo                                                       |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `estimativo`  | el anotador con dos renglones escritos a mano, uno rodeado, y el lápiz       | «Te pasamos un número estimado»                              |
| `preparando`  | la hoja del presupuesto a medio escribir, lo que falta de trazos, y el lápiz | «Estamos preparando tu presupuesto»                          |
| `presupuesto` | las dos hojas del presupuesto con sus partidas, el total y el clip           | «Te pasamos el presupuesto», y aprobado sin la seña cubierta |
| `sena`        | el mismo presupuesto con una pila de monedas encima                          | «Recibimos la seña y ya estás en la cola del taller»         |
| `fabricacion` | el tablero con un corte a medias, el serrucho adentro y el eje que falta     | «Lo estamos fabricando»                                      |
| `entregado`   | la casa                                                                      | «Ya está instalado en tu casa»                               |
| `pagado`      | la casa con la tilde                                                         | «Listo, está saldado»                                        |

- **La etapa del dibujo no es el hito.** `etapaDelDibujo(vista)` (`entities/vista-cliente`) la elige con
  lo que ya trae la vista: antes del presupuesto, el estimativo o la hoja a medio escribir; esperando la
  seña, el presupuesto; aprobado, **las monedas solo con la seña cubierta**. Aprobado con la seña en falta,
  o sin una seña acordada, sigue siendo el presupuesto: un dibujo con plata diría que entró una seña que
  no entró, y un dibujo que no coincide con lo que pasó es justo lo que el dueño marcó.
- **El número estimado no se escribe.** El primer diseño ponía «≈ $» a mano en el anotador; se leía como
  texto, y las escenas no llevan texto adentro. Quedó un renglón rodeado con la `VUELTA` del sistema, la
  misma de la agenda: «este es el número».
- **La seña es la segunda versión.** La pila de tableros atada con el remito se probó con tres capas, sin
  tacos y con un solo fleje, como pidió el juez, y seguía pareciendo un paquete. El presupuesto con las
  monedas encima se lee solo, y rima con la escena anterior: es la misma hoja.
- **El serrucho perdió la tinta.** El mango es de contorno con su calado (`costado` con `fill-rule`
  par-impar, para que el agujero deje ver la lámina), y la tinta queda en la ranura del corte. Bajó a 35°
  y el corte empieza más cerca del centro, así el mango no se escapa arriba a la derecha.
- **La casa es el único objeto que no es del taller.** Es el ícono de «tu casa»; un cliente de
  departamento lo entiende igual. La tilde de `pagado` va cerca del techo sin tocar el alero, y no se
  traza: la página del cliente no anima nada.

### Gracias es una tarjeta firmada

La pantalla de Gracias, al final de la encuesta, también le mostraba al cliente el mueble de otro. Ahora
es una tarjeta de agradecimiento parada sobre la mesa, con una firma de un solo trazo que se traza una
vez al llegar (`animar`). La firma es un solo subpath porque el trazado con `pathLength` no se reparte
bien entre varios.

### El lienzo centra también de costado

`Lienzo` centra la caja de lo dibujado en el `viewBox` de costado, como ya lo hacía de alto, cuando el
ancho viene fijo. Cada escena declara la caja de lo que de verdad dibuja: los volúmenes, más las marcas
de mano y lo que sobresale (el mango del serrucho, el alero, la tilde con la caja de su trazo).

### Piezas que quedaron en el módulo

Los tres diseñadores reescribieron las mismas cuatro cosas. Pasaron a `proyeccion.ts` y `trazos.tsx`:
`planoDeCostado(x)` (el plano de la cara x = cte), `planoInclinado(arriba, abajo)` (un plano que baja en
diagonal, como la cara de la tarjeta), `encerrar(puntos)` y `unir(...cajas)` para armar la caja de lo
dibujado, `correr(caja, x, y)`, y `Cara`, un polígono con su relleno a partir de puntos en 3D.

`MuebleEnEtapa` se va: de sus cuatro etapas solo quedaba el mueble de trazos de `sin-proyectos`, que pasa
a `escenas.tsx` tal cual. Con él se va `Carcasa`, que solo usaba la etapa del taller. `Mueble` queda: lo
usan `sin-proyectos` y `sin-opiniones`, que son de la app del dueño, donde el mueble es un ícono de
«trabajo» y no el de nadie.

### El total en la tarjeta de datos

Con el trabajo saldado, la tarjeta de datos suma un renglón debajo de la seña: «Total $ X · pagado», con
el precio del trabajo (`textoDelTotalPagado`). Antes de saldar no aparece: ahí manda «Te falta pagar».

## Objeciones

- **La familia son siete objetos, no uno que avanza.** Se lee como una serie de íconos del mismo sistema
  más que como un relato. Es el precio de que cada dibujo acompañe su frase.
- **El serrucho de mano es un ícono.** Un taller de hoy corta con escuadradora; el serrucho se reconoce a
  224 px y la escuadradora no.
- **Presupuesto y aprobado sin la seña comparten dibujo.** El título los distingue.
- **La firma de Gracias tiene forma de letra.** Una firma es eso; a 224 px se lee como firma, no como
  una palabra.

## Alternativas descartadas

- **Adivinar el mueble del trabajo** por su título o una categoría. Nunca va a estar el que es, y un
  mueble parecido confunde más que ninguno.
- **El material que avanza y los dos lugares**, por lo de arriba.
- **La pila atada para la seña.** Se leía como paquete aun aligerada.
- **Centrar la casa sola y dejar la tilde en el aire.** La tilde se salía del lienzo por arriba.

## Consecuencias

- Una escena que ve el cliente no dibuja un mueble.
- La escena de la página del cliente la elige `etapaDelDibujo`, no la pantalla. Un estado nuevo de la
  vista se suma ahí y en su test.
- Antes de escribir una matriz o una caja de límites en una escena, se usan las de `proyeccion.ts`.

## Cómo se verificó

- Las siete escenas y Gracias se miraron a 224 px y 288 px, en claro y en oscuro, con guías en el centro
  de la lámina: la caja de cada una cae en la cruz.
- `Ilustracion.test.tsx`: cada etapa es un lienzo de 160 × 120 hecho solo con la gramática y sin texto,
  cada una distinta de las otras, la tilde solo en `pagado` y sin trazarse, y lo que falta del
  presupuesto de trazos solo mientras se prepara.
- `etapa.test.ts`: qué dibujo sale en cada estado del trabajo, con las monedas solo con la seña cubierta.
- `VistaDelCliente.test.tsx`: con todo pagado, la tarjeta dice «Total $ 1.240.000 · pagado» debajo de la
  seña; sin saldar, no hay total.
