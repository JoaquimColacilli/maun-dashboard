import { describe, expect, it } from 'vitest';

import {
  leerEncuestaCompartida,
  leerResultadoDeContestar,
  motivoDelRechazo,
} from './encuestaPublica.ts';
import { RespuestaInvalidaError } from './replica.ts';

const CONFORME = {
  id: 'q-conforme',
  texto: '¿Qué tan conforme quedaste con el mueble?',
  tipo: 'escala5',
  escala: 'conformidad',
  obligatoria: true,
  opciones: null,
  propia: false,
};

const CONOCISTE = {
  id: 'q-conociste',
  texto: '¿Cómo nos conociste?',
  tipo: 'varias',
  escala: null,
  obligatoria: false,
  opciones: ['Me lo recomendaron', 'Por Instagram'],
  propia: false,
};

const MEJOR = {
  id: 'q-mejor',
  texto: '¿Qué podríamos hacer mejor?',
  tipo: 'texto',
  escala: null,
  obligatoria: false,
  opciones: null,
  propia: true,
};

function encuesta(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    taller: 'Taller MAUN',
    cliente: 'Marcela',
    trabajo: 'Placard 3 puertas',
    resena: 'https://g.page/r/CaMaunTaller/review',
    preguntas: [CONFORME, CONOCISTE, MEJOR],
    contestada: null,
    ...cambios,
  };
}

describe('la encuesta que devuelve la base', () => {
  it('se lee campo por campo', () => {
    expect(leerEncuestaCompartida(encuesta())).toEqual({
      taller: 'Taller MAUN',
      cliente: 'Marcela',
      trabajo: 'Placard 3 puertas',
      resena: 'https://g.page/r/CaMaunTaller/review',
      preguntas: [CONFORME, CONOCISTE, MEJOR],
      contestada: null,
    });
  });

  it('con lo que ya contestó, si contestó', () => {
    const leida = leerEncuestaCompartida(
      encuesta({
        contestada: {
          fecha: '2026-09-02',
          renglones: [
            { pregunta: 'q-conforme', valor: 5 },
            { pregunta: 'q-conociste', valor: [0, 1] },
            { pregunta: 'q-mejor', valor: 'Impecable.' },
          ],
        },
      }),
    );
    expect(leida.contestada).toEqual({
      fecha: '2026-09-02',
      renglones: [
        { preguntaId: 'q-conforme', valor: 5 },
        { preguntaId: 'q-conociste', valor: [0, 1] },
        { preguntaId: 'q-mejor', valor: 'Impecable.' },
      ],
    });
  });

  it('sin cliente ni reseña, o con una reseña que no es de Google, no inventa nada', () => {
    expect(leerEncuestaCompartida(encuesta({ cliente: null, resena: null }))).toMatchObject({
      cliente: null,
      resena: null,
    });
    expect(leerEncuestaCompartida(encuesta({ cliente: '  ', resena: '' }))).toMatchObject({
      cliente: null,
      resena: null,
    });
    expect(
      leerEncuestaCompartida(encuesta({ resena: 'https://otro-sitio.com/x' })).resena,
    ).toBeNull();
  });

  it('rechaza lo que no tiene la forma esperada', () => {
    const malas: Record<string, unknown>[] = [
      { taller: 3 },
      { preguntas: 'ninguna' },
      { preguntas: [null] },
      { preguntas: [{ ...CONFORME, tipo: 'matriz' }] },
      { preguntas: [{ ...CONFORME, escala: 'colores' }] },
      { preguntas: [{ ...CONFORME, obligatoria: 'sí' }] },
      { preguntas: [{ ...CONOCISTE, opciones: [1, 2] }] },
      { preguntas: [{ ...CONOCISTE, opciones: 'A, B' }] },
      { contestada: { fecha: 2, renglones: [] } },
      { contestada: { fecha: '2026-09-02', renglones: [{ pregunta: 'q', valor: ['a'] }] } },
      { contestada: { fecha: '2026-09-02', renglones: [{ pregunta: 'q', valor: true }] } },
    ];
    for (const cambios of malas) {
      expect(() => leerEncuestaCompartida(encuesta(cambios))).toThrow(RespuestaInvalidaError);
    }
    expect(() => leerEncuestaCompartida(null)).toThrow(RespuestaInvalidaError);
    expect(() => leerEncuestaCompartida([])).toThrow(RespuestaInvalidaError);
  });
});

describe('lo que contesta la base al guardar', () => {
  it('guardada o ya contestada, y nada más', () => {
    expect(leerResultadoDeContestar({ estado: 'guardada' })).toBe('guardada');
    expect(leerResultadoDeContestar({ estado: 'ya_contestada' })).toBe('ya_contestada');
    expect(() => leerResultadoDeContestar({ estado: 'otra' })).toThrow(RespuestaInvalidaError);
    expect(() => leerResultadoDeContestar('guardada')).toThrow(RespuestaInvalidaError);
  });

  it('el motivo de un rechazo viaja en el detail', () => {
    expect(motivoDelRechazo({ code: 'MN011', message: 'x', details: 'ajena' })).toBe('ajena');
    expect(motivoDelRechazo({ code: 'MN011', message: 'x', details: 'otro' })).toBeNull();
    expect(motivoDelRechazo({ code: 'MN010', message: 'Este link no funciona' })).toBeNull();
    expect(motivoDelRechazo(null)).toBeNull();
    expect(motivoDelRechazo('ajena')).toBeNull();
  });
});
