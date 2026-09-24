import { expect, test, type Page } from '@playwright/test';

import { apoyar, dedo, levantar, mover } from '../apoyo/dedo';
import { entrarConLaSesion } from '../apoyo/sesion';
import {
  crearCliente,
  guardarProyectoPorRpc,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  type SesionDePrueba,
} from '../apoyo/taller';
import { abrirComparador } from './capturas';
import { sembrarElTaller, type TallerDeLasTransiciones } from './datos';
import {
  congelarLaProxima,
  espiarLasTransiciones,
  esperarCongelada,
  esperarQueTermine,
  olvidarLasTransiciones,
  sinTransicionEnCurso,
  soltar,
  transicionesVistas,
} from './espia';
import { medir, sinTransicion } from './medida';

const CARGA = { timeout: 30_000 };

let sesion: SesionDePrueba;
let taller: TallerDeLasTransiciones;

test.beforeAll(async () => {
  sesion = await iniciarSesionDePrueba();
  taller = await sembrarElTaller(sesion);
});

test.beforeEach(async ({ context }) => {
  await entrarConLaSesion(context, sesion);
  await espiarLasTransiciones(context);
});

function titulo(page: Page, texto: string) {
  return page.getByRole('heading', { level: 1, name: texto, exact: true });
}

function scrollDelPrincipal(page: Page): Promise<number> {
  return page.getByRole('main').evaluate((principal) => Math.round(principal.scrollTop));
}

async function aClientes(page: Page): Promise<void> {
  await page.goto('/');
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('button', { name: 'Clientes', exact: true })
    .click();
  await expect(titulo(page, 'Clientes')).toBeVisible();
  await sinTransicionEnCurso(page);
}

