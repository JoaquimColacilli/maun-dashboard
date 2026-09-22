import { describe, expect, it } from 'vitest';

import {
  comoGuardar,
  comoLaVeElCliente,
  cuantasPreguntas,
  duracion,
  elMueble,
  encuestaBase,
  enPalabras,
  envioDe,
  ESCALAS,
  estadoDelPedido,
  fueMandado,
  limpiarBorrador,
  lineasDeLaRespuesta,
  menosDe,
  mesesDeHistoria,
  mismaForma,
  modoDeMostrar,
  nombresQueOpinaron,
  pasoDe,
  pasosDe,
  pedidosPorTrabajo,
  porcentaje,
  primeraPalabra,
  promedio,
  propiasDelTrabajo,
  queTieneLaEncuesta,
  resumenDeOpiniones,
  revisarBorrador,
  sePuedeBorrar,
  TOPE_PREGUNTAS,
  UMBRAL_BARRAS,
  UMBRAL_EVOLUCION,
  UMBRAL_MESES,
  usoDeLasPreguntas,
  versionesDe,
  vigentesPorSerie,
  type DatosDeLasOpiniones,
  type EncuestaGuardada,
  type EnvioDelTrabajo,
  type PreguntaDeLaEncuesta,
  type PreguntaEditable,
  type PreguntaGuardada,
  type RenglonGuardado,
  type RespuestaGuardada,
  type TipoDePregunta,
  type TrabajoOpinado,
  type ValorGuardado,
} from './opiniones.ts';

function pregunta(id: string, cambios: Partial<PreguntaGuardada> = {}): PreguntaGuardada {
  return {
    id,
    serie: id,
    numero: 1,
    proyectoId: null,
    titular: false,
    orden: 10,
    texto: `Pregunta ${id}`,
    tipo: 'escala5',
    escala: 'conformidad',
    obligatoria: false,
    opciones: null,
    archivadaEl: null,
    creadaEl: '2024-01-01',
    ...cambios,
  };
}

const CONFORME = pregunta('q-conforme', {
  titular: true,
  orden: 10,
  texto: '¿Qué tan conforme quedaste con el mueble?',
  obligatoria: true,
});
const TIEMPOS = pregunta('q-tiempos', {
  orden: 20,
  texto: '¿Y con los tiempos de entrega?',
  escala: 'tiempos',
  obligatoria: true,
});
const RECOMIENDA = pregunta('q-recomienda', {
  orden: 40,
  texto: '¿Se lo recomendarías a alguien?',
  tipo: 'sitalvezno',
  escala: null,
  obligatoria: true,
});
const MEJOR = pregunta('q-mejor', {
  orden: 50,
  texto: '¿Qué podríamos hacer mejor?',
  tipo: 'texto',
  escala: null,
});

const BASE = [CONFORME, TIEMPOS, RECOMIENDA, MEJOR];

function comoSeManda(preguntas: readonly PreguntaGuardada[]): PreguntaDeLaEncuesta[] {
  return preguntas.map(comoLaVeElCliente);
}

function encuesta(
  id: string,
  proyectoId: string,
  dia: string,
  cambios: Partial<EncuestaGuardada> = {},
): EncuestaGuardada {
  return {
    id,
    proyectoId,
    enviadaEl: dia,
    enviadaA: `${dia}T12:00:00+00:00`,
    recordadaEl: null,
    revocadaEl: null,
    preguntas: comoSeManda(BASE),
    ...cambios,
  };
}

function renglon(de: PreguntaGuardada, valor: ValorGuardado): RenglonGuardado {
  return { preguntaId: de.id, preguntaTexto: de.texto, valor };
}

function respuesta(
  id: string,
  encuestaId: string,
  dia: string,
  renglones: readonly RenglonGuardado[],
  leidaEl: string | null = null,
): RespuestaGuardada {
  return {
    id,
    encuestaId,
    contestadaEl: dia,
    contestadaA: `${dia}T15:00:00+00:00`,
    leidaEl,
    renglones,
  };
}

function sumarDias(fecha: string, dias: number): string {
  const instante = new Date(`${fecha}T00:00:00Z`);
  instante.setUTCDate(instante.getUTCDate() + dias);
  return instante.toISOString().slice(0, 10);
}

