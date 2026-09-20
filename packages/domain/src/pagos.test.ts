import { describe, expect, it } from 'vitest';

import { centavos, puntosBasicos, type Money } from './money.ts';
import {
  conLaForma,
  formasDeCobro,
  FORMAS_DE_COBRO,
  instanciasPendientes,
  montoParaPegar,
  ofrece,
  pagoQueToca,
  pagosPorDelante,
  unaSolaForma,
  type FormaDeCobro,
} from './pagos.ts';
import { SENA_HABITUAL } from './sena.ts';

function trabajo(presupuesto: number | null, cobrado: number, senaBp = 5000) {
  return {
    presupuesto: presupuesto === null ? null : centavos(presupuesto),
    cobrado: centavos(cobrado),
    porcentajeDelTaller: SENA_HABITUAL,
    porcentajeDelTrabajo: puntosBasicos(senaBp),
  };
}

describe('el valor por defecto de las formas de cobro', () => {
  it('sin nada guardado y con datos para transferir, ofrece las dos', () => {
    expect(formasDeCobro(null, true)).toEqual(['transferencia', 'efectivo']);
  });

  it('sin nada guardado y sin datos para transferir, solo efectivo', () => {
    expect(formasDeCobro(null, false)).toEqual(['efectivo']);
  });

  it('lo que el dueño guardó manda aunque Ajustes esté vacío: es su decisión', () => {
    expect(formasDeCobro(['transferencia'], false)).toEqual(['transferencia']);
    expect(formasDeCobro(['efectivo'], true)).toEqual(['efectivo']);
  });

  it('un trabajo de antes de esta versión no guarda nada, así que vale el valor por defecto', () => {
    expect(formasDeCobro(null, true)).toEqual(formasDeCobro(null, true));
    expect(ofrece(formasDeCobro(null, true), 'transferencia')).toBe(true);
  });
});

describe('prender y apagar una forma', () => {
  it('prender la que falta deja las dos, siempre en el mismo orden', () => {
    expect(conLaForma(['efectivo'], 'transferencia', true)).toEqual(['transferencia', 'efectivo']);
    expect(conLaForma(['transferencia'], 'efectivo', true)).toEqual(['transferencia', 'efectivo']);
  });

  it('apagar una de las dos deja la otra', () => {
    expect(conLaForma(['transferencia', 'efectivo'], 'transferencia', false)).toEqual(['efectivo']);
    expect(conLaForma(['transferencia', 'efectivo'], 'efectivo', false)).toEqual(['transferencia']);
  });

  it('apagar la única que queda no se puede: un pago sin ninguna forma no existe', () => {
    expect(conLaForma(['efectivo'], 'efectivo', false)).toBeNull();
    expect(conLaForma(['transferencia'], 'transferencia', false)).toBeNull();
  });

  it('prender la que ya está no cambia nada', () => {
    expect(conLaForma(['efectivo'], 'efectivo', true)).toEqual(['efectivo']);
  });

  it('el resultado siempre sale en el orden del catálogo, venga de donde venga', () => {
    expect(conLaForma(['efectivo'], 'transferencia', true)).toEqual([...FORMAS_DE_COBRO]);
    expect(conLaForma(['transferencia'], 'efectivo', true)).toEqual([...FORMAS_DE_COBRO]);
  });
});

describe('una sola forma configurada', () => {
  it('con una sola, la dice', () => {
    expect(unaSolaForma(['efectivo'])).toBe('efectivo');
    expect(unaSolaForma(['transferencia'])).toBe('transferencia');
  });

  it('con las dos, no elige: la elige él', () => {
    expect(unaSolaForma(['transferencia', 'efectivo'])).toBeNull();
  });

  it('sin ninguna tampoco elige, aunque la base no deje llegar hasta acá', () => {
    expect(unaSolaForma([])).toBeNull();
  });
});

describe('qué pago toca', () => {
  it('sin presupuesto, lo que viene es la seña y todavía no hay importe', () => {
    expect(pagoQueToca(trabajo(null, 0))).toEqual({ instancia: 'sena', monto: null });
  });

  it('con presupuesto y sin pagos, la seña entera', () => {
    expect(pagoQueToca(trabajo(100_000_000, 0))).toEqual({
      instancia: 'sena',
      monto: centavos(50_000_000),
    });
  });

  it('con parte de la seña cobrada, lo que falta de la seña', () => {
    expect(pagoQueToca(trabajo(100_000_000, 20_000_000))).toEqual({
      instancia: 'sena',
      monto: centavos(30_000_000),
    });
  });

  it('con la seña justa, pasa a tocar el saldo', () => {
    expect(pagoQueToca(trabajo(100_000_000, 50_000_000))).toEqual({
      instancia: 'saldo',
      monto: centavos(50_000_000),
    });
  });

  it('con más que la seña, el saldo es lo que falta', () => {
    expect(pagoQueToca(trabajo(100_000_000, 70_000_000))).toEqual({
      instancia: 'saldo',
      monto: centavos(30_000_000),
    });
  });

  it('con todo pagado no toca nada', () => {
    expect(pagoQueToca(trabajo(100_000_000, 100_000_000))).toBeNull();
  });

  it('con más de lo que vale, tampoco', () => {
    expect(pagoQueToca(trabajo(100_000_000, 120_000_000))).toBeNull();
  });

  it('el porcentaje del trabajo pisa al del taller', () => {
    expect(pagoQueToca(trabajo(100_000_000, 0, 3000))).toEqual({
      instancia: 'sena',
      monto: centavos(30_000_000),
    });
  });

  it('el redondeo es medio centavo para arriba, como en la cascada', () => {
    expect(pagoQueToca(trabajo(1, 0))).toEqual({ instancia: 'sena', monto: centavos(1) });
    expect(pagoQueToca(trabajo(3, 0, 3333))).toEqual({ instancia: 'sena', monto: centavos(1) });
  });

  it('con la seña en cero, lo que toca desde el arranque es el saldo', () => {
    expect(pagoQueToca(trabajo(100_000_000, 0, 0))).toEqual({
      instancia: 'saldo',
      monto: centavos(100_000_000),
    });
  });
});

