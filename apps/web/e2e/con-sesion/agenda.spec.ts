import { expect, test, type Locator, type Page } from '@playwright/test';

import { avisosEnPantalla, indicadorDeSync, listoParaCortar } from '../apoyo/pantalla';
import {
  anotacionesDelTaller,
  crearAnotacionPorRest,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function fechaLocal(fecha: Date): string {
  return `${String(fecha.getFullYear())}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

const HOY = fechaLocal(new Date());
const MES = HOY.slice(0, 7);

function delMes(dia: number): string {
  return `${MES}-${String(dia).padStart(2, '0')}`;
}

function otroDiaDelMes(): string {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const fecha = fechaLocal(manana);
  return fecha.startsWith(MES) ? fecha : HOY;
}

function diaEnPalabras(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00`);
  return `${DIAS[dia.getDay()] ?? ''} ${String(dia.getDate())} de ${MESES[dia.getMonth()] ?? ''}`;
}

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

async function obra(titulo: string, entrega: string): Promise<string> {
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado: 'en_curso',
      presupuesto_centavos: 100_000_000,
      comprobante: 'sin_comprobante',
      fecha_inicio: HOY,
      entrega_estimada: entrega,
      direccion_entrega: 'Sarmiento 2310',
    },
    pagos: [],
    gastos: [],
  });
  return id;
}

async function contacto(titulo: string, extra: Record<string, unknown>): Promise<string> {
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado: 'contacto',
      presupuesto_centavos: null,
      comprobante: 'sin_comprobante',
      ...extra,
    },
    pagos: [],
    gastos: [],
  });
  return id;
}

async function abrirLaAgenda(page: Page): Promise<void> {
  await page.goto('/agenda');
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
}

function celda(page: Page, fecha: string): Locator {
  return page.locator(`div[data-fecha="${fecha}"]`);
}

async function abrirElDiaDeHoy(page: Page, isMobile: boolean, cosas: string): Promise<Locator> {
  if (isMobile) {
    await page.getByRole('button', { name: `Ver el ${diaEnPalabras(HOY)}` }).click();
    return page.getByRole('dialog', { name: diaEnPalabras(HOY) });
  }
  await page.getByRole('button', { name: `${diaEnPalabras(HOY)}, hoy: ${cosas}` }).click();
  return page.getByRole('complementary', { name: `El ${diaEnPalabras(HOY)}` });
}

function laAnotacionDeHoy(page: Page, isMobile: boolean, texto: string): Locator {
  return isMobile
    ? page.getByRole('region', { name: diaEnPalabras(HOY) }).getByText(texto)
    : celda(page, HOY).getByRole('button', { name: texto });
}

async function tabularHasta(page: Page, destino: Locator, pasos = 120): Promise<boolean> {
  for (let paso = 0; paso < pasos; paso += 1) {
    await page.keyboard.press('Tab');
    if (await destino.evaluate((elemento) => elemento === document.activeElement)) return true;
  }
  return false;
}

test('anotar algo propio sin señal: aparece, sobrevive a cerrar la app y llega a la base una sola vez', async ({
  page,
  context,
  isMobile,
}) => {
  await abrirLaAgenda(page);
  await listoParaCortar(page);
  await context.setOffline(true);

  if (isMobile) {
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('button', { name: 'Cargar algo nuevo' })
      .click();
    await page.getByRole('menuitem', { name: 'Anotar algo' }).click();
  } else {
    await page.getByRole('button', { name: 'Anotar algo', exact: true }).click();
  }

  const hoja = page.getByRole('dialog', { name: 'Anotar algo' });
  await hoja.getByLabel('Qué hay que hacer').fill('E2E Comprar melamina sin señal');
  await hoja.getByRole('radio', { name: /Taller/ }).click();
  await hoja.getByRole('button', { name: 'Anotarlo' }).click();

  await expect(hoja).toBeHidden();
  await expect(avisosEnPantalla(page)).toContainText(`Anotado para el ${diaEnPalabras(HOY)}.`);
  await expect(indicadorDeSync(page)).toContainText('Sin conexión');
  await expect(indicadorDeSync(page)).toContainText('1 cambio');
  await expect(laAnotacionDeHoy(page, isMobile, 'E2E Comprar melamina sin señal')).toBeVisible();
  expect(await anotacionesDelTaller(sesion)).toHaveLength(0);

  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto('/agenda');
  await expect(laAnotacionDeHoy(reabierta, isMobile, 'E2E Comprar melamina sin señal')).toBeVisible(
    CARGA,
  );
  await expect(indicadorDeSync(reabierta)).toContainText('1 cambio');

  await context.setOffline(false);
  await expect(indicadorDeSync(reabierta)).toBeHidden({ timeout: 20_000 });
  await expect
    .poll(async () =>
      (await anotacionesDelTaller(sesion)).map((fila) => [fila.texto, fila.categoria, fila.fecha]),
    )
    .toEqual([['E2E Comprar melamina sin señal', 'taller', HOY]]);
});

