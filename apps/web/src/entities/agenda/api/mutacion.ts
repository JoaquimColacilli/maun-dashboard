import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import {
  aplicarFilaLocal,
  crearAnotacion,
  darDeBajaAnotacion,
  debeReintentarse,
  editarAnotacion,
  filaPorId,
  householdDe,
  quitarFilaLocal,
  type AnotacionNueva,
  type CambiosDeAnotacion,
  type FilaDe,
  type Replica,
} from '@/shared/api';
import { claveDeTodaReplica, COLA_DE_SALIDA, guardarCacheAhora } from '@/shared/lib';

export const CLAVE_DE_ANOTACION_NUEVA = ['anotaciones', 'crear'] as const;
export const CLAVE_DE_ANOTACION = ['anotaciones', 'editar'] as const;
export const CLAVE_DE_BAJA_DE_ANOTACION = ['anotaciones', 'borrar'] as const;

const REINTENTOS = 5;

const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

export type Anotacion = FilaDe<'anotaciones'>;

export interface AltaDeAnotacion {
  nueva: AnotacionNueva;
  previa: Anotacion | null;
}

export interface EdicionDeAnotacion {
  id: string;
  cambios: CambiosDeAnotacion;
  previos: CambiosDeAnotacion;
}

export interface BajaDeAnotacion {
  id: string;
  borradoEn: string;
  previa: Anotacion;
}

function cambiarReplicas(cliente: QueryClient, cambio: (replica: Replica) => Replica): void {
  cliente.setQueriesData<Replica>({ queryKey: claveDeTodaReplica() }, (previa) =>
    previa ? cambio(previa) : previa,
  );
}

function conLaAnotacion(replica: Replica, { nueva, previa }: AltaDeAnotacion): Replica {
  const household = householdDe(replica);
  if (!household) return replica;

  const ahora = new Date().toISOString();
  const fila = {
    ...nueva,
    household_id: household.id,
    created_at: previa?.created_at ?? ahora,
    updated_at: ahora,
    deleted_at: null,
    version: previa === null ? 1 : previa.version + 1,
  } satisfies Anotacion;

  return aplicarFilaLocal(replica, 'anotaciones', fila);
}

function conCambios(replica: Replica, id: string, cambios: CambiosDeAnotacion): Replica {
  const actual = filaPorId(replica, 'anotaciones', id);
  if (!actual) return replica;
  return aplicarFilaLocal(replica, 'anotaciones', { ...actual, ...cambios });
}

export const MUTACION_DE_ANOTACION_NUEVA: MutationOptions<Anotacion, unknown, AltaDeAnotacion> = {
  mutationKey: CLAVE_DE_ANOTACION_NUEVA,
  mutationFn: ({ nueva, previa }) => crearAnotacion(nueva, previa !== null),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async (alta, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conLaAnotacion(replica, alta));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _alta, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'anotaciones', fila));
  },
  onError: (_error, { nueva }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => quitarFilaLocal(replica, 'anotaciones', nueva.id));
  },
};

export const MUTACION_DE_ANOTACION: MutationOptions<Anotacion, unknown, EdicionDeAnotacion> = {
  mutationKey: CLAVE_DE_ANOTACION,
  mutationFn: ({ id, cambios }) => editarAnotacion(id, cambios),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id, cambios }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conCambios(replica, id, cambios));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _edicion, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'anotaciones', fila));
  },
  onError: (_error, { id, previos }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => conCambios(replica, id, previos));
  },
};

export const MUTACION_DE_BAJA_DE_ANOTACION: MutationOptions<Anotacion, unknown, BajaDeAnotacion> = {
  mutationKey: CLAVE_DE_BAJA_DE_ANOTACION,
  mutationFn: ({ id, borradoEn }) => darDeBajaAnotacion(id, borradoEn),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => quitarFilaLocal(replica, 'anotaciones', id));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _baja, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'anotaciones', fila));
  },
  onError: (_error, { previa }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'anotaciones', previa));
  },
};
