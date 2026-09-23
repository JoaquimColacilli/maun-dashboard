import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { devices, expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

import { entrarConLaSesion } from '../apoyo/sesion';
import {
  escribirAjustes,
  iniciarSesionDePrueba,
  leerAjustes,
  type SesionDePrueba,
} from '../apoyo/taller';
import { medirElReparto, type Medicion } from './medicion';
import { EXCEPCIONES, PANTALLAS, type Pantalla } from './pantallas';
import { sembrarMuchos, sembrarPocos, type TallerSembrado } from './sembrar';

const ANCHOS = [
  { ancho: 768, alto: 1024 },
  { ancho: 1024, alto: 768 },
  { ancho: 1280, alto: 800 },
  { ancho: 1440, alto: 900 },
  { ancho: 1920, alto: 1080 },
  { ancho: 2560, alto: 1440 },
] as const;

const PANTALLAS_DE_HUECO = 0.5;
const ANCHO_DEL_MARCO = 1180;
const TOLERANCIA = 1.5;
const HASTA_EL_BORDE = 64;
const ALTO_MAXIMO_DE_CAPTURA = 16_000;
const CAPTURAS = process.env.CAPTURAS_DEL_REPARTO;

let sesion: SesionDePrueba;

test.beforeAll(async () => {
  sesion = await iniciarSesionDePrueba();
});

async function asentar(page: Page): Promise<void> {
  await page.waitForTimeout(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelector('main#contenido')?.scrollTo(0, 0);
    window.scrollTo(0, 0);
    await new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)));
  });
}

async function abrir(page: Page, pantalla: Pantalla, taller: TallerSembrado): Promise<void> {
  await page.goto(pantalla.ruta(taller));
  await pantalla.listo(page);
  await asentar(page);
}

async function capturarEntera(
  page: Page,
  archivo: string,
  ancho: number,
  alto: number,
): Promise<void> {
  const total = await page.evaluate(() => {
    if (document.querySelector('dialog[open]')) return window.innerHeight;
    const principal = document.querySelector('main#contenido');
    if (principal) return principal.scrollHeight + (window.innerHeight - principal.clientHeight);
    return document.documentElement.scrollHeight;
  });
  mkdirSync(path.dirname(archivo), { recursive: true });
  await page.setViewportSize({
    width: ancho,
    height: Math.min(Math.max(total, alto), ALTO_MAXIMO_DE_CAPTURA),
  });
  await asentar(page);
  await page.screenshot({ path: archivo, animations: 'disabled' });
  await page.setViewportSize({ width: ancho, height: alto });
  await asentar(page);
}

function fallasDelMarco(pantalla: Pantalla, donde: string, medicion: Medicion): string[] {
  if (pantalla.sinMarco !== undefined) return [];
  const { marco } = medicion;
  if (marco === null) return [`${donde}: no está adentro del molde de la página`];
  const fallas: string[] = [];
  const izquierda = marco.marco.izquierda - marco.area.izquierda;
  const derecha = marco.area.derecha - marco.marco.derecha;
  if (Math.abs(izquierda - derecha) > TOLERANCIA) {
    fallas.push(
      `${donde}: no está centrada, con ${izquierda.toFixed(0)} px a la izquierda y ${derecha.toFixed(0)} a la derecha`,
    );
  }
  const esperado = Math.min(ANCHO_DEL_MARCO, marco.area.util);
  const ancho = marco.marco.derecha - marco.marco.izquierda;
  if (Math.abs(ancho - esperado) > TOLERANCIA) {
    fallas.push(
      `${donde}: el molde mide ${ancho.toFixed(0)} px y en ese ancho todas miden ${esperado.toFixed(0)}`,
    );
  }
  const vacio = marco.tinta === null ? Infinity : marco.contenido.derecha - marco.tinta.derecha;
  if (vacio > HASTA_EL_BORDE) {
    fallas.push(
      `${donde}: el contenido termina ${vacio.toFixed(0)} px antes del borde derecho del molde`,
    );
  }
  return fallas;
}

