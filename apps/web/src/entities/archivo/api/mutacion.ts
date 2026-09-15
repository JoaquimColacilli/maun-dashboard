import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import {
  aplicarFilaLocal,
  crearArchivo,
  darDeBajaArchivo,
  debeReintentarse,
  householdDe,
  quitarFilaLocal,
  type ArchivoNuevo,
  type Replica,
} from '@/shared/api';
import { claveDeTodaReplica, COLA_DE_SALIDA, guardarCacheAhora } from '@/shared/lib';

import type { Archivo } from '../model/archivos';

export const CLAVE_DE_ARCHIVO_NUEVO = ['archivos', 'crear'] as const;
export const CLAVE_DE_BAJA_DE_ARCHIVO = ['archivos', 'borrar'] as const;

const REINTENTOS = 5;

const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

export interface AltaDeArchivo {
  nuevo: ArchivoNuevo;
  previo: Archivo | null;
}

export interface BajaDeArchivo {
  id: string;
  borradoEn: string;
  previo: Archivo;
}

function cambiarReplicas(cliente: QueryClient, cambio: (replica: Replica) => Replica): void {
  cliente.setQueriesData<Replica>({ queryKey: claveDeTodaReplica() }, (previa) =>
    previa ? cambio(previa) : previa,
  );
}

function conElArchivo(replica: Replica, { nuevo, previo }: AltaDeArchivo): Replica {
  const household = householdDe(replica);
  if (!household) return replica;

  const ahora = new Date().toISOString();
  const fila = {
    ...nuevo,
    household_id: household.id,
    created_at: previo?.created_at ?? ahora,
    updated_at: ahora,
    deleted_at: null,
    version: previo === null ? 1 : previo.version + 1,
  } satisfies Archivo;

  return aplicarFilaLocal(replica, 'archivos', fila);
}

export const MUTACION_DE_ARCHIVO_NUEVO: MutationOptions<Archivo, unknown, AltaDeArchivo> = {
  mutationKey: CLAVE_DE_ARCHIVO_NUEVO,
  mutationFn: ({ nuevo, previo }) => crearArchivo(nuevo, previo !== null),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async (alta, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conElArchivo(replica, alta));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _alta, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'archivos', fila));
  },
  onError: (_error, { nuevo, previo }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) =>
      previo === null ? quitarFilaLocal(replica, 'archivos', nuevo.id) : replica,
    );
  },
};

export const MUTACION_DE_BAJA_DE_ARCHIVO: MutationOptions<Archivo, unknown, BajaDeArchivo> = {
  mutationKey: CLAVE_DE_BAJA_DE_ARCHIVO,
  mutationFn: ({ id, borradoEn }) => darDeBajaArchivo(id, borradoEn),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => quitarFilaLocal(replica, 'archivos', id));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _baja, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'archivos', fila));
  },
  onError: (_error, { previo }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'archivos', previo));
  },
};
