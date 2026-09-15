import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  crearAnotacionPorRest,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerContacto,
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
const NUMERO_DE_HOY = Number(HOY.slice(8));

function delMes(dia: number): string {
  return `${MES}-${String(dia).padStart(2, '0')}`;
}

const AYER_O_HOY = NUMERO_DE_HOY > 1 ? delMes(NUMERO_DE_HOY - 1) : HOY;
const OTRO_DIA_QUE_VIENE = (() => {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const fecha = fechaLocal(manana);
  return fecha.startsWith(MES) ? fecha : HOY;
})();

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

async function contacto(titulo: string, estado: string, visita: string): Promise<string> {
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado,
      presupuesto_centavos: null,
      comprobante: 'sin_comprobante',
      fecha_visita: visita,
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

async function abrirLaFicha(page: Page, id: string): Promise<Locator> {
  await page.goto(`/proyectos/${id}`);
  const panel = page.getByRole('region', { name: 'Qué falta' });
  await expect(panel).toBeVisible(CARGA);
  return panel;
}

function celda(page: Page, fecha: string): Locator {
  return page.locator(`div[data-fecha="${fecha}"]`);
}

async function elDiaEnLaLista(page: Page, fecha: string): Promise<Locator> {
  await page
    .getByRole('group', { name: 'Días del mes' })
    .getByRole('button', { name: new RegExp(`^${diaEnPalabras(fecha)}`) })
    .click();
  return page.getByRole('region', { name: diaEnPalabras(fecha) });
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

async function cerrarElDia(page: Page, detalle: Locator): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(detalle).toBeHidden();
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
        const presionado = activo.getAttribute('aria-pressed');
        const estado = presionado === null ? '' : presionado === 'true' ? ', presionado' : '';
        return `${rol} «${nombre}»${estado}`;
      }),
    );
    await page.keyboard.press('Tab');
  }
  return recorrido;
}

test('entregar un proyecto deja la entrega tachada en su día, sin decir que está atrasada, y volver al taller la devuelve a pendiente', async ({
  page,
  isMobile,
}, testInfo) => {
  const lugar = isMobile ? 'celular' : 'escritorio';
  const titulo = 'E2E Placard entregado';
  const id = await obra(titulo, AYER_O_HOY);

  const panel = await abrirLaFicha(page, id);
  await panel.getByRole('button', { name: 'Ya lo entregué' }).click();
  await expect
    .poll(async () => (await leerProyecto(sesion, titulo))?.estado, CARGA)
    .toBe('entregado');

  await abrirLaAgenda(page);
  await expect(page.getByText('0 compromisos · 0 anotaciones · 1 hecha')).toBeVisible();
  if (isMobile) {
    const fila = (await elDiaEnLaLista(page, AYER_O_HOY))
      .getByRole('listitem')
      .filter({ hasText: titulo });
    await expect(fila).toHaveCount(1);
    expect(await fila.textContent()).toContain(`${titulo}, entregada`);
  } else {
    await expect(
      page.getByRole('button', {
        name: `${diaEnPalabras(AYER_O_HOY)}${AYER_O_HOY === HOY ? ', hoy' : ''}: 1 hecha`,
      }),
    ).toBeVisible();
    const chip = celda(page, AYER_O_HOY).getByRole('button', {
      name: new RegExp(`^Entrega: ${titulo} ?, entregada$`),
    });
    await expect(chip).toBeVisible();
    expect(
      await decoracionDe(celda(page, AYER_O_HOY).getByText(`Entrega: ${titulo}`, { exact: true })),
    ).toContain('line-through');
  }
  await page.screenshot({ path: testInfo.outputPath(`hecho-${lugar}-entrega-en-el-mes.png`) });

  const detalle = await abrirElDia(page, isMobile, AYER_O_HOY);
  await expect(detalle.getByText('1 hecha', { exact: true })).toBeVisible();
  await expect(detalle.getByText('No queda nada pendiente para este día.')).toBeVisible();
  await expect(detalle.getByText('Este día está libre')).toHaveCount(0);
  const hecho = detalle.getByRole('list', { name: 'Hecho' });
  await expect(hecho.getByRole('listitem').filter({ hasText: titulo })).toHaveCount(1);
  await expect(detalle.getByText(/atrasada/)).toHaveCount(0);
  await expect(detalle.getByText('es hoy', { exact: true })).toHaveCount(0);
  expect(await decoracionDe(detalle.getByText(titulo, { exact: true }))).toContain('line-through');
  await expect(hecho.getByRole('button', { name: `Abrir el proyecto: ${titulo}` })).toBeVisible();
  const arbol = await detalle.ariaSnapshot();
  console.log(`${lugar}, el día con la entrega hecha:\n${arbol}`);
  expect(arbol).toContain('list "Hecho"');
  expect(arbol).toMatch(new RegExp(`${titulo} ?, entregada`));
  await page.screenshot({ path: testInfo.outputPath(`hecho-${lugar}-entrega-en-el-dia.png`) });
  await cerrarElDia(page, detalle);

  const deVuelta = await abrirLaFicha(page, id);
  await deVuelta.getByRole('button', { name: 'Volvió al taller' }).click();
  await expect
    .poll(async () => (await leerProyecto(sesion, titulo))?.estado, CARGA)
    .toBe('en_curso');

  await abrirLaAgenda(page);
  await expect(page.getByText('1 compromiso · 0 anotaciones')).toBeVisible();
  const pendiente = await abrirElDia(page, isMobile, AYER_O_HOY);
  await expect(pendiente.getByRole('list', { name: 'Hecho' })).toHaveCount(0);
  const fila = pendiente.getByRole('listitem').filter({ hasText: titulo });
  await expect(fila).toContainText('Sale de la entrega estimada del proyecto');
  await expect(fila).toContainText(AYER_O_HOY === HOY ? 'es hoy' : /atrasada/);
  expect(await decoracionDe(pendiente.getByText(titulo, { exact: true }))).toBe('none');
  await page.screenshot({
    path: testInfo.outputPath(`hecho-${lugar}-entrega-vuelta-al-taller.png`),
  });
});

