import { useMutationState, type MutationOptions, type QueryClient } from '@tanstack/react-query';

import {
  aplicarFilaLocal,
  darDeBajaMovimiento,
  debeReintentarse,
  editarMovimiento,
  filaPorId,
  householdDe,
  quitarFilaLocal,
  registrarMovimiento,
  type CambiosDeMovimiento,
  type FilaDe,
  type MovimientoNuevo,
  type Replica,
} from '@/shared/api';
import { claveDeTodaReplica, COLA_DE_SALIDA, guardarCacheAhora } from '@/shared/lib';

export const CLAVE_DE_MOVIMIENTO = ['movimientos', 'registrar'] as const;
export const CLAVE_DE_EDICION_DE_MOVIMIENTO = ['movimientos', 'editar'] as const;
export const CLAVE_DE_BAJA_DE_MOVIMIENTO = ['movimientos', 'borrar'] as const;

const REINTENTOS = 5;

const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

export interface EdicionDeMovimiento {
  id: string;
  cambios: CambiosDeMovimiento;
  previos: CambiosDeMovimiento;
}

export interface BajaDeMovimiento {
  id: string;
  borradoEn: string;
  previo: FilaDe<'movimientos'>;
}

function cambiarReplicas(cliente: QueryClient, cambio: (replica: Replica) => Replica): void {
  cliente.setQueriesData<Replica>({ queryKey: claveDeTodaReplica() }, (previa) =>
    previa ? cambio(previa) : previa,
  );
}

function conFilaOptimista(replica: Replica, movimiento: MovimientoNuevo): Replica {
  const household = householdDe(replica);
  if (!household) return replica;

  const ahora = new Date().toISOString();
  const fila = {
    id: movimiento.id,
    household_id: household.id,
    fecha: movimiento.fecha,
    tipo: movimiento.tipo,
    tesoro_origen: movimiento.tesoro_origen ?? null,
    tesoro_destino: movimiento.tesoro_destino ?? null,
    monto_centavos: movimiento.monto_centavos,
    categoria: movimiento.categoria ?? '',
    descripcion: movimiento.descripcion ?? '',
    proyecto_id: null,
    created_at: ahora,
    updated_at: ahora,
    deleted_at: null,
    version: 1,
  } satisfies FilaDe<'movimientos'>;

  return aplicarFilaLocal(replica, 'movimientos', fila);
}

function conCambios(replica: Replica, id: string, cambios: CambiosDeMovimiento): Replica {
  const actual = filaPorId(replica, 'movimientos', id);
  if (!actual) return replica;
  return aplicarFilaLocal(replica, 'movimientos', { ...actual, ...cambios });
}

export const MUTACION_DE_MOVIMIENTO: MutationOptions<
  FilaDe<'movimientos'>,
  unknown,
  MovimientoNuevo
> = {
  mutationKey: CLAVE_DE_MOVIMIENTO,
  mutationFn: registrarMovimiento,
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async (movimiento, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conFilaOptimista(replica, movimiento));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _movimiento, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'movimientos', fila));
  },
  onError: (_error, movimiento, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => quitarFilaLocal(replica, 'movimientos', movimiento.id));
  },
};

export const MUTACION_DE_EDICION_DE_MOVIMIENTO: MutationOptions<
  FilaDe<'movimientos'>,
  unknown,
  EdicionDeMovimiento
> = {
  mutationKey: CLAVE_DE_EDICION_DE_MOVIMIENTO,
  mutationFn: ({ id, cambios }) => editarMovimiento(id, cambios),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id, cambios }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conCambios(replica, id, cambios));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'movimientos', fila));
  },
  onError: (_error, { id, previos }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => conCambios(replica, id, previos));
  },
};

export const MUTACION_DE_BAJA_DE_MOVIMIENTO: MutationOptions<
  FilaDe<'movimientos'>,
  unknown,
  BajaDeMovimiento
> = {
  mutationKey: CLAVE_DE_BAJA_DE_MOVIMIENTO,
  mutationFn: ({ id, borradoEn }) => darDeBajaMovimiento(id, borradoEn),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ id }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => quitarFilaLocal(replica, 'movimientos', id));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'movimientos', fila));
  },
  onError: (_error, { previo }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'movimientos', previo));
  },
};

function idDelMovimiento(variables: unknown): string | undefined {
  if (typeof variables !== 'object' || variables === null) return undefined;
  const { id } = variables as { id?: unknown };
  return typeof id === 'string' ? id : undefined;
}

export function useMovimientosEnVuelo(): ReadonlySet<string> {
  const ids = useMutationState({
    filters: { status: 'pending' },
    select: (mutacion) => {
      const clave = mutacion.options.mutationKey?.[0];
      if (clave !== 'movimientos') return undefined;
      return idDelMovimiento(mutacion.state.variables);
    },
  });
  return new Set(ids.filter((id): id is string => id !== undefined));
}
