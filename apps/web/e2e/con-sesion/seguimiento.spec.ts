import { expect, test, type Locator, type Page } from '@playwright/test';

import { listoParaCortar } from '../apoyo/pantalla';
import {
  contactoPorRpc,
  distribucionDe,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  leerProyecto,
  proximosContactosDe,
  seguimientoPorRpc,
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

const HOY = hoyEnElTaller();

function enMeses(fecha: string, meses: number): string {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  const total = anio * 12 + mes - 1 + meses;
  const anioNuevo = Math.floor(total / 12);
  const mesNuevo = total - anioNuevo * 12;
  const ultimo = new Date(Date.UTC(anioNuevo, mesNuevo + 1, 0)).getUTCDate();
  const elegido = new Date(Date.UTC(anioNuevo, mesNuevo, Math.min(dia, ultimo)));
  return elegido.toISOString().slice(0, 10);
}

function enDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
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

async function esperarQueSeAsiente(elemento: Locator): Promise<void> {
  let previa = '';
  await expect
    .poll(
      async () => {
        const caja = await elemento.boundingBox();
        const ahora = caja === null ? '' : `${String(caja.y)}×${String(caja.height)}`;
        const quieta = ahora !== '' && ahora === previa;
        previa = ahora;
        return quieta;
      },
      { timeout: 5_000, intervals: [100] },
    )
    .toBe(true);
}

async function abrirElDeHoy(page: Page, isMobile: boolean): Promise<Locator> {
  await page.goto('/agenda');
  if (isMobile) {
    await page
      .getByRole('group', { name: 'Días del mes' })
      .getByRole('button', { name: new RegExp(`^${diaEnPalabras(HOY)}`) })
      .click();
    await page.getByRole('button', { name: `Ver el ${diaEnPalabras(HOY)}` }).click();
    const hoja = page.getByRole('dialog', { name: diaEnPalabras(HOY) });
    await esperarQueSeAsiente(hoja);
    return hoja;
  }
  await page.getByRole('button', { name: new RegExp(`^${diaEnPalabras(HOY)}(, hoy)?:`) }).click();
  const capa = page.getByRole('complementary', { name: `El ${diaEnPalabras(HOY)}` });
  await esperarQueSeAsiente(capa);
  return capa;
}

async function esperarEstado(titulo: string, estado: string): Promise<void> {
  await expect.poll(async () => (await leerProyecto(sesion, titulo))?.estado, CARGA).toBe(estado);
}

test('una consulta que dijo «por ahora no» pasa a seguimiento, sigue con otra fecha y vuelve a las consultas', async ({
  page,
}) => {
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Placard de Lucía',
    estado: 'presupuesto_enviado',
    telefono: '11 5555 1234',
  });

  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: 'Por ahora no' }).click();
  const hoja = page.getByRole('dialog', { name: 'Por ahora no' });
  await hoja.getByRole('button', { name: 'Pasar a seguimiento' }).click();
  await expect(hoja.getByText('Elegí el día en que le volvés a escribir.')).toBeVisible();
  await hoja.getByRole('button', { name: /^En un mes/ }).click();
  await hoja.getByLabel('Nota').fill('Después de las vacaciones');
  await hoja.getByRole('button', { name: 'Pasar a seguimiento' }).click();

  const proximo = page.getByRole('region', { name: 'Próximo contacto' });
  await expect(proximo).toContainText('Le volvés a escribir el');
  await expect(proximo).toContainText('Después de las vacaciones');
  await esperarEstado(titulo, 'en_seguimiento');
  await expect.poll(async () => (await proximosContactosDe(sesion, id)).length, CARGA).toBe(1);
  expect((await proximosContactosDe(sesion, id))[0]).toMatchObject({
    fecha: enMeses(HOY, 1),
    nota: 'Después de las vacaciones',
    etapa_previa: 'presupuesto_enviado',
    hecho_el: null,
  });

  await page.goto('/proyectos?etapa=seguimiento');
  await expect(page.getByRole('tab', { name: /^Seguimiento\s*1/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('list', { name: 'En seguimiento' })).toContainText(titulo);
  await expect(page.getByRole('list', { name: 'En seguimiento' })).toContainText(
    'Presupuesto enviado',
  );
  await page.getByRole('tab', { name: /^Consultas/ }).click();
  await expect(page).toHaveURL(/\/consultas$/);
  await expect(page.getByRole('link', { name: titulo, exact: true })).toHaveCount(0);

  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: 'Registrar el contacto' }).click();
  const registro = page.getByRole('dialog', { name: 'Registrar el contacto' });
  await expect(registro.getByRole('link', { name: /por WhatsApp$/ })).toBeVisible();
  await expect(registro.getByRole('link', { name: /^Llamar a/ })).toBeVisible();
  await registro.getByLabel('Qué te contestó').fill('Que le escriba en tres meses');
  await registro.getByRole('radio', { name: /^Todavía no/ }).click();
  await registro.getByRole('button', { name: /^En tres meses/ }).click();
  await registro.getByRole('button', { name: 'Guardar la fecha nueva' }).click();
  await expect(registro).toBeHidden();

  const historia = page.getByRole('region', { name: 'Historia del seguimiento' });
  await expect(historia).toContainText('Siguió en seguimiento con otra fecha');
  await expect(historia).toContainText('Que le escriba en tres meses');
  await expect
    .poll(async () => (await proximosContactosDe(sesion, id)).map((fila) => fila.hecho_el), CARGA)
    .toEqual([HOY, null]);
  expect((await proximosContactosDe(sesion, id))[1]?.fecha).toBe(enMeses(HOY, 3));

  await page.getByRole('button', { name: 'Registrar el contacto' }).click();
  await registro.getByRole('radio', { name: /^Vuelve/ }).click();
  await expect(registro.getByLabel('Vuelve a')).toHaveValue('presupuesto_enviado');
  await registro.getByRole('button', { name: 'Volver a las consultas' }).click();

  await expect(page.getByRole('link', { name: 'Consultas', exact: true })).toBeVisible(CARGA);
  await esperarEstado(titulo, 'presupuesto_enviado');
  await expect
    .poll(async () => (await proximosContactosDe(sesion, id)).map((fila) => fila.resultado), CARGA)
    .toEqual(['otra_fecha', 'reactivado']);
});

