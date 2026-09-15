import { describe, expect, it } from 'vitest';

import {
  DIAS_HABILES_DE_ENTREGA,
  DIAS_HABILES_PARA_PRESUPUESTAR,
  diasEntre,
  entregaEstimada,
  mesDe,
  sumarDias,
  sumarDiasHabiles,
  vencimientoDelPresupuesto,
} from './fechas.ts';

describe('vencimientoDelPresupuesto', () => {
  it('es una semana de trabajo desde el relevamiento: cinco días hábiles', () => {
    expect(DIAS_HABILES_PARA_PRESUPUESTAR).toBe(5);
    expect(vencimientoDelPresupuesto('2026-09-07')).toBe('2026-09-14');
  });

  it('un relevamiento del jueves vence el jueves siguiente, y salta los feriados que se le pasan', () => {
    expect(vencimientoDelPresupuesto('2026-09-10')).toBe('2026-09-17');
    expect(vencimientoDelPresupuesto('2026-10-08', ['2026-10-12'])).toBe('2026-10-16');
  });

  it('un relevamiento del sábado vence el viernes siguiente', () => {
    expect(vencimientoDelPresupuesto('2026-09-12')).toBe('2026-09-18');
  });
});

describe('sumarDias', () => {
  it('suma y resta días corridos, cruzando meses, años y el 29 de febrero', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2028-03-01', -1)).toBe('2028-02-29');
    expect(sumarDias('2026-09-14', 0)).toBe('2026-09-14');
  });

  it('rechaza una fecha que no existe o una cantidad con decimales', () => {
    expect(() => sumarDias('2026-02-30', 1)).toThrow(RangeError);
    expect(() => sumarDias('2026-09-14', 0.5)).toThrow(RangeError);
  });
});

describe('diasEntre', () => {
  it('cuenta los días corridos de una fecha a otra, con signo', () => {
    expect(diasEntre('2026-09-14', '2026-09-16')).toBe(2);
    expect(diasEntre('2026-09-16', '2026-09-14')).toBe(-2);
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
    expect(diasEntre('2026-09-14', '2026-09-14')).toBe(0);
  });

  it('rechaza fechas mal escritas', () => {
    expect(() => diasEntre('2026-9-14', '2026-09-16')).toThrow(RangeError);
  });
});

describe('mesDe', () => {
  it('es el mes calendario de la fecha, como AAAA-MM', () => {
    expect(mesDe('2026-09-11')).toBe('2026-09');
    expect(mesDe('2026-12-31')).toBe('2026-12');
  });

  it('rechaza una fecha que no existe', () => {
    expect(() => mesDe('2026-02-30')).toThrow(RangeError);
  });
});

describe('entregaEstimada', () => {
  it('son 21 días hábiles', () => {
    expect(DIAS_HABILES_DE_ENTREGA).toBe(21);
  });

  it('desde un lunes, cae el martes de la cuarta semana siguiente', () => {
    expect(entregaEstimada('2026-08-24')).toBe('2026-09-22');
  });

  it('desde un viernes, el primer día hábil es el lunes', () => {
    expect(sumarDiasHabiles('2026-09-11', 1)).toBe('2026-09-14');
    expect(entregaEstimada('2026-09-11')).toBe('2026-10-12');
  });

  it('si arranca un fin de semana, cuenta desde el lunes', () => {
    expect(sumarDiasHabiles('2026-09-12', 1)).toBe('2026-09-14');
    expect(sumarDiasHabiles('2026-09-13', 1)).toBe('2026-09-14');
  });

  it('salta los feriados que se le pasan', () => {
    expect(sumarDiasHabiles('2026-10-09', 1, ['2026-10-12'])).toBe('2026-10-13');
    expect(entregaEstimada('2026-09-11', ['2026-10-12'])).toBe('2026-10-13');
  });

  it('un feriado que cae en fin de semana no descuenta dos veces', () => {
    expect(sumarDiasHabiles('2026-09-11', 1, ['2026-09-12'])).toBe('2026-09-14');
  });

  it('cruza meses, años y el 29 de febrero', () => {
    expect(sumarDiasHabiles('2026-12-30', 3)).toBe('2027-01-04');
    expect(sumarDiasHabiles('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('cero días hábiles devuelve la misma fecha', () => {
    expect(sumarDiasHabiles('2026-09-12', 0)).toBe('2026-09-12');
  });

  it('rechaza fechas mal escritas o que no existen, también en los feriados', () => {
    for (const fecha of ['2026-02-30', '2026-9-1', '11/09/2026', '']) {
      expect(() => sumarDiasHabiles(fecha, 1)).toThrow(RangeError);
    }
    expect(() => sumarDiasHabiles('2026-09-11', 1, ['2026-13-01'])).toThrow(RangeError);
  });

  it('rechaza cantidades negativas o con decimales', () => {
    expect(() => sumarDiasHabiles('2026-09-11', -1)).toThrow(RangeError);
    expect(() => sumarDiasHabiles('2026-09-11', 1.5)).toThrow(RangeError);
  });
});
