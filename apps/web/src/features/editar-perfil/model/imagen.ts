import { codificarLienzo, lienzoDelDocumento, type LienzoDeSalida } from '@/shared/lib';

import { LADO_DE_SALIDA, type Recorte } from './encuadre';

export {
  decodificarImagen,
  ImagenIlegible,
  type ContextoDeSalida,
  type ImagenDecodificada,
  type LienzoDeSalida,
} from '@/shared/lib';

export const TIPOS_QUE_SE_ELIGEN = 'image/jpeg,image/png,image/webp';

const CALIDAD = 0.85;

export async function recortarYCodificar(
  fuente: CanvasImageSource,
  recorte: Recorte,
  crearLienzo: () => LienzoDeSalida = lienzoDelDocumento,
): Promise<Blob> {
  const lienzo = crearLienzo();
  lienzo.width = LADO_DE_SALIDA;
  lienzo.height = LADO_DE_SALIDA;
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('Este navegador no puede preparar la foto.');

  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(
    fuente,
    recorte.sx,
    recorte.sy,
    recorte.lado,
    recorte.lado,
    0,
    0,
    LADO_DE_SALIDA,
    LADO_DE_SALIDA,
  );

  const salida = await codificarLienzo(lienzo, CALIDAD);
  lienzo.width = 0;
  lienzo.height = 0;

  if (!salida) throw new Error('No se pudo preparar la foto. Probá de nuevo.');
  return salida;
}
