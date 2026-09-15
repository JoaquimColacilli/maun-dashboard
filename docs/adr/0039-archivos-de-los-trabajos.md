# 0039. Archivos de los trabajos: achicados en el navegador, servidos por el CDN y con un tope a la vista

- Estado: aceptada
- Fecha: 2026-09-15
- Reusa las decisiones de la foto de perfil ([0022](0022-foto-de-perfil.md)): recorte y codificación en el
  navegador, bucket público, subida con `upsert` y su política de lectura, y nada de cola para el binario.
  Suma una tabla a la réplica ([0010](0010-sincronizacion-replica-completa.md)).

## Contexto

El dueño produce, por trabajo, fotos y videos del relevamiento, planos de despiece y presupuestos en PDF,
renders y capturas del software, y a veces capturas de transferencias. Quiere subirlos y verlos online.
Las fotos del relevamiento existen antes de que haya obra, así que van también en el contacto.

El plan de Supabase es el gratuito. Lo que dice la documentación oficial, consultada hoy:

| Límite del plan Free       | Valor                                                                                                       | Fuente                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Espacio de Storage         | 1 GB                                                                                                        | supabase.com/pricing                              |
| Tamaño por archivo         | 50 MB                                                                                                       | docs/guides/storage/uploads/file-limits           |
| Tráfico de salida          | 5 GB sin cache **y** 5 GB con cache, por separado                                                           | docs/guides/storage/serving/bandwidth             |
| Transformación de imágenes | No incluida (Pro en adelante)                                                                               | docs/guides/storage/serving/image-transformations |
| Smart CDN                  | No incluido: Free tiene el CDN básico                                                                       | docs/guides/storage/cdn/smart-cdn                 |
| Al pasarse de una cuota    | Aviso, período de gracia, y después restricciones: puede responder **402 a todos los pedidos** del proyecto | docs/guides/platform/billing-faq                  |

**Una corrección al pedido.** El pedido decía que lo servido por el CDN no cuenta contra la cuota de
tráfico. No es exacto: lo que sale del cache del CDN cuenta contra **su propia** cuota de 5 GB, separada
de los 5 GB sin cache. Igual conviene servir por el CDN, por dos motivos: reparte el tráfico entre las dos
cuotas y, sobre todo, lo que el navegador ya guardó no vuelve a salir.

## Decisión

**Una fila por archivo en la réplica, el binario en un bucket.** `public.archivos` tiene el trabajo, el
nombre, el tipo, lo que ocupa y las medidas; entra en `bootstrap()` y `delta()`. Así la lista se ve sin
señal, y borrar tiene deshacer por la cola, igual que una anotación. Borrar un trabajo se lleva sus filas
(`borrar_hijos_de_proyecto`).

**El bucket `archivos`**, público, con una carpeta por taller y por trabajo:
`{household}/{proyecto}/{id}.webp` y al lado `{id}.mini.webp`. Tope de **10 MiB** por archivo y solo WebP,
JPEG y PDF. Las cuatro políticas atan subir, reemplazar, borrar y listar a las carpetas del household; la
de lectura existe por el `upsert`, con el mismo comentario que la de la foto de perfil. Acá el `upsert`
sirve para reintentar: si la red se corta después de subir, el mismo id vuelve a subir sin chocar.

**Nunca se sube una imagen original.** Toda imagen (foto, render, captura, también PNG o HEIC donde el
navegador la lea) se decodifica, se achica a **2000 px** del lado largo y se codifica en WebP al 80%, o en
JPEG donde el navegador no codifica WebP (el mismo `codificarLienzo` de la foto de perfil). Además se sube
una **miniatura de 480 px**, que es la que muestra la ficha: abrir un trabajo con quince fotos baja quince
miniaturas, no quince fotos. Un PDF se sube tal cual.

Medido en Chromium con imágenes generadas (el e2e mide lo mismo sobre la subida real):

| Original                                    | Subido: completa + miniatura |
| ------------------------------------------- | ---------------------------- |
| Foto de 4032 × 3024 con ruido, JPEG 5,03 MB | 107 KB + 19 KB               |
| Foto de 4032 × 3024 suave, JPEG 798 KB      | 81 KB + 19 KB                |
| Render de 1920 × 1080, PNG 1,86 MB          | 28 KB + 7 KB                 |

Una foto real de celular tiene más detalle que estas: para las cuentas de abajo tomo **400 KB por foto con
su miniatura**, cuatro veces lo medido.

**Se sirve por la URL pública, que pasa por el CDN, con cache de un año.** La ruta sale del id y nunca se
reescribe, así que no hay nada que invalidar. Sin URL firmada (cada token es otra entrada del cache) y sin
`download()` autenticado (no cachea).

