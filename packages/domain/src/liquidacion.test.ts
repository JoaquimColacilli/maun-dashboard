import { describe, expect, it } from 'vitest';

import { DIEZMO } from './cascada.ts';
import {
  calcularLiquidacion,
  liquidadoDelMes,
  planDeLiquidacion,
  resumenDelMes,
  SIN_DIEZMO,
  sueldoDelMes,
  topesDeLaLiquidacion,
  type AjustesDeLiquidacion,
  type EntradaLiquidacion,
  type LiquidacionRegistrada,
  type Objetivos,
} from './liquidacion.ts';
import { centavos, CERO } from './money.ts';

const SUELDO = centavos(180_000_000);
const FIJOS = centavos(50_000_000);

const AJUSTES: AjustesDeLiquidacion = {
  sueldoMensual: SUELDO,
  costosFijos: FIJOS,
  sueldoTopeMensual: false,
  perdidoConSueldo: false,
  perdidoConDiezmo: true,
};

function objetivos(extra: Partial<Objetivos> = {}): Objetivos {
  return { sueldo: SUELDO, fijos: FIJOS, sueldoMensual: false, ...extra };
}

function registrada(
  fecha: string,
  extra: Partial<LiquidacionRegistrada> = {},
): LiquidacionRegistrada {
  return {
    estado: 'cobrado',
    fecha,
    liquidadaEn: 0,
    sueldo: CERO,
    fijos: CERO,
    objetivoSueldo: SUELDO,
    objetivoFijos: FIJOS,
    sueldoMensual: false,
    ...extra,
  };
}

function liquidar(extra: Partial<EntradaLiquidacion> = {}) {
  return calcularLiquidacion({
    destino: 'cobrado',
    fecha: '2026-08-20',
    cobrado: centavos(0),
    gastos: centavos(0),
    ajustes: AJUSTES,
    reapertura: null,
    liquidaciones: [],
    ...extra,
  });
}

describe('los topes de una liquidación', () => {
  it('los fijos se topean por lo que falta del mes', () => {
    const previo = { sueldo: centavos(0), fijos: centavos(30_000_000) };
    expect(topesDeLaLiquidacion(objetivos(), previo).topeFijos).toBe(20_000_000);
  });

  it('si el mes ya cubrió los fijos, el tope es cero y no negativo', () => {
    const previo = { sueldo: centavos(0), fijos: centavos(70_000_000) };
    expect(topesDeLaLiquidacion(objetivos(), previo).topeFijos).toBe(0);
  });

  it('el sueldo por proyecto no mira el mes: el tope es el objetivo entero', () => {
    const previo = { sueldo: centavos(500_000_000), fijos: centavos(0) };
    expect(topesDeLaLiquidacion(objetivos(), previo).topeSueldo).toBe(SUELDO);
  });

  it('el sueldo mensual se topea como los fijos', () => {
    const mensual = objetivos({ sueldoMensual: true });
    expect(
      topesDeLaLiquidacion(mensual, { sueldo: centavos(100_000_000), fijos: CERO }).topeSueldo,
    ).toBe(80_000_000);
    expect(
      topesDeLaLiquidacion(mensual, { sueldo: centavos(200_000_000), fijos: CERO }).topeSueldo,
    ).toBe(0);
  });

  it.each([
    ['el objetivo de sueldo', objetivos({ sueldo: centavos(-1) }), { sueldo: CERO, fijos: CERO }],
    ['el objetivo de fijos', objetivos({ fijos: centavos(-1) }), { sueldo: CERO, fijos: CERO }],
    ['el sueldo previo', objetivos(), { sueldo: centavos(-1), fijos: CERO }],
    ['los fijos previos', objetivos(), { sueldo: CERO, fijos: centavos(-1) }],
  ])('rechaza %s negativo', (_nombre, objetivo, previo) => {
    expect(() => topesDeLaLiquidacion(objetivo, previo)).toThrow(RangeError);
  });
});

describe('lo liquidado en un mes', () => {
  const liquidaciones = [
    registrada('2026-08-03', { sueldo: centavos(10), fijos: centavos(1) }),
    registrada('2026-08-31', { sueldo: centavos(20), fijos: centavos(2), estado: 'perdido' }),
    registrada('2026-09-01', { sueldo: centavos(40), fijos: centavos(4) }),
    registrada('2025-08-15', { sueldo: centavos(80), fijos: centavos(8) }),
  ];

  it('suma sueldo y fijos de las liquidaciones de ese mes calendario, cobros y perdidos', () => {
    expect(liquidadoDelMes(liquidaciones, '2026-08')).toEqual({ sueldo: 30, fijos: 3 });
    expect(liquidadoDelMes(liquidaciones, '2026-09')).toEqual({ sueldo: 40, fijos: 4 });
  });

  it('un mes sin liquidaciones está en cero', () => {
    expect(liquidadoDelMes(liquidaciones, '2026-10')).toEqual({ sueldo: 0, fijos: 0 });
  });

  it('rechaza un mes mal escrito o una fecha que no existe', () => {
    for (const mes of ['2026-8', '2026-13', '2026-08-01', '']) {
      expect(() => liquidadoDelMes(liquidaciones, mes)).toThrow(RangeError);
    }
    expect(() => liquidadoDelMes([registrada('2026-02-30')], '2026-02')).toThrow(RangeError);
  });
});