describe('los pagos que le faltan al cliente, en orden', () => {
  it('sin presupuesto se conocen los dos, sin importe', () => {
    expect(pagosPorDelante(trabajo(null, 0))).toEqual([
      { instancia: 'sena', monto: null },
      { instancia: 'saldo', monto: null },
    ]);
  });

  it('sin nada pagado, la seña y lo que va a quedar de saldo', () => {
    expect(pagosPorDelante(trabajo(100_000_000, 0))).toEqual([
      { instancia: 'sena', monto: centavos(50_000_000) },
      { instancia: 'saldo', monto: centavos(50_000_000) },
    ]);
  });

  it('con parte de la seña cobrada, el saldo de después no se mueve', () => {
    expect(pagosPorDelante(trabajo(100_000_000, 20_000_000))).toEqual([
      { instancia: 'sena', monto: centavos(30_000_000) },
      { instancia: 'saldo', monto: centavos(50_000_000) },
    ]);
  });

  it('lo que cobró en la visita ya está descontado: es un pago más del trabajo', () => {
    expect(pagosPorDelante(trabajo(100_000_000, 5_000_000))[0]).toEqual({
      instancia: 'sena',
      monto: centavos(45_000_000),
    });
  });

  it('con la seña cubierta queda solo el saldo', () => {
    expect(pagosPorDelante(trabajo(100_000_000, 60_000_000))).toEqual([
      { instancia: 'saldo', monto: centavos(40_000_000) },
    ]);
  });

  it('con la seña al 100 % no hay saldo después: es un pago solo', () => {
    expect(pagosPorDelante(trabajo(100_000_000, 0, 10_000))).toEqual([
      { instancia: 'sena', monto: centavos(100_000_000) },
    ]);
  });

  it('saldado no falta ninguno', () => {
    expect(pagosPorDelante(trabajo(100_000_000, 100_000_000))).toEqual([]);
  });

  it('el pago que toca es el primero de la lista', () => {
    expect(pagoQueToca(trabajo(100_000_000, 0))).toEqual(
      pagosPorDelante(trabajo(100_000_000, 0))[0],
    );
    expect(pagoQueToca(trabajo(100_000_000, 100_000_000))).toBeNull();
  });
});

describe('qué instancias faltan', () => {
  it('sin presupuesto faltan las dos: todavía no pagó nada', () => {
    expect(instanciasPendientes(trabajo(null, 0))).toEqual(['sena', 'saldo']);
  });

  it('con la seña pendiente faltan las dos', () => {
    expect(instanciasPendientes(trabajo(100_000_000, 10_000_000))).toEqual(['sena', 'saldo']);
  });

  it('con la seña cubierta falta el saldo solo', () => {
    expect(instanciasPendientes(trabajo(100_000_000, 60_000_000))).toEqual(['saldo']);
  });

  it('saldado no falta nada', () => {
    expect(instanciasPendientes(trabajo(100_000_000, 100_000_000))).toEqual([]);
  });

  it('con la seña al 100 % la única instancia es la seña: no hay saldo que configurar', () => {
    expect(instanciasPendientes(trabajo(100_000_000, 0, 10_000))).toEqual(['sena']);
  });
});

describe('el importe listo para pegar en el banco', () => {
  it('va sin signo pesos y sin puntos de miles', () => {
    expect(montoParaPegar(centavos(150_000_000))).toBe('1500000');
  });

  it('un importe chico también', () => {
    expect(montoParaPegar(centavos(100))).toBe('1');
  });

  it('con centavos, la coma es el separador decimal de acá', () => {
    expect(montoParaPegar(centavos(150_000_050))).toBe('1500000,50');
    expect(montoParaPegar(centavos(105))).toBe('1,05');
  });

  it('cero es cero', () => {
    expect(montoParaPegar(centavos(0))).toBe('0');
  });

  it('nunca trae un separador de miles ni el signo, que es lo que rompe el campo del banco', () => {
    const importes: Money[] = [
      centavos(1),
      centavos(99),
      centavos(123_456_789),
      centavos(1_000_000_000),
    ];
    for (const importe of importes) {
      expect(montoParaPegar(importe)).toMatch(/^\d+(,\d{2})?$/);
    }
  });
});

describe('el catálogo', () => {
  it('son exactamente dos formas y el orden es el que se guarda', () => {
    expect(FORMAS_DE_COBRO).toEqual(['transferencia', 'efectivo']);
  });

  it('ofrece contesta por cada una', () => {
    const formas: readonly FormaDeCobro[] = ['efectivo'];
    expect(ofrece(formas, 'efectivo')).toBe(true);
    expect(ofrece(formas, 'transferencia')).toBe(false);
  });
});
