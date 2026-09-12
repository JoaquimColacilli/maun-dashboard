import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import { claveDeTodaReplica } from '@/entities/replica';
import {
  aplicarFilaLocal,
  debeReintentarse,
  editarAjustes,
  filaPorId,
  renombrarTaller,
  type CambiosDeAjustes,
  type FilaDe,
  type Replica,
} from '@/shared/api';
import { COLA_DE_SALIDA, guardarCacheAhora } from '@/shared/lib';

export const CLAVE_DE_AJUSTES = ['ajustes', 'editar'] as const;
export const CLAVE_DEL_NOMBRE = ['households', 'renombrar'] as const;

const REINTENTOS = 5;
const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

// Los valores previos viajan en las variables y no en el contexto de la mutación: el contexto no se
// persiste, así que un rechazo después de cerrar y abrir la app no tendría con qué volver atrás. Y
// el delta tampoco lo arreglaría: en el servidor la fila nunca cambió, así que no vuelve a viajar.
export interface EdicionDeAjustes {
  id: string;
  cambios: CambiosDeAjustes;
  previos: CambiosDeAjustes;
}

export interface CambioDelNombre {
  id: string;
  nombre: string;
  previo: string;
}

function cambiarReplicas(cliente: QueryClient, cambio: (replica: Replica) => Replica): void {
  cliente.setQueriesData<Replica>({ queryKey: claveDeTodaReplica() }, (previa) =>
    previa ? cambio(previa) : previa,
  );
}

function conAjustes(replica: Replica, id: string, cambios: CambiosDeAjustes): Replica {
  const actual = filaPorId(replica, 'ajustes', id);
  if (!actual) return replica;
  return aplicarFilaLocal(replica, 'ajustes', { ...actual, ...cambios });
}

function conNombre(replica: Replica, id: string, nombre: string): Replica {
  const actual = filaPorId(replica, 'households', id);
  if (!actual) return replica;
  return aplicarFilaLocal(replica, 'households', { ...actual, nombre });
}

export const MUTACION_DE_AJUSTES: MutationOptions<FilaDe<'ajustes'>, unknown, EdicionDeAjustes> = {
  mutationKey: CLAVE_DE_AJUSTES,
  mutationFn: ({ id, cambios }) => editarAjustes(id, cambios),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id, cambios }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conAjustes(replica, id, cambios));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'ajustes', fila));
  },
  onError: (_error, { id, previos }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => conAjustes(replica, id, previos));
  },
};

export const MUTACION_DEL_NOMBRE: MutationOptions<
  FilaDe<'households'>,
  unknown,
  CambioDelNombre
> = {
  mutationKey: CLAVE_DEL_NOMBRE,
  mutationFn: ({ id, nombre }) => renombrarTaller(id, nombre),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id, nombre }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conNombre(replica, id, nombre));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'households', fila));
  },
  onError: (_error, { id, previo }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => conNombre(replica, id, previo));
  },
};
