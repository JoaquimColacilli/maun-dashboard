import { describe, expect, it } from 'vitest';

import { sumarMeses } from './fechas.ts';
import {
  fechaDelPlazo,
  PLAZOS_DEL_SEGUIMIENTO,
  plazoDeLaFecha,
  RESULTADOS_DEL_CONTACTO,
} from './seguimiento.ts';

describe('sumarMeses', () => {
  it('suma meses de calendario y cruza el año', () => {
    expect(sumarMeses('2026-09-23', 1)).toBe('2026-10-23');
    expect(sumarMeses('2026-11-15', 3)).toBe('2027-02-15');
    expect(sumarMeses('2026-01-10', -1)).toBe('2025-12-10');
    expect(sumarMeses('2026-09-23', 0)).toBe('2026-09-23');
  });

  it('si el mes de llegada es más corto, cae en su último día', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29');
    expect(sumarMeses('2026-11-30', 3)).toBe('2027-02-28');
    expect(sumarMeses('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('una cantidad que no es entera o una fecha que no existe no se suman', () => {
    expect(() => sumarMeses('2026-09-23', 1.5)).toThrow(RangeError);
    expect(() => sumarMeses('2026-02-30', 1)).toThrow(RangeError);
  });
});

describe('los plazos del seguimiento', () => {
  it('una semana, un mes o tres meses desde hoy', () => {
    expect(PLAZOS_DEL_SEGUIMIENTO.map((plazo) => fechaDelPlazo('2026-09-23', plazo))).toEqual([
      '2026-09-30',
      '2026-10-23',
      '2026-12-23',
    ]);
  });

  it('una fecha que coincide con un atajo lo reconoce, y cualquier otra no', () => {
    expect(plazoDeLaFecha('2026-09-23', '2026-10-23')).toBe('un_mes');
    expect(plazoDeLaFecha('2026-09-23', '2026-10-24')).toBeNull();
  });

  it('al registrar un contacto hay tres salidas', () => {
    expect(RESULTADOS_DEL_CONTACTO).toEqual(['reactivado', 'perdido', 'otra_fecha']);
  });
});