function muchas(cantidad: number, desde: string, paso: number): DatosDeLasOpiniones {
  const encuestas: EncuestaGuardada[] = [];
  const respuestas: RespuestaGuardada[] = [];
  const trabajos: TrabajoOpinado[] = [];
  for (let i = 0; i < cantidad; i++) {
    const dia = sumarDias(desde, i * paso);
    encuestas.push(encuesta(`e${String(i)}`, `p${String(i)}`, dia));
    trabajos.push({
      proyectoId: `p${String(i)}`,
      cliente: `Cliente ${String(i)}`,
      trabajo: `Trabajo ${String(i)}`,
    });
    respuestas.push(
      respuesta(`r${String(i)}`, `e${String(i)}`, dia, [
        renglon(CONFORME, (i % 5) + 1),
        renglon(TIEMPOS, 4),
        renglon(RECOMIENDA, 3),
      ]),
    );
  }
  return { preguntas: BASE, encuestas, respuestas, trabajos };
}

describe('los umbrales, escritos una sola vez', () => {
  it('son los del diseño: doce para las barras, doce y medio año para la evolución, ocho preguntas', () => {
    expect(UMBRAL_BARRAS).toBe(12);
    expect(UMBRAL_EVOLUCION).toBe(12);
    expect(UMBRAL_MESES).toBe(6);
    expect(TOPE_PREGUNTAS).toBe(8);
  });

  it('con once respuestas se ve un punto por persona; con doce, las barras divergentes', () => {
    expect(modoDeMostrar(CONFORME, 11)).toBe('puntos');
    expect(modoDeMostrar(CONFORME, 12)).toBe('barras');
    expect(modoDeMostrar(RECOMIENDA, 12)).toBe('barras');
  });

  it('una pregunta de opciones no tiene un medio donde partir: siempre de a una persona', () => {
    expect(
      modoDeMostrar(pregunta('q', { tipo: 'una', escala: null, opciones: ['A', 'B'] }), 40),
    ).toBe('puntos');
  });
});

describe('las caritas y sus palabras', () => {
  it('cada escala tiene sus cinco palabras, del peor al mejor, con su polo', () => {
    expect(ESCALAS).toEqual(['conformidad', 'tiempos', 'trato']);
    expect(pasosDe(CONFORME).map((p) => p.etiqueta)).toEqual([
      'Nada conforme',
      'Poco conforme',
      'Ni bien ni mal',
      'Conforme',
      'Muy conforme',
    ]);
    expect(pasosDe(TIEMPOS).map((p) => p.corta)).toEqual([
      'Muy tarde',
      'Se atrasó',
      'Más o menos',
      'A tiempo',
      'Antes',
    ]);
    expect(pasosDe(pregunta('q', { escala: 'trato' })).map((p) => p.etiqueta)).toEqual([
      'Costaba mucho',
      'Costaba un poco',
      'Ni bien ni mal',
      'Fácil',
      'Muy fácil',
    ]);
    expect(pasosDe(CONFORME).map((p) => p.polo)).toEqual(['mal', 'mal', 'neutro', 'bien', 'bien']);
    expect(pasosDe(CONFORME).map((p) => p.cara)).toEqual([
      'enojada',
      'triste',
      'seria',
      'contenta',
      'riendo',
    ]);
  });

  it('una escala sin juego de palabras usa el de conformidad', () => {
    expect(pasosDe(pregunta('q', { escala: null }))).toEqual(pasosDe(CONFORME));
  });

  it('sí, tal vez, no: el sí primero, y el sí es el 3', () => {
    expect(pasosDe(RECOMIENDA).map((p) => [p.valor, p.etiqueta, p.polo, p.cara])).toEqual([
      [3, 'Sí, sin dudarlo', 'bien', 'pulgar-arriba'],
      [2, 'Tal vez', 'neutro', 'seria'],
      [1, 'No', 'mal', 'pulgar-abajo'],
    ]);
  });

  it('las opciones valen su posición y no tienen polo', () => {
    const opciones = pregunta('q', {
      tipo: 'varias',
      escala: null,
      opciones: ['Instagram', 'Cartel'],
    });
    expect(pasosDe(opciones)).toEqual([
      { valor: 0, etiqueta: 'Instagram', corta: 'Instagram', polo: null, cara: null },
      { valor: 1, etiqueta: 'Cartel', corta: 'Cartel', polo: null, cara: null },
    ]);
    expect(pasosDe(pregunta('q', { tipo: 'una', escala: null, opciones: null }))).toEqual([]);
    expect(pasosDe(MEJOR)).toEqual([]);
  });

  it('busca el paso de un valor, y no inventa el que no existe', () => {
    expect(pasoDe(CONFORME, 5)?.etiqueta).toBe('Muy conforme');
    expect(pasoDe(CONFORME, 6)).toBeNull();
  });
});

