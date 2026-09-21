import {
  cuantasPreguntas,
  duracion,
  elMueble,
  menosDe,
  type PreguntaDeLaEncuesta,
} from '@maun/domain';

export const AVISO_DE_FIRMA =
  'Como el enlace es de tu trabajo, el taller va a saber que esto lo contestaste vos. Contá lo que pensás igual: para eso lo mandamos.';

export const AYUDA_DEL_COMENTARIO = 'Es opcional, pero es lo que más nos sirve.';

export function tituloDeLaEncuesta(trabajo: string): string {
  return `¿Cómo te fue con tu ${elMueble(trabajo)}?`;
}

export function bajadaDeLaEncuesta(preguntas: readonly PreguntaDeLaEncuesta[]): string {
  const tipos = preguntas.map((pregunta) => pregunta.tipo);
  return `${cuantasPreguntas(tipos)} y te lleva ${menosDe(duracion(tipos).segundos)}. Lo lee el dueño del taller.`;
}

export function faltanPreguntas(cuantas: number): string {
  return cuantas === 1
    ? 'Te falta una pregunta, está marcada más arriba.'
    : `Te faltan ${String(cuantas)} preguntas, están marcadas más arriba.`;
}
