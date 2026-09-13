# 0021. Perfil: el nombre en la cuenta, iniciales en vez de foto

- Estado: aceptada; la foto, reemplazada por el [0022](0022-foto-de-perfil.md)
- Fecha: 2026-09-12

## Contexto

El dueño pidió un perfil en Ajustes: nombre y datos sensatos. Una foto no entra en este paso. Por
ahora, iniciales en un círculo con un color que sale del nombre, y un registro de lo que costaría la
foto de verdad.

## Decisión

**El nombre vive en `user_metadata` de la cuenta de Supabase** (`auth.updateUser({ data: { nombre } })`),
no en una tabla. Es de la persona, no del taller: un segundo usuario del mismo household tendría el
suyo. No hace falta migración.

- La escritura va por la cola, como todo: `MUTACION_DEL_PERFIL` en `entities/sesion`, registrada en
  `mutaciones-persistibles`, con `scope: COLA_DE_SALIDA`. Sin señal queda anotada y la pantalla muestra
  el nombre nuevo, que sale de la mutación pendiente (`useNombreDeLaPersona`). Sobrevive a cerrar la app.
- Al drenar, Supabase emite `USER_UPDATED` y la sesión trae el nombre nuevo.
- Al reabrir, **el nombre se lee de la sesión guardada, no del JWT**: `updateUser` no renueva el token,
  y los claims siguen con el nombre viejo hasta el próximo refresh.
- `user_metadata` lo puede escribir el propio usuario. Está bien para un nombre para mostrar; no sirve
  para nada que decida permisos, y nada lo usa para eso.

**El avatar son iniciales** (`Avatar` en `packages/ui`): la primera letra del nombre y la del
apellido, o la del mail si no hay nombre. El color es un hash del nombre sobre seis tokens
(`--color-avatar-1` a `-6`), con sus pares para el oscuro y contraste AA contra el texto. El avatar es
`aria-hidden`: el nombre está escrito al lado.

## Lo que costaría la foto

- **Base:** un bucket privado en Supabase Storage y sus políticas de RLS sobre `storage.objects`, que
  se escriben en SQL. Es una migración en el único proyecto, que es producción.
- **Subida:** achicar la imagen en el cliente antes de subirla (un celular saca 4 MB), con un `canvas`
  o una dependencia nueva.
- **Sin señal:** es lo caro. La cola de hoy guarda mutaciones serializables en IndexedDB. Un archivo
  pide guardar el blob aparte, subirlo al drenar y recién ahí escribir la ruta en el perfil, con su
  propio caso de «se subió pero no se guardó la ruta».
- **Mostrarla sin señal:** URLs firmadas que vencen, así que hay que cachear la imagen. El service
  worker hoy precachea solo el shell, y la regla es no agregar `runtimeCaching` para Supabase: habría
  que abrir una excepción o guardar el blob en IndexedDB.
- **Plata:** despreciable para una persona. El plan gratis trae 1 GB de almacenamiento, y una foto
  achicada pesa unos 100 KB.

Estimación: un paso propio, del tamaño del de Clientes, casi todo en el camino sin señal.

## Opinión

**Estoy de acuerdo con no hacerla ahora.** La app la usa una sola persona, que ya sabe quién es. La foto
no cambia ninguna decisión que tome en la app, y su parte difícil (subir sin señal) es justo la que más
toca la cola, que es lo más delicado que hay. Las iniciales resuelven lo que la foto resolvería hoy:
reconocer de un vistazo de quién es la sesión.

## Consecuencias

- Un segundo usuario del taller ya tendría su nombre sin tocar nada.
- Otro dispositivo ve el nombre nuevo cuando renueva la sesión, no al instante: el nombre no está en la
  réplica.
