import { rutaDeLaMiniatura, rutaDelArchivo } from '@/entities/archivo';
import type { ArchivoNuevo } from '@/shared/api';
import type { ImagenDecodificada } from '@/shared/lib';

import { eleccionDelArchivo, nombreParaGuardar } from './eleccion';
import type { ImagenPreparada } from './preparacion';

export class ArchivoRechazado extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'ArchivoRechazado';
  }
}

export interface DestinoDeLaSubida {
  householdId: string;
  proyectoId: string;
}

export interface DependenciasDeLaSubida {
  subir: (ruta: string, contenido: Blob) => Promise<void>;
  decodificar: (archivo: Blob) => Promise<ImagenDecodificada>;
  preparar: (imagen: ImagenDecodificada) => Promise<ImagenPreparada>;
  nuevoId: () => string;
}

export interface ArchivoSubido {
  nuevo: ArchivoNuevo;
  original: number;
  subido: number;
}

export async function subirUnArchivo(
  archivo: File,
  destino: DestinoDeLaSubida,
  dependencias: DependenciasDeLaSubida,
): Promise<ArchivoSubido> {
  const eleccion = eleccionDelArchivo(archivo);
  if (eleccion.clase === 'rechazado') throw new ArchivoRechazado(eleccion.motivo);

  const id = dependencias.nuevoId();
  const nombre = nombreParaGuardar(archivo.name);
  const ubicacion = { id, household_id: destino.householdId, proyecto_id: destino.proyectoId };

  if (eleccion.clase === 'pdf') {
    const contenido =
      archivo.type === 'application/pdf'
        ? archivo
        : new Blob([archivo], { type: 'application/pdf' });
    await dependencias.subir(rutaDelArchivo({ ...ubicacion, tipo: 'application/pdf' }), contenido);
    return {
      nuevo: {
        id,
        proyecto_id: destino.proyectoId,
        nombre,
        tipo: 'application/pdf',
        bytes: contenido.size,
        ancho: null,
        alto: null,
      },
      original: archivo.size,
      subido: contenido.size,
    };
  }

  const imagen = await dependencias.decodificar(archivo);
  try {
    const preparada = await dependencias.preparar(imagen);
    const conTipo = { ...ubicacion, tipo: preparada.tipo };
    await dependencias.subir(rutaDelArchivo(conTipo), preparada.completa);
    await dependencias.subir(rutaDeLaMiniatura(conTipo), preparada.miniatura);
    const subido = preparada.completa.size + preparada.miniatura.size;
    return {
      nuevo: {
        id,
        proyecto_id: destino.proyectoId,
        nombre,
        tipo: preparada.tipo,
        bytes: subido,
        ancho: preparada.ancho,
        alto: preparada.alto,
      },
      original: archivo.size,
      subido,
    };
  } finally {
    imagen.liberar();
  }
}
