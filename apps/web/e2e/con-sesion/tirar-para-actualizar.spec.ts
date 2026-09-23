import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  activarBloqueoEnElDispositivo,
  alFrente,
  aSegundoPlano,
  contarPedidosDeHuella,
  huellaQueVerifica,
  pedidosDeHuella,
  registrarHuellaEnElTelefono,
  telefonoConHuella,
  usuarioDeLaSesion,
  visibilidadControlable,
} from '../apoyo/huella';
import { apoyar, dedo, levantar, mover, tirarYSoltar } from '../apoyo/dedo';
import { indicadorDeSync, listoParaCortar } from '../apoyo/pantalla';
import {
  ajustarTaller,
  contarClientes,
  crearCliente,
  iniciarSesionDePrueba,
  vaciarTaller,
} from '../apoyo/taller';

test.skip(({ isMobile }) => !isMobile, 'el gesto es solo del celular');

const UMBRAL = 64;
const ALTO_DEL_INDICADOR = 40;
const ARRIBA = 260;
const ANTES_DEL_UMBRAL = ARRIBA + 110;
const PASADO_EL_UMBRAL = ARRIBA + 180;
const CARGA_DEL_TALLER = { timeout: 30_000 };

type Registro = [number, string][];

interface VentanaDePrueba {
  estadosDelTiron?: Registro;
  sinRecargar?: boolean;
  callarLaSenal?: boolean;
}

interface Pedidos {
  sincronizaciones: number;
  documentos: number;
}

function indicador(page: Page): Locator {
  return page.locator('[data-tirar-para-actualizar]');
}

function contarPedidos(page: Page): Pedidos {
  const pedidos: Pedidos = { sincronizaciones: 0, documentos: 0 };
  page.on('request', (pedido) => {
    if (pedido.resourceType() === 'document') pedidos.documentos += 1;
    if (/\/rest\/v1\/rpc\/(delta|bootstrap)/.test(pedido.url())) pedidos.sincronizaciones += 1;
  });
  return pedidos;
}

async function anotarEstados(page: Page): Promise<void> {
  await page.evaluate(() => {
    const ventana = window as unknown as VentanaDePrueba;
    const leer = () =>
      document
        .querySelector('[data-tirar-para-actualizar]')
        ?.getAttribute('data-tirar-para-actualizar') ?? 'nada';
    const yaMiraba = ventana.estadosDelTiron !== undefined;
    ventana.sinRecargar = true;
    ventana.estadosDelTiron = [[performance.now(), leer()]];
    if (yaMiraba) return;
    new MutationObserver(() => {
      const registro = ventana.estadosDelTiron ?? [];
      const valor = leer();
      if (registro.at(-1)?.[1] !== valor) registro.push([performance.now(), valor]);
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-tirar-para-actualizar'],
    });
  });
}

function estadosDelTiron(page: Page): Promise<Registro> {
  return page.evaluate(() => (window as unknown as VentanaDePrueba).estadosDelTiron ?? []);
}

async function soloEstados(page: Page): Promise<string[]> {
  return (await estadosDelTiron(page)).map(([, estado]) => estado);
}

function sigueSinRecargar(page: Page): Promise<boolean | undefined> {
  return page.evaluate(() => (window as unknown as VentanaDePrueba).sinRecargar);
}

function scrollDelPrincipal(page: Page): Promise<number> {
  return page.getByRole('main').evaluate((principal) => Math.round(principal.scrollTop));
}

async function demorarLaSincronizacion(page: Page, ms: number): Promise<void> {
  await page.route('**/rest/v1/rpc/delta*', async (ruta) => {
    await new Promise((resolver) => setTimeout(resolver, ms));
    await ruta.continue();
  });
}

async function sinTransicionEnCurso(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !(document as unknown as { activeViewTransition?: unknown }).activeViewTransition,
  );
}

async function tallerCargado(page: Page): Promise<void> {
  await expect(page.getByRole('main')).toBeVisible(CARGA_DEL_TALLER);
  await expect(
    page.getByRole('status').filter({ hasText: /Abriendo la app|Trayendo los datos/ }),
  ).toHaveCount(0, CARGA_DEL_TALLER);
}

const CANAL_DE_AVISOS = /\/realtime\/v1\/websocket/;

test.beforeEach(async ({ context }) => {
  await context.routeWebSocket(CANAL_DE_AVISOS, (canal) => {
    void canal.close();
  });
  await vaciarTaller(await iniciarSesionDePrueba());
});

