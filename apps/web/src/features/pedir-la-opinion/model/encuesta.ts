import { encuestaBase, propiasDelTrabajo, type PreguntaGuardada } from '@maun/domain';

import { preguntaGuardada } from '@/entities/opinion';
import { filasDe, type Replica } from '@/shared/api';

export function loQueVaARecibir(replica: Replica, proyectoId: string): PreguntaGuardada[] {
  const guardadas = filasDe(replica, 'preguntas').map(preguntaGuardada);
  return [...encuestaBase(guardadas).vigentes, ...propiasDelTrabajo(guardadas, proyectoId)];
}

export function siguienteOrdenDePropia(propias: readonly PreguntaGuardada[]): number {
  return Math.max(0, ...propias.map((propia) => propia.orden)) + 10;
}
