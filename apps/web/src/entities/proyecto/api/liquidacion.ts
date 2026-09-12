import type { EstadoProyecto } from '@maun/domain';
import { useMutationState, type MutationOptions, type QueryClient } from '@tanstack/react-query';

import {
  aplicarFilaLocal,
  debeReintentarse,
  liquidarElProyecto,
  revertirLaLiquidacion,
  traducirRechazo,
  type FilaDe,
  type OperacionRechazada,
  type PedidoDeLiquidacion,
  type PedidoDeReversion,
  type Replica,
} from '@/shared/api';
import {
  anotarAviso,
  claveDeTodaReplica,
  COLA_DE_SALIDA,
  formatearPesos,
  limpiarRechazosDelProyecto,
  uuidv7,
} from '@/shared/lib';

import { ajusteDeLaLiquidacion } from '../model/liquidacion';
import { rutaDelProyecto } from '../model/rutas';

export const CLAVE_DE_LIQUIDACION = ['proyectos', 'liquidar'] as const;
export const CLAVE_DE_REVERSION = ['proyectos', 'revertir'] as const;

const REINTENTOS = 5;

const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

export interface LiquidacionDeProyecto {
  pedido: PedidoDeLiquidacion;
  optimista: FilaDe<'proyectos'>;
  previo: FilaDe<'proyectos'>;
  titulo: string;
}

export interface ReversionDeProyecto {
  pedido: PedidoDeReversion;
  optimista: FilaDe<'proyectos'>;
  previo: FilaDe<'proyectos'>;
  titulo: string;
}

export type OperacionDeLiquidacion = 'cobro' | 'cierre' | 'reapertura' | 'reactivacion';

const ETIQUETA: Readonly<Record<OperacionDeLiquidacion, string>> = {
  cobro: 'Cobro',
  cierre: 'Cierre como perdido',
  reapertura: 'Reapertura del cobro',
  reactivacion: 'Reactivación del presupuesto',
};

export function operacionDeLiquidacion(pedido: PedidoDeLiquidacion): OperacionDeLiquidacion {
  return pedido.destino === 'cobrado' ? 'cobro' : 'cierre';
}

export function operacionDeReversion(pedido: PedidoDeReversion): OperacionDeLiquidacion {
  return pedido.desde === 'cobrado' ? 'reapertura' : 'reactivacion';
}

function cambiarReplicas(cliente: QueryClient, cambio: (replica: Replica) => Replica): void {
  cliente.setQueriesData<Replica>({ queryKey: claveDeTodaReplica() }, (previa) =>
    previa ? cambio(previa) : previa,
  );
}

function anotarElRechazo(
  cliente: QueryClient,
  error: unknown,
  operacion: OperacionDeLiquidacion,
  proyectoId: string,
  titulo: string,
  estado: 'cobrado' | 'perdido',
): void {
  const traducido = traducirRechazo(error, {
    operacion: operacion satisfies OperacionRechazada,
    sujeto: titulo,
    estado,
  });
  if (!traducido) return;

  anotarAviso(cliente, {
    id: uuidv7(),
    tipo: 'rechazo',
    cuando: new Date().toISOString(),
    operacion: ETIQUETA[operacion],
    sujeto: titulo,
    titulo: traducido.titulo,
    detalle: traducido.queHacer,
    codigo: traducido.codigo,
    proyectoId,
    ruta: rutaDelProyecto(proyectoId),
  });
}

