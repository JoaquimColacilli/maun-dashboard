import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { entrarConLaSesion } from '../apoyo/sesion';
import {
  crearCliente,
  encuestaPorRest,
  escribirAjustes,
  guardarProyectoPorRpc,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  leerAjustes,
  vaciarTaller,
  type AjustesDePrueba,
  type SesionDePrueba,
} from '../apoyo/taller';
import { PANTALLAS, type Pantalla } from './pantallas';
import {
  AJUSTES_COMPLETOS,
  cobrado,
  sembrarPocos,
  tokenDePrueba,
  type TallerSembrado,
} from './sembrar';

const CAPTURAS = process.env.CAPTURAS_DEL_REPARTO;
const CARGA = { timeout: 30_000 };
const ZONA = 'America/Argentina/Buenos_Aires';
const TOLERANCIA = 1;
const ALTO_MAXIMO_DE_CAPTURA = 16_000;

const TEMAS = [
  { nombre: 'claro', esquema: 'light' },
  { nombre: 'oscuro', esquema: 'dark' },
] as const;

type Tema = (typeof TEMAS)[number];

const VACIAS = [
  'inicio',
  'consultas',
  'seguimiento',
  'activos',
  'historial',
  'clientes',
  'finanzas',
  'opiniones',
  'agenda',
] as const;

const UN_SOLO_TITULO = new Set<string>([
  'consultas',
  'seguimiento',
  'activos',
  'historial',
  'clientes',
]);

const EN_CERO: Partial<AjustesDePrueba> = {
  sueldo_mensual_centavos: 0,
  costos_fijos_centavos: 0,
  meta_cocos_centavos: 0,
  tasa_cocos_anual_bp: 0,
};

const SIN_TALLER: TallerSembrado = {
  obra: '',
  entregado: '',
  contacto: '',
  enviado: '',
  enSeguimiento: '',
  cliente: '',
  enlace: '',
  encuesta: '',
};

const DESTINOS = [
  { etiqueta: 'Inicio', ruta: /\/$/ },
  { etiqueta: 'Proyectos', ruta: /\/proyectos$/ },
  { etiqueta: 'Clientes', ruta: /\/clientes$/ },
  { etiqueta: 'Finanzas', ruta: /\/finanzas$/ },
] as const;

const COBRADO_HOY = { indice: 20, gastos: 30_000_000 } as const;

let sesion: SesionDePrueba;

test.use({ actionTimeout: 30_000 });

test.beforeAll(async () => {
  sesion = await iniciarSesionDePrueba();
});

function pantalla(clave: string): Pantalla {
  const encontrada = PANTALLAS.find((una) => una.clave === clave);
  if (encontrada === undefined) throw new Error(`no hay una pantalla «${clave}»`);
  return encontrada;
}

function altoPara(ancho: number): number {
  if (ancho < 768) return 844;
  if (ancho < 1280) return 1024;
  return 900;
}

async function abrirContexto(
  browser: Browser,
  testInfo: TestInfo,
  {
    ancho,
    conSesion = true,
    movimiento = 'no-preference',
  }: { ancho: number; conSesion?: boolean; movimiento?: 'reduce' | 'no-preference' },
): Promise<BrowserContext> {
  const celular = ancho < 768;
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: ancho, height: altoPara(ancho) },
    deviceScaleFactor: celular ? 2 : 1,
    isMobile: celular,
    hasTouch: celular,
    reducedMotion: movimiento,
    timezoneId: ZONA,
  });
  if (conSesion) await entrarConLaSesion(context, sesion);
  return context;
}

async function asentar(page: Page): Promise<void> {
  await page.waitForTimeout(200);
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelector('main#contenido')?.scrollTo(0, 0);
    window.scrollTo(0, 0);
    await new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)));
  });
}

async function abrir(page: Page, una: Pantalla, taller: TallerSembrado): Promise<void> {
  await page.goto(una.ruta(taller));
  await una.listo(page);
  await asentar(page);
}

async function enElTema(page: Page, tema: Tema): Promise<void> {
  await page.emulateMedia({ colorScheme: tema.esquema });
  await asentar(page);
}

async function capturar(page: Page, caso: string, tema: Tema, clave: string): Promise<void> {
  if (CAPTURAS === undefined) return;
  const { width, height } = page.viewportSize() ?? { width: 1440, height: 900 };
  const archivo = path.join(CAPTURAS, 'rediseno', caso, tema.nombre, String(width), `${clave}.png`);
  const total = await page.evaluate(() => {
    if (document.querySelector('dialog[open]')) return window.innerHeight;
    const principal = document.querySelector('main#contenido');
    if (principal) return principal.scrollHeight + (window.innerHeight - principal.clientHeight);
    return document.documentElement.scrollHeight;
  });
  mkdirSync(path.dirname(archivo), { recursive: true });
  await page.setViewportSize({
    width,
    height: Math.min(Math.max(total, height), ALTO_MAXIMO_DE_CAPTURA),
  });
  await asentar(page);
  await page.screenshot({ path: archivo, animations: 'disabled' });
  await page.setViewportSize({ width, height });
  await asentar(page);
}

