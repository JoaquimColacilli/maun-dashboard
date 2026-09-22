import { expect, test, type Locator, type Page } from '@playwright/test';

import { indicadorDeSync, listoParaCortar } from '../apoyo/pantalla';
import {
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  necesidadesDe,
  vaciarTaller,
  type FilaDeNecesidad,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

interface Cargada {
  id: string;
  tipo: string;
  nombre: string;
  cantidad?: number | null;
  listo?: boolean;
}

async function trabajoCon(titulo: string, necesidades: readonly Cargada[]): Promise<string> {
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado: 'a_presupuestar',
      presupuesto_centavos: null,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
    necesidades: necesidades.map((necesidad) => ({
      cantidad: null,
      listo: false,
      ...necesidad,
    })),
  });
  return id;
}

async function abrirLaFicha(page: Page, id: string, titulo: string): Promise<void> {
  await page.goto(`/proyectos/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible(CARGA);
}

function loQueHaceFalta(page: Page): Locator {
  return page
    .locator('details')
    .filter({ has: page.getByRole('heading', { name: 'Lo que hace falta' }) })
    .first();
}

function fila(page: Page, id: string): Locator {
  return loQueHaceFalta(page).locator(`[data-necesidad="${id}"]`);
}

function cantidadDe(page: Page, id: string): Locator {
  return fila(page, id).getByRole('textbox', { name: /^Cantidad de / });
}

function nombreDe(page: Page, id: string): Locator {
  return fila(page, id).getByRole('textbox', { name: /^Nombre de / });
}

async function enLaBase(id: string, necesidadId: string): Promise<FilaDeNecesidad | undefined> {
  return (await necesidadesDe(sesion, id)).find((necesidad) => necesidad.id === necesidadId);
}

test.describe('los materiales', () => {
  test('son el primero de los tres segmentos y entran en los contadores', async ({
    page,
  }, testInfo) => {
    const melamina = crypto.randomUUID();
    const id = await trabajoCon('E2E Tres segmentos', [
      { id: melamina, tipo: 'material', nombre: 'placas de melamina blanca 18 mm', cantidad: 3 },
      { id: crypto.randomUUID(), tipo: 'material', nombre: 'Tablón de guatambú', listo: true },
      { id: crypto.randomUUID(), tipo: 'material', nombre: 'Laca poliuretánica' },
      {
        id: crypto.randomUUID(),
        tipo: 'herraje',
        nombre: 'Juegos de Patas Regulables 100 / 150 mm c/ Clip',
        cantidad: 4,
      },
      { id: crypto.randomUUID(), tipo: 'herraje', nombre: 'Bisagras Cazoleta 35', cantidad: 4 },
      { id: crypto.randomUUID(), tipo: 'herraje', nombre: 'Correderas 500mm', cantidad: 4 },
      { id: crypto.randomUUID(), tipo: 'herraje', nombre: 'Pitutos Metalicos', cantidad: 4 },
      { id: crypto.randomUUID(), tipo: 'herramienta', nombre: 'Sierra Circular' },
      { id: crypto.randomUUID(), tipo: 'herramienta', nombre: 'Sargentos', cantidad: 4 },
    ]);
    await abrirLaFicha(page, id, 'E2E Tres segmentos');
    const bloque = loQueHaceFalta(page);

    await expect(bloque.getByRole('heading', { level: 3 })).toHaveText([
      'Materiales necesarios',
      'Herrajes necesarios',
      'Herramientas necesarias',
    ]);
    await expect(bloque.locator('summary')).toContainText('1 de 9');
    await expect(
      bloque.getByText(/^Los materiales y los herrajes que hay que pedir/),
    ).toBeVisible();
    const materiales = bloque.getByRole('region', { name: 'Materiales necesarios' });
    await expect(materiales).toContainText('1 de 3 listos');
    await expect(bloque.getByRole('region', { name: 'Herrajes necesarios' })).toContainText(
      '4 cosas',
    );
    await expect(bloque.getByRole('region', { name: 'Herramientas necesarias' })).toContainText(
      '2 cosas',
    );

    await bloque.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('los-tres-segmentos.png'), fullPage: true });
    await bloque.screenshot({ path: testInfo.outputPath('lo-que-hace-falta.png') });

    await materiales.getByLabel('Cuántos materiales').fill('2');
    const campo = materiales.getByRole('combobox', { name: 'Qué material hace falta' });
    await campo.fill('Caño estructural 40x40');
    await materiales.getByRole('button', { name: 'Agregar el material' }).click();
    await expect(
      materiales.getByRole('textbox', { name: 'Nombre de Caño estructural 40x40', exact: true }),
    ).toBeVisible(CARGA);
    await expect(bloque.locator('summary')).toContainText('1 de 10');
    await expect(materiales).toContainText('1 de 4 listos');

    await expect
      .poll(
        async () =>
          (await necesidadesDe(sesion, id)).find(
            (fila) => fila.nombre === 'Caño estructural 40x40',
          ),
        CARGA,
      )
      .toMatchObject({ tipo: 'material', cantidad: 2, listo: false });

    await cantidadDe(page, melamina).fill('5');
    await cantidadDe(page, melamina).press('Enter');
    await expect.poll(async () => (await enLaBase(id, melamina))?.cantidad, CARGA).toBe(5);
  });

  test('cada segmento sugiere lo suyo: escribiendo un material no aparece una herramienta', async ({
    page,
  }) => {
    await trabajoCon('E2E Trabajo anterior', [
      { id: crypto.randomUUID(), tipo: 'material', nombre: 'Laca poliuretánica' },
      { id: crypto.randomUUID(), tipo: 'herramienta', nombre: 'Lijadora de banda' },
      { id: crypto.randomUUID(), tipo: 'herraje', nombre: 'Lengüetas' },
    ]);
    const id = await trabajoCon('E2E Trabajo nuevo', []);
    await abrirLaFicha(page, id, 'E2E Trabajo nuevo');
    const bloque = loQueHaceFalta(page);

    const materiales = bloque.getByRole('region', { name: 'Materiales necesarios' });
    const campoDeMateriales = materiales.getByRole('combobox', { name: 'Qué material hace falta' });
    await campoDeMateriales.click();
    await campoDeMateriales.fill('l');
    const sugeridos = materiales.getByRole('listbox');
    await expect(sugeridos.getByText('Laca poliuretánica')).toBeVisible(CARGA);
    await expect(sugeridos.getByText('Lijadora de banda')).toHaveCount(0);
    await expect(sugeridos.getByText('Lengüetas')).toHaveCount(0);
    await campoDeMateriales.press('Escape');

    const herramientas = bloque.getByRole('region', { name: 'Herramientas necesarias' });
    const campoDeHerramientas = herramientas.getByRole('combobox', {
      name: 'Qué herramienta hace falta',
    });
    await campoDeHerramientas.click();
    await campoDeHerramientas.fill('l');
    const deHerramientas = herramientas.getByRole('listbox');
    await expect(deHerramientas.getByText('Lijadora de banda')).toBeVisible(CARGA);
    await expect(deHerramientas.getByText('Laca poliuretánica')).toHaveCount(0);
  });
});

test.describe('editar lo que ya está cargado, en la misma fila', () => {
  test('la cantidad y el nombre se cambian sin borrar nada y sin tocar el tildado', async ({
    page,
  }, testInfo) => {
    const bisagras = crypto.randomUUID();
    const sierra = crypto.randomUUID();
    const id = await trabajoCon('E2E Editar en la fila', [
      { id: bisagras, tipo: 'herraje', nombre: 'bisagras cazoleta', cantidad: 4, listo: true },
      { id: sierra, tipo: 'herramienta', nombre: 'Sierra Circular' },
    ]);
    await abrirLaFicha(page, id, 'E2E Editar en la fila');

    await expect(cantidadDe(page, bisagras)).toHaveValue('4');
    await cantidadDe(page, bisagras).fill('6');
    await cantidadDe(page, bisagras).press('Enter');
    await expect.poll(async () => (await enLaBase(id, bisagras))?.cantidad, CARGA).toBe(6);

    await nombreDe(page, bisagras).fill('Bisagras Cazoleta 35 Cierre Suave');
    await nombreDe(page, bisagras).press('Tab');
    await expect
      .poll(async () => (await enLaBase(id, bisagras))?.nombre, CARGA)
      .toBe('Bisagras Cazoleta 35 Cierre Suave');

    const editada = await enLaBase(id, bisagras);
    expect(editada?.listo).toBe(true);
    await expect(fila(page, bisagras).getByRole('checkbox')).toBeChecked();
    await expect(
      fila(page, bisagras).getByRole('checkbox', {
        name: 'Listo: 6 Bisagras Cazoleta 35 Cierre Suave',
      }),
    ).toBeVisible();
    expect(await necesidadesDe(sesion, id)).toHaveLength(2);

    await cantidadDe(page, sierra).fill('2');
    await cantidadDe(page, sierra).press('Enter');
    await expect.poll(async () => (await enLaBase(id, sierra))?.cantidad, CARGA).toBe(2);

    await nombreDe(page, bisagras).click();
    await nombreDe(page, bisagras).press('End');
    await nombreDe(page, bisagras).pressSequentially(' Blum', { delay: 20 });
    await page.screenshot({ path: testInfo.outputPath('una-fila-en-edicion.png') });
    await nombreDe(page, bisagras).press('Escape');
    await expect(nombreDe(page, bisagras)).toHaveValue('Bisagras Cazoleta 35 Cierre Suave');
  });

  test('en cero o vacía, la cantidad vuelve a la de antes; en blanco, el nombre también', async ({
    page,
  }) => {
    const pistones = crypto.randomUUID();
    const id = await trabajoCon('E2E Cero no vale', [
      { id: pistones, tipo: 'herraje', nombre: 'Pistones', cantidad: 3 },
    ]);
    await abrirLaFicha(page, id, 'E2E Cero no vale');

    await cantidadDe(page, pistones).fill('0');
    await cantidadDe(page, pistones).press('Enter');
    await expect(cantidadDe(page, pistones)).toHaveValue('3');

    await cantidadDe(page, pistones).fill('');
    await cantidadDe(page, pistones).press('Tab');
    await expect(cantidadDe(page, pistones)).toHaveValue('3');

    await nombreDe(page, pistones).fill('   ');
    await nombreDe(page, pistones).press('Enter');
    await expect(nombreDe(page, pistones)).toHaveValue('Pistones');

    await cantidadDe(page, pistones).fill('12');
    await cantidadDe(page, pistones).press('Escape');
    await expect(cantidadDe(page, pistones)).toHaveValue('3');
    await cantidadDe(page, pistones).press('Tab');

    expect(await enLaBase(id, pistones)).toMatchObject({
      nombre: 'Pistones',
      cantidad: 3,
      listo: false,
    });
    await expect(indicadorDeSync(page)).toBeHidden();
  });

  test('con el teclado la fila se recorre entera, y cada campo dice de qué es', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'escritorio', 'el recorrido con Tab es de la computadora');
    const bisagras = crypto.randomUUID();
    const id = await trabajoCon('E2E Con teclado', [
      { id: bisagras, tipo: 'herraje', nombre: 'Bisagras Cazoleta 35', cantidad: 4 },
    ]);
    await abrirLaFicha(page, id, 'E2E Con teclado');

    const casilla = fila(page, bisagras).getByRole('checkbox');
    await casilla.focus();
    const recorrido: string[] = [];
    for (let paso = 0; paso < 4; paso += 1) {
      recorrido.push(
        await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''),
      );
      await page.keyboard.press('Tab');
    }
    expect(recorrido).toEqual([
      'Listo: 4 Bisagras Cazoleta 35',
      'Cantidad de Bisagras Cazoleta 35',
      'Nombre de Bisagras Cazoleta 35',
      'Sacar 4 Bisagras Cazoleta 35 de la lista',
    ]);

    const arbol = await fila(page, bisagras).ariaSnapshot();
    console.log(`Árbol de accesibilidad de la fila:\n${arbol}`);
    expect(arbol).toContain('checkbox "Listo: 4 Bisagras Cazoleta 35"');
    expect(arbol).toContain('textbox "Cantidad de Bisagras Cazoleta 35"');
    expect(arbol).toContain('text: "4"');
    expect(arbol).toContain('textbox "Nombre de Bisagras Cazoleta 35": Bisagras Cazoleta 35');
    expect(arbol).toContain('button "Sacar 4 Bisagras Cazoleta 35 de la lista"');
  });
});

test.describe('sin señal', () => {
  test('una edición sin señal queda en la cola, sobrevive a cerrar la app y llega al volver', async ({
    page,
    context,
  }) => {
    const bisagras = crypto.randomUUID();
    const id = await trabajoCon('E2E Editar sin señal', [
      { id: bisagras, tipo: 'herraje', nombre: 'bisagras', cantidad: 4, listo: true },
    ]);
    await abrirLaFicha(page, id, 'E2E Editar sin señal');
    await listoParaCortar(page);

    await context.setOffline(true);
    await cantidadDe(page, bisagras).fill('6');
    await cantidadDe(page, bisagras).press('Enter');
    await nombreDe(page, bisagras).fill('Bisagras Cazoleta 35');
    await nombreDe(page, bisagras).press('Enter');

    await expect(indicadorDeSync(page)).toContainText('Sin conexión', CARGA);
    await expect(indicadorDeSync(page)).toContainText('2 cambios');
    expect(await enLaBase(id, bisagras)).toMatchObject({ nombre: 'bisagras', cantidad: 4 });

    await page.close();
    const reabierta = await context.newPage();
    await abrirLaFicha(reabierta, id, 'E2E Editar sin señal');
    await expect(cantidadDe(reabierta, bisagras)).toHaveValue('6', CARGA);
    await expect(nombreDe(reabierta, bisagras)).toHaveValue('Bisagras Cazoleta 35');
    await expect(indicadorDeSync(reabierta)).toContainText('2 cambios');

    await context.setOffline(false);
    await expect(indicadorDeSync(reabierta)).toBeHidden({ timeout: 20_000 });
    expect(await enLaBase(id, bisagras)).toMatchObject({
      nombre: 'Bisagras Cazoleta 35',
      cantidad: 6,
      listo: true,
    });
    expect(await necesidadesDe(sesion, id)).toHaveLength(1);
  });
});
