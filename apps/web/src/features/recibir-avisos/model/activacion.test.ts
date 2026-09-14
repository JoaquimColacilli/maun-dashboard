import { PREFERENCIAS_INICIALES } from '@maun/domain';
import { describe, expect, it, vi } from 'vitest';

import type { EstadoDeLosAvisos } from '@/shared/api';

import {
  apagarEnEsteDispositivo,
  SIN_PERMISO_DEL_NAVEGADOR,
  SIN_RESPUESTA,
  SIN_SENAL_PARA_ACTIVAR,
  SIN_SENAL_PARA_APAGAR,
  SIN_SUSCRIPCION,
  terminarDeActivar,
  type PasosDeLaActivacion,
  type PasosDelApagado,
} from './activacion';

const ENDPOINT = 'https://push.example/1';

const SUSCRIPCION = {
  endpoint: ENDPOINT,
  toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'publica', auth: 'secreto' } }),
};

const ESTADO: EstadoDeLosAvisos = {
  suscripto: true,
  ultimoEnvio: null,
  dispositivos: 1,
  preferencias: {
    zona: 'America/Argentina/Buenos_Aires',
    hora: '07:30',
    avisos: PREFERENCIAS_INICIALES,
  },
};

function rechazo(codigo: string, mensaje: string): Error {
  return Object.assign(new Error(mensaje), { code: codigo });
}

const SIN_SENAL = rechazo('', 'TypeError: Failed to fetch');

function pasosDeActivacion(cambios: Partial<PasosDeLaActivacion> = {}) {
  return {
    suscribir: vi.fn<PasosDeLaActivacion['suscribir']>(() => Promise.resolve(SUSCRIPCION)),
    registrar: vi.fn<PasosDeLaActivacion['registrar']>(() => Promise.resolve(ESTADO)),
    ...cambios,
  };
}

describe('terminarDeActivar', () => {
  it('con el permiso concedido suscribe el navegador y registra este dispositivo con la zona', async () => {
    const pasos = pasosDeActivacion();
    const desenlace = await terminarDeActivar(
      Promise.resolve('granted'),
      'BClave',
      'Europe/Madrid',
      pasos,
    );
    expect(desenlace).toEqual({ tipo: 'activos', estado: ESTADO, endpoint: ENDPOINT });
    expect(pasos.suscribir).toHaveBeenCalledWith('BClave');
    expect(pasos.registrar).toHaveBeenCalledWith(
      { endpoint: ENDPOINT, p256dh: 'publica', auth: 'secreto' },
      'Europe/Madrid',
    );
  });

  it('si lo niega no suscribe ni registra nada', async () => {
    const pasos = pasosDeActivacion();
    expect(await terminarDeActivar(Promise.resolve('denied'), 'BClave', 'UTC', pasos)).toEqual({
      tipo: 'denegado',
    });
    expect(pasos.suscribir).not.toHaveBeenCalled();
    expect(pasos.registrar).not.toHaveBeenCalled();
  });

  it('si cierra el aviso del sistema sin elegir, lo dice y no suscribe', async () => {
    const pasos = pasosDeActivacion();
    expect(await terminarDeActivar(Promise.resolve('default'), 'BClave', 'UTC', pasos)).toEqual({
      tipo: 'no-se-pudo',
      mensaje: SIN_RESPUESTA,
    });
    expect(pasos.suscribir).not.toHaveBeenCalled();
  });

  it('si el navegador no deja pedir el permiso, lo dice', async () => {
    expect(
      await terminarDeActivar(
        Promise.reject(new Error('no')),
        'BClave',
        'UTC',
        pasosDeActivacion(),
      ),
    ).toEqual({ tipo: 'no-se-pudo', mensaje: SIN_PERMISO_DEL_NAVEGADOR });
  });

  it('si el navegador no se puede suscribir, no registra nada', async () => {
    const pasos = pasosDeActivacion({ suscribir: () => Promise.reject(new Error('AbortError')) });
    expect(await terminarDeActivar(Promise.resolve('granted'), 'BClave', 'UTC', pasos)).toEqual({
      tipo: 'no-se-pudo',
      mensaje: SIN_SUSCRIPCION,
    });
    expect(pasos.registrar).not.toHaveBeenCalled();
  });

  it('sin señal al registrar, lo dice', async () => {
    const pasos = pasosDeActivacion({ registrar: () => Promise.reject(SIN_SENAL) });
    expect(await terminarDeActivar(Promise.resolve('granted'), 'BClave', 'UTC', pasos)).toEqual({
      tipo: 'no-se-pudo',
      mensaje: SIN_SENAL_PARA_ACTIVAR,
    });
  });

  it('un rechazo de la base se traduce', async () => {
    const pasos = pasosDeActivacion({
      registrar: () => Promise.reject(rechazo('22023', 'La zona horaria no existe')),
    });
    const desenlace = await terminarDeActivar(Promise.resolve('granted'), 'BClave', 'Nada', pasos);
    expect(desenlace.tipo).toBe('no-se-pudo');
    expect(desenlace).not.toEqual({ tipo: 'no-se-pudo', mensaje: SIN_SENAL_PARA_ACTIVAR });
  });
});

describe('apagarEnEsteDispositivo', () => {
  function pasosDeApagado(cambios: Partial<PasosDelApagado> = {}) {
    const unsubscribe = vi.fn(() => Promise.resolve(true));
    return {
      unsubscribe,
      pasos: {
        darDeBaja: vi.fn<PasosDelApagado['darDeBaja']>(() => Promise.resolve(true)),
        suscripcionLocal: () => Promise.resolve({ unsubscribe }),
        ...cambios,
      },
    };
  }

  it('primero lo da de baja en la base y después desuscribe el navegador', async () => {
    const { pasos, unsubscribe } = pasosDeApagado();
    expect(await apagarEnEsteDispositivo(ENDPOINT, pasos)).toEqual({ tipo: 'apagados' });
    expect(pasos.darDeBaja).toHaveBeenCalledWith(ENDPOINT);
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('sin señal no toca el navegador y avisa que sigue recibiendo', async () => {
    const { pasos, unsubscribe } = pasosDeApagado({
      darDeBaja: () => Promise.reject(SIN_SENAL),
    });
    expect(await apagarEnEsteDispositivo(ENDPOINT, pasos)).toEqual({
      tipo: 'no-se-pudo',
      mensaje: SIN_SENAL_PARA_APAGAR,
    });
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('si el navegador ya no tenía la suscripción, igual queda apagado', async () => {
    const { pasos } = pasosDeApagado({
      suscripcionLocal: () => Promise.reject(new Error('sin service worker')),
    });
    expect(await apagarEnEsteDispositivo(ENDPOINT, pasos)).toEqual({ tipo: 'apagados' });
  });
});
