import { describe, expect, it } from 'vitest';

import {
  armarRespuesta,
  esLinkDeResena,
  faltantes,
  HOSTS_DE_RESENA,
  largoDelTexto,
  LARGO_MAXIMO_DE_LA_RESPUESTA,
  LARGO_MAXIMO_DEL_LINK_DE_RESENA,
  MOTIVOS_DEL_RECHAZO,
  normalizarLinkDeResena,
  revisarLinkDeResena,
  sinBlancosEnLasPuntas,
  tieneTexto,
  validarRespuesta,
} from './encuesta.ts';
import type { PreguntaDeLaEncuesta } from './opiniones.ts';

const ID = '0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b';

const CONFORME: PreguntaDeLaEncuesta = {
  id: 'q-conforme',
  texto: '¿Qué tan conforme quedaste con el mueble?',
  tipo: 'escala5',
  escala: 'conformidad',
  obligatoria: true,
  opciones: null,
  propia: false,
};
const RECOMIENDA: PreguntaDeLaEncuesta = {
  id: 'q-recomienda',
  texto: '¿Se lo recomendarías a alguien?',
  tipo: 'sitalvezno',
  escala: null,
  obligatoria: true,
  opciones: null,
  propia: false,
};
const CONOCISTE: PreguntaDeLaEncuesta = {
  id: 'q-conociste',
  texto: '¿Cómo nos conociste?',
  tipo: 'una',
  escala: null,
  obligatoria: false,
  opciones: ['Me lo recomendaron', 'Por Instagram', 'Vi el cartel'],
  propia: false,
};
const QUE_USA: PreguntaDeLaEncuesta = {
  ...CONOCISTE,
  id: 'q-que-usa',
  texto: '¿Qué muebles usás más?',
  tipo: 'varias',
};
const MEJOR: PreguntaDeLaEncuesta = {
  id: 'q-mejor',
  texto: '¿Qué podríamos hacer mejor?',
  tipo: 'texto',
  escala: null,
  obligatoria: false,
  opciones: null,
  propia: false,
};

const PREGUNTAS = [CONFORME, RECOMIENDA, CONOCISTE, QUE_USA, MEJOR];

const obligatorias = [
  { pregunta: 'q-conforme', valor: 5 },
  { pregunta: 'q-recomienda', valor: 3 },
];

function con(...renglones: { pregunta: unknown; valor: unknown }[]): unknown {
  return { id: ID, renglones: [...obligatorias, ...renglones] };
}

function valor(pregunta: string, dato: unknown): unknown {
  return {
    id: ID,
    renglones: [...obligatorias.filter((r) => r.pregunta !== pregunta), { pregunta, valor: dato }],
  };
}

describe('los motivos de rechazo', () => {
  it('son los mismos ocho que usa la base, en el mismo orden', () => {
    expect(MOTIVOS_DEL_RECHAZO).toEqual([
      'forma',
      'ajena',
      'repetida',
      'tipo',
      'rango',
      'vacio',
      'largo',
      'obligatoria',
    ]);
  });
});

