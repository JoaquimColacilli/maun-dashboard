import { expect, test, type Page } from '@playwright/test';

import { dedo } from '../apoyo/dedo';
import { listoParaCortar } from '../apoyo/pantalla';
import {
  archivoPorRest,
  contactoPorRpc,
  enlacePorRest,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';
import {
  contarLaMedicion,
  deslizarYMedir,
  exigirQueLlegueAlFinal,
  medirLaVista,
  type MedicionDeLaVista,
} from '../apoyo/vista';

const CARGA = { timeout: 30_000 };

function hoyLocal(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${String(ahora.getFullYear())}-${mes}-${dia}`;
}

function tokenDePrueba(): string {
  return `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
}

const TITULO = 'Placard de tres cuerpos con puertas corredizas';

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

async function obraLargaConEnlace(token: string): Promise<string> {
  const { id, clienteId } = await contactoPorRpc(sesion, {
    titulo: TITULO,
    estado: 'presupuesto_enviado',
  });
  const proyecto = await leerProyecto(sesion, TITULO);
  const hoy = hoyLocal();

  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: proyecto?.version ?? null,
      cliente_id: clienteId,
      titulo: TITULO,
      estado: 'en_curso',
      presupuesto_centavos: 398_700_000,
      comprobante: 'sin_comprobante',
      direccion_entrega: 'Av. Rivadavia 15320, Ramos Mejía',
      fecha_inicio: hoy,
      entrega_estimada: hoy,
    },
    pagos: [
      { id: crypto.randomUUID(), fecha: hoy, concepto: 'Seña', monto_centavos: 190_000_000 },
      { id: crypto.randomUUID(), fecha: hoy, concepto: 'Adelanto', monto_centavos: 98_000_000 },
    ],
    gastos: [],
  });

  for (const nombre of ['Plano de frente', 'Render del cuerpo', 'Despiece general']) {
    await archivoPorRest(sesion, { proyectoId: id, nombre, visible: true });
  }

  await enlacePorRest(sesion, id, token);
  return id;
}

function laVista(page: Page) {
  return page.getByRole('region', { name: 'Tu mueble' });
}

// El service worker propio no llama a clientsClaim(): la primera carga lo instala y recién la
// siguiente queda bajo su control. Por eso la recarga, que es lo que pasa en el teléfono del dueño,
// donde la app instalada ya venía con el service worker viejo sirviendo el shell.
async function conElServiceWorkerSirviendo(page: Page): Promise<void> {
  await page.goto('/');
  await listoParaCortar(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await listoParaCortar(page);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), CARGA)
    .toBe(true);
}

