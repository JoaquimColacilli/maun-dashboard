import { expect, test, type Page } from '@playwright/test';

import {
  contarHijos,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  montosDe,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

async function conCliente(nombre = 'Marcela Sosa'): Promise<string> {
  return crearCliente(sesion, nombre);
}

async function elegirCliente(page: Page, nombre: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Cliente' }).fill(nombre);
  await page
    .getByRole('option', { name: new RegExp(nombre) })
    .first()
    .click();
}

async function cargarFila(
  page: Page,
  lista: 'Pagos recibidos' | 'Gastos e insumos',
  indice: number,
  datos: { detalle: string; monto: string },
): Promise<void> {
  const seccion = page.getByRole('region', { name: lista });
  const etiqueta = lista === 'Pagos recibidos' ? 'Concepto' : 'Descripción';
  await seccion.getByLabel(`${etiqueta} ${String(indice)}`, { exact: true }).fill(datos.detalle);
  await seccion.getByLabel(`Monto ${String(indice)}`, { exact: true }).fill(datos.monto);
}

async function agregar(page: Page, lista: 'Pagos recibidos' | 'Gastos e insumos'): Promise<void> {
  const texto = lista === 'Pagos recibidos' ? 'Agregar un pago' : 'Agregar un gasto';
  await page.getByRole('region', { name: lista }).getByRole('button', { name: texto }).click();
}

async function distanciaDelPieAlPiso(page: Page): Promise<number> {
  return page.evaluate(() => {
    const pie = document.querySelector('form footer');
    const main = document.querySelector('main');
    if (!pie || !main) return Number.POSITIVE_INFINITY;
    return Math.abs(main.getBoundingClientRect().bottom - pie.getBoundingClientRect().bottom);
  });
}

test('en escritorio, con el formulario vacío, la barra de totales queda al piso de la ventana y no al final del contenido', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'escritorio', 'la barra fija es del escritorio');
  await page.goto('/proyectos/nuevo');
  await expect(page.getByRole('button', { name: 'Guardar proyecto' })).toBeVisible();

  expect(await distanciaDelPieAlPiso(page)).toBeLessThanOrEqual(1);
  const alto = page.viewportSize()?.height ?? 0;
  const pie = await page.locator('form footer').boundingBox();
  expect(Math.abs((pie?.y ?? 0) + (pie?.height ?? 0) - alto)).toBeLessThanOrEqual(1);
});

test('en escritorio, con muchas filas, las dos barras quedan fijas, cada lista deja su título a la vista y el teclado no esconde el campo', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'escritorio', 'las barras fijas son del escritorio');
  await conCliente();
  await page.goto('/proyectos/nuevo');
  await elegirCliente(page, 'Marcela Sosa');
  await page.getByLabel('Trabajo').fill('Cocina con muchas filas');

  for (const numero of [1, 2, 3, 4, 5, 6, 7, 8]) {
    await agregar(page, 'Pagos recibidos');
    await cargarFila(page, 'Pagos recibidos', numero, {
      detalle: `Pago ${String(numero)}`,
      monto: '1000',
    });
  }
  for (const numero of [1, 2, 3, 4, 5, 6, 7]) {
    await agregar(page, 'Gastos e insumos');
    await cargarFila(page, 'Gastos e insumos', numero, {
      detalle: `Gasto ${String(numero)}`,
      monto: '500',
    });
  }

  const pagos = page.getByRole('region', { name: 'Pagos recibidos' });
  await pagos.evaluate((seccion) => {
    const main = seccion.closest('main');
    if (main) main.scrollTop += seccion.getBoundingClientRect().top + 250;
  });

  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Guardar proyecto' })).toBeInViewport();
  await expect(page.locator('form footer')).toContainText('Cobrado');
  expect(await distanciaDelPieAlPiso(page)).toBeLessThanOrEqual(1);

  const titulo = pagos.getByRole('heading', { name: 'Pagos recibidos' });
  await expect(titulo).toBeInViewport();
  const caja = await titulo.boundingBox();
  expect(caja?.y ?? 0).toBeGreaterThanOrEqual(60);
  expect(caja?.y ?? 999).toBeLessThan(120);
  await expect(pagos).toContainText('Lo que te pagó el cliente por este trabajo.');

  await pagos.getByLabel('Concepto 1', { exact: true }).focus();
  for (let paso = 0; paso < 24; paso += 1) {
    await page.keyboard.press('Tab');
    const tapado = await page.evaluate(() => {
      const enfocado = document.activeElement;
      const cabecera = document.querySelector('form')?.previousElementSibling;
      const pie = document.querySelector('form footer');
      if (!(enfocado instanceof HTMLElement) || !cabecera || !pie) return false;
      if (enfocado.closest('header, footer')) return false;
      const caja = enfocado.getBoundingClientRect();
      return (
        caja.top < cabecera.getBoundingClientRect().bottom ||
        caja.bottom > pie.getBoundingClientRect().top
      );
    });
    expect(tapado).toBe(false);
  }
});