function laminasVisibles(page: Page): Promise<Locator[]> {
  return page.locator('[data-lamina]').filter({ visible: true }).all();
}

async function fallasDeLaLamina(
  page: Page,
  lamina: Locator,
  tema: Tema,
  donde: string,
): Promise<string[]> {
  const fallas: string[] = [];
  if ((await lamina.getAttribute('aria-hidden')) !== 'true') {
    fallas.push(`${donde}: la lámina no lleva aria-hidden="true"`);
  }
  if ((await lamina.locator('svg.ilustracion').count()) !== 1) {
    fallas.push(`${donde}: la lámina no tiene exactamente un dibujo`);
  }

  await lamina.evaluate((nodo) => {
    nodo.setAttribute('data-rediseno-lamina', '');
    (nodo.closest('[data-tarjeta-con-lamina], section') ?? document.body).setAttribute(
      'data-rediseno-marco',
      '',
    );
  });
  const marcada = page.locator('[data-rediseno-lamina]');
  const marco = page.locator('[data-rediseno-marco]');
  const conDibujo = await marco.ariaSnapshot();
  await marcada.evaluate((nodo) => {
    if (nodo instanceof HTMLElement) nodo.style.display = 'none';
  });
  const sinDibujo = await marco.ariaSnapshot();
  await marcada.evaluate((nodo) => {
    if (nodo instanceof HTMLElement) nodo.style.display = '';
    nodo.closest('[data-rediseno-marco]')?.removeAttribute('data-rediseno-marco');
  });
  if (conDibujo.trim() === '') fallas.push(`${donde}: la tarjeta de la lámina no se lee`);
  if (conDibujo !== sinDibujo) {
    fallas.push(`${donde}: el dibujo aparece en lo que lee el lector de pantalla`);
  }

  const medida = await marcada.evaluate((nodo, tolerancia) => {
    nodo.removeAttribute('data-rediseno-lamina');
    const caja = nodo.getBoundingClientRect();
    const choques: string[] = [];
    for (const elemento of document.body.querySelectorAll('*')) {
      if (nodo.contains(elemento) || elemento.contains(nodo)) continue;
      if (elemento.closest('[data-lo-que-flota-abajo]')) continue;
      const texto = [...elemento.childNodes]
        .filter((hijo) => hijo.nodeType === Node.TEXT_NODE)
        .map((hijo) => hijo.textContent ?? '')
        .join('')
        .trim();
      if (texto === '') continue;
      const estilo = getComputedStyle(elemento);
      if (estilo.visibility !== 'visible' || estilo.display === 'none') continue;
      const otra = elemento.getBoundingClientRect();
      if (otra.width <= 1 || otra.height <= 1) continue;
      const ancho = Math.min(caja.right, otra.right) - Math.max(caja.left, otra.left);
      const alto = Math.min(caja.bottom, otra.bottom) - Math.max(caja.top, otra.top);
      if (ancho > tolerancia && alto > tolerancia) choques.push(texto.slice(0, 48));
    }

    const raiz = document.documentElement;
    const principal = document.querySelector('main#contenido');
    const deCostado =
      raiz.scrollWidth > raiz.clientWidth ||
      (principal !== null && principal.scrollWidth > principal.clientWidth);

    const prueba = document.createElement('span');
    prueba.style.color = 'var(--color-ink)';
    document.body.append(prueba);
    const tinta = getComputedStyle(prueba).color;
    prueba.remove();
    const dibujo = nodo.querySelector('svg.ilustracion');
    const trazo = dibujo === null ? '' : getComputedStyle(dibujo).stroke;
    return { choques, deCostado, tinta, trazo };
  }, TOLERANCIA);

  for (const choque of medida.choques) {
    fallas.push(`${donde}: la lámina se cruza con «${choque}»`);
  }
  if (medida.deCostado) fallas.push(`${donde}: la pantalla scrollea de costado`);
  if (tema.esquema === 'dark') {
    const [rojo = 0] = medida.tinta.match(/\d+/g)?.map(Number) ?? [];
    if (medida.trazo !== medida.tinta || rojo < 128) {
      fallas.push(
        `${donde}: el trazo del dibujo es ${medida.trazo} y la tinta del oscuro es ${medida.tinta}`,
      );
    }
  }
  return fallas;
}

async function fallasDeLasLaminas(
  page: Page,
  tema: Tema,
  donde: string,
  esperadas: number,
): Promise<string[]> {
  const fallas: string[] = [];
  const laminas = await laminasVisibles(page);
  if (laminas.length !== esperadas) {
    fallas.push(`${donde}: hay ${String(laminas.length)} láminas y va ${String(esperadas)}`);
  }
  for (const lamina of laminas) fallas.push(...(await fallasDeLaLamina(page, lamina, tema, donde)));
  return fallas;
}

