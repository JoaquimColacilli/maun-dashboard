import { expect, type CDPSession, type Page } from '@playwright/test';

import { apoyar, levantar, mover } from './dedo';

export interface EslabonDelScroll {
  quien: string;
  overflowY: string;
  position: string;
  alto: string;
  alturaDelContenido: number;
  alturaVisible: number;
  desborda: boolean;
  scrollea: boolean;
}

export interface MedicionDeLaVista {
  cadena: EslabonDelScroll[];
  quienScrollea: string;
  alturaDeLaVentana: number;
  fondoDelFinal: number;
  finalALaVista: boolean;
  recorrido: number;
}

const MARCA_DEL_FINAL = '[data-fin-de-la-vista]';

export async function medirLaVista(page: Page): Promise<MedicionDeLaVista> {
  return page.evaluate((marca) => {
    const final = document.querySelector(marca);
    const raiz = document.scrollingElement;
    const cadena: EslabonDelScroll[] = [];
    let nodo: HTMLElement | null = final instanceof HTMLElement ? final : null;

    while (nodo !== null) {
      const estilo = getComputedStyle(nodo);
      const desborda = nodo.scrollHeight > nodo.clientHeight + 1;
      cadena.push({
        quien: `${nodo.tagName.toLowerCase()}${nodo.id === '' ? '' : `#${nodo.id}`}`,
        overflowY: estilo.overflowY,
        position: estilo.position,
        alto: estilo.height,
        alturaDelContenido: nodo.scrollHeight,
        alturaVisible: nodo.clientHeight,
        desborda,
        scrollea: desborda && (/(auto|scroll)/.test(estilo.overflowY) || nodo === raiz),
      });
      nodo = nodo.parentElement;
    }

    const queScrollea = cadena.find((eslabon) => eslabon.scrollea);
    const caja = final?.getBoundingClientRect();

    return {
      cadena,
      quienScrollea: queScrollea?.quien ?? 'nadie',
      alturaDeLaVentana: window.innerHeight,
      fondoDelFinal: caja === undefined ? Number.NaN : Math.round(caja.bottom),
      finalALaVista: caja !== undefined && caja.bottom <= window.innerHeight + 1,
      recorrido: 0,
    };
  }, MARCA_DEL_FINAL);
}

async function posicion(page: Page): Promise<number> {
  return page.evaluate(() => {
    let mayor = Math.round(document.scrollingElement?.scrollTop ?? 0);
    for (const nodo of document.querySelectorAll<HTMLElement>('*')) {
      mayor = Math.max(mayor, Math.round(nodo.scrollTop));
    }
    return mayor;
  });
}

export async function deslizarHastaElFinal(
  page: Page,
  cdp: CDPSession,
  tirones = 8,
): Promise<number> {
  const medida = page.viewportSize() ?? { width: 390, height: 844 };
  const x = Math.round(medida.width / 2);
  const desde = Math.round(medida.height * 0.8);
  const hasta = Math.round(medida.height * 0.18);
  const antes = await posicion(page);

  for (let tiron = 0; tiron < tirones; tiron += 1) {
    await apoyar(cdp, desde, x);
    await mover(cdp, desde, hasta, x, 12);
    await levantar(cdp);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(500);
  return (await posicion(page)) - antes;
}

export async function deslizarYMedir(page: Page, cdp: CDPSession): Promise<MedicionDeLaVista> {
  const recorrido = await deslizarHastaElFinal(page, cdp);
  const medida = await medirLaVista(page);
  return { ...medida, recorrido };
}

export function contarLaMedicion(nombre: string, medida: MedicionDeLaVista): string {
  const eslabones = medida.cadena
    .map(
      (uno) =>
        `    ${uno.quien.padEnd(24)} overflow-y:${uno.overflowY.padEnd(8)} position:${uno.position.padEnd(8)} alto:${uno.alto.padEnd(9)} contenido:${String(uno.alturaDelContenido).padStart(5)} visible:${String(uno.alturaVisible).padStart(5)}${uno.scrollea ? '  <- SCROLLEA' : uno.desborda ? '  <- desborda y no scrollea' : ''}`,
    )
    .join('\n');
  return [
    `  ${nombre}`,
    `    scrollea: ${medida.quienScrollea}`,
    `    recorrido con el dedo: ${String(medida.recorrido)} px`,
    `    fondo del final: ${String(medida.fondoDelFinal)} px / ventana ${String(medida.alturaDeLaVentana)} px`,
    `    el final se ve: ${medida.finalALaVista ? 'sí' : 'NO'}`,
    eslabones,
  ].join('\n');
}

export async function exigirQueLlegueAlFinal(
  page: Page,
  medida: MedicionDeLaVista,
  nombre: string,
): Promise<void> {
  const tapado = medida.cadena.find((uno) => uno.desborda && !uno.scrollea);
  expect(
    tapado,
    `${nombre}: «${tapado?.quien ?? ''}» tiene ${String(tapado?.alturaDelContenido ?? 0)} px de contenido en ${String(tapado?.alturaVisible ?? 0)} px visibles y no scrollea (overflow-y: ${tapado?.overflowY ?? ''}, position: ${tapado?.position ?? ''})`,
  ).toBeUndefined();
  expect(
    medida.finalALaVista,
    `${nombre}: el final de la vista quedó en ${String(medida.fondoDelFinal)} px con una ventana de ${String(medida.alturaDeLaVentana)} px, y scrollea «${medida.quienScrollea}»`,
  ).toBe(true);
  await expect(page.locator(MARCA_DEL_FINAL)).toBeInViewport({ ratio: 0.9 });
}
