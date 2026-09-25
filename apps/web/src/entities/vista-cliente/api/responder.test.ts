import { describe, expect, it } from 'vitest';

import { MOTIVO_DE_LA_ENTREGA, NO_SE_PUDO_MANDAR, SIN_SENAL_AL_MANDAR } from '../model/textos';
import { resultadoDelError, resultadoDeResponder } from './responder';

describe('lo que la página hace con lo que contesta la puerta', () => {
  it('traduce el estado de la base', () => {
    expect(resultadoDeResponder('guardada')).toEqual({ tipo: 'guardada' });
    expect(resultadoDeResponder('ya_confirmada')).toEqual({ tipo: 'ya-confirmada' });
    expect(resultadoDeResponder('cambio')).toEqual({ tipo: 'cambio' });
  });

  it('sin señal, lo dice y guarda lo marcado', () => {
    expect(resultadoDelError(new TypeError('Failed to fetch'))).toEqual({
      tipo: 'error',
      texto: SIN_SENAL_AL_MANDAR,
    });
  });

  it('un rechazo con motivo se explica con ese motivo', () => {
    expect(
      resultadoDelError({ code: 'MN020', message: 'x', details: 'domingo', hint: '' }),
    ).toEqual({ tipo: 'error', texto: MOTIVO_DE_LA_ENTREGA.domingo });
  });

  it('cualquier otra cosa pide probar de nuevo', () => {
    expect(resultadoDelError({ code: 'XX000', message: 'x', details: '', hint: '' })).toEqual({
      tipo: 'error',
      texto: NO_SE_PUDO_MANDAR,
    });
  });
});
