import { describe, expect, it } from 'vitest';

import {
  ESTADOS,
  ESTADOS_DE_SEGUIMIENTO,
  esEstado,
  estaLiquidado,
  faseDe,
  puedeCambiarEstado,
  puedeCerrarPerdido,
  puedeCobrar,
  puedeLiquidar,
  puedeReabrir,
  puedeReactivar,
  puedeRevertir,
  TRANSICIONES,
  type EstadoProyecto,
} from './estados.ts';

describe('estados', () => {
  it('son los nueve del enum de Postgres, en el mismo orden', () => {
    expect(ESTADOS).toEqual([
      'contacto',
      'presupuesto_estimativo',
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
      'seguimiento',
      'historial',
      'activos',
      'activos',
      'historial',
    ]);
    expect(ESTADOS_DE_SEGUIMIENTO.map(faseDe)).toEqual(Array(5).fill('seguimiento'));
  });

  it('liquidado es cobrado o perdido: los dos tienen la distribución congelada', () => {
    expect(ESTADOS.filter(estaLiquidado)).toEqual(['perdido', 'cobrado']);
  });
});

describe('transiciones manuales', () => {
  it('la tabla tiene una entrada por estado y ningún estado va a sí mismo', () => {
    expect(Object.keys(TRANSICIONES).sort()).toEqual([...ESTADOS].sort());
    for (const estado of ESTADOS) expect(puedeCambiarEstado(estado, estado)).toBe(false);
  });

  it('son veintiocho: las veinte del seguimiento, las cinco que lo convierten en obra y las tres de la obra', () => {
    expect(Object.values(TRANSICIONES).flat()).toHaveLength(28);
  });

  it('el estimativo es una etapa optativa entre el contacto y el relevamiento, y no se salta a la obra entregada', () => {
    expect(puedeCambiarEstado('contacto', 'presupuesto_estimativo')).toBe(true);
    expect(puedeCambiarEstado('presupuesto_estimativo', 'relevamiento')).toBe(true);
    expect(puedeCambiarEstado('contacto', 'relevamiento')).toBe(true);
    expect(puedeCambiarEstado('a_presupuestar', 'presupuesto_estimativo')).toBe(true);
    expect(puedeCambiarEstado('presupuesto_estimativo', 'a_presupuestar')).toBe(true);
    expect(puedeCambiarEstado('presupuesto_estimativo', 'en_curso')).toBe(true);
    expect(puedeCambiarEstado('presupuesto_estimativo', 'entregado')).toBe(false);
    expect(puedeCambiarEstado('en_curso', 'presupuesto_estimativo')).toBe(false);
  });

  it('un estimativo que no avanzó se da por perdido, y un perdido puede volver a estimativo', () => {
    expect(puedeCerrarPerdido('presupuesto_estimativo')).toBe(true);
    expect(puedeRevertir('perdido', 'presupuesto_estimativo')).toBe(true);
    expect(puedeCobrar('presupuesto_estimativo')).toBe(false);
  });

  it('nadie llega a un estado liquidado ni sale de uno a mano: eso es liquidar y revertir', () => {
    for (const estado of ESTADOS) {
      for (const liquidado of ['cobrado', 'perdido'] as const) {
        expect(puedeCambiarEstado(estado, liquidado)).toBe(false);
        expect(puedeCambiarEstado(liquidado, estado)).toBe(false);
      }
    }
  });

  it('un lead avanza, retrocede dentro del seguimiento o se convierte en obra', () => {
    for (const desde of ESTADOS_DE_SEGUIMIENTO) {
      for (const hasta of ESTADOS_DE_SEGUIMIENTO)
        expect(puedeCambiarEstado(desde, hasta)).toBe(desde !== hasta);
      expect(puedeCambiarEstado(desde, 'en_curso')).toBe(true);
      expect(puedeCambiarEstado(desde, 'entregado')).toBe(false);
    }
  });

  it('la obra se entrega o vuelve a presupuesto; lo entregado puede volver al taller', () => {
    expect(puedeCambiarEstado('en_curso', 'entregado')).toBe(true);
    expect(puedeCambiarEstado('en_curso', 'presupuesto_enviado')).toBe(true);
    expect(puedeCambiarEstado('en_curso', 'contacto')).toBe(false);
    expect(puedeCambiarEstado('entregado', 'en_curso')).toBe(true);
  });

  it('desde un contacto se llega a cualquier estado, contando liquidar y revertir', () => {
    const alcanzados = new Set<EstadoProyecto>(['contacto']);
    let frontera: EstadoProyecto[] = ['contacto'];
    while (frontera.length > 0) {
      const siguientes = frontera.flatMap((estado) => [
        ...TRANSICIONES[estado],
        ...ESTADOS.filter((hacia) => puedeLiquidar(estado, hacia) || puedeRevertir(estado, hacia)),
      ]);
      frontera = siguientes.filter((estado) => !alcanzados.has(estado));
      for (const estado of frontera) alcanzados.add(estado);
    }
    expect([...alcanzados].sort()).toEqual([...ESTADOS].sort());
  });
});

describe('liquidar y revertir', () => {
  it('se cobra solo lo entregado; se cierra como perdido un lead o una obra, no lo entregado', () => {
    expect(ESTADOS.filter(puedeCobrar)).toEqual(['entregado']);
    expect(ESTADOS.filter(puedeCerrarPerdido)).toEqual([...ESTADOS_DE_SEGUIMIENTO, 'en_curso']);
  });

  it('solo se liquida hacia cobrado o perdido', () => {
    for (const desde of ESTADOS) {
      for (const hacia of ESTADOS) {
        if (!estaLiquidado(hacia)) expect(puedeLiquidar(desde, hacia)).toBe(false);
      }
    }
  });

  it('un cobrado se reabre a entregado; un perdido se reactiva a cualquier estado de seguimiento', () => {
    expect(ESTADOS.filter(puedeReabrir)).toEqual(['cobrado']);
    expect(ESTADOS.filter(puedeReactivar)).toEqual(['perdido']);
    expect(ESTADOS.filter((hacia) => puedeRevertir('cobrado', hacia))).toEqual(['entregado']);
    expect(ESTADOS.filter((hacia) => puedeRevertir('perdido', hacia))).toEqual([
      ...ESTADOS_DE_SEGUIMIENTO,
    ]);
  });

  it('lo que no está liquidado no se revierte', () => {
    for (const desde of ESTADOS) {
      if (estaLiquidado(desde)) continue;
      for (const hacia of ESTADOS) expect(puedeRevertir(desde, hacia)).toBe(false);
    }
  });
});
