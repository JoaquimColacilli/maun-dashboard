# 0053. Cómo te paga cada trabajo, y el QR que lleva a la página del cliente

Estado: aceptada, 2026-09-20. Corrige al [0051](0051-cobrar-con-mercado-pago.md) (le faltaba el
costo del QR de cobro, y mezclaba «transferencia» con «cobro»), cierra la objeción que el
[0048](0048-los-datos-para-transferir.md) dejó abierta sobre el importe de la seña, y corrige al
[0043](0043-las-opciones-de-presupuesto-y-la-sena.md) en «la seña no tiene gemela en SQL»: ahora la
tiene, porque la vista pública la necesita. Amplía la lista blanca del
[0046](0046-la-vista-del-cliente-una-lista-blanca-en-la-base.md). Corregida el 2026-09-24 por el
[0067](0067-la-vista-antes-de-aprobar.md): antes de aprobar no hay «Te falta pagar» ni se pide el
saldo (ver la corrección en «Lo que el cliente ve»).

## Contexto

El dueño lo planteó así:

> Mi hermano va a la casa del cliente, termina de instalar y le tiene que cobrar. Hay dos formas:
> transferencia, sin comisión, y efectivo. Lo principal es cómo llega el cliente a pagar: con un QR
> o con el link, entra a su página, ve cuánto le toca pagar, copia el alias, lo pega en la app de su
> banco, escribe el monto y transfiere. El link ya existe y se manda por WhatsApp. Falta el QR, para
> cuando están cara a cara. Y cada pago se configura por trabajo: la seña por transferencia y el
> saldo en efectivo, por ejemplo.

Tres cosas que van juntas, y una pregunta de fondo que el 0051 había dejado a medias: **¿el QR es un
QR de Mercado Pago?**

## Lo primero: por qué el QR no es de Mercado Pago

No son dos formas de lo mismo. Son dos instrumentos distintos que se parecen en la pantalla:

- **Una transferencia** la arranca el que paga, desde su banco o su billetera, contra un alias, un
  CBU o un CVU. **No le cuesta nada al que la recibe**, venga del banco que venga. Es lo que el
  taller viene usando.
- **Un cobro de Mercado Pago** —su link de pago o su QR de cobro— lo arranca el comercio y **le
  cobra comisión al taller**, medido en el 0051: el link, entre 1,56 % y 6,60 % + IVA en Buenos
  Aires, **para todos los medios, dinero en cuenta de Mercado Pago incluido**; el QR de cobro,
  0,80 % + IVA con dinero en cuenta y 1,42 % + IVA si el cliente paga desde su banco con débito.

**Que el cliente escriba el monto no cambia nada.** El costo no depende de quién pone el número:
depende de que la operación entre por el esquema de cobro. El arancel del QR interoperable se lo
fija el BCRA al comercio entre 0,6 % y 0,8 % (t.o. de Transferencias, 6.3.1.2). La propia app de
Mercado Pago separa las dos cosas: en «Solicitar dinero» ofrece armar un link de pago **o**
compartir el alias y el CVU.

Y lo que no existe, que es lo que haría falta para un atajo:

- **No hay un estándar que abra la app de cualquier banco en «Transferir a este alias».** Cada banco
  y cada billetera tiene su app y su esquema de URL; no hay un `intent` común que se pueda meter en
  un QR ni en un link. Esto es un negativo: no se puede citar la norma que lo prohíbe, se puede
  mostrar que la única iniciación estandarizada que el BCRA reglamenta es la del pago con
  transferencia —con su aceptador y su arancel— y la transferencia pull.
- **El QR interoperable del Banco Central es de cobro, para comercios.** El t.o. lo dice del lado de
  quién lo recibe: un administrador de esquema no puede «habilitar a un aceptador a recibir pagos
  con transferencia iniciados con códigos QR» sin garantizar que todas las billeteras lo lean
  (1.5.5.11). Aceptador y comercio: no es una etiqueta para un alias.
- **La transferencia «pull» —pedirle plata a otra cuenta— hoy es solo entre cuentas del mismo
  titular.** La única modalidad reglamentada es 3.4.3, «Transferencias inmediatas pull **entre
  cuentas de un mismo titular**», y el consentimiento exige «total certeza de que las cuentas
  debitada y acreditada son del mismo titular» (3.4.3.1). El taller no puede pedirle plata a la
  cuenta de su cliente.

