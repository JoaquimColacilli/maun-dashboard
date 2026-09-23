import type { Liquidacion } from '@maun/domain';
import { describe, expect, it } from 'vitest';

import { TABLAS_REPLICADAS, type Replica, type TablaReplicada } from '@/shared/api';

import type { Proyecto } from './catalogos';
import { fechaDelCobroPropuesta, repartoEnLaAperturaPropuesto } from './despiece';
import { filaLiquidada, filaRevertida, pedidoDeLiquidacion } from './liquidacion';

const HOY = '2026-09-23';
const APERTURA = '2026-09-14';

function replicaCon(pagos: readonly { fecha: string; proyecto_id?: string }[]): Replica {
  const tablas = {} as Record<TablaReplicada, Record<string, unknown>>;
  for (const tabla of TABLAS_REPLICADAS) tablas[tabla] = {};
  pagos.forEach((pago, indice) => {
    const id = `pago-${String(indice)}`;
    tablas.pagos[id] = { id, proyecto_id: 'p', deleted_at: null, ...pago };
  });
  return { usuarioId: 'u', cursor: '', reconciliadoEn: '', tablas } as unknown as Replica;
}

function proyecto(extra: Partial<Proyecto> = {}): Proyecto {
  return {
    id: 'p',
    estado: 'entregado',
    version: 3,
    fecha_cobro: null,
    reapertura_fecha_cobro: null,
    reapertura_objetivo_sueldo_centavos: null,
    reapertura_objetivo_fijos_centavos: null,
    reapertura_sueldo_mensual: null,
    reparto_ya_en_la_apertura: false,
    ...extra,
  } as Proyecto;
}

const REABIERTO = {
  estado: 'entregado',
  reapertura_fecha_cobro: '2026-07-10',
  reapertura_objetivo_sueldo_centavos: 50_000_000,
  reapertura_objetivo_fijos_centavos: 25_000_000,
  reapertura_sueldo_mensual: true,
} satisfies Partial<Proyecto>;

describe('fechaDelCobroPropuesta', () => {
  it('es el día del último pago del trabajo, no hoy', () => {
    const replica = replicaCon([
      { fecha: '2026-07-10' },
      { fecha: '2026-08-20' },
      { fecha: '2026-09-01', proyecto_id: 'otro' },
    ]);
    expect(fechaDelCobroPropuesta(replica, proyecto(), HOY)).toBe('2026-08-20');
  });

  it('con el pago final que se está cargando, sigue a ese día', () => {
    const replica = replicaCon([{ fecha: '2026-07-10' }]);
    expect(fechaDelCobroPropuesta(replica, proyecto(), HOY, '2026-09-05')).toBe('2026-09-05');
    expect(fechaDelCobroPropuesta(replica, proyecto(), HOY, '')).toBe('2026-07-10');
  });

  it('sin pagos, o con un día que todavía no llegó, propone hoy', () => {
    expect(fechaDelCobroPropuesta(replicaCon([]), proyecto(), HOY)).toBe(HOY);
    expect(fechaDelCobroPropuesta(replicaCon([]), proyecto(), HOY, '2026-09-30')).toBe(HOY);
  });

  it('un cobro reabierto trae el día del cobro original', () => {
    const replica = replicaCon([{ fecha: '2026-09-20' }]);
    expect(fechaDelCobroPropuesta(replica, proyecto(REABIERTO), HOY)).toBe('2026-07-10');
  });
});

describe('repartoEnLaAperturaPropuesto', () => {
  it('lo de antes de la apertura arranca tildado, lo de después ni se pregunta', () => {
    expect(repartoEnLaAperturaPropuesto(proyecto(), '2026-07-10', APERTURA)).toBe(true);
    expect(repartoEnLaAperturaPropuesto(proyecto(), APERTURA, APERTURA)).toBe(false);
    expect(repartoEnLaAperturaPropuesto(proyecto(), '2026-07-10', null)).toBe(false);
  });

  it('un cobro reabierto conserva lo que tenía', () => {
    expect(repartoEnLaAperturaPropuesto(proyecto(REABIERTO), '2026-07-10', APERTURA)).toBe(false);
    expect(
      repartoEnLaAperturaPropuesto(
        proyecto({ ...REABIERTO, reparto_ya_en_la_apertura: true }),
        '2026-07-10',
        APERTURA,
      ),
    ).toBe(true);
  });
});

describe('la marca de la apertura en el cobro', () => {
  const liquidacion = {
    destino: 'cobrado',
    fecha: '2026-07-10',
    cobrado: 70_000_000,
    gastos: 0,
    topeSueldo: 50_000_000,
    topeFijos: 25_000_000,
    diezmoBp: 1000,
    diezmo: 7_000_000,
    sueldo: 50_000_000,
    fijos: 13_000_000,
    remanente: 0,
    previo: { sueldo: 0, fijos: 0 },
    objetivos: { sueldo: 50_000_000, fijos: 25_000_000, sueldoMensual: true },
  } as unknown as Liquidacion;

  it('viaja en el pedido y en la fila optimista', () => {
    expect(pedidoDeLiquidacion(proyecto(), liquidacion, true)).toMatchObject({
      fecha: '2026-07-10',
      yaEnLaApertura: true,
    });
    expect(pedidoDeLiquidacion(proyecto(), liquidacion).yaEnLaApertura).toBe(false);
    expect(filaLiquidada(proyecto(), liquidacion, 'ahora', true)).toMatchObject({
      estado: 'cobrado',
      fecha_cobro: '2026-07-10',
      reparto_ya_en_la_apertura: true,
    });
  });

  it('reabrir un cobro la conserva, reactivar un perdido la apaga', () => {
    const cobrado = proyecto({
      estado: 'cobrado',
      fecha_cobro: '2026-07-10',
      reparto_ya_en_la_apertura: true,
    });
    expect(filaRevertida(cobrado, 'entregado', 'ahora')).toMatchObject({
      reapertura_fecha_cobro: '2026-07-10',
      reparto_ya_en_la_apertura: true,
      fecha_cobro: null,
    });

    const perdido = proyecto({ estado: 'perdido', reparto_ya_en_la_apertura: true });
    expect(filaRevertida(perdido, 'presupuesto_enviado', 'ahora').reparto_ya_en_la_apertura).toBe(
      false,
    );
  });
});