**Ver sin descargar.** Las imágenes, en un visor (`Hoja` con un ancho nuevo, `visor`), con anterior y
siguiente, abrir en otra pestaña y borrar. Los PDF se abren en una pestaña nueva: el lector es el del
navegador.

**Borrar** es una baja lógica por la cola, con «Deshacer» en el aviso. El binario se quita del bucket
cuando vence el deshacer, si hay señal y la fila sigue borrada.

**Lo que no entra se explica, no se esconde.**

- **Los videos no entran.** Un video del celular pesa entre 50 y 200 MB: muchos no pasan el tope de 50
  MB, y dos o tres llenan el giga. El selector los deja elegir a propósito, para que la pantalla diga por
  qué no y qué sí se puede, en vez de que el video no aparezca y no se sepa por qué.
- **Sin señal no se sube**, igual que la foto: no abre el selector y lo dice. La cola maneja JSON.
- Un PDF de más de 10 MB lo dice con su peso; otro tipo de archivo, que se pueden subir fotos, capturas y
  PDF.

## Cuánto entra, y cuándo cambiar de plan

**Un trabajo típico**, con suposiciones generosas: 15 fotos del relevamiento (6 MB), 3 capturas o renders
(0,5 MB) y 3 PDF de despiece y presupuesto (3 MB): **unos 10 MB**.

- **Espacio:** 1 GB son **unos 100 trabajos con archivos**. Con 8 trabajos por mes que suban archivos,
  **alcanza para un año**. Ajustes muestra lo usado («Espacio para archivos») y a partir de **800 MB** avisa
  que se está llenando.
- **Tráfico:** una ficha baja sus miniaturas una vez por dispositivo (15 × 25 KB = 0,4 MB). Un día muy
  cargado, con 20 fichas abiertas por primera vez, 50 fotos en el visor y 10 PDF abiertos, son unos 38 MB:
  **1,1 GB en un mes así todos los días**, contra 5 GB de cada cuota. El tráfico no es el límite; el espacio
  sí.
- **Cuándo pasar a Pro** (25 dólares por mes: 100 GB de espacio y 250 GB de cada tráfico): **cuando lo usado
  pase de 800 MB**, que es cuando avisa Ajustes, o si el panel de uso de Supabase muestra más de **4 GB** de
  tráfico en un mes en cualquiera de las dos cuotas. No esperar al giga: pasarse no frena solo las subidas,
  puede dejar la app entera respondiendo 402.

## Alternativas descartadas

- **Bucket privado con URL firmada.** Cada URL es una entrada distinta del cache: todo sale como tráfico
  sin cache, y la URL vence.
- **Subir el original y achicar con las transformaciones de Supabase.** No están en el plan Free.
- **Encolar la subida.** Sería la única mutación con un binario adentro, y un binario de megas en
  IndexedDB esperando señal es justo lo que no entra en la cola.
- **Sin tabla, listando el bucket.** La lista no se vería sin señal y borrar no tendría deshacer.
- **Aceptar videos con otro tope.** Uno solo de 50 MB es el 5% del espacio de todo el taller.

## Objeciones

- **El bucket es público.** Una captura de una transferencia o la foto del interior de una casa se ven con
  la URL. La URL lleva ids aleatorios (UUIDv7) y nadie de afuera puede listar el bucket, pero una URL
  compartida queda compartida. Un bucket privado resolvería esto a costa del cache y de las URL fijas; si
  el dueño empieza a subir documentos sensibles, conviene revisarlo.
- **Pueden quedar binarios huérfanos:** si la app se cierra antes de que venza el deshacer, si se borra
  sin señal, si se borra un trabajo entero (se borran las filas, no los binarios) o si la subida anda y la
  fila rebota. Ocupan espacio sin verse. Hoy no hay limpieza; con el uso real se ve si hace falta un script.
- **Un bundle nuevo contra una base sin migrar no sincroniza:** `leerLote` exige la tabla `archivos` en la
  respuesta. La migración tiene que estar aplicada antes de mergear.
- **Nada se probó en un teléfono.** Ni una foto HEIC de un iPhone, ni la subida con señal mala, ni cuánto
  pesa de verdad una foto de celular achicada.

## Verificación

- Base: `21_archivos.sql` (21: el bucket, la RLS de Storage, la tabla, la réplica y la baja en cascada),
  `00_estructura.sql`, `04_sincronizacion.sql` y la lista de políticas de `15_fotos_de_perfil.sql`.
- App: `eleccion.test.ts`, `preparacion.test.ts`, `subida.test.ts`, `acciones.test.ts` y `archivos.test.ts`.
- e2e (`archivos.spec.ts`): subir una foto, un render y un PDF midiendo lo que sube, verlos, abrir el PDF,
  borrar con deshacer y ver que el binario se va del bucket; intentar subir un video; y sin señal.