test('soltar antes del umbral vuelve sin sincronizar, y tirar y volver no mueve el contenido', async ({
  page,
}) => {
  await page.goto('/');
  await listoParaCortar(page);
  const pedidos = contarPedidos(page);
  const cdp = await dedo(page);

  await apoyar(cdp, ARRIBA);
  await mover(cdp, ARRIBA, ANTES_DEL_UMBRAL);
  await expect(indicador(page)).toHaveAttribute('data-tirar-para-actualizar', 'tirando');
  await expect(indicador(page)).toContainText('Tirá para actualizar');
  await mover(cdp, ANTES_DEL_UMBRAL, ARRIBA + 30);
  await levantar(cdp);

  await expect(indicador(page)).toHaveCount(0);
  expect(await scrollDelPrincipal(page)).toBe(0);
  expect(pedidos).toEqual({ sincronizaciones: 0, documentos: 0 });
});

test('pasado el umbral sincroniza sin recargar: trae lo que cambió en la base y el indicador se ve al menos medio segundo', async ({
  page,
}) => {
  const sesion = await iniciarSesionDePrueba();
  await page.goto('/clientes');
  await expect(page.getByRole('button', { name: 'Cargá tu primer cliente' })).toBeVisible(
    CARGA_DEL_TALLER,
  );
  await listoParaCortar(page);
  await crearCliente(sesion, 'Llegó por otro lado');
  await anotarEstados(page);
  const pedidos = contarPedidos(page);
  const cdp = await dedo(page);

  await apoyar(cdp, ARRIBA);
  await mover(cdp, ARRIBA, PASADO_EL_UMBRAL);
  await expect(indicador(page)).toHaveAttribute('data-tirar-para-actualizar', 'listo-para-soltar');
  await expect(indicador(page)).toContainText('Soltá para actualizar');
  await expect(page.getByRole('button', { name: /Llegó por otro lado/ })).toHaveCount(0);
  await levantar(cdp);

  await expect(page.getByRole('button', { name: /Llegó por otro lado/ })).toBeVisible();
  await expect(indicador(page)).toContainText('Todo sincronizado.');
  await expect(indicador(page)).toHaveCount(0, { timeout: 5_000 });

  const registro = await estadosDelTiron(page);
  const desde = registro.find(([, estado]) => estado === 'sincronizando')?.[0];
  const hasta = registro.find(
    ([cuando, estado]) => desde !== undefined && cuando > desde && estado !== 'sincronizando',
  )?.[0];
  if (desde === undefined || hasta === undefined) {
    throw new Error(`no se vio sincronizando: ${JSON.stringify(registro)}`);
  }
  console.log(`sincronizando se vio ${String(Math.round(hasta - desde))} ms`);
  expect(hasta - desde).toBeGreaterThanOrEqual(490);
  expect(registro.map(([, estado]) => estado)).toEqual([
    'nada',
    'tirando',
    'listo-para-soltar',
    'sincronizando',
    'desenlace',
    'nada',
  ]);
  expect(pedidos.sincronizaciones).toBeGreaterThan(0);
  expect(pedidos.documentos).toBe(0);
  expect(await sigueSinRecargar(page)).toBe(true);
});

