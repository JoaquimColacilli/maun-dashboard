declare const marcaMoney: unique symbol;
declare const marcaPuntosBasicos: unique symbol;

export type Money = number & { readonly [marcaMoney]: 'Money' };

export type PuntosBasicos = number & { readonly [marcaPuntosBasicos]: 'PuntosBasicos' };

export const BASE_PUNTOS_BASICOS = 10_000;

export function centavos(valor: number): Money {
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError(`Un importe es un entero de centavos: ${String(valor)} no lo es.`);
  }
  return valor as Money;
}

export const CERO: Money = centavos(0);

export function sumar(a: Money, b: Money): Money {
  return centavos(a + b);
}

export function restar(a: Money, b: Money): Money {
  return centavos(a - b);
}

export function sumarTodos(importes: Iterable<Money>): Money {
  let total = CERO;
  for (const importe of importes) total = sumar(total, importe);
  return total;
}

export function minimo(a: Money, b: Money): Money {
  return a <= b ? a : b;
}

export function maximo(a: Money, b: Money): Money {
  return a >= b ? a : b;
}

export function esNegativo(importe: Money): boolean {
  return importe < 0;
}

export function puntosBasicos(valor: number): PuntosBasicos {
  if (!Number.isInteger(valor) || valor < 0 || valor > BASE_PUNTOS_BASICOS) {
    throw new RangeError(
      `Un porcentaje va en puntos básicos enteros entre 0 y ${String(BASE_PUNTOS_BASICOS)}: ${String(valor)} no lo es.`,
    );
  }
  return valor as PuntosBasicos;
}

export function aplicarPorcentaje(importe: Money, porcentaje: PuntosBasicos): Money {
  if (esNegativo(importe)) {
    throw new RangeError('Un porcentaje se aplica sobre un importe no negativo.');
  }
  const numerador = importe * porcentaje + BASE_PUNTOS_BASICOS / 2;
  if (!Number.isSafeInteger(numerador)) {
    throw new RangeError(
      'El importe es demasiado grande para aplicarle un porcentaje con exactitud.',
    );
  }
  return centavos(Math.floor(numerador / BASE_PUNTOS_BASICOS));
}