async function medirODeslizar(page: Page): Promise<MedicionDeLaVista> {
  if (page.context().browser() === null) return medirLaVista(page);
  const conDedo = (page.viewportSize()?.width ?? 0) <= 500;
  if (conDedo) return deslizarYMedir(page, await dedo(page));

  await page.evaluate(() => {
    for (const nodo of document.querySelectorAll<HTMLElement>('*')) {
      if (nodo.scrollHeight > nodo.clientHeight) nodo.scrollTop = nodo.scrollHeight;
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(350);
  return medirLaVista(page);
}

test('el enlace, con la sesión del dueño guardada y el service worker sirviendo la página, llega hasta el final', async ({
  page,
}, testInfo) => {
  const token = tokenDePrueba();
  await obraLargaConEnlace(token);

  await conElServiceWorkerSirviendo(page);

  await page.goto(`/v/${token}`);
  await expect(laVista(page)).toBeVisible(CARGA);

  const antes = await medirLaVista(page);
  const despues = await medirODeslizar(page);

  console.log(
    [
      `\n=== ${testInfo.project.name}: el enlace, con sesión del dueño y service worker ===`,
      contarLaMedicion('al abrir', antes),
      contarLaMedicion('después de llegar al fondo', despues),
    ].join('\n'),
  );

  await page.screenshot({
    path: testInfo.outputPath(`vista-scroll-enlace-con-sesion-${testInfo.project.name}.png`),
  });

  await exigirQueLlegueAlFinal(page, despues, 'el enlace con la sesión del dueño');
});

test('la vista abierta desde el botón de la ficha llega hasta el final', async ({
  page,
}, testInfo) => {
  const token = tokenDePrueba();
  const id = await obraLargaConEnlace(token);

  await page.goto(`/proyectos/${id}/vista-cliente`);
  await listoParaCortar(page);
  await expect(laVista(page)).toBeVisible(CARGA);

  const antes = await medirLaVista(page);
  const despues = await medirODeslizar(page);

  console.log(
    [
      `\n=== ${testInfo.project.name}: el botón de la ficha, adentro de la app ===`,
      contarLaMedicion('al abrir', antes),
      contarLaMedicion('después de llegar al fondo', despues),
    ].join('\n'),
  );

  await page.screenshot({
    path: testInfo.outputPath(`vista-scroll-ficha-${testInfo.project.name}.png`),
  });

  await exigirQueLlegueAlFinal(page, despues, 'el botón de la ficha');
});

test('por el enlace la base se consulta como anónimo aunque la sesión del dueño esté guardada', async ({
  page,
  browser,
}) => {
  const token = tokenDePrueba();
  await obraLargaConEnlace(token);

  const roles: string[] = [];
  page.on('request', (pedido) => {
    if (!pedido.url().includes('/rest/v1/rpc/vista_compartida')) return;
    const token = (pedido.headers().authorization ?? '').replace(/^Bearer /, '');
    if (token === sesion.entorno.publishableKey) {
      roles.push('anon');
      return;
    }
    const cuerpo = token.split('.')[1];
    if (cuerpo === undefined) {
      roles.push(`una clave que no es la pública: ${token.slice(0, 16)}…`);
      return;
    }
    try {
      const claims = JSON.parse(
        Buffer.from(cuerpo.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('utf8'),
      ) as { role?: unknown };
      roles.push(typeof claims.role === 'string' ? claims.role : 'un token sin rol');
    } catch {
      roles.push('algo que no es un token');
    }
  });

  await page.goto('/');
  await listoParaCortar(page);
  expect(await page.evaluate(() => localStorage.getItem('maun.sesion') !== null)).toBe(true);

  await page.goto(`/v/${token}`);
  await expect(laVista(page)).toBeVisible(CARGA);
  const conSesionGuardada = await page.getByRole('main').innerText();

  const limpio = await browser.newContext();
  const otra = await limpio.newPage();
  await otra.goto(`/v/${token}`);
  await expect(laVista(otra)).toBeVisible(CARGA);
  const sinSesion = await otra.getByRole('main').innerText();
  await limpio.close();

  expect(roles.length).toBeGreaterThan(0);
  expect(roles, `la vista del enlace se consultó como ${roles.join(', ')}`).toEqual(
    roles.map(() => 'anon'),
  );
  expect(conSesionGuardada).toBe(sinSesion);
});

test('el enlace lo sirve la red, no el precache del service worker del dueño', async ({ page }) => {
  const token = tokenDePrueba();
  await obraLargaConEnlace(token);

  await conElServiceWorkerSirviendo(page);

  const desdeElTrabajador: boolean[] = [];
  page.on('response', (respuesta) => {
    if (respuesta.request().resourceType() !== 'document') return;
    if (!new URL(respuesta.url()).pathname.startsWith('/v/')) return;
    desdeElTrabajador.push(respuesta.fromServiceWorker());
  });

  await page.goto(`/v/${token}`);
  await expect(laVista(page)).toBeVisible(CARGA);

  expect(desdeElTrabajador.length).toBeGreaterThan(0);
  expect(
    desdeElTrabajador,
    'el documento de la vista del cliente salió del precache del dueño',
  ).toEqual(desdeElTrabajador.map(() => false));
});
