import { describe, expect, it } from 'vitest';

import type { Proyecto } from '@/entities/proyecto';

import {
  desdeCuando,
  errorDeLaFecha,
  fechasQuePasaron,
  momentoDeLaEntrega,
  opcionesParaConfirmar,
} from './entrega';

const HOY = '2026-09-25';

function trabajo(extra: Partial<Proyecto> = {}): Proyecto {
  return {
    id: 'p',
    estado: 'en_curso',
    entrega_estimada: null,
    listo_el: null,
    entrega_comprometida: null,
    entrega_comprometida_franja: null,
    ...extra,
  } as Proyecto;
}

describe('el día que se elige en la ficha', () => {
  it('la estimada y la comprometida desde hoy, lo que se le propone desde mañana', () => {
    expect(desdeCuando('estimada', HOY)).toBe(HOY);
    expect(desdeCuando('comprometida', HOY)).toBe(HOY);
    expect(desdeCuando('propuesta', HOY)).toBe('2026-09-26');
  });

  it('pide el día y no deja uno que el cliente no vería', () => {
    expect(errorDeLaFecha('estimada', '', HOY)).toBe('Elegí el día.');
    expect(errorDeLaFecha('comprometida', '2026-09-24', HOY)).toBe(
      'Esa fecha ya pasó y tu cliente no la vería: elegí una desde hoy.',
    );
    expect(errorDeLaFecha('propuesta', HOY, HOY)).toBe(
      'El día que le proponés tiene que ser desde mañana.',
    );
    expect(errorDeLaFecha('comprometida', HOY, HOY)).toBeUndefined();
    expect(errorDeLaFecha('propuesta', '2026-09-26', HOY)).toBeUndefined();
  });
});

describe('las fechas que ya pasaron', () => {
  it('avisa de la estimada y de la comprometida vencidas mientras lo fabrica', () => {
    expect(
      fechasQuePasaron(
        trabajo({ entrega_estimada: '2026-09-20', entrega_comprometida: '2026-09-24' }),
        HOY,
      ),
    ).toEqual([
      { cual: 'estimada', fecha: '2026-09-20' },
      { cual: 'comprometida', fecha: '2026-09-24' },
    ]);
    expect(fechasQuePasaron(trabajo({ entrega_estimada: HOY }), HOY)).toEqual([]);
  });

  it('entregado, ya no hay nada que avisar', () => {
    expect(
      fechasQuePasaron(trabajo({ estado: 'entregado', entrega_estimada: '2026-09-20' }), HOY),
    ).toEqual([]);
  });
});

describe('en qué momento de la entrega está', () => {
  it('fabricando, listo o con la entrega comprometida', () => {
    expect(momentoDeLaEntrega(trabajo())).toBe('fabricando');
    expect(momentoDeLaEntrega(trabajo({ listo_el: '2026-09-24' }))).toBe('listo');
    expect(momentoDeLaEntrega(trabajo({ entrega_comprometida: '2026-10-08' }))).toBe(
      'comprometida',
    );
  });
});

describe('los días del cliente para confirmar', () => {
  it('uno por cada franja que marcó, y nada si el día ya pasó', () => {
    expect(
      opcionesParaConfirmar({ fecha: '2026-09-29', franjas: ['manana', 'tarde'] }, HOY),
    ).toEqual([
      { fecha: '2026-09-29', franja: 'manana', etiqueta: 'A la mañana' },
      { fecha: '2026-09-29', franja: 'tarde', etiqueta: 'A la tarde' },
    ]);
    expect(opcionesParaConfirmar({ fecha: '2026-09-24', franjas: ['tarde'] }, HOY)).toEqual([]);
  });
});
