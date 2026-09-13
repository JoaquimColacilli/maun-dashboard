export interface Tamano {
  readonly ancho: number;
  readonly alto: number;
}

export interface Punto {
  readonly x: number;
  readonly y: number;
}

export interface Encuadre {
  readonly zoom: number;
  readonly desplazamiento: Punto;
}

export interface Recorte {
  readonly sx: number;
  readonly sy: number;
  readonly lado: number;
}

export interface Vista {
  readonly ancho: number;
  readonly alto: number;
  readonly izquierda: number;
  readonly arriba: number;
}

export const LADO_DE_SALIDA = 512;
export const ZOOM_TOPE = 4;
export const LADO_MINIMO_EN_LA_FUENTE = 128;
export const ENCUADRE_INICIAL: Encuadre = { zoom: 1, desplazamiento: { x: 0, y: 0 } };

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor)) + 0;
}

function ladoCorto(fuente: Tamano): number {
  return Math.min(fuente.ancho, fuente.alto);
}

export function escalaDeCobertura(fuente: Tamano, viewport: number): number {
  return viewport / ladoCorto(fuente);
}

export function zoomMaximo(
  fuente: Tamano,
  tope = ZOOM_TOPE,
  ladoMinimo = LADO_MINIMO_EN_LA_FUENTE,
): number {
  return limitar(ladoCorto(fuente) / ladoMinimo, 1, tope);
}

export function limitarDesplazamiento(
  fuente: Tamano,
  viewport: number,
  zoom: number,
  desplazamiento: Punto,
): Punto {
  const escala = escalaDeCobertura(fuente, viewport) * zoom;
  const holguraX = Math.max(0, (fuente.ancho * escala - viewport) / 2);
  const holguraY = Math.max(0, (fuente.alto * escala - viewport) / 2);
  return {
    x: limitar(desplazamiento.x, -holguraX, holguraX),
    y: limitar(desplazamiento.y, -holguraY, holguraY),
  };
}

export function desplazar(
  fuente: Tamano,
  viewport: number,
  encuadre: Encuadre,
  delta: Punto,
): Encuadre {
  return {
    zoom: encuadre.zoom,
    desplazamiento: limitarDesplazamiento(fuente, viewport, encuadre.zoom, {
      x: encuadre.desplazamiento.x + delta.x,
      y: encuadre.desplazamiento.y + delta.y,
    }),
  };
}

export function zoomAlrededorDe(
  fuente: Tamano,
  viewport: number,
  encuadre: Encuadre,
  zoomPedido: number,
  punto: Punto,
  maximo = zoomMaximo(fuente),
): Encuadre {
  const zoom = limitar(zoomPedido, 1, maximo);
  const razon = zoom / encuadre.zoom;
  return {
    zoom,
    desplazamiento: limitarDesplazamiento(fuente, viewport, zoom, {
      x: punto.x - (punto.x - encuadre.desplazamiento.x) * razon,
      y: punto.y - (punto.y - encuadre.desplazamiento.y) * razon,
    }),
  };
}

export function reescalarAlViewport(
  encuadre: Encuadre,
  viewportAnterior: number,
  viewportNuevo: number,
): Encuadre {
  if (viewportAnterior <= 0) return encuadre;
  const razon = viewportNuevo / viewportAnterior;
  return {
    zoom: encuadre.zoom,
    desplazamiento: {
      x: encuadre.desplazamiento.x * razon,
      y: encuadre.desplazamiento.y * razon,
    },
  };
}

export function recorteEnLaFuente(fuente: Tamano, viewport: number, encuadre: Encuadre): Recorte {
  const escala = escalaDeCobertura(fuente, viewport) * encuadre.zoom;
  const lado = Math.min(ladoCorto(fuente), viewport / escala);
  return {
    sx: limitar(
      fuente.ancho / 2 - (viewport / 2 + encuadre.desplazamiento.x) / escala,
      0,
      fuente.ancho - lado,
    ),
    sy: limitar(
      fuente.alto / 2 - (viewport / 2 + encuadre.desplazamiento.y) / escala,
      0,
      fuente.alto - lado,
    ),
    lado,
  };
}

export function vistaDeLaImagen(fuente: Tamano, viewport: number, encuadre: Encuadre): Vista {
  const escala = escalaDeCobertura(fuente, viewport) * encuadre.zoom;
  const ancho = fuente.ancho * escala;
  const alto = fuente.alto * escala;
  return {
    ancho,
    alto,
    izquierda: viewport / 2 + encuadre.desplazamiento.x - ancho / 2,
    arriba: viewport / 2 + encuadre.desplazamiento.y - alto / 2,
  };
}