async function fallasDeLaMesa(page: Page, donde: string): Promise<string[]> {
  const { fondo, mesa } = await page.evaluate(() => {
    const principal = document.querySelector('main#contenido') ?? document.querySelector('main');
    let pintado: string | null = null;
    for (let nodo: Element | null = principal; nodo !== null; nodo = nodo.parentElement) {
      const color = getComputedStyle(nodo).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
        pintado = color;
        break;
      }
    }
    const prueba = document.createElement('span');
    prueba.style.backgroundColor = 'var(--color-mesa)';
    document.body.append(prueba);
    const color = getComputedStyle(prueba).backgroundColor;
    prueba.remove();
    return { fondo: pintado, mesa: color };
  });
  return fondo === mesa
    ? []
    : [`${donde}: debajo del main se pinta ${String(fondo)} y no la mesa (${mesa})`];
}

type EstadoDeLaPortada = 'sin-corte' | 'arranque' | 'corte';

async function fallasDeLaPortada(
  page: Page,
  estado: EstadoDeLaPortada,
  ancho: number,
  donde: string,
): Promise<string[]> {
  const fallas: string[] = [];
  const titulo = estado === 'arranque' ? 'El taller arranca acá' : /^El corte de \p{L}+$/u;
  const portada = page.getByRole('region', { name: titulo });
  if ((await portada.count()) !== 1) return [`${donde}: no está la portada «${String(titulo)}»`];

  const piezas = await portada.locator('[data-lamina] [data-pieza]').count();
  const manos = await portada.locator('[data-lamina] .mano').count();
  if (estado === 'corte') {
    if (piezas !== 4) fallas.push(`${donde}: el corte tiene ${String(piezas)} piezas y van 4`);
    const frase = await portada.locator('p').first().innerText();
    if (!frase.includes('al hogar')) fallas.push(`${donde}: la frase del corte dice «${frase}»`);
    if (ancho >= 1280) {
      const cota = (await portada.locator('.cota').allTextContents()).join(' ');
      if (!cota.includes('3.200.000')) fallas.push(`${donde}: la cota dice «${cota}»`);
    }
  } else if (piezas !== 0) {
    fallas.push(`${donde}: el tablero sin cortar tiene ${String(piezas)} piezas`);
  }
  if (estado === 'arranque') {
    if (manos !== 1) fallas.push(`${donde}: el arranque no tiene la marca de mano`);
    for (const nombre of ['Configurar sueldo y metas', 'Cargar el primer proyecto']) {
      const boton = portada.getByRole('button', { name: nombre });
      if ((await boton.count()) !== 1) {
        fallas.push(`${donde}: «${nombre}» no está adentro de la portada`);
        continue;
      }
      const antes = await boton.evaluate((nodo) => {
        const tesoros = document.querySelector('section[aria-label="Tesoros"]');
        return (
          tesoros !== null &&
          (nodo.compareDocumentPosition(tesoros) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        );
      });
      if (!antes) fallas.push(`${donde}: «${nombre}» no va antes de los tesoros en el DOM`);
    }
  } else if (manos !== 0) {
    fallas.push(`${donde}: la portada del corte tiene la marca de mano`);
  }
  return fallas;
}

interface Animacion {
  nombre: string;
  estado: string;
  duracion: number;
}

function animacionesDe(locator: Locator, nombre: string): Promise<Animacion[][]> {
  return locator.evaluateAll(
    (nodos, buscada) =>
      nodos.map((nodo) =>
        nodo
          .getAnimations()
          .filter(
            (animacion): animacion is CSSAnimation =>
              animacion instanceof CSSAnimation && animacion.animationName === buscada,
          )
          .map((animacion) => ({
            nombre: animacion.animationName,
            estado: animacion.playState,
            duracion: Number(animacion.effect?.getComputedTiming().duration ?? Number.NaN),
          })),
      ),
    nombre,
  );
}

async function volverAInicioPorLaBarra(page: Page): Promise<void> {
  const barra = page.getByRole('navigation', { name: 'Principal' });
  await barra.getByRole('button', { name: 'Proyectos' }).click();
  await expect(page).toHaveURL(/\/proyectos$/, CARGA);
  await expect(page.locator('main#contenido h1').first()).toBeVisible(CARGA);
  await barra.getByRole('button', { name: 'Inicio' }).click();
  await expect(page).toHaveURL(/\/$/, CARGA);
}

async function fallasDelMovimiento(
  browser: Browser,
  testInfo: TestInfo,
  estado: 'arranque' | 'corte',
): Promise<string[]> {
  const fallas: string[] = [];
  const titulo = estado === 'arranque' ? 'El taller arranca acá' : /^El corte de /;
  const selector = estado === 'arranque' ? '[data-lamina] .mano' : '[data-lamina] [data-pieza]';
  const nombre = estado === 'arranque' ? 'maun-trazo' : 'maun-corte';

  const normal = await abrirContexto(browser, testInfo, { ancho: 390 });
  const page = await normal.newPage();
  await page.goto('/');
  const portada = page.getByRole('region', { name: titulo });
  await expect(portada).toBeVisible(CARGA);
  const primera = await animacionesDe(portada.locator(selector), nombre);
  if (primera.length === 0) fallas.push(`${estado}: no hay nada que se mueva en la portada`);
  primera.forEach((animaciones, indice) => {
    const corriendo = animaciones.some(
      (una) => una.estado === 'running' || una.estado === 'finished',
    );
    if (!corriendo)
      fallas.push(`${estado}: la pieza ${String(indice)} no tiene ${nombre} la primera vez`);
  });

  await volverAInicioPorLaBarra(page);
  await expect(portada).toBeVisible(CARGA);
  const segunda = (await animacionesDe(portada.locator(selector), nombre)).flat();
  if (segunda.length > 0) {
    fallas.push(`${estado}: al volver a Inicio adentro de la app, ${nombre} se corre de nuevo`);
  }
  await normal.close();

  const quieto = await abrirContexto(browser, testInfo, { ancho: 390, movimiento: 'reduce' });
  const reducida = await quieto.newPage();
  await reducida.goto('/');
  const otraPortada = reducida.getByRole('region', { name: titulo });
  await expect(otraPortada).toBeVisible(CARGA);
  const conMenos = (await animacionesDe(otraPortada.locator(selector), nombre)).flat();
  if (conMenos.length === 0) {
    fallas.push(`${estado}: con menos movimiento no queda registro de ${nombre} para medir`);
  }
  for (const animacion of conMenos) {
    if (!(animacion.duracion <= 0.01)) {
      fallas.push(
        `${estado}: con menos movimiento ${nombre} dura ${String(animacion.duracion)} ms`,
      );
    }
  }
  await quieto.close();
  const medido = JSON.stringify({ primera, segunda, conMenos }, null, 2);
  writeFileSync(testInfo.outputPath(`movimiento-${estado}.json`), medido);
  await testInfo.attach(`movimiento-${estado}`, { body: medido, contentType: 'application/json' });
  return fallas;
}

test('con el taller vacío, cada pantalla vacía lleva una sola lámina con su dibujo, en los cuatro anchos y en los dos temas', async ({
  browser,
}, testInfo) => {
  test.setTimeout(900_000);
  const previos = await leerAjustes(sesion);
  const fallas: string[] = [];
  try {
    await vaciarTaller(sesion);
    await escribirAjustes(sesion, AJUSTES_COMPLETOS);
    for (const anchos of [
      [320, 390],
      [768, 1440],
    ] as const) {
      const context = await abrirContexto(browser, testInfo, { ancho: anchos[0] });
      const page = await context.newPage();
      for (const clave of VACIAS) {
        const una = pantalla(clave);
        await page.setViewportSize({ width: anchos[0], height: altoPara(anchos[0]) });
        await abrir(page, una, SIN_TALLER);
        for (const ancho of anchos) {
          await page.setViewportSize({ width: ancho, height: altoPara(ancho) });
          for (const tema of TEMAS) {
            await enElTema(page, tema);
            const donde = `vacío: ${una.nombre} a ${String(ancho)} en ${tema.nombre}`;
            const esperadas = clave === 'agenda' && ancho >= 768 ? 0 : 1;
            fallas.push(...(await fallasDeLasLaminas(page, tema, donde, esperadas)));
            if (clave === 'inicio') {
              fallas.push(...(await fallasDeLaPortada(page, 'sin-corte', ancho, donde)));
            }
            if (UN_SOLO_TITULO.has(clave)) {
              const titulos = await page
                .locator('main#contenido h2')
                .filter({ visible: true })
                .count();
              if (titulos !== 1) fallas.push(`${donde}: hay ${String(titulos)} h2 y va uno`);
            }
            await capturar(page, 'vacio', tema, clave);
          }
        }
      }
      await context.close();
    }
  } finally {
    await escribirAjustes(sesion, previos);
  }
  expect(fallas, fallas.join('\n')).toEqual([]);
});

test('en el arranque, la portada lleva su título, el tablero con la marca de mano y los dos botones antes de los tesoros, y la marca se traza una sola vez', async ({
  browser,
}, testInfo) => {
  test.setTimeout(600_000);
  const previos = await leerAjustes(sesion);
  const fallas: string[] = [];
  try {
    await vaciarTaller(sesion);
    await escribirAjustes(sesion, { ...AJUSTES_COMPLETOS, ...EN_CERO });
    for (const ancho of [390, 768, 1440]) {
      const context = await abrirContexto(browser, testInfo, { ancho });
      const page = await context.newPage();
      await abrir(page, pantalla('inicio'), SIN_TALLER);
      for (const tema of TEMAS) {
        await enElTema(page, tema);
        const donde = `arranque: Inicio a ${String(ancho)} en ${tema.nombre}`;
        fallas.push(...(await fallasDeLaPortada(page, 'arranque', ancho, donde)));
        fallas.push(...(await fallasDeLasLaminas(page, tema, donde, 1)));
        await capturar(page, 'arranque', tema, 'inicio');
      }
      await context.close();
    }
    fallas.push(...(await fallasDelMovimiento(browser, testInfo, 'arranque')));
  } finally {
    await escribirAjustes(sesion, previos);
  }
  expect(fallas, fallas.join('\n')).toEqual([]);
});

test.describe.serial('con pocos datos y un trabajo cobrado hoy', () => {
  let previos: AjustesDePrueba;
  let taller: TallerSembrado;
  let cobradoHoy: string;

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    previos = await leerAjustes(sesion);
    taller = await sembrarPocos(sesion);
    cobradoHoy = await cobrado(
      sesion,
      taller.cliente,
      COBRADO_HOY.indice,
      hoyEnElTaller(),
      COBRADO_HOY.gastos,
    );
  });

  test.afterAll(async () => {
    await escribirAjustes(sesion, previos);
  });

  test('Inicio abre con el corte del mes en cuatro piezas, y se corta una sola vez por sesión', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(600_000);
    const fallas: string[] = [];
    for (const ancho of [390, 768, 1440]) {
      const context = await abrirContexto(browser, testInfo, { ancho });
      const page = await context.newPage();
      await abrir(page, pantalla('inicio'), taller);
      for (const tema of TEMAS) {
        await enElTema(page, tema);
        const donde = `corte: Inicio a ${String(ancho)} en ${tema.nombre}`;
        fallas.push(...(await fallasDeLaPortada(page, 'corte', ancho, donde)));
        fallas.push(...(await fallasDeLasLaminas(page, tema, donde, 1)));
        await capturar(page, 'corte', tema, 'inicio');
      }
      await context.close();
    }
    fallas.push(...(await fallasDelMovimiento(browser, testInfo, 'corte')));
    expect(fallas, fallas.join('\n')).toEqual([]);
  });

  test('la distribución de la ganancia es el tablero: cortado con el canto de cada tesoro al cobrar, y de trazos en proyección', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(600_000);
    const fallas: string[] = [];
    for (const ancho of [390, 1440]) {
      const context = await abrirContexto(browser, testInfo, { ancho });
      const page = await context.newPage();
      for (const { clave, id, proyectado } of [
        { clave: 'cobrado', id: cobradoHoy, proyectado: false },
        { clave: 'en-curso', id: taller.obra, proyectado: true },
      ]) {
        await page.goto(`/proyectos/${id}`);
        await pantalla('obra').listo(page);
        await asentar(page);
        const lamina = page
          .getByRole('region', { name: 'Distribución de la ganancia' })
          .locator('[data-lamina]');
        await expect(lamina).toHaveCount(1, CARGA);
        const piezas = lamina.locator('[data-pieza]');
        const ids = await piezas.evaluateAll((nodos) =>
          nodos.map((nodo) => nodo.getAttribute('data-pieza') ?? ''),
        );
        const trazos = await lamina.locator('rect.trazos').count();
        const pintadas = await lamina.locator('.hogar, .maun, .diezmo, .cocos').count();
        const donde = `despiece ${clave} a ${String(ancho)}`;
        if (proyectado) {
          if (trazos === 0) fallas.push(`${donde}: en proyección no hay piezas de trazos`);
          if (pintadas > 0)
            fallas.push(`${donde}: en proyección hay ${String(pintadas)} tesoros pintados`);
          const fuera = await lamina.evaluate((nodo) => {
            nodo.scrollIntoView({ block: 'center', behavior: 'instant' });
            return [...nodo.querySelectorAll('[data-pieza]')]
              .filter((pieza) => {
                const caja = pieza.getBoundingClientRect();
                const tocado = document.elementFromPoint(
                  caja.left + caja.width / 2,
                  caja.top + caja.height / 2,
                );
                return tocado === null || !pieza.contains(tocado);
              })
              .map((pieza) => pieza.getAttribute('data-pieza') ?? '');
          });
          for (const pieza of fuera) {
            fallas.push(`${donde}: el centro de la pieza «${pieza}» no cae en la pieza`);
          }
        } else {
          const esperadas = ['diezmo', 'fijos', 'remanente', 'sueldo'];
          if ([...ids].sort().join() !== esperadas.join()) {
            fallas.push(`${donde}: las piezas son ${ids.join(', ')}`);
          }
          if (trazos > 0) fallas.push(`${donde}: cobrado y con piezas de trazos`);
          for (const id of ids) {
            const canto = await lamina
              .locator(`[data-pieza="${id}"]`)
              .locator('.hogar, .maun, .diezmo')
              .count();
            if (canto === 0)
              fallas.push(`${donde}: la pieza «${id}» no tiene el canto de su tesoro`);
          }
        }
        for (const tema of TEMAS) {
          await enElTema(page, tema);
          const conTema = `${donde} en ${tema.nombre}`;
          fallas.push(...(await fallasDeLasLaminas(page, tema, conTema, 1)));
          await capturar(page, 'despiece', tema, clave);
        }
        await page.emulateMedia({ colorScheme: 'light' });
      }
      await context.close();
    }
    expect(fallas, fallas.join('\n')).toEqual([]);
  });

  test('las páginas de afuera llevan su lámina: la del cliente, los enlaces muertos, los avisos sin señal y con error, y Gracias', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(600_000);
    const fallas: string[] = [];
    const clienteId = await crearCliente(sesion, 'Marcela Duarte', { telefono: '11 5523 4410' });

    for (const ancho of [320, 390, 1440]) {
      const context = await abrirContexto(browser, testInfo, { ancho, conSesion: false });
      const page = await context.newPage();
      for (const { clave, ruta } of [
        { clave: 'vista', ruta: `/v/${taller.enlace}` },
        { clave: 'vista-muerta', ruta: '/v/no-sirve' },
        { clave: 'encuesta-muerta', ruta: '/o/no-sirve' },
      ]) {
        await page.goto(ruta);
        if (clave === 'vista') {
          await expect(page.getByRole('region', { name: 'Tu mueble' })).toBeVisible(CARGA);
        } else {
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            'Este enlace ya no funciona',
            CARGA,
          );
        }
        await asentar(page);
        for (const tema of TEMAS) {
          await enElTema(page, tema);
          const donde = `afuera: ${ruta} a ${String(ancho)} en ${tema.nombre}`;
          fallas.push(...(await fallasDeLasLaminas(page, tema, donde, 1)));
          fallas.push(...(await fallasDeLaMesa(page, donde)));
          await capturar(page, 'afuera', tema, clave);
        }
        await page.emulateMedia({ colorScheme: 'light' });
      }
      await context.close();
    }

    for (const ancho of [390, 1440]) {
      const sinSenal = await abrirContexto(browser, testInfo, { ancho, conSesion: false });
      const cortada = await sinSenal.newPage();
      let soltar = (): void => undefined;
      const retenida = new Promise<void>((resolver) => {
        soltar = resolver;
      });
      let primera = true;
      await cortada.route('**/rest/v1/rpc/vista_compartida', async (ruta) => {
        if (!primera) {
          await ruta.continue();
          return;
        }
        primera = false;
        await retenida;
        await ruta.abort('internetdisconnected');
      });
      await cortada.goto(`/v/${taller.enlace}`);
      await expect(cortada.getByText('Abriendo tu mueble')).toBeAttached(CARGA);
      await sinSenal.setOffline(true);
      soltar();
      await expect(cortada.getByRole('heading', { level: 1 })).toHaveText('Sin conexión', CARGA);
      await asentar(cortada);
      for (const tema of TEMAS) {
        await enElTema(cortada, tema);
        const donde = `afuera: /v/ sin señal a ${String(ancho)} en ${tema.nombre}`;
        fallas.push(...(await fallasDeLasLaminas(cortada, tema, donde, 1)));
        await capturar(cortada, 'afuera', tema, 'vista-sin-senal');
      }
      await sinSenal.close();

      const conError = await abrirContexto(browser, testInfo, { ancho, conSesion: false });
      const fallida = await conError.newPage();
      await fallida.route('**/rest/v1/rpc/vista_compartida', (ruta) =>
        ruta.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: '23514', message: 'e2e', details: null, hint: null }),
        }),
      );
      await fallida.goto(`/v/${taller.enlace}`);
      await expect(fallida.getByRole('heading', { level: 1 })).toHaveText(
        'No pudimos cargar tu mueble',
        CARGA,
      );
      await asentar(fallida);
      for (const tema of TEMAS) {
        await enElTema(fallida, tema);
        const donde = `afuera: /v/ con error a ${String(ancho)} en ${tema.nombre}`;
        fallas.push(...(await fallasDeLasLaminas(fallida, tema, donde, 1)));
        await capturar(fallida, 'afuera', tema, 'vista-con-error');
      }
      await conError.close();

      const conEncuesta = crypto.randomUUID();
      await guardarProyectoPorRpc(sesion, {
        proyecto: {
          id: conEncuesta,
          version: null,
          cliente_id: clienteId,
          titulo: 'Placard 3 puertas con interior en melamina',
          estado: 'entregado',
          presupuesto_centavos: 100_000_000,
          comprobante: 'sin_comprobante',
        },
        pagos: [],
        gastos: [],
      });
      const token = tokenDePrueba();
      await encuestaPorRest(sesion, conEncuesta, token);
      const cliente = await abrirContexto(browser, testInfo, { ancho, conSesion: false });
      const encuesta = await cliente.newPage();
      await encuesta.goto(`/o/${token}`);
      await expect(encuesta.getByRole('button', { name: 'Mandar mi opinión' })).toBeVisible(CARGA);
      for (const opcion of ['Muy conforme', 'A tiempo', 'Sí, sin dudarlo']) {
        const radio = encuesta.getByRole('radio', { name: opcion, exact: true });
        await encuesta.locator('label').filter({ has: radio }).click();
        await expect(radio).toBeChecked();
      }
      await encuesta.getByRole('button', { name: 'Mandar mi opinión' }).click();
      await expect(encuesta.getByRole('heading', { level: 1 })).toHaveText(
        'Gracias, Marcela',
        CARGA,
      );
      await asentar(encuesta);
      for (const tema of TEMAS) {
        await enElTema(encuesta, tema);
        const donde = `afuera: Gracias a ${String(ancho)} en ${tema.nombre}`;
        fallas.push(...(await fallasDeLasLaminas(encuesta, tema, donde, 1)));
        await capturar(encuesta, 'afuera', tema, 'gracias');
      }
      await cliente.close();

      const sinDatos = await abrirContexto(browser, testInfo, { ancho });
      const rota = await sinDatos.newPage();
      await rota.route('**/rest/v1/**', (ruta) =>
        ruta.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: '23514', message: 'e2e', details: null, hint: null }),
        }),
      );
      await rota.goto('/');
      await expect(rota.getByRole('heading', { level: 1 })).toHaveText(
        'No pudimos leer tus datos',
        CARGA,
      );
      await asentar(rota);
      for (const tema of TEMAS) {
        await enElTema(rota, tema);
        const donde = `el error de carga a ${String(ancho)} en ${tema.nombre}`;
        fallas.push(...(await fallasDeLasLaminas(rota, tema, donde, 1)));
        await capturar(rota, 'afuera', tema, 'error-de-carga');
      }
      await sinDatos.close();
    }
    expect(fallas, fallas.join('\n')).toEqual([]);
  });

  test('la barra del celular queda como estaba: cuatro destinos y el + en el medio, sin pisarse, con cada etiqueta adentro de su cápsula', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(300_000);
    const fallas: string[] = [];
    const medidas: object[] = [];
    const context = await abrirContexto(browser, testInfo, { ancho: 390 });
    const page = await context.newPage();
    for (const ancho of [320, 360, 390]) {
      await page.setViewportSize({ width: ancho, height: 844 });
      await abrir(page, pantalla('activos'), taller);
      const barra = page.getByRole('navigation', { name: 'Principal' });
      for (const destino of DESTINOS) {
        await barra.getByRole('button', { name: destino.etiqueta }).click();
        await expect(page).toHaveURL(destino.ruta, CARGA);
        await expect(barra.getByRole('button', { name: destino.etiqueta })).toHaveAttribute(
          'aria-current',
          'page',
          CARGA,
        );
        await asentar(page);
        const medida = await barra.evaluate((nav, activa) => {
          const caja = (elemento: Element) => elemento.getBoundingClientRect();
          const pildora = nav.firstElementChild;
          const botones = [...nav.querySelectorAll('button')];
          const nombres = botones.map(
            (boton) => boton.getAttribute('aria-label') ?? boton.textContent.trim(),
          );
          const destinos = botones.slice(0, 4);
          const mas = botones[4];
          if (pildora === null || mas === undefined) return null;
          const borde = caja(pildora);
          const deMas = caja(mas);
          const seCruzan = (una: DOMRect, otra: DOMRect) =>
            Math.min(una.right, otra.right) - Math.max(una.left, otra.left) > 0 &&
            Math.min(una.bottom, otra.bottom) - Math.max(una.top, otra.top) > 0;
          const adentro = (chica: DOMRect, grande: DOMRect) =>
            chica.left >= grande.left - 0.5 &&
            chica.right <= grande.right + 0.5 &&
            chica.top >= grande.top - 0.5 &&
            chica.bottom <= grande.bottom + 0.5;
          const activo = destinos.find((boton) => boton.textContent.trim() === activa);
          const texto =
            activo === undefined
              ? undefined
              : [...activo.childNodes].find(
                  (hijo) =>
                    hijo.nodeType === Node.TEXT_NODE && (hijo.textContent ?? '').trim() !== '',
                );
          let etiquetaAdentro = false;
          let anchoDeLaEtiqueta = 0;
          if (activo !== undefined && texto !== undefined) {
            const rango = document.createRange();
            rango.selectNodeContents(texto);
            anchoDeLaEtiqueta = rango.getBoundingClientRect().width;
            etiquetaAdentro = adentro(rango.getBoundingClientRect(), caja(activo));
          }
          return {
            nombres,
            anchos: destinos.map((boton) => caja(boton).width),
            anchoDeLaEtiqueta,
            masSobreLaPildora: borde.top - deMas.top,
            corrido: Math.abs(deMas.left + deMas.width / 2 - (borde.left + borde.width / 2)),
            pisados: destinos
              .filter((boton) => seCruzan(caja(boton), deMas))
              .map((boton) => boton.textContent.trim()),
            afuera: destinos
              .filter((boton) => !adentro(caja(boton), borde))
              .map((boton) => boton.textContent.trim()),
            etiquetaAdentro,
            sinToque: botones
              .filter((boton) => {
                const suya = caja(boton);
                const tocado = document.elementFromPoint(
                  suya.left + suya.width / 2,
                  suya.top + suya.height / 2,
                );
                return tocado === null || !boton.contains(tocado);
              })
              .map((boton) => boton.getAttribute('aria-label') ?? boton.textContent.trim()),
          };
        }, destino.etiqueta);
        const donde = `la barra a ${String(ancho)} con ${destino.etiqueta}`;
        medidas.push({ ancho, activo: destino.etiqueta, ...medida });
        if (medida === null) {
          fallas.push(`${donde}: no se encontró la píldora o el +`);
          continue;
        }
        const esperados = [...DESTINOS.map((uno) => uno.etiqueta), 'Cargar algo nuevo'];
        if (medida.nombres.join() !== esperados.join()) {
          fallas.push(`${donde}: los botones son ${medida.nombres.join(', ')}`);
        }
        if (medida.corrido > TOLERANCIA) {
          fallas.push(`${donde}: el + está corrido ${medida.corrido.toFixed(1)} px del medio`);
        }
        for (const pisado of medida.pisados) fallas.push(`${donde}: el + pisa «${pisado}»`);
        for (const suelto of medida.afuera) {
          fallas.push(`${donde}: la cápsula de «${suelto}» se sale de la píldora`);
        }
        if (!medida.etiquetaAdentro) {
          fallas.push(`${donde}: «${destino.etiqueta}» no entra en su cápsula`);
        }
        for (const boton of medida.sinToque) {
          fallas.push(`${donde}: el centro de «${boton}» no toca su botón`);
        }
      }
    }
    await context.close();
    writeFileSync(testInfo.outputPath('barra.json'), JSON.stringify(medidas, null, 2));
    expect(fallas, fallas.join('\n')).toEqual([]);
  });

  test('ninguna pantalla lleva más de una lámina, todas se apoyan en la mesa y las tarjetas son de papel', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(1_200_000);
    const fallas: string[] = [];
    for (const ancho of [390, 1440]) {
      const context = await abrirContexto(browser, testInfo, { ancho });
      const anonimo = await abrirContexto(browser, testInfo, { ancho, conSesion: false });
      const conSesion = await context.newPage();
      for (const una of PANTALLAS) {
        const page = una.sinSesion ? await anonimo.newPage() : conSesion;
        await abrir(page, una, taller);
        for (const tema of TEMAS) {
          await enElTema(page, tema);
          const donde = `${una.nombre} a ${String(ancho)} en ${tema.nombre}`;
          const conteo = await page.evaluate(() => ({
            laminas: document.querySelectorAll('[data-lamina]').length,
            sueltos: [...document.querySelectorAll('svg.ilustracion')].filter(
              (dibujo) => dibujo.closest('[data-lamina]') === null,
            ).length,
          }));
          if (conteo.laminas > 1) fallas.push(`${donde}: hay ${String(conteo.laminas)} láminas`);
          if (conteo.sueltos > 0) {
            fallas.push(`${donde}: hay ${String(conteo.sueltos)} dibujos afuera de una lámina`);
          }
          for (const lamina of await laminasVisibles(page)) {
            fallas.push(...(await fallasDeLaLamina(page, lamina, tema, donde)));
          }
          fallas.push(...(await fallasDeLaMesa(page, donde)));
          if (una.clave === 'activos' && ancho === 390) {
            const tarjeta = await page
              .locator('[data-origen-de]')
              .first()
              .evaluate((nodo) => {
                const prueba = document.createElement('span');
                prueba.style.backgroundColor = 'var(--color-paper)';
                document.body.append(prueba);
                const papel = getComputedStyle(prueba).backgroundColor;
                prueba.remove();
                const estilo = getComputedStyle(nodo);
                return { fondo: estilo.backgroundColor, radio: estilo.borderTopLeftRadius, papel };
              });
            if (tarjeta.fondo !== tarjeta.papel || tarjeta.radio !== '20px') {
              fallas.push(
                `${donde}: la primera tarjeta tiene fondo ${tarjeta.fondo} y radio ${tarjeta.radio}`,
              );
            }
          }
          await capturar(page, 'pantallas', tema, una.clave);
        }
        await page.emulateMedia({ colorScheme: 'light' });
        if (una.sinSesion) await page.close();
      }
      await context.close();
      await anonimo.close();
    }
    expect(fallas, fallas.join('\n')).toEqual([]);
  });
});