describe('los números que se muestran', () => {
  it('un porcentaje va siempre con el conteo, sin decimales', () => {
    expect(porcentaje(9, 17)).toBe('53% (9 de 17)');
    expect(porcentaje(1, 8)).toBe('13% (1 de 8)');
    expect(porcentaje(0, 0)).toBe('—');
  });

  it('el promedio lleva una coma y un decimal como mucho, y sin ,0', () => {
    expect(promedio([])).toBeNull();
    expect(promedio([5])).toEqual({ decimas: 50, texto: '5', n: 1 });
    expect(promedio([4, 5])).toEqual({ decimas: 45, texto: '4,5', n: 2 });
    expect(promedio([4, 4, 5])).toEqual({ decimas: 43, texto: '4,3', n: 3 });
    expect(promedio([5, 5, 4])?.texto).toBe('4,7');
  });

  it('redondea la mitad para arriba con enteros, sin errores de coma flotante', () => {
    const veinte = [...Array<number>(11).fill(4), ...Array<number>(9).fill(5)];
    expect(promedio(veinte)?.texto).toBe('4,5');
  });
});

describe('cuánto lleva contestarla', () => {
  it('la encuesta de fábrica: un minuto veinte, en el largo que se contesta sin pensarlo', () => {
    expect(duracion(['escala5', 'escala5', 'escala5', 'sitalvezno', 'texto'])).toEqual({
      segundos: 80,
      texto: '1:20',
      tono: 'ok',
      nota: 'Está en el largo que la gente contesta sin pensarlo.',
    });
  });

  it('avisa cuando se pone larga, y más cuando es demasiado', () => {
    expect(duracion(Array<TipoDePregunta>(12).fill('escala5')).tono).toBe('atencion');
    expect(duracion(Array<TipoDePregunta>(5).fill('texto')).tono).toBe('alerta');
    expect(duracion([]).texto).toBe('0:08');
  });

  it('lo dice en palabras', () => {
    expect(menosDe(80)).toBe('menos de dos minutos');
    expect(menosDe(30)).toBe('menos de un minuto');
    expect(queTieneLaEncuesta(['escala5', 'escala5', 'escala5', 'sitalvezno', 'texto'])).toBe(
      'Son cuatro preguntas y un comentario',
    );
    expect(queTieneLaEncuesta(['escala5'])).toBe('Es una pregunta');
    expect(queTieneLaEncuesta(['texto'])).toBe('Es un comentario');
    expect(queTieneLaEncuesta(['texto', 'texto'])).toBe('Son dos comentarios');
    expect(queTieneLaEncuesta([])).toBe('No tiene preguntas');
    expect(cuantasPreguntas(['escala5', 'escala5', 'escala5', 'sitalvezno', 'texto'])).toBe(
      'Son cuatro preguntas',
    );
    expect(cuantasPreguntas(['una', 'texto'])).toBe('Es una pregunta');
    expect(cuantasPreguntas(['texto'])).toBe('Es un comentario');
    expect(enPalabras(1, 'masculino')).toBe('un');
    expect(enPalabras(13, 'femenino')).toBe('13');
  });
});

describe('los nombres', () => {
  it('el mueble sale del título del trabajo', () => {
    expect(elMueble('Placard 3 puertas con interior en melamina')).toBe('placard');
    expect(elMueble('  Mesada y alacena de cocina')).toBe('mesada');
    expect(elMueble('Vanitory colgante en guayubira')).toBe('vanitory');
  });

  it('si el título no empieza con una palabra, es un mueble', () => {
    expect(elMueble('2 placares iguales')).toBe('mueble');
    expect(elMueble('TV y consola')).toBe('mueble');
    expect(elMueble('X')).toBe('mueble');
    expect(elMueble('')).toBe('mueble');
  });

  it('la primera palabra, sin blancos', () => {
    expect(primeraPalabra('  Marcela Duarte ')).toBe('Marcela');
    expect(primeraPalabra('')).toBe('');
  });

  it('quiénes opinaron, sin repetir y sin una lista eterna', () => {
    expect(nombresQueOpinaron([])).toBe('');
    expect(nombresQueOpinaron(['', '  '])).toBe('');
    expect(nombresQueOpinaron(['Nadia Roldán'])).toBe('Nadia opinó');
    expect(nombresQueOpinaron(['Nadia Roldán', 'Hernán Cabrera', 'Nadia R.'])).toBe(
      'Nadia y Hernán opinaron',
    );
    expect(nombresQueOpinaron(['Nadia', 'Hernán', 'Marcela'])).toBe(
      'Nadia, Hernán y Marcela opinaron',
    );
    expect(nombresQueOpinaron(['Nadia', 'Hernán', 'Marcela', 'Diego', 'Carla'])).toBe(
      'Nadia, Hernán y 3 más opinaron',
    );
  });
});