test('una entrega no se borra desde la agenda: explica de dónde sale y abre el proyecto', async ({
  page,
  isMobile,
}) => {
  const obraId = await obra('E2E Mesada y alacena', HOY);
  await crearAnotacionPorRest(sesion, {
    fecha: HOY,
    texto: 'E2E Pasar a cobrar el saldo',
    categoria: 'taller',
  });
  await abrirLaAgenda(page);

  const detalle = await abrirElDiaDeHoy(page, isMobile, '2 cosas');
  const entrega = detalle.getByRole('listitem').filter({ hasText: 'E2E Mesada y alacena' });
  await expect(entrega).toContainText(
    'Sale de la entrega estimada del proyecto. Para moverla, cambiá la fecha ahí.',
  );
  await expect(entrega.getByRole('button', { name: /Borrar/ })).toHaveCount(0);
  await expect(entrega.getByRole('checkbox')).toHaveCount(0);

  const propia = detalle.getByRole('listitem').filter({ hasText: 'E2E Pasar a cobrar el saldo' });
  await expect(
    propia.getByRole('button', { name: 'Borrar «E2E Pasar a cobrar el saldo»' }),
  ).toBeVisible();

  await entrega.getByRole('button', { name: 'Abrir el proyecto' }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${obraId}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Mesada y alacena' })).toBeVisible();
});

test('tildar, marcar y borrar una anotación, con su deshacer, y la base lo refleja', async ({
  page,
  isMobile,
}) => {
  await crearAnotacionPorRest(sesion, {
    fecha: HOY,
    texto: 'E2E Pintar la cajonera',
    categoria: 'taller',
  });
  const leer = async () => (await anotacionesDelTaller(sesion))[0];
  await abrirLaAgenda(page);

  const detalle = await abrirElDiaDeHoy(page, isMobile, '1 cosa');
  const casilla = detalle.getByRole('checkbox', { name: 'E2E Pintar la cajonera' });

  await casilla.click();
  await expect(casilla).toHaveAttribute('aria-checked', 'true');
  await expect(
    detalle.getByRole('status').filter({ hasText: 'Listo: E2E Pintar la cajonera.' }),
  ).toBeVisible();
  await expect.poll(async () => (await leer())?.hecha).toBe(true);
  await detalle.getByRole('button', { name: 'Deshacer' }).click();
  await expect(casilla).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => (await leer())?.hecha).toBe(false);

  await detalle.getByRole('button', { name: 'Marcar como importante' }).click();
  await expect(
    detalle.getByRole('button', { name: 'Sacarle la marca de importante' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await leer())?.importante).toBe(true);

  await detalle.getByRole('button', { name: 'Borrar «E2E Pintar la cajonera»' }).click();
  await expect(
    detalle.getByRole('listitem').filter({ hasText: 'E2E Pintar la cajonera' }),
  ).toHaveCount(0);
  await expect(
    detalle.getByRole('status').filter({ hasText: 'Borraste «E2E Pintar la cajonera».' }),
  ).toBeVisible();
  await expect.poll(async () => (await anotacionesDelTaller(sesion)).length).toBe(0);
  await detalle.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(async () => (await anotacionesDelTaller(sesion)).length).toBe(1);
  await expect(
    detalle.getByRole('listitem').filter({ hasText: 'E2E Pintar la cajonera' }),
  ).toBeVisible();
});

test('el mes vacío lo dice', async ({ page, isMobile }, testInfo) => {
  await abrirLaAgenda(page);

  if (isMobile) {
    await expect(page.getByText('Todavía no hay nada en el mes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anotar lo primero' })).toBeVisible();
  } else {
    await expect(page.getByText('sin nada agendado')).toBeVisible();
    await expect(
      page.getByText('Las visitas y las entregas aparecen solas cuando cargás un contacto'),
    ).toBeVisible();
  }
  await page.screenshot({
    path: testInfo.outputPath(`agenda-${isMobile ? 'celular' : 'escritorio'}-mes-vacio.png`),
  });
});

test('con datos resume el mes y muestra lo del día, y sin señal se ve igual', async ({
  page,
  context,
  isMobile,
}, testInfo) => {
  await obra('E2E Placard de Victor', otroDiaDelMes());
  await crearAnotacionPorRest(sesion, {
    fecha: HOY,
    texto: 'E2E Retirar el pulpo',
    categoria: 'taller',
    hora: '15:00',
    importante: true,
  });
  await crearAnotacionPorRest(sesion, {
    fecha: HOY,
    texto: 'E2E Comprar melamina',
    categoria: 'materiales',
  });
  await abrirLaAgenda(page);

  await expect(page.getByText('1 compromiso · 2 anotaciones')).toBeVisible();
  if (isMobile) {
    await expect(page.getByRole('group', { name: 'Días del mes' })).toBeVisible();
    const hoy = page.getByRole('region', { name: diaEnPalabras(HOY) });
    await expect(hoy).toContainText('15:00');
    await expect(hoy).toContainText('E2E Retirar el pulpo');
    await expect(page.getByRole('main').locator('div[data-fecha]')).toHaveCount(0);
  } else {
    await expect(
      celda(page, HOY).getByRole('button', { name: 'E2E Retirar el pulpo' }),
    ).toBeVisible();
    await expect(page.getByRole('group', { name: 'Días del mes' })).toHaveCount(0);
  }
  await page.screenshot({
    path: testInfo.outputPath(`agenda-${isMobile ? 'celular-lista' : 'escritorio-grilla'}.png`),
  });

  await listoParaCortar(page);
  await context.setOffline(true);
  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto('/agenda');
  await expect(reabierta.getByText('1 compromiso · 2 anotaciones')).toBeVisible(CARGA);
  await expect(laAnotacionDeHoy(reabierta, isMobile, 'E2E Retirar el pulpo')).toBeVisible();
  await reabierta.screenshot({
    path: testInfo.outputPath(`agenda-${isMobile ? 'celular' : 'escritorio'}-sin-senal.png`),
  });
  await context.setOffline(false);
});