test('el atrás del navegador se anima como vuelta y deja al router en su pantalla; tres atrás seguidos terminan donde tienen que terminar', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  const [cliente] = taller.clientes;
  const [obra] = taller.obras;
  if (!cliente || !obra) throw new Error('faltan datos sembrados');

  await aClientes(page);
  await page.getByRole('button', { name: new RegExp(cliente.titulo) }).click();
  await expect(titulo(page, cliente.titulo)).toBeVisible();
  await sinTransicionEnCurso(page);
  await page
    .getByRole('region', { name: 'Historial' })
    .getByRole('link', { name: obra.titulo, exact: true })
    .click();
  await expect(titulo(page, obra.titulo)).toBeVisible();
  await sinTransicionEnCurso(page);

  await olvidarLasTransiciones(page);
  await congelarLaProxima(page);
  await page.goBack();
  const vista = await esperarCongelada(page);
  expect(vista.tipos).toEqual(['vuelta']);
  expect(vista.alcance).toBe('main');
  await soltar(page);
  await esperarQueTermine(page);
  await expect(titulo(page, cliente.titulo)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/clientes/${cliente.id}$`));

  await page.goForward();
  await expect(titulo(page, obra.titulo)).toBeVisible();
  await page.goBack();
  await page.goBack();
  await page.goBack();
  await sinTransicionEnCurso(page);
  await expect(titulo(page, 'Inicio')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(errores).toEqual([]);
});

test('durante una transición del <main> la barra se toca y manda; el contenido no recibe toques ni se arrastra', async ({
  page,
}) => {
  const cliente = taller.clientes[3] ?? taller.clientes[0];
  if (!cliente) throw new Error('faltan clientes sembrados');
  await aClientes(page);

  await congelarLaProxima(page);
  await page.getByRole('button', { name: new RegExp(cliente.titulo) }).click();
  expect((await esperarCongelada(page)).tipos).toEqual(['empuje']);
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('button', { name: 'Finanzas', exact: true })
    .click();
  await expect(titulo(page, 'Finanzas')).toBeVisible();
  await sinTransicionEnCurso(page);
  await expect(page).toHaveURL(/\/finanzas$/);

  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('button', { name: 'Proyectos', exact: true })
    .click();
  await expect(titulo(page, 'Proyectos')).toBeVisible();
  await sinTransicionEnCurso(page);
  const tarjeta = page.locator('a[data-tarjeta]').first();
  const caja = await tarjeta.boundingBox();
  if (!caja) throw new Error('la tarjeta no se ve');
  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;
  await congelarLaProxima(page);
  await page.touchscreen.tap(x, y);
  await esperarCongelada(page);
  const destino = page.url();
  await page.touchscreen.tap(x, y);
  await page.touchscreen.tap(x, y);
  const scrollAntes = await scrollDelPrincipal(page);
  const cdp = await dedo(page);
  await apoyar(cdp, 300);
  await mover(cdp, 300, 520);
  await levantar(cdp);
  await soltar(page);
  await esperarQueTermine(page);
  expect(page.url()).toBe(destino);
  expect(await scrollDelPrincipal(page)).toBe(scrollAntes);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('[data-tirar-para-actualizar]')).toHaveCount(0);
});

test('con la raíz más alta que la ventana, como en el Samsung, nada salta al empezar ni al terminar', async ({
  page,
  context,
}, testInfo) => {
  const comparador = await abrirComparador(context);
  const cliente = taller.clientes[5] ?? taller.clientes[0];
  if (!cliente) throw new Error('faltan clientes sembrados');
  await aClientes(page);
  await page.addStyleTag({ content: '#root { height: calc(100dvh + 64px) !important; }' });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.getByRole('button', { name: new RegExp(cliente.titulo) }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);

  await medir(page, comparador, testInfo, {
    nombre: 'raiz-alta-empuje',
    alcance: 'main',
    tipos: ['empuje'],
    hacer: () => page.getByRole('button', { name: new RegExp(cliente.titulo) }).click(),
    listo: () => expect(titulo(page, cliente.titulo)).toBeVisible(),
  });
  await medir(page, comparador, testInfo, {
    nombre: 'raiz-alta-vuelta',
    alcance: 'main',
    tipos: ['vuelta'],
    hacer: async () => {
      await page.goBack();
    },
    listo: () => expect(titulo(page, 'Clientes')).toBeVisible(),
  });
});

test('las hojas se abren y se cierran sin transición de página, con un toque y con atrás', async ({
  page,
}) => {
  await page.goto('/');
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
  const barra = page.getByRole('navigation', { name: 'Principal' });

  await sinTransicion(page, async () => {
    await barra.getByRole('button', { name: 'Cargar algo nuevo' }).click();
    await page.getByRole('menuitem', { name: 'Movimiento' }).click();
    await expect(page.getByRole('dialog', { name: 'Cargar un movimiento' })).toBeVisible();
  });
  await sinTransicion(page, async () => {
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Cargar un movimiento' })).toBeHidden();
  });
  await sinTransicion(page, async () => {
    await page.getByRole('button', { name: /^Tu cuenta/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});

test('salir a otra pantalla desde una hoja abierta por estado: la hoja se cierra y recién ahí se mueve la pantalla', async ({
  page,
}) => {
  test.setTimeout(120_000);

  async function saliendoDeLaHoja(tocar: () => Promise<void>): Promise<void> {
    await olvidarLasTransiciones(page);
    await tocar();
    await expect.poll(async () => (await transicionesVistas(page)).length).toBeGreaterThan(0);
    await sinTransicionEnCurso(page);
    const [vista] = await transicionesVistas(page);
    expect(vista?.hojaAbiertaAlEmpezar).toBe(false);
    expect(vista?.tipos).toEqual(['empuje']);
  }

  await page.goto('/');
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
  await page.getByRole('button', { name: /^Tu cuenta/ }).click();
  await saliendoDeLaHoja(() =>
    page
      .getByRole('dialog')
      .getByRole('link', { name: /^Opiniones/ })
      .click(),
  );
  await expect(titulo(page, 'Resultados')).toBeVisible();

  await page
    .getByRole('button', { name: /Cliente de Mueble|Marcela Duarte/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await saliendoDeLaHoja(() =>
    page.getByRole('dialog').getByRole('link', { name: 'Abrir el trabajo' }).click(),
  );
  await expect(titulo(page, taller.entregado.titulo)).toBeVisible();

  await page.goto(`/proyectos/${taller.enSeguimiento.id}`);
  await expect(titulo(page, taller.enSeguimiento.titulo)).toBeVisible(CARGA);
  await page.getByRole('button', { name: 'Registrar el contacto' }).first().click();
  const hoja = page.getByRole('dialog', { name: 'Registrar el contacto' });
  await hoja.getByRole('radio', { name: /No va/ }).click();
  await saliendoDeLaHoja(() => hoja.getByRole('button', { name: 'Seguir al cierre' }).click());
  await expect(page).toHaveURL(new RegExp(`/proyectos/${taller.enSeguimiento.id}/cerrar$`));

  await page.goto('/agenda');
  await expect(titulo(page, 'Agenda')).toBeVisible(CARGA);
  await page
    .getByRole('button', { name: /^Ver el / })
    .first()
    .click();
  const dia = page.getByRole('dialog');
  await expect(dia).toBeVisible();
  const [obra] = taller.obras;
  if (!obra) throw new Error('faltan obras sembradas');
  await saliendoDeLaHoja(() => dia.getByRole('link', { name: obra.titulo, exact: true }).click());
  await expect(titulo(page, obra.titulo)).toBeVisible();
});

test('borrar desde la ficha: la ficha no cambia detrás de la hoja y recién cerrada se va a la lista', async ({
  page,
}) => {
  const clienteId = await crearCliente(sesion, 'Cliente del borrado');
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo: 'Repisa para borrar',
      estado: 'en_curso',
      presupuesto_centavos: 40_000_000,
      comprobante: 'sin_comprobante',
      fecha_inicio: hoyEnElTaller(),
      entrega_estimada: null,
    },
    pagos: [],
    gastos: [],
  });
  await page.goto(`/proyectos/${id}`);
  await expect(titulo(page, 'Repisa para borrar')).toBeVisible(CARGA);
  await page.getByRole('button', { name: 'Borrar' }).first().click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await sinTransicionEnCurso(page);
  await olvidarLasTransiciones(page);
  await page.evaluate(() => {
    const vistos: string[] = [];
    (window as unknown as { titulosVistos: string[] }).titulosVistos = vistos;
    const mirar = () => {
      const texto = document.querySelector('main h1')?.textContent ?? '';
      if (vistos.at(-1) !== texto) vistos.push(texto);
      if (texto !== 'Proyectos') requestAnimationFrame(mirar);
    };
    requestAnimationFrame(mirar);
  });

  await page.getByRole('button', { name: /^Borrar el proyecto/ }).click();
  await expect(titulo(page, 'Proyectos')).toBeVisible();
  await sinTransicionEnCurso(page);
  const vistos = await page.evaluate(
    () => (window as unknown as { titulosVistos: string[] }).titulosVistos,
  );
  expect(vistos).toEqual(['Repisa para borrar', 'Proyectos']);
  const [vista] = await transicionesVistas(page);
  expect(vista?.hojaAbiertaAlEmpezar).toBe(false);
  await expect(page.getByRole('link', { name: 'Repisa para borrar', exact: true })).toHaveCount(0);
});

test('con ?camara-lenta cada movimiento dura cinco veces más, la dirección queda limpia y se apaga con =0', async ({
  page,
}) => {
  const barra = page.getByRole('navigation', { name: 'Principal' });
  const duracionDe = async (hacer: () => Promise<void>): Promise<number> => {
    await congelarLaProxima(page);
    await hacer();
    const vista = await esperarCongelada(page);
    await soltar(page);
    await esperarQueTermine(page);
    return vista.duracion;
  };
  const deIdaYVuelta = async (): Promise<number> => {
    const ida = await duracionDe(() =>
      barra.getByRole('button', { name: 'Clientes', exact: true }).click(),
    );
    await barra.getByRole('button', { name: 'Inicio', exact: true }).click();
    await expect(titulo(page, 'Inicio')).toBeVisible();
    await sinTransicionEnCurso(page);
    return ida;
  };

  await page.goto('/');
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
  const normal = await deIdaYVuelta();

  await page.goto('/?camara-lenta');
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
  await expect(page).toHaveURL(/\/$/);
  const lenta = await deIdaYVuelta();
  expect(lenta / normal).toBeGreaterThan(4.9);
  expect(lenta / normal).toBeLessThan(5.1);

  await page.reload();
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
  expect((await deIdaYVuelta()) / normal).toBeGreaterThan(4.9);

  await page.goto('/?camara-lenta=0');
  await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
  const otraVez = await deIdaYVuelta();
  expect(otraVez / normal).toBeLessThan(1.1);
});

test.describe('con menos movimiento', () => {
  test.use({ reducedMotion: 'reduce' });

  test('ninguna transición: ni la barra, ni un enlace, ni atrás', async ({ page }) => {
    const cliente = taller.clientes[1] ?? taller.clientes[0];
    if (!cliente) throw new Error('faltan clientes sembrados');
    await page.goto('/');
    await expect(titulo(page, 'Inicio')).toBeVisible(CARGA);
    await sinTransicion(page, async () => {
      await page
        .getByRole('navigation', { name: 'Principal' })
        .getByRole('button', { name: 'Clientes', exact: true })
        .click();
      await expect(titulo(page, 'Clientes')).toBeVisible();
      await page.getByRole('button', { name: new RegExp(cliente.titulo) }).click();
      await expect(titulo(page, cliente.titulo)).toBeVisible();
      await page.goBack();
      await expect(titulo(page, 'Clientes')).toBeVisible();
    });
  });
});
