import { expect, test, type Locator, type Page } from '@playwright/test';

import { avisosEnPantalla, indicadorDeSync, listoParaCortar } from '../apoyo/pantalla';
import {
  anotacionesDelTaller,
  crearAnotacionPorRest,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
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
  const avisos = isMobile ? detalle : page;
  const casilla = detalle.getByRole('checkbox', { name: 'E2E Pintar la cajonera' });

  await casilla.click();
  await expect(casilla).toHaveAttribute('aria-checked', 'true');
  await expect(
    avisos.getByRole('status').filter({ hasText: 'Listo: E2E Pintar la cajonera.' }),
  ).toBeVisible();
  await expect.poll(async () => (await leer())?.hecha).toBe(true);
  await avisos.getByRole('button', { name: 'Deshacer' }).click();
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
    avisos.getByRole('status').filter({ hasText: 'Borraste «E2E Pintar la cajonera».' }),
  ).toBeVisible();
  await expect.poll(async () => (await anotacionesDelTaller(sesion)).length).toBe(0);
  await avisos.getByRole('button', { name: 'Deshacer' }).click();
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
  await expect(reabierta.getByRole('main').getByText('E2E Retirar el pulpo')).toBeVisible();
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

  const dia = page.getByRole('button', { name: `${diaEnPalabras(HOY)}, hoy: 1 cosa` });
  expect(await tabularHasta(page, dia)).toBe(true);
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: `El ${diaEnPalabras(HOY)}` });
  await expect(panel).toBeVisible();

  const casilla = panel.getByRole('checkbox', { name: 'E2E Con teclado' });
  expect(await tabularHasta(page, casilla)).toBe(true);
  await page.keyboard.press('Space');
  await expect(casilla).toHaveAttribute('aria-checked', 'true');

  const cerrar = panel.getByRole('button', { name: 'Cerrar el día' });
  await cerrar.focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeHidden();
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
