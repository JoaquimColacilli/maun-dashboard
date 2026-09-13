import { describe, expect, it } from 'vitest';

import {
  desplazar,
  ENCUADRE_INICIAL,
  escalaDeCobertura,
  limitarDesplazamiento,
  recorteEnLaFuente,
  reescalarAlViewport,
  vistaDeLaImagen,
  zoomAlrededorDe,
  zoomMaximo,
  type Encuadre,
  type Tamano,
} from './encuadre';

const APAISADA: Tamano = { ancho: 4000, alto: 3000 };
const VERTICAL: Tamano = { ancho: 3000, alto: 4000 };
const CHICA: Tamano = { ancho: 200, alto: 150 };
const V = 300;

describe('el encuadre de la foto', () => {
  it('con zoom 1 la imagen cubre justo el cuadrado por su lado corto', () => {
    expect(escalaDeCobertura(APAISADA, V)).toBeCloseTo(0.1);
    expect(recorteEnLaFuente(APAISADA, V, ENCUADRE_INICIAL)).toEqual({
      sx: 500,
      sy: 0,
      lado: 3000,
    });
    expect(recorteEnLaFuente(VERTICAL, V, ENCUADRE_INICIAL)).toEqual({
      sx: 0,
      sy: 500,
      lado: 3000,
    });
  });

  it('el desplazamiento no deja nunca un borde vacío: se frena donde termina la foto', () => {
    expect(limitarDesplazamiento(APAISADA, V, 1, { x: 999, y: 999 })).toEqual({ x: 50, y: 0 });
    expect(limitarDesplazamiento(APAISADA, V, 1, { x: -999, y: -999 })).toEqual({ x: -50, y: 0 });
    expect(recorteEnLaFuente(APAISADA, V, { zoom: 1, desplazamiento: { x: 50, y: 0 } })).toEqual({
      sx: 0,
      sy: 0,
      lado: 3000,
    });
  });

  it('con zoom 2 el recorte es la mitad del lado corto, centrado', () => {
    expect(recorteEnLaFuente(APAISADA, V, { zoom: 2, desplazamiento: { x: 0, y: 0 } })).toEqual({
      sx: 1250,
      sy: 750,
      lado: 1500,
    });
  });

  it('el zoom alrededor de un punto deja quieto el pixel de la foto que está debajo', () => {
    const acercado = zoomAlrededorDe(APAISADA, V, ENCUADRE_INICIAL, 2, { x: 150, y: 150 });
    expect(acercado.zoom).toBe(2);
    expect(acercado.desplazamiento).toEqual({ x: -150, y: -150 });
    expect(recorteEnLaFuente(APAISADA, V, acercado)).toEqual({ sx: 2000, sy: 1500, lado: 1500 });
  });

  it('el zoom tiene tope, y una foto chica casi no se puede acercar', () => {
    expect(zoomMaximo(APAISADA)).toBe(4);
    expect(zoomMaximo(CHICA)).toBeCloseTo(1.171875);
    expect(zoomAlrededorDe(APAISADA, V, ENCUADRE_INICIAL, 9, { x: 0, y: 0 }).zoom).toBe(4);
    expect(zoomAlrededorDe(APAISADA, V, ENCUADRE_INICIAL, 0.2, { x: 0, y: 0 }).zoom).toBe(1);
  });

  it('en ningún encuadre posible el recorte se sale de la foto', () => {
    for (const fuente of [APAISADA, VERTICAL, CHICA, { ancho: 512, alto: 512 }]) {
      for (const zoom of [1, 1.5, 2.7, 4]) {
        for (const x of [-10_000, -37, 0, 91, 10_000]) {
          for (const y of [-10_000, 13, 0, 10_000]) {
            const encuadre: Encuadre = {
              zoom: Math.min(zoom, zoomMaximo(fuente)),
              desplazamiento: limitarDesplazamiento(fuente, V, zoom, { x, y }),
            };
            const recorte = recorteEnLaFuente(fuente, V, encuadre);
            expect(recorte.sx).toBeGreaterThanOrEqual(0);
            expect(recorte.sy).toBeGreaterThanOrEqual(0);
            expect(recorte.sx + recorte.lado).toBeLessThanOrEqual(fuente.ancho + 1e-9);
            expect(recorte.sy + recorte.lado).toBeLessThanOrEqual(fuente.alto + 1e-9);
          }
        }
      }
    }
  });

  it('desplazar suma y frena, y limitar dos veces da lo mismo que una', () => {
    const movido = desplazar(APAISADA, V, ENCUADRE_INICIAL, { x: 30, y: 30 });
    expect(movido.desplazamiento).toEqual({ x: 30, y: 0 });
    const una = limitarDesplazamiento(VERTICAL, V, 3, { x: 700, y: -900 });
    expect(limitarDesplazamiento(VERTICAL, V, 3, una)).toEqual(una);
  });

  it('si el cuadro cambia de tamaño, el desplazamiento se escala con él', () => {
    const encuadre: Encuadre = { zoom: 2, desplazamiento: { x: -40, y: 20 } };
    expect(reescalarAlViewport(encuadre, 300, 240).desplazamiento).toEqual({ x: -32, y: 16 });
    expect(reescalarAlViewport(encuadre, 0, 240)).toBe(encuadre);
  });

  it('la vista previa ubica la imagen centrada y corrida por el desplazamiento', () => {
    expect(vistaDeLaImagen(APAISADA, V, ENCUADRE_INICIAL)).toEqual({
      ancho: 400,
      alto: 300,
      izquierda: -50,
      arriba: 0,
    });
  });
});
