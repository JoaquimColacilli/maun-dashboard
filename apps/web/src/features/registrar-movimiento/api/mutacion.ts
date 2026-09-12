import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import { claveDeTodaReplica } from '@/entities/replica';
import {
  aplicarFilaLocal,
  debeReintentarse,
  householdDe,
  quitarFilaLocal,
  registrarMovimiento,
  type FilaDe,
  type MovimientoNuevo,
  type Replica,
} from '@/shared/api';
import { COLA_DE_SALIDA, guardarCacheAhora } from '@/shared/lib';

export const CLAVE_DE_MOVIMIENTO = ['movimientos', 'registrar'] as const;

const REINTENTOS = 5;

// La mutación rechazada es lo único que queda del cambio que el usuario cargó: con el gcTime por
// defecto, a los cinco minutos desaparece y el aviso de "no se pudo guardar" con ella.
const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

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
    // Una sincronización en vuelo terminaría escribiendo la réplica que leyó antes de esta fila.
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
