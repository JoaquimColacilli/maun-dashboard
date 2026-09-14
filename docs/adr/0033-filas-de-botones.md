# 0033. Filas de botones: entran todos en un renglón o bajan todos

- Estado: aceptada
- Fecha: 2026-09-14
- Completa al [0020](0020-pulido-visual.md) en cómo se adapta lo que vive en una columna, y corrige al
  [0029](0029-el-estado-se-cambia-desde-la-ficha.md) en dónde va la acción de volver.

## Contexto

En el teléfono, el panel «Qué falta» de una obra en curso mostraba «Ya lo entregué» arriba y
«Volvió a presupuesto» abajo, a medio ancho y corrido a la derecha. Era `flex-wrap` con `ml-auto`: los
botones caen de a uno y el último queda huérfano con su ancho de contenido. El mismo patrón, o `flex`
con `flex-1`, estaba en quince filas más.

## Decisión

**`FilaDeAcciones` (`packages/ui`) es la fila de dos o más botones**:

```css
grid-template-columns: repeat(auto-fit, minmax(min(var(--accion-min), 100%), 1fr));
```

- Si el contenedor no tiene lugar para dos columnas del mínimo, colapsa a una y todos pasan a ancho
  completo. El todo o nada sale de la definición: sin consultas de medio ni de contenedor.
- **`auto-fit` y no `auto-fill`**: colapsa las pistas vacías, así que un botón solo ocupa todo el ancho
  en vez de quedar en media columna.
- **`min(…, 100%)`**: en un contenedor más angosto que el mínimo la columna se achica al contenedor en
  vez de salirse. Nada se sale en 320 px.
- La fila decide el ancho de sus celdas (`*:w-full`), con `gap` de 8 px (`--space-2`). Los botones
  adentro no llevan `flex-1`, `w-auto` ni `ml-auto`.

**`--accion-min` es 252 px: la etiqueta más larga que vive en una fila, medida.** Se midió en
Chromium con la fuente real (IBM Plex Sans 500 a 15 px), con el padding del botón primario:

| Etiqueta                          | Ancho natural |
| --------------------------------- | ------------- |
| «Reactivar y deshacer el reparto» | 249,2 px      |
| «Reabrir y deshacer el reparto»   | 234,9 px      |
| «Lo aprobó: pasar a Proyectos»    | 234,1 px      |
| «Borrar los 99 cambios y salir»   | 230,6 px      |
| «Configurar sueldo y metas»       | 215,0 px      |

Redondeado al múltiplo de 4 que la aguanta. «Cobrar el saldo de $ 1.200.000» mide 273,8 px (305,1
con centavos), pero no está en ninguna fila. Cobrar sale solo de entregado y dar por perdido de
seguimiento o en curso (`ORIGENES_DE_LIQUIDACION`), así que en la ficha nunca aparecen juntos. Si
entra a una fila una etiqueta más larga, se sube el token; no se achica la letra.

**El alto de `Button` pasa a ser un mínimo** (`min-h-*`, con `py-1.5` y `text-center`). A 320 px el
panel de reactivar mide 246 px, menos que el mínimo, y la etiqueta más larga baja a dos renglones.
Con el alto fijo de 44 px el texto se salía del botón: medido en el e2e antes del cambio. Con un
renglón el alto es el de siempre (22,5 px de texto más 12 de padding es menos que 44).

**Dónde se aplicó** (dieciséis filas en catorce archivos):

| Archivo                                          | Fila                                                      |
| ------------------------------------------------ | --------------------------------------------------------- |
| `features/editar-proyecto/AvanceDeLaObra`        | «Qué falta» de la obra: avanzar y volver                  |
| `features/seguir-contacto/AvanceDelContacto`     | El próximo paso y «Ya lo aprobó»; «Marcar como enviado»   |
| `features/liquidar-proyecto/BotonDeReversion`    | «Reabrir/Reactivar y deshacer el reparto» y «Dejarlo»     |
| `features/editar-proyecto/BorradoDelProyecto`    | «Cancelar» y «Borrar el proyecto/contacto»                |
| `pages/clientes/ClienteFichaPage`                | «Cancelar» y «Borrar el cliente»                          |
| `features/editar-cliente/HojaDeCliente`          | El pie: «Cancelar» y guardar                              |
| `features/seguir-contacto/HojaDeContacto`        | El pie: «Cancelar» y guardar                              |
| `features/registrar-movimiento/HojaDeMovimiento` | El pie («Borrar» y guardar) y «Borrarlo» / «Dejarlo»      |
| `entities/movimiento/FichaDelMovimiento`         | «Editar» y «Borrar», deshabilitados                       |
| `features/editar-perfil/RecortadorDeFoto`        | «Cancelar» y «Guardar la foto»                            |
| `features/cerrar-sesion/EntrarConOtraCuenta`     | «Borrar el cambio y salir» y «No, volver»                 |
| `pages/inicio/InicioPage`                        | «Configurar sueldo y metas» y «Cargar el primer proyecto» |
| `app/layout/ErrorDeCarga` (`CargaQueTarda`)      | «Reintentar» y «Cerrar sesión»                            |
| `shared/ui/Aviso` (el de `ErrorDeCarga`)         | «Reintentar» y «Cerrar sesión»                            |

