import { expect, test, type Page } from '@playwright/test';

import { entrarConLaSesion } from '../apoyo/sesion';
import { iniciarSesionDePrueba, type SesionDePrueba } from '../apoyo/taller';
import { sembrarElTaller } from './datos';
import { sinTransicionEnCurso } from './espia';

const VUELTAS = 10;
const RALENTIZACION_DE_LA_CPU = 4;
const MEDIANA_BUSCADA_MS = 100;
const CUADRO_LARGO_MS = 50;
const CARGA = { timeout: 30_000 };

interface Medida {
  tipo: string;
  toque: number;
  lista: number;
  fin: number;
}

interface CuadroLargo {
  inicio: number;
  duracion: number;
}

interface Mediciones {
  ultimoToque: number;
  medidas: Medida[];
  cuadrosLargos: CuadroLargo[];
}

test.skip(!process.env.MEDIR_EL_RENDIMIENTO, 'Se mide a pedido: MEDIR_EL_RENDIMIENTO=1.');

let sesion: SesionDePrueba;

test.beforeAll(async () => {
  sesion = await iniciarSesionDePrueba();
  await sembrarElTaller(sesion);
});

test.beforeEach(async ({ context }) => {
  await entrarConLaSesion(context, sesion);
  await context.addInitScript(
    ({ cuadroLargo }) => {
      const ventana = window as unknown as Mediciones;
      ventana.ultimoToque = 0;
      ventana.medidas = [];
      ventana.cuadrosLargos = [];
      document.addEventListener(
        'click',
        (evento) => {
          ventana.ultimoToque = evento.timeStamp;
        },
        true,
      );
      new PerformanceObserver((lista) => {
        for (const entrada of lista.getEntries()) {
          if (entrada.duration > cuadroLargo) {
            ventana.cuadrosLargos.push({ inicio: entrada.startTime, duracion: entrada.duration });
          }
        }
      }).observe({ type: 'long-animation-frame', buffered: true });
      const envolver = (prototipo: object) => {
        const original: unknown = Reflect.get(prototipo, 'startViewTransition');
        if (typeof original !== 'function') return;
        Object.defineProperty(prototipo, 'startViewTransition', {
          configurable: true,
          writable: true,
          value: function (this: unknown, ...argumentos: unknown[]) {
            const transicion = Reflect.apply(original, this, argumentos) as ViewTransition;
            const medida: Medida = { tipo: '', toque: ventana.ultimoToque, lista: 0, fin: 0 };
            transicion.ready.then(
              () => {
                medida.tipo = [...transicion.types].join(',') || 'sin tipo';
                medida.lista = performance.now();
                ventana.medidas.push(medida);
              },
              () => undefined,
            );
            transicion.finished.then(
              () => {
                medida.fin = performance.now();
              },
              () => undefined,
            );
            return transicion;
          },
        });
      };
      envolver(Document.prototype);
      envolver(Element.prototype);
    },
    { cuadroLargo: CUADRO_LARGO_MS },
  );
});

function titulo(page: Page, texto: string) {
  return page.getByRole('heading', { level: 1, name: texto, exact: true });
}

function percentil(valores: number[], cuanto: number): number {
  const ordenados = [...valores].sort((una, otra) => una - otra);
  const indice = Math.min(ordenados.length - 1, Math.ceil((cuanto / 100) * ordenados.length) - 1);
  return ordenados[Math.max(0, indice)] ?? Number.NaN;
}

test('de tocar a que la transición arranca, con la CPU cuatro veces más lenta', async ({
  page,
}, testInfo) => {
  test.setTimeout(15 * 60_000);
  const barra = page.getByRole('navigation', { name: 'Principal' });
  await page.goto('/');
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RALENTIZACION_DE_LA_CPU });

  const tocar = async (hacer: () => Promise<void>) => {
    await hacer();
    await sinTransicionEnCurso(page);
    await page.waitForTimeout(150);
  };

  for (let vuelta = 0; vuelta < VUELTAS; vuelta += 1) {
    await tocar(() => barra.getByRole('button', { name: 'Clientes', exact: true }).click());
    await tocar(() => page.locator('main li button').first().click());
    await tocar(() => page.getByRole('link', { name: 'Clientes', exact: true }).click());
    await tocar(() => barra.getByRole('button', { name: 'Proyectos', exact: true }).click());
    await tocar(() => page.locator('a[data-tarjeta]').first().click());
    await tocar(() => page.getByRole('button', { name: 'Editar', exact: true }).first().click());
    await tocar(() => page.getByRole('button', { name: 'Cancelar' }).click());
    await tocar(() => page.getByRole('link', { name: 'Proyectos', exact: true }).click());
    await tocar(() => page.getByRole('tab', { name: /Historial/ }).click());
    await tocar(() => page.getByRole('tab', { name: /Activos/ }).click());
    await tocar(() => barra.getByRole('button', { name: 'Inicio', exact: true }).click());
  }

  const { medidas, cuadrosLargos } = await page.evaluate(() => {
    const ventana = window as unknown as Mediciones;
    return { medidas: ventana.medidas, cuadrosLargos: ventana.cuadrosLargos };
  });
  const porTipo = new Map<string, number[]>();
  for (const medida of medidas) {
    porTipo.set(medida.tipo, [...(porTipo.get(medida.tipo) ?? []), medida.lista - medida.toque]);
  }
  const resumen = [...porTipo.entries()].map(([tipo, demoras]) => ({
    tipo,
    veces: demoras.length,
    mediana: Math.round(percentil(demoras, 50)),
    p90: Math.round(percentil(demoras, 90)),
  }));
  const largos = (desde: (medida: Medida) => number, hasta: (medida: Medida) => number) =>
    medidas.flatMap((medida) =>
      cuadrosLargos
        .filter((cuadro) => cuadro.inicio >= desde(medida) && cuadro.inicio < hasta(medida))
        .map((cuadro) => ({ tipo: medida.tipo, duracion: Math.round(cuadro.duracion) })),
    );
  const informe = {
    cpu: `x${String(RALENTIZACION_DE_LA_CPU)}`,
    vueltas: VUELTAS,
    resumen,
    cuadrosLargosAntesDeArrancar: largos(
      (medida) => medida.toque,
      (medida) => medida.lista,
    ),
    cuadrosLargosDuranteLaAnimacion: largos(
      (medida) => medida.lista,
      (medida) => medida.fin,
    ),
  };
  console.log(JSON.stringify(informe, null, 2));
  await testInfo.attach('rendimiento.json', {
    body: JSON.stringify(informe, null, 2),
    contentType: 'application/json',
  });

  for (const { tipo, mediana } of resumen) {
    expect.soft(mediana, `mediana de ${tipo}`).toBeLessThan(MEDIANA_BUSCADA_MS);
  }
  expect
    .soft(informe.cuadrosLargosDuranteLaAnimacion, 'cuadros de más de 50 ms mientras se mueve')
    .toEqual([]);
});
