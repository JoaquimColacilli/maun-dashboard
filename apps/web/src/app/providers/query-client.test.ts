import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sembrarEstadoDeConexion } from './query-client';

afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});

describe('sembrarEstadoDeConexion', () => {
  it('arrancar sin señal deja a la app sabiendo que no hay red', () => {
    vi.stubGlobal('navigator', { onLine: false });
    sembrarEstadoDeConexion();
    expect(onlineManager.isOnline()).toBe(false);
  });

  it('arrancar con señal la deja en línea', () => {
    onlineManager.setOnline(false);
    vi.stubGlobal('navigator', { onLine: true });
    sembrarEstadoDeConexion();
    expect(onlineManager.isOnline()).toBe(true);
  });
});