test('un proyecto con dos pagos y dos gastos entra entero y sobrevive a recargar', async ({
  page,
}) => {
  await conCliente();
  await page.goto('/proyectos/nuevo');

  await elegirCliente(page, 'Marcela Sosa');
  await page.getByLabel('Trabajo').fill('Placard de tres puertas');
  await page.getByLabel('Presupuesto').fill('1200000');

  await agregar(page, 'Pagos recibidos');
  await cargarFila(page, 'Pagos recibidos', 1, { detalle: 'Seña', monto: '400000' });
  await agregar(page, 'Pagos recibidos');
  await cargarFila(page, 'Pagos recibidos', 2, { detalle: 'Adelanto', monto: '200000' });

  await agregar(page, 'Gastos e insumos');
  await cargarFila(page, 'Gastos e insumos', 1, { detalle: 'Melamina', monto: '300000' });
  await agregar(page, 'Gastos e insumos');
  await cargarFila(page, 'Gastos e insumos', 2, { detalle: 'Herrajes', monto: '50000' });

  await page.getByRole('button', { name: 'Guardar proyecto' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Placard de tres puertas');
  await expect
    .poll(async () => (await leerProyecto(sesion, 'Placard de tres puertas'))?.id, {
      timeout: 20_000,
    })
    .toBeTruthy();

  const guardado = await leerProyecto(sesion, 'Placard de tres puertas');
  expect(guardado?.presupuesto_centavos).toBe(120_000_000);
  await expect.poll(async () => contarHijos(sesion, 'pagos', guardado?.id ?? '')).toBe(2);
  expect(await contarHijos(sesion, 'gastos', guardado?.id ?? '')).toBe(2);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Placard de tres puertas');
  await expect(page.getByRole('region', { name: 'Pagos recibidos' })).toContainText('Seña');
  await expect(page.getByRole('region', { name: 'Pagos recibidos' })).toContainText('Adelanto');
  await expect(page.getByRole('region', { name: 'Gastos e insumos' })).toContainText('Melamina');
  await expect(page.getByRole('region', { name: 'Gastos e insumos' })).toContainText('Herrajes');
});

test('editar sacando un pago y agregando un gasto deja el conjunto correcto', async ({ page }) => {
  await conCliente();
  await page.goto('/proyectos/nuevo');

  await elegirCliente(page, 'Marcela Sosa');
  await page.getByLabel('Trabajo').fill('Vanitory colgante');
  await page.getByLabel('Presupuesto').fill('680000');
  await agregar(page, 'Pagos recibidos');
  await cargarFila(page, 'Pagos recibidos', 1, { detalle: 'Seña', monto: '200000' });
  await agregar(page, 'Pagos recibidos');
  await cargarFila(page, 'Pagos recibidos', 2, { detalle: 'Adelanto', monto: '100000' });
  await agregar(page, 'Gastos e insumos');
  await cargarFila(page, 'Gastos e insumos', 1, { detalle: 'Guayubira', monto: '150000' });
  await page.getByRole('button', { name: 'Guardar proyecto' }).click();

  await expect
    .poll(async () => (await leerProyecto(sesion, 'Vanitory colgante'))?.id, { timeout: 20_000 })
    .toBeTruthy();
  const proyecto = await leerProyecto(sesion, 'Vanitory colgante');
  const id = proyecto?.id ?? '';

  await page.getByRole('button', { name: 'Editar' }).click();
  const pagos = page.getByRole('region', { name: 'Pagos recibidos' });
  await pagos.getByRole('button', { name: 'Quitar concepto 2' }).click();
  await agregar(page, 'Gastos e insumos');
  await cargarFila(page, 'Gastos e insumos', 2, { detalle: 'Flete', monto: '40000' });
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();

  await expect
    .poll(async () => montosDe(sesion, 'pagos', id), { timeout: 20_000 })
    .toEqual([20_000_000]);
  expect(await montosDe(sesion, 'gastos', id)).toEqual([4_000_000, 15_000_000]);

  await page.reload();
  await expect(page.getByRole('region', { name: 'Pagos recibidos' })).not.toContainText('Adelanto');
  await expect(page.getByRole('region', { name: 'Gastos e insumos' })).toContainText('Flete');
});

test('guardar sobre una versión vieja se rechaza y no se lleva puesto lo que escribió el usuario', async ({
  page,
}) => {
  const clienteId = await conCliente();
  await page.goto('/proyectos/nuevo');
  await elegirCliente(page, 'Marcela Sosa');
  await page.getByLabel('Trabajo').fill('Biblioteca a medida');
  await page.getByLabel('Presupuesto').fill('900000');
  await page.getByRole('button', { name: 'Guardar proyecto' }).click();

  await expect
    .poll(async () => (await leerProyecto(sesion, 'Biblioteca a medida'))?.id, { timeout: 20_000 })
    .toBeTruthy();
  const proyecto = await leerProyecto(sesion, 'Biblioteca a medida');
  const id = proyecto?.id ?? '';
  const versionVista = proyecto?.version ?? 1;

  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByLabel('Trabajo')).toHaveValue('Biblioteca a medida');

  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: versionVista,
      cliente_id: clienteId,
      titulo: 'Biblioteca, cambiada desde la PC',
      descripcion: '',
      estado: 'en_curso',
      presupuesto_centavos: 90_000_000,
      forma_pago: 'transferencia',
      comprobante: 'remito',
      fecha_visita: null,
      ultimo_contacto: null,
      fecha_inicio: null,
      entrega_estimada: null,
      fecha_entrega: null,
      direccion_entrega: '',
      notas: '',
    },
    pagos: [],
    gastos: [],
  });

  await page.getByLabel('Trabajo').fill('Biblioteca, cambiada en el celular');
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();

  await expect(page.getByRole('alert')).toContainText(
    /cambió desde que lo abriste|Abrilo de nuevo/i,
  );

  expect((await leerProyecto(sesion, 'Biblioteca, cambiada desde la PC'))?.id).toBe(id);
  expect(await leerProyecto(sesion, 'Biblioteca, cambiada en el celular')).toBeUndefined();
});

