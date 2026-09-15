export interface MedidasDeImagen {
  readonly ancho: number;
  readonly alto: number;
}

export interface ImagenDecodificada {
  readonly fuente: CanvasImageSource;
  readonly tamano: MedidasDeImagen;
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

export function lienzoDelDocumento(): LienzoDeSalida {
  return document.createElement('canvas');
}

function aBlob(lienzo: LienzoDeSalida, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => {
    lienzo.toBlob(resolver, tipo, calidad);
  });
}

export async function codificarLienzo(
  lienzo: LienzoDeSalida,
  calidad: number,
): Promise<Blob | null> {
  const enWebp = await aBlob(lienzo, 'image/webp', calidad);
  const salida =
    enWebp?.type === 'image/webp' ? enWebp : await aBlob(lienzo, 'image/jpeg', calidad);
  if (!salida || (salida.type !== 'image/webp' && salida.type !== 'image/jpeg')) return null;
  return salida;
}