describe('el plan: con qué fecha, diezmo y objetivos se liquida', () => {
  it('un cobro usa la fecha de hoy y los ajustes', () => {
    expect(planDeLiquidacion('cobrado', '2026-09-11', AJUSTES, null)).toEqual({
      fecha: '2026-09-11',
      diezmoBp: DIEZMO,
      objetivos: { sueldo: SUELDO, fijos: FIJOS, sueldoMensual: false },
    });
  });

  it('un cobro reabierto usa los objetivos del cobro original y la fecha que se elige al volver a cobrar', () => {
    const reapertura = {
      fecha: '2026-08-20',
      objetivoSueldo: centavos(150_000_000),
      objetivoFijos: centavos(40_000_000),
      sueldoMensual: true,
    };
    expect(planDeLiquidacion('cobrado', '2026-09-11', AJUSTES, reapertura)).toEqual({
      fecha: '2026-09-11',
      diezmoBp: DIEZMO,
      objetivos: { sueldo: 150_000_000, fijos: 40_000_000, sueldoMensual: true },
    });
    expect(planDeLiquidacion('cobrado', '2026-08-20', AJUSTES, reapertura).fecha).toBe(
      '2026-08-20',
    );
  });

  it('un perdido, por defecto, no paga sueldo y sí diezmo: objetivo de sueldo en cero', () => {
    expect(planDeLiquidacion('perdido', '2026-09-11', AJUSTES, null)).toEqual({
      fecha: '2026-09-11',
      diezmoBp: DIEZMO,
      objetivos: { sueldo: 0, fijos: FIJOS, sueldoMensual: false },
    });
  });

  it('los dos parámetros del perdido cambian el objetivo y el diezmo, no la cascada', () => {
    const ajustes = { ...AJUSTES, perdidoConSueldo: true, perdidoConDiezmo: false };
    expect(planDeLiquidacion('perdido', '2026-09-11', ajustes, null)).toEqual({
      fecha: '2026-09-11',
      diezmoBp: SIN_DIEZMO,
      objetivos: { sueldo: SUELDO, fijos: FIJOS, sueldoMensual: false },
    });
  });

  it('un cierre como perdido es un evento nuevo: no usa la foto de una reapertura', () => {
    const reapertura = {
      fecha: '2026-01-10',
      objetivoSueldo: centavos(1),
      objetivoFijos: centavos(1),
      sueldoMensual: true,
    };
    expect(planDeLiquidacion('perdido', '2026-09-11', AJUSTES, reapertura).fecha).toBe(
      '2026-09-11',
    );
  });
});

