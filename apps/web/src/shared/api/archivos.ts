import { clienteMaun } from './cliente';

export const BUCKET_DE_ARCHIVOS = 'archivos';

const UN_ANIO_EN_SEGUNDOS = '31536000';

export async function subirAlBucketDeArchivos(ruta: string, contenido: Blob): Promise<void> {
  const { error } = await clienteMaun().storage.from(BUCKET_DE_ARCHIVOS).upload(ruta, contenido, {
    upsert: true,
    contentType: contenido.type,
    cacheControl: UN_ANIO_EN_SEGUNDOS,
  });
  if (error) throw error;
}

export async function quitarDelBucketDeArchivos(rutas: readonly string[]): Promise<void> {
  const { error } = await clienteMaun()
    .storage.from(BUCKET_DE_ARCHIVOS)
    .remove([...rutas]);
  if (error) throw error;
}

export function urlDelArchivo(ruta: string): string {
  return clienteMaun().storage.from(BUCKET_DE_ARCHIVOS).getPublicUrl(ruta).data.publicUrl;
}
