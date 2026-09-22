import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import {
  aplicarFilaLocal,
  darDeBajaLaEncuesta,
  debeReintentarse,
  guardarLaPregunta,
  householdDe,
  mandarLaEncuesta,
  marcarLaOpinionLeida,
  quitarFilaLocal,
  recordarLaEncuesta,
  type EncuestaNueva,
  type PreguntaParaGuardar,
  type Replica,
} from '@/shared/api';
import { claveDeTodaReplica, COLA_DE_SALIDA, guardarCacheAhora } from '@/shared/lib';

import type { FilaDeEncuesta, FilaDePregunta, FilaDeRespuesta } from '../model/datos';

export const CLAVE_DE_PREGUNTA = ['preguntas', 'guardar'] as const;
export const CLAVE_DE_LECTURA = ['respuestas', 'leer'] as const;
export const CLAVE_DE_RECORDATORIO = ['encuestas', 'recordar'] as const;
export const CLAVE_DE_ENCUESTA = ['encuestas', 'mandar'] as const;
export const CLAVE_DE_BAJA_DE_ENCUESTA = ['encuestas', 'dar-de-baja'] as const;

const REINTENTOS_DE_LA_COLA = 5;

const REINTENTOS_EN_LINEA = 3;

const DURACION_DEL_RECHAZO_MS = 24 * 60 * 60 * 1000;

export interface GuardadoDePregunta {
  fila: PreguntaParaGuardar;
  titular: boolean;
  previa: FilaDePregunta | null;
}

export interface LecturaDeOpinion {
  respuesta: FilaDeRespuesta;
  momento: string;
}

export interface RecordatorioDeEncuesta {
  encuesta: FilaDeEncuesta;
  momento: string;
}

export interface EnvioDeEncuesta {
  nueva: EncuestaNueva;
  revocar: FilaDeEncuesta | null;
  momento: string;
}

export interface BajaDeEncuesta {
  encuesta: FilaDeEncuesta;
  momento: string;
}

function cambiarReplicas(cliente: QueryClient, cambio: (replica: Replica) => Replica): void {
  cliente.setQueriesData<Replica>({ queryKey: claveDeTodaReplica() }, (previa) =>
    previa ? cambio(previa) : previa,
  );
}

function conLaPregunta(replica: Replica, { fila, titular, previa }: GuardadoDePregunta): Replica {
  const household = householdDe(replica);
  if (!household) return replica;
  const ahora = new Date().toISOString();
  return aplicarFilaLocal(replica, 'preguntas', {
    ...fila,
    household_id: household.id,
    titular,
    cantidad_de_opciones: fila.opciones?.length ?? 0,
    created_at: previa?.created_at ?? ahora,
    updated_at: ahora,
    version: previa === null ? 1 : previa.version + 1,
  } satisfies FilaDePregunta);
}

export const MUTACION_DE_PREGUNTA: MutationOptions<FilaDePregunta, unknown, GuardadoDePregunta> = {
  mutationKey: CLAVE_DE_PREGUNTA,
  mutationFn: ({ fila }) => guardarLaPregunta(fila),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS_DE_LA_COLA && debeReintentarse(error),
  onMutate: async (guardado, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) => conLaPregunta(replica, guardado));
    await guardarCacheAhora();
  },
  onSuccess: (fila, _guardado, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'preguntas', fila));
  },
  onError: (_error, { fila, previa }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) =>
      previa === null
        ? quitarFilaLocal(replica, 'preguntas', fila.id)
        : aplicarFilaLocal(replica, 'preguntas', previa),
    );
  },
};

export const MUTACION_DE_LECTURA: MutationOptions<FilaDeRespuesta, unknown, LecturaDeOpinion> = {
  mutationKey: CLAVE_DE_LECTURA,
  mutationFn: ({ respuesta, momento }) => marcarLaOpinionLeida(respuesta.id, momento),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS_DE_LA_COLA && debeReintentarse(error),
  onMutate: async ({ respuesta, momento }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) =>
      aplicarFilaLocal(replica, 'respuestas', {
        ...respuesta,
        leida_at: momento,
        updated_at: momento,
        version: respuesta.version + 1,
      }),
    );
    await guardarCacheAhora();
  },
  onSuccess: (fila, _lectura, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'respuestas', fila));
  },
  onError: (_error, { respuesta }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'respuestas', respuesta));
  },
};

export const MUTACION_DE_RECORDATORIO: MutationOptions<
  FilaDeEncuesta,
  unknown,
  RecordatorioDeEncuesta
> = {
  mutationKey: CLAVE_DE_RECORDATORIO,
  mutationFn: ({ encuesta, momento }) => recordarLaEncuesta(encuesta.id, momento),
  scope: COLA_DE_SALIDA,
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS_DE_LA_COLA && debeReintentarse(error),
  onMutate: async ({ encuesta, momento }, { client }) => {
    await client.cancelQueries({ queryKey: claveDeTodaReplica() });
    cambiarReplicas(client, (replica) =>
      aplicarFilaLocal(replica, 'encuestas_enviadas', {
        ...encuesta,
        recordada_at: encuesta.recordada_at ?? momento,
        updated_at: momento,
        version: encuesta.version + 1,
      }),
    );
    await guardarCacheAhora();
  },
  onSuccess: (fila, _recordatorio, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'encuestas_enviadas', fila));
  },
  onError: (_error, { encuesta }, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'encuestas_enviadas', encuesta));
  },
};

function conLasFilas(replica: Replica, filas: readonly FilaDeEncuesta[]): Replica {
  let siguiente = replica;
  for (const fila of filas) siguiente = aplicarFilaLocal(siguiente, 'encuestas_enviadas', fila);
  return siguiente;
}

export const MUTACION_DE_ENCUESTA: MutationOptions<FilaDeEncuesta[], unknown, EnvioDeEncuesta> = {
  mutationKey: CLAVE_DE_ENCUESTA,
  mutationFn: ({ nueva, revocar, momento }) =>
    mandarLaEncuesta(nueva, revocar === null ? null : { id: revocar.id, revocadaEn: momento }),
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS_EN_LINEA && debeReintentarse(error),
  onSuccess: (filas, _envio, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => conLasFilas(replica, filas));
  },
};

export const MUTACION_DE_BAJA_DE_ENCUESTA: MutationOptions<
  FilaDeEncuesta,
  unknown,
  BajaDeEncuesta
> = {
  mutationKey: CLAVE_DE_BAJA_DE_ENCUESTA,
  mutationFn: ({ encuesta, momento }) => darDeBajaLaEncuesta(encuesta.id, momento),
  gcTime: DURACION_DEL_RECHAZO_MS,
  retry: (intentos, error) => intentos < REINTENTOS_EN_LINEA && debeReintentarse(error),
  onSuccess: (fila, _baja, _contexto, { client }) => {
    cambiarReplicas(client, (replica) => aplicarFilaLocal(replica, 'encuestas_enviadas', fila));
  },
};