test('la visita anotada como hecha sigue tachada al ir y volver entre etapas, y destildarla en la hoja la devuelve a pendiente', async ({
  page,
  isMobile,
}, testInfo) => {
  const lugar = isMobile ? 'celular' : 'escritorio';
  const titulo = 'E2E Vestidor relevado';
  const id = await contacto(titulo, 'relevamiento', AYER_O_HOY);
  const enLaBase = async () => {
    const fila = await leerContacto(sesion, titulo);
    return fila === undefined ? undefined : `${fila.estado} ${String(fila.visita_hecha)}`;
  };

  const panel = await abrirLaFicha(page, id);
  await panel.getByRole('button', { name: 'Ya fui a relevar' }).click();
  await panel.getByRole('button', { name: 'Anotar el relevamiento' }).click();
  await expect.poll(enLaBase, CARGA).toBe('a_presupuestar true');

  for (const [etapa, estado] of [
    ['Contacto', 'contacto'],
    ['Relevamiento', 'relevamiento'],
    ['A presupuestar', 'a_presupuestar'],
    ['Relevamiento', 'relevamiento'],
  ] as const) {
    await panel.getByRole('radio', { name: etapa }).click();
    await expect(panel.getByRole('radio', { name: etapa })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(enLaBase, CARGA).toBe(`${estado} true`);
  }

  await abrirLaAgenda(page);
  if (isMobile) {
    const fila = (await elDiaEnLaLista(page, AYER_O_HOY))
      .getByRole('listitem')
      .filter({ hasText: titulo });
    expect(await fila.textContent()).toContain(`${titulo}, ya fuiste`);
  } else {
    await expect(
      celda(page, AYER_O_HOY).getByRole('button', {
        name: new RegExp(`^Relevamiento: ${titulo} ?, ya fuiste$`),
      }),
    ).toBeVisible();
  }
  const detalle = await abrirElDia(page, isMobile, AYER_O_HOY);
  await expect(
    detalle.getByRole('list', { name: 'Hecho' }).getByRole('listitem').filter({ hasText: titulo }),
  ).toHaveCount(1);
  await expect(detalle.getByText(/atrasada/)).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath(`hecho-${lugar}-visita-tras-cambiar-de-etapa.png`),
  });
  await cerrarElDia(page, detalle);

  await abrirLaFicha(page, id);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const hoja = page.getByRole('dialog', { name: 'Editar el contacto' });
  const casilla = hoja.getByRole('checkbox', { name: /^Ya fui a relevar/ });
  await expect(casilla).toBeChecked();
  await casilla.uncheck();
  await hoja.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(hoja).toBeHidden();
  await expect.poll(enLaBase, CARGA).toBe('relevamiento false');

  await abrirLaAgenda(page);
  const pendiente = await abrirElDia(page, isMobile, AYER_O_HOY);
  await expect(pendiente.getByRole('list', { name: 'Hecho' })).toHaveCount(0);
  await expect(pendiente.getByRole('listitem').filter({ hasText: titulo })).toContainText(
    'Sale de la fecha de visita del contacto',
  );
});