`BotonSalir` recibe `size` y `className` para ocupar su celda con el alto de su vecino.

**Dónde no, a propósito:**

- **Borrar y Editar en el encabezado de las fichas** de proyecto, contacto y cliente. Son
  herramientas chicas al lado del «volver». Con el mínimo de 252 px bajarían debajo del enlace como
  dos renglones a ancho completo, y el encabezado pasaría de una línea a tres.
- **El encabezado de la pantalla de proyecto** («Cancelar», título, «Guardar»): es una barra de tres
  columnas.
- **Los selectores segmentados** (forma de pago, etapa, tipo de movimiento, «Hoy» y «Ayer»): son
  radios, no acciones. Con cuatro opciones, `auto-fit` dejaría tres y una.
- **El zoom del recorte** («−», la barra y «+»), **los accesos de llamar y WhatsApp** (enlaces con
  ícono) y **los enlaces subrayados del aviso de rechazo**.
- **Lo que ya está apilado a ancho completo** (la oferta de la huella, reenviar el mail, el bloqueo)
  y **los botones que se alternan** con un ternario y nunca se ven juntos.

## Objeciones

- **Con un mínimo que aguanta la etiqueta más larga, casi todas las filas quedan apiladas.** Dos
  columnas piden 512 px de contenedor. En el celular, el pie de cada hoja pasa de un renglón a dos
  (96 px más el padding en vez de 44), también con el teclado abierto, y «Cancelar» queda arriba de
  «Guardar». En la PC, el panel de la ficha (486 px) sigue apilado.
- **La hoja normal de la PC queda justo en el umbral**: su pie mide 512 px, exactamente dos columnas
  de 252 y el gap. Un píxel menos de hoja, o un token más grande, la apila.
- **El doble toque ya no se evita por posición** (ADR 0029). Un botón solo ocupa todo el ancho: al
  tocar «Ya lo entregué», «Volvió al taller» aparece en el mismo lugar. Lo que corresponde es un
  deshacer en el aviso o un respiro después del cambio, no mover el botón; queda para decidirlo con el
  dueño.
- **Con tres o más botones, `auto-fit` no es todo o nada**: puede dejar dos arriba y uno abajo a media
  columna. Hoy no hay filas de tres. Si aparece una, necesita otra regla, no esta.
- **La medición es de Chromium de escritorio.** El margen del token sobre la etiqueta es de 2,8 px
  (1,1 %). Android puede redondear la fuente distinto; si en el teléfono se ve cortada, se sube el
  token.
- **El alto mínimo toca a todos los botones.** Un `Button` dentro de un `flex` sin `items-*` ahora se
  estiraría al alto de sus hermanos. Revisé los contenedores de todos los `Button` y no encontré
  ninguno donde cambie, pero eso lo revisé leyendo, no midiendo cada pantalla.
- **Nada se probó en un teléfono.**

## Verificación

`filas-de-acciones.spec.ts`, en `celular` (390 y 320 px) y `escritorio` (1440 px). Mide cada celda,
el ancho natural de su botón con la fuente cargada, cuántos renglones ocupa el texto y si se sale del
botón. Falla si una celda queda huérfana o si una etiqueta no entra en el mínimo.

| Fila                   | 320 px                                               | 390 px                | 1440 px                      |
| ---------------------- | ---------------------------------------------------- | --------------------- | ---------------------------- |
| Obra en curso (2)      | Apiladas, 246 px                                     | Apiladas, 316 px      | Apiladas, 486 px             |
| Obra entregada (1)     | Todo el ancho, 246 px                                | Todo el ancho, 316 px | Todo el ancho, 486 px        |
| Reactivar (2)          | Apiladas, 246 px; la etiqueta larga en dos renglones | Apiladas, 316 px      | Apiladas, 486 px             |
| Hoja de contacto (2)   | Apiladas, 280 px                                     | Apiladas, 350 px      | Un renglón: 252 + 252 de 512 |
| Hoja de movimiento (1) | Todo el ancho, 280 px                                | Todo el ancho, 350 px | Todo el ancho, 512 px        |

- Antes del alto mínimo, la de reactivar a 320 px fallaba: los dos renglones se salían del botón de
  44 px.
- La primera medición de la hoja en la PC dio celdas de 244,7 px: era la animación de entrada
  (`scale-96`). El test espera a que terminen las animaciones antes de medir.
- Las otras once filas no tienen una medición propia. Las recorren los e2e que ya existían (el
  bloqueo, los borrados, las hojas), que siguen pasando, pero eso prueba que funcionan, no su forma.
- `FilaDeAcciones.test.tsx` y `Button.test.tsx`: la definición de la grilla y los altos mínimos.
