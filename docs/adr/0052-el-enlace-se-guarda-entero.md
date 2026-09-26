# 0052. El enlace se guarda entero, no solo su huella

Estado: aceptada, 2026-09-19. Revierte la decisión «El token se muestra una sola vez» del
[0046](0046-la-vista-del-cliente-una-lista-blanca-en-la-base.md); el resto de ese ADR sigue en pie.

Enmendada el 2026-09-26 por el [0073](0073-la-app-se-llama-numa.md): la app se mudó a
`numa-dashboard.netlify.app`, y los tokens de los enlaces de antes de este ADR que no se rellenaron
quedaron en el `localStorage` del origen viejo, que la app nueva no puede leer. Para esos, la pantalla
de compartir ya no dice que abrir el trabajo desde el aparato donde se creó trae la dirección: dice
que quedó solo en la app de antes, que el enlace del cliente ya no anda, y ofrece crear uno nuevo. El
relleno desde el aparato sigue en el código, para un token guardado en la misma dirección.

## Contexto

El dueño usó la vista del cliente y volvió con esto:

> En desktop VEO correctamente el link generado para el cliente, pero cuando voy al mismo proyecto
> en la app mobile, NO me aparece el link, y la única opción que tengo es regenerarlo. Debería
> también, si el link ya está generado, mostrármelo en ambos lados.

No es una falla: es exactamente lo que el 0046 decidió. `public.enlaces_publicos` guardaba el
sha256 del token y nada más, y el token en claro quedaba en el `localStorage` del aparato donde se
había creado. Desde cualquier otro aparato la pantalla decía que el enlace seguía activo y ofrecía
crear uno nuevo.

El problema es que **la única salida que le quedaba era la peor**. Crear uno nuevo revoca el
anterior, y el anterior es el que su cliente ya tiene pegado en un chat. Para ver una dirección que
él mismo generó, tenía que romperle el enlace a la persona a la que se lo mandó. El 0046 anticipó
la tensión y la resolvió a favor del secreto; el uso real la resolvió al revés.

## Decisión

`public.enlaces_publicos` suma una columna **`token`** con el token en claro, y el token viaja en la
réplica como cualquier otra columna. La pantalla de compartir lee la dirección de la fila, así que
aparece en todos los aparatos del dueño.

`token_hash` **no se va**. Sigue siendo la clave con la que `public.vista_compartida()` resuelve el
token que llega por la URL, sigue teniendo su índice único, y sigue siendo lo único que esa función
necesita. La columna nueva es para el dueño, no para el camino público.

### Dos check constraints, no uno

```sql
check (token is null or token ~ '^[A-Za-z0-9_-]{16,128}$')
check (token is null or encode(sha256(convert_to(token, 'UTF8')), 'hex') = token_hash)
```

El segundo es el que importa: **en esa columna no se puede guardar un token que no sea el de esa
fila**. Un `update` que intentara poner ahí la dirección de otro enlace lo rechaza la base, no la
app. Sin ese check, la columna sería un lugar donde escribir cualquier cosa y después creerla.

Postgres corta en el primer check que no pasa, así que los tests prueban uno por vez: el de forma
con un token cuya huella sí coincide, y el de coincidencia con un token bien formado.

### Los enlaces de antes se rellenan solos

Los que ya existían tienen `token` en null y la base no puede inventarlo: la huella no se da vuelta.
Pero el aparato donde se creó cada uno **todavía lo tiene en `localStorage`**, así que la pantalla de
compartir, cuando encuentra la fila sin dirección y el token guardado de este lado, lo sube con un
`update ... where token is null`.

El `where token is null` no es decoración: hace que la operación sea idempotente y que dos aparatos
rellenando el mismo enlace a la vez no puedan pisarse. El que llega segundo no escribe nada.

Mientras eso no pase, la pantalla en el otro aparato dice la verdad nueva —que la dirección está en
el aparato donde lo creó y que abrirlo una vez desde ahí la trae— en vez de ofrecer solo crear uno
nuevo.

## Lo que se pierde, medido

La propiedad que se cae es esta: **un volcado de la base pasa a contener enlaces que funcionan**.
Antes, con la base entera en la mano, no se podían fabricar. Ahora sí.

Vale la pena decir con precisión cuánto cuesta eso, porque es menos de lo que parece:

- **Quien pueda leer `public.enlaces_publicos` de un household ya puede leer `public.proyectos` del
  mismo household**, y ahí está todo: los costos, el margen, las notas, los teléfonos. El enlace
  muestra un subconjunto estricto de eso. El token en claro no le abre ninguna puerta nueva a ese
  atacante.
- **El rol anónimo no gana nada.** No tiene ni un grant sobre esta tabla, y las dos funciones
  `security definer` que puede ejecutar —`vista_compartida` y `titulo_compartido`— arman su
  respuesta campo por campo y no devuelven esta columna. Hay tests de las dos cosas.
- La RLS por `household_id` es la misma de siempre, y el `grant` es por columna y solo para
  `authenticated`.

Dicho de otra manera: el hash protegía contra un atacante que ya tenía todo lo que el enlace
muestra. Lo que costaba era real y diario; lo que protegía era marginal.

## Alternativas descartadas

- **Cifrar el token con una clave del household.** La clave tendría que vivir en la base (igual que
  plaintext frente a un volcado) o en el bundle del navegador (peor). No agrega nada.
- **Derivar el token de un secreto del household más el id del enlace.** Mismo resultado: quien lee
  la base entera obtiene el secreto y recalcula todos los tokens.
- **Sincronizar el token por fuera de la base.** No hay otro canal entre los aparatos del dueño; la
  réplica es el canal.
- **Dejarlo como estaba y explicarlo mejor.** Es lo que ya hacía la pantalla. El dueño leyó la
  explicación y siguió teniendo un solo camino, que era romperle el enlace al cliente.

## Consecuencias

- La migración es aditiva: la columna nace null y ningún valor existente cambia. Verificado contra
  producción comparando las 596 filas antes y después.
- `EnlaceNuevo` suma `token`, así que crear un enlace manda las dos cosas: la huella y la dirección.
- El `localStorage` (`maun:enlaces`) deja de ser la fuente y queda como puente para los enlaces
  viejos. Se puede borrar el día que no quede ninguno sin `token`.
- El texto de la pantalla de compartir cambió: decía que la dirección quedaba solo en un aparato
  «así que nadie puede fabricarlo de vuelta», y eso ya no es cierto.
- Si algún día hiciera falta volver atrás, el camino es `update enlaces_publicos set token = null`,
  que no rompe ningún enlace: `vista_compartida()` nunca dependió de esta columna.