describe('la liquidación completa', () => {
  it('el ejemplo del ADR: agosto con fijos de 500.000', () => {
    const p1 = liquidar({ cobrado: centavos(400_000_000) });
    expect(p1).toMatchObject({ sueldo: SUELDO, fijos: FIJOS, previo: { fijos: 0 } });

    const agosto = [registrada('2026-08-20', { fijos: p1.fijos, sueldo: p1.sueldo })];
    const p2 = liquidar({ cobrado: centavos(400_000_000), liquidaciones: agosto });
    expect(p2).toMatchObject({ topeFijos: 0, fijos: 0, previo: { fijos: 50_000_000 } });
    expect(p2.sueldo).toBe(SUELDO);

    const p1Corregido = liquidar({
      cobrado: centavos(250_000_000),
      reapertura: {
        fecha: '2026-08-20',
        objetivoSueldo: SUELDO,
        objetivoFijos: FIJOS,
        sueldoMensual: false,
      },
      liquidaciones: [registrada('2026-08-25', { fijos: p2.fijos })],
    });
    expect(p1Corregido).toMatchObject({ fecha: '2026-08-20', fijos: 45_000_000, remanente: 0 });
  });

  it('volver a cobrar un reabierto en otro mes lleva el reparto a ese mes, con los objetivos del original', () => {
    const agosto = registrada('2026-08-25', { fijos: centavos(30_000_000) });
    const septiembre = registrada('2026-09-03', { fijos: centavos(10_000_000) });
    const reapertura = {
      fecha: '2026-08-20',
      objetivoSueldo: SUELDO,
      objetivoFijos: FIJOS,
      sueldoMensual: false,
    };
    const enSuMes = liquidar({
      fecha: '2026-08-20',
      cobrado: centavos(400_000_000),
      reapertura,
      liquidaciones: [agosto, septiembre],
    });
    const enOtroMes = liquidar({
      fecha: '2026-09-10',
      cobrado: centavos(400_000_000),
      reapertura,
      ajustes: { ...AJUSTES, costosFijos: centavos(99_000_000) },
      liquidaciones: [agosto, septiembre],
    });

    expect(enSuMes).toMatchObject({ fecha: '2026-08-20', previo: { fijos: 30_000_000 } });
    expect(enSuMes.fijos).toBe(20_000_000);
    expect(enOtroMes).toMatchObject({
      fecha: '2026-09-10',
      previo: { fijos: 10_000_000 },
      objetivos: { fijos: FIJOS },
    });
    expect(enOtroMes.fijos).toBe(40_000_000);
  });

  it('lo liquidado en otro mes no cuenta', () => {
    const julio = [registrada('2026-07-31', { fijos: FIJOS })];
    expect(liquidar({ cobrado: centavos(400_000_000), liquidaciones: julio }).fijos).toBe(FIJOS);
  });

  it('con el sueldo mensual, un segundo cobro del mes toma lo que falta del sueldo', () => {
    const ajustes = { ...AJUSTES, sueldoTopeMensual: true };
    const mes = [registrada('2026-08-05', { sueldo: centavos(100_000_000) })];
    expect(liquidar({ ajustes, cobrado: centavos(400_000_000), liquidaciones: mes })).toMatchObject(
      { topeSueldo: 80_000_000, sueldo: 80_000_000 },
    );
  });

  it('una seña retenida de 200.000 paga diezmo y no sueldo: el resto queda en el taller', () => {
    const perdido = liquidar({ destino: 'perdido', cobrado: centavos(20_000_000) });
    expect(perdido).toMatchObject({
      destino: 'perdido',
      diezmo: 2_000_000,
      sueldo: 0,
      fijos: 18_000_000,
      remanente: 0,
      objetivos: { sueldo: 0 },
    });
  });

  it('un perdido que solo cargó la nafta de la visita da pérdida, sin repartir nada', () => {
    const perdido = liquidar({ destino: 'perdido', gastos: centavos(800_000) });
    expect(perdido).toMatchObject({ diezmo: 0, sueldo: 0, fijos: 0, remanente: -800_000 });
  });
});

describe('el resumen de un mes', () => {
  const ajustes = { sueldoMensual: centavos(200_000_000), costosFijos: centavos(60_000_000) };
  const agosto = [
    registrada('2026-08-05', {
      liquidadaEn: 2,
      sueldo: centavos(180_000_000),
      fijos: centavos(10_000_000),
    }),
    registrada('2026-08-02', {
      liquidadaEn: 1,
      sueldo: centavos(90_000_000),
      fijos: centavos(5_000_000),
      objetivoSueldo: centavos(1),
      objetivoFijos: centavos(1),
    }),
    registrada('2026-08-20', {
      liquidadaEn: 3,
      estado: 'perdido',
      objetivoSueldo: CERO,
      objetivoFijos: centavos(40_000_000),
    }),
  ];

  it('un mes cerrado mide contra el objetivo de su liquidación más reciente, y el sueldo contra el de su último cobro', () => {
    expect(resumenDelMes(agosto, '2026-08', ajustes, '2026-09')).toEqual({
      sueldo: { objetivo: SUELDO, liquidado: 270_000_000, falta: 0 },
      fijos: { objetivo: 40_000_000, liquidado: 15_000_000, falta: 25_000_000 },
    });
  });

  it('el mes en curso mide contra los ajustes: es lo que va a usar la próxima liquidación', () => {
    expect(resumenDelMes(agosto, '2026-08', ajustes, '2026-08').fijos).toEqual({
      objetivo: 60_000_000,
      liquidado: 15_000_000,
      falta: 45_000_000,
    });
  });

  it('un mes cerrado sin liquidaciones queda entero sin cubrir, contra los ajustes', () => {
    expect(resumenDelMes(agosto, '2026-07', ajustes, '2026-09')).toEqual({
      sueldo: { objetivo: 200_000_000, liquidado: 0, falta: 200_000_000 },
      fijos: { objetivo: 60_000_000, liquidado: 0, falta: 60_000_000 },
    });
  });

  it('un mes cerrado con solo un perdido toma los fijos del perdido y el sueldo de los ajustes', () => {
    const soloPerdido = [agosto[2] ?? registrada('2026-08-20')];
    expect(resumenDelMes(soloPerdido, '2026-08', ajustes, '2026-09')).toMatchObject({
      sueldo: { objetivo: 200_000_000 },
      fijos: { objetivo: 40_000_000 },
    });
  });

  it('un perdido que pagó sueldo (con el parámetro prendido) congela su objetivo de sueldo, y el mes cerrado lo usa', () => {
    const conSueldo = [
      registrada('2026-08-20', {
        estado: 'perdido',
        sueldo: centavos(150_000_000),
        objetivoSueldo: SUELDO,
      }),
    ];
    expect(resumenDelMes(conSueldo, '2026-08', ajustes, '2026-10').sueldo).toEqual({
      objetivo: SUELDO,
      liquidado: 150_000_000,
      falta: 30_000_000,
    });
  });

  it('rechaza un mes en curso mal escrito', () => {
    expect(() => resumenDelMes(agosto, '2026-08', ajustes, '2026-9')).toThrow(RangeError);
  });
});