test('desde la agenda: volver a escribirle cae en su día, se marca, y registrar «no va» lleva al cierre y queda en el historial', async ({
  page,
  isMobile,
}) => {
  const { id, titulo } = await seguimientoPorRpc(sesion, {
    titulo: 'Vestidor de Marcos',
    fecha: HOY,
    nota: 'Cuando cobre el aguinaldo',
  });

  const dia = await abrirElDeHoy(page, isMobile);
  const fila = dia.locator('[data-derivada^="seguimiento:"]');
  await expect(fila).toContainText('Volver a escribirle a');
  await expect(fila).toContainText(`Cliente de ${titulo}`);

  await fila.getByRole('button', { name: 'Marcar como importante' }).click();
  await expect
    .poll(async () => (await proximosContactosDe(sesion, id))[0]?.importante, CARGA)
    .toBe(true);

  await fila.getByRole('button', { name: 'Registrar el contacto' }).click();
  const registro = page.getByRole('dialog', { name: 'Registrar el contacto' });
  await registro.getByLabel('Qué te contestó').fill('Se compró uno hecho');
  await registro.getByRole('radio', { name: /^No va/ }).click();
  await registro.getByRole('button', { name: 'Seguir al cierre' }).click();

  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}/cerrar$`), CARGA);
  await page.getByRole('button', { name: /^Dar por perdido y liquidar/ }).click();
  await esperarEstado(titulo, 'perdido');
  await expect
    .poll(async () => (await proximosContactosDe(sesion, id))[0], CARGA)
    .toMatchObject({ hecho_el: HOY, resultado: 'perdido', respuesta: 'Se compró uno hecho' });

  await page.goto('/proyectos?etapa=historial');
  await expect(page.getByRole('link', { name: titulo, exact: true }).first()).toBeVisible(CARGA);
  await page.goto('/proyectos?etapa=seguimiento');
  await expect(page.getByRole('heading', { name: 'Nadie en seguimiento' })).toBeVisible();
});

test('de punta a punta: en seguimiento para hoy, en la agenda, «todavía no» con fecha nueva, reactivar y aprobar por el camino de siempre', async ({
  page,
  isMobile,
}) => {
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Cocina de Lucía',
    estado: 'presupuesto_enviado',
    telefono: '11 5555 1234',
  });

  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: 'Por ahora no' }).click();
  const hoja = page.getByRole('dialog', { name: 'Por ahora no' });
  await hoja.getByLabel('Otro día').fill(HOY);
  await hoja.getByRole('button', { name: 'Pasar a seguimiento' }).click();
  await esperarEstado(titulo, 'en_seguimiento');

  const dia = await abrirElDeHoy(page, isMobile);
  const fila = dia.locator('[data-derivada^="seguimiento:"]');
  await expect(fila).toHaveAttribute('data-hecha', 'false');
  await expect(fila).toContainText('Volver a escribirle a');
  await fila.getByRole('button', { name: 'Registrar el contacto' }).click();
  const registro = page.getByRole('dialog', { name: 'Registrar el contacto' });
  await registro.getByLabel('Qué te contestó').fill('Que le escriba en un mes');
  await registro.getByRole('radio', { name: /^Todavía no/ }).click();
  await registro.getByRole('button', { name: /^En un mes/ }).click();
  await registro.getByRole('button', { name: 'Guardar la fecha nueva' }).click();
  await expect(registro).toBeHidden();

  await expect
    .poll(async () => (await proximosContactosDe(sesion, id)).map((fila) => fila.hecho_el), CARGA)
    .toEqual([HOY, null]);
  const despues = await abrirElDeHoy(page, isMobile);
  await expect(despues.locator('[data-derivada^="seguimiento:"]')).toHaveAttribute(
    'data-hecha',
    'true',
  );
  const [hecho, nuevo] = await proximosContactosDe(sesion, id);
  expect(hecho).toMatchObject({ fecha: HOY, resultado: 'otra_fecha' });
  expect(nuevo?.fecha).toBe(enMeses(HOY, 1));

  await page.goto(`/proyectos/${id}`);
  await expect(page.getByRole('region', { name: 'Próximo contacto' })).toContainText(
    'Le volvés a escribir el',
  );
  await page.getByRole('button', { name: 'Registrar el contacto' }).click();
  await registro.getByRole('radio', { name: /^Vuelve/ }).click();
  await expect(registro.getByLabel('Vuelve a')).toHaveValue('presupuesto_enviado');
  await registro.getByRole('button', { name: 'Volver a las consultas' }).click();
  await esperarEstado(titulo, 'presupuesto_enviado');

  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: 'Lo aprobó: pasar a Proyectos' }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}/aprobar$`));
  await page.getByLabel('Presupuesto aprobado').fill('1.000.000');
  await page.getByLabel('Seña que cobrás ahora').fill('');
  await page.getByRole('button', { name: 'Pasar a Proyectos' }).click();
  await esperarEstado(titulo, 'en_curso');
  expect((await proximosContactosDe(sesion, id)).map((fila) => fila.resultado)).toEqual([
    'otra_fecha',
    'reactivado',
  ]);
});

