import { expect, test, type Page } from '@playwright/test';

import { listoParaCortar } from '../apoyo/pantalla';
import {
  archivoPorRest,
  contactoPorRpc,
  enlacePorRest,
  enlacesDe,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  vaciarTaller,
  visibilidadDelArchivo,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

// El día del taller, no el de UTC: la app arma sus fechas con la hora local y después de medianoche
// en Londres los dos no coinciden.
function hoyLocal(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${String(ahora.getFullYear())}-${mes}-${dia}`;
}

const TITULO = 'Vestidor de dos cuerpos';

let sesion: SesionDePrueba;

test.beforeEach(async ({ context }) => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

async function obra(): Promise<{
  id: string;
  clienteId: string;
  visible: string;
  privado: string;
}> {
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
      presupuesto_centavos: 90_000_000,
      comprobante: 'sin_comprobante',
      direccion_entrega: 'Sarmiento 2310, Morón',
      fecha_inicio: hoy,
      entrega_estimada: hoy,
    },
    pagos: [{ id: crypto.randomUUID(), fecha: hoy, concepto: 'Seña', monto_centavos: 30_000_000 }],
    gastos: [],
  });

  const visible = await archivoPorRest(sesion, {
    proyectoId: id,
    nombre: 'Render de la propuesta',
  });
  const privado = await archivoPorRest(sesion, { proyectoId: id, nombre: 'Despiece de corte' });
  return { id, clienteId, visible: visible.id, privado: privado.id };
}

async function abrir(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta);
  await listoParaCortar(page);
}

test('desde la ficha se crea el enlace, se copia, y el cliente pasa a ver solo lo marcado', async ({
  page,
}, testInfo) => {
  const { id, visible, privado } = await obra();

  await abrir(page, `/proyectos/${id}`);
  await page.getByRole('button', { name: 'Mostrarle al cliente' }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}/compartir$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compartir con el cliente');

  await expect(page.getByText('Todavía no compartiste este trabajo')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Qué archivos ve' })).toContainText(
    '0 de 2 compartidos',
  );

  await page.getByRole('button', { name: 'Crear el enlace' }).click();
  const enlace = page.getByRole('region', { name: 'El enlace' });
  await expect(enlace).toBeVisible(CARGA);
  await expect(enlace).toContainText('Enlace activo');
  await expect(enlace).toContainText('no vence');

  await expect.poll(async () => (await enlacesDe(sesion, id)).length, CARGA).toBe(1);
  const [fila] = await enlacesDe(sesion, id);
  expect(fila?.revocado_at).toBeNull();
  expect(fila?.token_hash).toMatch(/^[0-9a-f]{64}$/);

  const url = (await enlace.locator('.font-mono').innerText()).trim();
  expect(url).toMatch(/\/v\/[A-Za-z0-9_-]{32}$/);
  const token = url.split('/v/')[1] ?? '';
  // La huella sigue siendo una huella; la dirección va aparte, para que se vea desde cualquier
  // aparato del dueño (ADR 0052).
  expect(fila?.token_hash).not.toContain(token);
  expect(fila?.token).toBe(token);

  await enlace.getByRole('button', { name: 'Copiar' }).click();
  await expect(enlace.getByRole('button', { name: 'Copiado' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);

  const archivos = page.getByRole('region', { name: 'Qué archivos ve' });
  await archivos.getByRole('switch', { name: 'Compartir Render de la propuesta' }).click();
  await expect(archivos).toContainText('1 de 2 compartidos');
  await expect.poll(() => visibilidadDelArchivo(sesion, visible), CARGA).toBe(true);
  expect(await visibilidadDelArchivo(sesion, privado)).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath(`compartir-${testInfo.project.name}.png`),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Ver cómo lo ve él' }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}/vista-cliente$`));
  const vista = page.getByRole('region', { name: 'Tu mueble' });
  await expect(vista).toBeVisible(CARGA);
  await expect(vista).toContainText('$ 900.000');
  await expect(vista).toContainText('$ 600.000');

  const galeria = page.getByRole('region', { name: 'Fotos y planos' });
  await expect(galeria).toContainText('Render de la propuesta');
  await expect(galeria).not.toContainText('Despiece de corte');

  await page.screenshot({
    path: testInfo.outputPath(`vista-desde-la-app-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('la vista de adentro de la app y la del enlace muestran lo mismo', async ({
  page,
  browser,
}) => {
  const { id, visible } = await obra();

  await abrir(page, `/proyectos/${id}/compartir`);
  await page.getByRole('button', { name: 'Crear el enlace' }).click();
  const enlace = page.getByRole('region', { name: 'El enlace' });
  await expect(enlace).toBeVisible(CARGA);
  const url = (await enlace.locator('.font-mono').innerText()).trim();

  await page
    .getByRole('region', { name: 'Qué archivos ve' })
    .getByRole('switch', { name: 'Compartir Render de la propuesta' })
    .click();
  await expect.poll(() => visibilidadDelArchivo(sesion, visible), CARGA).toBe(true);

  await page.goto(`/proyectos/${id}/vista-cliente`);
  await expect(page.getByRole('region', { name: 'Tu mueble' })).toBeVisible(CARGA);
  const desdeLaApp = await page.getByRole('region', { name: 'Tu mueble' }).innerText();
  const caminoDesdeLaApp = await page.getByRole('region', { name: 'En qué anda' }).innerText();

  const sinSesion = await browser.newContext();
  const otra = await sinSesion.newPage();
  await otra.goto(new URL(url).pathname);
  await expect(otra.getByRole('region', { name: 'Tu mueble' })).toBeVisible(CARGA);
  const desdeElEnlace = await otra.getByRole('region', { name: 'Tu mueble' }).innerText();
  const caminoDesdeElEnlace = await otra.getByRole('region', { name: 'En qué anda' }).innerText();
  await sinSesion.close();

  expect(desdeElEnlace).toBe(desdeLaApp);
  expect(caminoDesdeElEnlace).toBe(caminoDesdeLaApp);
});

// Lo que reportó el dueño: el enlace creado en la computadora no aparecía en el teléfono, y lo
// único que le ofrecía la pantalla era crear otro, que le revoca al cliente el que ya tiene.
test('el enlace creado en un aparato se ve igual en el otro, sin tener que crear uno nuevo', async ({
  page,
}, testInfo) => {
  const { id } = await obra();

  await abrir(page, `/proyectos/${id}/compartir`);
  await page.getByRole('button', { name: 'Crear el enlace' }).click();
  const enlace = page.getByRole('region', { name: 'El enlace' });
  await expect(enlace).toBeVisible(CARGA);
  const url = (await enlace.locator('.font-mono').innerText()).trim();
  expect(url).toMatch(/\/v\/[A-Za-z0-9_-]{32}$/);

  await expect
    .poll(async () => (await enlacesDe(sesion, id))[0]?.token, CARGA)
    .toBe(url.split('/v/')[1]);

  // El otro aparato: la misma cuenta, sin nada guardado de este lado.
  await page.evaluate(() => {
    localStorage.removeItem('maun:enlaces');
  });
  await abrir(page, `/proyectos/${id}/compartir`);

  const otroAparato = page.getByRole('region', { name: 'El enlace' });
  await expect(otroAparato).toBeVisible(CARGA);
  await expect(otroAparato.locator('.font-mono')).toHaveText(url);
  await expect(page.getByText('todavía vive en el aparato donde lo hiciste')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Crear uno nuevo' })).toBeHidden();

  await otroAparato.getByRole('button', { name: 'Copiar' }).click();
  await expect(otroAparato.getByRole('button', { name: 'Copiado' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);

  await page.screenshot({
    path: testInfo.outputPath(`enlace-en-el-otro-aparato-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('un enlace de los de antes se rellena solo desde el aparato que lo tiene guardado', async ({
  page,
}) => {
  const { id } = await obra();
  const token = `e2e${crypto.randomUUID().replaceAll('-', '')}`;

  // Como quedaron los que ya existían: con la huella y sin la dirección.
  const fila = await enlacePorRest(sesion, id, token, { conLaDireccion: false });
  expect(fila.token).toBeNull();

  // Sin el token guardado de este lado, la pantalla lo dice y no muestra una dirección inventada.
  await abrir(page, `/proyectos/${id}/compartir`);
  await expect(page.getByRole('region', { name: 'El enlace' })).toContainText(
    'todavía vive en el aparato donde lo hiciste',
    CARGA,
  );
  await expect(page.getByRole('region', { name: 'El enlace' }).locator('.font-mono')).toHaveCount(
    0,
  );

  // El aparato que sí lo tiene guardado lo sube con solo abrir el trabajo.
  await page.evaluate(
    ([enlaceId, guardado]) => {
      localStorage.setItem('maun:enlaces', JSON.stringify({ [enlaceId ?? '']: guardado }));
    },
    [fila.id, token],
  );
  await abrir(page, `/proyectos/${id}/compartir`);

  const enlace = page.getByRole('region', { name: 'El enlace' });
  await expect(enlace.locator('.font-mono')).toContainText(`/v/${token}`, CARGA);
  await expect.poll(async () => (await enlacesDe(sesion, id))[0]?.token, CARGA).toBe(token);
});

test('dar de baja el enlace lo mata, y el que se crea después es otro', async ({ page }) => {
  const { id } = await obra();

  await abrir(page, `/proyectos/${id}/compartir`);
  await page.getByRole('button', { name: 'Crear el enlace' }).click();
  const enlace = page.getByRole('region', { name: 'El enlace' });
  await expect(enlace).toBeVisible(CARGA);
  const primero = (await enlace.locator('.font-mono').innerText()).trim();

  await page.getByRole('button', { name: 'Dar de baja' }).click();
  const confirmacion = page.getByRole('alertdialog', { name: '¿Damos de baja el enlace?' });
  await expect(confirmacion).toBeVisible();
  await confirmacion.getByRole('button', { name: 'Darlo de baja' }).click();

  await expect(page.getByText('El enlace está dado de baja')).toBeVisible(CARGA);
  await expect
    .poll(
      async () => (await enlacesDe(sesion, id)).filter((fila) => fila.revocado_at === null).length,
      CARGA,
    )
    .toBe(0);

  await page.getByRole('button', { name: 'Crear un enlace nuevo' }).click();
  await expect(enlace).toBeVisible(CARGA);
  const segundo = (await enlace.locator('.font-mono').innerText()).trim();
  expect(segundo).not.toBe(primero);
});

test('el foco se invierte solo: antes de la entrega manda la etapa, desde la entrega manda el saldo', async ({
  page,
}, testInfo) => {
  const { id, clienteId } = await obra();

  await abrir(page, `/proyectos/${id}/vista-cliente`);
  const vista = page.getByRole('region', { name: 'Tu mueble' });
  await expect(vista).toBeVisible(CARGA);
  const antes = await vista.innerText();
  expect(antes).toContain('Lo estamos fabricando');
  await page.screenshot({
    path: testInfo.outputPath(`foco-etapa-${testInfo.project.name}.png`),
  });

  const proyecto = await leerProyecto(sesion, TITULO);
  const hoy = hoyLocal();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: proyecto?.version ?? null,
      cliente_id: clienteId,
      titulo: TITULO,
      estado: 'entregado',
      presupuesto_centavos: 90_000_000,
      comprobante: 'sin_comprobante',
      direccion_entrega: 'Sarmiento 2310, Morón',
      fecha_inicio: hoy,
      entrega_estimada: hoy,
      fecha_entrega: hoy,
    },
    pagos: [],
    gastos: [],
  });

  await page.goto(`/proyectos/${id}/vista-cliente`);
  await page.reload();
  await expect(vista).toBeVisible(CARGA);
  await expect(vista).toContainText('Ya está instalado en tu casa');
  await expect(vista).toContainText('Te falta pagar');
  await page.screenshot({
    path: testInfo.outputPath(`foco-saldo-${testInfo.project.name}.png`),
  });

  const despues = await vista.innerText();
  expect(despues.indexOf('Te falta pagar')).toBeLessThan(despues.indexOf('Ya está instalado'));
  expect(antes.indexOf('Lo estamos fabricando')).toBeLessThan(antes.indexOf('Te falta pagar'));
});