describe('el borrador de una pregunta', () => {
  const borrador = (cambios: Partial<PreguntaEditable> = {}): PreguntaEditable => ({
    texto: '¿Cómo nos conociste?',
    tipo: 'una',
    escala: null,
    opciones: ['Me lo recomendaron', 'Por Instagram'],
    obligatoria: false,
    ...cambios,
  });

  it('se limpia antes de guardar: sin blancos, y la escala o las opciones solo donde van', () => {
    expect(limpiarBorrador(borrador({ texto: '  ¿Algo?  ', opciones: [' A ', 'B'] }))).toEqual({
      texto: '¿Algo?',
      tipo: 'una',
      escala: null,
      opciones: ['A', 'B'],
      obligatoria: false,
    });
    expect(limpiarBorrador(borrador({ tipo: 'escala5', escala: null })).escala).toBe('conformidad');
    expect(limpiarBorrador(borrador({ tipo: 'escala5', escala: 'trato' })).opciones).toBeNull();
    expect(limpiarBorrador(borrador({ tipo: 'varias', opciones: null })).opciones).toEqual([]);
    expect(limpiarBorrador(borrador({ tipo: 'texto', escala: 'trato' })).escala).toBeNull();
  });

  it('dice qué le falta, de a una cosa', () => {
    expect(revisarBorrador(borrador({ texto: '   ' }))).toBe('sin-texto');
    expect(revisarBorrador(borrador({ texto: 'a'.repeat(301) }))).toBe('texto-largo');
    expect(revisarBorrador(borrador({ opciones: ['A', ' '] }))).toBe('opcion-vacia');
    expect(revisarBorrador(borrador({ opciones: ['A'] }))).toBe('pocas-opciones');
    expect(
      revisarBorrador(borrador({ opciones: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] })),
    ).toBe('muchas-opciones');
    expect(revisarBorrador(borrador({ opciones: ['A', 'b'.repeat(121)] }))).toBe('opcion-larga');
    expect(revisarBorrador(borrador({ opciones: ['A', ' A'] }))).toBe('opciones-repetidas');
    expect(revisarBorrador(borrador())).toBeNull();
    expect(revisarBorrador(borrador({ tipo: 'texto', opciones: null }))).toBeNull();
  });

  it('compara la forma: tipo, escala y opciones', () => {
    expect(mismaForma(CONFORME, CONFORME)).toBe(true);
    expect(mismaForma(CONFORME, RECOMIENDA)).toBe(false);
    expect(mismaForma(CONFORME, TIEMPOS)).toBe(false);
    expect(mismaForma(borrador(), borrador({ opciones: ['Me lo recomendaron'] }))).toBe(false);
    expect(
      mismaForma(borrador(), borrador({ opciones: ['Me lo recomendaron', 'Por Facebook'] })),
    ).toBe(false);
    expect(mismaForma(borrador(), borrador({ opciones: null }))).toBe(false);
    expect(mismaForma(borrador({ opciones: null }), borrador({ opciones: null }))).toBe(true);
  });
});

describe('guardar el cambio de una pregunta', () => {
  const recomienda: PreguntaEditable = {
    texto: '¿Se lo recomendarías a alguien?',
    tipo: 'sitalvezno',
    escala: null,
    opciones: null,
    obligatoria: true,
  };
  const otroTexto = { ...recomienda, texto: '¿Le recomendarías el taller a un conocido?' };
  const otroTipo: PreguntaEditable = {
    ...otroTexto,
    tipo: 'una',
    opciones: ['Sí, sin dudarlo', 'Tal vez', 'No'],
  };

  it('con respuestas y otro texto, pregunta si es la misma o una nueva', () => {
    expect(comoGuardar(recomienda, otroTexto, { respuestas: 9, enviada: true })).toEqual({
      modo: 'preguntar',
      respuestas: 9,
    });
  });

  it('sin respuestas, el texto se corrige en el lugar aunque haya enlaces afuera', () => {
    expect(comoGuardar(recomienda, otroTexto, { respuestas: 0, enviada: true })).toEqual({
      modo: 'en-el-lugar',
    });
  });

  it('cambiar cómo se contesta una que ya salió es una versión nueva, sin preguntar', () => {
    expect(comoGuardar(recomienda, otroTipo, { respuestas: 9, enviada: true })).toEqual({
      modo: 'version-nueva',
      respuestas: 9,
    });
    expect(comoGuardar(recomienda, otroTipo, { respuestas: 0, enviada: true })).toEqual({
      modo: 'version-nueva',
      respuestas: 0,
    });
    expect(comoGuardar(recomienda, otroTipo, { respuestas: 2, enviada: false })).toEqual({
      modo: 'version-nueva',
      respuestas: 2,
    });
  });

  it('una que nadie vio se cambia entera en el lugar', () => {
    expect(comoGuardar(recomienda, otroTipo, { respuestas: 0, enviada: false })).toEqual({
      modo: 'en-el-lugar',
    });
    expect(
      comoGuardar(
        recomienda,
        { ...recomienda, obligatoria: false },
        { respuestas: 4, enviada: true },
      ),
    ).toEqual({
      modo: 'en-el-lugar',
    });
  });

  it('se borra solamente la que nadie vio; las demás se archivan', () => {
    const libre = { respuestas: 0, enviada: false, otrasVersiones: false };
    expect(sePuedeBorrar({ titular: false, numero: 1 }, libre)).toBe(true);
    expect(sePuedeBorrar({ titular: true, numero: 1 }, libre)).toBe(false);
    expect(sePuedeBorrar({ titular: false, numero: 2 }, libre)).toBe(false);
    expect(sePuedeBorrar({ titular: false, numero: 1 }, { ...libre, otrasVersiones: true })).toBe(
      false,
    );
    expect(sePuedeBorrar({ titular: false, numero: 1 }, { ...libre, enviada: true })).toBe(false);
    expect(sePuedeBorrar({ titular: false, numero: 1 }, { ...libre, respuestas: 1 })).toBe(false);
  });
});

