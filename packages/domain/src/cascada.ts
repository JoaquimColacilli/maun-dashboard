import {
  aplicarPorcentaje,
  CERO,
  esNegativo,
  minimo,
  puntosBasicos,
  restar,
  type Money,
  type PuntosBasicos,
} from './money.ts';

export const DIEZMO: PuntosBasicos = puntosBasicos(1_000);

export interface EntradaCascada {
  cobrado: Money;
  gastos: Money;
  diezmoBp: PuntosBasicos;
  topeSueldo: Money;
  topeFijos: Money;
}

export interface Distribucion extends EntradaCascada {
  neta: Money;
  diezmo: Money;
  sueldo: Money;
  fijos: Money;
  remanente: Money;
  faltaSueldo: Money;
  faltaFijos: Money;
}

function exigirNoNegativo(nombre: string, importe: Money): void {
  if (esNegativo(importe)) {
    throw new RangeError(`${nombre} no puede ser negativo.`);
  }
}

export function calcularDistribucion(entrada: EntradaCascada): Distribucion {
  exigirNoNegativo('Lo cobrado', entrada.cobrado);
  exigirNoNegativo('Los gastos', entrada.gastos);
  exigirNoNegativo('El tope de sueldo', entrada.topeSueldo);
  exigirNoNegativo('El tope de costos fijos', entrada.topeFijos);
  puntosBasicos(entrada.diezmoBp);

  const neta = restar(entrada.cobrado, entrada.gastos);

  if (neta <= 0) {
    return {
      ...entrada,
      neta,
      diezmo: CERO,
      sueldo: CERO,
      fijos: CERO,
      remanente: neta,
      faltaSueldo: entrada.topeSueldo,
      faltaFijos: entrada.topeFijos,
    };
  }

  const diezmo = aplicarPorcentaje(neta, entrada.diezmoBp);
  const trasDiezmo = restar(neta, diezmo);
  const sueldo = minimo(entrada.topeSueldo, trasDiezmo);
  const trasSueldo = restar(trasDiezmo, sueldo);
  const fijos = minimo(entrada.topeFijos, trasSueldo);
  const remanente = restar(trasSueldo, fijos);

  return {
    ...entrada,
    neta,
    diezmo,
    sueldo,
    fijos,
    remanente,
    faltaSueldo: restar(entrada.topeSueldo, sueldo),
    faltaFijos: restar(entrada.topeFijos, fijos),
  };
}
