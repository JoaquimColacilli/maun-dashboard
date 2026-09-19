import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import {
  aplicarFilaLocal,
  debeReintentarse,
  filasDe,
  generarElEnlace,
  guardarElToken,
  householdDe,
  quitarFilaLocal,
  revocarElEnlace,
  type EnlaceNuevo,
  type Replica,
} from '@/shared/api';
import { claveDeTodaReplica } from '@/shared/lib';

import type { Enlace } from '../model/enlaces';

export const CLAVE_DE_ENLACE = ['enlaces', 'generar'] as const;
export const CLAVE_DE_BAJA_DE_ENLACE = ['enlaces', 'dar-de-baja'] as const;
export const CLAVE_DE_TOKEN_DE_ENLACE = ['enlaces', 'guardar-token'] as const;

const REINTENTOS = 3;

const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

export interface GeneracionDeEnlace {
  nuevo: EnlaceNuevo;
  revocar: Enlace | null;
  momento: string;
}

export interface BajaDeEnlace {
  enlace: Enlace;
  momento: string;
}

export interface TokenDeEnlace {
  id: string;
  token: string;
}

function cambiarReplicas(cliente: QueryClient, cambio: (replica: Replica) => Replica): void {
  cliente.setQueriesData<Replica>({ queryKey: claveDeTodaReplica() }, (previa) =>
    previa ? cambio(previa) : previa,
  );
}

function conElEnlace(replica: Replica, { nuevo, revocar, momento }: GeneracionDeEnlace): Replica {
  const household = householdDe(replica);
  if (!household) return replica;

  const apagado =
    revocar === null
      ? replica
      : aplicarFilaLocal(replica, 'enlaces_publicos', {
          ...revocar,
          revocado_at: momento,
          updated_at: momento,
          version: revocar.version + 1,
        });

  return aplicarFilaLocal(apagado, 'enlaces_publicos', {
    ...nuevo,
    household_id: household.id,
    revocado_at: null,
    visitas: 0,
    ultima_visita_at: null,
    created_at: momento,
    updated_at: momento,
    deleted_at: null,
    version: 1,
  } satisfies Enlace);
}

function conLasFilas(replica: Replica, filas: readonly Enlace[]): Replica {
  let siguiente = replica;
  for (const fila of filas) siguiente = aplicarFilaLocal(siguiente, 'enlaces_publicos', fila);
  return siguiente;
}

export const MUTACION_DE_ENLACE: MutationOptions<Enlace[], unknown, GeneracionDeEnlace> = {
  mutationKey: CLAVE_DE_ENLACE,
  mutationFn: ({ nuevo, revocar, momento }) =>
    generarElEnlace(nuevo, revocar === null ? null : { id: revocar.id, revocadoEn: momento }),
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: (generacion, { client }) => {
    cambiarReplicas(client, (replica) => conElEnlace(replica, generacion));
  },
  onSuccess: (filas, _generacion, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => conLasFilas(replica, filas));
  },
  onError: (_error, { nuevo, revocar }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => {
      const sinElNuevo = quitarFilaLocal(replica, 'enlaces_publicos', nuevo.id);
      return revocar === null
        ? sinElNuevo
        : aplicarFilaLocal(sinElNuevo, 'enlaces_publicos', revocar);
    });
  },
};

// El relleno solo sabe de la dirección: toma esa columna de lo que contestó la base y deja el resto
// de la fila como está. Pisar la fila entera podría devolverle la vida a un enlace que se dio de
// baja mientras el relleno viajaba (ADR 0052).
function conLaDireccion(replica: Replica, fila: Enlace): Replica {
  const local = filasDe(replica, 'enlaces_publicos').find((enlace) => enlace.id === fila.id);
  if (local === undefined) return replica;
  return aplicarFilaLocal(replica, 'enlaces_publicos', { ...local, token: fila.token });
}

export const MUTACION_DE_TOKEN_DE_ENLACE: MutationOptions<Enlace | null, unknown, TokenDeEnlace> = {
  mutationKey: CLAVE_DE_TOKEN_DE_ENLACE,
  mutationFn: ({ id, token }) => guardarElToken(id, token),
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onSuccess: (fila, _token, _contexto, { client }) => {
    if (fila === null) return;
    cambiarReplicas(client, (replica) => conLaDireccion(replica, fila));
  },
};

export const MUTACION_DE_BAJA_DE_ENLACE: MutationOptions<Enlace, unknown, BajaDeEnlace> = {
  mutationKey: CLAVE_DE_BAJA_DE_ENLACE,
  mutationFn: ({ enlace, momento }) => revocarElEnlace(enlace.id, momento),
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: ({ enlace, momento }, { client }) => {
    cambiarReplicas(client, (replica) =>
      aplicarFilaLocal(replica, 'enlaces_publicos', {
        ...enlace,
        revocado_at: momento,
        updated_at: momento,
        version: enlace.version + 1,
      }),
    );
  },
  onSuccess: (fila, _baja, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'enlaces_publicos', fila));
  },
  onError: (_error, { enlace }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'enlaces_publicos', enlace));
  },
};
