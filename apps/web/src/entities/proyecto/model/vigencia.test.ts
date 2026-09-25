import { describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import type { Proyecto } from './catalogos';
import {
  conLaVigenciaAlMandar,
  diasQueValeElPresupuesto,
  presupuestoVencido,
  vigenciaDelPresupuesto,
} from './vigencia';

const HOY = '2026-09-24';

function trabajo(cambios: Partial<Proyecto> = {}): Proyecto {
  return {
    estado: 'a_presupuestar',
    presupuesto_vale_hasta: null,
    listo_el: null,
    entrega_comprometida: null,
    entrega_comprometida_franja: null,
    tipo_de_proyecto: null,
    ...cambios,
  } as unknown as Proyecto;
}

function filaVieja(cambios: Partial<Proyecto> = {}): Proyecto {
  return { estado: 'a_presupuestar', ...cambios } as unknown as Proyecto;
}

function ajustes(dias?: number): FilaDe<'ajustes'> {
  return (dias === undefined ? {} : { presupuesto_vale_dias: dias }) as FilaDe<'ajustes'>;
}

describe('la vigencia guardada', () => {
  it('se lee de la fila, y una fila de antes de la columna no tiene', () => {
    expect(vigenciaDelPresupuesto(trabajo({ presupuesto_vale_hasta: '2026-10-09' }))).toBe(
      '2026-10-09',
    );
    expect(vigenciaDelPresupuesto(filaVieja())).toBeNull();
  });

  it('los días salen de Ajustes, y sin el dato son los quince de siempre', () => {
    expect(diasQueValeElPresupuesto(ajustes(30))).toBe(30);
    expect(diasQueValeElPresupuesto(ajustes())).toBe(15);
    expect(diasQueValeElPresupuesto(undefined)).toBe(15);
  });
});

describe('al mandar el presupuesto', () => {
  it('le pone la fecha con los días de Ajustes, contados desde hoy', () => {
    expect(conLaVigenciaAlMandar(trabajo(), { estado: 'presupuesto_enviado' }, HOY, 15)).toEqual({
      estado: 'presupuesto_enviado',
      presupuesto_vale_hasta: '2026-10-09',
    });
  });

  it('una fecha vieja que quedó de otra vez se renueva: mandarlo de nuevo es otro presupuesto', () => {
    expect(
      conLaVigenciaAlMandar(
        trabajo({ presupuesto_vale_hasta: '2026-08-01' }),
        { estado: 'presupuesto_enviado' },
        HOY,
        10,
      ).presupuesto_vale_hasta,
    ).toBe('2026-10-04');
  });

  it('con todos los datos del formulario, la fecha sin tocar también se renueva', () => {
    expect(
      conLaVigenciaAlMandar(
        trabajo({ presupuesto_vale_hasta: '2026-08-01' }),
        { estado: 'presupuesto_enviado', presupuesto_vale_hasta: '2026-08-01' },
        HOY,
        15,
      ).presupuesto_vale_hasta,
    ).toBe('2026-10-09');
  });

  it('la que puso a mano en el mismo guardado se respeta, aunque la borre', () => {
    for (const puesta of ['2026-11-30', null]) {
      expect(
        conLaVigenciaAlMandar(
          trabajo({ presupuesto_vale_hasta: '2026-08-01' }),
          { estado: 'presupuesto_enviado', presupuesto_vale_hasta: puesta },
          HOY,
          15,
        ).presupuesto_vale_hasta,
      ).toBe(puesta);
    }
  });

  it('un trabajo nuevo que nace con el presupuesto mandado también la recibe', () => {
    expect(
      conLaVigenciaAlMandar(
        undefined,
        { estado: 'presupuesto_enviado', presupuesto_vale_hasta: null },
        HOY,
        15,
      ).presupuesto_vale_hasta,
    ).toBe('2026-10-09');
  });

  it('volver de seguimiento o de un trabajo aprobado no la toca, ni cualquier otro cambio', () => {
    const cambios = { estado: 'presupuesto_enviado' } as const;
    for (const estado of ['en_seguimiento', 'en_curso', 'presupuesto_enviado'] as const) {
      expect(conLaVigenciaAlMandar(trabajo({ estado }), cambios, HOY, 15)).toBe(cambios);
    }
    const otro = { titulo: 'Placard' };
    expect(conLaVigenciaAlMandar(trabajo(), otro, HOY, 15)).toBe(otro);
    expect(conLaVigenciaAlMandar(undefined, otro, HOY, 15)).toBe(otro);
  });
});

describe('presupuestoVencido', () => {
  it('solo con el presupuesto mandado y el día ya pasado', () => {
    const mandado = (valeHasta: string | null) =>
      trabajo({ estado: 'presupuesto_enviado', presupuesto_vale_hasta: valeHasta });
    expect(presupuestoVencido(mandado('2026-09-23'), HOY)).toBe(true);
    expect(presupuestoVencido(mandado(HOY), HOY)).toBe(false);
    expect(presupuestoVencido(mandado(null), HOY)).toBe(false);
    expect(presupuestoVencido(trabajo({ presupuesto_vale_hasta: '2026-09-01' }), HOY)).toBe(false);
    expect(presupuestoVencido(filaVieja({ estado: 'presupuesto_enviado' }), HOY)).toBe(false);
  });
});
