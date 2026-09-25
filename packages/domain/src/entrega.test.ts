import { describe, expect, it } from 'vitest';

import {
  DIAS_MAXIMOS_DE_LA_RESPUESTA,
  esDiaDeLaEntrega,
  esFranja,
  FORMAS_DE_COORDINAR,
  FRANJAS_DE_ENTREGA,
  LARGO_MAXIMO_DE_LA_NOTA,
  MOTIVOS_DE_LA_ENTREGA,
  RESPUESTAS_DE_ENTREGA,
  sePuedeElegir,
  validarRespuestaDeEntrega,
} from './entrega.ts';

const HOY = '2026-09-25';

const ID = '0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b';

const PROPUESTA = '0192a3b4-c5d6-7e8f-9a0b-000000000001';

function misDias(dias: unknown, nota: unknown = ''): Record<string, unknown> {
  return { id: ID, propuesta_id: PROPUESTA, respuesta: 'mis_dias', dias, nota };
}

const ME_QUEDA_BIEN = {
  id: ID,
  propuesta_id: PROPUESTA,
  respuesta: 'me_queda_bien',
  dias: [],
  nota: '',
};

describe('los valores de la entrega', () => {
  it('son los de los enums de la base, en el mismo orden', () => {
    expect(FRANJAS_DE_ENTREGA).toEqual(['manana', 'tarde']);
    expect(FORMAS_DE_COORDINAR).toEqual(['un_dia', 'sus_dias']);
    expect(RESPUESTAS_DE_ENTREGA).toEqual(['me_queda_bien', 'mis_dias']);
    expect(MOTIVOS_DE_LA_ENTREGA).toContain('tope');
  });

  it('una franja es la mañana o la tarde', () => {
    expect(esFranja('manana')).toBe(true);
    expect(esFranja('noche')).toBe(false);
    expect(esFranja(1)).toBe(false);
  });
});

describe('qué días se pueden elegir', () => {
  it('un día es AAAA-MM-DD de este milenio y que existe', () => {
    expect(esDiaDeLaEntrega('2026-10-08')).toBe(true);
    expect(esDiaDeLaEntrega('2026-02-30')).toBe(false);
    expect(esDiaDeLaEntrega('1999-10-08')).toBe(false);
    expect(esDiaDeLaEntrega('2026-10-8')).toBe(false);
  });

  it('de pasado mañana a dentro de 30 días, sin domingos', () => {
    expect(sePuedeElegir('2026-09-26', HOY)).toBe(false);
    expect(sePuedeElegir('2026-09-27', HOY)).toBe(false);
    expect(sePuedeElegir('2026-09-28', HOY)).toBe(true);
    expect(sePuedeElegir('2026-10-24', HOY)).toBe(true);
    expect(sePuedeElegir('2026-10-25', HOY)).toBe(false);
    expect(sePuedeElegir('2026-10-26', HOY)).toBe(false);
  });
});

