import { describe, expect, it } from 'vitest';

import { LADO_DE_SALIDA } from './encuadre';
import { recortarYCodificar, type ContextoDeSalida, type LienzoDeSalida } from './imagen';

interface Registro {
  dibujos: number[][];
  pedidos: string[];
}

function lienzoFalso(registro: Registro, tiposQueSabe: readonly string[]): LienzoDeSalida {
  const contexto: ContextoDeSalida = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    drawImage: (_fuente, ...medidas) => {
      registro.dibujos.push(medidas);
    },
  };
  return {
    width: 0,
    height: 0,
    getContext: () => contexto,
    toBlob: (alTerminar, tipo = 'image/png') => {
      registro.pedidos.push(tipo);
      const sale = tiposQueSabe.includes(tipo) ? tipo : 'image/png';
      alTerminar(new Blob([new Uint8Array(10)], { type: sale }));
    },
  };
}

const FUENTE = {} as CanvasImageSource;

describe('recortar y codificar la foto', () => {
  it('dibuja el recorte en un cuadrado de 512 y lo entrega en WebP donde el navegador sabe', async () => {
    const registro: Registro = { dibujos: [], pedidos: [] };
    const blob = await recortarYCodificar(FUENTE, { sx: 10, sy: 20, lado: 3000 }, () =>
      lienzoFalso(registro, ['image/webp', 'image/jpeg']),
    );

    expect(blob.type).toBe('image/webp');
    expect(registro.pedidos).toEqual(['image/webp']);
    expect(registro.dibujos).toEqual([[10, 20, 3000, 3000, 0, 0, LADO_DE_SALIDA, LADO_DE_SALIDA]]);
  });

  it('si el navegador devuelve PNG en vez de WebP, como Safari, la rehace en JPEG y no sube el PNG', async () => {
    const registro: Registro = { dibujos: [], pedidos: [] };
    const blob = await recortarYCodificar(FUENTE, { sx: 0, sy: 0, lado: 512 }, () =>
      lienzoFalso(registro, ['image/jpeg']),
    );

    expect(blob.type).toBe('image/jpeg');
    expect(registro.pedidos).toEqual(['image/webp', 'image/jpeg']);
  });

  it('si no sale ni WebP ni JPEG, falla con un mensaje en vez de subir cualquier cosa', async () => {
    const registro: Registro = { dibujos: [], pedidos: [] };
    await expect(
      recortarYCodificar(FUENTE, { sx: 0, sy: 0, lado: 512 }, () => lienzoFalso(registro, [])),
    ).rejects.toThrow('No se pudo preparar la foto.');
  });
});
