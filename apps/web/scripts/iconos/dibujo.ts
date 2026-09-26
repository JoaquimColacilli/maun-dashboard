import {
  ALTO_DE_LA_MARCA,
  ANCHO_DEL_ISOTIPO,
  CAJA_DEL_ISOTIPO,
  TRAZO_DEL_ISOTIPO,
  trazosEnSvg,
} from '@maun/ui/marca';

export const TINTA = '#141414';
export const PAPEL = '#ffffff';
export const TINTA_DEL_OSCURO = '#ededed';

export type FondoDelIcono = 'redondeado' | 'lleno' | 'transparente';

export interface IconoDeNuma {
  archivo: string;
  lado: number;
  fondo: FondoDelIcono;
  alturaDeLaN: number;
  colorDeLaN: string;
}

export const LADO_DEL_SVG = 512;
export const RADIO_DEL_SVG = 96;
export const ALTURA_DE_LA_N_EN_EL_SVG = 0.58;

export const MARGEN_DEL_REDONDEADO = 13 / 512;
export const RADIO_DEL_REDONDEADO = 81 / 512;

export const ICONOS: readonly IconoDeNuma[] = [
  { archivo: 'numa-192.png', lado: 192, fondo: 'redondeado', alturaDeLaN: 0.5, colorDeLaN: PAPEL },
  { archivo: 'numa-512.png', lado: 512, fondo: 'redondeado', alturaDeLaN: 0.5, colorDeLaN: PAPEL },
  {
    archivo: 'numa-enmascarable-512.png',
    lado: 512,
    fondo: 'lleno',
    alturaDeLaN: 0.48,
    colorDeLaN: PAPEL,
  },
  { archivo: 'numa-apple-180.png', lado: 180, fondo: 'lleno', alturaDeLaN: 0.5, colorDeLaN: PAPEL },
  {
    archivo: 'numa-insignia-96.png',
    lado: 96,
    fondo: 'transparente',
    alturaDeLaN: 0.7,
    colorDeLaN: PAPEL,
  },
];

export const LADO_DEL_FAVICON = 32;

function numero(valor: number): string {
  return String(Math.round(valor * 1000) / 1000);
}

export function laN(lado: number, fraccion: number, color: string, clase = ''): string {
  const alto = lado * fraccion;
  const ancho = (alto * ANCHO_DEL_ISOTIPO) / ALTO_DE_LA_MARCA;
  const atributoDeClase = clase === '' ? '' : ` class="${clase}"`;
  return `<svg${atributoDeClase} x="${numero((lado - ancho) / 2)}" y="${numero((lado - alto) / 2)}" width="${numero(ancho)}" height="${numero(alto)}" viewBox="${CAJA_DEL_ISOTIPO}">${trazosEnSvg([TRAZO_DEL_ISOTIPO], color)}</svg>`;
}

function fondo(icono: IconoDeNuma): string {
  const { lado } = icono;
  if (icono.fondo === 'transparente') return '';
  if (icono.fondo === 'lleno') {
    return `<rect width="${String(lado)}" height="${String(lado)}" fill="${TINTA}"/>`;
  }
  const margen = lado * MARGEN_DEL_REDONDEADO;
  const radio = lado * RADIO_DEL_REDONDEADO;
  return `<rect x="${numero(margen)}" y="${numero(margen)}" width="${numero(lado - 2 * margen)}" height="${numero(lado - 2 * margen)}" rx="${numero(radio)}" fill="${TINTA}"/>`;
}

export function svgDelIcono(icono: IconoDeNuma): string {
  const { lado } = icono;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(lado)}" height="${String(lado)}" viewBox="0 0 ${String(lado)} ${String(lado)}">${fondo(icono)}${laN(lado, icono.alturaDeLaN, icono.colorDeLaN)}</svg>`;
}

export function svgDeNuma(): string {
  const lado = LADO_DEL_SVG;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(lado)} ${String(lado)}">`,
    `<style>@media (prefers-color-scheme: dark){.fondo{fill:${TINTA_DEL_OSCURO}}.letra>g{stroke:${TINTA}}}</style>`,
    `<rect class="fondo" width="${String(lado)}" height="${String(lado)}" rx="${String(RADIO_DEL_SVG)}" fill="${TINTA}"/>`,
    laN(lado, ALTURA_DE_LA_N_EN_EL_SVG, PAPEL, 'letra'),
    '</svg>',
    '',
  ].join('\n');
}

export function icoConUnPng(png: Uint8Array, lado: number): Uint8Array {
  const cabecera = new Uint8Array(22);
  const vista = new DataView(cabecera.buffer);
  vista.setUint16(0, 0, true);
  vista.setUint16(2, 1, true);
  vista.setUint16(4, 1, true);
  vista.setUint8(6, lado >= 256 ? 0 : lado);
  vista.setUint8(7, lado >= 256 ? 0 : lado);
  vista.setUint8(8, 0);
  vista.setUint8(9, 0);
  vista.setUint16(10, 1, true);
  vista.setUint16(12, 32, true);
  vista.setUint32(14, png.length, true);
  vista.setUint32(18, cabecera.length, true);
  const ico = new Uint8Array(cabecera.length + png.length);
  ico.set(cabecera, 0);
  ico.set(png, cabecera.length);
  return ico;
}
