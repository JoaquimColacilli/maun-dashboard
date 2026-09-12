import { describe, expect, it } from 'vitest';

import {
  asientosDelLibro,
  asientosDelMes,
  entradasYSalidas,
  proyeccionCocos,
  saldosDelLibro,
  saldosPorTesoro,
  type Asiento,
  type DatosDelLibro,
  type GastoDelLibro,
  type MovimientoDelLibro,
  type PagoDelLibro,
  type ProyectoDelLibro,
  type Tesoro,
} from './libroMayor.ts';
import { centavos, type Money } from './money.ts';

const $ = (valor: number): Money => centavos(valor);

function datos(partes: Partial<DatosDelLibro>): DatosDelLibro {
  return { movimientos: [], pagos: [], gastos: [], proyectos: [], ...partes };
}

function movimiento(partes: Partial<MovimientoDelLibro>): MovimientoDelLibro {
  return {
    id: 'm1',
    fecha: '2026-09-01',
    tipo: 'ingreso',
    tesoroOrigen: null,
    tesoroDestino: 'hogar',
    monto: $(1000),
    categoria: '',
    descripcion: '',
    proyectoId: null,
    ...partes,
  };
}

function pago(partes: Partial<PagoDelLibro>): PagoDelLibro {
  return {
    id: 'g1',
    proyectoId: 'p1',
    fecha: '2026-09-01',
    concepto: 'Seña',
    monto: $(500),
    ...partes,
  };
}

function gasto(partes: Partial<GastoDelLibro>): GastoDelLibro {
  return {
    id: 'x1',
    proyectoId: 'p1',
    fecha: '2026-09-01',
    descripcion: 'Melamina',
    monto: $(200),
    ...partes,
  };
}

function proyecto(partes: Partial<ProyectoDelLibro>): ProyectoDelLibro {
  return {
    id: 'p1',
    titulo: 'Placard',
    estado: 'en_curso',
    fechaCobro: null,
    diezmo: $(0),
    sueldo: $(0),
    ...partes,
  };
}

function porTesoro(asientos: readonly Asiento[], tesoro: Tesoro): Asiento[] {
  return asientos.filter((asiento) => asiento.tesoro === tesoro);
}

describe('movimientos manuales', () => {
  it('un ingreso entra a su tesoro y no genera contrapartida', () => {
    const asientos = asientosDelLibro(datos({ movimientos: [movimiento({})] }));

    expect(asientos).toHaveLength(1);
    expect(asientos[0]).toMatchObject({
      origen: 'manual',
      tesoro: 'hogar',
      contrapartida: null,
      monto: 1000,
      concepto: 'ingreso',
    });
  });

  it('un gasto sale de su tesoro con el signo cambiado', () => {
    const asientos = asientosDelLibro(
      datos({
        movimientos: [
          movimiento({ tipo: 'gasto', tesoroOrigen: 'maun', tesoroDestino: null, monto: $(700) }),
        ],
      }),
    );

    expect(asientos).toHaveLength(1);
    expect(asientos[0]).toMatchObject({ tesoro: 'maun', contrapartida: null, monto: -700 });
  });

  it('una transferencia genera los dos lados, y cada uno apunta al otro', () => {
    const asientos = asientosDelLibro(
      datos({
        movimientos: [
          movimiento({
            tipo: 'transferencia',
            tesoroOrigen: 'maun',
            tesoroDestino: 'cocos',
            monto: $(2500),
          }),
        ],
      }),
    );

    expect(asientos).toHaveLength(2);
    expect(asientos[0]).toMatchObject({ tesoro: 'cocos', contrapartida: 'maun', monto: 2500 });
    expect(asientos[1]).toMatchObject({ tesoro: 'maun', contrapartida: 'cocos', monto: -2500 });
  });
});

describe('pagos y gastos de un proyecto', () => {
  it('el pago entra a maun y el gasto sale de maun', () => {
    const asientos = asientosDelLibro(
      datos({ pagos: [pago({})], gastos: [gasto({})], proyectos: [proyecto({})] }),
    );

    expect(asientos).toHaveLength(2);
    expect(asientos[0]).toMatchObject({
      origen: 'pago',
      tesoro: 'maun',
      monto: 500,
      concepto: 'cobro',
      categoria: 'Cobro',
      descripcion: 'Seña',
    });
    expect(asientos[1]).toMatchObject({
      origen: 'gasto_proyecto',
      tesoro: 'maun',
      monto: -200,
      concepto: 'gasto',
      categoria: 'Materiales',
    });
  });

  it('los de un proyecto que no está no entran: es el join de la vista', () => {
    const asientos = asientosDelLibro(
      datos({
        pagos: [pago({ proyectoId: 'borrado' })],
        gastos: [gasto({ proyectoId: 'borrado' })],
      }),
    );

    expect(asientos).toEqual([]);
  });
});

