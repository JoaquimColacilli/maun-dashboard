# 0018 — Finanzas, el diezmo y los movimientos a mano

Estado: **aceptada**. Fecha: 2026-09-12.

## Contexto

Este es el paso que cierra la paridad con el HTML viejo: después de esto, todo lo que el dueño sabe
hacer hoy tiene lugar en la app nueva salvo el Seguimiento (que es nuestro) y la exportación (que
sigue pendiente, ADR 0017).

Lo que faltaba: el historial de movimientos, el formulario completo con los ocho tipos manuales, la
pantalla de Diezmo, el ajuste del saldo de COCOS y la comparación del mes contra el anterior.

Y dos cabos sueltos del paso 9: un rechazo encolado se podía perder si la app se recargaba en el
instante siguiente, y `MN008` había quedado cubriendo dos causas con un texto que hablaba de una.

## Decisiones

### 1. El libro es una lista de operaciones, no de asientos

La vista `libro_mayor` y `asientosDelLibro` parten cada operación en sus dos lados: una transferencia
de Maun a Cocos son **dos** asientos, uno por tesoro. Eso es lo correcto para sacar saldos y es lo que
la base compara contra el dominio.

Para leer no sirve. Una transferencia no es un ingreso ni un gasto, y mostrarla partida en dos filas
la convierte en las dos cosas a la vez.

`lineasDelLibro` es la forma **sin partir**: una línea por operación, con `desde` y `hacia`.
`asientosDelLibro` pasó a ser `lineasDelLibro(...).flatMap(asientosDeLaLinea)`, así que las dos no
pueden divergir por construcción y la comparación contra SQL sigue cubriendo todo. La línea no tiene
gemela en SQL y no la necesita: nada en la base la consume.

En la interfaz, una línea con los dos lados se lee `Maun → Cocos`, con los dos tesoros en su color y
el importe sin signo. El filtro por sentido tiene cuatro opciones y no tres: **Todo, Entradas, Salidas
y Entre tesoros.**

El neto del día se calcula sobre el tesoro filtrado cuando hay uno, y sobre el taller entero cuando no
lo hay (y ahí las transferencias valen cero, porque no cambian nada).

### 2. El diezmo no se muestra como un saldo con signo

El tesoro DIEZMO acumula lo generado y descuenta lo pagado: su saldo es **lo que falta pagar**. Inicio
lo etiquetaba como «a favor» cuando era positivo, que es exactamente al revés. Corregir la etiqueta no
alcanzaba: le pediría al usuario razonar sobre una convención de signo para saber si debe plata.

Los otros tres tesoros son saldos y se leen como saldos. DIEZMO es una deuda y se lee como una deuda:
**«Debés $124.000», «Estás al día», «Pagaste $30.000 de más».** Es lo mismo en la tarjeta de Inicio,
en el acceso de Inicio y en la pantalla de Diezmo, y sale de una sola función (`estadoDelDiezmo` en el
dominio, `fraseDelDiezmo` para el texto).

Ninguna persona debería tener que interpretar un signo para saber si está en falta con algo que le
importa.

### 3. El gráfico del mes: SVG presentacional más una tabla de verdad

Hacer un SVG realmente navegable —`title` y `desc` en la raíz, un rol por marca, un modelo de foco por
elemento— es caro, y para seis números no se paga. El SVG va con `aria-hidden` y `role="presentation"`,
y al lado hay una tabla con los mismos números.

La tabla **no** está escondida para lectores de pantalla: está detrás de un botón «Ver los números»
que cualquiera puede apretar. Hay gente que prefiere filas y columnas, y para seis cifras la tabla
probablemente comunica mejor que las barras.

Sin librerías de gráficos: son tres pares de rectángulos.

**Esto es un agregado nuestro, no paridad.** El HTML original no tiene ningún gráfico: se buscó
`canvas`, `chart` y `svg` en sus 886 líneas y no hay nada. Queda anotado así en la tabla de paridad.

### 4. Sin virtualización, y con el número que dispara revisarlo

El filtro arranca en el mes en curso, así que la lista son decenas de filas. Agregar una dependencia
de virtualizado por un problema que no existe, en un bundle que ya está bajo la lupa, no se justifica.

**El número, medido y no intuido.** La medición se hizo en el Chromium del e2e, sobre el build real:
se clona la fila del libro hasta N, se invalida el layout y se mide un pase de layout completo
(`document.body.offsetHeight` después de tocar el padding del contenedor), tomando el peor de cinco
vueltas.