describe('el sueldo de un mes: se mide contra un sueldo, tenga los cobros que tenga', () => {
  const ajustes = { sueldoMensual: SUELDO, costosFijos: FIJOS };

  it('sin cobros espera un sueldo, el de los ajustes', () => {
    expect(sueldoDelMes([], '2026-09', ajustes, '2026-09')).toEqual({
      pagado: 0,
      esperado: SUELDO,
      cobros: 0,
    });
  });

  it('dos cobros en el mes siguen esperando un solo sueldo, no dos', () => {
    const dos = [
      registrada('2026-09-05', { sueldo: centavos(90_000_000) }),
      registrada('2026-09-20', { sueldo: centavos(30_000_000) }),
    ];
    expect(sueldoDelMes(dos, '2026-09', ajustes, '2026-09')).toEqual({
      pagado: 120_000_000,
      esperado: SUELDO,
      cobros: 2,
    });
  });

  it('el caso de MAUN Muebles en septiembre: dos cobros a medias, contra un sueldo de $1.800.000', () => {
    const septiembre = [
      registrada('2026-09-08', { sueldo: centavos(14_220_000) }),
      registrada('2026-09-09', { sueldo: centavos(95_160_420) }),
    ];
    expect(sueldoDelMes(septiembre, '2026-09', ajustes, '2026-09')).toEqual({
      pagado: 109_380_420,
      esperado: 180_000_000,
      cobros: 2,
    });
  });

  it('con dos cobros enteros lo pagado pasa el sueldo, y lo esperado sigue siendo uno', () => {
    const dos = [
      registrada('2026-09-05', { sueldo: SUELDO }),
      registrada('2026-09-20', { sueldo: SUELDO }),
    ];
    expect(sueldoDelMes(dos, '2026-09', ajustes, '2026-09')).toEqual({
      pagado: 360_000_000,
      esperado: SUELDO,
      cobros: 2,
    });
  });

  it('un mes cerrado espera el sueldo con el que se liquidó su último cobro, no el de hoy', () => {
    const agosto = [
      registrada('2026-08-05', {
        sueldo: centavos(100_000_000),
        objetivoSueldo: centavos(100_000_000),
        liquidadaEn: 1,
      }),
      registrada('2026-08-20', {
        sueldo: centavos(40_000_000),
        objetivoSueldo: centavos(150_000_000),
        liquidadaEn: 2,
      }),
    ];
    expect(sueldoDelMes(agosto, '2026-08', ajustes, '2026-09').esperado).toBe(150_000_000);
  });

  it('un perdido sin sueldo y los cobros de otro mes no cuentan', () => {
    const mezcla = [
      registrada('2026-09-05', { sueldo: SUELDO }),
      registrada('2026-09-10', { estado: 'perdido', objetivoSueldo: CERO }),
      registrada('2026-08-28', { sueldo: SUELDO }),
    ];
    expect(sueldoDelMes(mezcla, '2026-09', ajustes, '2026-09')).toEqual({
      pagado: SUELDO,
      esperado: SUELDO,
      cobros: 1,
    });
  });

  it('el modo del tope no cambia lo que se espera: por cobro o por mes, el mes espera un sueldo', () => {
    const porCobro = [
      registrada('2026-09-05', { sueldo: centavos(120_000_000) }),
      registrada('2026-09-20', { sueldo: centavos(60_000_000) }),
    ];
    const mensuales = porCobro.map((liquidacion) => ({ ...liquidacion, sueldoMensual: true }));
    expect(sueldoDelMes(porCobro, '2026-09', ajustes, '2026-09')).toEqual(
      sueldoDelMes(mensuales, '2026-09', ajustes, '2026-09'),
    );
  });
});
