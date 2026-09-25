import { expect, test, type Page } from '@playwright/test';

import {
  diaHabilDesdeHoy,
  entregaDe,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  proponerPorRpc,
  propuestasDe,
  respuestasDeEntregaDe,
  responderComoCliente,
  sembrarEntregas,
  trabajoListoConEnlace,
  vaciarTaller,
  type SesionDePrueba,
  type TrabajoListo,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const SOLA = { timeout: 10_000 };

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

function queFalta(page: Page) {
  return page.getByRole('region', { name: 'Qué falta' });
}

function laEntrega(page: Page) {
  return page.getByRole('region', { name: 'La entrega' });
}

async function abrirLaFicha(page: Page, trabajo: TrabajoListo): Promise<void> {
  await page.goto(`/proyectos/${trabajo.id}`);
  await expect(page.getByRole('heading', { level: 1, name: trabajo.titulo })).toBeVisible(CARGA);
}

async function abrirInicio(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible(CARGA);
  await expect(page.getByRole('status').filter({ hasText: /Trayendo los datos/ })).toHaveCount(
    0,
    CARGA,
  );
}

async function susDias(trabajo: TrabajoListo): Promise<string> {
  const id = crypto.randomUUID();
  await proponerPorRpc(sesion, trabajo.id, { id, forma: 'sus_dias', fecha: null, franja: null });
  return id;
}

test('«Ya está listo» en «Qué falta», y la vista previa lo muestra sin guardar nada', async ({
  page,
}) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Placard de pasillo',
    cliente: 'Cintia Paz',
    listo: false,
  });
  await abrirLaFicha(page, trabajo);

  await queFalta(page).getByRole('button', { name: 'Ya está listo' }).click();
  await expect(queFalta(page)).toContainText('Falta acordar la entrega');
  await expect
    .poll(async () => (await entregaDe(sesion, trabajo.id))?.listo_el, CARGA)
    .toBe(hoyEnElTaller());
  await expect(page.getByText('Listo', { exact: true }).first()).toBeVisible();

  await laEntrega(page).getByRole('button', { name: 'Proponerle un día' }).click();
  const hoja = page.getByRole('dialog', { name: 'Proponerle un día' });
  const dia = diaHabilDesdeHoy(6);
  await hoja.getByLabel('Día').fill(dia);
  await hoja.getByRole('radio', { name: 'A la tarde' }).click();
  await hoja.getByRole('button', { name: 'Proponérselo' }).click();
  await expect(hoja).toHaveCount(0, CARGA);
  await expect(laEntrega(page)).toContainText('Le propusiste el', CARGA);
  const [propuesta] = await propuestasDe(sesion, trabajo.id);
  expect(propuesta).toMatchObject({
    forma: 'un_dia',
    fecha: dia,
    franja: 'tarde',
    cerrada_at: null,
  });

  await page.goto(`/proyectos/${trabajo.id}/vista-cliente`);
  const coordinar = page.getByRole('region', { name: 'Coordinemos la entrega' });
  await expect(coordinar).toContainText('Te proponemos este día:', CARGA);
  await expect(coordinar).toContainText('Acá no se guarda nada: así lo ve tu cliente.');
  await coordinar.getByRole('button', { name: 'Me queda bien' }).click();
  expect((await entregaDe(sesion, trabajo.id))?.entrega_comprometida).toBeNull();
  expect(await respuestasDeEntregaDe(sesion, trabajo.id)).toHaveLength(0);
});

