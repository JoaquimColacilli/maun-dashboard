import { pesoLegible } from '@/entities/archivo';

export const TIPOS_QUE_SE_ELIGEN = 'image/*,application/pdf,video/*';

export const TOPE_DE_UN_PDF_BYTES = 10 * 1024 * 1024;

export const LADO_MAXIMO = 2000;

export const LADO_DE_LA_MINIATURA = 480;

const LARGO_DEL_NOMBRE = 200;

export const SIN_SENAL_PARA_ARCHIVOS =
  'Sin señal no se pueden subir archivos: se suben en el momento y no quedan anotados para después. Probá cuando vuelva la señal.';

export const LOS_VIDEOS_NO_ENTRAN =
  'Los videos no se pueden subir: uno del celular pesa entre 50 y 200 MB, y el espacio para los archivos de todo el taller es de 1 GB. Subí fotos o capturas del video, y los planos y presupuestos en PDF.';

export interface ArchivoElegido {
  name: string;
  type: string;
  size: number;
}

export type EleccionDelArchivo =
  { clase: 'imagen' } | { clase: 'pdf' } | { clase: 'rechazado'; motivo: string };

const EXTENSIONES_DE_VIDEO = /\.(mp4|mov|m4v|avi|mkv|3gp|webm|wmv)$/i;
const EXTENSIONES_DE_IMAGEN = /\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i;

export function eleccionDelArchivo(archivo: ArchivoElegido): EleccionDelArchivo {
  const tipo = archivo.type.toLowerCase();
  const nombre = archivo.name.trim();

  if (tipo.startsWith('video/') || EXTENSIONES_DE_VIDEO.test(nombre)) {
    return { clase: 'rechazado', motivo: LOS_VIDEOS_NO_ENTRAN };
  }
  if (tipo === 'application/pdf' || /\.pdf$/i.test(nombre)) {
    if (archivo.size > TOPE_DE_UN_PDF_BYTES) {
      return {
        clase: 'rechazado',
        motivo: `«${nombre}» pesa ${pesoLegible(archivo.size)}, y un PDF puede pesar hasta 10 MB. Si es un escaneo, guardalo con menos calidad y probá de nuevo.`,
      };
    }
    return { clase: 'pdf' };
  }
  if (tipo.startsWith('image/') || EXTENSIONES_DE_IMAGEN.test(nombre)) return { clase: 'imagen' };
  return {
    clase: 'rechazado',
    motivo: `«${nombre}» no se puede subir: se pueden subir fotos, capturas y PDF.`,
  };
}

export interface Medidas {
  ancho: number;
  alto: number;
}

export function medidasAchicadas(ancho: number, alto: number, ladoMaximo: number): Medidas {
  const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

export function nombreParaGuardar(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio === '') return 'Archivo';
  return limpio.length > LARGO_DEL_NOMBRE ? limpio.slice(0, LARGO_DEL_NOMBRE) : limpio;
}