test('la agenda se recorre con el teclado', async ({ page, isMobile }) => {
  await crearAnotacionPorRest(sesion, {
    fecha: HOY,
    texto: 'E2E Con teclado',
    categoria: 'taller',
  });
  await abrirLaAgenda(page);
  await page.getByRole('main').focus();

  if (isMobile) {
    const diaDeLaTira = page
      .getByRole('group', { name: 'Días del mes' })
      .getByRole('button', { name: new RegExp(`^${diaEnPalabras(HOY)}`) });
    expect(await tabularHasta(page, diaDeLaTira)).toBe(true);

    const verElDia = page.getByRole('button', { name: `Ver el ${diaEnPalabras(HOY)}` });
    expect(await tabularHasta(page, verElDia)).toBe(true);
    await page.keyboard.press('Enter');
    const hoja = page.getByRole('dialog', { name: diaEnPalabras(HOY) });
    await expect(hoja).toBeVisible();

    const casilla = hoja.getByRole('checkbox', { name: 'E2E Con teclado' });
    expect(await tabularHasta(page, casilla, 20)).toBe(true);
    await page.keyboard.press('Space');
    await expect(casilla).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(hoja).toBeHidden();
    return;
  }

  await expect(page.getByRole('complementary')).toHaveCount(0);

  const dia = page.getByRole('button', { name: new RegExp(`^${diaEnPalabras(HOY)}, hoy: `) });
  await expect(dia).toHaveAccessibleName(`${diaEnPalabras(HOY)}, hoy: 1 cosa`);
  expect(await tabularHasta(page, dia)).toBe(true);
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: `El ${diaEnPalabras(HOY)}` });
  await expect(panel).toBeFocused();

  const casilla = panel.getByRole('checkbox', { name: 'E2E Con teclado' });
  expect(await tabularHasta(page, casilla, 20)).toBe(true);
  await page.keyboard.press('Space');
  await expect(casilla).toHaveAttribute('aria-checked', 'true');
  await expect(casilla).toBeFocused();
  await expect(dia).toHaveAccessibleName(`${diaEnPalabras(HOY)}, hoy: 1 hecha`);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(dia).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(panel).toBeFocused();
  await page.keyboard.press('Tab');
  const cerrar = panel.getByRole('button', { name: 'Cerrar el día' });
  await expect(cerrar).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(dia).toBeFocused();
});

test('en el celular, cada día con cosas tiene su botón para anotar, que abre la hoja con ese día', async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(!isMobile, 'la lista por día es del celular');
  const fecha = otroDiaDelMes();
  await crearAnotacionPorRest(sesion, {
    fecha,
    texto: 'E2E Traer las manijas',
    categoria: 'materiales',
  });
  await abrirLaAgenda(page);

  const delDia = page.getByRole('region', { name: diaEnPalabras(fecha) });
  const anotar = delDia.getByRole('button', {
    name: `Anotar algo para el ${diaEnPalabras(fecha)}`,
  });
  await expect(anotar).toBeVisible();
  await expect(anotar).toHaveText('Anotar');
  if (fecha !== HOY) {
    await expect(
      page.getByRole('button', { name: `Anotar algo para el ${diaEnPalabras(HOY)}` }),
    ).toHaveCount(1);
  }
  const caja = await cajaDe(anotar);
  console.log(
    `celular: «Anotar» del ${fecha} mide ${String(caja.width)}×${String(caja.height)} px en x=${String(caja.x)}, y=${String(caja.y)}`,
  );
  await page.screenshot({ path: testInfo.outputPath('agenda-celular-anotar-en-el-dia.png') });

  await page.getByRole('main').focus();
  expect(await tabularHasta(page, anotar)).toBe(true);
  await page.keyboard.press('Enter');
  const hoja = page.getByRole('dialog', { name: 'Anotar algo' });
  await expect(hoja).toBeVisible();
  await expect(hoja.getByLabel('Otro día')).toHaveValue(fecha);
  await hoja.getByLabel('Qué hay que hacer').fill('E2E Pasar a buscar los tornillos');
  await hoja.getByRole('radio', { name: /Materiales/ }).click();
  await hoja.getByRole('button', { name: 'Anotarlo' }).click();

  await expect(hoja).toBeHidden();
  await expect(delDia.getByText('E2E Pasar a buscar los tornillos')).toBeVisible();
  await expect
    .poll(async () => (await anotacionesDelTaller(sesion)).map((fila) => [fila.texto, fila.fecha]))
    .toContainEqual(['E2E Pasar a buscar los tornillos', fecha]);
  await page.screenshot({ path: testInfo.outputPath('agenda-celular-anotado-en-el-dia.png') });
});

async function abrirAnotar(page: Page, isMobile: boolean): Promise<Locator> {
  if (isMobile) {
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('button', { name: 'Cargar algo nuevo' })
      .click();
    await page.getByRole('menuitem', { name: 'Anotar algo' }).click();
  } else {
    await page.getByRole('button', { name: 'Anotar algo', exact: true }).click();
  }
  const hoja = page.getByRole('dialog', { name: 'Anotar algo' });
  await expect(hoja).toBeVisible();
  return hoja;
}

function caminosDe(lugar: Locator): Locator {
  return lugar.getByRole('list', { name: /Las visitas y las entregas no se anotan/ });
}