test('la tabla de escritorio ordena por cada columna, en los dos sentidos', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'la tabla ordenable es de escritorio; en el celular son cards');

  await conCliente('Ana Gómez');
  await conCliente('Zulema Paz');

  for (const [cliente, titulo, presupuesto] of [
    ['Ana Gómez', 'Alacena', '300000'],
    ['Zulema Paz', 'Zapatero', '900000'],
  ] as const) {
    await page.goto('/proyectos/nuevo');
    await elegirCliente(page, cliente);
    await page.getByLabel('Trabajo').fill(titulo);
    await page.getByLabel('Presupuesto').fill(presupuesto);
    await page.getByRole('button', { name: 'Guardar proyecto' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo);
  }

  await page.goto('/proyectos');

  const columnas: [string, 'ascending' | 'descending'][] = [
    ['Cliente', 'ascending'],
    ['Trabajo', 'ascending'],
    ['Presupuesto', 'descending'],
    ['Cobrado', 'descending'],
    ['Saldo', 'descending'],
    ['Entrega', 'ascending'],
    ['Estado', 'ascending'],
  ];
  for (const [columna, inicial] of columnas) {
    const encabezado = page.getByRole('columnheader', { name: new RegExp(columna) });
    const alRevés = inicial === 'ascending' ? 'descending' : 'ascending';
    await encabezado.getByRole('button').click();
    await expect(encabezado).toHaveAttribute('aria-sort', inicial);
    await encabezado.getByRole('button').click();
    await expect(encabezado).toHaveAttribute('aria-sort', alRevés);
  }

  const porPresupuesto = page.getByRole('columnheader', { name: /Presupuesto/ });
  await porPresupuesto.getByRole('button').click();
  await expect(porPresupuesto).toHaveAttribute('aria-sort', 'descending');
  await expect(page.getByRole('row').nth(1)).toContainText('Zapatero');
  await porPresupuesto.getByRole('button').click();
  await expect(porPresupuesto).toHaveAttribute('aria-sort', 'ascending');
  await expect(page.getByRole('row').nth(1)).toContainText('Alacena');
});

test('la lista vacía, con datos y sin resultados dicen cosas distintas', async ({ page }) => {
  await page.goto('/proyectos');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Todavía no hay proyectos activos',
  );

  await conCliente();
  await page.goto('/proyectos/nuevo');
  await elegirCliente(page, 'Marcela Sosa');
  await page.getByLabel('Trabajo').fill('Mesada de cocina');
  await page.getByLabel('Presupuesto').fill('500000');
  await page.getByRole('button', { name: 'Guardar proyecto' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mesada de cocina');

  await page.goto('/proyectos');
  await expect(page.getByRole('link', { name: 'Mesada de cocina' })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Buscar por cliente' }).fill('zzz');
  await expect(page.getByText('Ningún proyecto coincide con «zzz».')).toBeVisible();
});

test('el control segmentado navega entre Consultas, Activos e Historial', async ({ page }) => {
  await page.goto('/proyectos');

  await page.getByRole('tab', { name: /Consultas/ }).click();
  await expect(page).toHaveURL(/\/consultas$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('No hay consultas por ahora');

  await page.getByRole('tab', { name: /Historial/ }).click();
  await expect(page).toHaveURL(/etapa=historial/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    'Todavía no cerraste ningún proyecto',
  );
});
