import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registrarHuella } from '@/shared/api';
import { activarBloqueo, pedirHuella } from '@/shared/lib';

import { activarHuella, SIN_SENAL_PARA_ACTIVAR } from './activar';

vi.mock('@/shared/api', async (original) => ({
  ...(await original<typeof import('@/shared/api')>()),
  registrarHuella: vi.fn(),
}));

vi.mock('@/shared/lib', async (original) => ({
  ...(await original<typeof import('@/shared/lib')>()),
  activarBloqueo: vi.fn(),
  pedirHuella: vi.fn(),
}));

function rechazo(codigo: string, nombre = 'WebAuthnError'): Error {
  return Object.assign(new Error(codigo), { name: nombre, code: codigo });
}

beforeEach(() => {
  onlineManager.setOnline(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('activar la huella en este dispositivo', () => {
  it('registra la passkey en Supabase y deja la marca local', async () => {
    vi.mocked(registrarHuella).mockResolvedValue();

    expect(await activarHuella('ana')).toEqual({ tipo: 'activada' });
    expect(activarBloqueo).toHaveBeenCalledWith('ana', null);
  });

  it('sin señal no intenta registrar y lo dice', async () => {
    onlineManager.setOnline(false);

    expect(await activarHuella('ana')).toEqual({
      tipo: 'no-se-pudo',
      mensaje: SIN_SENAL_PARA_ACTIVAR,
    });
    expect(registrarHuella).not.toHaveBeenCalled();
    expect(activarBloqueo).not.toHaveBeenCalled();
  });

  it('si el teléfono ya tenía la passkey, la confirma con la huella en vez de duplicarla', async () => {
    vi.mocked(registrarHuella).mockRejectedValue(
      rechazo('ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED'),
    );
    vi.mocked(pedirHuella).mockResolvedValue({ tipo: 'confirmada', credencial: 'Y3JlZA' });

    expect(await activarHuella('ana')).toEqual({ tipo: 'activada' });
    expect(activarBloqueo).toHaveBeenCalledWith('ana', 'Y3JlZA');
  });

  it('cancelar el registro no deja la marca y explica qué pasó', async () => {
    vi.mocked(registrarHuella).mockRejectedValue(
      rechazo('ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY', 'NotAllowedError'),
    );

    const resultado = await activarHuella('ana');
    expect(resultado).toMatchObject({ tipo: 'no-se-pudo' });
    expect(resultado.tipo === 'no-se-pudo' ? resultado.mensaje : '').toContain(
      'La huella se canceló',
    );
    expect(activarBloqueo).not.toHaveBeenCalled();
  });

  it('con las passkeys apagadas en el servidor lo dice en castellano', async () => {
    vi.mocked(registrarHuella).mockRejectedValue(
      Object.assign(new Error('Passkeys are disabled'), {
        name: 'AuthApiError',
        code: 'passkey_disabled',
        status: 404,
      }),
    );

    const resultado = await activarHuella('ana');
    expect(resultado.tipo === 'no-se-pudo' ? resultado.mensaje : '').toContain(
      'La huella todavía no está habilitada',
    );
    expect(activarBloqueo).not.toHaveBeenCalled();
  });

  it('si se sale de la pantalla mientras registra, se cancela en silencio y no deja marca', async () => {
    vi.mocked(registrarHuella).mockImplementation(
      (senal) =>
        new Promise((_resolver, rechazar) => {
          senal?.addEventListener('abort', () => {
            rechazar(new DOMException('abortado', 'AbortError'));
          });
        }),
    );
    const pantalla = new AbortController();

    const activando = activarHuella('ana', pantalla.signal);
    pantalla.abort();

    expect(await activando).toEqual({ tipo: 'interrumpida' });
    expect(activarBloqueo).not.toHaveBeenCalled();
  });
});