test('desde «Anotar algo», el camino al contacto lleva la visita del día elegido, y la visita aparece en la agenda', async ({
  page,
  isMobile,
}, testInfo) => {
  const lugar = isMobile ? 'celular' : 'escritorio';
  const fecha = otroDiaDelMes();
  await crearCliente(sesion, 'E2E Nora Paz');
  await abrirLaAgenda(page);

  const hoja = await abrirAnotar(page, isMobile);
  await hoja.getByLabel('Otro día').fill(fecha);
  await expect(hoja.getByRole('radio')).toHaveCount(2);
  const caminos = caminosDe(hoja);
  await expect(caminos.getByRole('link')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath(`agenda-caminos-${lugar}-anotar.png`) });

  await caminos.getByRole('link', { name: /Cargar un contacto de seguimiento/ }).click();
  const alta = page.getByRole('dialog', { name: 'Cargar contacto' });
  await expect(alta).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Anotar algo' })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/seguimiento/nuevo\\?visita=${fecha}$`));
  await expect(alta.getByLabel('Visita', { exact: true })).toHaveValue(fecha);
  await page.screenshot({ path: testInfo.outputPath(`agenda-caminos-${lugar}-contacto.png`) });

  await alta.getByRole('combobox', { name: 'Cliente' }).fill('E2E Nora');
  await alta
    .getByRole('option', { name: /E2E Nora Paz/ })
    .first()
    .click();
  await alta.getByLabel('Qué pide').fill('E2E Vestidor de la visita');
  await alta.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E Vestidor de la visita');
  await expect
    .poll(async () => (await leerProyecto(sesion, 'E2E Vestidor de la visita'))?.id)
    .toBeDefined();

  await abrirLaAgenda(page);
  if (isMobile) {
    await expect(page.getByRole('region', { name: diaEnPalabras(fecha) })).toContainText(
      'E2E Vestidor de la visita',
    );
  } else {
    await expect(
      celda(page, fecha).getByRole('button', { name: /E2E Vestidor de la visita/ }),
    ).toBeVisible();
  }
});