**Por eso el QR de este PR lleva a la página del cliente y nada más.** Es exactamente la misma
dirección que copia «Copiar», puesta en un código. La página muestra el alias; el cliente transfiere
desde su app. Este PR no usa ninguna API de Mercado Pago, ni su link de pago, ni su QR de cobro.

## Decisión

### Las formas de cobro son del trabajo y de la instancia de pago, no del taller

`public.proyectos` suma dos columnas: `cobro_sena` y `cobro_saldo`, las dos
`public.forma_de_cobro[]` y las dos **nullable**. El enum tiene dos valores, `transferencia` y
`efectivo`, que son las dos formas que este taller usa de verdad.

Son dos columnas y no una porque el caso que motivó esto es justamente que difieran: la seña por
transferencia cuando aprueba, el saldo en efectivo cuando termina de instalar.

**Null no es vacío: null es «este trabajo no lo configuró».** Los 9.183 trabajos que ya existen
nacen en null y nadie los toca. El valor por defecto se calcula al leer, y es el que tiene sentido:
las dos formas, salvo que el taller no tenga ni alias ni CBU cargados en Ajustes, y entonces solo
efectivo. Ofrecer transferencia sin adónde transferir sería mandarle al cliente una pantalla vacía.

El `check` enumera las tres combinaciones legales en vez de contar elementos:

```sql
check (coalesce(cobro_sena is null or cobro_sena in (
  array['transferencia']::public.forma_de_cobro[],
  array['efectivo']::public.forma_de_cobro[],
  array['transferencia', 'efectivo']::public.forma_de_cobro[]
), false))
```

Así prohíbe de una el arreglo vacío —un pago sin ninguna forma—, los repetidos, el orden al revés y
un null adentro del arreglo. El `coalesce` no es decoración: comparar un arreglo que tiene un null
adentro devuelve null, y un check que evalúa a null pasa; sin él, `{null}` entraría.

**El grant es solo de `update`, como los costos estimados y las marcas de la agenda** (ADR 0045).
`guardar_proyecto` no las escribe, así que guardar el trabajo entero desde el formulario grande no
pisa lo que se configuró en la pantalla de compartir, ni al revés. Una mutación propia, con su
`scope: COLA_DE_SALIDA`: sin señal se anota y sale sola.

### Lo que el cliente ve es cuánto es cada pago, no solo cómo se paga

La página del cliente tenía el bloque de los datos para transferir y le faltaba lo primero que él
pregunta: cuánto. Ahora, arriba de la forma de pago, va el importe:

- **el pago que toca ahora, grande**: la seña que falta —con todo lo cobrado ya descontado, la
  visita del relevamiento incluida, porque es un pago más del trabajo (ADR 0043)— o el saldo, con
  su forma de pago y su botón para copiar el monto;
- **si viene otro después, más chico**: «Después, el saldo: $ 800.000, en efectivo»;
- **lo que le falta pagar en total sigue arriba**, con su etiqueta de siempre, «Te falta pagar».
  Son dos números distintos y por eso llevan dos nombres distintos: «Ahora, la seña» y «Te falta
  pagar».

> **Corregido el 2026-09-24 por el [ADR 0067](0067-la-vista-antes-de-aprobar.md).** Antes de aprobar
> no se debe nada, así que no hay «Te falta pagar»: arriba van el presupuesto, la seña para arrancar y
> lo pagado, que queda a cuenta de la seña, y lo que le falta de ella es el mismo importe de «Ahora, la
> seña». Tampoco se pide el saldo antes de aprobar: con la seña ya cubierta, `pago` viaja vacío.

**El saldo que se anticipa no es «lo que falta menos la seña que falta»: es el presupuesto menos la
seña entera.** Con parte de la seña ya cobrada las dos cuentas no dan lo mismo, y la que el cliente
va a tener que pagar después es la segunda. Hay un caso de prueba para eso, en los dos lados.

**No se agregó ni una columna para esto.** Los dos importes salen de lo que ya está guardado: el
presupuesto (`proyectos.presupuesto_centavos`, o la opción aprobada), los pagos
(`pagos.monto_centavos`) y el porcentaje de seña (`proyectos.sena_bp` pisando a `ajustes.sena_bp`).

**Y eso cierra la objeción que dejó abierta el 0048**, que decía:

