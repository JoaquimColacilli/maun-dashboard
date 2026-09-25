import { centavos } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type Replica, type TablaReplicada } from '@/shared/api';

import type { Proyecto } from './catalogos';
import { corteDelMes, fraseDelCorte, piezasDelCorte, type CorteDelMes } from './corte';
import { distribucionCongelada } from './despiece';

const SEPTIEMBRE = '2026-09';

interface Reparto {
  cobrado: number;
  gastos: number;
  diezmo: number;
  sueldo: number;
  fijos: number;
  remanente: number;
}

function cerrado(
  id: string,
  fecha: string,
  reparto: Reparto,
  extra: Partial<Proyecto> = {},
): Proyecto {
  return {
    id,
    estado: 'cobrado',
    fecha_cobro: fecha,
    dist_cobrado_centavos: reparto.cobrado,
    dist_gastos_centavos: reparto.gastos,
    dist_diezmo_bp: 1000,
    dist_tope_sueldo_centavos: reparto.sueldo,
    dist_tope_fijos_centavos: reparto.fijos,
    dist_diezmo_centavos: reparto.diezmo,
    dist_sueldo_centavos: reparto.sueldo,
    dist_fijos_centavos: reparto.fijos,
    dist_remanente_centavos: reparto.remanente,
    reparto_ya_en_la_apertura: false,
    deleted_at: null,
    ...extra,
  } as Proyecto;
}

function sinCerrar(id: string, extra: Partial<Proyecto> = {}): Proyecto {
  return {
    id,
    estado: 'entregado',
    fecha_cobro: null,
    dist_cobrado_centavos: null,
    deleted_at: null,
    ...extra,
  } as Proyecto;
}

function replicaCon(proyectos: readonly Proyecto[]): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) tablas[tabla] = {};
  for (const proyecto of proyectos) tablas.proyectos[proyecto.id] = proyecto;
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

function corte(
  trabajos: number,
  partes: { tablero: number; hogar: number; maun: number; diezmo: number; gastos: number },
): CorteDelMes {
  return {
    trabajos,
    tablero: centavos(partes.tablero),
    hogar: centavos(partes.hogar),
    maun: centavos(partes.maun),
    diezmo: centavos(partes.diezmo),
    gastos: centavos(partes.gastos),
  };
}

const PLACARD: Reparto = {
  cobrado: 60_000_000,
  gastos: 10_000_000,
  diezmo: 5_000_000,
  sueldo: 30_000_000,
  fijos: 12_000_000,
  remanente: 3_000_000,
};

const SENA_RETENIDA: Reparto = {
  cobrado: 20_000_000,
  gastos: 0,
  diezmo: 2_000_000,
  sueldo: 0,
  fijos: 8_000_000,
  remanente: 10_000_000,
};

const EL_DEL_EJEMPLO = corte(3, {
  tablero: 100_000_000,
  hogar: 48_000_000,
  maun: 25_800_000,
  diezmo: 8_200_000,
  gastos: 18_000_000,
});

describe('distribucionCongelada', () => {
  it('es la de la fila de un trabajo cerrado, con la neta sobre lo cobrado menos los gastos', () => {
    const distribucion = distribucionCongelada(cerrado('a', '2026-09-10', PLACARD));
    expect(distribucion).toMatchObject({
      cobrado: 60_000_000,
      gastos: 10_000_000,
      neta: 50_000_000,
      diezmo: 5_000_000,
      sueldo: 30_000_000,
      fijos: 12_000_000,
      remanente: 3_000_000,
    });
  });

  it('un trabajo sin cerrar, o cerrado sin la distribución en la fila, no tiene', () => {
    expect(distribucionCongelada(sinCerrar('b'))).toBeNull();
    expect(
      distribucionCongelada(cerrado('c', '2026-09-10', PLACARD, { estado: 'entregado' })),
    ).toBeNull();
    expect(
      distribucionCongelada(cerrado('d', '2026-09-10', PLACARD, { dist_cobrado_centavos: null })),
    ).toBeNull();
  });
});