test('un día libre ofrece los mismos caminos, y el proyecto sale con la entrega estimada de ese día', async ({
  page,
  isMobile,
}, testInfo) => {
  const lugar = isMobile ? 'celular' : 'escritorio';
  const fecha = otroDiaDelMes();
  await crearCliente(sesion, 'E2E Marcela Sosa');
  await crearAnotacionPorRest(sesion, {
    fecha: fecha === HOY ? diaVecino() : HOY,
    texto: 'E2E Algo en otro día',
  });
  await abrirLaAgenda(page);

  const detalle = await abrirElDia(page, isMobile, fecha);
  await expect(detalle.getByText('Este día está libre')).toBeVisible();
  const caminos = caminosDe(detalle);
  await expect(caminos.getByRole('link')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath(`agenda-caminos-${lugar}-dia-libre.png`) });

  await caminos.getByRole('link', { name: /Cargar un proyecto/ }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/nuevo\\?entrega=${fecha}$`));
  await expect(page.getByLabel('Entrega estimada')).toHaveValue(fecha);
  await expect(page.getByText('Calculada a 21 días hábiles del inicio.')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`agenda-caminos-${lugar}-proyecto.png`) });

  await page.getByRole('combobox', { name: 'Cliente' }).fill('E2E Marcela');
  await page
    .getByRole('option', { name: /E2E Marcela Sosa/ })
    .first()
    .click();
  await page.getByLabel('Trabajo').fill('E2E Cocina para ese día');
  await expect(page.getByLabel('Entrega estimada')).toHaveValue(fecha);
  await page.getByRole('button', { name: 'Guardar proyecto' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E Cocina para ese día');
  await expect
    .poll(async () => (await leerProyecto(sesion, 'E2E Cocina para ese día'))?.id)
    .toBeDefined();

  await abrirLaAgenda(page);
  if (isMobile) {
    await expect(page.getByRole('region', { name: diaEnPalabras(fecha) })).toContainText(
      'E2E Cocina para ese día',
    );
  } else {
    await expect(
      celda(page, fecha).getByRole('button', { name: /E2E Cocina para ese día/ }),
    ).toBeVisible();
  }
});

function diaVecino(): string {
  const dia = Number(HOY.slice(8));
  return delMes(dia === 1 ? 2 : dia - 1);
}

async function abrirElDia(page: Page, isMobile: boolean, fecha: string): Promise<Locator> {
  if (isMobile) {
    await page
      .getByRole('group', { name: 'Días del mes' })
      .getByRole('button', { name: new RegExp(`^${diaEnPalabras(fecha)}`) })
      .click();
    await page.getByRole('button', { name: `Ver el ${diaEnPalabras(fecha)}` }).click();
    return page.getByRole('dialog', { name: diaEnPalabras(fecha) });
  }
  await page.getByRole('button', { name: new RegExp(`^${diaEnPalabras(fecha)}(, hoy)?:`) }).click();
  return page.getByRole('complementary', { name: `El ${diaEnPalabras(fecha)}` });
}

function filaDe(detalle: Locator, texto: string): Locator {
  return detalle.getByRole('listitem').filter({ hasText: texto });
}

async function decoracionDe(elemento: Locator): Promise<string> {
  return elemento.evaluate((nodo) => getComputedStyle(nodo).textDecorationLine);
}

async function recorrerConTab(page: Page, pasos: number): Promise<string[]> {
  const recorrido: string[] = [];
  for (let paso = 0; paso < pasos; paso += 1) {
    recorrido.push(
      await page.evaluate(() => {
        const activo = document.activeElement;
        if (!(activo instanceof HTMLElement)) return '(nada)';
        const rol = activo.getAttribute('role') ?? activo.tagName.toLowerCase();
        const nombre = activo.getAttribute('aria-label') ?? activo.textContent.trim();
        const marcada = activo.getAttribute('aria-checked');
        const estado = marcada === null ? '' : marcada === 'true' ? ', marcada' : ', sin marcar';
        return `${rol} «${nombre}»${estado}`;
      }),
    );
    await page.keyboard.press('Tab');
  }
  return recorrido;
}

test('lo hecho se queda en el día, abajo de lo pendiente, tachado y más bajo, y desmarcarlo lo devuelve arriba', async ({
  page,
  isMobile,
}, testInfo) => {
  const lugar = isMobile ? 'celular' : 'escritorio';
  const leer = async (texto: string) =>
    (await anotacionesDelTaller(sesion)).find((fila) => fila.texto === texto)?.hecha;
  await crearAnotacionPorRest(sesion, {
    fecha: HOY,
    texto: 'E2E Comprar bisagras',
    categoria: 'materiales',
  });
  await crearAnotacionPorRest(sesion, {
    fecha: HOY,
    texto: 'E2E Lijar la puerta',
    categoria: 'taller',
  });
  await crearAnotacionPorRest(sesion, {
    fecha: HOY,
    texto: 'E2E Pasar por el corralón',
    categoria: 'materiales',
    hecha: true,
  });
  await abrirLaAgenda(page);

  if (isMobile) {
    const delDia = page.getByRole('region', { name: diaEnPalabras(HOY) }).getByRole('listitem');
    expect(await delDia.allTextContents()).toEqual([
      expect.stringContaining('E2E Comprar bisagras'),
      expect.stringContaining('E2E Lijar la puerta'),
      expect.stringContaining('E2E Pasar por el corralón, hecha'),
    ]);
  } else {
    await expect(
      page.getByRole('button', { name: `${diaEnPalabras(HOY)}, hoy: 2 cosas y 1 hecha` }),
    ).toBeVisible();
    const chips = celda(page, HOY).locator('button[title]');
    expect(await chips.allTextContents()).toEqual([
      'E2E Comprar bisagras',
      'E2E Lijar la puerta',
      'E2E Pasar por el corralón, hecha',
    ]);
    const chipPendiente = await cajaDe(chips.nth(1));
    const chipHecho = await cajaDe(chips.nth(2));
    console.log(
      `celda: chip pendiente ${String(chipPendiente.height)} px de alto, chip hecho ${String(chipHecho.height)} px`,
    );
    expect(chipHecho.height).toBeLessThan(chipPendiente.height);
    expect(
      await decoracionDe(celda(page, HOY).getByText('E2E Pasar por el corralón', { exact: true })),
    ).toContain('line-through');
  }

  const detalle = await abrirElDia(page, isMobile, HOY);
  const pendiente = detalle.getByRole('list', { name: `Lo pendiente del ${diaEnPalabras(HOY)}` });
  const hecho = detalle.getByRole('list', { name: 'Hecho' });

  await expect(detalle.getByText('2 cosas anotadas · 1 hecha', { exact: true })).toBeVisible();
  await expect(pendiente.getByRole('listitem')).toHaveCount(2);
  await expect(hecho.getByRole('listitem')).toHaveCount(1);
  await expect(hecho.getByRole('checkbox', { name: 'E2E Pasar por el corralón' })).toBeChecked();
  expect(await hecho.getByRole('listitem').textContent()).toContain(
    'E2E Pasar por el corralón, hecha',
  );

  const filaPendiente = await cajaDe(filaDe(detalle, 'E2E Lijar la puerta'));
  const filaHecha = await cajaDe(filaDe(detalle, 'E2E Pasar por el corralón'));
  console.log(
    `${lugar}: fila pendiente ${String(filaPendiente.height)} px de alto en y=${String(filaPendiente.y)}; fila hecha ${String(filaHecha.height)} px en y=${String(filaHecha.y)}`,
  );
  expect(filaHecha.y).toBeGreaterThan(filaPendiente.y);
  expect(filaHecha.height).toBeLessThan(filaPendiente.height);
  expect(
    await decoracionDe(detalle.getByText('E2E Pasar por el corralón', { exact: true })),
  ).toContain('line-through');
  expect(await decoracionDe(detalle.getByText('E2E Lijar la puerta', { exact: true }))).toBe(
    'none',
  );

  const arbol = await detalle.ariaSnapshot();
  console.log(`${lugar}, árbol de accesibilidad del día:\n${arbol}`);
  expect(arbol).toContain('checkbox "E2E Pasar por el corralón" [checked]');
  expect(arbol).toContain('list "Hecho"');

  await detalle.getByRole('checkbox', { name: 'E2E Comprar bisagras' }).focus();
  const recorrido = await recorrerConTab(page, 8);
  console.log(`${lugar}, recorrido con Tab:\n${recorrido.join('\n')}`);
  expect(recorrido.indexOf('checkbox «E2E Lijar la puerta», sin marcar')).toBeLessThan(
    recorrido.indexOf('checkbox «E2E Pasar por el corralón», marcada'),
  );
  expect(recorrido).toContain('checkbox «E2E Pasar por el corralón», marcada');
  await page.screenshot({ path: testInfo.outputPath(`agenda-hechas-${lugar}-mezcla.png`) });

  const lijar = detalle.getByRole('checkbox', { name: 'E2E Lijar la puerta' });
  await lijar.focus();
  await page.keyboard.press('Space');
  await expect(hecho.getByRole('checkbox', { name: 'E2E Lijar la puerta' })).toBeChecked();
  await expect(hecho.getByRole('checkbox', { name: 'E2E Lijar la puerta' })).toBeFocused();
  await expect(hecho.getByRole('listitem')).toHaveCount(2);
  await expect(detalle.getByText('1 cosa anotada · 2 hechas', { exact: true })).toBeVisible();
  expect(await decoracionDe(detalle.getByText('E2E Lijar la puerta', { exact: true }))).toContain(
    'line-through',
  );
  await expect.poll(async () => leer('E2E Lijar la puerta')).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`agenda-hechas-${lugar}-marcada.png`) });

  await hecho.getByRole('checkbox', { name: 'E2E Pasar por el corralón' }).click();
  const devuelta = pendiente.getByRole('checkbox', { name: 'E2E Pasar por el corralón' });
  await expect(devuelta).not.toBeChecked();
  await expect(devuelta).toBeFocused();
  await expect(pendiente.getByRole('listitem')).toHaveCount(2);
  await expect(detalle.getByText('2 cosas anotadas · 1 hecha', { exact: true })).toBeVisible();
  expect(await decoracionDe(detalle.getByText('E2E Pasar por el corralón', { exact: true }))).toBe(
    'none',
  );
  expect((await cajaDe(filaDe(detalle, 'E2E Pasar por el corralón'))).y).toBeLessThan(
    (await cajaDe(filaDe(detalle, 'E2E Lijar la puerta'))).y,
  );
  await expect.poll(async () => leer('E2E Pasar por el corralón')).toBe(false);
  await page.screenshot({ path: testInfo.outputPath(`agenda-hechas-${lugar}-desmarcada.png`) });
});

test('un día con todo hecho no dice que está libre: dice que no queda nada pendiente', async ({
  page,
  isMobile,
}, testInfo) => {
  const lugar = isMobile ? 'celular' : 'escritorio';
  const fecha = diaVecino();
  await crearAnotacionPorRest(sesion, { fecha, texto: 'E2E Cortar los laterales', hecha: true });
  await crearAnotacionPorRest(sesion, { fecha, texto: 'E2E Pegar el canto', hecha: true });
  await abrirLaAgenda(page);

  if (!isMobile) {
    await expect(
      page.getByRole('button', { name: `${diaEnPalabras(fecha)}: 2 hechas` }),
    ).toBeVisible();
  }
  const detalle = await abrirElDia(page, isMobile, fecha);

  await expect(detalle.getByText('2 hechas', { exact: true })).toBeVisible();
  await expect(detalle.getByText('No queda nada pendiente para este día.')).toBeVisible();
  await expect(detalle.getByText('Este día está libre')).toHaveCount(0);
  await expect(detalle.getByRole('list', { name: 'Hecho' }).getByRole('listitem')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath(`agenda-hechas-${lugar}-todo-hecho.png`) });
});

test.describe('en escritorio', () => {
  test.skip(({ isMobile }) => isMobile, 'la grilla del mes es de la PC');

  test('entregas, visitas y vencimientos caen en su día, y cambiar la fecha en el proyecto mueve la entrega sin tocar lo demás', async ({
    page,
  }) => {
    const obraId = await obra('E2E Cocina de Villalba', delMes(10));
    await contacto('E2E Relevamiento UTN', { estado: 'relevamiento', fecha_visita: delMes(11) });
    await contacto('E2E Vestidor', {
      estado: 'a_presupuestar',
      fecha_visita: delMes(9),
      vencimiento_presupuesto: delMes(12),
    });
    await abrirLaAgenda(page);

    await expect(
      celda(page, delMes(10)).getByRole('button', { name: 'Entrega: E2E Cocina de Villalba' }),
    ).toBeVisible();
    await expect(
      celda(page, delMes(11)).getByRole('button', { name: 'Relevamiento: E2E Relevamiento UTN' }),
    ).toBeVisible();
    await expect(
      celda(page, delMes(12)).getByRole('button', { name: 'Presupuesto: E2E Vestidor' }),
    ).toBeVisible();
    await expect(
      celda(page, delMes(9)).getByRole('button', { name: 'Relevamiento: E2E Vestidor' }),
    ).toBeVisible();

    await page.goto(`/proyectos/${obraId}/editar`);
    await page.getByLabel('Entrega estimada').fill(delMes(20));
    await page.getByRole('button', { name: 'Guardar los cambios' }).click();
    await expect(page).not.toHaveURL(/\/editar$/);
    await expect(indicadorDeSync(page)).toBeHidden({ timeout: 20_000 });

    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('button', { name: 'Agenda' })
      .click();
    await expect(
      celda(page, delMes(20)).getByRole('button', { name: 'Entrega: E2E Cocina de Villalba' }),
    ).toBeVisible();
    await expect(celda(page, delMes(10)).getByRole('button', { name: /E2E Cocina/ })).toHaveCount(
      0,
    );
    await expect(
      celda(page, delMes(11)).getByRole('button', { name: 'Relevamiento: E2E Relevamiento UTN' }),
    ).toBeVisible();
    await expect(
      celda(page, delMes(12)).getByRole('button', { name: 'Presupuesto: E2E Vestidor' }),
    ).toBeVisible();
  });

  test('una derivada de la grilla abre su trabajo', async ({ page }) => {
    const obraId = await obra('E2E Biblioteca', delMes(18));
    await abrirLaAgenda(page);

    await celda(page, delMes(18)).getByRole('button', { name: 'Entrega: E2E Biblioteca' }).click();
    await expect(page).toHaveURL(new RegExp(`/proyectos/${obraId}$`));
  });

  test('un día con más de lo que entra en la celda dice cuántas faltan y las muestra todas', async ({
    page,
  }, testInfo) => {
    const dia = delMes(15);
    for (const texto of ['E2E Uno', 'E2E Dos', 'E2E Tres', 'E2E Cuatro', 'E2E Cinco']) {
      await crearAnotacionPorRest(sesion, { fecha: dia, texto });
    }
    await abrirLaAgenda(page);

    const laCelda = celda(page, dia);
    await expect(laCelda.getByText('+2 más')).toBeVisible();
    await expect(laCelda.getByRole('button', { name: /^E2E / })).toHaveCount(3);
    await page.screenshot({ path: testInfo.outputPath('agenda-escritorio-dia-lleno.png') });

    await laCelda
      .getByRole('button', { name: `Ver las 5 cosas del ${diaEnPalabras(dia)}` })
      .click();
    const panel = page.getByRole('complementary', { name: `El ${diaEnPalabras(dia)}` });
    await expect(panel.getByRole('listitem')).toHaveCount(5);
  });
});

function columnaDe(fecha: string): number {
  return (new Date(`${fecha}T12:00:00`).getDay() + 6) % 7;
}

function diaDelMedio(columna: number): string {
  for (let dia = 8; dia <= 21; dia += 1) {
    if (columnaDe(delMes(dia)) === columna) return delMes(dia);
  }
  throw new Error(`no hay un día de la columna ${String(columna)} entre el 8 y el 21`);
}

const ULTIMO_DEL_MES = delMes(
  new Date(Number(MES.slice(0, 4)), Number(MES.slice(5, 7)), 0).getDate(),
);

const CASOS = [
  { nombre: 'lunes', fecha: diaDelMedio(0), fila: 'del medio' },
  { nombre: 'miercoles', fecha: diaDelMedio(2), fila: 'del medio' },
  { nombre: 'viernes', fecha: diaDelMedio(4), fila: 'del medio' },
  { nombre: 'sabado', fecha: diaDelMedio(5), fila: 'del medio' },
  { nombre: 'domingo', fecha: diaDelMedio(6), fila: 'del medio' },
  { nombre: 'primera-fila', fecha: delMes(1), fila: 'primera' },
  { nombre: 'ultima-fila', fecha: ULTIMO_DEL_MES, fila: 'última' },
] as const;

function botonDelDia(page: Page, fecha: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^${diaEnPalabras(fecha)}(, hoy)?:`) });
}

