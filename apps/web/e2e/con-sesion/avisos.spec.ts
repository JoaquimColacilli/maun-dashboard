import { expect, test, type Page } from '@playwright/test';

import {
  endpointDelDispositivo,
  endpointsCreados,
  espiarNotificaciones,
  notificacionesArmadas,
  pedidosDePermiso,
  servidorDeAvisosSimulado,
  simularPush,
  sinPreferenciasLaPrimeraVez,
} from '../apoyo/avisos';
import { listoParaCortar } from '../apoyo/pantalla';
import {
  darDeBajaAvisosPorRpc,
  estadoDeLosAvisosPorRpc,
  guardarPreferenciasDeAvisosPorRpc,
  iniciarSesionDePrueba,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const BUENOS_AIRES = 'America/Argentina/Buenos_Aires';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const AVISOS_DE_SIEMPRE = {
  entregas: { activo: true, anticipacion: 2 },
  visitas: { activo: true, anticipacion: 1 },
  presupuestos: { activo: true, anticipacion: 1 },
  seguimientos: { activo: true, anticipacion: 0 },
  anotaciones: { activo: false, anticipacion: 0 },
};

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await guardarPreferenciasDeAvisosPorRpc(sesion, {
    zona: BUENOS_AIRES,
    hora: '07:30',
    avisos: AVISOS_DE_SIEMPRE,
  });
});

test.afterEach(async ({ page }) => {
  for (const endpoint of await endpointsCreados(page)) {
    await darDeBajaAvisosPorRpc(sesion, endpoint);
  }
});

async function abrirLosAvisos(page: Page): Promise<void> {
  await page.goto('/ajustes');
  const enlace = page.getByRole('link', { name: 'Configurar los avisos' });
  await expect(enlace).toBeVisible(CARGA);
  await enlace.click();
  await expect(page.getByRole('heading', { name: 'Avisos', level: 1 })).toBeVisible();
}

async function activarLosAvisos(page: Page, zona = BUENOS_AIRES): Promise<void> {
  await page.getByLabel('¿Dónde vivís?').selectOption(zona);
  await page.getByRole('button', { name: 'Activar los avisos' }).click();
  await expect(page.getByText(/Avisos activos en este dispositivo/)).toBeVisible(CARGA);
}

async function nombreDelFoco(page: Page): Promise<string> {
  return page.evaluate(() => {
    const foco = document.activeElement;
    if (foco === null) return '';
    const etiqueta = foco.getAttribute('aria-label');
    if (etiqueta !== null) return etiqueta;
    const nombradoPor = foco.getAttribute('aria-labelledby');
    if (nombradoPor !== null) return document.getElementById(nombradoPor)?.textContent.trim() ?? '';
    return foco.textContent.trim();
  });
}

test('sin claves en el servidor la pantalla lo dice y no pide ningún permiso', async ({
  page,
  isMobile,
}, testInfo) => {
  await simularPush(page);
  await servidorDeAvisosSimulado(page, false);
  await abrirLosAvisos(page);

  await expect(
    page.getByRole('heading', { name: 'Los avisos todavía no están listos' }),
  ).toBeVisible(CARGA);
  await expect(page.getByText(/no tiene cargadas las claves para mandar avisos/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activar los avisos' })).toHaveCount(0);
  expect(await pedidosDePermiso(page)).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath(`avisos-${isMobile ? 'celular' : 'escritorio'}-sin-claves.png`),
    fullPage: true,
  });
});

test('la zona se pregunta, el permiso se pide recién al activar y el dispositivo queda registrado hasta que se apaga', async ({
  page,
}) => {
  await simularPush(page);
  await servidorDeAvisosSimulado(page, true);
  await sinPreferenciasLaPrimeraVez(page);
  await abrirLosAvisos(page);

  const activar = page.getByRole('button', { name: 'Activar los avisos' });
  await expect(activar).toBeVisible(CARGA);
  expect(await pedidosDePermiso(page)).toEqual([]);

  const zona = page.getByLabel('¿Dónde vivís?');
  await expect(zona).toHaveValue('');
  await activar.click();
  await expect(page.getByText('Elegí dónde vivís para activar los avisos.')).toBeVisible();
  await expect(zona).toBeFocused();
  expect(await pedidosDePermiso(page)).toEqual([]);

  await zona.selectOption('America/Montevideo');
  await activar.click();
  await expect(page.getByText(/Avisos activos en este dispositivo/)).toBeVisible(CARGA);
  expect(await pedidosDePermiso(page)).toEqual([true]);

  const endpoint = await endpointDelDispositivo(page);
  expect(endpoint).toMatch(/^https:\/\/push\.example\/e2e-/);
  const registrado = await estadoDeLosAvisosPorRpc(sesion, endpoint);
  expect(registrado.suscripto).toBe(true);
  expect(registrado.preferencias?.zona).toBe('America/Montevideo');

  await page.getByRole('button', { name: 'Apagar los avisos en este dispositivo' }).click();
  await expect(activar).toBeVisible(CARGA);
  expect((await estadoDeLosAvisosPorRpc(sesion, endpoint)).suscripto).toBe(false);
  expect(await endpointDelDispositivo(page)).toBeNull();
  expect(await pedidosDePermiso(page)).toEqual([true]);
});

