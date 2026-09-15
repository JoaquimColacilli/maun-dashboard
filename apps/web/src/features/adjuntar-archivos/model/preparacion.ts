import {
  codificarLienzo,
  lienzoDelDocumento,
  type ImagenDecodificada,
  type LienzoDeSalida,
} from '@/shared/lib';

import { LADO_DE_LA_MINIATURA, LADO_MAXIMO, medidasAchicadas } from './eleccion';

const CALIDAD = 0.8;

export interface ImagenPreparada {
  completa: Blob;
  miniatura: Blob;
  ancho: number;
  alto: number;
  tipo: 'image/webp' | 'image/jpeg';
}

interface Dibujo {
  blob: Blob;
  ancho: number;
  alto: number;
}

async function dibujar(
  imagen: ImagenDecodificada,
  ladoMaximo: number,
  crearLienzo: () => LienzoDeSalida,
): Promise<Dibujo> {
  const { ancho, alto } = imagen.tamano;
  const medidas = medidasAchicadas(ancho, alto, ladoMaximo);
  const lienzo = crearLienzo();
  lienzo.width = medidas.ancho;
  lienzo.height = medidas.alto;
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('Este navegador no puede preparar la imagen.');

  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(imagen.fuente, 0, 0, ancho, alto, 0, 0, medidas.ancho, medidas.alto);

  const blob = await codificarLienzo(lienzo, CALIDAD);
  lienzo.width = 0;
  lienzo.height = 0;
  if (!blob) throw new Error('No se pudo preparar la imagen. Probá de nuevo.');
  return { blob, ...medidas };
}

export async function prepararImagen(
  imagen: ImagenDecodificada,
  crearLienzo: () => LienzoDeSalida = lienzoDelDocumento,
): Promise<ImagenPreparada> {
  const completa = await dibujar(imagen, LADO_MAXIMO, crearLienzo);
  const miniatura = await dibujar(imagen, LADO_DE_LA_MINIATURA, crearLienzo);
  return {
    completa: completa.blob,
    miniatura: miniatura.blob,
    ancho: completa.ancho,
    alto: completa.alto,
    tipo: completa.blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg',
  };
}