| Filas | Nodos del DOM | Layout completo |
| ----- | ------------- | --------------- |
| 50    | 1.000         | 4,1 ms          |
| 200   | 4.000         | 16,2 ms         |
| 500   | 10.000        | 41,6 ms         |
| 1.000 | 20.000        | 91,6 ms         |
| 2.000 | 40.000        | 171,7 ms        |
| 5.000 | 100.000       | 488,2 ms        |

Son **20 nodos por fila** y el costo es lineal: **0,09 ms por fila**. El presupuesto de un cuadro a
60 fps son 16 ms, así que un pase de layout completo deja de entrar en un cuadro **a las ~180 filas**.

Dos advertencias sobre ese número, para que no se use por más de lo que dice: el scroll **no** fuerza
un layout completo en cada cuadro (paga paint y composición, que es más barato), así que 180 es el
peor caso y no el típico; y la medición es de un escritorio, no del celular del taller, donde hay que
esperar entre tres y cinco veces más.

Con el filtro por defecto —un mes— el caso real del taller son 20 a 60 filas: entre 2 y 6 ms. Hay dos
órdenes de magnitud de margen. **Se revisa cuando un mes pase de 150 filas, o cuando «Todos los meses»
pase a ser el filtro habitual.** Antes no.

### 5. Lo que no se puede hacer, no se ofrece: deshabilitado con motivo

Un movimiento derivado de un proyecto (un cobro, un gasto del trabajo, el diezmo o el sueldo del
reparto) no se edita ni se borra: sale de la vista, no de una fila. Un `ajuste` ya generado tampoco se
edita: es la constancia de una corrección que ya pasó, y si quedó mal se compensa con otro.

En los dos casos la fila del libro lo anticipa (lleva el nombre del trabajo), y al abrirla aparece una
ficha de sólo lectura con **Editar y Borrar deshabilitados y el motivo escrito**, más el camino:
«Ver el trabajo». Deshabilitado con motivo, no ausente y no habilitado-pero-que-falla. Es el mismo
criterio del aviso de proyecto liquidado del paso 9.

Un movimiento cargado a mano sí se edita y se borra, desde el mismo formulario con el que se cargó.

### 6. El ajuste de COCOS: el usuario escribe el saldo, no la diferencia

Replicado del original, que estaba bien pensado: se escribe el saldo que hay de verdad en la cuenta,
la app calcula la diferencia contra el saldo que tenía calculado y encola el `ajuste` por esa
diferencia. El concepto cambia con el signo, como en el original: «Ajuste de Cocos (intereses o
depósito)» si sube, «(retiro o corrección)» si baja.

La diferencia se muestra **antes** de apretar el botón, no después: es el mismo principio del despiece
del paso 9, donde lo que confirma es ver el número que va a quedar.

Un ajuste que suma entra como `(null → cocos)`, que es «viene de afuera», y para los intereses eso es
literalmente cierto.

### 7. El mensaje del panel del mes: el contenido informativo sí, la arenga no

El original distingue cinco situaciones y a cada una le pone un mensaje. Las cinco situaciones son
información útil; el tono no. Se portaron las cinco con el dato adentro —el hogar en negativo y
cuánto, el mes sin movimiento, el sueldo cubierto, el taller facturó pero al hogar no entró nada, y
cuánto falta para el sueldo— y se dejó afuera «¡Vamos con todo!» y las felicitaciones.

### 8. Lo encolado se escribe en disco antes de salir a la red

`PersistQueryClientProvider` guarda en cada cambio del cache, pero **sin esperar a nadie**: la
escritura a IndexedDB puede quedar a mitad de camino si la app se recarga en ese instante. Y lo que se
pierde ahí son las dos cosas que no se pueden perder: la mutación en cola y la fila optimista que la
acompaña, porque al restaurar `reanudarCola` reenvía la mutación pero **no** vuelve a correr
`onMutate`.

Ahora el `onMutate` de toda mutación encolable termina en `await guardarCacheAhora()`, después de
aplicar la fila optimista. Cuesta milisegundos y garantiza que nada sale a la red antes de estar en
disco. `anotarAviso` y `descartarAviso` devuelven la misma promesa, y los `onError` de la liquidación
la esperan: un rechazo que encontró al usuario no se pierde porque cerró la app.

### 9. Una baja siempre aplica la fila que vuelve, no sólo la optimista

Encontrado ejecutando: editar un movimiento y borrarlo enseguida lo **resucitaba**. Las dos mutaciones
comparten el `scope` y drenan en orden, así que la respuesta de la edición llega después de que la
baja ya sacó la fila del cache, y su `onSuccess` la vuelve a poner. La baja no tenía `onSuccess`, así
que nadie la sacaba de nuevo hasta el delta siguiente.

