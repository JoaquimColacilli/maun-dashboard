# 0051. Cobrar con Mercado Pago: por ahora, el alias

Estado: aceptada, 2026-09-19. Solo decide el nivel 1, que es lo que entra en el
[0048](0048-los-datos-para-transferir.md). Los niveles 2 y 3 quedan escritos, sin hacer.

## Contexto

El dueño preguntó, sobre la vista del cliente:

> ¿Será que se puede poner un botón de pago de MP?

La pregunta es razonable y la respuesta depende casi enteramente de un número: cuánto se lleva
Mercado Pago. Este ADR lo mide y ordena las tres formas de responderla.

## Lo que cuesta, verificado el 2026-09-19

Mercado Pago cobra por **provincia del domicilio del vendedor** desde el 6 de marzo de 2026. El
taller está en Buenos Aires. Y **los porcentajes publicados no incluyen IVA**: la propia página lo
dice debajo de cada tabla, «Estos costos no incluyen IVA o retenciones».

Sobre una seña de **$ 1.500.000**:

| Cuándo querés la plata | Buenos Aires | Se lleva | Con IVA 21%   |
| ---------------------- | ------------ | -------- | ------------- |
| Al instante            | 6,60 %       | $ 99.000 | **$ 119.790** |
| A 10 días              | 4,61 %       | $ 69.150 | **$ 83.671**  |
| A 18 días              | 3,56 %       | $ 53.400 | **$ 64.614**  |
| A 35 días              | 1,56 %       | $ 23.400 | **$ 28.314**  |

Para comparar, en CABA la misma tabla es 6,29 / 4,39 / 3,39 / 1,49 %, que son los números que
circulan como «los de Mercado Pago» y hoy corresponden solo a ese grupo de provincias.

Ofrecer cuotas sin interés se paga aparte y es **acumulativo** sobre lo de arriba: 7,79 % a 2
cuotas, 10,49 % a 3, 18,69 % a 6, 32,29 % a 12, todos sin IVA. Si no se activa esa opción, el
cliente igual puede pagar en cuotas y el interés se lo pone su banco, sin costo para el taller.

**Recibir una transferencia común a un CBU o a un CVU cuesta 0 %** para una persona humana. Para
una persona jurídica hay 0,6 % de impuesto al cheque (Decreto 301/21): sobre $ 1.500.000, $ 9.000.
No sé bajo qué figura está la cuenta del taller; si es SRL o SA, ese 0,6 % aplica igual.

Retenciones: desde la RG 5554/2024 de ARCA no hay retención de IVA ni de Ganancias sobre cobros
electrónicos. Quedan IIBB (según jurisdicción e inscripción) y el impuesto al cheque. Las
alícuotas concretas de IIBB dependen del caso y no están publicadas en una tabla abierta.

## Los tres niveles

### Nivel 1 — los datos para transferir (hecho, ADR 0048)

Costo: **$ 0**. Trabajo: hecho. Riesgo: ninguno; la app no toca plata.

Si el alias del taller es de Mercado Pago, el cliente que quiere «pagar con Mercado Pago» abre su
app de Mercado Pago, pega el alias y transfiere. Es exactamente el botón que él imagina, sin
comisión y sin integración. El CVU de Mercado Pago se reconoce porque empieza con `000`, y la
pantalla ya lo etiqueta «CVU».

### Nivel 2 — un link de pago pegado a mano

El dueño arma el link en la app de Mercado Pago, lo pega en el trabajo, y la vista del cliente lo
muestra como botón. Sin servidor: es una columna de texto más y un `<a>`.

Costo: la tabla de arriba, $ 28.314 a $ 119.790 por cada seña de $ 1.500.000. El pago lo sigue
cargando él a mano en la app, así que no ahorra trabajo: **agrega** un paso (crear el link) y le
saca plata.

Tiene sentido en un solo caso: que el cliente **quiera pagar con tarjeta**, o en cuotas, y el
taller prefiera cobrar menos antes que no cobrar.

### Nivel 3 — la integración completa

Una función del lado del servidor con el access token (que Mercado Pago documenta como secreto de
backend y que no puede llegar al navegador), una preferencia por cada pago, y un webhook que
registre el cobro.

**Sería la primera escritura de esta app que no hace el dueño desde la app.** Saltea la cola de
salida y el control de versiones optimista, que son la columna vertebral del modelo offline (ADR
0010 y 0015). Pide, como mínimo: verificar la firma `x-signature` de cada notificación,
idempotencia ante los reintentos de Mercado Pago, y qué hacer con devoluciones y contracargos
sobre un pago que quizás ya se liquidó y repartió (ADR 0016). Nada de eso es imposible; todo eso es
un PR entero y una superficie nueva que puede escribir en la base sin que nadie la mire.

## Decisión y recomendación

**Hoy alcanza con el nivel 1**, que es lo que hace este PR. El nivel 2 solo si él quiere cobrar con
tarjeta o en cuotas y decide comerse la comisión. El nivel 3 no se justifica con este volumen: un
taller de una persona, con señas que se cobran de a una y que él anota igual.

Dicho de otra manera: el nivel 3 cuesta un PR grande y una superficie de escritura nueva para
ahorrarle escribir un pago por mes, y encima se lleva entre $ 28.000 y $ 120.000 por seña.

## Consecuencias

- **Las comisiones cambian.** Las de acá son del 2026-09-19 y la página dice «vigentes a partir
  del 6 de marzo de 2026». El día que esto se reabra, se vuelven a mirar; no se copian de este
  ADR.
- Si alguna vez se hace el nivel 2, el link va en una columna de `proyectos` y en la lista blanca,
  con su entrada en `25_vista_del_cliente.sql`.

## Fuentes

- Costos por provincia y «no incluyen IVA»:
  <https://www.mercadopago.com.ar/ayuda/cuanto-cuesta-recibir-pagos_33392> (consultada
  2026-09-19; pie: «Costos vigentes a partir del 6 de marzo de 2026»). Integrar por API no cambia
  el costo: <https://www.mercadopago.com.ar/ayuda/33399> publica las mismas tablas.
- Cuotas sin interés: <https://www.mercadopago.com.ar/ayuda/cuotas-sin-interes_3299>.
- Transferencias, 0 % e impuesto al cheque del 0,6 %:
  <https://www.mercadopago.com.ar/ayuda/26748> y <https://www.mercadopago.com.ar/ayuda/16229>.
- Retenciones vigentes: <https://www.mercadopago.com.ar/ayuda/17753>. Derogación de las de IVA y
  Ganancias (RG 5554/2024):
  <https://www.argentina.gob.ar/noticias/se-derogaron-los-regimenes-de-retencion-de-iva-y-ganancias-los-cobros-electronicos>
- El access token es secreto de backend y la firma del webhook va en `x-signature`:
  <https://www.mercadopago.com.ar/developers/es/docs/your-integrations/credentials> y
  <https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks>