describe('el pedido de un trabajo', () => {
  const envio = (cambios: Partial<EnvioDelTrabajo>): EnvioDelTrabajo => ({
    id: 'e1',
    enviadaEl: '2026-09-10',
    enviadaA: '2026-09-10T12:00:00+00:00',
    recordadaEl: null,
    revocadaEl: null,
    contestadaEl: null,
    contestadaA: null,
    respuestaId: null,
    ...cambios,
  });

  it('pasa por sus cuatro estados', () => {
    expect(estadoDelPedido([])).toEqual({ estado: 'sin_mandar' });
    expect(estadoDelPedido([envio({ revocadaEl: '2026-09-11' })])).toEqual({
      estado: 'sin_mandar',
    });
    expect(estadoDelPedido([envio({})]).estado).toBe('mandada');
    expect(estadoDelPedido([envio({ recordadaEl: '2026-09-15' })]).estado).toBe('recordada');
    expect(
      estadoDelPedido([
        envio({ id: 'vivo' }),
        envio({ id: 'contestado', revocadaEl: '2026-09-20', respuestaId: 'r1' }),
      ]),
    ).toMatchObject({ estado: 'contestada', envio: { id: 'contestado' } });
  });

  it('sabe si se mandó', () => {
    expect(fueMandado({ estado: 'sin_mandar' })).toBe(false);
    expect(fueMandado(estadoDelPedido([envio({})]))).toBe(true);
  });

  it('arma el envío de una encuesta, con su respuesta si la tiene', () => {
    const mandada = encuesta('e1', 'p1', '2026-09-10');
    expect(envioDe(mandada, undefined).respuestaId).toBeNull();
    const contestada = respuesta('r1', 'e1', '2026-09-12', []);
    expect(envioDe(mandada, contestada)).toMatchObject({
      contestadaEl: '2026-09-12',
      respuestaId: 'r1',
    });
  });

  it('agrupa las encuestas de cada trabajo', () => {
    const pedidos = pedidosPorTrabajo({
      encuestas: [
        encuesta('e1', 'p1', '2026-09-01', { revocadaEl: '2026-09-02' }),
        encuesta('e2', 'p1', '2026-09-03'),
        encuesta('e3', 'p2', '2026-09-04'),
      ],
      respuestas: [respuesta('r3', 'e3', '2026-09-05', [])],
    });
    expect(pedidos.get('p1')).toMatchObject({ estado: 'mandada', envio: { id: 'e2' } });
    expect(pedidos.get('p2')?.estado).toBe('contestada');
  });
});

