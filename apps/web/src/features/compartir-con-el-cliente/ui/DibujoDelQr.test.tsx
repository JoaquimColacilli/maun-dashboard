import { render, screen } from '@testing-library/react';
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';

import { enlaceDelCliente } from '@/shared/lib';

import { DibujoDelQr } from './DibujoDelQr';

const ESCALA = 4;

// Lee el SVG que acaba de dibujar el componente, lo rasteriza en blanco y negro y lo pasa por un
// decodificador de verdad. Lo que se prueba no es la librería: es que lo que quedó en la pantalla
// se lee como la dirección que el dueño copia.
function decodificar(svg: SVGSVGElement): string | null {
  const [, , ancho] = (svg.getAttribute('viewBox') ?? '0 0 0 0').split(' ').map(Number);
  const lado = ancho ?? 0;
  const camino = svg.querySelector('path')?.getAttribute('d') ?? '';

  const negros = new Set(
    [...camino.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(
      (modulo) => `${String(modulo[1])},${String(modulo[2])}`,
    ),
  );

  const pixeles = new Uint8ClampedArray(lado * ESCALA * lado * ESCALA * 4).fill(255);
  for (let y = 0; y < lado * ESCALA; y++) {
    for (let x = 0; x < lado * ESCALA; x++) {
      const negro = negros.has(
        `${String(Math.floor(x / ESCALA))},${String(Math.floor(y / ESCALA))}`,
      );
      const inicio = (y * lado * ESCALA + x) * 4;
      pixeles[inicio] = negro ? 0 : 255;
      pixeles[inicio + 1] = negro ? 0 : 255;
      pixeles[inicio + 2] = negro ? 0 : 255;
    }
  }

  return jsQR(pixeles, lado * ESCALA, lado * ESCALA)?.data ?? null;
}

function dibujar(texto: string) {
  const { getByRole, unmount } = render(
    <DibujoDelQr texto={texto} etiqueta="Código QR del enlace" />,
  );
  const svg = getByRole('img', { name: 'Código QR del enlace' });
  if (!(svg instanceof SVGSVGElement)) throw new Error('el dibujo no es un SVG');
  unmount();
  return svg;
}

describe('el dibujo del código QR', () => {
  it('lo que se escanea es exactamente la dirección que copia «Copiar»', () => {
    const url = enlaceDelCliente('0ZT7y-Qm4kVb2Rn8LpXsWd1A');

    expect(decodificar(dibujar(url))).toBe(url);
  });

  it('una dirección larga, con el origen entero, también se lee', () => {
    const url = 'https://taller-maun.netlify.app/v/hS3k_9QpL0zXw8BvNc2MrTdY';

    expect(decodificar(dibujar(url))).toBe(url);
  });

  it('cambiar el token cambia lo que se lee: no hay nada cacheado de por medio', () => {
    const uno = enlaceDelCliente('aaaaaaaaaaaaaaaaaaaaaaaa');
    const otro = enlaceDelCliente('bbbbbbbbbbbbbbbbbbbbbbbb');

    expect(decodificar(dibujar(uno))).toBe(uno);
    expect(decodificar(dibujar(otro))).toBe(otro);
  });

  it('sale negro sobre blanco con tokens que no cambian con el tema, y con su margen', () => {
    const svg = dibujar(enlaceDelCliente('0ZT7y-Qm4kVb2Rn8LpXsWd1A'));

    expect(svg).toHaveClass('bg-paper-fijo');
    expect(svg.querySelector('path')).toHaveClass('fill-ink-fijo');

    const [, , lado] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
    const camino = svg.querySelector('path')?.getAttribute('d') ?? '';
    const coordenadas = [...camino.matchAll(/M(\d+) (\d+)/g)].flatMap((modulo) => [
      Number(modulo[1]),
      Number(modulo[2]),
    ]);
    expect(Math.min(...coordenadas)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...coordenadas)).toBeLessThanOrEqual((lado ?? 0) - 5);
  });

  it('el lector de pantalla lo anuncia como una imagen con nombre', () => {
    render(<DibujoDelQr texto="https://maun.test/v/abc" etiqueta="Código QR del enlace de Mesa" />);

    expect(screen.getByRole('img', { name: 'Código QR del enlace de Mesa' })).toBeInTheDocument();
  });
});