test('lo que contesta el cliente llega solo a Inicio, y abrir la ficha lo da por leído', async ({
  page,
}) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Vestidor en L',
    cliente: 'Hernán Cabrera',
  });
  const propuesta = await susDias(trabajo);
  await abrirInicio(page);

  const primero = diaHabilDesdeHoy(3);
  expect(
    await responderComoCliente(sesion, trabajo.token, {
      id: crypto.randomUUID(),
      propuesta_id: propuesta,
      respuesta: 'mis_dias',
      dias: [{ fecha: primero, franjas: ['manana', 'tarde'] }],
      nota: 'Portero hasta las 18',
    }),
  ).toEqual({ estado: 'guardada' });

  const aviso = page.getByRole('link', { name: /Hernán Cabrera te pasó sus días/ });
  await expect(aviso).toBeVisible(SOLA);
  await aviso.click();
  await expect(laEntrega(page)).toContainText(
    'Hernán Cabrera te pasó sus días. Confirmá uno:',
    CARGA,
  );
  await expect(laEntrega(page)).toContainText('Portero hasta las 18');
  await expect
    .poll(async () => (await respuestasDeEntregaDe(sesion, trabajo.id))[0]?.leida_at ?? null, CARGA)
    .not.toBeNull();

  await abrirInicio(page);
  await expect(page.getByRole('link', { name: /te pasó sus días/ })).toHaveCount(0);
});

test('confirmar uno de sus días compromete la entrega y cierra el pedido', async ({ page }) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Biblioteca',
    cliente: 'Marcela Duarte',
  });
  const propuesta = await susDias(trabajo);
  const primero = diaHabilDesdeHoy(4);
  const segundo = diaHabilDesdeHoy(7);
  await responderComoCliente(sesion, trabajo.token, {
    id: crypto.randomUUID(),
    propuesta_id: propuesta,
    respuesta: 'mis_dias',
    dias: [
      { fecha: primero, franjas: ['tarde'] },
      { fecha: segundo, franjas: ['manana', 'tarde'] },
    ],
    nota: '',
  });

  await abrirLaFicha(page, trabajo);
  const confirmar = laEntrega(page).getByRole('button', { name: /^Confirmar el/ });
  await expect(confirmar).toHaveCount(3, CARGA);
  await confirmar.nth(1).click();

  await expect(queFalta(page)).toContainText('Entrega comprometida:', CARGA);
  await expect
    .poll(async () => (await entregaDe(sesion, trabajo.id))?.entrega_comprometida, CARGA)
    .toBe(segundo);
  expect((await entregaDe(sesion, trabajo.id))?.entrega_comprometida_franja).toBe('manana');
  await expect
    .poll(
      async () => (await propuestasDe(sesion, trabajo.id)).every((una) => una.cerrada_at !== null),
      CARGA,
    )
    .toBe(true);
  await expect(laEntrega(page)).not.toContainText('te pasó sus días');
});

test('«Todavía no está listo» lo vuelve a fabricación y «Ya lo entregué» anota hoy', async ({
  page,
}) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Rack de living',
    cliente: 'Graciela Ruiz',
  });
  await abrirLaFicha(page, trabajo);
  await expect(queFalta(page)).toContainText('Falta acordar la entrega', CARGA);

  await queFalta(page).getByRole('button', { name: 'Todavía no está listo' }).click();
  await expect(queFalta(page).getByRole('button', { name: 'Ya está listo' })).toBeVisible();
  await expect.poll(async () => (await entregaDe(sesion, trabajo.id))?.listo_el, CARGA).toBeNull();

  await queFalta(page).getByRole('button', { name: 'Ya lo entregué' }).click();
  await expect
    .poll(async () => (await entregaDe(sesion, trabajo.id))?.estado, CARGA)
    .toBe('entregado');
  expect((await entregaDe(sesion, trabajo.id))?.fecha_entrega).toBe(hoyEnElTaller());
});