describe('corteDelMes', () => {
  it('suma los cobrados y los perdidos del mes, y deja afuera los de otro mes y los que no se cerraron', () => {
    const replica = replicaCon([
      cerrado('a', '2026-09-10', PLACARD),
      cerrado('b', '2026-09-21', SENA_RETENIDA, { estado: 'perdido' }),
      cerrado('c', '2026-08-31', { ...PLACARD, cobrado: 99_000_000, sueldo: 69_000_000 }),
      sinCerrar('d'),
      cerrado('e', '2026-09-12', PLACARD, { estado: 'entregado' }),
    ]);

    expect(corteDelMes(replica, SEPTIEMBRE)).toEqual({
      trabajos: 2,
      tablero: 80_000_000,
      hogar: 30_000_000,
      maun: 33_000_000,
      diezmo: 7_000_000,
      gastos: 10_000_000,
    });
  });

  it('el que se repartió en la apertura cuenta: el trabajo se cerró ese mes', () => {
    const replica = replicaCon([
      cerrado('a', '2026-09-02', PLACARD, { reparto_ya_en_la_apertura: true }),
    ]);
    expect(corteDelMes(replica, SEPTIEMBRE)?.trabajos).toBe(1);
    expect(corteDelMes(replica, SEPTIEMBRE)?.tablero).toBe(60_000_000);
  });

  it('uno con más gastos que lo cobrado cuenta, sus partes dan cero y lo cobrado va entero a los gastos', () => {
    const replica = replicaCon([
      cerrado('a', '2026-09-15', {
        cobrado: 10_000_000,
        gastos: 15_000_000,
        diezmo: 0,
        sueldo: 0,
        fijos: 0,
        remanente: -5_000_000,
      }),
    ]);

    expect(corteDelMes(replica, SEPTIEMBRE)).toEqual({
      trabajos: 1,
      tablero: 10_000_000,
      hogar: 0,
      maun: 0,
      diezmo: 0,
      gastos: 10_000_000,
    });
  });

  it('sin ningún trabajo cerrado en el mes no hay corte', () => {
    expect(corteDelMes(replicaCon([]), SEPTIEMBRE)).toBeNull();
    expect(
      corteDelMes(replicaCon([cerrado('a', '2026-08-31', PLACARD), sinCerrar('b')]), SEPTIEMBRE),
    ).toBeNull();
  });
});

describe('piezasDelCorte', () => {
  it('son el hogar, el taller, el diezmo y los gastos, en ese orden, cada una sobre lo cobrado', () => {
    expect(piezasDelCorte(EL_DEL_EJEMPLO)).toEqual([
      { id: 'hogar', tono: 'hogar', nombre: 'Hogar', parte: 0.48, porcentaje: '48%' },
      { id: 'maun', tono: 'maun', nombre: 'Maun', parte: 0.258, porcentaje: '26%' },
      { id: 'diezmo', tono: 'diezmo', nombre: 'Diezmo', parte: 0.082, porcentaje: '8%' },
      { id: 'gastos', tono: 'sobrante', nombre: 'Gastos', parte: 0.18, porcentaje: '18%' },
    ]);
  });

  it('el orden no cambia aunque falte una parte, y los gastos van sin color de tesoro', () => {
    const piezas = piezasDelCorte(
      corte(2, {
        tablero: 30_000_000,
        hogar: 0,
        maun: 20_000_000,
        diezmo: 3_000_000,
        gastos: 7_000_000,
      }),
    );
    expect(piezas.map((pieza) => [pieza.id, pieza.tono])).toEqual([
      ['maun', 'maun'],
      ['diezmo', 'diezmo'],
      ['gastos', 'sobrante'],
    ]);
  });

  it('una parte en cero no es pieza', () => {
    const piezas = piezasDelCorte(
      corte(1, { tablero: 20_000_000, hogar: 12_000_000, maun: 8_000_000, diezmo: 0, gastos: 0 }),
    );
    expect(piezas.map((pieza) => pieza.id)).toEqual(['hogar', 'maun']);
  });

  it('sin nada cobrado no hay tablero que cortar', () => {
    expect(
      piezasDelCorte(corte(1, { tablero: 0, hogar: 0, maun: 0, diezmo: 0, gastos: 0 })),
    ).toEqual([]);
  });
});

