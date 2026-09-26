import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

import { CAJA_DEL_ISOTIPO, GROSOR_DEL_TRAZO, TRAZO_DEL_ISOTIPO } from '@maun/ui/marca';
import { describe, expect, it } from 'vitest';

import { IMAGEN_DE_LA_VISTA } from '../netlify/edge-functions/vista-previa.ts';
import {
  ICONOS,
  LADO_DEL_FAVICON,
  PAPEL,
  svgDeNuma,
  TINTA,
  TINTA_DEL_OSCURO,
} from './iconos/dibujo.ts';

const WEB = `${path.resolve(process.cwd())}${path.sep}`;

function leer(ruta: string): Buffer {
  return readFileSync(`${WEB}${ruta}`);
}

function texto(ruta: string): string {
  return leer(ruta).toString('utf8').replaceAll('\r\n', '\n');
}

interface Png {
  ancho: number;
  alto: number;
  tipoDeColor: number;
  pixel: (x: number, y: number) => readonly [number, number, number, number];
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function medidas(bytes: Buffer): { ancho: number; alto: number } {
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  return { ancho: bytes.readUInt32BE(16), alto: bytes.readUInt32BE(20) };
}

function leerPng(bytes: Buffer): Png {
  const { ancho, alto } = medidas(bytes);
  const profundidad = bytes.readUInt8(24);
  const tipoDeColor = bytes.readUInt8(25);
  expect(profundidad).toBe(8);
  expect([2, 6]).toContain(tipoDeColor);
  const canales = tipoDeColor === 6 ? 4 : 3;

  const datos: Buffer[] = [];
  let posicion = 8;
  while (posicion < bytes.length) {
    const largo = bytes.readUInt32BE(posicion);
    const tipo = bytes.toString('latin1', posicion + 4, posicion + 8);
    if (tipo === 'IDAT') datos.push(bytes.subarray(posicion + 8, posicion + 8 + largo));
    posicion += 12 + largo;
  }
  const crudo = inflateSync(Buffer.concat(datos));
  const renglon = ancho * canales;
  const pixeles = Buffer.alloc(renglon * alto);
  for (let y = 0; y < alto; y += 1) {
    const filtro = crudo.readUInt8(y * (renglon + 1));
    for (let x = 0; x < renglon; x += 1) {
      const valor = crudo.readUInt8(y * (renglon + 1) + 1 + x);
      const izquierda = x >= canales ? (pixeles[y * renglon + x - canales] ?? 0) : 0;
      const arriba = y > 0 ? (pixeles[(y - 1) * renglon + x] ?? 0) : 0;
      const diagonal = x >= canales && y > 0 ? (pixeles[(y - 1) * renglon + x - canales] ?? 0) : 0;
      const prediccion = [
        0,
        izquierda,
        arriba,
        Math.floor((izquierda + arriba) / 2),
        paeth(izquierda, arriba, diagonal),
      ][filtro];
      if (prediccion === undefined) throw new Error(`filtro de PNG desconocido: ${String(filtro)}`);
      pixeles[y * renglon + x] = (valor + prediccion) & 0xff;
    }
  }
  return {
    ancho,
    alto,
    tipoDeColor,
    pixel: (x, y) => {
      const inicio = y * renglon + x * canales;
      const [r = 0, g = 0, b = 0] = pixeles.subarray(inicio, inicio + 3);
      return [r, g, b, canales === 4 ? (pixeles[inicio + 3] ?? 0) : 255];
    },
  };
}

function rgb(hex: string): readonly [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function esOpaco(png: Png): boolean {
  if (png.tipoDeColor === 2) return true;
  for (let y = 0; y < png.alto; y += 1) {
    for (let x = 0; x < png.ancho; x += 1) {
      if (png.pixel(x, y)[3] !== 255) return false;
    }
  }
  return true;
}

function iconosDelManifiesto(): { src: string; lado: number }[] {
  const configuracion = texto('vite.config.ts');
  const manifiesto = configuracion.slice(configuracion.indexOf('manifest: {'));
  return [...manifiesto.matchAll(/src: '([^']+)',\s*sizes: '(\d+)x(\d+)'/g)].map(
    ([, src = '', ancho = '0', alto = '0']) => {
      expect(ancho).toBe(alto);
      return { src, lado: Number(ancho) };
    },
  );
}

function iconosDelHead(): { href: string; lado: number | null }[] {
  return [
    ...texto('index.html').matchAll(
      /<link rel="(?:icon|apple-touch-icon)" href="\/([^"]+)"(?: sizes="(\d+)x\d+")?/g,
    ),
  ].map(([, href = '', lado]) => ({ href, lado: lado === undefined ? null : Number(lado) }));
}

