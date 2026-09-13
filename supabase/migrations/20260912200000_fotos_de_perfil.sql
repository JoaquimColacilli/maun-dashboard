-- Fotos de perfil (ADR 0022, que reemplaza al 0021).
--
-- Un bucket público de Storage, con una carpeta por persona: la foto vive en {id del usuario}/foto.
-- La app la recorta y la achica en el navegador antes de subirla (un cuadrado de 512 px en WebP, o
-- JPEG donde el navegador no codifica WebP), así que el tope de 512 KiB y la lista de tipos no
-- molestan a la app y sí frenan a cualquiera que quiera usar el bucket para subir otra cosa.
--
-- Es público porque la foto se muestra con una URL fija y cacheable, sin firmar ni vencer. Lo que
-- no es público es escribir: insertar, reemplazar y borrar quedan limitados a la carpeta propia.
--
-- La migración es aditiva: no toca ninguna tabla del taller ni ninguna fila existente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-de-perfil', 'fotos-de-perfil', true, 524288, array['image/webp', 'image/jpeg']);

create policy fotos_de_perfil_subir_a_la_carpeta_propia on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-de-perfil'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy fotos_de_perfil_reemplazar_la_propia on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos-de-perfil'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'fotos-de-perfil'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy fotos_de_perfil_borrar_la_propia on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos-de-perfil'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- La lectura de las fotos no pasa por esta política: el bucket es público y se leen por URL. Existe
-- por la subida con upsert, que antes de escribir pregunta si el objeto ya existe con un select
-- sobre storage.objects que corre con la RLS del usuario. Sin una política de select ese chequeo
-- nunca encuentra la foto anterior, intenta insertarla de nuevo y la subida entera falla con un
-- error de RLS que no dice por qué.
create policy fotos_de_perfil_ver_la_propia on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos-de-perfil'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

comment on policy fotos_de_perfil_ver_la_propia on storage.objects is
  'No es para leer las fotos (el bucket es público y se leen por URL): es para la subida con upsert, que chequea si el objeto existe con un select bajo la RLS del usuario. Sin esta política ese chequeo nunca encuentra la foto anterior y la subida falla con un error de RLS.';