describe('la distribución congelada', () => {
  it('un cobrado mueve el diezmo de maun a diezmo y el sueldo de maun a hogar', () => {
    const asientos = asientosDelLibro(
      datos({
        proyectos: [
          proyecto({
            estado: 'cobrado',
            fechaCobro: '2026-08-28',
            diezmo: $(88_670),
            sueldo: $(798_030),
          }),
        ],
      }),
    );

    expect(asientos).toHaveLength(4);
    expect(porTesoro(asientos, 'diezmo')[0]).toMatchObject({
      monto: 88_670,
      contrapartida: 'maun',
    });
    expect(porTesoro(asientos, 'hogar')[0]).toMatchObject({
      monto: 798_030,
      contrapartida: 'maun',
    });
    expect(porTesoro(asientos, 'maun').map((asiento) => asiento.monto)).toEqual([
      -88_670, -798_030,
    ]);
    expect(asientos[0]).toMatchObject({
      origen: 'distribucion',
      fecha: '2026-08-28',
      categoria: 'Distribución',
      descripcion: 'Placard',
      proyectoId: 'p1',
    });
  });

  // Un perdido con seña retenida también congela distribución y también mueve plata: la vista los
  // incluye desde la migración de perdidos, y este es el caso que distingue una copia vieja.
  it('un perdido con seña retenida también mueve el diezmo', () => {
    const asientos = asientosDelLibro(
      datos({
        proyectos: [
          proyecto({
            estado: 'perdido',
            fechaCobro: '2026-08-14',
            diezmo: $(320_000),
            sueldo: $(0),
          }),
        ],
      }),
    );

    expect(asientos).toHaveLength(2);
    expect(porTesoro(asientos, 'diezmo')[0]?.monto).toBe(320_000);
    expect(porTesoro(asientos, 'maun')[0]?.monto).toBe(-320_000);
  });

  it('los escalones en cero no generan asientos', () => {
    const asientos = asientosDelLibro(
      datos({
        proyectos: [
          proyecto({ estado: 'perdido', fechaCobro: '2026-07-10', diezmo: $(0), sueldo: $(0) }),
        ],
      }),
    );

    expect(asientos).toEqual([]);
  });

  it('un proyecto que no está liquidado no distribuye nada', () => {
    const asientos = asientosDelLibro(
      datos({ proyectos: [proyecto({ estado: 'en_curso', diezmo: $(999), sueldo: $(999) })] }),
    );

    expect(asientos).toEqual([]);
  });

  it('sin fecha de cobro tampoco, aunque el estado diga liquidado', () => {
    const asientos = asientosDelLibro(
      datos({
        proyectos: [
          proyecto({ estado: 'cobrado', fechaCobro: null, diezmo: $(10), sueldo: $(10) }),
        ],
      }),
    );

    expect(asientos).toEqual([]);
  });
});

describe('saldos', () => {
  it('el saldo de un tesoro es la suma de sus asientos, y los tesoros sin movimiento quedan en cero', () => {
    const completo = datos({
      movimientos: [
        movimiento({ id: 'm1', tesoroDestino: 'hogar', monto: $(420_000) }),
        movimiento({
          id: 'm2',
          tipo: 'gasto',
          tesoroOrigen: 'hogar',
          tesoroDestino: null,
          monto: $(86_400),
        }),
      ],
      pagos: [pago({ monto: $(1_000_000) })],
      gastos: [gasto({ monto: $(492_000) })],
      proyectos: [
        proyecto({
          estado: 'cobrado',
          fechaCobro: '2026-08-28',
          diezmo: $(50_000),
          sueldo: $(30_000),
        }),
      ],
    });

    expect(saldosDelLibro(completo)).toEqual({
      hogar: 420_000 - 86_400 + 30_000,
      maun: 1_000_000 - 492_000 - 50_000 - 30_000,
      diezmo: 50_000,
      cocos: 0,
    });
  });

  it('sin asientos, los cuatro tesoros están en cero', () => {
    expect(saldosPorTesoro([])).toEqual({ hogar: 0, maun: 0, diezmo: 0, cocos: 0 });
  });
});

describe('agregados del mes', () => {
  const asientos = asientosDelLibro(
    datos({
      movimientos: [
        movimiento({ id: 'm1', fecha: '2026-09-05', tesoroDestino: 'hogar', monto: $(420_000) }),
        movimiento({
          id: 'm2',
          fecha: '2026-09-09',
          tipo: 'gasto',
          tesoroOrigen: 'hogar',
          tesoroDestino: null,
          monto: $(86_400),
        }),
        movimiento({ id: 'm3', fecha: '2026-08-31', tesoroDestino: 'hogar', monto: $(999) }),
      ],
    }),
  );

  it('separa el mes pedido del resto', () => {
    expect(asientosDelMes(asientos, '2026-09')).toHaveLength(2);
    expect(asientosDelMes(asientos, '2026-08')).toHaveLength(1);
    expect(asientosDelMes(asientos, '2026-07')).toEqual([]);
  });

  it('lo que entró y lo que salió de un tesoro son dos números positivos', () => {
    expect(entradasYSalidas(asientosDelMes(asientos, '2026-09'), 'hogar')).toEqual({
      entro: 420_000,
      salio: 86_400,
    });
  });

  it('un tesoro sin asientos queda en cero de los dos lados', () => {
    expect(entradasYSalidas(asientos, 'cocos')).toEqual({ entro: 0, salio: 0 });
  });
});

describe('proyeccionCocos', () => {
  it('capitaliza el saldo por los días que faltan', () => {
    expect(proyeccionCocos($(10_000_000), 4_000, 365)).toBe(14_000_000);
  });

  it('sin días por delante, o sin tasa, devuelve el saldo tal cual', () => {
    expect(proyeccionCocos($(10_000_000), 4_000, 0)).toBe(10_000_000);
    expect(proyeccionCocos($(10_000_000), 4_000, -5)).toBe(10_000_000);
    expect(proyeccionCocos($(10_000_000), 0, 365)).toBe(10_000_000);
  });

  // La base acepta la tasa hasta 100000 puntos básicos: no es un porcentaje sobre plata, así que no
  // pasa por puntosBasicos(), que corta en 10000.
  it('acepta tasas por encima del 100%, que es lo que la base permite', () => {
    expect(proyeccionCocos($(1_000_000), 100_000, 365)).toBe(11_000_000);
  });

  it('rechaza una tasa que no es un entero no negativo', () => {
    expect(() => proyeccionCocos($(1), -1, 365)).toThrow(RangeError);
    expect(() => proyeccionCocos($(1), 1.5, 365)).toThrow(RangeError);
  });
});