test('una visita, una entrega y una anotación se marcan con el mismo círculo, y el filtro Marcado trae las tres', async ({
  page,
  isMobile,
}, testInfo) => {
  const lugar = isMobile ? 'celular' : 'escritorio';
  const dia = OTRO_DIA_QUE_VIENE;
  await contacto('E2E Visita a marcar', 'relevamiento', dia);
  await obra('E2E Entrega a marcar', dia);
  await crearAnotacionPorRest(sesion, { fecha: dia, texto: 'E2E Anotación a marcar' });
  await crearAnotacionPorRest(sesion, { fecha: dia, texto: 'E2E Anotación sin marcar' });

  await abrirLaAgenda(page);
  const detalle = await abrirElDia(page, isMobile, dia);
  for (const texto of ['E2E Visita a marcar', 'E2E Entrega a marcar', 'E2E Anotación a marcar']) {
    const fila = detalle.getByRole('listitem').filter({ hasText: texto });
    await fila.getByRole('button', { name: 'Marcar como importante' }).click();
    await expect(
      fila.getByRole('button', { name: 'Sacarle la marca de importante' }),
    ).toHaveAttribute('aria-pressed', 'true');
  }
  await expect
    .poll(async () => (await leerProyecto(sesion, 'E2E Visita a marcar'))?.visita_importante, CARGA)
    .toBe(true);
  await expect
    .poll(
      async () => (await leerProyecto(sesion, 'E2E Entrega a marcar'))?.entrega_importante,
      CARGA,
    )
    .toBe(true);
  expect((await leerProyecto(sesion, 'E2E Entrega a marcar'))?.visita_importante).toBe(false);

  const arbol = await detalle.ariaSnapshot();
  console.log(`${lugar}, el día con tres marcados:\n${arbol}`);
  expect(arbol.match(/button "Sacarle la marca de importante" \[pressed\]/g)).toHaveLength(3);
  await page.screenshot({ path: testInfo.outputPath(`marcado-${lugar}-el-dia.png`) });
  await cerrarElDia(page, detalle);

  if (isMobile) {
    await expect(
      page
        .getByRole('group', { name: 'Días del mes' })
        .getByRole('button', { name: new RegExp(`^${diaEnPalabras(dia)}.*, con algo marcado$`) }),
    ).toBeVisible();
    return;
  }

  await page
    .getByRole('group', { name: 'Qué mostrar' })
    .getByRole('button', { name: 'Marcado' })
    .click();
  const laCelda = celda(page, dia);
  await expect(
    laCelda.getByRole('button', { name: 'Relevamiento: E2E Visita a marcar' }),
  ).toBeVisible();
  await expect(
    laCelda.getByRole('button', { name: 'Entrega: E2E Entrega a marcar' }),
  ).toBeVisible();
  await expect(laCelda.getByRole('button', { name: 'E2E Anotación a marcar' })).toBeVisible();
  await expect(laCelda.getByRole('button', { name: 'E2E Anotación sin marcar' })).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: new RegExp(`^${diaEnPalabras(dia)}(, hoy)?: 3 cosas, con algo marcado$`),
    }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('marcado-escritorio-filtro.png') });

  await page
    .getByRole('group', { name: 'Qué mostrar' })
    .getByRole('button', { name: 'Todo' })
    .click();
  await expect(
    page.getByRole('button', {
      name: new RegExp(`^${diaEnPalabras(dia)}(, hoy)?: 4 cosas, con algo marcado$`),
    }),
  ).toBeVisible();
  await expect(laCelda.getByText('+1 más', { exact: true })).toBeVisible();
});

test('con el teclado, en el día: lo hecho se anuncia con su palabra y lo marcado con el botón presionado', async ({
  page,
  isMobile,
}) => {
  const lugar = isMobile ? 'celular' : 'escritorio';
  const titulo = 'E2E Cocina lista';
  const id = await obra(titulo, AYER_O_HOY);
  await contacto('E2E Visita del mismo día', 'relevamiento', AYER_O_HOY);

  const panel = await abrirLaFicha(page, id);
  await panel.getByRole('button', { name: 'Ya lo entregué' }).click();
  await expect
    .poll(async () => (await leerProyecto(sesion, titulo))?.estado, CARGA)
    .toBe('entregado');

  await abrirLaAgenda(page);
  const detalle = await abrirElDia(page, isMobile, AYER_O_HOY);
  const visita = detalle.getByRole('listitem').filter({ hasText: 'E2E Visita del mismo día' });
  await visita.getByRole('button', { name: 'Marcar como importante' }).focus();
  await page.keyboard.press('Enter');
  await expect(
    visita.getByRole('button', { name: 'Sacarle la marca de importante' }),
  ).toHaveAttribute('aria-pressed', 'true');

  await detalle.getByRole('button', { name: 'Abrir el contacto' }).focus();
  const recorrido = await recorrerConTab(page, 6);
  console.log(`${lugar}, recorrido con Tab desde la visita:\n${recorrido.join('\n')}`);
  expect(recorrido).toContain('button «Sacarle la marca de importante», presionado');
  expect(recorrido).toContain(`button «Abrir el proyecto: ${titulo}»`);

  const arbol = await detalle.ariaSnapshot();
  console.log(`${lugar}, árbol del día con una hecha y una marcada:\n${arbol}`);
  expect(arbol).toMatch(new RegExp(`${titulo} ?, entregada`));
  expect(arbol).toContain('button "Sacarle la marca de importante" [pressed]');
});
