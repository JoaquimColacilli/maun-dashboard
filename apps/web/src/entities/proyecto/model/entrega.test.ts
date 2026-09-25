import { describe, expect, it } from 'vitest';

import type { FilaDe } from '@/shared/api';

import {
  cambiaAlgoDeLaEntrega,
  cambiosDeLaComprometida,
  entregaGuardada,
  listoDelTrabajo,
  tipoDelTrabajo,
} from './entrega';

function trabajo(extra: Partial<FilaDe<'proyectos'>> = {}): FilaDe<'proyectos'> {
  return {
    id: 'p',
    estado: 'en_curso',
    listo_el: '2026-09-24',
    entrega_comprometida: '2026-10-08',
    entrega_comprometida_franja: 'manana',
    tipo_de_proyecto: 'Placard',
    ...extra,
  } as FilaDe<'proyectos'>;
}

describe('la entrega guardada en el trabajo', () => {
  it('se lee de sus tres columnas', () => {
    expect(entregaGuardada(trabajo())).toEqual({
      listo_el: '2026-09-24',
      entrega_comprometida: '2026-10-08',
      entrega_comprometida_franja: 'manana',
    });
    expect(listoDelTrabajo(trabajo())).toBe('2026-09-24');
    expect(tipoDelTrabajo(trabajo())).toBe('Placard');
  });

  it('una fila guardada antes de las columnas se lee sin listo, sin comprometida y sin tipo', () => {
    const vieja = trabajo() as Partial<FilaDe<'proyectos'>>;
    delete vieja.listo_el;
    delete vieja.entrega_comprometida;
    delete vieja.entrega_comprometida_franja;
    delete vieja.tipo_de_proyecto;
    const fila = vieja as FilaDe<'proyectos'>;

    expect(entregaGuardada(fila)).toEqual({
      listo_el: null,
      entrega_comprometida: null,
      entrega_comprometida_franja: null,
    });
    expect(tipoDelTrabajo(fila)).toBeNull();
  });

  it('solo cambia algo lo que viene distinto', () => {
    expect(cambiaAlgoDeLaEntrega(trabajo(), { listo_el: '2026-09-24' })).toBe(false);
    expect(cambiaAlgoDeLaEntrega(trabajo(), { listo_el: null })).toBe(true);
    expect(cambiaAlgoDeLaEntrega(trabajo(), { entrega_comprometida_franja: 'tarde' })).toBe(true);
    expect(cambiaAlgoDeLaEntrega(trabajo(), {})).toBe(false);
  });

  it('sacar la comprometida se lleva la franja', () => {
    expect(cambiosDeLaComprometida('2026-10-08', 'tarde')).toEqual({
      entrega_comprometida: '2026-10-08',
      entrega_comprometida_franja: 'tarde',
    });
    expect(cambiosDeLaComprometida(null, 'tarde')).toEqual({
      entrega_comprometida: null,
      entrega_comprometida_franja: null,
    });
  });
});
