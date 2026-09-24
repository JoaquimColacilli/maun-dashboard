import { expect, type Page, type TestInfo } from '@playwright/test';

import { asentar, capturar, comparar, guardarCaptura, type Zona } from './capturas';
import {
  congelarLaProxima,
  esperarCongelada,
  esperarQueTermine,
  llevarA,
  olvidarLasTransiciones,
  sinTransicionEnCurso,
  soltar,
  transicionesVistas,
  type Alcance,
  type TransicionVista,
} from './espia';

export const TOLERANCIA = 0.005;
export const FRACCIONES = [0, 0.5, 1] as const;

export interface Movimiento {
  nombre: string;
  alcance: Alcance;
  tipos: readonly string[];
  hacer: () => Promise<void>;
  listo: () => Promise<void>;
}

export interface Medida {
  vista: TransicionVista | null;
  alEmpezar: number;
  alTerminar: number;
}

async function congeladaONada(page: Page): Promise<TransicionVista | null> {
  try {
    return await esperarCongelada(page);
  } catch {
    return null;
  }
}

export async function medir(
  page: Page,
  comparador: Page,
  testInfo: TestInfo,
  movimiento: Movimiento,
): Promise<Medida> {
  const zona: Zona = movimiento.alcance === 'main' ? 'main' : 'pantalla';
  await sinTransicionEnCurso(page);
  await asentar(page);
  const antes = await capturar(page, zona);
  await olvidarLasTransiciones(page);
  await congelarLaProxima(page);
  await movimiento.hacer();
  const vista = await congeladaONada(page);
  const nombre = movimiento.nombre;
  expect.soft(vista, `${nombre}: no arrancó ninguna transición`).not.toBeNull();
  if (vista === null) {
    await movimiento.listo();
    return { vista, alEmpezar: 1, alTerminar: 1 };
  }
  expect.soft(vista.salteada, `${nombre}: la transición se salteó`).toBe(false);
  expect.soft(vista.alcance, `${nombre}: el alcance`).toBe(movimiento.alcance);
  expect.soft(vista.tipos, `${nombre}: los tipos`).toEqual(movimiento.tipos);

  const fotos: Buffer[] = [];
  for (const fraccion of FRACCIONES) {
    await llevarA(page, fraccion);
    fotos.push(await capturar(page, zona));
  }
  await soltar(page);
  await esperarQueTermine(page);
  await movimiento.listo();
  await asentar(page);
  const despues = await capturar(page, zona);

  const proyecto = testInfo.project.name;
  guardarCaptura(proyecto, `${nombre}-0-antes`, antes);
  for (const [indice, fraccion] of FRACCIONES.entries()) {
    const foto = fotos[indice];
    if (foto) guardarCaptura(proyecto, `${nombre}-${String(fraccion * 100)}`, foto);
  }
  guardarCaptura(proyecto, `${nombre}-9-despues`, despues);

  const [cero] = fotos;
  const cien = fotos.at(-1);
  const alEmpezar = cero ? (await comparar(comparador, antes, cero)).proporcion : 1;
  const alTerminar = cien ? (await comparar(comparador, despues, cien)).proporcion : 1;
  expect
    .soft(alEmpezar, `${nombre}: al 0 % no es la pantalla de antes`)
    .toBeLessThanOrEqual(TOLERANCIA);
  expect
    .soft(alTerminar, `${nombre}: al 100 % no es la pantalla de después`)
    .toBeLessThanOrEqual(TOLERANCIA);
  return { vista, alEmpezar, alTerminar };
}

export async function sinTransicion(page: Page, hacer: () => Promise<void>): Promise<void> {
  await sinTransicionEnCurso(page);
  await olvidarLasTransiciones(page);
  await hacer();
  await page.waitForTimeout(600);
  expect(await transicionesVistas(page)).toEqual([]);
}