describe('validarRespuestaDeEntrega, la gemela de private.validar_respuesta_de_entrega', () => {
  it('acepta un día propuesto con «me queda bien», sin días ni nota', () => {
    expect(validarRespuestaDeEntrega(ME_QUEDA_BIEN, 'un_dia', HOY)).toBeNull();
    expect(validarRespuestaDeEntrega({ ...ME_QUEDA_BIEN, nota: '  \n' }, 'un_dia', HOY)).toBeNull();
  });

  it('acepta sus días, con sus franjas y una nota', () => {
    const dias = [
      { fecha: '2026-09-28', franjas: ['manana'] },
      { fecha: '2026-10-02', franjas: ['tarde', 'manana'] },
    ];
    expect(validarRespuestaDeEntrega(misDias(dias, 'Tercer piso'), 'un_dia', HOY)).toBeNull();
    expect(validarRespuestaDeEntrega(misDias(dias), 'sus_dias', HOY)).toBeNull();
  });

  it('acepta una nota sola, sin días', () => {
    expect(validarRespuestaDeEntrega(misDias([], 'Cualquier tarde'), 'sus_dias', HOY)).toBeNull();
  });

  it('rechaza lo que no tiene la forma', () => {
    const rotas: unknown[] = [
      null,
      [],
      'mis_dias',
      { ...ME_QUEDA_BIEN, extra: 1 },
      { id: ID, propuesta_id: PROPUESTA, respuesta: 'mis_dias', dias: [] },
      { ...ME_QUEDA_BIEN, id: 7 },
      { ...ME_QUEDA_BIEN, id: 'no-es-un-id' },
      { ...ME_QUEDA_BIEN, propuesta_id: null },
      { ...ME_QUEDA_BIEN, propuesta_id: 'otra' },
      { ...ME_QUEDA_BIEN, respuesta: 'quizas' },
      { ...ME_QUEDA_BIEN, dias: {} },
      { ...ME_QUEDA_BIEN, nota: 5 },
      misDias([null]),
      misDias([{ fecha: '2026-09-28' }]),
      misDias([{ fecha: '2026-09-28', franjas: ['manana'], hora: '10' }]),
      misDias([{ fecha: 20260928, franjas: ['manana'] }]),
      misDias([{ fecha: '2026-02-30', franjas: ['manana'] }]),
      misDias([{ fecha: '2026-09-28', franjas: 'manana' }]),
      misDias([{ fecha: '2026-09-28', franjas: [1] }]),
      { ...ME_QUEDA_BIEN, dias: [{ fecha: '2026-09-28', franjas: ['manana'] }] },
      { ...ME_QUEDA_BIEN, nota: 'Mejor a la tarde' },
    ];
    for (const rota of rotas) {
      expect(validarRespuestaDeEntrega(rota, 'un_dia', HOY)).toBe('forma');
    }
  });

  it('«me queda bien» solo contesta a un día propuesto', () => {
    expect(validarRespuestaDeEntrega(ME_QUEDA_BIEN, 'sus_dias', HOY)).toBe('propuesta');
  });

  it('sus días piden al menos uno, o una nota', () => {
    expect(validarRespuestaDeEntrega(misDias([], ' \t'), 'sus_dias', HOY)).toBe('vacia');
  });

  it('hasta diez días', () => {
    const once = Array.from({ length: DIAS_MAXIMOS_DE_LA_RESPUESTA + 1 }, (_, i) => ({
      fecha: `2026-10-${String(i + 5).padStart(2, '0')}`,
      franjas: ['manana'],
    }));
    expect(validarRespuestaDeEntrega(misDias(once), 'sus_dias', HOY)).toBe('demasiados');
  });

  it('cada día una vez', () => {
    const dias = [
      { fecha: '2026-09-28', franjas: ['manana'] },
      { fecha: '2026-09-28', franjas: ['tarde'] },
    ];
    expect(validarRespuestaDeEntrega(misDias(dias), 'sus_dias', HOY)).toBe('repetido');
  });

  it('entre pasado mañana y dentro de 30 días', () => {
    for (const fecha of ['2026-09-24', '2026-09-26', '2026-10-26']) {
      expect(
        validarRespuestaDeEntrega(misDias([{ fecha, franjas: ['manana'] }]), 'sus_dias', HOY),
      ).toBe('fuera');
    }
  });

  it('sin domingos', () => {
    expect(
      validarRespuestaDeEntrega(
        misDias([{ fecha: '2026-09-27', franjas: ['manana'] }]),
        'sus_dias',
        HOY,
      ),
    ).toBe('domingo');
  });

  it('cada día con la mañana, la tarde o las dos, una vez cada una', () => {
    const franjas: unknown[][] = [
      [],
      ['noche'],
      ['manana', 'manana'],
      ['manana', 'tarde', 'manana'],
    ];
    for (const unas of franjas) {
      expect(
        validarRespuestaDeEntrega(
          misDias([{ fecha: '2026-09-28', franjas: unas }]),
          'sus_dias',
          HOY,
        ),
      ).toBe('franja');
    }
  });

  it('la nota hasta 500 caracteres, contados sin los blancos de las puntas', () => {
    const dia = [{ fecha: '2026-09-28', franjas: ['manana'] }];
    const justa = `  ${'👍'.repeat(LARGO_MAXIMO_DE_LA_NOTA)}\n`;
    expect(validarRespuestaDeEntrega(misDias(dia, justa), 'sus_dias', HOY)).toBeNull();
    expect(
      validarRespuestaDeEntrega(
        misDias(dia, 'a'.repeat(LARGO_MAXIMO_DE_LA_NOTA + 1)),
        'sus_dias',
        HOY,
      ),
    ).toBe('largo');
  });
});
