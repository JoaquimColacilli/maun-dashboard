import { describe, expect, it, vi } from 'vitest';

import type { ImagenDecodificada } from '@/shared/lib';

import { LOS_VIDEOS_NO_ENTRAN } from './eleccion';
import type { ImagenPreparada } from './preparacion';
import { ArchivoRechazado, subirUnArchivo, type DependenciasDeLaSubida } from './subida';

const DESTINO = { householdId: 'h', proyectoId: 'p' };

function dependencias(extra: Partial<DependenciasDeLaSubida> = {}) {
  const subidas: { ruta: string; bytes: number; tipo: string }[] = [];
  const liberar = vi.fn();
  const base: DependenciasDeLaSubida = {
    subir: (ruta, contenido) => {
      subidas.push({ ruta, bytes: contenido.size, tipo: contenido.type });
      return Promise.resolve();
    },
    decodificar: () =>
      Promise.resolve({
        fuente: {} as CanvasImageSource,
        tamano: { ancho: 4032, alto: 3024 },
        url: 'blob:x',
        liberar,
      } satisfies ImagenDecodificada),
    preparar: () =>
      Promise.resolve({
        completa: new Blob([new Uint8Array(250_000)], { type: 'image/webp' }),
        miniatura: new Blob([new Uint8Array(20_000)], { type: 'image/webp' }),
        ancho: 2000,
        alto: 1500,
        tipo: 'image/webp',
      } satisfies ImagenPreparada),
    nuevoId: () => 'a1',
    ...extra,
  };
  return { base, subidas, liberar };
}

function archivo(nombre: string, tipo: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

describe('subirUnArchivo', () => {
  it('una foto sube achicada, con su miniatura, y la fila dice lo que ocupa', async () => {
    const { base, subidas, liberar } = dependencias();
    const resultado = await subirUnArchivo(
      archivo('relevamiento.jpg', 'image/jpeg', 3_400_000),
      DESTINO,
      base,
    );

    expect(subidas).toEqual([
      { ruta: 'h/p/a1.webp', bytes: 250_000, tipo: 'image/webp' },
      { ruta: 'h/p/a1.mini.webp', bytes: 20_000, tipo: 'image/webp' },
    ]);
    expect(resultado).toEqual({
      nuevo: {
        id: 'a1',
        proyecto_id: 'p',
        nombre: 'relevamiento.jpg',
        tipo: 'image/webp',
        bytes: 270_000,
        ancho: 2000,
        alto: 1500,
      },
      original: 3_400_000,
      subido: 270_000,
    });
    expect(liberar).toHaveBeenCalledOnce();
  });

  it('un PDF sube tal cual, con su tipo aunque el sistema no lo haya dicho', async () => {
    const { base, subidas } = dependencias();
    const resultado = await subirUnArchivo(archivo('despiece.pdf', '', 800_000), DESTINO, base);

    expect(subidas).toEqual([{ ruta: 'h/p/a1.pdf', bytes: 800_000, tipo: 'application/pdf' }]);
    expect(resultado.nuevo).toMatchObject({
      tipo: 'application/pdf',
      bytes: 800_000,
      ancho: null,
      alto: null,
    });
    expect(resultado.original).toBe(resultado.subido);
  });

  it('un video se rechaza antes de subir nada', async () => {
    const { base, subidas } = dependencias();
    await expect(
      subirUnArchivo(archivo('visita.mp4', 'video/mp4', 1000), DESTINO, base),
    ).rejects.toEqual(new ArchivoRechazado(LOS_VIDEOS_NO_ENTRAN));
    expect(subidas).toEqual([]);
  });

  it('si la subida se corta, libera la imagen igual', async () => {
    const { base, liberar } = dependencias({
      subir: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await expect(subirUnArchivo(archivo('a.png', 'image/png', 10), DESTINO, base)).rejects.toThrow(
      'Failed to fetch',
    );
    expect(liberar).toHaveBeenCalledOnce();
  });
});