> El PR pedía que, aprobado y sin pagos, la página diga _cuánto_ es la seña. No se puede sin
> mandarle `sena_bp` al cliente, y el mismo PR pide que no se sume nada más a la lista blanca.

La salida no era mandar el porcentaje: era mandar el peso. **`sena_bp` sigue sin viajar** —es
política comercial del taller— y lo que viaja es el importe que sale de aplicarlo, calculado en la
base. El test de la lista blanca sigue clasificándolo como «no viaja».

### El importe se copia listo para pegar en el banco

`montoParaPegar` devuelve el número pelado: `1500000`, sin signo pesos y sin puntos de miles, y con
coma decimal solo cuando hay centavos (`1500000,50`). Lo que se ve es `$ 1.500.000`, que es como se
lee; lo que se copia es lo que el campo de un banco acepta. Es el mismo criterio del CBU, que se
muestra agrupado y se copia pelado (ADR 0048).

### Lo que no se ofrece para un pago, no viaja

La función pública devuelve una clave nueva, `pago`, con la instancia que toca, sus formas, su
importe y —adentro— el pago que sigue. Y **los cuatro datos de la cuenta viajan solo si el pago que
toca AHORA se ofrece por transferencia**: si la seña es en efectivo, el alias no sale de la base. No
es la pantalla la que esconde: es la base la que no manda, que es la regla del 0046.

El pago que sigue dice cómo se va a pagar, no adónde: nombra la forma, no la cuenta.

La clave `cobro` no desaparece cuando no corresponde, viaja con sus cuatro campos en null. La forma
de la respuesta no depende de la configuración, y lo que no se muestra sigue sin mandarse.

### Dos reglas nuevas con gemela en SQL, y el comparador que las ata

`public.vista_del_cliente()` tiene que decidir dos cosas que la app también decide: qué formas valen
para una instancia y qué pagos le faltan al cliente. Eso son dos implementaciones de lo mismo, que
es exactamente lo que el [0011](0011-dominio-cascada-estados-y-cobro.md) dice que no puede divergir
en silencio. La respuesta del repo es la de siempre: **gemela en SQL y comparador**.

- `private.formas_de_cobro(guardado, hay_como_transferir)` ↔ `formasDeCobro()` de `@maun/domain`.
- `private.pagos_por_delante(precio, pagado, sena_bp)` ↔ `pagosPorDelante()` de `@maun/domain`.

`scripts/comparacion.ts` las corre contra la base con las mismas veintiuna entradas y ocho
combinaciones, y `dominio-vs-sql.test.ts` lo repite contra la base ya migrada. **El ADR 0043 decía
que la seña "no tiene gemela en SQL y no la necesita"; eso valía mientras nada en la base la
consumiera.** La vista pública la consume, así que ahora la tiene, con la misma cuenta que el diezmo
de `private.cascada()`: medio punto para redondear y división entera.

Las dos funciones viven en `private`, que la API no expone, con `grant execute` a `authenticated`
—`vista_del_cliente()` es security invoker y sin ese grant el dueño no podría abrir la vista desde su
propia app— y sin nada para `anon`, como `private.ruta_del_archivo()`. `00_estructura.sql` sigue
exigiendo que `anon` ejecute exactamente dos funciones y ninguna más.

### El QR es el mismo enlace, dibujado

- **Dónde está**: en «Compartir con el cliente», al lado de «Mandárselo por WhatsApp», y en la vista
  del cliente que el dueño abre desde la app, para mostrarla en la mano. En esa segunda pantalla el
  botón vive **afuera** del componente compartido: la vista del cliente sigue siendo idéntica por las
  dos entradas, que es la regla del 0046.
- **Dónde no está**: en la página del cliente no hay ningún QR. El cliente ya está ahí, y un QR con
  un alias adentro no lo entiende la app de ningún banco.
- **Qué lleva**: exactamente lo que copia «Copiar». Un test lo **decodifica** con un lector de
  verdad y lo compara contra `enlaceDelCliente(token)`.
- **Cuándo aparece**: solo si el trabajo tiene un enlace vivo y su dirección está de este lado —la
  fila con `token`, o el puente de `localStorage` para los enlaces de antes (ADR 0052)—. Si no está,
  la pantalla dice lo que ya decía.