test('si se niega el permiso no registra nada y explica cómo habilitarlo', async ({
  page,
  isMobile,
}, testInfo) => {
  await simularPush(page, { respuesta: 'denied' });
  await servidorDeAvisosSimulado(page, true);
  await abrirLosAvisos(page);
  await expect(page.getByRole('button', { name: 'Activar los avisos' })).toBeVisible(CARGA);
  const antes = (await estadoDeLosAvisosPorRpc(sesion, null)).dispositivos;

  await page.getByLabel('¿Dónde vivís?').selectOption(BUENOS_AIRES);
  await page.getByRole('button', { name: 'Activar los avisos' }).click();

  const bloqueados = page.getByRole('region', { name: 'Los avisos están bloqueados' });
  await expect(bloqueados).toBeVisible(CARGA);
  await expect(bloqueados.getByRole('listitem')).toHaveCount(3);
  expect(await pedidosDePermiso(page)).toEqual([true]);
  expect(await endpointDelDispositivo(page)).toBeNull();
  expect((await estadoDeLosAvisosPorRpc(sesion, null)).dispositivos).toBe(antes);

  await bloqueados.getByRole('button', { name: 'Ya lo habilité' }).click();
  await expect(bloqueados.getByRole('alert')).toHaveText(
    'Todavía figura bloqueado. Revisá los pasos y volvé a tocar.',
  );
  expect(await pedidosDePermiso(page)).toEqual([true]);
  await page.screenshot({
    path: testInfo.outputPath(`avisos-${isMobile ? 'celular' : 'escritorio'}-bloqueados.png`),
    fullPage: true,
  });
});

test('con los avisos activos, qué avisa, la hora y la zona quedan guardados en la base', async ({
  page,
  isMobile,
}, testInfo) => {
  await simularPush(page);
  await servidorDeAvisosSimulado(page, true);
  await abrirLosAvisos(page);
  await activarLosAvisos(page);

  const anotaciones = page.getByRole('switch', { name: 'Mis anotaciones' });
  await expect(page.getByLabel('Anticipación de Mis anotaciones')).toBeDisabled();
  await anotaciones.click();
  await expect(anotaciones).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Anticipación de Mis anotaciones')).toBeEnabled();
  const seguimientos = page.getByRole('switch', { name: 'Volver a escribirle' });
  await expect(seguimientos).toHaveAttribute('aria-checked', 'true');
  await seguimientos.click();
  await expect(seguimientos).toHaveAttribute('aria-checked', 'false');
  await page.getByLabel('Anticipación de Entregas').selectOption('3');
  await page.getByRole('button', { name: '06:30' }).click();
  await expect(page.getByRole('button', { name: '06:30' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: '¿Dónde vivís?' }).selectOption('Europe/Madrid');

  await expect
    .poll(async () => (await estadoDeLosAvisosPorRpc(sesion, null)).preferencias, CARGA)
    .toEqual({
      zona: 'Europe/Madrid',
      hora: '06:30',
      avisos: {
        ...AVISOS_DE_SIEMPRE,
        entregas: { activo: true, anticipacion: 3 },
        seguimientos: { activo: false, anticipacion: 0 },
        anotaciones: { activo: true, anticipacion: 0 },
      },
    });
  await expect(page.getByText(/Todavía no salió ninguno/)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`avisos-${isMobile ? 'celular' : 'escritorio'}-activos.png`),
    fullPage: true,
  });
});

