import { describe, expect, it } from 'vitest';

import { calcularDistribucion, DIEZMO, type EntradaCascada } from './cascada.ts';
import { centavos, puntosBasicos, sumarTodos, type Money } from './money.ts';

const TOPE_SUELDO = centavos(180_000_000);
const TOPE_FIJOS = centavos(25_000_000);

function entrada(
  cobrado: number,
  gastos: number,
  extra: Partial<EntradaCascada> = {},
): EntradaCascada {
  return {
    cobrado: centavos(cobrado),
    gastos: centavos(gastos),
    diezmoBp: DIEZMO,
    topeSueldo: TOPE_SUELDO,
    topeFijos: TOPE_FIJOS,
    ...extra,
  };
}

function escalones(cobrado: number, gastos: number, extra: Partial<EntradaCascada> = {}) {
  const { neta, diezmo, sueldo, fijos, remanente } = calcularDistribucion(
    entrada(cobrado, gastos, extra),
  );
  return { neta, diezmo, sueldo, fijos, remanente };
}

describe('la cascada, caso por caso', () => {
  it('ganancia cero: nada que repartir', () => {
    expect(escalones(100_000_000, 100_000_000)).toEqual({
      neta: 0,
      diezmo: 0,
      sueldo: 0,
      fijos: 0,
      remanente: 0,
    });
  });

  it('ganancia negativa: diezmo, sueldo y fijos en cero, y la pérdida entera en el remanente', () => {
    const distribucion = calcularDistribucion(entrada(50_000_000, 80_000_000));
    expect(distribucion).toMatchObject({
      neta: -30_000_000,
      diezmo: 0,
      sueldo: 0,
      fijos: 0,
      remanente: -30_000_000,
      faltaSueldo: TOPE_SUELDO,
      faltaFijos: TOPE_FIJOS,
    });
  });

  it('gastos mayores al cobro, sin ningún pago todavía', () => {
    expect(escalones(0, 12_500_000)).toEqual({
      neta: -12_500_000,
      diezmo: 0,
      sueldo: 0,
      fijos: 0,
      remanente: -12_500_000,
    });
  });

  it('ganancia menor al sueldo: el sueldo se lleva lo que queda y no llega nada a fijos', () => {
    const distribucion = calcularDistribucion(entrada(124_000_000, 35_330_000));
    expect(distribucion).toMatchObject({
      neta: 88_670_000,
      diezmo: 8_867_000,
      sueldo: 79_803_000,
      fijos: 0,
      remanente: 0,
      faltaSueldo: 100_197_000,
      faltaFijos: TOPE_FIJOS,
    });
  });

  it('proyecto cobrado parcialmente: se reparte sobre lo cobrado, no sobre el presupuesto', () => {
    const presupuesto = 124_000_000;
    const pagos: Money[] = [centavos(40_000_000), centavos(40_000_000)];
    const cobrado = sumarTodos(pagos);
    expect(cobrado).toBeLessThan(presupuesto);
    expect(escalones(cobrado, 35_330_000)).toEqual({
      neta: 44_670_000,
      diezmo: 4_467_000,
      sueldo: 40_203_000,
      fijos: 0,
      remanente: 0,
    });
  });

  it('proyecto sin gastos: la neta es todo lo cobrado', () => {
    expect(escalones(54_000_000, 0)).toEqual({
      neta: 54_000_000,
      diezmo: 5_400_000,
      sueldo: 48_600_000,
      fijos: 0,
      remanente: 0,
    });
  });

  it('cubre el sueldo y deja una parte de los fijos', () => {
    expect(escalones(215_000_000, 0)).toEqual({
      neta: 215_000_000,
      diezmo: 21_500_000,
      sueldo: 180_000_000,
      fijos: 13_500_000,
      remanente: 0,
    });
  });

  it('cubre sueldo y fijos y deja remanente en el taller', () => {
    const distribucion = calcularDistribucion(entrada(480_000_000, 165_000_000));
    expect(distribucion).toMatchObject({
      neta: 315_000_000,
      diezmo: 31_500_000,
      sueldo: 180_000_000,
      fijos: 25_000_000,
      remanente: 78_500_000,
      faltaSueldo: 0,
      faltaFijos: 0,
    });
  });

  it('el diezmo redondea al centavo, mitad hacia arriba', () => {
    expect(escalones(15, 0).diezmo).toBe(2);
    expect(escalones(14, 0).diezmo).toBe(1);
    expect(escalones(5, 0).diezmo).toBe(1);
    expect(escalones(4, 0).diezmo).toBe(0);
    expect(escalones(1, 0)).toEqual({ neta: 1, diezmo: 0, sueldo: 1, fijos: 0, remanente: 0 });
  });

  it('con topes en cero, todo lo que no es diezmo queda de remanente', () => {
    const sinTopes = { topeSueldo: centavos(0), topeFijos: centavos(0) };
    expect(escalones(10_000_000, 0, sinTopes)).toEqual({
      neta: 10_000_000,
      diezmo: 1_000_000,
      sueldo: 0,
      fijos: 0,
      remanente: 9_000_000,
    });
  });

  it('con otro porcentaje de diezmo, respeta el que se le pasa', () => {
    expect(escalones(10_000_000, 0, { diezmoBp: puntosBasicos(0) }).diezmo).toBe(0);
    expect(escalones(10_000_000, 0, { diezmoBp: puntosBasicos(10_000) })).toEqual({
      neta: 10_000_000,
      diezmo: 10_000_000,
      sueldo: 0,
      fijos: 0,
      remanente: 0,
    });
  });

  it('el diezmo es el 10%', () => {
    expect(DIEZMO).toBe(1_000);
  });

  it('devuelve también los parámetros que usó, que son los que se congelan', () => {
    const distribucion = calcularDistribucion(entrada(54_000_000, 19_400_000));
    expect(distribucion).toMatchObject({
      cobrado: 54_000_000,
      gastos: 19_400_000,
      diezmoBp: 1_000,
      topeSueldo: TOPE_SUELDO,
      topeFijos: TOPE_FIJOS,
    });
  });
});

