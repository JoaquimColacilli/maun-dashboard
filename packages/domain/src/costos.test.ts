import { describe, expect, it } from 'vitest';

import {
  calcularMargen,
  CATEGORIAS_DE_COSTO,
  categoriasEstimadas,
  costoEstimado,
  SIN_ESTIMAR,
  type CostosEstimados,
} from './costos.ts';
import { centavos } from './money.ts';

function costos(parcial: Partial<Record<(typeof CATEGORIAS_DE_COSTO)[number], number>>) {
  const armados: Record<string, ReturnType<typeof centavos> | null> = { ...SIN_ESTIMAR };
  for (const [categoria, valor] of Object.entries(parcial)) armados[categoria] = centavos(valor);
  return armados as CostosEstimados;
}

describe('las cuatro categorías', () => {
  it('son las que nombró el dueño, en el orden en que las nombró', () => {
    expect(CATEGORIAS_DE_COSTO).toEqual(['madera', 'herrajes', 'flete', 'ayudante']);
  });

  it('arrancan las cuatro sin estimar, que no es lo mismo que en cero', () => {
    expect(categoriasEstimadas(SIN_ESTIMAR)).toBe(0);
    expect(costoEstimado(SIN_ESTIMAR)).toBe(0);
  });

  it('cuenta las cargadas, y un cero cuenta como cargado', () => {
    expect(categoriasEstimadas(costos({ madera: 100, flete: 0 }))).toBe(2);
  });

  it('suma solo lo cargado', () => {
    expect(costoEstimado(costos({ madera: 19_786_353, herrajes: 12_000_000 }))).toBe(31_786_353);
  });

  it('suma las cuatro', () => {
    const cargado = costos({
      madera: 19_786_353,
      herrajes: 12_000_000,
      flete: 10_000_000,
      ayudante: 30_000_000,
    });
    expect(costoEstimado(cargado)).toBe(71_786_353);
    expect(categoriasEstimadas(cargado)).toBe(4);
  });
});

describe('el margen', () => {
  it('sin nada estimado no dice nada, aunque haya presupuesto', () => {
    expect(calcularMargen({ presupuesto: centavos(62_800_000), costos: SIN_ESTIMAR })).toEqual({
      situacion: 'sin-estimar',
    });
  });

  it('con costos y sin presupuesto muestra solo el total estimado', () => {
    expect(calcularMargen({ presupuesto: null, costos: costos({ madera: 19_786_353 }) })).toEqual({
      situacion: 'sin-presupuesto',
      estimado: 19_786_353,
      cargadas: 1,
    });
  });

  it('con presupuesto y costos es una resta, y nada más', () => {
    expect(
      calcularMargen({
        presupuesto: centavos(62_800_000),
        costos: costos({ madera: 19_786_353, herrajes: 12_000_000, flete: 10_000_000 }),
      }),
    ).toEqual({
      situacion: 'con-margen',
      estimado: 41_786_353,
      cargadas: 3,
      presupuesto: 62_800_000,
      margen: 21_013_647,
    });
  });

  it('el margen puede ser negativo, y eso es justamente lo que hay que ver', () => {
    const resultado = calcularMargen({
      presupuesto: centavos(30_000_000),
      costos: costos({ madera: 19_786_353, ayudante: 30_000_000 }),
    });
    expect(resultado).toEqual({
      situacion: 'con-margen',
      estimado: 49_786_353,
      cargadas: 2,
      presupuesto: 30_000_000,
      margen: -19_786_353,
    });
  });

  it('con todo en cero el margen es el presupuesto entero', () => {
    const resultado = calcularMargen({
      presupuesto: centavos(1_000_000),
      costos: costos({ madera: 0, herrajes: 0, flete: 0, ayudante: 0 }),
    });
    expect(resultado).toEqual({
      situacion: 'con-margen',
      estimado: 0,
      cargadas: 4,
      presupuesto: 1_000_000,
      margen: 1_000_000,
    });
  });

  it('no inventa el presupuesto a partir de los costos por ningún camino', () => {
    const conCostos = calcularMargen({
      presupuesto: null,
      costos: costos({ madera: 100, herrajes: 200, flete: 300, ayudante: 400 }),
    });
    expect(conCostos).not.toHaveProperty('presupuesto');
    expect(conCostos).not.toHaveProperty('margen');
  });
});
