import { describe, expect, it } from 'vitest';

import type { AvisoDeEntrega } from '@/entities/entrega';

import { tituloDelAviso } from './entregas';

const HOY = '2026-09-25';

function aviso(extra: Partial<AvisoDeEntrega>): AvisoDeEntrega {
  return {
    proyectoId: 'p',
    cliente: 'Cintia',
    trabajo: 'Placard',
    respuesta: 'me_queda_bien',
    fecha: '2026-10-08',
    franja: null,
    creadaEn: '2026-09-25T12:00:00Z',
    sinLeer: [],
    ...extra,
  };
}

describe('el aviso de Inicio con lo que contestó el cliente', () => {
  it('dice qué día aceptó, con la franja si la había', () => {
    expect(tituloDelAviso(aviso({}), HOY)).toBe('Cintia aceptó el jue 8 oct');
    expect(tituloDelAviso(aviso({ franja: 'tarde' }), HOY)).toBe(
      'Cintia aceptó el jue 8 oct, a la tarde',
    );
    expect(tituloDelAviso(aviso({ fecha: null }), HOY)).toBe(
      'Cintia aceptó el día que le propusiste',
    );
  });

  it('o que le pasó sus días', () => {
    expect(tituloDelAviso(aviso({ respuesta: 'mis_dias', fecha: null }), HOY)).toBe(
      'Cintia te pasó sus días',
    );
    expect(tituloDelAviso(aviso({ respuesta: 'mis_dias', cliente: '' }), HOY)).toBe(
      'Tu cliente te pasó sus días',
    );
  });
});