test('la entrega comprometida está en la agenda con su horario y no se mueve desde ahí', async ({
  page,
  isMobile,
}) => {
  const trabajo = await trabajoListoConEnlace(sesion, {
    titulo: 'Escritorio',
    cliente: 'Lucía Ferreyra',
  });
  const dia = hoyEnElTaller();
  await abrirLaFicha(page, trabajo);
  await laEntrega(page).getByRole('button', { name: 'Comprometer un día' }).click();
  const hoja = page.getByRole('dialog', { name: 'La entrega comprometida' });
  await hoja.getByLabel('Día').fill(dia);
  await hoja.getByRole('radio', { name: 'A la mañana' }).click();
  await hoja.getByRole('button', { name: 'Comprometer' }).click();
  await expect
    .poll(async () => (await entregaDe(sesion, trabajo.id))?.entrega_comprometida, CARGA)
    .toBe(dia);

  await page.goto('/agenda');
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
  const palabras = diaEnPalabras(dia);
  let detalle;
  if (isMobile) {
    await page.getByRole('button', { name: `Ver el ${palabras}` }).click();
    detalle = page.getByRole('dialog', { name: palabras });
  } else {
    await page.getByRole('button', { name: new RegExp(`^${palabras}, hoy:`) }).click();
    detalle = page.getByRole('complementary', { name: `El ${palabras}` });
  }
  const entrega = detalle.getByRole('listitem').filter({ hasText: trabajo.titulo });
  await expect(entrega).toContainText('a la mañana', CARGA);
  await expect(entrega).toContainText(
    'Está comprometida con el cliente. Para cambiarla, abrí el proyecto.',
  );
  await expect(entrega).not.toContainText('Arrastrala');
});

function diaEnPalabras(fecha: string): string {
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const meses = [
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
  const dia = new Date(`${fecha}T12:00:00Z`);
  return `${dias[dia.getUTCDay()] ?? ''} ${String(dia.getUTCDate())} de ${meses[dia.getUTCMonth()] ?? ''}`;
}

test('el analítico de entregas con 4, 6 y 12 trabajos no muestra lo que los datos no sostienen', async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const capturar = async (cuantos: number) => {
    for (const tema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: tema });
      await page.screenshot({
        path: testInfo.outputPath(
          `analitico-${String(cuantos)}-${tema}-${testInfo.project.name}.png`,
        ),
        fullPage: true,
      });
    }
    await page.emulateMedia({ colorScheme: 'light' });
  };
  const abrirElAnalitico = async () => {
    await page.goto('/proyectos?etapa=historial');
    await page.getByRole('link', { name: /Analítico de entregas/ }).click(CARGA);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Analítico de entregas' }),
    ).toBeVisible(CARGA);
  };

  await page.goto('/proyectos/analitico');
  await expect(page.getByText('Todavía no hay entregas para comparar')).toBeVisible(CARGA);

  await sembrarEntregas(sesion, 0, 4);
  await abrirElAnalitico();
  await expect(
    page
      .getByText('Con 4 trabajos todavía son pocos para sacar una cuenta: miralos uno por uno.')
      .first(),
  ).toBeVisible(CARGA);
  await expect(page.getByRole('button', { name: 'Ver los números' })).toHaveCount(0);
  await expect(page.getByText(/^Acertaste/)).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Trabajo por trabajo' }).getByRole('listitem'),
  ).toHaveCount(4);
  await capturar(4);

  await sembrarEntregas(sesion, 4, 6);
  await abrirElAnalitico();
  await expect(
    page.getByText('Entregás, en la mediana, 2,5 días después de lo estimado.').first(),
  ).toBeVisible(CARGA);
  await expect(page.getByText(/^Acertaste/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver los números' }).click();
  await expect(
    page.getByRole('region', { name: 'Trabajo por trabajo' }).getByRole('listitem'),
  ).toHaveCount(6);
  await capturar(6);

  await sembrarEntregas(sesion, 6, 12);
  await abrirElAnalitico();
  await expect(page.getByText('Acertaste 7 de 12.')).toBeVisible(CARGA);
  await expect(page.getByText(/Acertaste 7 de 12 \(/)).toHaveCount(0);
  const porTipo = page.getByRole('region', { name: 'Cuánto tardás por tipo de proyecto' });
  await expect(porTipo).toContainText('Placard');
  await expect(porTipo).toContainText('6 trabajos');
  await expect(porTipo).toContainText('2 trabajos sin tipo');
  await capturar(12);
});