describe('qué se acepta como respuesta', () => {
  it('una respuesta completa pasa', () => {
    expect(validarRespuesta(PREGUNTAS, con())).toBeNull();
    expect(
      validarRespuesta(
        PREGUNTAS,
        con(
          { pregunta: 'q-conociste', valor: 2 },
          { pregunta: 'q-que-usa', valor: [0, 2] },
          { pregunta: 'q-mejor', valor: '  Quedó impecable.\n' },
        ),
      ),
    ).toBeNull();
  });

  it('lo que no tiene la forma de una respuesta', () => {
    expect(validarRespuesta(PREGUNTAS, null)).toBe('forma');
    expect(validarRespuesta(PREGUNTAS, [])).toBe('forma');
    expect(validarRespuesta(PREGUNTAS, 'respuesta')).toBe('forma');
    expect(validarRespuesta(PREGUNTAS, {})).toBe('forma');
    expect(validarRespuesta(PREGUNTAS, { id: ID, renglones: [], cliente: 'Marcela' })).toBe(
      'forma',
    );
    expect(validarRespuesta(PREGUNTAS, { id: 7, renglones: [] })).toBe('forma');
    expect(validarRespuesta(PREGUNTAS, { id: 'no-es-un-id', renglones: [] })).toBe('forma');
    expect(validarRespuesta(PREGUNTAS, { id: ID, renglones: {} })).toBe('forma');
    expect(validarRespuesta(PREGUNTAS, { id: ID, renglones: ['q-conforme'] })).toBe('forma');
    expect(validarRespuesta(PREGUNTAS, { id: ID, renglones: [{ pregunta: 'q-conforme' }] })).toBe(
      'forma',
    );
    expect(
      validarRespuesta(PREGUNTAS, {
        id: ID,
        renglones: [{ pregunta: 'q-conforme', valor: 5, extra: 1 }],
      }),
    ).toBe('forma');
    expect(validarRespuesta(PREGUNTAS, { id: ID, renglones: [{ pregunta: 3, valor: 5 }] })).toBe(
      'forma',
    );
  });

  it('el id se acepta en mayúsculas, como en la base', () => {
    expect(
      validarRespuesta(PREGUNTAS, { id: ID.toUpperCase(), renglones: obligatorias }),
    ).toBeNull();
  });

  it('una pregunta que no es de la encuesta, o que viene dos veces', () => {
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'otra', valor: 1 }))).toBe('ajena');
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-conforme', valor: 4 }))).toBe('repetida');
  });

  it('la escala: un entero del 1 al 5', () => {
    expect(validarRespuesta(PREGUNTAS, valor('q-conforme', '5'))).toBe('tipo');
    expect(validarRespuesta(PREGUNTAS, valor('q-conforme', 4.5))).toBe('tipo');
    expect(validarRespuesta(PREGUNTAS, valor('q-conforme', null))).toBe('tipo');
    expect(validarRespuesta(PREGUNTAS, valor('q-conforme', true))).toBe('tipo');
    expect(validarRespuesta(PREGUNTAS, valor('q-conforme', 6))).toBe('rango');
    expect(validarRespuesta(PREGUNTAS, valor('q-conforme', 0))).toBe('rango');
    expect(validarRespuesta(PREGUNTAS, valor('q-conforme', 5.0))).toBeNull();
  });

  it('sí, tal vez, no: del 1 al 3', () => {
    expect(validarRespuesta(PREGUNTAS, valor('q-recomienda', 4))).toBe('rango');
    expect(validarRespuesta(PREGUNTAS, valor('q-recomienda', 1))).toBeNull();
  });

  it('una opción: la posición de una que exista', () => {
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-conociste', valor: 3 }))).toBe('rango');
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-conociste', valor: -1 }))).toBe('rango');
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-conociste', valor: 1.5 }))).toBe('tipo');
  });

  it('varias opciones: al menos una, sin repetir, y todas existentes', () => {
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-que-usa', valor: 1 }))).toBe('tipo');
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-que-usa', valor: [1, 'a'] }))).toBe(
      'tipo',
    );
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-que-usa', valor: [1.5] }))).toBe('tipo');
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-que-usa', valor: [] }))).toBe('vacio');
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-que-usa', valor: [3] }))).toBe('rango');
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-que-usa', valor: [-1] }))).toBe('rango');
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-que-usa', valor: [1, 1] }))).toBe(
      'rango',
    );
  });

  it('el texto: algo escrito, hasta 2000 caracteres sin contar los blancos de las puntas', () => {
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-mejor', valor: 5 }))).toBe('tipo');
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-mejor', valor: '' }))).toBe('vacio');
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-mejor', valor: ' \n\t\r\f\v' }))).toBe(
      'vacio',
    );
    expect(validarRespuesta(PREGUNTAS, con({ pregunta: 'q-mejor', valor: 'a'.repeat(2001) }))).toBe(
      'largo',
    );
    expect(
      validarRespuesta(PREGUNTAS, con({ pregunta: 'q-mejor', valor: `  ${'a'.repeat(2000)}\n` })),
    ).toBeNull();
    expect(
      validarRespuesta(PREGUNTAS, con({ pregunta: 'q-mejor', valor: '👍'.repeat(2000) })),
    ).toBeNull();
    expect(
      validarRespuesta(PREGUNTAS, con({ pregunta: 'q-mejor', valor: String.fromCharCode(0xa0) })),
    ).toBeNull();
    expect(LARGO_MAXIMO_DE_LA_RESPUESTA).toBe(2000);
  });

  it('faltando una obligatoria', () => {
    expect(
      validarRespuesta(PREGUNTAS, { id: ID, renglones: [{ pregunta: 'q-conforme', valor: 5 }] }),
    ).toBe('obligatoria');
  });

  it('los blancos que cuentan son los de ASCII, igual que en la base', () => {
    expect(tieneTexto(' \t\n')).toBe(false);
    expect(tieneTexto(String.fromCharCode(0xa0))).toBe(true);
    expect(sinBlancosEnLasPuntas('\n  hola  \t')).toBe('hola');
    expect(largoDelTexto('👍👍')).toBe(2);
  });
});