test('dar por perdido desde el seguimiento, con seña: la liquida como siempre, cierra el pendiente y queda en Historial', async ({
  page,
}) => {
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Vestidor que no salió',
    estado: 'presupuesto_enviado',
    sena: 20_000_000,
  });

  await page.goto(`/proyectos/${id}`);
  await page.getByRole('button', { name: 'Por ahora no' }).click();
  const hoja = page.getByRole('dialog', { name: 'Por ahora no' });
  await hoja.getByRole('button', { name: /^En una semana/ }).click();
  await hoja.getByRole('button', { name: 'Pasar a seguimiento' }).click();
  await esperarEstado(titulo, 'en_seguimiento');

  await page.goto(`/proyectos/${id}`);
  await expect(page.getByRole('region', { name: 'Si no sale' })).toContainText('$ 200.000');
  await page.getByRole('button', { name: 'Dar por perdido' }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}/cerrar$`));
  await page.getByRole('button', { name: /^Dar por perdido y liquidar/ }).click();

  await esperarEstado(titulo, 'perdido');
  const congelada = await distribucionDe(sesion, id);
  expect(congelada?.dist_cobrado_centavos).toBe(20_000_000);
  expect(congelada?.dist_diezmo_centavos).toBe(2_000_000);
  expect(congelada?.dist_sueldo_centavos).toBe(0);
  expect(await proximosContactosDe(sesion, id)).toMatchObject([
    { hecho_el: congelada?.fecha_cobro, resultado: 'perdido' },
  ]);

  await page.goto('/proyectos?etapa=historial');
  await expect(page.getByRole('link', { name: titulo, exact: true }).first()).toBeVisible(CARGA);
});

test('sin señal: pasar a seguimiento y registrar el contacto esperan en la cola, sobreviven a cerrar la app y llegan una sola vez', async ({
  page,
  context,
}) => {
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Rack sin señal',
    estado: 'presupuesto_enviado',
  });

  await page.goto(`/proyectos/${id}`);
  await listoParaCortar(page);
  await context.setOffline(true);

  await page.getByRole('button', { name: 'Por ahora no' }).click();
  const hoja = page.getByRole('dialog', { name: 'Por ahora no' });
  await hoja.getByRole('button', { name: /^En una semana/ }).click();
  await hoja.getByRole('button', { name: 'Pasar a seguimiento' }).click();
  await expect(page.getByRole('region', { name: 'Próximo contacto' })).toBeVisible(CARGA);

  await page.getByRole('button', { name: 'Registrar el contacto' }).click();
  const registro = page.getByRole('dialog', { name: 'Registrar el contacto' });
  await registro.getByLabel('Qué te contestó').fill('Sin señal, pero le escribí');
  await registro.getByRole('radio', { name: /^Todavía no/ }).click();
  await registro.getByRole('button', { name: /^En un mes/ }).click();
  await registro.getByRole('button', { name: 'Guardar la fecha nueva' }).click();
  await expect(registro).toBeHidden();
  await expect(page.getByRole('region', { name: 'Historia del seguimiento' })).toContainText(
    'Sin señal, pero le escribí',
  );
  expect(await proximosContactosDe(sesion, id)).toHaveLength(0);

  await page.waitForTimeout(500);
  await page.close();
  const reabierta = await context.newPage();
  await reabierta.goto(`/proyectos/${id}`);
  await expect(reabierta.getByRole('region', { name: 'Historia del seguimiento' })).toContainText(
    'Sin señal, pero le escribí',
    CARGA,
  );

  await context.setOffline(false);
  await esperarEstado(titulo, 'en_seguimiento');
  await expect
    .poll(async () => (await proximosContactosDe(sesion, id)).map((fila) => fila.hecho_el), CARGA)
    .toEqual([HOY, null]);
  await reabierta.waitForTimeout(3_000);
  const contactos = await proximosContactosDe(sesion, id);
  expect(contactos).toHaveLength(2);
  expect(contactos.map((fila) => [fila.fecha, fila.resultado])).toEqual([
    [enDias(HOY, 7), 'otra_fecha'],
    [enMeses(HOY, 1), null],
  ]);
});

test('las cuatro pestañas entran enteras en el ancho de la pantalla', async ({ page }) => {
  await page.goto('/consultas');
  const pestanas = page.getByRole('tab');
  await expect(pestanas).toHaveCount(4);
  await expect(pestanas).toHaveText([/^Consultas/, /^Seguimiento/, /^Activos/, /^Historial/]);

  const ancho = page.viewportSize()?.width ?? 0;
  for (const pestana of await pestanas.all()) {
    const caja = await pestana.boundingBox();
    expect(caja).not.toBeNull();
    if (caja === null) continue;
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(ancho);
    expect(
      await pestana.evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth + 1),
    ).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    ancho,
  );
});

test.describe('en el celular más angosto', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('las cuatro pestañas entran enteras a 360', async ({ page }) => {
    await page.goto('/proyectos?etapa=seguimiento');
    const pestanas = page.getByRole('tab');
    await expect(pestanas).toHaveCount(4);
    for (const pestana of await pestanas.all()) {
      const caja = await pestana.boundingBox();
      if (caja === null) throw new Error('una pestaña no se ve');
      expect(caja.x + caja.width).toBeLessThanOrEqual(360);
      expect(
        await pestana.evaluate((elemento) => elemento.scrollWidth <= elemento.clientWidth + 1),
      ).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
  });
});