test('la ayuda explica el camino, el estimativo y el casillero, y se recorre de punta a punta', async ({
  page,
}) => {
  const { id } = await obra();

  await abrir(page, `/proyectos/${id}`);
  await page.getByRole('button', { name: 'Cómo lo ve tu cliente' }).click();

  const ayuda = page.getByRole('dialog', { name: 'Cómo lo ve tu cliente' });
  await expect(ayuda).toBeVisible(CARGA);
  await expect(ayuda).toContainText('1 de 7', { useInnerText: true });
  await expect(ayuda.getByRole('button', { name: 'Atrás' })).toBeDisabled();

  // El alto no cambia de lámina en lámina: si cambiara, el modal saltaría abajo del dedo. Se mide
  // con offsetHeight y no con la caja pintada, que durante la animación de apertura viene escalada.
  const medir = async (): Promise<number> =>
    ayuda.evaluate((nodo) => (nodo instanceof HTMLElement ? nodo.offsetHeight : 0));
  const alto = await medir();
  for (const numero of [2, 3, 4, 5, 6, 7]) {
    await ayuda.getByRole('button', { name: 'Siguiente' }).click();
    await expect(ayuda).toContainText(`${String(numero)} de 7`, { useInnerText: true });
    await expect(ayuda.getByRole('heading', { level: 3 })).toHaveCount(1);
    expect(await medir()).toBe(alto);
  }

  await ayuda.getByRole('button', { name: 'Listo' }).click();
  await expect(ayuda).toBeHidden(CARGA);
});

test('la pantalla de compartir muestra antes cómo se va a ver en WhatsApp', async ({
  page,
}, testInfo) => {
  const { id } = await obra();

  await abrir(page, `/proyectos/${id}/compartir`);
  await page.getByRole('button', { name: 'Crear el enlace' }).click();
  const enlace = page.getByRole('region', { name: 'El enlace' });
  await expect(enlace).toBeVisible(CARGA);

  await expect(enlace).toContainText('En WhatsApp va a decir:');
  await expect(enlace).toContainText(TITULO);

  // La captura es de la sección: la raíz de la app está anclada y una de página entera se corta
  // en la ventana (ADR 0013 y 0050).
  await enlace.screenshot({
    path: testInfo.outputPath(`compartir-con-whatsapp-${testInfo.project.name}.png`),
  });
});