test('a mitad del scroll el dedo hacia abajo scrollea como siempre y no aparece nada', async ({
  page,
}) => {
  await ajustarTaller(await iniciarSesionDePrueba(), {
    sueldo_mensual_centavos: 50_000_000,
    costos_fijos_centavos: 25_000_000,
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible(
    CARGA_DEL_TALLER,
  );
  await listoParaCortar(page);
  const desde = await page.getByRole('main').evaluate((principal) => {
    principal.scrollTop = Math.min(240, principal.scrollHeight - principal.clientHeight);
    return Math.round(principal.scrollTop);
  });
  expect(desde).toBeGreaterThan(100);
  await anotarEstados(page);
  const pedidos = contarPedidos(page);

  await tirarYSoltar(await dedo(page), ARRIBA, ARRIBA + 90);

  await expect.poll(() => scrollDelPrincipal(page)).toBeLessThan(desde - 40);
  expect(await soloEstados(page)).toEqual(['nada']);
  expect(pedidos).toEqual({ sincronizaciones: 0, documentos: 0 });
});

test('sin conexión el gesto responde igual: dice que no hay señal, no gira y termina', async ({
  page,
  context,
}, testInfo) => {
  await page.goto('/');
  await listoParaCortar(page);
  await context.setOffline(true);
  await expect(indicadorDeSync(page)).toContainText('Sin conexión');
  await anotarEstados(page);
  const pedidos = contarPedidos(page);

  await tirarYSoltar(await dedo(page), ARRIBA, PASADO_EL_UMBRAL);

  await expect(indicador(page)).toContainText(
    'Sin conexión. Estás viendo lo último que se sincronizó.',
  );
  await page.screenshot({
    path: testInfo.outputPath('sin-conexion.png'),
    clip: { x: 0, y: 0, width: 390, height: 150 },
  });
  await expect(indicador(page)).toHaveCount(0, { timeout: 5_000 });

  const estados = await soloEstados(page);
  expect(estados).not.toContain('sincronizando');
  expect(estados).toEqual([
    'nada',
    'tirando',
    'listo-para-soltar',
    'sin-conexion',
    'desenlace',
    'nada',
  ]);
  expect(pedidos).toEqual({ sincronizaciones: 0, documentos: 0 });
  await context.setOffline(false);
});

test('con un cambio en la cola, el gesto lo drena aunque el aviso de que volvió la señal no haya llegado', async ({
  page,
  context,
}) => {
  const sesion = await iniciarSesionDePrueba();
  await page.addInitScript(() => {
    window.addEventListener('online', (evento) => {
      if ((window as unknown as VentanaDePrueba).callarLaSenal) evento.stopImmediatePropagation();
    });
  });
  await page.goto('/clientes');
  await expect(page.getByRole('button', { name: 'Cargá tu primer cliente' })).toBeVisible(
    CARGA_DEL_TALLER,
  );
  await listoParaCortar(page);

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('En la cola');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByRole('button', { name: /En la cola/ })).toBeVisible();
  await expect(indicadorDeSync(page)).toContainText('1 cambio');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.evaluate(() => {
    (window as unknown as VentanaDePrueba).callarLaSenal = true;
  });
  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await expect(indicadorDeSync(page)).toContainText('Sin conexión. 1 cambio');
  expect(await contarClientes(sesion, 'En la cola')).toBe(0);

  await tirarYSoltar(await dedo(page), ARRIBA, PASADO_EL_UMBRAL);

  await expect.poll(() => contarClientes(sesion, 'En la cola'), { timeout: 20_000 }).toBe(1);
  await expect(indicadorDeSync(page)).toBeHidden({ timeout: 20_000 });
});

test('con una hoja abierta, tirar no hace nada', async ({ page }) => {
  await page.goto('/clientes');
  await expect(page.getByRole('button', { name: 'Cargá tu primer cliente' })).toBeVisible(
    CARGA_DEL_TALLER,
  );
  await listoParaCortar(page);
  await page.getByRole('button', { name: 'Cargá tu primer cliente' }).click();
  const hoja = page.getByRole('dialog', { name: 'Cliente nuevo' });
  await expect(hoja).toBeVisible();
  const titulo = await hoja.getByRole('heading', { name: 'Cliente nuevo' }).boundingBox();
  if (!titulo) throw new Error('la hoja no tiene el título a la vista');
  await anotarEstados(page);
  const pedidos = contarPedidos(page);
  const cdp = await dedo(page);

  await tirarYSoltar(cdp, titulo.y + titulo.height / 2, titulo.y + 200, titulo.x + 10);
  await tirarYSoltar(cdp, 20, 220);

  await expect(hoja).toBeVisible();
  expect(await soloEstados(page)).toEqual(['nada']);
  expect(pedidos).toEqual({ sincronizaciones: 0, documentos: 0 });
});

test('actualizar no pide la huella ni recarga, y con la app bloqueada al volver el gesto no hace nada', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await visibilidadControlable(page);
  await contarPedidosDeHuella(page);
  await page.clock.install();
  const telefono = await telefonoConHuella(page, true);
  await page.goto('/ajustes');
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible(
    CARGA_DEL_TALLER,
  );
  await registrarHuellaEnElTelefono(telefono, await usuarioDeLaSesion(page));
  await activarBloqueoEnElDispositivo(page);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible(
    CARGA_DEL_TALLER,
  );
  expect(await pedidosDeHuella(page)).toBe(1);

  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
  await sinTransicionEnCurso(page);
  await anotarEstados(page);
  const pedidos = contarPedidos(page);
  const cdp = await dedo(page);

  await tirarYSoltar(cdp, ARRIBA, PASADO_EL_UMBRAL);
  await expect(indicador(page)).toContainText('Todo sincronizado.');
  await expect(indicador(page)).toHaveCount(0, { timeout: 5_000 });

  expect(pedidos.sincronizaciones).toBeGreaterThan(0);
  expect(pedidos.documentos).toBe(0);
  expect(await sigueSinRecargar(page)).toBe(true);
  expect(await pedidosDeHuella(page)).toBe(1);
  await expect(page.getByRole('heading', { level: 1, name: /^Hola/ })).toHaveCount(0);

  await huellaQueVerifica(telefono, false);
  await aSegundoPlano(page);
  await page.clock.fastForward('01:05');
  await alFrente(page);
  const bloqueo = page.getByRole('dialog', { name: 'La app está bloqueada' });
  await expect(bloqueo).toBeVisible();
  await expect.poll(() => pedidosDeHuella(page)).toBe(2);
  await anotarEstados(page);

  await tirarYSoltar(cdp, ARRIBA, PASADO_EL_UMBRAL);

  await expect(bloqueo).toBeVisible();
  expect(await soloEstados(page)).toEqual(['nada']);
});