describe('fraseDelCorte', () => {
  it('sin corte, el mes todavía no se cortó', () => {
    expect(fraseDelCorte(null, SEPTIEMBRE)).toBe(
      'Septiembre todavía no se cortó. Cuando cierres un trabajo, acá vas a ver a dónde va cada peso.',
    );
    expect(fraseDelCorte(null, '2026-10')).toBe(
      'Octubre todavía no se cortó. Cuando cierres un trabajo, acá vas a ver a dónde va cada peso.',
    );
  });

  it('dice cuántos trabajos, a dónde fue cada parte y, si hubo, que lo demás fueron gastos', () => {
    expect(fraseDelCorte(EL_DEL_EJEMPLO, SEPTIEMBRE)).toBe(
      '3 trabajos cerrados en septiembre: 48% al hogar, 26% al taller y 8% al diezmo. Lo demás fueron gastos.',
    );
    expect(
      fraseDelCorte(
        corte(1, { tablero: 100, hogar: 60, maun: 30, diezmo: 10, gastos: 0 }),
        SEPTIEMBRE,
      ),
    ).toBe('Un trabajo cerrado en septiembre: 60% al hogar, 30% al taller y 10% al diezmo.');
  });

  it('nombra solo las partes que no son cero', () => {
    expect(
      fraseDelCorte(
        corte(1, { tablero: 20_000_000, hogar: 0, maun: 18_000_000, diezmo: 2_000_000, gastos: 0 }),
        SEPTIEMBRE,
      ),
    ).toBe('Un trabajo cerrado en septiembre: 90% al taller y 10% al diezmo.');
    expect(
      fraseDelCorte(
        corte(1, { tablero: 10_000_000, hogar: 0, maun: 0, diezmo: 1_000_000, gastos: 9_000_000 }),
        SEPTIEMBRE,
      ),
    ).toBe('Un trabajo cerrado en septiembre: 10% al diezmo. Lo demás fueron gastos.');
  });

  it('una parte que redondea a cero dice menos del 1%', () => {
    expect(
      fraseDelCorte(
        corte(2, {
          tablero: 100_000_000,
          hogar: 60_000_000,
          maun: 39_700_000,
          diezmo: 300_000,
          gastos: 0,
        }),
        SEPTIEMBRE,
      ),
    ).toBe(
      '2 trabajos cerrados en septiembre: 60% al hogar, 40% al taller y menos del 1% al diezmo.',
    );
  });

  it('si los gastos se comieron lo cobrado, lo dice', () => {
    expect(
      fraseDelCorte(
        corte(1, { tablero: 10_000_000, hogar: 0, maun: 0, diezmo: 0, gastos: 10_000_000 }),
        SEPTIEMBRE,
      ),
    ).toBe(
      'Un trabajo cerrado en septiembre, y los gastos se comieron lo cobrado: no quedó ganancia para repartir.',
    );
  });

  it('si no se cobró nada, no hubo nada para repartir', () => {
    expect(
      fraseDelCorte(corte(1, { tablero: 0, hogar: 0, maun: 0, diezmo: 0, gastos: 0 }), SEPTIEMBRE),
    ).toBe('Un trabajo cerrado en septiembre, sin nada cobrado: no hubo nada para repartir.');
  });

  it('cada forma cuenta uno o varios trabajos, y ningún porcentaje lleva espacio antes', () => {
    const formas = [
      { tablero: 100, hogar: 60, maun: 30, diezmo: 10, gastos: 0 },
      { tablero: 100_000_000, hogar: 60_000_000, maun: 39_700_000, diezmo: 300_000, gastos: 0 },
      { tablero: 10_000_000, hogar: 0, maun: 0, diezmo: 1_000_000, gastos: 9_000_000 },
      { tablero: 10_000_000, hogar: 0, maun: 0, diezmo: 0, gastos: 10_000_000 },
      { tablero: 0, hogar: 0, maun: 0, diezmo: 0, gastos: 0 },
    ];
    const frases = [fraseDelCorte(null, SEPTIEMBRE)];

    for (const partes of formas) {
      const uno = fraseDelCorte(corte(1, partes), SEPTIEMBRE);
      const varios = fraseDelCorte(corte(4, partes), SEPTIEMBRE);
      expect(uno).toMatch(/^Un trabajo cerrado en septiembre[,:] /);
      expect(varios).toMatch(/^4 trabajos cerrados en septiembre[,:] /);
      expect(varios.replace(/^4 trabajos cerrados/, 'Un trabajo cerrado')).toBe(uno);
      frases.push(uno, varios);
    }

    for (const frase of frases) {
      expect(frase).not.toMatch(/\s%/);
    }
  });
});
