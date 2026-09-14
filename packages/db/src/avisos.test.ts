import { PREFERENCIAS_INICIALES } from '@maun/domain';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  consultarServidorDeAvisos,
  darDeBajaSuscripcion,
  guardarPreferenciasDeAvisos,
  leerEstadoDeLosAvisos,
  leerResultadoDeLaPrueba,
  leerServidorDeAvisos,
  probarLosAvisos,
  registrarSuscripcion,
  traerEstadoDeLosAvisos,
} from './avisos.ts';
import type { ClienteMaun } from './cliente.ts';
import { RespuestaInvalidaError } from './replica.ts';

const PREFERENCIAS = {
  zona: 'America/Argentina/Buenos_Aires',
  hora: '07:30',
  avisos: PREFERENCIAS_INICIALES,
};

const ESTADO = {
  suscripto: true,
  ultimo_envio: '2026-09-14T10:40:00.123+00:00',
  dispositivos: 2,
  preferencias: PREFERENCIAS,
};

function clienteFalso(respuestaRpc: unknown, respuestaFuncion: unknown = {}) {
  const rpc = vi.fn(() => Promise.resolve(respuestaRpc));
  const invoke = vi.fn(() => Promise.resolve(respuestaFuncion));
  const cliente = { rpc, functions: { invoke } } as unknown as ClienteMaun;
  return { cliente, rpc, invoke };
}

describe('leerEstadoDeLosAvisos', () => {
  it('lee el estado con las preferencias de la persona', () => {
    expect(leerEstadoDeLosAvisos(ESTADO)).toEqual({
      suscripto: true,
      ultimoEnvio: '2026-09-14T10:40:00.123+00:00',
      dispositivos: 2,
      preferencias: PREFERENCIAS,
    });
  });

  it('sin preferencias todavía, las deja en null', () => {
    expect(
      leerEstadoDeLosAvisos({
        suscripto: false,
        ultimo_envio: null,
        dispositivos: 0,
        preferencias: null,
      }),
    ).toEqual({ suscripto: false, ultimoEnvio: null, dispositivos: 0, preferencias: null });
  });

  it.each([
    ['no es un objeto', []],
    ['suscripto no es booleano', { ...ESTADO, suscripto: 'sí' }],
    ['falta el último envío', { suscripto: true, dispositivos: 1, preferencias: null }],
    ['el último envío es un número', { ...ESTADO, ultimo_envio: 3 }],
    ['los dispositivos son negativos', { ...ESTADO, dispositivos: -1 }],
    ['los dispositivos no son enteros', { ...ESTADO, dispositivos: 1.5 }],
    ['las preferencias no son un objeto', { ...ESTADO, preferencias: 'todas' }],
    ['la zona está vacía', { ...ESTADO, preferencias: { ...PREFERENCIAS, zona: '' } }],
    [
      'la hora no tiene dos dígitos',
      { ...ESTADO, preferencias: { ...PREFERENCIAS, hora: '7:30' } },
    ],
    ['la hora no existe', { ...ESTADO, preferencias: { ...PREFERENCIAS, hora: '24:00' } }],
    ['qué avisa no es un objeto', { ...ESTADO, preferencias: { ...PREFERENCIAS, avisos: null } }],
    [
      'falta un aviso',
      {
        ...ESTADO,
        preferencias: {
          ...PREFERENCIAS,
          avisos: { entregas: PREFERENCIAS_INICIALES.entregas },
        },
      },
    ],
    [
      'la anticipación se pasa de tres días',
      {
        ...ESTADO,
        preferencias: {
          ...PREFERENCIAS,
          avisos: { ...PREFERENCIAS_INICIALES, visitas: { activo: true, anticipacion: 4 } },
        },
      },
    ],
    [
      'activo no es booleano',
      {
        ...ESTADO,
        preferencias: {
          ...PREFERENCIAS,
          avisos: { ...PREFERENCIAS_INICIALES, visitas: { activo: 1, anticipacion: 1 } },
        },
      },
    ],
  ])('rechaza la respuesta si %s', (_, valor) => {
    expect(() => leerEstadoDeLosAvisos(valor)).toThrow(RespuestaInvalidaError);
  });
});

describe('leerServidorDeAvisos', () => {
  it('con claves, trae la pública', () => {
    expect(leerServidorDeAvisos({ configurado: true, clavePublica: 'BCla' })).toEqual({
      configurado: true,
      clavePublica: 'BCla',
    });
  });

  it('sin clave pública no está configurado aunque diga que sí', () => {
    expect(leerServidorDeAvisos({ configurado: true, clavePublica: null })).toEqual({
      configurado: false,
      clavePublica: null,
    });
  });

  it.each([
    null,
    { configurado: 'sí', clavePublica: null },
    { configurado: true, clavePublica: 3 },
  ])('rechaza %j', (valor) => {
    expect(() => leerServidorDeAvisos(valor)).toThrow(RespuestaInvalidaError);
  });
});

describe('leerResultadoDeLaPrueba', () => {
  it('lee los contadores y trata como cero lo que falta', () => {
    expect(
      leerResultadoDeLaPrueba({ configurado: true, mandados: 1, podados: 'dos', fallidos: -1 }),
    ).toEqual({ configurado: true, mandados: 1, podados: 0, fallidos: 0 });
  });

  it('rechaza una respuesta sin configurado', () => {
    expect(() => leerResultadoDeLaPrueba({ mandados: 1 })).toThrow(RespuestaInvalidaError);
    expect(() => leerResultadoDeLaPrueba('ok')).toThrow(RespuestaInvalidaError);
  });
});

