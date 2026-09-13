import { LADO_DE_SALIDA, type Recorte, type Tamano } from './encuadre';

export const TIPOS_QUE_SE_ELIGEN = 'image/jpeg,image/png,image/webp';

const CALIDAD = 0.85;

export interface ImagenDecodificada {
  readonly fuente: CanvasImageSource;
  readonly tamano: Tamano;
  readonly url: string;
  readonly liberar: () => void;
}

export interface ContextoDeSalida {
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  drawImage(
    fuente: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

export interface LienzoDeSalida {
  width: number;
  height: number;
  getContext(tipo: '2d'): ContextoDeSalida | null;
  toBlob(alTerminar: BlobCallback, tipo?: string, calidad?: number): void;
}

export class ImagenIlegible extends Error {
  constructor() {
    super('No se pudo leer esa imagen. Probá con una foto JPEG, PNG o WebP.');
    this.name = 'ImagenIlegible';
  }
}

export async function decodificarImagen(archivo: Blob): Promise<ImagenDecodificada> {
  const url = URL.createObjectURL(archivo);
  const imagen = new Image();
  imagen.decoding = 'async';
  imagen.src = url;
  try {
    await imagen.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new ImagenIlegible();
  }
  if (imagen.naturalWidth === 0 || imagen.naturalHeight === 0) {
    URL.revokeObjectURL(url);
    throw new ImagenIlegible();
  }
  return {
    fuente: imagen,
    tamano: { ancho: imagen.naturalWidth, alto: imagen.naturalHeight },
    url,
    liberar: () => {
      URL.revokeObjectURL(url);
    },
  };
}

function aBlob(lienzo: LienzoDeSalida, tipo: string): Promise<Blob | null> {
  return new Promise((resolver) => {
    lienzo.toBlob(resolver, tipo, CALIDAD);
  });
}

function lienzoDelDocumento(): LienzoDeSalida {
  return document.createElement('canvas');
}

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

  const enWebp = await aBlob(lienzo, 'image/webp');
  const salida = enWebp?.type === 'image/webp' ? enWebp : await aBlob(lienzo, 'image/jpeg');
  lienzo.width = 0;
  lienzo.height = 0;

  if (!salida || (salida.type !== 'image/webp' && salida.type !== 'image/jpeg')) {
    throw new Error('No se pudo preparar la foto. Probá de nuevo.');
  }
  return salida;
}
