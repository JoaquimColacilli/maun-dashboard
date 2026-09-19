# 0048. Los datos para transferir viven en los ajustes del taller y viajan en la lista blanca

Estado: aceptada, 2026-09-19. Amplía la lista blanca del [0046](0046-la-vista-del-cliente-una-lista-blanca-en-la-base.md).

## Contexto

El dueño miró la vista del cliente del PR 28 y pidió una sola cosa nueva:

> Los datos para la transferencia (con un botón de copiar texto), esa es buena.

Hoy la página le dice al cliente cuánto falta pagar y, abajo, «El saldo se abona al taller cuando
ustedes lo arreglen. Esta página no cobra nada.» El cliente lee eso, quiere pagar, y tiene que
salir a buscar el alias por WhatsApp. Es el único momento de la pantalla donde el cliente quiere
hacer algo y la pantalla no lo deja.

## Decisión

### Cuatro columnas de texto en `public.ajustes`, no una tabla

`cobro_alias`, `cobro_cbu`, `cobro_titular` y `cobro_cuit`, todas `text not null default ''`. Son
del taller, no del trabajo: se cargan una vez, en Ajustes, y valen para todos los enlaces. Van en
la tabla que ya tiene el porcentaje de la seña, que es donde el dueño ya busca los parámetros del
taller. El default vacío hace la migración aditiva: el `alter` no reescribe la fila que hay.

### La forma la controla la base; los dígitos verificadores, el dominio

El `check` de cada columna controla la forma y nada más: 22 dígitos para el CBU, el largo y los
caracteres del BCRA para el alias, el formato con guiones del CUIT. Los dos dígitos verificadores
del CBU los revisa `revisarCbu` en `@maun/domain`, antes de guardar. Es el mismo reparto que el
CUIT de un cliente (ADR 0014), y por el mismo motivo: un rechazo por `check` es definitivo y tapa
la cola, así que el formulario nunca puede mandar algo que el `check` rechace.

**Un CBU con el verificador mal frena el formulario, a diferencia del CUIT, que solo avisa.** Es
deliberado: un CUIT mal copiado es un dato de contacto equivocado, un CBU mal copiado es plata del
cliente a la cuenta de otro. El formulario es más estricto que la base, que es el lado seguro.

### Lo que el BCRA no escribe, avisa en vez de frenar

La norma vigente (texto ordenado SNP, Com. «A» 8114) enumera carácter por carácter: 6 a 20,
letras, números, punto y guion medio, indistinto entre mayúsculas y minúsculas. **El guion bajo no
está**, aunque media internet diga que sí. Eso se frena. Lo que la norma **no** dice —si un alias
puede empezar con un punto, si admite dos separadores seguidos— sale como aviso: frenar por una
regla que no está escrita es rechazar un alias que la cámara aceptó.

### El bloque se muestra siempre, salvo cuando ya está todo pagado

No cuelga de que haya saldo. Antes de aprobar todavía no hay presupuesto ni saldo, y es justo
cuando el cliente manda la seña. Se va cuando `saldado`, que es cuando ya no hay nada que
transferir. El dato vacío no aparece, y con el alias y el CBU los dos vacíos no aparece el bloque:
con el titular y el CUIT solos no se transfiere.

### El botón de copiar es un atajo, y nunca miente

Tres caminos, en orden: `navigator.clipboard.writeText`; si falla, un nodo fantasma con
`document.execCommand('copy')`; si también falla, se selecciona el dato en la pantalla y se explica
cómo copiarlo. El dato está siempre a la vista y se puede marcar a mano: el botón no es el único
camino.

**«Copiado» sale solo si se copió.** `execCommand` devuelve `true` sin copiar en dos casos que el
fuente de Blink documenta: cuando un handler hizo `preventDefault` y cuando la selección quedó
vacía. Por eso el camino de atrás no le cree a ese `true`: escribe el texto desde el evento `copy`
del nodo fantasma y solo cuenta como copiado si ese handler corrió. El fantasma lleva
`user-select: text` propio, porque el ancestro puede tener `none`.

## Alternativas descartadas

- **Un dato por trabajo.** Es el mismo alias siempre. Cuatro columnas por proyecto para repetir el
  mismo valor, y cuatro lugares donde equivocarse.
- **Validar el alias contra la cámara.** La unicidad y la lista de alias prohibidos las resuelve la
  CEC-BV, no una regex. Cualquier validación local es necesaria y nunca suficiente.
- **Guardar el CBU agrupado, como se muestra.** Se guarda pelado y se agrupa al mostrarlo: lo que
  el cliente pega en su banco son 22 dígitos.
- **Un botón de copiar sin caminos de atrás.** `navigator.clipboard` no existe en http, y en las
  WebView de Android anteriores a Chromium 118 rechaza con `NotAllowedError`. El cliente puede
  abrir el enlace desde el navegador interno de otra app.

## Consecuencias

- La lista blanca de la vista del cliente pasa a incluir una tabla más, así que
  `25_vista_del_cliente.sql` clasifica ahora **toda columna de `ajustes`**, no solo las de
  `proyectos`. Una columna nueva en cualquiera de las dos rompe el test hasta que alguien decida.
- Los cuatro campos son lo **único** que se suma a lo que el cliente ve desde el ADR 0046.
- **Objeción anotada.** El PR pedía que, aprobado y sin pagos, la página diga _cuánto_ es la seña.
  No se puede sin mandarle `sena_bp` al cliente, y el mismo PR pide que no se sume nada más a la
  lista blanca. Se resolvió a favor de no ampliarla: la página dice que lo primero es la seña y que
  aparece cuando el taller la anota, sin el número. Si el dueño prefiere el importe, es una línea
  en la lista blanca y una decisión suya, no nuestra: el porcentaje de seña es política comercial
  del taller.
- Los números de los tests son sintéticos, construidos con el algoritmo. No son la cuenta de nadie.

## Fuentes

- BCRA, texto ordenado «SNP – Servicios de Pago», t.o. 18/08/2025 (Secc. 1 CBU, 2 CVU, 3 alias):
  <https://www.bcra.gob.ar/Pdfs/Texord/t-snp-spd.pdf>. De ahí salen «clave 10 con el ponderador
  9713», que la CVU tiene el mismo formato que la CBU y se valida igual, el prefijo `000` de la
  CVU, y la conformación del alias (Com. «A» 8114, vigencia 09/10/2024).
- BCRA, Com. «A» 2741 (27/07/1998), Secc. III pto. 1.3.2: el ejemplo numérico oficial
  (`0110138202011100377664`), que es lo que confirma la expansión de pesos `7139713` y
  `3971397139713`. El BCRA nunca publica esa tabla de pesos: dice el ponderador y nada más.
  <https://www.bcra.gob.ar/archivos/Pdfs/comytexord/a2741.pdf>
- Chromium, `clipboard_commands.cc` y `clipboard_promise.cc`: los dos `return true` de
  `ExecuteCopy` sin copiar, y el `RejectIfDocumentNotFocused` que solo existe en Chromium.
- Android WebView, `aw_permission_manager.cc`: `CLIPBOARD_SANITIZED_WRITE` pasó de no implementado
  a concedido en Chromium 118 (octubre de 2023). Por debajo de esa versión la API nueva falla.
