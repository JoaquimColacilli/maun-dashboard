import { describe, expect, it } from 'vitest';

import { leerResultadoDeResponder, motivoDelRechazoDeLaEntrega } from './entregaPublica.ts';
import { RespuestaInvalidaError } from './replica.ts';
import { leerPropuestasDeEntrega } from './sincronizacion.ts';

describe('lo que contesta la puerta de la entrega', () => {
  it('se guardó, ya estaba confirmada o el taller cambió el pedido', () => {
    expect(leerResultadoDeResponder({ estado: 'guardada' })).toBe('guardada');
    expect(leerResultadoDeResponder({ estado: 'ya_confirmada' })).toBe('ya_confirmada');
    expect(leerResultadoDeResponder({ estado: 'cambio' })).toBe('cambio');
  });

  it('cualquier otra cosa es una respuesta que la página no entiende', () => {
    for (const rara of [null, [], 'guardada', {}, { estado: 'ya_contestada' }]) {
      expect(() => leerResultadoDeResponder(rara)).toThrow(RespuestaInvalidaError);
    }
  });
});

describe('el motivo del rechazo', () => {
  it('sale del detalle de un MN020', () => {
    expect(motivoDelRechazoDeLaEntrega({ code: 'MN020', details: 'domingo' })).toBe('domingo');
    expect(motivoDelRechazoDeLaEntrega({ code: 'MN020', details: 'tope' })).toBe('tope');
  });

  it('no inventa uno si el código es otro o el detalle no es un motivo', () => {
    expect(motivoDelRechazoDeLaEntrega({ code: 'MN010', details: 'forma' })).toBeNull();
    expect(motivoDelRechazoDeLaEntrega({ code: 'MN020', details: 'otro' })).toBeNull();
    expect(motivoDelRechazoDeLaEntrega(new Error('red'))).toBeNull();
    expect(motivoDelRechazoDeLaEntrega(null)).toBeNull();
    expect(motivoDelRechazoDeLaEntrega('MN020')).toBeNull();
  });
});

describe('lo que contesta proponer_la_entrega', () => {
  it('son las filas que tocó', () => {
    const filas = [{ id: 'cerrada' }, { id: 'nueva' }];
    expect(leerPropuestasDeEntrega({ propuestas: filas })).toEqual(filas);
    expect(leerPropuestasDeEntrega({ propuestas: [] })).toEqual([]);
  });

  it('rechaza lo que no trae las propuestas con su id', () => {
    for (const rara of [
      null,
      'x',
      {},
      { propuestas: {} },
      { propuestas: [{}] },
      { propuestas: [null] },
    ]) {
      expect(() => leerPropuestasDeEntrega(rara)).toThrow(RespuestaInvalidaError);
    }
  });
});
