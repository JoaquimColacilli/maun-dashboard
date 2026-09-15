import { describe, expect, it } from 'vitest';

import type { ImagenDecodificada, LienzoDeSalida } from '@/shared/lib';

import { prepararImagen } from './preparacion';

interface Registro {
  dibujos: number[][];
  pedidos: string[];
  calidades: (number | undefined)[];
}

function lienzoFalso(registro: Registro, tiposQueSabe: readonly string[]): () => LienzoDeSalida {
  return () => {
    const lienzo: LienzoDeSalida = {
      width: 0,
      height: 0,
      getContext: () => ({
        imageSmoothingEnabled: false,
        imageSmoothingQuality: 'low',
        drawImage: (_fuente, ...medidas: number[]) => {
          registro.dibujos.push(medidas);
        },
      }),
      toBlob: (alTerminar, tipo = 'image/png', calidad) => {
        registro.pedidos.push(tipo);
        registro.calidades.push(calidad);
        const sale = tiposQueSabe.includes(tipo) ? tipo : 'image/png';
        alTerminar(
          new Blob([new Uint8Array(Math.round((lienzo.width * lienzo.height) / 100))], {
            type: sale,
          }),
        );
      },
    };
    return lienzo;
  };
}

function imagen(ancho: number, alto: number): ImagenDecodificada {
  return {
    fuente: {} as CanvasImageSource,
    tamano: { ancho, alto },
    url: 'blob:prueba',
    liberar: () => undefined,
  };
}

describe('prepararImagen', () => {
  it('achica a 2000 px la completa y a 480 la miniatura, en WebP y con calidad 0,8', async () => {
    const registro: Registro = { dibujos: [], pedidos: [], calidades: [] };
    const preparada = await prepararImagen(
      imagen(4032, 3024),
      lienzoFalso(registro, ['image/webp']),
    );

    expect(registro.dibujos).toEqual([
      [0, 0, 4032, 3024, 0, 0, 2000, 1500],
      [0, 0, 4032, 3024, 0, 0, 480, 360],
    ]);
    expect(registro.pedidos).toEqual(['image/webp', 'image/webp']);
    expect(registro.calidades).toEqual([0.8, 0.8]);
    expect(preparada).toMatchObject({ ancho: 2000, alto: 1500, tipo: 'image/webp' });
    expect(preparada.completa.size).toBeGreaterThan(preparada.miniatura.size);
  });

  it('donde el navegador no codifica WebP, sale en JPEG', async () => {
    const registro: Registro = { dibujos: [], pedidos: [], calidades: [] };
    const preparada = await prepararImagen(
      imagen(1200, 900),
      lienzoFalso(registro, ['image/jpeg']),
    );

    expect(registro.pedidos).toEqual(['image/webp', 'image/jpeg', 'image/webp', 'image/jpeg']);
    expect(preparada).toMatchObject({ ancho: 1200, alto: 900, tipo: 'image/jpeg' });
    expect(preparada.completa.type).toBe('image/jpeg');
  });

  it('si el navegador no puede codificar ni lo uno ni lo otro, lo dice', async () => {
    const registro: Registro = { dibujos: [], pedidos: [], calidades: [] };
    await expect(prepararImagen(imagen(800, 600), lienzoFalso(registro, []))).rejects.toThrow(
      'No se pudo preparar la imagen. Probá de nuevo.',
    );
  });

  it('sin contexto 2d, lo dice', async () => {
    const sinContexto = (): LienzoDeSalida => ({
      width: 0,
      height: 0,
      getContext: () => null,
      toBlob: () => undefined,
    });
    await expect(prepararImagen(imagen(800, 600), sinContexto)).rejects.toThrow(
      'Este navegador no puede preparar la imagen.',
    );
  });
});
