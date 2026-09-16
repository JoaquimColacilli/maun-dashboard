import {
  aplicarPorcentaje,
  puntosBasicos,
  restar,
  type Money,
  type PuntosBasicos,
} from './money.ts';

export const SENA_HABITUAL: PuntosBasicos = puntosBasicos(5_000);

export interface EntradaDeLaSena {
  presupuesto: Money | null;
  cobrado: Money;
  porcentajeDelTaller: PuntosBasicos;
  porcentajeDelTrabajo: PuntosBasicos | null;
}

export type SenaDelTrabajo =
  | { situacion: 'sin-presupuesto' }
  | {
      situacion: 'falta';
      porcentaje: PuntosBasicos;
      esperada: Money;
      cobrado: Money;
      falta: Money;
    }
  | {
      situacion: 'cubierta';
      porcentaje: PuntosBasicos;
      esperada: Money;
      cobrado: Money;
      deMas: Money;
    };

export function porcentajeDeLaSena(
  porcentajeDelTrabajo: PuntosBasicos | null,
  porcentajeDelTaller: PuntosBasicos,
): PuntosBasicos {
  return porcentajeDelTrabajo ?? porcentajeDelTaller;
}

export function calcularSena(entrada: EntradaDeLaSena): SenaDelTrabajo {
  if (entrada.presupuesto === null) return { situacion: 'sin-presupuesto' };

  const porcentaje = porcentajeDeLaSena(entrada.porcentajeDelTrabajo, entrada.porcentajeDelTaller);
  const esperada = aplicarPorcentaje(entrada.presupuesto, porcentaje);
  const cobrado = entrada.cobrado;

  if (cobrado >= esperada) {
    return {
      situacion: 'cubierta',
      porcentaje,
      esperada,
      cobrado,
      deMas: restar(cobrado, esperada),
    };
  }

  return { situacion: 'falta', porcentaje, esperada, cobrado, falta: restar(esperada, cobrado) };
}