- **Sin señal anda igual**: se dibuja en el teléfono del dueño con la dirección que ya tiene. El que
  necesita señal es el celular del cliente.
- **Darlo de baja lo mata**, porque es el mismo enlace. La pantalla lo dice en la línea que ya
  explica qué ve el cliente.

**Negro sobre blanco en los dos temas.** El sistema de diseño suma dos tokens que el bloque oscuro
no redefine, `--color-ink-fijo` y `--color-paper-fijo`. Son los únicos dos colores de la app que no
cambian con el tema, y el motivo es que a ese dibujo lo lee una cámara, no una persona: un QR
invertido no escanea en muchos lectores.

**La pantalla no se apaga mientras el código está a la vista** (Screen Wake Lock). El cliente tarda
en sacar el teléfono, y el dueño está sosteniendo el suyo con las dos manos ocupadas. Si el navegador
no tiene la API —Firefox de Android, iPhone antes de 16.4— no pasa nada: el hook pregunta por la
propiedad y se calla.

**Lo que dibuja el código se baja recién al abrir esa pantalla.** `uqr` (MIT, sin dependencias) entra
por un `import()` dinámico y queda fuera del chunk de vendor: hay una excepción explícita en
`manualChunks`. Sin esa excepción, la regla «todo lo de node_modules va al vendor» lo habría metido
en el arranque de la app.

### Al anotar la seña, la forma arranca en la configurada

La pantalla de aprobar es donde el dueño carga la seña con su forma de pago. Si el trabajo tiene una
sola forma configurada para la seña, el selector arranca ahí; si tiene las dos, arranca como hasta
ahora y la elige él. Lo que el trabajo ya tenía guardado en `forma_pago` manda sobre las dos cosas:
no se le pisa una decisión anterior.

## Alternativas descartadas

- **Un QR de cobro de Mercado Pago.** Es lo que el dueño imaginaba y es lo que le cuesta plata:
  0,80 % + IVA en el mejor caso y 1,42 % + IVA cuando el cliente paga desde su banco. Sobre una seña
  de $ 1.500.000, entre $ 14.520 y $ 25.773 por cobro, para ahorrarle al cliente copiar un alias.
- **Un link que abra la app del banco con el alias cargado.** No existe un esquema común. Se podría
  detectar la billetera y armar el deep link de cada una, y sería una lista que se rompe sola cada
  vez que una app cambia su esquema, sin forma de enterarse.
- **Una sola columna de forma de cobro para el trabajo entero.** Es lo que ya existe en
  `proyectos.forma_pago`, y no alcanza: el caso del dueño es que la seña y el saldo difieran. Esa
  columna se queda como está —es la forma acordada del trabajo, informativa, y tiene sus valores
  `cuotas` y `mixto`— y no se toca.
- **Guardar las formas como cuatro booleanos.** Cuatro columnas para dos conceptos, y el par
  «configurado / sin configurar» habría que sostenerlo con un check entre columnas. El arreglo de
  enum dice lo que es: un conjunto.
- **Mandarle `sena_bp` al cliente y que la página calcule.** Es el porcentaje del taller, que es
  política comercial. Lo que el cliente necesita es el peso.
- **Que la vista pública devuelva solo el pago de ahora y que la página deduzca el siguiente.**
  Necesitaría el porcentaje para eso, o una resta que da mal cuando hay parte de la seña cobrada. La
  base ya tiene los dos números.
- **Dibujar el QR en un `<canvas>`.** Un SVG escala sin pixelarse, se imprime bien, toma los tokens
  del tema por CSS y se puede leer desde un test sin rasterizar nada de más.

## Consecuencias

- **La lista blanca crece con dos columnas y una clave.** `25_vista_del_cliente.sql` clasifica
  `cobro_sena` y `cobro_saldo` como «viajan», con una aclaración: no viaja su valor crudo, viaja el
  de la instancia que toca, pasado por `private.formas_de_cobro()`. Una columna nueva en `proyectos`
  o en `ajustes` sigue rompiendo ese test hasta que alguien la clasifique.
- **La palabra «arreglar» se fue de la página del cliente.** «El saldo lo arreglás con el taller» se
  lee como reparar. Ahora, cuando no hay ninguna forma concreta que mostrar, dice «Para pagar,
  escribile al taller y lo coordinan entre ustedes», y hay un test que recorre los estados y falla
  si aparece «arregl» en cualquier parte.
