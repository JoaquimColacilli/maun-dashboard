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

  it('un evento inicial sin sesión mientras se valida no manda al acceso: decide la validación', async () => {
    let contestar: (claims: Claims | undefined) => void = () => undefined;
    api.leerClaims.mockImplementation(
      () =>
        new Promise((resolver) => {
          contestar = resolver;
        }),
    );
    const store = await arrancar();

    api.oyente?.(undefined, 'otro');
    expect(store.leerEstadoSesion().tipo).toBe('cargando');

    contestar(ANA);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.leerEstadoSesion()).toMatchObject({ tipo: 'activa', usuarioId: 'ana' });
  });

  it('un evento sin sesión que no es un cierre no saca a quien ya estaba adentro', async () => {
    api.leerClaims.mockResolvedValue(ANA);
    const store = await arrancar();
    await vi.advanceTimersByTimeAsync(0);

    api.oyente?.(undefined, 'otro');

    expect(store.leerEstadoSesion()).toMatchObject({ tipo: 'activa', usuarioId: 'ana' });
  });

  it('una sesión que se cerró sola lleva al acceso diciendo por qué, y una validación tardía no borra el motivo', async () => {
    let rechazar: (motivo: unknown) => void = () => undefined;
    api.leerClaims.mockImplementation(
      () =>
        new Promise((_resolver, rechazo) => {
          rechazar = rechazo;
        }),
    );
    const store = await arrancar();

    api.oyente?.(undefined, 'vencida');
    expect(store.leerEstadoSesion()).toEqual({ tipo: 'anonimo', vencida: true });

    rechazar(new Error('refresh_token_not_found'));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.leerEstadoSesion()).toEqual({ tipo: 'anonimo', vencida: true });

    api.oyente?.(ANA, 'otro');
    expect(store.leerEstadoSesion()).toMatchObject({ tipo: 'activa', usuarioId: 'ana' });
  });

  it('cerrar sesión a pedido no es una sesión vencida', async () => {
    api.leerClaims.mockResolvedValue(ANA);
    const store = await arrancar();
    await vi.advanceTimersByTimeAsync(0);

    api.oyente?.(undefined, 'cerrada');

    expect(store.leerEstadoSesion()).toEqual({ tipo: 'anonimo', vencida: false });
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
