import { onlineManager, type MutationOptions, type QueryClient } from '@tanstack/react-query';

import {
  MUTACION_DE_ARCHIVO_NUEVO,
  MUTACION_DE_BAJA_DE_ARCHIVO,
  rutasEnElBucket,
  type AltaDeArchivo,
  type Archivo,
  type BajaDeArchivo,
} from '@/entities/archivo';
import {
  filaPorId,
  quitarDelBucketDeArchivos,
  type ArchivoNuevo,
  type Replica,
} from '@/shared/api';
import { avisarEnPantalla, claveDeTodaReplica, metaDeAvisos, type NuevoAviso } from '@/shared/lib';

export const ESPERA_ANTES_DE_QUITAR_DEL_BUCKET_MS = 6000;

export type Mandar = <TVariables>(
  opciones: MutationOptions<Archivo, unknown, TVariables>,
  variables: TVariables,
) => void;

export interface OpcionesDelBorrado {
  avisar: (aviso: NuevoAviso) => void;
  quitarDelBucket: (rutas: readonly string[]) => Promise<void>;
  enLinea: () => boolean;
  sigueBorrado: () => boolean;
  programar: (hacer: () => void, esperaMs: number) => ReturnType<typeof setTimeout>;
  cancelar: (reloj: ReturnType<typeof setTimeout>) => void;
}

export function mandarALaCola(cliente: QueryClient): Mandar {
  return (opciones, variables) => {
    void cliente
      .getMutationCache()
      .build(cliente, opciones)
      .execute(variables)
      .catch(() => undefined);
  };
}

function datosDe(archivo: Archivo): ArchivoNuevo {
  return {
    id: archivo.id,
    proyecto_id: archivo.proyecto_id,
    nombre: archivo.nombre,
    tipo: archivo.tipo,
    bytes: archivo.bytes,
    ancho: archivo.ancho,
    alto: archivo.alto,
  };
}

export function anotarArchivo(mandar: Mandar, nuevo: ArchivoNuevo): void {
  mandar<AltaDeArchivo>(
    {
      ...MUTACION_DE_ARCHIVO_NUEVO,
      meta: metaDeAvisos('archivo', { silencioso: true, sujeto: nuevo.nombre }),
    },
    { nuevo, previo: null },
  );
}

export function borrarArchivo(
  mandar: Mandar,
  archivo: Archivo,
  opciones: OpcionesDelBorrado,
): void {
  mandar<BajaDeArchivo>(
    {
      ...MUTACION_DE_BAJA_DE_ARCHIVO,
      meta: metaDeAvisos('archivoBorrado', { silencioso: true, sujeto: archivo.nombre }),
    },
    { id: archivo.id, borradoEn: new Date().toISOString(), previo: archivo },
  );

  let deshecho = false;
  const reloj = opciones.programar(() => {
    if (deshecho || !opciones.enLinea() || !opciones.sigueBorrado()) return;
    void opciones.quitarDelBucket(rutasEnElBucket(archivo)).catch(() => undefined);
  }, ESPERA_ANTES_DE_QUITAR_DEL_BUCKET_MS);

  opciones.avisar({
    clave: `archivo-borrado-${archivo.id}`,
    tono: 'hecho',
    texto: `Borraste «${archivo.nombre}».`,
    accion: {
      etiqueta: 'Deshacer',
      alTocar: () => {
        deshecho = true;
        opciones.cancelar(reloj);
        mandar<AltaDeArchivo>(
          {
            ...MUTACION_DE_ARCHIVO_NUEVO,
            meta: metaDeAvisos('archivo', { silencioso: true, sujeto: archivo.nombre }),
          },
          { nuevo: datosDe(archivo), previo: archivo },
        );
      },
    },
  });
}

function sigueBorradoEnLaReplica(cliente: QueryClient, id: string): boolean {
  return cliente
    .getQueriesData<Replica>({ queryKey: claveDeTodaReplica() })
    .every(
      ([, replica]) => replica === undefined || filaPorId(replica, 'archivos', id) === undefined,
    );
}

export function opcionesDelBorrado(cliente: QueryClient, archivo: Archivo): OpcionesDelBorrado {
  return {
    avisar: avisarEnPantalla,
    quitarDelBucket: quitarDelBucketDeArchivos,
    enLinea: () => onlineManager.isOnline(),
    sigueBorrado: () => sigueBorradoEnLaReplica(cliente, archivo.id),
    programar: (hacer, esperaMs) => setTimeout(hacer, esperaMs),
    cancelar: (reloj) => {
      clearTimeout(reloj);
    },
  };
}