function anotarElAjuste(
  cliente: QueryClient,
  fila: FilaDe<'proyectos'>,
  { pedido, titulo }: LiquidacionDeProyecto,
): void {
  const ajuste = ajusteDeLaLiquidacion(fila, pedido);
  if (!ajuste) return;

  const detalle = ajuste.diferencias
    .map(
      (diferencia) =>
        `${diferencia.etiqueta}: esperabas ${formatearPesos(diferencia.esperado)} y quedó en ${formatearPesos(diferencia.quedo)}, porque el mes ya llevaba ${formatearPesos(diferencia.yaLlevabaElMes)} de otra liquidación.`,
    )
    .join(' ');

  anotarAviso(cliente, {
    id: uuidv7(),
    tipo: 'ajuste',
    cuando: new Date().toISOString(),
    operacion: ETIQUETA[operacionDeLiquidacion(pedido)],
    sujeto: titulo,
    titulo: 'El reparto salió distinto del que viste.',
    detalle: `${detalle} La diferencia quedó en el remanente del taller: ${formatearPesos(ajuste.remanenteQuedo)} en vez de ${formatearPesos(ajuste.remanenteEsperado)}.`,
    codigo: '',
    proyectoId: pedido.proyectoId,
    ruta: rutaDelProyecto(pedido.proyectoId),
  });
}

export const MUTACION_DE_LIQUIDACION: MutationOptions<
  FilaDe<'proyectos'>,
  unknown,
  LiquidacionDeProyecto
> = {
  mutationKey: CLAVE_DE_LIQUIDACION,
  mutationFn: ({ pedido }) => liquidarElProyecto(pedido),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ optimista }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'proyectos', optimista));
  },
  onSuccess: (fila, variables, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'proyectos', fila));
    limpiarRechazosDelProyecto(client, variables.pedido.proyectoId);
    anotarElAjuste(client, fila, variables);
  },
  onError: (error, { pedido, previo, titulo }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'proyectos', previo));
    anotarElRechazo(
      client,
      error,
      operacionDeLiquidacion(pedido),
      pedido.proyectoId,
      titulo,
      pedido.destino,
    );
  },
};

export const MUTACION_DE_REVERSION: MutationOptions<
  FilaDe<'proyectos'>,
  unknown,
  ReversionDeProyecto
> = {
  mutationKey: CLAVE_DE_REVERSION,
  mutationFn: ({ pedido }) => revertirLaLiquidacion(pedido),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS && debeReintentarse(error),
  onMutate: async ({ optimista }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'proyectos', optimista));
  },
  onSuccess: (fila, { pedido }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'proyectos', fila));
    limpiarRechazosDelProyecto(client, pedido.proyectoId);
  },
  onError: (error, { pedido, previo, titulo }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'proyectos', previo));
    anotarElRechazo(
      client,
      error,
      operacionDeReversion(pedido),
      pedido.proyectoId,
      titulo,
      pedido.desde,
    );
  },
};

export interface LiquidacionEnVuelo {
  proyectoId: string;
  operacion: OperacionDeLiquidacion;
  destino: EstadoProyecto;
  enPausa: boolean;
}

function enVuelo(variables: unknown, enPausa: boolean): LiquidacionEnVuelo | undefined {
  if (typeof variables !== 'object' || variables === null || !('pedido' in variables)) {
    return undefined;
  }
  const { pedido } = variables;
  if (typeof pedido !== 'object' || pedido === null || !('proyectoId' in pedido)) return undefined;

  if ('destino' in pedido) {
    const liquidacion = pedido as PedidoDeLiquidacion;
    return {
      proyectoId: liquidacion.proyectoId,
      operacion: operacionDeLiquidacion(liquidacion),
      destino: liquidacion.destino,
      enPausa,
    };
  }

  const reversion = pedido as PedidoDeReversion;
  return {
    proyectoId: reversion.proyectoId,
    operacion: operacionDeReversion(reversion),
    destino: reversion.hacia,
    enPausa,
  };
}

export function useLiquidacionesEnVuelo(): readonly LiquidacionEnVuelo[] {
  return useMutationState({
    filters: { status: 'pending' },
    select: (mutacion) => enVuelo(mutacion.state.variables, mutacion.state.isPaused),
  }).filter((pendiente): pendiente is LiquidacionEnVuelo => pendiente !== undefined);
}

export function useLiquidacionEnVuelo(proyectoId: string): LiquidacionEnVuelo | undefined {
  return useLiquidacionesEnVuelo().find((pendiente) => pendiente.proyectoId === proyectoId);
}
