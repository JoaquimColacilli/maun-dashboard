import { describe, expect, it } from 'vitest';

import { centavos, puntosBasicos, type Money, type PuntosBasicos } from './money.ts';
import { calcularSena, porcentajeDeLaSena, SENA_HABITUAL, type EntradaDeLaSena } from './sena.ts';

const LA_MITAD = SENA_HABITUAL;

function entrada(
  presupuesto: number | null,
  cobrado: number,
  extra: Partial<EntradaDeLaSena> = {},
): EntradaDeLaSena {
  return {
    presupuesto: presupuesto === null ? null : centavos(presupuesto),
    cobrado: centavos(cobrado),
    porcentajeDelTaller: LA_MITAD,
    porcentajeDelTrabajo: null,
    ...extra,
  };
}

describe('la seña que se espera para confirmar un trabajo', () => {
  it('sin presupuesto no hay nada que calcular', () => {
    expect(calcularSena(entrada(null, 0))).toEqual({ situacion: 'sin-presupuesto' });
  });

  it('sin presupuesto lo dice aunque ya haya cobrado algo en la visita', () => {
    expect(calcularSena(entrada(null, 15_000_000))).toEqual({ situacion: 'sin-presupuesto' });
  });

  it('con el porcentaje del taller, la seña es la mitad del presupuesto', () => {
    expect(calcularSena(entrada(230_000_000, 0))).toEqual({
      situacion: 'falta',
      porcentaje: LA_MITAD,
      esperada: 115_000_000,
      cobrado: 0,
      falta: 115_000_000,
    });
  });

  it('lo que ya cobró se descuenta: es el caso de la visita del relevamiento ya pagada', () => {
    expect(calcularSena(entrada(230_000_000, 15_000_000))).toEqual({
      situacion: 'falta',
      porcentaje: LA_MITAD,
      esperada: 115_000_000,
      cobrado: 15_000_000,
      falta: 100_000_000,
    });
  });

  it('cuando lo cobrado llega justo a la seña, está cubierta y no falta nada', () => {
    expect(calcularSena(entrada(230_000_000, 115_000_000))).toEqual({
      situacion: 'cubierta',
      porcentaje: LA_MITAD,
      esperada: 115_000_000,
      cobrado: 115_000_000,
      deMas: 0,
    });
  });

  it('cuando se pasó, dice cuánto de más, en vez de un negativo', () => {
    expect(calcularSena(entrada(230_000_000, 150_000_000))).toEqual({
      situacion: 'cubierta',
      porcentaje: LA_MITAD,
      esperada: 115_000_000,
      cobrado: 150_000_000,
      deMas: 35_000_000,
    });
  });

  it('el porcentaje propio del trabajo le gana al del taller', () => {
    const sena = calcularSena(
      entrada(230_000_000, 0, { porcentajeDelTrabajo: puntosBasicos(3_000) }),
    );
    expect(sena).toEqual({
      situacion: 'falta',
      porcentaje: 3_000,
      esperada: 69_000_000,
      cobrado: 0,
      falta: 69_000_000,
    });
  });

  it('una seña del cero por ciento queda cubierta sin cobrar nada', () => {
    expect(
      calcularSena(entrada(230_000_000, 0, { porcentajeDelTrabajo: puntosBasicos(0) })),
    ).toEqual({
      situacion: 'cubierta',
      porcentaje: 0,
      esperada: 0,
      cobrado: 0,
      deMas: 0,
    });
  });

  it('una seña del cien por ciento es el presupuesto entero', () => {
    expect(
      calcularSena(entrada(230_000_000, 0, { porcentajeDelTrabajo: puntosBasicos(10_000) })),
    ).toMatchObject({ situacion: 'falta', esperada: 230_000_000, falta: 230_000_000 });
  });

  it('un presupuesto en cero deja la seña en cero y cubierta', () => {
    expect(calcularSena(entrada(0, 0))).toMatchObject({ situacion: 'cubierta', esperada: 0 });
  });

  it('redondea el medio centavo para arriba, como la cascada y como SQL', () => {
    expect(calcularSena(entrada(1, 0))).toMatchObject({ esperada: 1, falta: 1 });
    expect(
      calcularSena(entrada(3, 0, { porcentajeDelTrabajo: puntosBasicos(5_000) })),
    ).toMatchObject({ esperada: 2 });
  });

  it('un presupuesto negativo no es un presupuesto', () => {
    expect(() => calcularSena(entrada(-1, 0))).toThrow(RangeError);
  });
});

describe('qué porcentaje se usa', () => {
  it('sin porcentaje propio, el del taller', () => {
    expect(porcentajeDeLaSena(null, LA_MITAD)).toBe(LA_MITAD);
  });

  it('con porcentaje propio, el del trabajo', () => {
    const propio: PuntosBasicos = puntosBasicos(2_500);
    expect(porcentajeDeLaSena(propio, LA_MITAD)).toBe(propio);
  });

  it('el porcentaje habitual es la mitad', () => {
    const mitad: Money = centavos(50);
    expect(SENA_HABITUAL).toBe(5_000);
    expect(calcularSena(entrada(100, 0))).toMatchObject({ esperada: mitad });
  });
});
