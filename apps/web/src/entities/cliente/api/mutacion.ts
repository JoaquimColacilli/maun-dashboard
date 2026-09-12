import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import {
  aplicarFilaLocal,
  crearCliente,
  darDeBajaCliente,
  debeReintentarse,
  editarCliente,
  filaPorId,
  householdDe,
  quitarFilaLocal,
  type CambiosDeCliente,
  type ClienteNuevo,
  type FilaDe,
  type Replica,
} from '@/shared/api';
import { claveDeTodaReplica, COLA_DE_SALIDA, guardarCacheAhora } from '@/shared/lib';

export const CLAVE_DE_CLIENTE_NUEVO = ['clientes', 'crear'] as const;
export const CLAVE_DE_CLIENTE = ['clientes', 'editar'] as const;

const REINTENTOS = 5;

const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

export interface EdicionDeCliente {
  id: string;
  cambios: CambiosDeCliente;
  previos: CambiosDeCliente;
}

function cambiarReplicas(cliente: QueryClient, cambio: (replica: Replica) => Replica): void {
  cliente.setQueriesData<Replica>({ queryKey: claveDeTodaReplica() }, (previa) =>
    previa ? cambio(previa) : previa,
  );
}

function conClienteNuevo(replica: Replica, nuevo: ClienteNuevo): Replica {
  const household = householdDe(replica);
  if (!household) return replica;

  const ahora = new Date().toISOString();
  const fila = {
    ...nuevo,
    household_id: household.id,
    created_at: ahora,
    updated_at: ahora,
    deleted_at: null,
    version: 1,
  } satisfies FilaDe<'clientes'>;

  return aplicarFilaLocal(replica, 'clientes', fila);
}

function conCambios(replica: Replica, id: string, cambios: CambiosDeCliente): Replica {
  const actual = filaPorId(replica, 'clientes', id);
  if (!actual) return replica;
  return aplicarFilaLocal(replica, 'clientes', { ...actual, ...cambios });
}

export const MUTACION_DE_CLIENTE_NUEVO: MutationOptions<
  FilaDe<'clientes'>,
  unknown,
  ClienteNuevo
> = {
  mutationKey: CLAVE_DE_CLIENTE_NUEVO,
  mutationFn: crearCliente,
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async (nuevo, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conClienteNuevo(replica, nuevo));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _nuevo, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'clientes', fila));
  },
  onError: (_error, nuevo, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => quitarFilaLocal(replica, 'clientes', nuevo.id));
  },
};

export const MUTACION_DE_CLIENTE: MutationOptions<FilaDe<'clientes'>, unknown, EdicionDeCliente> = {
  mutationKey: CLAVE_DE_CLIENTE,
  mutationFn: ({ id, cambios }) => editarCliente(id, cambios),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id, cambios }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conCambios(replica, id, cambios));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'clientes', fila));
  },
  onError: (_error, { id, previos }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => conCambios(replica, id, previos));
  },
};

export const CLAVE_DE_BAJA_DE_CLIENTE = ['clientes', 'borrar'] as const;

export interface BajaDeCliente {
  id: string;
  borradoEn: string;
  previo: FilaDe<'clientes'>;
}

export const MUTACION_DE_BAJA_DE_CLIENTE: MutationOptions<
  FilaDe<'clientes'>,
  unknown,
  BajaDeCliente
> = {
  mutationKey: CLAVE_DE_BAJA_DE_CLIENTE,
  mutationFn: ({ id, borradoEn }) => darDeBajaCliente(id, borradoEn),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => quitarFilaLocal(replica, 'clientes', id));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'clientes', fila));
  },
  onError: (_error, { previo }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'clientes', previo));
  },
};
