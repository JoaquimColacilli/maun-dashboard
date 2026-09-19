import { beforeEach, describe, expect, it } from 'vitest';

import {
  CLAVE_DE_LOS_ENLACES,
  enlaceDelCliente,
  hashDelToken,
  olvidarLosTokens,
  olvidarToken,
  recordarToken,
  tokenDelEnlace,
  tokenNuevo,
} from './enlaces';

describe('el token del enlace', () => {
  it('es largo, aleatorio y con la forma que la base acepta', () => {
    const uno = tokenNuevo();
    expect(uno).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(uno).not.toBe(tokenNuevo());
  });

  it('el sha256 es determinista y no deja ver el token', async () => {
    const hash = await hashDelToken('el-token-de-marcela');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('marcela');
    expect(await hashDelToken('el-token-de-marcela')).toBe(hash);
    expect(await hashDelToken('otro')).not.toBe(hash);
  });

  it('el enlace se arma con el origen de esta app', () => {
    expect(enlaceDelCliente('abc')).toBe(`${globalThis.location.origin}/v/abc`);
  });
});

describe('el token que queda en este dispositivo', () => {
  beforeEach(() => {
    olvidarLosTokens();
  });

  it('se guarda por enlace y se lee de vuelta', () => {
    recordarToken('e1', 't1');
    recordarToken('e2', 't2');
    expect(tokenDelEnlace('e1')).toBe('t1');
    expect(tokenDelEnlace('e2')).toBe('t2');
    expect(tokenDelEnlace('e3')).toBeUndefined();
  });

  it('se olvida de a uno y de todos', () => {
    recordarToken('e1', 't1');
    recordarToken('e2', 't2');
    olvidarToken('e1');
    olvidarToken('no-estaba');
    expect(tokenDelEnlace('e1')).toBeUndefined();
    expect(tokenDelEnlace('e2')).toBe('t2');

    olvidarLosTokens();
    expect(tokenDelEnlace('e2')).toBeUndefined();
  });

  it('un guardado ilegible no rompe nada: se lee como si no hubiera ninguno', () => {
    localStorage.setItem(CLAVE_DE_LOS_ENLACES, 'no es json');
    expect(tokenDelEnlace('e1')).toBeUndefined();

    localStorage.setItem(CLAVE_DE_LOS_ENLACES, '[1, 2]');
    expect(tokenDelEnlace('e1')).toBeUndefined();

    localStorage.setItem(CLAVE_DE_LOS_ENLACES, '{"e1": 7}');
    expect(tokenDelEnlace('e1')).toBeUndefined();
  });
});
