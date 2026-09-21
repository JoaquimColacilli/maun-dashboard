import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import { filaPorId, type PreguntaParaGuardar, type Replica } from '@/shared/api';
import { claveDeTodaReplica, metaDeAvisos, type QueSeGuarda } from '@/shared/lib';

import type { FilaDePregunta } from '../model/datos';
import { MUTACION_DE_PREGUNTA } from './mutacion';

export function mandarALaCola<TDatos, TVariables>(
  cliente: QueryClient,
  opciones: MutationOptions<TDatos, unknown, TVariables>,
  variables: TVariables,
): void {
  void cliente
    .getMutationCache()
    .build(cliente, opciones)
    .execute(variables)
    .catch(() => undefined);
}

export function paraGuardar(fila: FilaDePregunta): PreguntaParaGuardar {
  return {
    id: fila.id,
    serie: fila.serie,
    numero: fila.numero,
    proyecto_id: fila.proyecto_id,
    orden: fila.orden,
    texto: fila.texto,
    tipo: fila.tipo,
    escala: fila.escala,
    obligatoria: fila.obligatoria,
    opciones: fila.opciones,
    archivada_at: fila.archivada_at,
    deleted_at: fila.deleted_at,
  };
}

export function preguntaEnLaReplica(cliente: QueryClient, id: string): FilaDePregunta | undefined {
  for (const [, replica] of cliente.getQueriesData<Replica>({ queryKey: claveDeTodaReplica() })) {
    const fila = replica === undefined ? undefined : filaPorId(replica, 'preguntas', id);
    if (fila) return fila;
  }
  return undefined;
}

export function guardarPreguntaEnLaCola(
  cliente: QueryClient,
  fila: PreguntaParaGuardar,
  titular: boolean,
  previa: FilaDePregunta | null,
  que: QueSeGuarda = 'pregunta',
): void {
  mandarALaCola(
    cliente,
    { ...MUTACION_DE_PREGUNTA, meta: metaDeAvisos(que, { silencioso: true, sujeto: fila.texto }) },
    { fila, titular, previa },
  );
}