describe('los íconos de NUMA', () => {
  it('el manifiesto trae el 192, el 512 y el enmascarable, y cada uno mide lo que dice', () => {
    const iconos = iconosDelManifiesto();
    expect(iconos.map((icono) => icono.src)).toEqual([
      'numa-192.png',
      'numa-512.png',
      'numa-enmascarable-512.png',
    ]);
    for (const { src, lado } of iconos) {
      const png = leerPng(leer(`public/${src}`));
      expect([png.ancho, png.alto], src).toEqual([lado, lado]);
    }
    expect(texto('vite.config.ts')).toContain("purpose: 'maskable'");
  });

  it('el head pide el ICO de 32, el SVG y el de inicio de 180, y los tres existen', () => {
    expect(iconosDelHead()).toEqual([
      { href: 'favicon.ico', lado: LADO_DEL_FAVICON },
      { href: 'numa.svg', lado: null },
      { href: 'numa-apple-180.png', lado: null },
    ]);
    const ico = leer('public/favicon.ico');
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(1);
    expect(ico.readUInt8(6)).toBe(LADO_DEL_FAVICON);
    expect(ico.readUInt8(7)).toBe(LADO_DEL_FAVICON);
    const png = leerPng(ico.subarray(ico.readUInt32LE(18)));
    expect([png.ancho, png.alto]).toEqual([LADO_DEL_FAVICON, LADO_DEL_FAVICON]);
    const apple = leerPng(leer('public/numa-apple-180.png'));
    expect([apple.ancho, apple.alto]).toEqual([180, 180]);
  });

  it('cada ícono generado mide lo que dice su tabla', () => {
    for (const icono of ICONOS) {
      const png = leerPng(leer(`public/${icono.archivo}`));
      expect([png.ancho, png.alto], icono.archivo).toEqual([icono.lado, icono.lado]);
    }
  });

  it('el de inicio del iPhone y el enmascarable son opacos, de borde a borde', () => {
    for (const archivo of ['numa-apple-180.png', 'numa-enmascarable-512.png']) {
      const png = leerPng(leer(`public/${archivo}`));
      expect(esOpaco(png), archivo).toBe(true);
      expect(png.pixel(0, 0).slice(0, 3), archivo).toEqual(rgb(TINTA));
    }
  });

  it('los del manifiesto tienen las esquinas transparentes, y la insignia es la N sola', () => {
    for (const archivo of ['numa-192.png', 'numa-512.png']) {
      const png = leerPng(leer(`public/${archivo}`));
      expect(png.pixel(0, 0)[3], archivo).toBe(0);
      expect(png.pixel(png.ancho / 2, Math.round(png.alto * 0.12))[3], archivo).toBe(255);
    }
    const insignia = leerPng(leer('public/numa-insignia-96.png'));
    expect(insignia.pixel(0, 0)[3]).toBe(0);
    expect(insignia.pixel(48, 48)).toEqual([...rgb(PAPEL), 255]);
  });

  it('la N de numa.svg es la de los trazos, y el archivo es el que arma el script', () => {
    const svg = texto('public/numa.svg');
    expect(svg).toBe(svgDeNuma());
    expect(svg).toContain(`viewBox="${CAJA_DEL_ISOTIPO}"`);
    expect(svg).toContain(`<path d="${TRAZO_DEL_ISOTIPO.d}"/>`);
    expect(svg).toContain(`stroke-width="${String(GROSOR_DEL_TRAZO)}"`);
    expect(svg).toContain('prefers-color-scheme: dark');
  });

  it('la tinta y el papel son los del tema claro, y el oscuro es la tinta del tema oscuro', () => {
    const tema = readFileSync(
      createRequire(`${WEB}package.json`).resolve('@maun/ui/theme.css'),
      'utf8',
    );
    const oscuro = tema.slice(tema.indexOf('@variant dark {'));
    expect(/--color-ink: (#[0-9a-f]{6});/.exec(tema)?.[1]).toBe(TINTA);
    expect(/--color-paper: (#[0-9a-f]{6});/.exec(tema)?.[1]).toBe(PAPEL);
    expect(/--color-ink: (#[0-9a-f]{6});/.exec(oscuro)?.[1]).toBe(TINTA_DEL_OSCURO);
  });
});

describe('los íconos del taller, que ve el cliente', () => {
  it('siguen estando, con la M de siempre, y la imagen de la vista previa es uno de ellos', () => {
    for (const archivo of ['taller.ico', 'taller.svg', 'taller-180.png', 'taller-512.png']) {
      expect(existsSync(`${WEB}public/${archivo}`), archivo).toBe(true);
    }
    expect(IMAGEN_DE_LA_VISTA).toBe('/taller-512.png');
    const imagen = leer(`public${IMAGEN_DE_LA_VISTA}`);
    const { ancho, alto } = medidas(imagen);
    expect(ancho).toBeGreaterThanOrEqual(300);
    expect(ancho).toBe(alto);
    expect(imagen.length).toBeLessThan(600 * 1024);
    expect(texto('public/taller.svg')).toContain('M128 376V136h52l76 128');
  });
});
