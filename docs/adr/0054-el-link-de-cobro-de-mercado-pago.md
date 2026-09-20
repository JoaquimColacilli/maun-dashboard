# 0054. El link de cobro de Mercado Pago, pegado a mano en los ajustes

Estado: aceptada, 2026-09-20. Revierte la decisión de no ofrecer Mercado Pago que tomaron el
[0051](0051-cobrar-con-mercado-pago.md) y el [0053](0053-como-te-paga-cada-trabajo-y-el-qr-del-enlace.md),
por pedido explícito del dueño y con el costo sobre la mesa. Amplía la lista blanca del
[0046](0046-la-vista-del-cliente-una-lista-blanca-en-la-base.md).

## Contexto

El PR del 0053 entregó un QR que lleva a la página del cliente. El dueño lo aceptó y pidió otra
cosa, encima:

> Si está marcado TRANSFERENCIA, y mi hermano configuró CVU o ALIAS en ajustes, un QR que te lleve
> al link de transferencia de Mercado Pago a mi hermano. Y el link también, por las dudas además
> del QR, con el monto 0 a rellenar, y arriba, en la vista de cliente, qué monto tiene que cargar.

Y marcó, sobre una captura de la página del cliente, que el bloque de alias, CVU, titular y CUIT
con sus botones de copiar «no va más».

El 0051 y el 0053 habían decidido lo contrario: nada de Mercado Pago, porque cobra comisión. El
dueño lo sabe —está escrito en el informe de ese PR, con los porcentajes— y lo pidió igual. Esa es
su decisión: es su plata. Lo que queda por resolver acá es **cómo hacerlo de manera que funcione de
verdad**, porque lo que pidió, tal como lo pidió, no existe.

## Lo que no existe

Verificado el 2026-09-20 contra las páginas de Mercado Pago y del BCRA:

- **No hay ningún link ni ningún QR que abra una billetera o una app de banco en «Transferir a este
  alias»**, con el alias ya puesto. No es una limitación de Mercado Pago: no hay un estándar, ni
  público ni privado, que lo permita. El esquema `mercadopago://` que aparece en la documentación de
  integración es para volver de un checkout, no para arrancar una transferencia.
- **El QR interoperable del BCRA sí lleva el CVU adentro** —es el campo 51 del payload EMVCo de
  Transferencias 3.0— pero no lo puede armar cualquiera: lo emite un PSP conectado a uno de los tres
  administradores de esquema (COELSA, Red Link o Prisma), y lo que viaja no es una transferencia
  sino un **pago con transferencia**, que le cobra comisión al que recibe.
- **El «link de Mercado Pago» que el dueño tiene en la cabeza es el link de pago o el QR de cobro**,
  los dos productos de cobro de Mercado Pago. Los dos se generan desde la app, sin API y sin cuenta
  de desarrollador. Los dos cobran comisión.

O sea: se puede hacer lo que pidió, y se puede hacer sin ninguna API, pero el artefacto es un cobro
y no una transferencia, y sale plata.

## Lo que cuesta, con los números de hoy

De la página de «Cobrar con código QR» de Mercado Pago Argentina, consultada el 2026-09-20:

| Con qué paga el cliente                          | Comisión al taller |
| ------------------------------------------------ | ------------------ |
| Dinero en Mercado Pago, otras billeteras, bancos | 0,80 % + IVA       |
| Débito, al instante                              | 1,35 % + IVA       |
| Débito, a 2 días                                 | 0,85 % + IVA       |
| Mercado Crédito                                  | 1,35 % + IVA       |
| Crédito, al instante                             | 5,99 % + IVA       |
| Crédito, a 10 días                               | 4,19 % + IVA       |

El 0051 tiene otra tabla, con 1,42 % de débito al instante en vez de 1,35 %, y 6,29 % de crédito en
vez de 5,99 %. No es un error de ninguno de los dos: la propia página avisa que «los costos pueden
variar de acuerdo a los impuestos provinciales», y la del 0051 se leyó con los valores de Buenos
Aires. El número que importa acá, el 0,80 % de los pagos con transferencia, es el mismo en las dos,
y es el techo que fija el Banco Central.

Sobre una seña de $450.000 pagada desde una billetera, el 0,80 % + IVA son unos $4.356. Transferirle
al alias sigue costando cero. Esa comparación es la que hay que tener a la vista, y por eso está
escrita en Ajustes, al lado del campo.

El tope del 0,80 % para los pagos con transferencia no lo pone Mercado Pago: lo pone el Banco
Central, en el punto 6.3.1.2 del texto ordenado de Transferencias, que fija el arancel al comercio
entre 0,6 % y 0,8 %.

## Decisión

**Un campo nuevo en Ajustes, `ajustes.cobro_link`, donde el dueño pega su propio link de Mercado
Pago.** No se deriva de nada: se pega.

Cuando está cargado y el pago que le toca al cliente se ofrece por transferencia, su página muestra
el importe arriba, en grande y con su botón de copiar, y debajo el link como **código QR** y como
**botón**. El alias, el CVU, el titular y el CUIT dejan de mostrarse, que es lo que el dueño marcó.
Cuando no está cargado, la página es exactamente la de antes.

### Por qué un campo que se pega y no algo derivado del alias

Porque no hay de dónde derivarlo. Las tres alternativas que quedaban:

1. **Armar el QR interoperable desde el CVU.** Requiere ser PSP y conectarse a un esquema. No es un
   PR, es un trámite ante el BCRA.
2. **Usar la API de Mercado Pago para crear un link de pago por trabajo.** Requiere cuenta de
   desarrollador, `access token` de producción guardado como secreto, una función de borde nueva y
   una superficie que escribe sin pasar por la cola de salida. El 0051 ya lo descartó y sigue
   descartado: el dueño pidió el QR, no la integración.
