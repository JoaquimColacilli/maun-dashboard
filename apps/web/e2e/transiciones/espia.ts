import { expect, type BrowserContext, type Page } from '@playwright/test';

import { sinTransicionEnCurso } from '../apoyo/transiciones';

export { sinTransicionEnCurso };

export type Alcance = 'documento' | 'main' | 'otro';

export interface TransicionVista {
  alcance: Alcance;
  tipos: string[];
  salteada: boolean;
  terminada: boolean;
  hojaAbiertaAlEmpezar: boolean;
}

interface Registro extends TransicionVista {
  transicion: ViewTransition;
  animaciones: Animation[];
  fin: number;
  congelada: boolean;
}

interface Espia {
  transicionesVistas: Registro[];
  congelarLaProxima: boolean;
}

export async function espiarLasTransiciones(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const ventana = window as unknown as Espia;
    ventana.transicionesVistas = [];
    ventana.congelarLaProxima = false;

    const animacionesDe = (alcance: Element | Document): Animation[] => {
      const todas =
        alcance instanceof Document
          ? alcance.getAnimations()
          : alcance.getAnimations({ subtree: true });
      return todas.filter((animacion) => {
        const efecto = animacion.effect;
        return (
          efecto instanceof KeyframeEffect &&
          (efecto.pseudoElement ?? '').startsWith('::view-transition')
        );
      });
    };

    const envolver = (prototipo: object, alcanceDe: (quien: unknown) => Alcance) => {
      const original: unknown = Reflect.get(prototipo, 'startViewTransition');
      if (typeof original !== 'function') return;
      Object.defineProperty(prototipo, 'startViewTransition', {
        configurable: true,
        writable: true,
        value: function (this: Element | Document, ...argumentos: unknown[]) {
          const transicion = Reflect.apply(original, this, argumentos) as ViewTransition;
          const registro: Registro = {
            alcance: alcanceDe(this),
            tipos: [],
            salteada: false,
            terminada: false,
            hojaAbiertaAlEmpezar: document.querySelector('dialog[open]') !== null,
            transicion,
            animaciones: [],
            fin: 0,
            congelada: false,
          };
          const congelar = ventana.congelarLaProxima;
          ventana.congelarLaProxima = false;
          ventana.transicionesVistas.push(registro);
          transicion.ready.then(
            () => {
              registro.tipos = [...transicion.types];
              if (!congelar) return;
              registro.animaciones = animacionesDe(this);
              registro.fin = Math.max(
                0,
                ...registro.animaciones.map((animacion) =>
                  Number(animacion.effect?.getComputedTiming().endTime ?? 0),
                ),
              );
              for (const animacion of registro.animaciones) {
                animacion.pause();
                animacion.currentTime = 0;
              }
              registro.congelada = true;
            },
            () => {
              registro.salteada = true;
            },
          );
          transicion.finished.then(
            () => {
              registro.terminada = true;
            },
            () => {
              registro.terminada = true;
            },
          );
          return transicion;
        },
      });
    };

    envolver(Document.prototype, () => 'documento');
    envolver(Element.prototype, (quien) =>
      quien instanceof HTMLElement && quien.id === 'contenido' ? 'main' : 'otro',
    );
  });
}

export async function olvidarLasTransiciones(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Espia).transicionesVistas = [];
  });
}

export function transicionesVistas(page: Page): Promise<TransicionVista[]> {
  return page.evaluate(() =>
    (window as unknown as Espia).transicionesVistas.map(
      ({ alcance, tipos, salteada, terminada, hojaAbiertaAlEmpezar }) => ({
        alcance,
        tipos,
        salteada,
        terminada,
        hojaAbiertaAlEmpezar,
      }),
    ),
  );
}

export async function congelarLaProxima(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Espia).congelarLaProxima = true;
  });
}

export async function esperarCongelada(page: Page): Promise<TransicionVista> {
  const manija = await page.waitForFunction(
    () => {
      const ultima = (window as unknown as Espia).transicionesVistas.at(-1);
      if (!ultima || !(ultima.congelada || ultima.salteada)) return null;
      return {
        alcance: ultima.alcance,
        tipos: ultima.tipos,
        salteada: ultima.salteada,
        terminada: ultima.terminada,
        hojaAbiertaAlEmpezar: ultima.hojaAbiertaAlEmpezar,
      };
    },
    undefined,
    { timeout: 10_000 },
  );
  return (await manija.jsonValue()) as TransicionVista;
}

export async function llevarA(page: Page, fraccion: number): Promise<void> {
  await page.evaluate((valor) => {
    const ultima = (window as unknown as Espia).transicionesVistas.at(-1);
    if (!ultima) return;
    for (const animacion of ultima.animaciones) animacion.currentTime = ultima.fin * valor;
  }, fraccion);
  await page.evaluate(
    () => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))),
  );
}

export async function soltar(page: Page): Promise<void> {
  await page.evaluate(() => {
    const ultima = (window as unknown as Espia).transicionesVistas.at(-1);
    for (const animacion of ultima?.animaciones ?? []) animacion.play();
  });
}

export async function esperarQueTermine(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as Espia).transicionesVistas.every(
          (vista) => vista.terminada || vista.salteada,
        ),
      ),
    )
    .toBe(true);
  await sinTransicionEnCurso(page);
}
