import { centavos } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import { faltaDelSueldo, fraseDelSueldo } from './sueldo';

describe('faltaDelSueldo', () => {
  it('un cobro entero y uno a medias no cubren el mes: falta lo mismo que muestra la barra', () => {
    expect(faltaDelSueldo({ pagado: centavos(270_000_000), esperado: centavos(360_000_000) })).toBe(
      90_000_000,
    );
  });

  it('con lo esperado pagado no falta nada, y nunca da negativo', () => {
    expect(faltaDelSueldo({ pagado: centavos(360_000_000), esperado: centavos(360_000_000) })).toBe(
      0,
    );
    expect(faltaDelSueldo({ pagado: centavos(400_000_000), esperado: centavos(360_000_000) })).toBe(
      0,
    );
  });
});

describe('fraseDelSueldo', () => {
  it('con dos cobros enteros en el mes dice dos sueldos, y por qué son dos', () => {
    expect(
      fraseDelSueldo({
        pagado: centavos(360_000_000),
        esperado: centavos(360_000_000),
        cobros: 2,
        porCobro: true,
      }),
    ).toEqual({
      texto: '$ 3.600.000 de $ 3.600.000',
      detalle: '2 cobros este mes, y cada uno paga su propio sueldo.',
    });
  });

  it('si a uno de los dos cobros no le alcanzó para su sueldo, se ve lo que faltó', () => {
    expect(
      fraseDelSueldo({
        pagado: centavos(270_000_000),
        esperado: centavos(360_000_000),
        cobros: 2,
        porCobro: true,
      }).texto,
    ).toBe('$ 2.700.000 de $ 3.600.000');
  });

  it('con un cobro, sin cobros o con el tope mensual no hay nada que explicar', () => {
    const sinDetalle = [
      { cobros: 1, porCobro: true },
      { cobros: 0, porCobro: false },
      { cobros: 3, porCobro: false },
    ].map(
      ({ cobros, porCobro }) =>
        fraseDelSueldo({
          pagado: centavos(0),
          esperado: centavos(180_000_000),
          cobros,
          porCobro,
        }).detalle,
    );
    expect(sinDetalle).toEqual([undefined, undefined, undefined]);
  });
});