describe('la encuesta base', () => {
  const v1 = pregunta('v1', { serie: 's', numero: 1, orden: 30, creadaEl: '2025-01-01' });
  const v2 = pregunta('v2', { serie: 's', numero: 2, orden: 30, creadaEl: '2026-03-10' });

  it('se queda con la versión vigente de cada serie, en su orden', () => {
    expect(vigentesPorSerie([v2, v1]).map((p) => p.id)).toEqual(['v2']);
    expect(vigentesPorSerie([v1, v2]).map((p) => p.id)).toEqual(['v2']);
    const empatadas = [pregunta('b', { orden: 10 }), pregunta('a', { orden: 10 })];
    expect(vigentesPorSerie(empatadas).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('separa las que se preguntan de las archivadas, y deja afuera las propias', () => {
    const archivada = pregunta('vieja', { archivadaEl: '2026-05-02', orden: 60 });
    const propia = pregunta('propia', { proyectoId: 'p1' });
    const base = encuestaBase([...BASE, archivada, propia]);
    expect(base.vigentes.map((p) => p.id)).toEqual([
      'q-conforme',
      'q-tiempos',
      'q-recomienda',
      'q-mejor',
    ]);
    expect(base.archivadas.map((p) => p.id)).toEqual(['vieja']);
    expect(propiasDelTrabajo([...BASE, propia], 'p1').map((p) => p.id)).toEqual(['propia']);
  });

  it('lista las versiones de una serie, de la más nueva a la más vieja', () => {
    expect(versionesDe([v1, v2, CONFORME], 's').map((p) => p.numero)).toEqual([2, 1]);
  });

  it('cuenta cuántos contestaron cada pregunta y si ya salió en alguna encuesta', () => {
    const uso = usoDeLasPreguntas({
      encuestas: [encuesta('e1', 'p1', '2026-09-01'), encuesta('e2', 'p2', '2026-09-02')],
      respuestas: [
        respuesta('r1', 'e1', '2026-09-03', [renglon(CONFORME, 5)]),
        respuesta('r2', 'e2', '2026-09-04', [renglon(CONFORME, 4), renglon(v1, 3)]),
      ],
    });
    expect(uso.get('q-conforme')).toEqual({ respuestas: 2, enviada: true });
    expect(uso.get('q-mejor')).toEqual({ respuestas: 0, enviada: true });
    expect(uso.get('v1')).toEqual({ respuestas: 1, enviada: false });
  });

  it('muestra una respuesta como la leyó el cliente, pregunta por pregunta', () => {
    const varias = pregunta('varias', { tipo: 'varias', escala: null, opciones: ['A', 'B', 'C'] });
    const lineas = lineasDeLaRespuesta(comoSeManda([CONFORME, varias, MEJOR, TIEMPOS]), [
      { preguntaId: 'q-mejor', valor: 'Todo bien' },
      { preguntaId: 'varias', valor: [0, 2] },
      { preguntaId: 'q-conforme', valor: 5 },
    ]);
    expect(
      lineas.map((linea) => [linea.pregunta.id, linea.pasos.map((p) => p.etiqueta), linea.texto]),
    ).toEqual([
      ['q-conforme', ['Muy conforme'], null],
      ['varias', ['A', 'C'], null],
      ['q-mejor', [], 'Todo bien'],
    ]);
  });
});

describe('Resultados, según cuánto hay', () => {
  const hoy = '2026-09-21';

  it('sin ninguna mandada: nada que dibujar', () => {
    const resumen = resumenDeOpiniones(
      { preguntas: BASE, encuestas: [], respuestas: [], trabajos: [] },
      hoy,
    );
    expect(resumen).toMatchObject({
      situacion: 'sin-enviar',
      enviadas: 0,
      contestadas: 0,
      tasa: '—',
      desde: null,
      meses: 0,
      comentarios: [],
      trabajos: [],
      sinLeer: [],
    });
    expect(resumen.titular?.promedio).toBeNull();
    expect(resumen.evolucion).toEqual({ conEvolucion: false, puntos: [] });
  });

  it('mandadas y nadie contestó: cuenta las mandadas, no las dadas de baja', () => {
    const resumen = resumenDeOpiniones(
      {
        preguntas: BASE,
        encuestas: [
          encuesta('e1', 'p1', '2026-08-20'),
          encuesta('e2', 'p2', '2026-09-01', { recordadaEl: '2026-09-10' }),
          encuesta('e3', 'p3', '2026-07-01', { revocadaEl: '2026-07-02' }),
        ],
        respuestas: [],
        trabajos: [{ proyectoId: 'p1', cliente: 'Graciela Ruiz', trabajo: 'Mueble de recibidor' }],
      },
      hoy,
    );
    expect(resumen).toMatchObject({
      situacion: 'sin-respuestas',
      enviadas: 2,
      contestadas: 0,
      desde: '2026-08-20',
    });
    expect(resumen.trabajos.map((fila) => [fila.trabajo.cliente, fila.pedido.estado])).toEqual([
      ['', 'recordada'],
      ['Graciela Ruiz', 'mandada'],
    ]);
  });

  it('nueve respuestas: un punto por persona, sin barras ni tendencia', () => {
    const resumen = resumenDeOpiniones(muchas(9, '2026-04-01', 20), hoy);
    expect(resumen.situacion).toBe('con-respuestas');
    expect(resumen.tasa).toBe('100% (9 de 9)');
    expect(resumen.preguntas.map((r) => [r.pregunta.id, r.n, r.modo])).toEqual([
      ['q-conforme', 9, 'puntos'],
      ['q-tiempos', 9, 'puntos'],
      ['q-recomienda', 9, 'puntos'],
    ]);
    expect(resumen.preguntas[0]?.conteos.map((c) => c.n)).toEqual([2, 2, 2, 2, 1]);
    expect(resumen.titular?.promedio).toEqual({ decimas: 28, texto: '2,8', n: 9 });
    expect(resumen.evolucion.conEvolucion).toBe(false);
    expect(resumen.evolucion.puntos).toHaveLength(9);
  });

  it('doce respuestas en tres meses: barras, pero la evolución todavía es una tira en orden', () => {
    const resumen = resumenDeOpiniones(muchas(12, '2026-06-15', 7), hoy);
    expect(resumen.preguntas[0]?.modo).toBe('barras');
    expect(resumen.meses).toBe(3);
    expect(resumen.evolucion.conEvolucion).toBe(false);
  });

  it('treinta y cuatro respuestas y dos años: barras y evolución', () => {
    const resumen = resumenDeOpiniones(muchas(34, '2024-08-01', 22), hoy);
    expect(resumen.preguntas[0]?.modo).toBe('barras');
    expect(resumen.meses).toBeGreaterThanOrEqual(UMBRAL_MESES);
    expect(resumen.evolucion.conEvolucion).toBe(true);
    expect(resumen.evolucion.puntos[0]?.dia).toBe('2024-08-01');
  });
});

describe('Resultados, con todo lo que puede pasar', () => {
  const hoy = '2026-09-21';
  const tratoViejo = pregunta('trato-1', {
    serie: 'trato',
    numero: 1,
    orden: 30,
    escala: 'trato',
    texto: '¿Cómo fue la comunicación durante el trabajo?',
    creadaEl: '2025-01-01',
  });
  const tratoMedio = pregunta('trato-2', {
    serie: 'trato',
    numero: 2,
    orden: 30,
    escala: 'trato',
    texto: '¿Cómo fue hablar con el taller?',
    creadaEl: '2025-06-01',
  });
  const tratoNuevo = pregunta('trato-3', {
    serie: 'trato',
    numero: 3,
    orden: 30,
    escala: 'trato',
    texto: '¿Cómo fue hablar con el taller mientras duró el trabajo?',
    creadaEl: '2026-03-10',
  });
  const conociste = pregunta('conociste', {
    orden: 60,
    tipo: 'una',
    escala: null,
    opciones: ['Me lo recomendaron', 'Por Instagram', 'Vi el cartel'],
    archivadaEl: '2026-05-02',
  });
  const altura = pregunta('altura', { proyectoId: 'p1', texto: '¿La altura te quedó cómoda?' });
  const detalle = pregunta('detalle', { proyectoId: 'p1', tipo: 'texto', escala: null });
  const preguntas = [...BASE, tratoViejo, tratoMedio, tratoNuevo, conociste, altura, detalle];

  const datos: DatosDeLasOpiniones = {
    preguntas,
    encuestas: [
      encuesta('e1', 'p1', '2026-09-01'),
      encuesta('e2', 'p2', '2026-09-05'),
      encuesta('e3', 'p3', '2026-09-10', { recordadaEl: '2026-09-15' }),
      encuesta('e4', 'p4', '2026-02-01'),
    ],
    respuestas: [
      respuesta(
        'r1',
        'e1',
        '2026-09-02',
        [
          renglon(CONFORME, 5),
          renglon(tratoNuevo, 4),
          renglon(RECOMIENDA, 3),
          renglon(MEJOR, 'Quedó impecable.'),
          renglon(altura, 4),
          renglon(detalle, 'La altura, justa.'),
          renglon(conociste, 1),
        ],
        null,
      ),
      respuesta(
        'r2',
        'e2',
        '2026-09-12',
        [renglon(CONFORME, 3), renglon(RECOMIENDA, 2), renglon(MEJOR, 'Se atrasó.')],
        '2026-09-13',
      ),
      respuesta(
        'r4',
        'e4',
        '2026-02-10',
        [renglon(tratoViejo, 2), renglon(CONFORME, 4)],
        '2026-02-11',
      ),
      respuesta('huerfana', 'no-existe', '2026-09-20', [
        { preguntaId: 'borrada', preguntaTexto: 'Una que ya no está', valor: 'algo' },
        renglon(MEJOR, 'De un trabajo que ya no está.'),
      ]),
    ],
    trabajos: [
      { proyectoId: 'p1', cliente: 'Marcela Duarte', trabajo: 'Placard 3 puertas' },
      { proyectoId: 'p2', cliente: 'Hernán Cabrera', trabajo: 'Vanitory colgante' },
      { proyectoId: 'p3', cliente: 'Omar Peralta', trabajo: 'Placard de dos puertas' },
    ],
  };
  const resumen = resumenDeOpiniones(datos, hoy);

  it('los comentarios van enteros, del más nuevo al más viejo, y solo los de la encuesta base', () => {
    expect(
      resumen.comentarios.map((c) => [c.trabajo.cliente, c.texto, c.titular?.etiqueta]),
    ).toEqual([
      ['', 'De un trabajo que ya no está.', undefined],
      ['Hernán Cabrera', 'Se atrasó.', 'Ni bien ni mal'],
      ['Marcela Duarte', 'Quedó impecable.', 'Muy conforme'],
    ]);
  });

  it('una pregunta que cambió de sentido muestra aparte lo que contestaron antes', () => {
    const trato = resumen.preguntas.find((r) => r.pregunta.serie === 'trato');
    expect(trato?.n).toBe(1);
    expect(trato?.anteriores.map((a) => [a.pregunta.id, a.n, a.hasta])).toEqual([
      ['trato-1', 1, '2025-06-01'],
    ]);
    expect(trato?.anteriores[0]?.conteos.map((c) => c.n)).toEqual([0, 1, 0, 0, 0]);
  });

  it('archivar no borra: lo que contestaron sigue en Resultados, aparte', () => {
    expect(resumen.archivadas.map((r) => [r.pregunta.id, r.n])).toEqual([['conociste', 1]]);
    expect(resumen.archivadas[0]?.conteos.map((c) => c.n)).toEqual([0, 1, 0]);
    expect(resumen.archivadas[0]?.promedio).toBeNull();
  });

  it('las propias no entran en el promedio general', () => {
    expect(resumen.titular?.promedio).toEqual({ decimas: 40, texto: '4', n: 3 });
    expect(resumen.preguntas.map((r) => r.pregunta.id)).not.toContain('altura');
  });

  it('trabajo por trabajo: primero los que contestaron, después los que esperan', () => {
    expect(
      resumen.trabajos.map((fila) => [
        fila.trabajo.proyectoId,
        fila.pedido.estado,
        fila.propias,
        fila.titular?.valor,
      ]),
    ).toEqual([
      ['p2', 'contestada', 0, 3],
      ['p1', 'contestada', 2, 5],
      ['p4', 'contestada', 0, 4],
      ['p3', 'recordada', 0, undefined],
    ]);
  });

  it('lo que falta leer, del más nuevo al más viejo', () => {
    expect(resumen.sinLeer.map((r) => r.id)).toEqual(['huerfana', 'r1']);
    expect(resumen.tasa).toBe('75% (3 de 4)');
  });

  it('sin la pregunta del número de arriba, no hay titular ni evolución', () => {
    const sinTitular = resumenDeOpiniones({ ...datos, preguntas: [TIEMPOS, MEJOR] }, hoy);
    expect(sinTitular.titular).toBeNull();
    expect(sinTitular.evolucion.puntos).toEqual([]);
    expect(sinTitular.comentarios.map((c) => c.titular)).toEqual([null, null, null]);
  });

  it('si la del número de arriba pasó a ser de texto, no inventa un promedio', () => {
    const titularDeTexto = pregunta('q-conforme-texto', {
      serie: 'q-conforme',
      numero: 2,
      titular: true,
      tipo: 'texto',
      escala: null,
    });
    const conTexto = resumenDeOpiniones(
      {
        ...datos,
        preguntas: [...preguntas, titularDeTexto],
        respuestas: [
          respuesta('r9', 'e3', '2026-09-20', [
            renglon(titularDeTexto, 'Muy bien'),
            renglon(CONFORME, 2),
          ]),
        ],
      },
      hoy,
    );
    expect(conTexto.titular?.promedio).toBeNull();
    expect(conTexto.evolucion.puntos).toEqual([]);
    expect(conTexto.trabajos[0]?.titular?.valor).toBe(2);
  });

  it('un valor que la escala no tiene no se dibuja', () => {
    const conRaro = resumenDeOpiniones(
      { ...datos, respuestas: [respuesta('r9', 'e3', '2026-09-20', [renglon(CONFORME, 9)])] },
      hoy,
    );
    expect(conRaro.evolucion.puntos).toEqual([]);
    expect(conRaro.titular?.promedio?.n).toBe(1);
  });

  it('la historia se cuenta en meses desde la primera mandada', () => {
    expect(mesesDeHistoria(null, hoy)).toBe(0);
    expect(mesesDeHistoria('2026-03-21', hoy)).toBe(6);
    expect(resumen.desde).toBe('2026-02-01');
  });
});