- **El bloque de la vista del cliente se llama «Cómo pagar», no «Cómo transferir».** Un trabajo que
  se cobra en efectivo también tiene algo que decir ahí. El e2e que lo buscaba por nombre cambió con
  él.
- **Dos migraciones en el mismo PR y las dos aditivas.** La primera agrega el enum, las columnas y
  las funciones; la segunda solo reemplaza funciones. Verificado contra producción, en rollback: las
  9.183 filas de `proyectos`, las 5.637 de `pagos` y las 4 de `ajustes` quedaron idénticas, columna
  por columna, y las dos nuevas nacieron en null en todas.
- **Los permisos del rol anónimo no se movieron.** Antes y después: usage sobre `auth`, `public` y
  `storage`, `execute` sobre `vista_compartida(text)` y `titulo_compartido(text)`, y ni un grant
  sobre ninguna tabla ni columna.
- **El teléfono del dueño sigue sincronizando con la app vieja.** Las columnas nuevas viajan en
  `to_jsonb(t)` y `leerLote` solo exige id, version y `deleted_at`: un bundle viejo las ignora. La
  clave `pago` de la vista pública también, porque el lector tolera que falte.
- **El cuerpo de una función es texto literal en la base, con sus finales de línea.** La primera
  migración quedó guardada con CRLF y Postgres se lo guardó adentro de `pg_proc.prosrc`, así que
  `supabase/esquema.sql` decía LF y la base decía CRLF: `tests/esquema.test.ts` fallaba en cada
  clon, con un diff que a la vista es idéntico. Lo arregla una tercera migración que vuelve a crear
  la función, sin cambiarle una letra, desde un archivo con LF. Vale para cualquier migración que
  se escriba desde Windows.
- **Un enlace sin dirección de este lado no tiene QR.** Es la misma limitación que el 0052 dejó para
  los enlaces creados antes, y desaparece con ellos.

## Objeción que queda anotada

**La página del cliente le dice un importe y no puede prometer que sea el de hoy.** Los dos números
que ahora muestra —lo que toca y lo que viene después— se calculan cuando la página se abre, contra
lo que el dueño anotó hasta ese momento. Si el cliente transfiere y el dueño todavía no lo anotó, la
página va a seguir diciendo el importe viejo hasta que lo anote; eso ya pasaba con «Te falta pagar»,
pero un número al lado de un botón de copiar se lee como una instrucción, no como un estado. La
página lo dice —«Los pagos aparecen acá cuando el taller los anota, no en el momento en que
transferís»—, y esa línea ahora carga más peso que antes. Si algún día molesta, lo que corresponde no
es sacar el importe: es que el dueño se entere solo de que entró la transferencia, y eso es el nivel
3 del 0051, con todo lo que ese ADR dice que cuesta.

## Fuentes

- Costos del QR de cobro de Mercado Pago, Buenos Aires:
  <https://www.mercadopago.com.ar/ayuda/cuanto-cuesta-recibir-pagos-con-QR_3605> (consultada
  2026-09-20; pie: «Costos vigentes a partir del 6 de marzo de 2026»; «Estos costos no incluyen IVA
  o retenciones»).
- Costos del link de pago, Buenos Aires, «todos los medios de pago (… dinero en Mercado Pago)»:
  <https://www.mercadopago.com.ar/ayuda/cuanto-cuesta-recibir-pagos_33392> (consultada 2026-09-20).
- Transferencias sin costo a un CBU o a un CVU: <https://www.mercadopago.com.ar/ayuda/26748>.
- BCRA, t.o. «Sistema Nacional de Pagos – Transferencias – Normas complementarias», última
  comunicación incorporada «A» 8477, t.o. al 08/09/2026:
  <https://www.bcra.gob.ar/archivos/Pdfs/Texord/t-snp-tr-nc.pdf>. De ahí salen el arancel del pago
  con transferencia (6.3.1.2, «0,6 % a 0,8 %» según categoría de comercio), el QR interoperable como
  cosa del aceptador (1.5.5.11) y la transferencia pull entre cuentas del mismo titular (3.4, y
  3.4.3 «Transferencias inmediatas pull entre cuentas de un mismo titular», con el «total certeza de
  que las cuentas debitada y acreditada son del mismo titular» de 3.4.3.1).