function capaDelDia(page: Page): Locator {
  return page.locator('aside[popover]');
}

interface Caja {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function cajaDe(elemento: Locator): Promise<Caja> {
  const caja = await elemento.boundingBox();
  if (caja === null) throw new Error('el elemento no se ve');
  return caja;
}

async function anchoDe(elemento: Locator): Promise<number> {
  return (await cajaDe(elemento)).width;
}

interface Punta extends Caja {
  direccion: string | null;
}

async function puntaDe(capa: Locator): Promise<Punta> {
  const puntas = await capa.locator('[data-punta]').evaluateAll((elementos) =>
    elementos.map((elemento) => {
      const caja = elemento.getBoundingClientRect();
      return {
        direccion: elemento.getAttribute('data-punta'),
        x: caja.x,
        y: caja.y,
        width: caja.width,
        height: caja.height,
      };
    }),
  );
  const conAncho = puntas.filter((punta) => punta.width > 0);
  expect(conAncho).toHaveLength(1);
  const [punta] = conAncho;
  if (punta === undefined) throw new Error('la capa no tiene punta');
  return punta;
}

function enPixeles(caja: Caja): string {
  return `${caja.width.toFixed(1)}×${caja.height.toFixed(1)} en x=${caja.x.toFixed(1)}, y=${caja.y.toFixed(1)}`;
}

async function laCapaSeAnclaAlDia(
  page: Page,
  ancho: string,
  captura: (archivo: string) => string,
): Promise<void> {
  for (const texto of ['E2E Uno', 'E2E Dos', 'E2E Tres', 'E2E Cuatro']) {
    await crearAnotacionPorRest(sesion, { fecha: ULTIMO_DEL_MES, texto });
  }
  await crearAnotacionPorRest(sesion, {
    fecha: diaDelMedio(2),
    texto: 'E2E Pasar por el corralón',
  });
  await abrirLaAgenda(page);

  const grilla = page.locator('[data-grilla-del-mes]');
  const vista = page.viewportSize();
  if (vista === null) throw new Error('la página no tiene ventana');
  await expect(capaDelDia(page)).toHaveCount(0);
  const disponible = await anchoDe(page.getByRole('main').locator('header').first());
  const cerrada = await anchoDe(grilla);
  console.log(
    `${ancho}: área de contenido ${String(disponible)} px; grilla ${String(cerrada)} px con la capa cerrada`,
  );
  expect(cerrada).toBe(disponible);

  for (const caso of CASOS) {
    const delDia = botonDelDia(page, caso.fecha);
    await delDia.click();
    const capa = page.getByRole('complementary', { name: `El ${diaEnPalabras(caso.fecha)}` });
    await expect(capa).toBeFocused();

    const cajaDeLaCapa = await cajaDe(capa);
    const cajaDeLaCelda = await cajaDe(celda(page, caso.fecha));
    const cajaDeLaGrilla = await cajaDe(grilla);
    const punta = await puntaDe(capa);
    const columna = columnaDe(caso.fecha);
    await page.screenshot({ path: captura(`agenda-capa-${ancho}-${caso.nombre}.png`) });
    console.log(
      `${ancho} ${caso.nombre} (${caso.fecha}, columna ${String(columna + 1)}, fila ${caso.fila}): grilla ${String(cajaDeLaGrilla.width)} px; celda ${enPixeles(cajaDeLaCelda)}; capa ${enPixeles(cajaDeLaCapa)}; punta ${String(punta.direccion)} ${enPixeles(punta)}; ventana ${String(vista.width)}×${String(vista.height)}`,
    );

    expect(cajaDeLaGrilla.width).toBe(cerrada);

    expect(cajaDeLaCapa.x).toBeGreaterThanOrEqual(0);
    expect(cajaDeLaCapa.y).toBeGreaterThanOrEqual(0);
    expect(cajaDeLaCapa.x + cajaDeLaCapa.width).toBeLessThanOrEqual(vista.width);
    expect(cajaDeLaCapa.y + cajaDeLaCapa.height).toBeLessThanOrEqual(vista.height);

    expect(cajaDeLaCapa.width).toBeLessThan(400);
    expect(cajaDeLaCapa.height).toBeLessThan(cajaDeLaGrilla.height);

    if (columna <= 3) {
      expect(cajaDeLaCapa.x).toBeGreaterThanOrEqual(cajaDeLaCelda.x + cajaDeLaCelda.width);
      expect(punta.direccion).toBe('hacia-la-izquierda');
      expect(Math.abs(punta.x - (cajaDeLaCelda.x + cajaDeLaCelda.width))).toBeLessThan(1);
    } else {
      expect(cajaDeLaCapa.x + cajaDeLaCapa.width).toBeLessThanOrEqual(cajaDeLaCelda.x);
      expect(punta.direccion).toBe('hacia-la-derecha');
      expect(Math.abs(punta.x + punta.width - cajaDeLaCelda.x)).toBeLessThan(1);
    }
    expect(punta.y).toBeGreaterThanOrEqual(Math.max(cajaDeLaCapa.y, cajaDeLaCelda.y));
    expect(punta.y + punta.height).toBeLessThanOrEqual(
      Math.min(cajaDeLaCapa.y + cajaDeLaCapa.height, cajaDeLaCelda.y + cajaDeLaCelda.height),
    );

    if (caso.fila === 'primera') {
      expect(Math.abs(cajaDeLaCapa.y - cajaDeLaCelda.y)).toBeLessThan(1);
    }
    if (caso.fila === 'última') {
      expect(cajaDeLaCapa.y).toBeLessThan(cajaDeLaCelda.y);
      expect(
        Math.abs(cajaDeLaCapa.y + cajaDeLaCapa.height - (cajaDeLaCelda.y + cajaDeLaCelda.height)),
      ).toBeLessThan(1);
    }

    await page.keyboard.press('Escape');
    await expect(capaDelDia(page)).toHaveCount(0);
    await expect(delDia).toBeFocused();
  }
}

async function contarLosCierres(capa: Locator): Promise<void> {
  await capa.evaluate((elemento) => {
    elemento.dataset.cierres = '0';
    elemento.addEventListener('toggle', (evento) => {
      if ((evento as ToggleEvent).newState === 'closed') {
        elemento.dataset.cierres = String(Number(elemento.dataset.cierres) + 1);
      }
    });
  });
}

test.describe('la capa del día, a 1440 px', () => {
  test.skip(({ isMobile }) => isMobile, 'en el celular el día es una hoja');

  test('se ancla al día tocado, se abre hacia la izquierda en viernes, sábado y domingo y hacia arriba en la última fila, nunca se sale de la ventana y la grilla sigue midiendo todo el ancho', async ({
    page,
  }, testInfo) => {
    await laCapaSeAnclaAlDia(page, '1440', (archivo) => testInfo.outputPath(archivo));
    expect(await anchoDe(page.locator('[data-grilla-del-mes]'))).toBeGreaterThan(1000);
  });

  test('tocar otro día con la capa abierta la mueve y la da vuelta sin cerrarla, y se cierra con el botón y tocando fuera', async ({
    page,
  }, testInfo) => {
    const lunes = diaDelMedio(0);
    const domingo = delMes(Number(lunes.slice(8)) + 6);
    await abrirLaAgenda(page);
    const capa = capaDelDia(page);

    await botonDelDia(page, lunes).click();
    await expect(
      page.getByRole('complementary', { name: `El ${diaEnPalabras(lunes)}` }),
    ).toBeFocused();
    await contarLosCierres(capa);
    const enElLunes = await cajaDe(capa);
    const celdaDelLunes = await cajaDe(celda(page, lunes));
    expect(enElLunes.x).toBeGreaterThanOrEqual(celdaDelLunes.x + celdaDelLunes.width);
    expect((await puntaDe(capa)).direccion).toBe('hacia-la-izquierda');
    await page.screenshot({ path: testInfo.outputPath('agenda-capa-cambio-1-lunes.png') });

    await botonDelDia(page, domingo).click();
    await expect(
      page.getByRole('complementary', { name: `El ${diaEnPalabras(domingo)}` }),
    ).toBeFocused();
    const enElDomingo = await cajaDe(capa);
    const celdaDelDomingo = await cajaDe(celda(page, domingo));
    await page.screenshot({ path: testInfo.outputPath('agenda-capa-cambio-2-domingo.png') });
    console.log(
      `cambio de día: en el lunes ${lunes} la capa ${enPixeles(enElLunes)}; en el domingo ${domingo} ${enPixeles(enElDomingo)}`,
    );
    expect(enElDomingo.x + enElDomingo.width).toBeLessThanOrEqual(celdaDelDomingo.x);
    expect((await puntaDe(capa)).direccion).toBe('hacia-la-derecha');
    await expect(capa).toHaveAttribute('data-cierres', '0');

    await capa.getByRole('button', { name: 'Cerrar el día' }).click();
    await expect(capa).toHaveCount(0);
    await expect(botonDelDia(page, domingo)).toBeFocused();

    await botonDelDia(page, lunes).click();
    await expect(capa).toBeVisible();
    await page.getByRole('heading', { level: 1, name: 'Agenda' }).click();
    await expect(capa).toHaveCount(0);
  });
});

test.describe('la capa del día, a 1024 px', () => {
  test.skip(({ isMobile }) => isMobile, 'en el celular el día es una hoja');
  test.use({ viewport: { width: 1024, height: 768 } });

  test('se ancla al día tocado, se abre hacia la izquierda en viernes, sábado y domingo y hacia arriba en la última fila, nunca se sale de la ventana y la grilla sigue midiendo todo el ancho', async ({
    page,
  }, testInfo) => {
    await laCapaSeAnclaAlDia(page, '1024', (archivo) => testInfo.outputPath(archivo));
  });

  test('scrollear la agenda con la capa abierta la cierra', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 560 });
    await abrirLaAgenda(page);
    const lunes = diaDelMedio(0);

    await botonDelDia(page, lunes).click();
    const capa = capaDelDia(page);
    await expect(capa).toBeFocused();
    const principal = page.getByRole('main');
    expect(
      await principal.evaluate((elemento) => elemento.scrollHeight > elemento.clientHeight),
    ).toBe(true);

    await principal.evaluate((elemento) => {
      elemento.scrollTop += 120;
    });
    await expect(capa).toHaveCount(0);
  });
});
