import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { BrowserContext, Page } from '@playwright/test';

export type Zona = 'pantalla' | 'main';

export const CARPETA_DE_CAPTURAS = process.env.CAPTURAS_DE_TRANSICIONES;

const DIFERENCIA_DE_CANAL = 32;
const BLOQUE = 8;

export async function asentar(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)));
  });
}

export async function capturar(page: Page, zona: Zona): Promise<Buffer> {
  if (zona === 'pantalla') return page.screenshot();
  const caja = await page.locator('main#contenido').evaluate((principal) => {
    const rectangulo = principal.getBoundingClientRect();
    const izquierda = Math.max(0, rectangulo.left);
    const arriba = Math.max(0, rectangulo.top);
    return {
      x: izquierda,
      y: arriba,
      width: Math.min(window.innerWidth, rectangulo.right) - izquierda,
      height: Math.min(window.innerHeight, rectangulo.bottom) - arriba,
    };
  });
  return page.screenshot({ clip: caja });
}

export function guardarCaptura(proyecto: string, nombre: string, imagen: Buffer): void {
  if (CARPETA_DE_CAPTURAS === undefined) return;
  const archivo = path.join(CARPETA_DE_CAPTURAS, proyecto, `${nombre}.png`);
  mkdirSync(path.dirname(archivo), { recursive: true });
  writeFileSync(archivo, imagen);
}

export interface Diferencia {
  distintos: number;
  total: number;
  proporcion: number;
}

export async function abrirComparador(context: BrowserContext): Promise<Page> {
  return context.newPage();
}

export async function comparar(comparador: Page, una: Buffer, otra: Buffer): Promise<Diferencia> {
  return comparador.evaluate(
    async ({ primera, segunda, umbral, bloque }) => {
      const decodificar = async (base64: string) => {
        const bytes = Uint8Array.from(atob(base64), (letra) => letra.charCodeAt(0));
        const mapa = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const lienzo = new OffscreenCanvas(mapa.width, mapa.height);
        const contexto = lienzo.getContext('2d');
        if (!contexto) throw new Error('sin contexto 2d');
        contexto.drawImage(mapa, 0, 0);
        return contexto.getImageData(0, 0, mapa.width, mapa.height);
      };
      const [a, b] = await Promise.all([decodificar(primera), decodificar(segunda)]);
      const columnas = Math.floor(a.width / bloque);
      const filas = Math.floor(a.height / bloque);
      const total = columnas * filas;
      if (a.width !== b.width || a.height !== b.height) {
        return { distintos: total, total, proporcion: 1 };
      }
      let distintos = 0;
      for (let fila = 0; fila < filas; fila += 1) {
        for (let columna = 0; columna < columnas; columna += 1) {
          let peor = 0;
          for (let canal = 0; canal < 3; canal += 1) {
            let sumaA = 0;
            let sumaB = 0;
            for (let y = 0; y < bloque; y += 1) {
              for (let x = 0; x < bloque; x += 1) {
                const indice = ((fila * bloque + y) * a.width + columna * bloque + x) * 4 + canal;
                sumaA += a.data[indice] ?? 0;
                sumaB += b.data[indice] ?? 0;
              }
            }
            peor = Math.max(peor, Math.abs(sumaA - sumaB) / (bloque * bloque));
          }
          if (peor > umbral) distintos += 1;
        }
      }
      return { distintos, total, proporcion: distintos / total };
    },
    {
      primera: una.toString('base64'),
      segunda: otra.toString('base64'),
      umbral: DIFERENCIA_DE_CANAL,
      bloque: BLOQUE,
    },
  );
}
