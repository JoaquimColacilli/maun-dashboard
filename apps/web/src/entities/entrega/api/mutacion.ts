import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import {
  aplicarFilaLocal,
  debeReintentarse,
  householdDe,
  marcarLaRespuestaDeEntregaLeida,
  proponerleLaEntrega,
  quitarFilaLocal,
  type PropuestaNueva,
  type Replica,
} from '@/shared/api';
import { claveDeTodaReplica, COLA_DE_SALIDA, guardarCacheAhora } from '@/shared/lib';

import type { FilaDePropuesta, FilaDeRespuestaDeEntrega } from '../model/datos';

export const CLAVE_DE_PROPUESTA_DE_ENTREGA = ['entregas', 'proponer'] as const;
export const CLAVE_DE_LECTURA_DE_ENTREGA = ['entregas', 'leer'] as const;

const REINTENTOS_EN_LINEA = 3;

const REINTENTOS_DE_LA_COLA = 5;

const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

export interface PropuestaDeEntrega {
  proyectoId: string;
  nueva: PropuestaNueva | null;
  abierta: FilaDePropuesta | null;
  momento: string;
}

export interface LecturaDeEntrega {
  respuesta: FilaDeRespuestaDeEntrega;
  momento: string;
}

function cambiarReplicas(cliente: QueryClient, cambio: (replica: Replica) => Replica): void {
  cliente.setQueriesData<Replica>({ queryKey: claveDeTodaReplica() }, (previa) =>
    previa ? cambio(previa) : previa,
  );
}

function conLaPropuesta(
  replica: Replica,
  { proyectoId, nueva, abierta, momento }: PropuestaDeEntrega,
): Replica {
  const household = householdDe(replica);
  if (!household) return replica;

  const cerrada =
    abierta === null
      ? replica
      : aplicarFilaLocal(replica, 'propuestas_de_entrega', {
          ...abierta,
          cerrada_at: momento,
          updated_at: momento,
          version: abierta.version + 1,
        });
  if (nueva === null) return cerrada;

  return aplicarFilaLocal(cerrada, 'propuestas_de_entrega', {
    ...nueva,
    household_id: household.id,
    proyecto_id: proyectoId,
    cerrada_at: null,
    created_at: momento,
    updated_at: momento,
    deleted_at: null,
    version: 1,
  } satisfies FilaDePropuesta);
}

function conLasFilas(replica: Replica, filas: readonly FilaDePropuesta[]): Replica {
  let siguiente = replica;
  for (const fila of filas) siguiente = aplicarFilaLocal(siguiente, 'propuestas_de_entrega', fila);
  return siguiente;
}

export const MUTACION_DE_PROPUESTA_DE_ENTREGA: MutationOptions<
  FilaDePropuesta[],
  unknown,
  PropuestaDeEntrega
> = {
  mutationKey: CLAVE_DE_PROPUESTA_DE_ENTREGA,
  mutationFn: ({ proyectoId, nueva }) => proponerleLaEntrega(proyectoId, nueva),
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS_EN_LINEA && debeReintentarse(error),
  onMutate: (propuesta, { client }) => {
    cambiarReplicas(client, (replica) => conLaPropuesta(replica, propuesta));
  },
  onSuccess: (filas, _propuesta, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => conLasFilas(replica, filas));
  },
  onError: (_error, { nueva, abierta }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => {
      const sinLaNueva =
        nueva === null ? replica : quitarFilaLocal(replica, 'propuestas_de_entrega', nueva.id);
      return abierta === null
        ? sinLaNueva
        : aplicarFilaLocal(sinLaNueva, 'propuestas_de_entrega', abierta);
    });
  },
};

export const MUTACION_DE_LECTURA_DE_ENTREGA: MutationOptions<
  FilaDeRespuestaDeEntrega,
  unknown,
  LecturaDeEntrega
> = {
  mutationKey: CLAVE_DE_LECTURA_DE_ENTREGA,
  mutationFn: ({ respuesta, momento }) => marcarLaRespuestaDeEntregaLeida(respuesta.id, momento),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS_DE_LA_COLA && debeReintentarse(error),
  onMutate: async ({ respuesta, momento }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) =>
      aplicarFilaLocal(replica, 'respuestas_de_entrega', {
        ...respuesta,
        leida_at: momento,
        updated_at: momento,
        version: respuesta.version + 1,
      }),
    );
    await guardarCacheAhora();
  },
  onSuccess: (fila, _lectura, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'respuestas_de_entrega', fila));
  },
  onError: (_error, { respuesta }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) =>
      aplicarFilaLocal(replica, 'respuestas_de_entrega', respuesta),
    );
  },
};
