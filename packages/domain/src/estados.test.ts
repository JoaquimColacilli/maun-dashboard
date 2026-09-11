import { describe, expect, it } from 'vitest';

import {
  ESTADOS,
  esEstado,
  faseDe,
  puedeCambiarEstado,
  puedeCobrar,
  puedeReabrir,
  TRANSICIONES,
  type EstadoProyecto,
} from './estados.ts';

describe('estados', () => {
  it('son los ocho del enum de Postgres, en el mismo orden', () => {
    expect(ESTADOS).toEqual([
      'contacto',
      'relevamiento',
      'a_presupuestar',
      'presupuesto_enviado',
      'perdido',
      'en_curso',
      'entregado',
      'cobrado',
    ]);
  });

  it('reconoce un estado válido y rechaza cualquier otro texto', () => {
    expect(esEstado('en_curso')).toBe(true);
    expect(esEstado('terminado')).toBe(false);
  });

  it('cada estado cae en su fase de pantalla', () => {
    expect(ESTADOS.map(faseDe)).toEqual([
      'seguimiento',
      'seguimiento',
      'seguimiento',
      'seguimiento',
      'historial',
      'activos',
      'activos',
      'historial',
    ]);
  });
});

describe('transiciones manuales', () => {
  it('la tabla tiene una entrada por estado y ningún estado va a sí mismo', () => {
    expect(Object.keys(TRANSICIONES).sort()).toEqual([...ESTADOS].sort());
    for (const estado of ESTADOS) expect(puedeCambiarEstado(estado, estado)).toBe(false);
  });

  it('nadie llega a cobrado ni sale de cobrado a mano: eso es cobrar y reabrir', () => {
    for (const estado of ESTADOS) {
      expect(puedeCambiarEstado(estado, 'cobrado')).toBe(false);
      expect(puedeCambiarEstado('cobrado', estado)).toBe(false);
    }
  });

  it('un lead avanza, retrocede dentro del seguimiento, se convierte o se pierde', () => {
    const seguimiento: EstadoProyecto[] = [
      'contacto',
      'relevamiento',
      'a_presupuestar',
      'presupuesto_enviado',
    ];
    for (const desde of seguimiento) {
      for (const hasta of seguimiento)
        expect(puedeCambiarEstado(desde, hasta)).toBe(desde !== hasta);
      expect(puedeCambiarEstado(desde, 'en_curso')).toBe(true);
      expect(puedeCambiarEstado(desde, 'perdido')).toBe(true);
      expect(puedeCambiarEstado(desde, 'entregado')).toBe(false);
    }
  });

  it('un perdido se reactiva como lead, pero no salta a la obra', () => {
    expect(puedeCambiarEstado('perdido', 'contacto')).toBe(true);
    expect(puedeCambiarEstado('perdido', 'presupuesto_enviado')).toBe(true);
    expect(puedeCambiarEstado('perdido', 'en_curso')).toBe(false);
  });

  it('la obra se entrega, se cae o vuelve a presupuesto; lo entregado puede volver al taller', () => {
    expect(puedeCambiarEstado('en_curso', 'entregado')).toBe(true);
    expect(puedeCambiarEstado('en_curso', 'perdido')).toBe(true);
    expect(puedeCambiarEstado('en_curso', 'presupuesto_enviado')).toBe(true);
    expect(puedeCambiarEstado('en_curso', 'contacto')).toBe(false);
    expect(puedeCambiarEstado('entregado', 'en_curso')).toBe(true);
    expect(puedeCambiarEstado('entregado', 'perdido')).toBe(false);
  });

  it('desde un contacto se llega a cualquier estado, contando el cobro', () => {
    const alcanzados = new Set<EstadoProyecto>(['contacto']);
    let frontera: EstadoProyecto[] = ['contacto'];
    while (frontera.length > 0) {
      const siguientes = frontera.flatMap((estado) => [
        ...TRANSICIONES[estado],
        ...(puedeCobrar(estado) ? (['cobrado'] as const) : []),
      ]);
      frontera = siguientes.filter((estado) => !alcanzados.has(estado));
      for (const estado of frontera) alcanzados.add(estado);
    }
    expect([...alcanzados].sort()).toEqual([...ESTADOS].sort());
  });
});

describe('cobrar y reabrir', () => {
  it('solo se cobra un proyecto entregado y solo se reabre uno cobrado', () => {
    expect(ESTADOS.filter(puedeCobrar)).toEqual(['entregado']);
    expect(ESTADOS.filter(puedeReabrir)).toEqual(['cobrado']);
  });
});