describe('las distribuciones del seed', () => {
  it.each([
    [124_000_000, 35_330_000, 8_867_000, 79_803_000, 0, 0],
    [54_000_000, 19_400_000, 3_460_000, 31_140_000, 0, 0],
    [89_000_000, 30_100_000, 5_890_000, 53_010_000, 0, 0],
    [480_000_000, 165_000_000, 31_500_000, 180_000_000, 25_000_000, 78_500_000],
  ])('cobrado %i, gastos %i', (cobrado, gastos, diezmo, sueldo, fijos, remanente) => {
    expect(escalones(cobrado, gastos)).toMatchObject({ diezmo, sueldo, fijos, remanente });
  });
});

describe('entradas inválidas', () => {
  it.each([
    ['lo cobrado', { cobrado: centavos(-1) }],
    ['los gastos', { gastos: centavos(-1) }],
    ['el tope de sueldo', { topeSueldo: centavos(-1) }],
    ['el tope de fijos', { topeFijos: centavos(-1) }],
  ])('rechaza %s negativo', (_nombre, extra) => {
    expect(() => calcularDistribucion(entrada(1_000, 0, extra))).toThrow(RangeError);
  });

  it('rechaza un porcentaje de diezmo fuera de rango', () => {
    expect(() =>
      calcularDistribucion(entrada(1_000, 0, { diezmoBp: 20_000 as EntradaCascada['diezmoBp'] })),
    ).toThrow(RangeError);
  });
});

describe('invariantes, sobre miles de entradas', () => {
  let estado = 11_092_026;
  const siguiente = (tope: number): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4_294_967_296) * tope);
  };

  const casos = Array.from({ length: 3_000 }, () =>
    entrada(siguiente(600_000_000), siguiente(300_000_000), {
      diezmoBp: puntosBasicos(siguiente(10_001)),
      topeSueldo: centavos(siguiente(250_000_000)),
      topeFijos: centavos(siguiente(50_000_000)),
    }),
  );

  it('los escalones suman exactamente la ganancia neta', () => {
    for (const caso of casos) {
      const d = calcularDistribucion(caso);
      expect(d.neta).toBe(caso.cobrado - caso.gastos);
      expect(d.diezmo + d.sueldo + d.fijos + d.remanente).toBe(d.neta);
    }
  });

  it('ningún escalón es negativo, salvo el remanente cuando hubo pérdida', () => {
    for (const caso of casos) {
      const d = calcularDistribucion(caso);
      expect(d.diezmo).toBeGreaterThanOrEqual(0);
      expect(d.sueldo).toBeGreaterThanOrEqual(0);
      expect(d.fijos).toBeGreaterThanOrEqual(0);
      if (d.remanente < 0) {
        expect(d.diezmo + d.sueldo + d.fijos).toBe(0);
        expect(d.remanente).toBe(d.neta);
      }
    }
  });

  it('cada escalón come del anterior: no se llena uno sin llenar el de arriba', () => {
    for (const caso of casos) {
      const d = calcularDistribucion(caso);
      expect(d.sueldo).toBeLessThanOrEqual(caso.topeSueldo);
      expect(d.fijos).toBeLessThanOrEqual(caso.topeFijos);
      if (d.sueldo < caso.topeSueldo) {
        expect(d.fijos).toBe(0);
        expect(Math.max(d.remanente, 0)).toBe(0);
      }
      if (d.fijos < caso.topeFijos && d.neta > 0) expect(d.remanente).toBe(0);
      expect(d.faltaSueldo).toBe(caso.topeSueldo - d.sueldo);
      expect(d.faltaFijos).toBe(caso.topeFijos - d.fijos);
    }
  });
});
