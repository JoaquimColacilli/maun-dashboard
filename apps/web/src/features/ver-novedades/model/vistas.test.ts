import { beforeEach, describe, expect, it, vi } from 'vitest';

const sesion = vi.hoisted(() => ({ guardada: undefined as { usuarioId: string } | undefined }));

vi.mock('@/shared/api', () => ({ claimsGuardados: () => sesion.guardada }));

const NOVEDADES = [
  { version: '2026-10-02', lineas: ['La tercera.'] },
  { version: '2026-10-01.2', lineas: ['La segunda.'] },
  { version: '2026-09-15', lineas: ['La primera.'] },
];

async function alAbrirLaApp(conSesion: boolean) {
  sesion.guardada = conSesion ? { usuarioId: 'ana' } : undefined;
  vi.resetModules();
  return import('./vistas');
}

function versiones(novedades: readonly { version: string }[]): string[] {
  return novedades.map((novedad) => novedad.version);
}

beforeEach(() => {
  localStorage.clear();
});

describe('las novedades que aparecen solas', () => {
  it('con la sesión abierta de antes y nada anotado, muestran la última una sola vez', async () => {
    const { tomarNovedadesSinVer, CLAVE_DE_LAS_NOVEDADES } = await alAbrirLaApp(true);

    expect(versiones(tomarNovedadesSinVer(NOVEDADES))).toEqual(['2026-10-02']);
    expect(localStorage.getItem(CLAVE_DE_LAS_NOVEDADES)).toBe('2026-10-02');
    expect(tomarNovedadesSinVer(NOVEDADES)).toEqual([]);
  });

  it('quien recién entra con la contraseña no las ve solas, pero queda anotado', async () => {
    const { tomarNovedadesSinVer, versionVista } = await alAbrirLaApp(false);

    expect(tomarNovedadesSinVer(NOVEDADES)).toEqual([]);
    expect(versionVista()).toBe('2026-10-02');
  });

  it('después de actualizar muestran todo lo posterior a lo último visto, y no vuelven', async () => {
    localStorage.setItem('maun:novedades-vistas', '2026-09-15');
    const primera = await alAbrirLaApp(true);
    expect(versiones(primera.tomarNovedadesSinVer(NOVEDADES))).toEqual([
      '2026-10-02',
      '2026-10-01.2',
    ]);

    const segunda = await alAbrirLaApp(true);
    expect(segunda.tomarNovedadesSinVer(NOVEDADES)).toEqual([]);
  });

  it('una marca vieja cuenta aunque se haya entrado con la contraseña, y una rota vale como nada', async () => {
    localStorage.setItem('maun:novedades-vistas', '2026-09-15');
    const sinSesion = await alAbrirLaApp(false);
    expect(versiones(sinSesion.tomarNovedadesSinVer(NOVEDADES))).toEqual([
      '2026-10-02',
      '2026-10-01.2',
    ]);

    localStorage.setItem('maun:novedades-vistas', 'cualquier cosa');
    const rota = await alAbrirLaApp(true);
    expect(versiones(rota.tomarNovedadesSinVer(NOVEDADES))).toEqual(['2026-10-02']);
  });

  it('sin almacenamiento del navegador no rompe nada', async () => {
    const { tomarNovedadesSinVer, versionVista } = await alAbrirLaApp(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(versionVista()).toBeNull();
    expect(versiones(tomarNovedadesSinVer(NOVEDADES))).toEqual(['2026-10-02']);
    vi.restoreAllMocks();
  });
});
