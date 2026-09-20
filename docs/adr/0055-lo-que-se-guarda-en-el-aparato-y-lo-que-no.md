# 0055. Lo que se guarda en el aparato, y lo que no

Estado: aceptada, 2026-09-20. Arregla una rotura en producción causada por el
[0053](0053-como-te-paga-cada-trabajo-y-el-qr-del-enlace.md) y el
[0054](0054-el-link-de-cobro-de-mercado-pago.md). Acota el caché persistido del
[0005](0005-offline-first.md) y del [0010](0010-sincronizacion-replica-completa.md).

## Qué pasó

Después del deploy, el dueño abrió «lo que ve el cliente» desde la app y la pantalla se cayó
entera:

```
Unexpected Application Error!
TypeError: Cannot destructure property 'instancia' of 'e.pago' as it is undefined.
```

`comoPagar()` arranca con `const { instancia, formas, monto } = trabajo.pago`. Le llegó un
`TrabajoDelCliente` **sin la clave `pago`**, que es justamente la que agregó el 0053.

## La raíz

No es que la base devolviera mal el payload: `public.vista_del_cliente()` estaba migrada y
`leerVistaDelCliente()` rellena `pago` aunque falte. **El trabajo que reventó no vino de la base:
vino del disco.**

`useVistaDelTrabajo` es un `useQuery` común, y `QueryProvider` persiste el caché de consultas en
IndexedDB. La lista de exclusiones tenía una sola entrada, la vista **del enlace**:

```ts
function esVistaDeUnEnlace(clave) {
  return clave[0] === RAIZ_DE_LA_VISTA && clave[1] === 'enlace';
}
```

La vista **del trabajo** —la misma pantalla, abierta desde adentro de la app— sí se guardaba. En el
teléfono del dueño había un `TrabajoDelCliente` escrito por la versión anterior, de antes de que
existiera `pago`. Al abrir la app, el provider lo rehidrató tal cual, sin pasarlo por el lector, y
se lo entregó a un `comoPagar()` que ya esperaba la forma nueva.

El `buster` existe para exactamente esto y no se movió: quedó en `'2'` desde antes del 0053. Nadie
se acordó, porque nada obliga a acordarse.

Tres cosas fallaron a la vez, y hace falta arreglar las tres: **se guardaba algo que no hacía falta
guardar**, **el lector no protegía el camino del disco**, y **el dominio confiaba en la forma**.

## Decisión

### 1. La vista del cliente no se guarda nunca más, ni la del enlace ni la de adentro de la app

La exclusión pasa a ser por raíz de la clave, no por variante. El payload de la vista del cliente
es un `jsonb` armado a mano en la base, campo por campo (ADR 0046): es lo que **más cambia de forma
entre versiones** de todo lo que la app maneja. Y no tiene ningún valor sin señal: es una
previsualización de lo que ve otra persona, se pide con `staleTime: 0` y ninguna prueba ni ninguna
pantalla la necesita offline.

Con eso, un `TrabajoDelCliente` solo puede nacer en `leerVistaDelCliente()`, que rellena los campos
que falten. Es una invariante, no un parche.

`lo-que-se-guarda.ts` queda como el único lugar donde se decide qué se persiste, con su test.

### 2. El buster sube a `'3'`

Es lo que destraba los teléfonos que ya tienen el caché podrido: sin esto, el blob viejo se
rehidrata igual, porque `shouldDehydrateQuery` gobierna lo que se **escribe**, no lo que se **lee**.

### 3. El dominio deja de confiar en la forma

`comoPagar()` devuelve `null` si le falta `pago` o `cobro`, en vez de tirar. No es que se espere
que pase: es que **cuando pase, la pantalla tiene que degradar y no caerse**. Una pantalla sin el
bloque de «Cómo pagar» sigue mostrándole al cliente el precio, la etapa y las fotos; una pantalla
que tira deja al dueño mirando un volcado de pila en el celular.

### 4. Una fila guardada puede no tener las columnas nuevas

`cobroDeLosAjustes()` leía `ajustes.cobro_link` directo. La réplica **sí** se persiste y **sí** hace
falta sin señal, así que ahí no se puede resolver no guardando: una fila escrita por la versión
anterior no tiene la columna que se agregó después. Con `link: undefined`, guardar los ajustes
reventaba en `normalizarLinkDeCobro(undefined)` al hacer `.trim()`.

El parámetro pasa a decir la verdad —`AjustesGuardados`, con `cobro_link` opcional— así el `??` es
necesario y el tipo documenta de dónde viene la fila. `formasDelTrabajo()` ya lo hacía bien con
`Partial<Pick<Proyecto, ColumnaDeFormaDeCobro>>`; esto lo alinea.

## La regla que queda

**Todo lo que se persiste es dato ajeno, igual que una respuesta del servidor.** Lo escribió otra
versión del programa y hay que leerlo a la defensiva:

- Un payload armado a mano —la vista del cliente— **no se persiste**. Su forma cambia con cada PR.
- Una fila de la réplica **se persiste** porque hace falta sin señal, y quien la lee **tolera que le
  falte cualquier columna agregada después**: `?? ''`, `vacioEsNulo(fila?.x)` o un tipo con la
  columna opcional.
- Si aun así cambia la forma de algo persistido de manera incompatible, **sube `VERSION_CACHE`**.
  Es la última red, no la primera.

## Consecuencias

- **Abrir «lo que ve el cliente» sin señal ya no muestra lo último visto**: muestra «sin señal». Era
  una previsualización de una página que el cliente abre por internet; sin señal no hay nada que
  previsualizar de verdad.
- **La primera vez que cada aparato abra esta versión, el caché se tira entero y la réplica se
  vuelve a bajar.** Pasa estando online, porque la actualización llega por el service worker
  mientras hay señal. Es una sincronización completa, no incremental.
- **Nadie tiene que acordarse de nada para la vista del cliente.** Para la réplica sí, y por eso la
  regla está escrita acá y en `apps/web/CLAUDE.md`.

## Objeciones

1. **Bajé un incidente a tres arreglos y ninguno es una alarma.** Nada avisa si mañana vuelve a
   pasar con otra clave persistida: no hay reporte de errores del cliente, así que el aviso siguió
   siendo el dueño mirando la pantalla rota. Un `ErrorBoundary` que mande el error a algún lado es
   otro PR, y es el que de verdad cierra esto.
2. **El `buster` a mano sigue siendo a mano.** Pensé en derivarlo de la versión de las novedades
   para que suba solo en cada release, pero eso tira la réplica entera en cada deploy y obliga a una
   sincronización completa de 9.823 proyectos y 6.025 pagos cada vez, a veces con mala señal. Preferí
   lectores tolerantes y el buster como excepción. Queda dicho que la parte frágil es esa.
3. **No pude reproducirlo contra el teléfono del dueño.** Lo reproduje en un test, quitándole la
   clave `pago` a un trabajo, que es exactamente lo que el disco le entregó. Que el teléfono quede
   arreglado se confirma abriéndolo.