describe('las llamadas a la base', () => {
  it('pide el estado sin endpoint cuando el dispositivo no está suscripto', async () => {
    const { cliente, rpc } = clienteFalso({ data: ESTADO, error: null });
    await traerEstadoDeLosAvisos(cliente, null);
    expect(rpc).toHaveBeenCalledWith('estado_de_mis_avisos', {});
  });

  it('pide el estado de este endpoint', async () => {
    const { cliente, rpc } = clienteFalso({ data: ESTADO, error: null });
    const estado = await traerEstadoDeLosAvisos(cliente, 'https://push.example/1');
    expect(rpc).toHaveBeenCalledWith('estado_de_mis_avisos', {
      p_endpoint: 'https://push.example/1',
    });
    expect(estado.suscripto).toBe(true);
  });

  it('registra el dispositivo con sus claves y la zona elegida', async () => {
    const { cliente, rpc } = clienteFalso({ data: ESTADO, error: null });
    await registrarSuscripcion(
      cliente,
      { endpoint: 'https://push.example/1', p256dh: 'clave', auth: 'secreto' },
      'Europe/Madrid',
    );
    expect(rpc).toHaveBeenCalledWith('registrar_suscripcion', {
      p_endpoint: 'https://push.example/1',
      p_p256dh: 'clave',
      p_auth: 'secreto',
      p_zona: 'Europe/Madrid',
    });
  });

  it('da de baja el dispositivo y dice si había algo que borrar', async () => {
    const borrado = clienteFalso({ data: true, error: null });
    expect(await darDeBajaSuscripcion(borrado.cliente, 'https://push.example/1')).toBe(true);
    expect(borrado.rpc).toHaveBeenCalledWith('dar_de_baja_suscripcion', {
      p_endpoint: 'https://push.example/1',
    });
    const nada = clienteFalso({ data: false, error: null });
    expect(await darDeBajaSuscripcion(nada.cliente, 'https://push.example/1')).toBe(false);
  });

  it('guarda la zona, la hora y qué avisa', async () => {
    const { cliente, rpc } = clienteFalso({ data: ESTADO, error: null });
    await guardarPreferenciasDeAvisos(cliente, PREFERENCIAS);
    expect(rpc).toHaveBeenCalledWith('guardar_preferencias_de_avisos', {
      p_zona: 'America/Argentina/Buenos_Aires',
      p_hora: '07:30',
      p_avisos: PREFERENCIAS_INICIALES,
    });
  });

  it('un rechazo de la base se propaga', async () => {
    const rechazo = { code: '22023', message: 'La zona horaria no existe' };
    const { cliente } = clienteFalso({ data: null, error: rechazo });
    await expect(guardarPreferenciasDeAvisos(cliente, PREFERENCIAS)).rejects.toBe(rechazo);
    await expect(traerEstadoDeLosAvisos(cliente, null)).rejects.toBe(rechazo);
    await expect(
      registrarSuscripcion(cliente, { endpoint: 'e', p256dh: 'p', auth: 'a' }, 'UTC'),
    ).rejects.toBe(rechazo);
    await expect(darDeBajaSuscripcion(cliente, 'e')).rejects.toBe(rechazo);
  });
});

describe('las llamadas a la función de borde', () => {
  it('pregunta con GET si el servidor puede mandar', async () => {
    const { cliente, invoke } = clienteFalso(null, {
      data: { configurado: false, clavePublica: null },
      error: null,
    });
    expect(await consultarServidorDeAvisos(cliente)).toEqual({
      configurado: false,
      clavePublica: null,
    });
    expect(invoke).toHaveBeenCalledWith('avisos', { method: 'GET' });
  });

  it('sin red, la consulta falla', async () => {
    const error = new FunctionsFetchError(new TypeError('Failed to fetch'));
    const { cliente } = clienteFalso(null, { data: null, error });
    await expect(consultarServidorDeAvisos(cliente)).rejects.toBe(error);
  });

  it('manda la prueba a este endpoint', async () => {
    const { cliente, invoke } = clienteFalso(null, {
      data: { configurado: true, mandados: 1, podados: 0, fallidos: 0 },
      error: null,
    });
    expect(await probarLosAvisos(cliente, 'https://push.example/1')).toEqual({
      configurado: true,
      mandados: 1,
      podados: 0,
      fallidos: 0,
    });
    expect(invoke).toHaveBeenCalledWith('avisos/probar', {
      body: { endpoint: 'https://push.example/1' },
    });
  });

  it('un 503 es que el servidor no tiene claves', async () => {
    const error = new FunctionsHttpError(new Response(null, { status: 503 }));
    const { cliente } = clienteFalso(null, { data: null, error });
    expect(await probarLosAvisos(cliente, 'https://push.example/1')).toEqual({
      configurado: false,
      mandados: 0,
      podados: 0,
      fallidos: 0,
    });
  });

  it('cualquier otro error de la función se propaga', async () => {
    const error = new FunctionsHttpError(new Response(null, { status: 401 }));
    const { cliente } = clienteFalso(null, { data: null, error });
    await expect(probarLosAvisos(cliente, 'https://push.example/1')).rejects.toBe(error);
    const sinRespuesta = new FunctionsHttpError('sin respuesta');
    const otro = clienteFalso(null, { data: null, error: sinRespuesta });
    await expect(probarLosAvisos(otro.cliente, 'https://push.example/1')).rejects.toBe(
      sinRespuesta,
    );
  });
});
