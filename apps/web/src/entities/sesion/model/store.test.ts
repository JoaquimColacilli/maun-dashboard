import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CambioDeSesion, Claims } from '@/shared/api';

type Store = typeof import('./store');

const api = vi.hoisted(() => ({
  oyente: undefined as ((claims: Claims | undefined, cambio: CambioDeSesion) => void) | undefined,
  leerClaims: vi.fn<() => Promise<Claims | undefined>>(),
  claimsGuardados: vi.fn<() => Claims | undefined>(),
}));

vi.mock('@/shared/api', () => ({
  escucharSesion: (oyente: (claims: Claims | undefined, cambio: CambioDeSesion) => void) => {
    api.oyente = oyente;
    return () => undefined;
  },
  leerClaims: api.leerClaims,
  claimsGuardados: api.claimsGuardados,
  vinoPorRecuperacion: () => false,
}));

const ANA: Claims = { usuarioId: 'ana', email: 'ana@taller.com.ar', nombre: 'Ana', foto: '' };

function nunca<T>(): Promise<T> {
  return new Promise(() => undefined);
}

async function arrancar(): Promise<Store> {
  vi.resetModules();
  const store = await import('./store');
  store.suscribirSesion(() => undefined);
  return store;
}

describe('el estado de la sesión al abrir la app', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.oyente = undefined;
    api.leerClaims.mockReset();
    api.claimsGuardados.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('si validar la sesión no termina, al tope abre con la sesión guardada en vez de quedarse abriendo', async () => {
    api.leerClaims.mockImplementation(nunca);
    api.claimsGuardados.mockReturnValue(ANA);
    const store = await arrancar();

    expect(store.leerEstadoSesion().tipo).toBe('cargando');
    await vi.advanceTimersByTimeAsync(store.TOPE_PARA_VALIDAR_LA_SESION_MS);

    expect(store.leerEstadoSesion()).toMatchObject({ tipo: 'activa', usuarioId: 'ana' });
  });

  it('sin sesión guardada, el tope manda al acceso', async () => {
    api.leerClaims.mockImplementation(nunca);
    api.claimsGuardados.mockReturnValue(undefined);
    const store = await arrancar();

    await vi.advanceTimersByTimeAsync(store.TOPE_PARA_VALIDAR_LA_SESION_MS);

    expect(store.leerEstadoSesion().tipo).toBe('anonimo');
  });

  it('si la validación contesta antes, el tope no hace nada', async () => {
    api.leerClaims.mockResolvedValue(ANA);
    const store = await arrancar();

    await vi.advanceTimersByTimeAsync(store.TOPE_PARA_VALIDAR_LA_SESION_MS * 2);

    expect(store.leerEstadoSesion()).toMatchObject({ tipo: 'activa', usuarioId: 'ana' });
    expect(api.claimsGuardados).not.toHaveBeenCalled();
  });

  it('si la validación contesta tarde que la sesión no sirve, sale al acceso igual', async () => {
    let rechazar: (motivo: unknown) => void = () => undefined;
    api.leerClaims.mockImplementation(
      () =>
        new Promise((_resolver, rechazo) => {
          rechazar = rechazo;
        }),
    );
    api.claimsGuardados.mockReturnValue(ANA);
    const store = await arrancar();

    await vi.advanceTimersByTimeAsync(store.TOPE_PARA_VALIDAR_LA_SESION_MS);
    expect(store.leerEstadoSesion().tipo).toBe('activa');

    rechazar(new Error('refresh_token_not_found'));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.leerEstadoSesion().tipo).toBe('anonimo');
  });
});