test('el teclado recorre la configuración en orden y cambia cada cosa', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'el recorrido con Tab es de la PC');
  await simularPush(page);
  await servidorDeAvisosSimulado(page, true);
  await abrirLosAvisos(page);
  await activarLosAvisos(page);

  await page.getByRole('button', { name: 'Probar' }).focus();
  const recorrido: string[] = [];
  for (let paso = 0; paso < 30; paso += 1) {
    await page.keyboard.press('Tab');
    const nombre = await nombreDelFoco(page);
    if (recorrido.at(-1) !== nombre) recorrido.push(nombre);
    if (nombre === 'Apagar los avisos en este dispositivo') break;
  }
  expect(recorrido).toEqual([
    'Anticipación de Entregas',
    'Entregas',
    'Anticipación de Visitas y relevamientos',
    'Visitas y relevamientos',
    'Anticipación de Presupuestos por vencer',
    'Presupuestos por vencer',
    'Anticipación de Volver a escribirle',
    'Volver a escribirle',
    'Mis anotaciones',
    '06:30',
    '07:30',
    '13:00',
    '20:00',
    'Otra hora',
    '¿Dónde vivís?',
    'Apagar los avisos en este dispositivo',
  ]);

  const anotaciones = page.getByRole('switch', { name: 'Mis anotaciones' });
  await anotaciones.focus();
  await page.keyboard.press('Space');
  await expect(anotaciones).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: '13:00' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '13:00' })).toHaveAttribute('aria-pressed', 'true');

  await expect
    .poll(async () => {
      const { preferencias } = await estadoDeLosAvisosPorRpc(sesion, null);
      return [preferencias?.hora, preferencias?.avisos.anotaciones?.activo];
    }, CARGA)
    .toEqual(['13:00', true]);
});

test.describe('en un iPhone abierto desde Safari', () => {
  test.use({ userAgent: IPHONE });

  test('pide agregar MAUN a inicio antes de ofrecer los avisos', async ({
    page,
    isMobile,
  }, testInfo) => {
    test.skip(!isMobile, 'el iPhone es un celular');
    await simularPush(page);
    await servidorDeAvisosSimulado(page, true);
    await abrirLosAvisos(page);

    await expect(
      page.getByRole('heading', { name: 'Primero agregá MAUN a la pantalla de inicio' }),
    ).toBeVisible(CARGA);
    await expect(page.getByText(/En el iPhone, los avisos solo llegan si la app/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activar los avisos' })).toHaveCount(0);
    expect(await pedidosDePermiso(page)).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('avisos-iphone-sin-instalar.png'),
      fullPage: true,
    });
  });
});

test('un push que llega arma la notificación con el texto de la función, y sin datos igual avisa', async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(isMobile, 'el service worker es el mismo en los dos anchos');
  await page.goto('/agenda');
  await listoParaCortar(page);
  const origen = new URL(page.url()).origin;
  const trabajador = context.serviceWorkers().find((sw) => sw.url().startsWith(origen));
  if (trabajador === undefined) throw new Error('la app no tiene service worker');
  await espiarNotificaciones(trabajador);

  const cdp = await context.newCDPSession(page);
  const registrado = new Promise<string>((resolver) => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const propio = registrations.find(
        (registro) => !registro.isDeleted && registro.scopeURL.startsWith(origen),
      );
      if (propio !== undefined) resolver(propio.registrationId);
    });
  });
  await cdp.send('ServiceWorker.enable');
  const registrationId = await registrado;

  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: origen,
    registrationId,
    data: JSON.stringify({
      titulo: 'Hoy tenés 2 cosas en la agenda',
      cuerpo: 'Entregar: Cocina (hoy)\nRetirar el pulpo (hoy)',
      url: '/agenda',
      etiqueta: 'agenda-2026-09-14',
    }),
  });
  const conIcono = { icon: '/pwa-192x192.png', badge: '/pwa-64x64.png', lang: 'es-AR' };
  await expect
    .poll(() => notificacionesArmadas(trabajador), { timeout: 10_000 })
    .toEqual([
      {
        titulo: 'Hoy tenés 2 cosas en la agenda',
        body: 'Entregar: Cocina (hoy)\nRetirar el pulpo (hoy)',
        tag: 'agenda-2026-09-14',
        data: { url: '/agenda' },
        ...conIcono,
      },
    ]);

  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: origen,
    registrationId,
    data: 'esto no es json',
  });
  await expect
    .poll(() => notificacionesArmadas(trabajador), { timeout: 10_000 })
    .toContainEqual({
      titulo: 'MAUN',
      body: 'Hay cosas en la agenda.',
      tag: 'agenda',
      data: { url: '/agenda' },
      ...conIcono,
    });
});