Es el mismo patrón que `aplicarSiNoEsVieja` del paso 9, del otro lado: ahora la baja aplica en
`onSuccess` la fila que devolvió la base, que viene con `deleted_at` puesto, y `aplicarFilaLocal` la
borra. **La baja de cliente tenía exactamente el mismo agujero** y se arregló igual; la de proyecto ya
lo hacía bien.

### 10. `MN008` se generaliza, no se agrega un código nuevo

En el paso 9 quedó la objeción: `MN008` avisa «la app saca otra cuenta que el servidor», y desde la
migración del acumulado cubre dos causas distintas —el corte de la ganancia no coincide, o los topes
que mandó la app no salen de su propio acumulado— con un texto que hablaba sólo del reparto.

Se generalizó el texto. Un código nuevo pedía una migración en producción para un matiz, y **lo que el
usuario tiene que hacer es idéntico en los dos casos**: actualizar la app y volver a intentar. El
texto ahora nombra las dos causas sin jerga: «Puede ser el corte de la ganancia, o lo que el mes ya
lleva cubierto».

## Objeciones

- **El neto del día cambia de significado con el filtro.** Sin tesoro elegido, una transferencia vale
  cero; con un tesoro elegido, vale lo que ese tesoro perdió o ganó. Las dos lecturas son correctas
  para su contexto, pero es la misma etiqueta diciendo dos cosas. La alternativa (dos números, o
  ninguno) me pareció peor, y queda anotado.
- **La medición de la virtualización es de costo de layout, no de scroll real en un celular.** Mide el
  DOM, que es la parte que escala con N, pero no mide el dispositivo del taller. Es un número
  defendible, no una prueba de campo.
- **La lista de Diezmo reusa el libro y hereda su convención de signos.** Un pago aparece como −$X
  sobre el tesoro DIEZMO y lo generado como +$X. Es consistente con Finanzas, pero es justo la
  convención que la decisión 2 sacó de la tarjeta. Lo compensa la frase de arriba y la etiqueta de
  cada fila («Pago de diezmo», «Diezmo del reparto»), no el signo.
- **El catálogo de clases reemplazó a `LADOS_POR_TIPO`,** que era la restricción
  `movimientos_forma_segun_tipo` escrita en TypeScript. El catálogo es más fuerte en la práctica —una
  clase no puede producir una combinación inválida— pero ya no hay una tabla que se pueda comparar
  contra el `check` de la base. Si algún día los movimientos tienen modelo en `@maun/domain`, ahí va
  con su gemela.
- **Los ocho tipos no cubren todo lo que la base acepta.** `transferencia` entre dos tesoros
  cualesquiera y `ajuste` en cualquier dirección existen en el esquema y el formulario no los ofrece.
  Es deliberado (son los ocho que el dueño usa), pero una fila cargada por fuera —por el script del
  ADR 0017, por ejemplo— puede no tener etiqueta propia en el libro y caer en el genérico
  «Movimiento».

## Alternativas descartadas

- **Colapsar los dos asientos de una transferencia en la interfaz**, en vez de tener la línea en el
  dominio. Funciona, pero pone una regla contable en un componente y se rompe la primera vez que
  alguien filtra antes de agrupar.
- **Corregir la etiqueta del diezmo de «a favor» a «pendiente».** Barato, y deja el problema de fondo:
  seguir pidiendo que el usuario lea un signo.
- **Un SVG accesible de verdad, con foco por barra.** Caro para seis números, y aun así la
  recomendación es tener la tabla al lado.
- **Virtualizar la lista.** Una dependencia más y complejidad, contra un problema que hoy no existe.
- **Un código `MN009` para los topes.** Una migración en producción para un matiz que no cambia lo que
  el usuario hace.

## Consecuencias

- El libro mayor, el Diezmo y el ajuste de Cocos cierran la paridad. Queda afuera la exportación y la
  importación de CSV, sin agendar, y la migración de los datos viejos (ADR 0017).
- `entities/movimiento` es el slice nuevo: el catálogo de clases, las líneas del libro, las tres
  mutaciones y la ficha de sólo lectura. `features/registrar-movimiento` quedó con una sola pantalla.
- `rutaDelProyecto` y las demás rutas se mudaron a `shared/lib/rutas.ts` y `entities/proyecto` las
  re-exporta, por la misma razón que los tesoros y las claves (ADR 0014 y 0015): las necesita otro
  slice de `entities` y un slice no puede importar a otro.
- Cero dependencias nuevas.
