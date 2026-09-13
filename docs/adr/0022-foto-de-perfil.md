# 0022. Foto de perfil: recorte en el navegador, bucket público y subida en línea

- Estado: aceptada
- Fecha: 2026-09-12
- Reemplaza al [0021](0021-perfil-sin-foto.md) en lo que decidió sobre la foto. El nombre en `user_metadata` sigue igual.

## Contexto

El dueño cambió de opinión: quiere la foto. Tocando el círculo de las iniciales se abre el recorte,
se guarda y queda. Vino con varias decisiones tomadas: recorte y achique en el navegador, sin
librería, bucket público con una carpeta por persona, `upsert` con su política de `SELECT`, cache
busting en la URL, y nada de cola: sin señal no se puede, y está bien.

## Decisión

**El recorte pasa en el navegador y nunca se sube el original.** La salida es un cuadrado de
512 × 512.

- La matemática es un módulo puro y probado (`features/editar-perfil/model/encuadre.ts`): cobertura,
  límites, zoom alrededor de un punto y la conversión del cuadro a la fuente.
- La vista previa mueve un `<img>` con `transform`; el canvas se usa una sola vez, al guardar.
- Se arrastra con eventos de puntero (con dos dedos, el pellizco hace zoom), la rueda hace zoom con
  un listener no pasivo, y hay teclado (flechas, `+`, `−` y `0`), slider y botones. Un
  `ResizeObserver` mide el cuadro y reescala el encuadre si cambia de tamaño.
- **Sin librería.** Lo que hace falta es angosto: 1:1 fijo, máscara circular, salida fija.

**WebP, y JPEG donde no hay WebP.** Safari (iOS hasta 26.6 y macOS hasta 27, según caniuse) no
codifica WebP en `toBlob` y devuelve un PNG sin avisar. Un PNG de 512 px de una foto pesa cientos de
KB. `recortarYCodificar` pide WebP, mira `blob.type` y, si no es WebP, rehace en JPEG al 85%. En
Safari eso llama a `toBlob` dos veces.

**Almacenamiento.** Bucket público `fotos-de-perfil`, con el archivo en `{id del usuario}/foto`, un
tope de 512 KiB y solo WebP y JPEG.

- Las políticas limitan subir, reemplazar y borrar a la carpeta propia. La lectura es pública por URL.
- **La política de `SELECT` existe por el `upsert`**, que antes de escribir chequea si el objeto existe
  con un select bajo la RLS del usuario. Está explicada en un `comment on policy` y en la migración.
- El snapshot `esquema.sql` ahora incluye el bucket y las políticas de `storage.objects`.
- La migración se ensayó (13 tests nuevos de pgTAP) y se aplicó. Es aditiva.

**Cache.** Con `upsert` la ruta no cambia. Cada subida guarda una URL nueva con `cacheNonce` (la
opción de `getPublicUrl`), así que el navegador y el CDN piden el archivo de nuevo.

**La URL vive en `user_metadata.foto`**, con el mismo criterio que el nombre: es de la persona, no del
taller. `updateUser({ data })` combina las claves, así que guardar la foto no borra el nombre (se
verificó con la cuenta de prueba). La app solo acepta una URL que apunte a este bucket.

**Sin señal no se puede.** La cola maneja mutaciones de JSON, no archivos. Cambiar la foto es una
operación en línea: con el aparato sin señal, tocar el círculo no abre el selector y dice por qué, y
si la señal se cae a mitad de la subida, el recortador muestra el mismo mensaje.
`esFalloDeRed` reconoce ahora el `StorageUnknownError` de storage-js.

**Las iniciales quedan** como respaldo: mientras la foto carga y si no carga.

## Alternativas descartadas

- **Una librería de recorte.** Para un 1:1 con salida fija es más código del necesario, y suma una
  dependencia que hay que mantener.
- **Bucket privado con URL firmada.** La URL vence, y la foto se muestra en cada pantalla.
- **Un nombre de archivo que cambie en cada subida.** Deja archivos viejos para borrar. El `cacheNonce`
  resuelve lo mismo con una sola ruta.
- **Meter la subida en la cola.** Sería la única mutación con un archivo adentro.

## Consecuencias

- **Otro dispositivo ve la foto nueva recién cuando renueva la sesión**, igual que el nombre: la URL no
  está en la réplica.
- **Sin señal, la foto se ve solo si quedó en el cache HTTP del navegador.** El service worker no cachea
  Supabase; si no está, se ven las iniciales.
- **La foto es pública para quien tenga la URL**, que lleva el id del usuario. Para un avatar alcanza.
- Una foto más chica que 512 px se agranda a 512.
- Nada se probó en un iPhone ni en un Android de verdad: el fallback de Safari está cubierto con un
  test unitario, no en el dispositivo.
