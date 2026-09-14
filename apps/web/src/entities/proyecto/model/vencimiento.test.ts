import { describe, expect, it } from 'vitest';

import type { Proyecto } from './catalogos';
import { vencimientoPropuesto } from './seguimiento';

const HOY = '2026-09-14';

function contacto(cambios: Partial<Proyecto> = {}): Proyecto {
  return {
    estado: 'relevamiento',
    fecha_visita: '2026-09-10',
    vencimiento_presupuesto: null,
    ...cambios,
  } as unknown as Proyecto;
}

describe('vencimientoPropuesto', () => {
  it('al pasar a presupuestar propone tres días hábiles desde el relevamiento', () => {
    expect(vencimientoPropuesto(contacto(), 'a_presupuestar', '2026-09-10', HOY)).toBe(
      '2026-09-15',
    );
  });

  it('si la visita es futura o no tiene fecha, cuenta desde hoy', () => {
    expect(vencimientoPropuesto(contacto(), 'a_presupuestar', '2026-09-20', HOY)).toBe(
      '2026-09-17',
    );
    expect(vencimientoPropuesto(contacto(), 'a_presupuestar', null, HOY)).toBe('2026-09-17');
    expect(vencimientoPropuesto(undefined, 'a_presupuestar', '', HOY)).toBe('2026-09-17');
  });

  it('un contacto nuevo que ya fue relevado también recibe la propuesta', () => {
    expect(vencimientoPropuesto(undefined, 'a_presupuestar', '2026-09-11', HOY)).toBe('2026-09-16');
  });

  it('no pisa la fecha que ya tiene, aunque la haya puesto a mano', () => {
    expect(
      vencimientoPropuesto(
        contacto({ vencimiento_presupuesto: '2026-09-30' }),
        'a_presupuestar',
        '2026-09-10',
        HOY,
      ),
    ).toBe('2026-09-30');
  });

  it('no propone nada si no pasa a presupuestar, ni si ya estaba a presupuestar', () => {
    expect(vencimientoPropuesto(contacto(), 'presupuesto_enviado', '2026-09-10', HOY)).toBeNull();
    expect(vencimientoPropuesto(contacto(), 'relevamiento', '2026-09-10', HOY)).toBeNull();
    expect(
      vencimientoPropuesto(
        contacto({ estado: 'a_presupuestar' }),
        'a_presupuestar',
        '2026-09-10',
        HOY,
      ),
    ).toBeNull();
  });
});
