import { describe, expect, it } from 'vitest';

import { EnvInvalidoError, leerEnv } from './env';

const COMPLETO = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local',
};

describe('leerEnv', () => {
  it('devuelve las variables cuando están completas', () => {
    expect(leerEnv({ ...COMPLETO, OTRA: 'x' })).toEqual(COMPLETO);
  });

  it('nombra la variable que falta', () => {
    const { VITE_SUPABASE_URL: _url, ...sinUrl } = COMPLETO;
    expect(() => leerEnv(sinUrl)).toThrow(EnvInvalidoError);
    expect(() => leerEnv(sinUrl)).toThrow(/VITE_SUPABASE_URL: falta definirla/);
  });

  it('rechaza una clave secreta en el cliente', () => {
    expect(() => leerEnv({ ...COMPLETO, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' })).toThrow(
      /VITE_SUPABASE_PUBLISHABLE_KEY: es una clave secreta/,
    );
  });
});