3. **Codificar el alias como texto plano en un QR.** La cámara lo lee y muestra `maun.muebles`. No
   abre nada, no paga nada. Sería un botón que no hace lo que dice.

Pegar el link es la única que funciona hoy, cuesta un campo y no agrega ninguna dependencia.

### Por qué el host es una lista cerrada, en la base

`cobro_link` se convierte en un `<a href>` y en un código QR **dentro de una página que abre un
desconocido, sin sesión**. Un campo de texto libre que termina en un enlace público es una
superficie: si mañana alguien con acceso a la app carga ahí otra cosa, el cliente la escanea
creyendo que le paga al taller.

Por eso el host se valida en los dos lados y la base es el último:

- el `check` `ajustes_cobro_link_formato` exige `https://`, un host de la lista y 300 caracteres como
  máximo;
- `revisarLinkDeCobro()` de `@maun/domain` dice lo mismo con un mensaje que el dueño entiende;
- `esLinkDeMercadoPago()` filtra otra vez al leer la respuesta, igual que `esForma()` con las formas
  desconocidas: lo que la vista no reconoce, no llega a la pantalla.

Las dos reglas son gemelas y **`scripts/comparacion.ts` las compara**: `compararLinkDeCobro()` lee
el `check` del catálogo con `pg_get_constraintdef()`, lo evalúa contra dieciocho candidatos y exige
que el veredicto sea el mismo que el de TypeScript. Un cambio en cualquiera de los dos lados sin el
otro rompe `pnpm verify`.

### Por qué viaja adentro de «cobro» y no suelto

La regla del 0053 es que los datos para pagar viajan **solo si el pago que toca ahora se ofrece por
transferencia**. El link es un dato para pagar: es el quinto campo del mismo objeto y comparte la
misma guarda, en una sola condición. Si fuera una clave aparte habría dos lugares donde acordarse
de la regla, y el día que alguien toque uno se olvidaría del otro.

`supabase/tests/25_vista_del_cliente.sql` lo controla: `cobro_link` está clasificada en la lista de
columnas de `ajustes`, el objeto `cobro` tiene que tener exactamente cinco claves, y hay un caso que
pone el pago en efectivo y exige que el link no viaje.

### Tener link ya alcanza para cobrar sin efectivo

`hayComoTransferir()` pasa a mirar tres cosas: alias, CBU y link. Un taller que solo cargó el link
puede cobrar por ahí, así que un trabajo sin configurar sigue ofreciendo las dos formas por defecto.
La cuenta está en los dos lados —`v_hay_como_transferir` en SQL y `hayComoTransferir()` en el
dominio— y el archivo de pgTAP la prueba con el alias y el CBU vacíos.

## Consecuencias

- **El dueño paga comisión por lo que se cobre por acá.** Es la consecuencia principal y es la que
  él eligió. Está dicha en Ajustes, debajo del campo, y vuelve a decirse apenas escribe algo.
- **Mientras el link esté cargado, el cliente ya no ve el alias.** Pierde la opción gratis. Es lo
  que el dueño marcó, y se revierte vaciando un campo.
- **El link es del taller, no del trabajo.** Es el mismo para todos los trabajos y no lleva importe:
  el importe lo escribe el cliente, que es exactamente el «monto 0 a rellenar» que pidió, y la
  página se lo dice arriba del código.
- **El dibujo del QR se mudó a `shared/ui`.** La página del cliente es una entidad y no puede
  importar de una feature. `DibujoDelQr`, `QrDeUnEnlace` y `precargarElQr()` viven ahora en
  `shared/ui`, y la hoja del QR del dueño usa el mismo componente. `uqr` sigue fuera del chunk de
  vendor.

## Objeciones

1. **Esto le cuesta plata al dueño todos los meses y la alternativa gratis ya estaba hecha.** La
   transferencia al alias no tiene comisión y funcionaba. Lo que se gana es comodidad para el
   cliente: no copia nada, escanea y escribe el monto. Lo que se pierde es entre 0,80 % y 5,99 %
   más IVA de cada pago que entre por ahí. Sobre el volumen de un taller chico no es despreciable.
   Queda dicho acá y en la pantalla; la decisión es del dueño.

2. **El link no lleva el importe, así que el cliente lo puede escribir mal.** La página se lo dice
   arriba, en grande y con un botón de copiar, pero nada lo obliga. Un link de pago con importe fijo
   por trabajo resolvería esto y necesita la API, que está descartada. Mientras tanto, el pago mal
   escrito se ve en la app cuando el dueño lo anota, igual que hoy.

3. **El QR y el botón no los pude probar contra Mercado Pago.** El link que usan los tests es uno de
   forma válida, no una cuenta real. Que el código se lee y da exactamente la dirección está probado
   con un decodificador de verdad; que Mercado Pago abra la pantalla de pago del taller solo se
   comprueba escaneándolo con un teléfono contra una cuenta real, y eso lo tiene que hacer él.

## Fuentes

- Mercado Pago Argentina, «Cobrar con código QR», costos por medio de pago. Consultada el
  2026-09-20.
- Mercado Pago Argentina, «Link de pago». Consultada el 2026-09-20.
- BCRA, «Transferencias 3.0 · Pago con transferencia · Interoperabilidad entre los esquemas»:
  estándar EMVCo, campo 51 para CBU/CVU/alias y el rol de los administradores de esquema.
- BCRA, texto ordenado de Transferencias, punto 6.3.1.2: arancel al comercio entre 0,6 % y 0,8 %.
- Mercado Pago Developers, «Link de pago» y la documentación de deep linking para Android: el
  esquema `mercadopago://` es para volver de un checkout, no para iniciar una transferencia.
