import { centavos } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import { faltaDelSueldo, fraseDelSueldo } from './sueldo';

describe('faltaDelSueldo', () => {
  it('falta lo que no llegó del sueldo del mes, contra un solo sueldo', () => {
    expect(faltaDelSueldo({ pagado: centavos(109_380_420), esperado: centavos(180_000_000) })).toBe(
      70_619_580,
    );
  });

  it('con el sueldo pagado no falta nada, y aunque se pase nunca da negativo', () => {
    expect(faltaDelSueldo({ pagado: centavos(180_000_000), esperado: centavos(180_000_000) })).toBe(
      0,
    );
    expect(faltaDelSueldo({ pagado: centavos(360_000_000), esperado: centavos(180_000_000) })).toBe(
      0,
    );
  });
});

describe('fraseDelSueldo', () => {
  it('con dos cobros a medias dice cuánto entró contra un sueldo, no contra dos', () => {
    expect(
      fraseDelSueldo({
        pagado: centavos(109_380_420),
        esperado: centavos(180_000_000),
        cobros: 2,
      }),
    ).toEqual({
      texto: '$ 1.093.804,20 de $ 1.800.000',
      detalle: undefined,
    });
  });

  it('si los cobros pagaron más que el sueldo, lo dice: está cubierto y cuánto entró', () => {
    expect(
      fraseDelSueldo({
        pagado: centavos(360_000_000),
        esperado: centavos(180_000_000),
        cobros: 2,
      }),
    ).toEqual({
      texto: '$ 3.600.000 de $ 1.800.000',
      detalle: 'Ya está cubierto: los 2 cobros del mes pagaron $ 3.600.000.',
    });
  });

  it('con un solo cobro que se pasó, habla de un cobro', () => {
    expect(
      fraseDelSueldo({
        pagado: centavos(200_000_000),
        esperado: centavos(180_000_000),
        cobros: 1,
      }).detalle,
    ).toBe('Ya está cubierto: el cobro del mes pagó $ 2.000.000.');
  });

  it('justo el sueldo o menos no necesita explicación', () => {
    const sinDetalle = [0, 90_000_000, 180_000_000].map(
      (pagado) =>
        fraseDelSueldo({ pagado: centavos(pagado), esperado: centavos(180_000_000), cobros: 1 })
          .detalle,
    );
    expect(sinDetalle).toEqual([undefined, undefined, undefined]);
  });
});