test('el indicador cuelga del borde de arriba del contenido: no suma la zona segura ni queda tapado', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await demorarLaSincronizacion(page, 1_500);
  const cdp = await dedo(page);
  const medidas: Record<string, unknown> = {};

  for (const arriba of [0, 47]) {
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: arriba } });
    await page.goto('/');
    await tallerCargado(page);

    await tirarYSoltar(cdp, ARRIBA, PASADO_EL_UMBRAL);
    await expect(indicador(page)).toHaveAttribute('data-tirar-para-actualizar', 'sincronizando');

    const medir = () =>
      page.evaluate(() => {
        const principal = document.querySelector('main')?.getBoundingClientRect();
        const pastilla = document.querySelector<HTMLElement>('[data-tirar-para-actualizar] > div');
        const envoltorio = pastilla?.parentElement;
        if (!principal || !pastilla || !envoltorio) throw new Error('no está el indicador');
        const caja = pastilla.getBoundingClientRect();
        envoltorio.style.setProperty('pointer-events', 'auto');
        const centro = document.elementFromPoint(
          caja.left + caja.width / 2,
          caja.top + caja.height / 2,
        );
        envoltorio.style.removeProperty('pointer-events');
        return {
          bordeDelContenido: Math.round(principal.top),
          desdeElBorde: Math.round(caja.top - principal.top),
          tapado: !pastilla.contains(centro),
        };
      });

    await expect
      .poll(medir)
      .toMatchObject({ desdeElBorde: UMBRAL - ALTO_DEL_INDICADOR, tapado: false });
    medidas[String(arriba)] = await medir();
    await page.screenshot({
      path: testInfo.outputPath(`zona-segura-${String(arriba)}.png`),
      clip: { x: 0, y: 0, width: 390, height: 150 },
    });
    await expect(indicador(page)).toHaveCount(0, { timeout: 8_000 });
  }

  console.log(`medidas del indicador: ${JSON.stringify(medidas)}`);
  expect(medidas['47']).toEqual(medidas['0']);
  expect(medidas['0']).toMatchObject({ bordeDelContenido: 0 });
});

test('cada estado se distingue por la forma, y con movimiento reducido nada gira', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await demorarLaSincronizacion(page, 1_500);
  const cdp = await dedo(page);
  const condiciones = [
    { nombre: 'claro', reducedMotion: 'no-preference', colorScheme: 'light' },
    { nombre: 'reducido', reducedMotion: 'reduce', colorScheme: 'light' },
    { nombre: 'oscuro', reducedMotion: 'no-preference', colorScheme: 'dark' },
  ] as const;

  for (const { nombre, reducedMotion, colorScheme } of condiciones) {
    await page.emulateMedia({ reducedMotion, colorScheme });
    await page.goto('/');
    await tallerCargado(page);
    const foto = (estado: string) =>
      page.screenshot({
        path: testInfo.outputPath(`${nombre}-${estado}.png`),
        clip: { x: 0, y: 0, width: 390, height: 130 },
      });
    const flechaQueGira = indicador(page).locator('[data-flecha-que-gira]');

    await apoyar(cdp, ARRIBA);
    await mover(cdp, ARRIBA, ARRIBA + 90);
    await expect(indicador(page)).toHaveAttribute('data-tirar-para-actualizar', 'tirando');
    if (reducedMotion === 'reduce') {
      await expect(flechaQueGira).toBeHidden();
    } else {
      await expect(flechaQueGira).toBeVisible();
      expect(await flechaQueGira.evaluate((flecha) => flecha.style.rotate)).not.toBe('0deg');
    }
    await foto('1-tirando');

    await mover(cdp, ARRIBA + 90, PASADO_EL_UMBRAL);
    await expect(indicador(page)).toHaveAttribute(
      'data-tirar-para-actualizar',
      'listo-para-soltar',
    );
    await foto('2-listo-para-soltar');

    await levantar(cdp);
    await expect(indicador(page)).toHaveAttribute('data-tirar-para-actualizar', 'sincronizando');
    const giro = await indicador(page)
      .locator('svg.lucide-refresh-cw')
      .evaluate((icono) => getComputedStyle(icono).animationName);
    expect(giro).toBe(reducedMotion === 'reduce' ? 'none' : 'maun-spin');
    await page.waitForTimeout(300);
    await foto('3-sincronizando');

    await expect(indicador(page)).toContainText('Todo sincronizado.', { timeout: 8_000 });
    await foto('4-desenlace');
    await expect(indicador(page)).toHaveCount(0, { timeout: 5_000 });
  }
});
