import { describe, expect, it } from 'vitest';

import { ESTADOS, type EstadoProyecto } from './estados.ts';
import {
  DIAS_QUE_VALE_UN_PRESUPUESTO,
  seMandaElPresupuesto,
  vencioElPresupuesto,
  vigenciaAlMandar,
} from './vigencia.ts';

describe('cuándo se manda el presupuesto', () => {
  it('es entrar a presupuesto enviado desde una etapa anterior', () => {
    for (const desde of [
      'contacto',
      'presupuesto_estimativo',
      'relevamiento',
      'a_presupuestar',
    ] satisfies EstadoProyecto[]) {
      expect(seMandaElPresupuesto(desde, 'presupuesto_enviado')).toBe(true);
    }
  });

  it('y también un trabajo que nace con el presupuesto ya mandado', () => {
    expect(seMandaElPresupuesto(null, 'presupuesto_enviado')).toBe(true);
  });

  it('volver de seguimiento, de perdido o de un trabajo aprobado no es mandarlo: la fecha que tenía queda', () => {
    for (const desde of ['en_seguimiento', 'perdido', 'en_curso'] satisfies EstadoProyecto[]) {
      expect(seMandaElPresupuesto(desde, 'presupuesto_enviado')).toBe(false);
    }
  });

  it('quedarse en presupuesto enviado tampoco', () => {
    expect(seMandaElPresupuesto('presupuesto_enviado', 'presupuesto_enviado')).toBe(false);
  });

  it('ir a cualquier otra etapa no es mandar el presupuesto', () => {
    for (const hacia of ESTADOS.filter((estado) => estado !== 'presupuesto_enviado')) {
      expect(seMandaElPresupuesto('a_presupuestar', hacia)).toBe(false);
      expect(seMandaElPresupuesto(null, hacia)).toBe(false);
    }
  });
});

describe('hasta cuándo vale', () => {
  it('arranca en quince días', () => {
    expect(DIAS_QUE_VALE_UN_PRESUPUESTO).toBe(15);
  });

  it('se cuenta en días corridos desde el día que se manda', () => {
    expect(vigenciaAlMandar('2026-09-24', 15)).toBe('2026-10-09');
    expect(vigenciaAlMandar('2026-12-20', 15)).toBe('2027-01-04');
  });

  it('vence recién el día después de la fecha: el mismo día todavía vale', () => {
    expect(vencioElPresupuesto('2026-10-09', '2026-10-08')).toBe(false);
    expect(vencioElPresupuesto('2026-10-09', '2026-10-09')).toBe(false);
    expect(vencioElPresupuesto('2026-10-09', '2026-10-10')).toBe(true);
  });

  it('sin fecha no vence nunca', () => {
    expect(vencioElPresupuesto(null, '2030-01-01')).toBe(false);
  });
});
