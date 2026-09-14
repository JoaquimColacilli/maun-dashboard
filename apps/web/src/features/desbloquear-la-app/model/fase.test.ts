import { describe, expect, it } from 'vitest';

import { FASE_INICIAL, siguienteFase, type EventoDelBloqueo, type FaseDelBloqueo } from './fase';

function recorrer(eventos: readonly EventoDelBloqueo[]): FaseDelBloqueo {
  return eventos.reduce(siguienteFase, FASE_INICIAL);
}

describe('la pantalla de bloqueo', () => {
  it('al abrir pide la huella una vez, y si confirma queda desbloqueada', () => {
    expect(
      recorrer([
        { tipo: 'pedir', origen: 'al-abrir', intento: 1 },
        { tipo: 'resultado', intento: 1, resultado: 'confirmada' },
      ]),
    ).toEqual({ tipo: 'desbloqueada' });
  });

  it('un segundo montaje del mismo arranque reemplaza al primero, y el resultado viejo no cuenta', () => {
    expect(
      recorrer([
        { tipo: 'pedir', origen: 'al-abrir', intento: 1 },
        { tipo: 'pedir', origen: 'al-abrir', intento: 2 },
        { tipo: 'resultado', intento: 1, resultado: 'interrumpida' },
      ]),
    ).toEqual({ tipo: 'pidiendo', intento: 2, origen: 'al-abrir', motivo: null });
  });

  it('una falla cae al formulario y ahí se queda: nada vuelve a pedir la huella solo', () => {
    const fallo = recorrer([
      { tipo: 'pedir', origen: 'al-abrir', intento: 1 },
      { tipo: 'resultado', intento: 1, resultado: 'cancelada' },
    ]);
    expect(fallo).toEqual({ tipo: 'formulario', motivo: 'no-se-confirmo' });

    expect(siguienteFase(fallo, { tipo: 'pedir', origen: 'al-abrir', intento: 2 })).toBe(fallo);
    expect(siguienteFase(fallo, { tipo: 'resultado', intento: 1, resultado: 'confirmada' })).toBe(
      fallo,
    );
  });

  it('desde el formulario solo el usuario vuelve a pedir, y el pedido se muestra en el mismo formulario', () => {
    expect(
      recorrer([
        { tipo: 'pedir', origen: 'al-abrir', intento: 1 },
        { tipo: 'resultado', intento: 1, resultado: 'cancelada' },
        { tipo: 'pedir', origen: 'usuario', intento: 2 },
      ]),
    ).toEqual({ tipo: 'pidiendo', intento: 2, origen: 'usuario', motivo: 'no-se-confirmo' });
  });

  it('si el usuario vuelve a tocar mientras se pide, el resultado del pedido anterior no pisa al nuevo', () => {
    expect(
      recorrer([
        { tipo: 'pedir', origen: 'al-abrir', intento: 1 },
        { tipo: 'pedir', origen: 'usuario', intento: 2 },
        { tipo: 'resultado', intento: 1, resultado: 'interrumpida' },
      ]),
    ).toEqual({ tipo: 'pidiendo', intento: 2, origen: 'usuario', motivo: null });
  });

  it('lo que canceló la propia app nunca dice que la huella falló', () => {
    expect(
      recorrer([
        { tipo: 'pedir', origen: 'al-abrir', intento: 1 },
        { tipo: 'resultado', intento: 1, resultado: 'interrumpida' },
      ]),
    ).toEqual({ tipo: 'formulario', motivo: 'interrumpida' });
  });

  it('sin respuesta y sin huella en el teléfono tienen su propio motivo', () => {
    for (const [resultado, motivo] of [
      ['sin-respuesta', 'sin-respuesta'],
      ['no-disponible', 'no-disponible'],
    ] as const) {
      expect(
        recorrer([
          { tipo: 'pedir', origen: 'al-abrir', intento: 1 },
          { tipo: 'resultado', intento: 1, resultado },
        ]),
      ).toEqual({ tipo: 'formulario', motivo });
    }
  });

  it('elegir la contraseña corta el pedido, y un resultado que llega después no la tapa', () => {
    const contrasena = recorrer([
      { tipo: 'pedir', origen: 'al-abrir', intento: 1 },
      { tipo: 'usar-la-contrasena' },
    ]);
    expect(contrasena).toEqual({ tipo: 'formulario', motivo: 'eligio-la-contrasena' });
    expect(
      siguienteFase(contrasena, { tipo: 'resultado', intento: 1, resultado: 'cancelada' }),
    ).toBe(contrasena);
  });

  it('desbloqueada es el final', () => {
    const desbloqueada = recorrer([
      { tipo: 'pedir', origen: 'al-abrir', intento: 1 },
      { tipo: 'resultado', intento: 1, resultado: 'confirmada' },
    ]);
    expect(siguienteFase(desbloqueada, { tipo: 'pedir', origen: 'usuario', intento: 2 })).toBe(
      desbloqueada,
    );
    expect(siguienteFase(desbloqueada, { tipo: 'usar-la-contrasena' })).toBe(desbloqueada);
  });
});