function fallasDe(pantalla: Pantalla, ancho: number, medicion: Medicion): string[] {
  const donde = `${pantalla.nombre} a ${String(ancho)} px`;
  const fallas: string[] = [];
  const peor = medicion.huecos.find((hueco) => hueco.exento === null);
  if (peor && peor.hueco > medicion.visible * PANTALLAS_DE_HUECO) {
    fallas.push(
      `${donde}: hueco de ${String(peor.hueco)} px (${(peor.hueco / medicion.visible).toFixed(2)} pantallas) en ${peor.contenedor}`,
    );
  }
  fallas.push(...fallasDelMarco(pantalla, donde, medicion));
  for (const desorden of medicion.desorden.filter((cual) => cual.exento === null)) {
    fallas.push(
      `${donde}: en ${desorden.contenedor}, «${desorden.despues}» se ve antes que «${desorden.antes}», que va primero en el DOM`,
    );
  }
  return fallas;
}

async function recorrer(
  browser: Browser,
  page: Page,
  taller: TallerSembrado,
  datos: string,
  testInfo: TestInfo,
): Promise<string[]> {
  const fallas: string[] = [];
  const medidas: Record<string, Record<string, Medicion>> = {};
  const baseURL = testInfo.project.use.baseURL;
  const anonimo = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });

  for (const [indice, pantalla] of PANTALLAS.entries()) {
    const pagina = pantalla.sinSesion ? await anonimo.newPage() : page;
    await pagina.setViewportSize({ width: 1440, height: 900 });
    await abrir(pagina, pantalla, taller);
    const porAncho: Record<string, Medicion> = {};
    for (const { ancho, alto } of ANCHOS) {
      await pagina.setViewportSize({ width: ancho, height: alto });
      await asentar(pagina);
      const medicion = await pagina.evaluate(medirElReparto, EXCEPCIONES);
      porAncho[String(ancho)] = medicion;
      fallas.push(...fallasDe(pantalla, ancho, medicion));
      if (CAPTURAS !== undefined) {
        const numero = String(indice + 1).padStart(2, '0');
        await capturarEntera(
          pagina,
          path.join(CAPTURAS, datos, String(ancho), `${numero}-${pantalla.clave}.png`),
          ancho,
          alto,
        );
      }
    }
    medidas[pantalla.clave] = porAncho;
    if (pantalla.sinSesion) await pagina.close();
  }
  await anonimo.close();

  const informe = JSON.stringify(medidas, null, 2);
  writeFileSync(testInfo.outputPath(`reparto-${datos}.json`), informe);
  await testInfo.attach(`reparto-${datos}`, { body: informe, contentType: 'application/json' });
  if (CAPTURAS !== undefined) {
    mkdirSync(path.join(CAPTURAS, datos), { recursive: true });
    writeFileSync(path.join(CAPTURAS, datos, 'medidas.json'), informe);
  }
  return fallas;
}

async function capturarEnElCelular(
  browser: Browser,
  taller: TallerSembrado,
  datos: string,
  testInfo: TestInfo,
): Promise<void> {
  if (CAPTURAS === undefined) return;
  const celular = await browser.newContext({
    ...devices['Desktop Chrome'],
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await entrarConLaSesion(celular, sesion);
  const page = await celular.newPage();
  for (const [indice, pantalla] of PANTALLAS.entries()) {
    if (pantalla.sinSesion) continue;
    await abrir(page, pantalla, taller);
    const numero = String(indice + 1).padStart(2, '0');
    await capturarEntera(
      page,
      path.join(CAPTURAS, datos, '390', `${numero}-${pantalla.clave}.png`),
      390,
      844,
    );
  }
  await celular.close();
}

const DATOS = [
  { nombre: 'pocos', sembrar: sembrarPocos },
  { nombre: 'muchos', sembrar: sembrarMuchos },
] as const;

for (const { nombre, sembrar } of DATOS) {
  test(`con ${nombre} datos, ninguna pantalla de la tablet o la compu deja un hueco, se sale del molde común ni cambia el orden del DOM`, async ({
    browser,
    context,
    page,
  }, testInfo) => {
    test.setTimeout(900_000);
    const previos = await leerAjustes(sesion);
    try {
      const taller = await sembrar(sesion);
      await entrarConLaSesion(context, sesion);
      const fallas = await recorrer(browser, page, taller, nombre, testInfo);
      await capturarEnElCelular(browser, taller, nombre, testInfo);
      expect(fallas, fallas.join('\n')).toEqual([]);
    } finally {
      await escribirAjustes(sesion, previos);
    }
  });
}