describe('el formulario', () => {
  it('dice qué obligatorias faltan, en el orden de la encuesta', () => {
    expect(faltantes(PREGUNTAS, {})).toEqual(['q-conforme', 'q-recomienda']);
    expect(faltantes(PREGUNTAS, { 'q-conforme': 5 })).toEqual(['q-recomienda']);
    expect(faltantes([{ ...MEJOR, obligatoria: true }], { 'q-mejor': '   ' })).toEqual(['q-mejor']);
    expect(faltantes([{ ...QUE_USA, obligatoria: true }], { 'q-que-usa': [] })).toEqual([
      'q-que-usa',
    ]);
  });

  it('arma la respuesta con lo contestado, en orden, y el texto sin blancos de más', () => {
    const respuesta = armarRespuesta(ID, PREGUNTAS, {
      'q-mejor': '  Todo bien.\n',
      'q-que-usa': [2, 0],
      'q-conforme': 5,
      'q-recomienda': 3,
      'q-conociste': undefined,
    });
    expect(respuesta).toEqual({
      id: ID,
      renglones: [
        { pregunta: 'q-conforme', valor: 5 },
        { pregunta: 'q-recomienda', valor: 3 },
        { pregunta: 'q-que-usa', valor: [2, 0] },
        { pregunta: 'q-mejor', valor: 'Todo bien.' },
      ],
    });
    expect(validarRespuesta(PREGUNTAS, respuesta)).toBeNull();
  });

  it('un comentario en blanco no se manda', () => {
    expect(armarRespuesta(ID, [MEJOR], { 'q-mejor': ' ' }).renglones).toEqual([]);
  });
});

describe('el enlace de reseña', () => {
  it('acepta los de Google que da el Perfil de Negocio', () => {
    expect(HOSTS_DE_RESENA).toContain('g.page');
    for (const link of [
      'https://g.page/r/CaMaunTaller/review',
      'https://search.google.com/local/writereview?placeid=ChIJ123',
      'https://maps.google.com/?cid=123',
      'https://www.google.com/maps/place/Taller',
      'https://google.com/maps',
      'https://maps.app.goo.gl/abc123',
      'https://g.co/kgs/abc',
    ]) {
      expect(esLinkDeResena(link)).toBe(true);
    }
  });

  it('no acepta otro sitio, ni sin https, ni uno de más de 300 caracteres', () => {
    expect(esLinkDeResena('https://resenas-truchas.com/maun')).toBe(false);
    expect(esLinkDeResena('https://g.page.otro.com/x')).toBe(false);
    expect(esLinkDeResena('http://g.page/r/x')).toBe(false);
    expect(esLinkDeResena(`https://g.page/${'x'.repeat(300)}`)).toBe(false);
    expect(LARGO_MAXIMO_DEL_LINK_DE_RESENA).toBe(300);
  });

  it('lo revisa y dice por qué no sirve', () => {
    expect(revisarLinkDeResena('')).toEqual({ estado: 'vacio' });
    expect(revisarLinkDeResena('  https://g.page/r/x  ')).toEqual({ estado: 'valido' });
    expect(revisarLinkDeResena(`https://g.page/${'x'.repeat(300)}`)).toEqual({
      estado: 'invalido',
      motivo: 'largo',
    });
    expect(revisarLinkDeResena('g.page/r/x')).toEqual({ estado: 'invalido', motivo: 'sin-https' });
    expect(revisarLinkDeResena('https://otro.com/x')).toEqual({
      estado: 'invalido',
      motivo: 'otro-sitio',
    });
  });

  it('le agrega la barra al que viene sin camino', () => {
    expect(normalizarLinkDeResena('https://g.page')).toBe('https://g.page/');
    expect(revisarLinkDeResena('https://g.page')).toEqual({ estado: 'valido' });
  });
});
