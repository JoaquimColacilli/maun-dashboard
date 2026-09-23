import { describe, expect, it } from 'vitest';

import {
  diaDelMes,
  diaLocal,
  diasDelMes,
  diasHasta,
  diaYMes,
  diaYMesCorto,
  errorDeLaFechaDeLaPlata,
  fechaLarga,
  haceCuanto,
  hoyEnElTaller,
  hoyLocal,
  mesAnterior,
  mesDeLaFecha,
  nombreDelMes,
  relativa,
} from './fechas';

describe('las fechas de las opiniones', () => {
  it('el día y el mes, con el año solo si no es el de hoy', () => {
    expect(diaYMes('2026-09-02', '2026-09-21')).toBe('2 de septiembre');
    expect(diaYMes('2025-12-15', '2026-09-21')).toBe('15 de diciembre de 2025');
    expect(diaYMesCorto('2026-09-02')).toBe('2 sep');
  });

  it('hace cuánto, hasta en años', () => {
    expect(haceCuanto('2026-09-21', '2026-09-21')).toBe('hoy');
    expect(haceCuanto('2026-09-22', '2026-09-21')).toBe('hoy');
    expect(haceCuanto('2026-09-20', '2026-09-21')).toBe('ayer');
    expect(haceCuanto('2026-09-16', '2026-09-21')).toBe('hace 5 días');
    expect(haceCuanto('2026-08-20', '2026-09-21')).toBe('hace 1 mes');
    expect(haceCuanto('2026-04-01', '2026-09-21')).toBe('hace 6 meses');
    expect(haceCuanto('2025-09-01', '2026-09-21')).toBe('hace 1 año');
    expect(haceCuanto('2024-08-01', '2026-09-21')).toBe('hace 2 años');
  });

  it('el día de un momento es el del reloj del dispositivo', () => {
    const momento = new Date(2026, 8, 21, 23, 30).toISOString();
    expect(diaLocal(momento)).toBe('2026-09-21');
  });
});

describe('hoyLocal', () => {
  it('usa el día del reloj del dispositivo, no el UTC', () => {
    expect(hoyLocal(new Date(2026, 8, 11, 23, 30))).toBe('2026-09-11');
    expect(hoyLocal(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});

describe('hoyEnElTaller', () => {
  it('es el día de Argentina: a las 23:30 del 22 todavía es el 22, aunque en UTC ya sea el 23', () => {
    expect(hoyEnElTaller(new Date('2026-09-23T02:30:00Z'))).toBe('2026-09-22');
    expect(hoyEnElTaller(new Date('2026-09-23T03:00:00Z'))).toBe('2026-09-23');
  });

  it('y cruza el año como cualquier otro día', () => {
    expect(hoyEnElTaller(new Date('2027-01-01T02:59:59Z'))).toBe('2026-12-31');
    expect(hoyEnElTaller(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01');
  });
});

describe('errorDeLaFechaDeLaPlata', () => {
  it('hoy y cualquier día de antes valen', () => {
    expect(errorDeLaFechaDeLaPlata('2026-09-22', '2026-09-22')).toBeUndefined();
    expect(errorDeLaFechaDeLaPlata('2025-07-20', '2026-09-22')).toBeUndefined();
  });

  it('un día que todavía no llegó no vale', () => {
    expect(errorDeLaFechaDeLaPlata('2026-09-23', '2026-09-22')).toBe(
      'Esa fecha todavía no llegó: tiene que ser hoy o antes.',
    );
  });

  it('sin día no hay plata que fechar', () => {
    expect(errorDeLaFechaDeLaPlata('', '2026-09-22')).toBe('Poné el día en que entró la plata.');
    expect(errorDeLaFechaDeLaPlata('22/09/2026', '2026-09-22')).toBe(
      'Poné el día en que entró la plata.',
    );
  });
});

describe('el mes', () => {
  it('sale de la fecha y tiene nombre y largo', () => {
    expect(mesDeLaFecha('2026-09-11')).toBe('2026-09');
    expect(nombreDelMes('2026-09')).toBe('Septiembre');
    expect(diasDelMes('2026-09')).toBe(30);
    expect(diasDelMes('2026-02')).toBe(28);
    expect(diasDelMes('2024-02')).toBe(29);
  });

  it('el anterior cruza el año', () => {
    expect(mesAnterior('2026-09')).toBe('2026-08');
    expect(mesAnterior('2026-01')).toBe('2025-12');
  });
});

describe('fechaLarga', () => {
  it('escribe el día de la semana y el mes corto', () => {
    expect(fechaLarga('2026-09-10', '2026-09-11')).toBe('jue 10 sep');
  });

  it('agrega el año solo cuando no es el de hoy', () => {
    expect(fechaLarga('2025-12-18', '2026-09-11')).toBe('jue 18 dic 2025');
  });

  it('no se corre de día por la zona horaria', () => {
    expect(diaDelMes('2026-09-01')).toBe(1);
    expect(fechaLarga('2026-09-01', '2026-09-11')).toBe('mar 1 sep');
  });
});

describe('distancias', () => {
  it('cuenta los días entre dos fechas', () => {
    expect(diasHasta('2026-09-16', '2026-09-11')).toBe(5);
    expect(diasHasta('2026-09-08', '2026-09-11')).toBe(-3);
  });

  it('las dice como las diría una persona', () => {
    expect(relativa('2026-09-11', '2026-09-11')).toBe('hoy');
    expect(relativa('2026-09-12', '2026-09-11')).toBe('mañana');
    expect(relativa('2026-09-10', '2026-09-11')).toBe('ayer');
    expect(relativa('2026-09-16', '2026-09-11')).toBe('en 5 días');
    expect(relativa('2026-09-08', '2026-09-11')).toBe('hace 3 días');
    expect(relativa('2026-07-01', '2026-09-11')).toBe('hace 2 meses');
    expect(relativa('2026-08-05', '2026-09-11')).toBe('hace 1 mes');
    expect(relativa('2026-12-31', '2026-09-11')).toBe('en 4 meses');
  });
});
