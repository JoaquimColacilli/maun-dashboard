import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { indicadorDeSync, listoParaCortar } from '../apoyo/pantalla';
import {
  anotacionesDelTaller,
  crearAnotacionPorRest,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  necesidadesDe,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function conDias(dias: number): string {
  const dia = new Date();
  dia.setDate(dia.getDate() + dias);
  return dia.toISOString().slice(0, 10);
}

/** Un día del mes en curso que no es hoy, para que el mes que se abre sea el mismo. */
function diaDelMes(numero: number): string {
  return `${hoyISO().slice(0, 8)}${String(numero).padStart(2, '0')}`;
}

interface Necesidad {
  id: string;
  tipo: 'herraje' | 'herramienta';
  nombre: string;
  cantidad: number | null;
  listo: boolean;
}

async function trabajo(
  titulo: string,
  extra: {
    estado?: string;
    presupuesto?: number | null;
    visita?: string | null;
    entrega?: string | null;
    entregaHora?: string | null;
    necesidades?: Necesidad[];
  } = {},
): Promise<string> {
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado: extra.estado ?? 'a_presupuestar',
      presupuesto_centavos: extra.presupuesto ?? null,
      comprobante: 'sin_comprobante',
      fecha_visita: extra.visita ?? null,
      entrega_estimada: extra.entrega ?? null,
      entrega_hora: extra.entregaHora ?? null,
      vencimiento_presupuesto: null,
    },
    pagos: [],
    gastos: [],
    necesidades: extra.necesidades,
  });
  return id;
}

async function abrirLaFicha(page: Page, id: string, titulo: string): Promise<void> {
  await page.goto(`/proyectos/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible(CARGA);
}

function elBloqueDeCostos(page: Page): Locator {
  return page
    .locator('details')
    .filter({ has: page.getByRole('heading', { name: 'Costos estimados' }) })
    .first();
}

function loQueHaceFalta(page: Page): Locator {
  return page
    .locator('details')
    .filter({ has: page.getByRole('heading', { name: 'Lo que hace falta' }) })
    .first();
}

async function escribirCosto(page: Page, etiqueta: string, pesos: string): Promise<void> {
  const campo = elBloqueDeCostos(page).getByLabel(etiqueta, { exact: true });
  await campo.click();
  await campo.fill('');
  await campo.pressSequentially(pesos, { delay: 20 });
}

async function agregarNecesidad(
  page: Page,
  lista: 'herraje' | 'herramienta',
  nombre: string,
  cantidad?: string,
): Promise<void> {
  const bloque = loQueHaceFalta(page);
  if (cantidad !== undefined) {
    await bloque.getByLabel('Cuántos herrajes').fill(cantidad);
  }
  const campo = bloque.getByRole('combobox', {
    name: lista === 'herraje' ? 'Qué herraje hace falta' : 'Qué herramienta hace falta',
  });
  await campo.click();
  await campo.fill(nombre);
  await expect(campo).toHaveValue(nombre);
  const boton = bloque.getByRole('button', {
    name: lista === 'herraje' ? 'Agregar el herraje' : 'Agregar la herramienta',
  });
  await expect(boton).toBeEnabled();
  await boton.click();
  await expect(bloque.locator(`[data-necesidad]`).filter({ hasText: nombre })).toHaveCount(
    1,
    CARGA,
  );
}

test.describe('los costos estimados de cotizar', () => {
  test('se cargan desde la tarea Cotizar, sobreviven a recargar y no tocan el presupuesto', async ({
    page,
  }) => {
    const id = await trabajo('E2E Baulera', { visita: conDias(-7) });
    await abrirLaFicha(page, id, 'E2E Baulera');

    const bloque = elBloqueDeCostos(page);
    await expect(bloque).toBeVisible(CARGA);
    await expect(
      page.getByRole('checkbox', { name: 'Cotizar', exact: false }).first(),
    ).not.toBeChecked();

    await escribirCosto(page, 'Madera', '197863,53');
    await escribirCosto(page, 'Herrajes', '120000');
    await escribirCosto(page, 'Flete', '100000');
    await escribirCosto(page, 'Ayudante', '300000');

    await expect(bloque.getByText('Costo estimado')).toBeVisible();
    await expect(bloque.getByText('$ 717.863,53')).toBeVisible(CARGA);
    await expect(bloque.getByText('Cuando el trabajo tenga presupuesto')).toBeVisible();

    await expect
      .poll(async () => (await leerProyecto(sesion, 'E2E Baulera'))?.costo_madera_centavos, CARGA)
      .toBe(19_786_353);

    const guardado = await leerProyecto(sesion, 'E2E Baulera');
    expect(guardado?.costo_herrajes_centavos).toBe(12_000_000);
    expect(guardado?.costo_flete_centavos).toBe(10_000_000);
    expect(guardado?.costo_ayudante_centavos).toBe(30_000_000);
    // Cargarlos no toca el presupuesto ni tilda la tarea: las dos cosas son suyas.
    expect(guardado?.presupuesto_centavos).toBeNull();
    expect(guardado?.presupuesto_cotizacion).toBe(false);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Baulera' })).toBeVisible(CARGA);
    await expect(elBloqueDeCostos(page).getByText('$ 717.863,53')).toBeVisible(CARGA);
    await expect(page.getByText('Todavía sin presupuesto')).toBeVisible();
  });

  test('con presupuesto muestra el margen, y con costos de más lo dice', async ({ page }) => {
    const id = await trabajo('E2E Con margen', {
      estado: 'en_curso',
      presupuesto: 120_000_000,
      entrega: conDias(10),
    });
    await abrirLaFicha(page, id, 'E2E Con margen');

    await escribirCosto(page, 'Madera', '400000');
    const bloque = elBloqueDeCostos(page);
    await expect(bloque.getByText('Te queda', { exact: true })).toBeVisible(CARGA);
    await expect(bloque.getByText('$ 800.000')).toBeVisible();

    await escribirCosto(page, 'Ayudante', '900000');
    await expect(bloque.getByText('Estás estimando más gasto que presupuesto.')).toBeVisible(CARGA);

    await expect
      .poll(async () => (await leerProyecto(sesion, 'E2E Con margen'))?.presupuesto_centavos, CARGA)
      .toBe(120_000_000);
  });
});

test.describe('lo que hace falta para el trabajo', () => {
  test('se carga en un contacto, sigue estando de obra y se autocompleta con lo ya usado', async ({
    page,
  }) => {
    const contacto = await trabajo('E2E Contacto con herrajes', { visita: conDias(-3) });
    // Los dos trabajos se crean antes de abrir la app: la réplica tiene staleTime de 60 s y un goto
    // no la vuelve a pedir.
    const otro = await trabajo('E2E Otro trabajo', { visita: conDias(-1) });
    await abrirLaFicha(page, contacto, 'E2E Contacto con herrajes');

    await agregarNecesidad(page, 'herraje', 'Bisagras', '6');
    await agregarNecesidad(page, 'herraje', 'Tarugos');
    await agregarNecesidad(page, 'herramienta', 'Sierra Circular');

    await expect.poll(async () => (await necesidadesDe(sesion, contacto)).length, CARGA).toBe(3);
    const filas = await necesidadesDe(sesion, contacto);
    expect(filas.map((f) => [f.tipo, f.nombre, f.cantidad])).toEqual([
      ['herraje', 'Bisagras', 6],
      ['herraje', 'Tarugos', null],
      ['herramienta', 'Sierra Circular', null],
    ]);

    // Tildar uno lo deja en la lista, tachado.
    const casilla = loQueHaceFalta(page).getByRole('checkbox', { name: 'Listo: 6 Bisagras' });
    await casilla.click();
    await expect(casilla).toBeChecked(CARGA);
    await expect
      .poll(
        async () =>
          (await necesidadesDe(sesion, contacto)).find((f) => f.nombre === 'Bisagras')?.listo,
        CARGA,
      )
      .toBe(true);
    await expect(loQueHaceFalta(page).getByText('Bisagras')).toHaveCSS(
      'text-decoration-line',
      'line-through',
    );

    // El mismo trabajo pasa a obra: el pasaje guarda el agregado sin mandar lo que hace falta, así
    // que la base no lo toca y las dos listas siguen ahí.
    await page.getByRole('button', { name: 'Ya lo aprobó' }).click();
    const presupuesto = page.getByRole('textbox', { name: 'Presupuesto aprobado' });
    await expect(presupuesto).toBeVisible(CARGA);
    await presupuesto.fill('1200000');
    await page.getByRole('button', { name: 'Pasar a Proyectos' }).click();

    await expect(page.getByRole('heading', { name: 'Pagos recibidos' })).toBeVisible(CARGA);
    await expect(loQueHaceFalta(page).locator('[data-necesidad]')).toHaveCount(3, CARGA);
    await expect
      .poll(async () => (await leerProyecto(sesion, 'E2E Contacto con herrajes'))?.estado, CARGA)
      .toBe('en_curso');
    expect((await necesidadesDe(sesion, contacto)).length).toBe(3);

    // En otro trabajo, el catálogo sugiere lo que ya usó, y no mezcla los dos tipos.
    await abrirLaFicha(page, otro, 'E2E Otro trabajo');
    const bloque = loQueHaceFalta(page);
    const campoDeHerrajes = bloque.getByRole('combobox', { name: 'Qué herraje hace falta' });
    await campoDeHerrajes.click();
    await campoDeHerrajes.fill('bis');
    const sugerencias = bloque.getByRole('listbox').first();
    await expect(sugerencias.getByText('Bisagras')).toBeVisible(CARGA);
    await expect(sugerencias.getByText('Sierra Circular')).toHaveCount(0);

    await campoDeHerrajes.fill('sierra');
    await expect(sugerencias.getByText('Sierra Circular')).toHaveCount(0);
  });
});

test.describe('el día hora a hora', () => {
  // En el celular la agenda es una lista con la tira del mes: no hay grilla para arrastrar ni celdas
  // que medir. Ahí el camino es abrir la cosa y cambiarle la fecha, que es el que sigue estando.
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 768,
    'la grilla del mes existe de tablet para arriba',
  );

  test('lo que no tiene hora va arriba y lo que la tiene cae en su renglón', async ({ page }) => {
    const dia = diaDelMes(20);
    await trabajo('E2E Entrega con hora', {
      estado: 'en_curso',
      presupuesto: 100_000_000,
      entrega: dia,
      entregaHora: '10:00',
    });
    await crearAnotacionPorRest(sesion, {
      fecha: dia,
      texto: 'E2E Comprar melamina',
      hora: '08:30',
    });
    await crearAnotacionPorRest(sesion, { fecha: dia, texto: 'E2E Sin hora' });

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
    await page.locator(`[data-fecha="${dia}"] > button`).first().click();

    const capa = page.getByRole('complementary');
    await expect(capa.getByText('Todo el día')).toBeVisible(CARGA);
    await expect(capa.getByText('E2E Sin hora')).toBeVisible();

    const renglonDeLasOcho = capa.locator('[data-hora="08:00"]');
    await expect(renglonDeLasOcho).toHaveAttribute('data-vacia', 'false');
    await expect(renglonDeLasOcho.getByText('E2E Comprar melamina')).toBeVisible();

    const renglonDeLasDiez = capa.locator('[data-hora="10:00"]');
    await expect(renglonDeLasDiez.getByText('E2E Entrega con hora', { exact: true })).toBeVisible();

    // El horario del taller es de 7 a 20, y el resto se abre a pedido.
    await expect(capa.locator('[data-hora]')).toHaveCount(14);
    await capa.getByRole('button', { name: 'Ver las demás horas' }).click();
    await expect(capa.locator('[data-hora]')).toHaveCount(24);
  });

  test('la grilla del mes mantiene su ancho con el día abierto', async ({ page }) => {
    const dia = diaDelMes(20);
    await crearAnotacionPorRest(sesion, { fecha: dia, texto: 'E2E Algo', hora: '09:00' });
    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);

    const grilla = page.locator('[data-grilla-del-mes]');
    const cerrada = (await grilla.boundingBox())?.width;
    await page.locator(`[data-fecha="${dia}"] > button`).first().click();
    await expect(page.getByRole('complementary')).toBeVisible(CARGA);
    const abierta = (await grilla.boundingBox())?.width;
    const capa = await page.getByRole('complementary').boundingBox();
    console.log(
      `grilla ${String(cerrada)} px cerrada, ${String(abierta)} px abierta; capa ${String(capa?.width)} px`,
    );
    expect(abierta).toBe(cerrada);
    expect(capa?.width).toBeLessThanOrEqual(((cerrada ?? 0) * 3) / 7);
  });
});

test.describe('arrastrar en la agenda', () => {
  // En el celular la agenda es una lista con la tira del mes: no hay grilla para arrastrar ni celdas
  // que medir. Ahí el camino es abrir la cosa y cambiarle la fecha, que es el que sigue estando.
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 768,
    'la grilla del mes existe de tablet para arriba',
  );

  test('una anotación cambia de día, y se deshace', async ({ page }) => {
    const desde = diaDelMes(10);
    const hasta = diaDelMes(18);
    await crearAnotacionPorRest(sesion, { fecha: desde, texto: 'E2E Retirar el pulpo' });

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);

    const chip = page.locator(`[data-fecha="${desde}"] button[title="E2E Retirar el pulpo"]`);
    await expect(chip).toBeVisible(CARGA);
    await arrastrarConElMouse(page, chip, hasta);

    await expect(
      page.locator(`[data-fecha="${hasta}"] button[title="E2E Retirar el pulpo"]`),
    ).toBeVisible(CARGA);
    await expect(page.getByText(/pasó al/)).toBeVisible(CARGA);

    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(
      page.locator(`[data-fecha="${desde}"] button[title="E2E Retirar el pulpo"]`),
    ).toBeVisible(CARGA);
  });

  test('una entrega cambia la entrega estimada del proyecto', async ({ page }) => {
    const desde = diaDelMes(12);
    const hasta = diaDelMes(19);
    await trabajo('E2E Placard que se mueve', {
      estado: 'en_curso',
      presupuesto: 100_000_000,
      entrega: desde,
      entregaHora: '10:00',
    });

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
    const chip = page.locator(
      `[data-fecha="${desde}"] button[title="Entregar: E2E Placard que se mueve"]`,
    );
    await expect(chip).toBeVisible(CARGA);
    await arrastrarConElMouse(page, chip, hasta);

    await expect
      .poll(
        async () => (await leerProyecto(sesion, 'E2E Placard que se mueve'))?.entrega_estimada,
        CARGA,
      )
      .toBe(hasta);
    // La hora se conserva: lo que se arrastra es el día.
    expect((await leerProyecto(sesion, 'E2E Placard que se mueve'))?.entrega_hora).toBe('10:00:00');
  });

  test('lo hecho no se arrastra', async ({ page }) => {
    const desde = diaDelMes(11);
    await trabajo('E2E Entregado', {
      estado: 'entregado',
      presupuesto: 100_000_000,
      entrega: desde,
    });

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
    const chip = page.locator(`[data-fecha="${desde}"] button[title="Entregar: E2E Entregado"]`);
    await expect(chip).toBeVisible(CARGA);

    await arrastrarConElMouse(page, chip, diaDelMes(19));
    await expect(page.locator('[data-destino]')).toHaveCount(0);
    expect((await leerProyecto(sesion, 'E2E Entregado'))?.entrega_estimada).toBe(desde);
  });

  test('un relevamiento pendiente cambia de día y sigue pendiente', async ({ page }) => {
    const desde = diaDelMes(12);
    const hasta = diaDelMes(19);
    await trabajo('E2E Relevamiento que se mueve', { estado: 'relevamiento', visita: desde });

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
    const chip = page.locator(
      `[data-fecha="${desde}"] button[title="Relevamiento: E2E Relevamiento que se mueve"]`,
    );
    await expect(chip).toBeVisible(CARGA);
    await arrastrarConElMouse(page, chip, hasta);

    await expect
      .poll(
        async () => (await leerProyecto(sesion, 'E2E Relevamiento que se mueve'))?.fecha_visita,
        CARGA,
      )
      .toBe(hasta);
    expect((await leerProyecto(sesion, 'E2E Relevamiento que se mueve'))?.visita_hecha).toBe(false);
  });

  test('con el teclado: la barra agarra, las flechas mueven y Enter suelta', async ({
    page,
  }, testInfo: TestInfo) => {
    const desde = diaDelMes(10);
    await crearAnotacionPorRest(sesion, { fecha: desde, texto: 'E2E Con teclado' });

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
    const chip = page.locator(`[data-fecha="${desde}"] button[title="E2E Con teclado"]`);
    await chip.focus();

    const anuncio = page.locator('[aria-live="assertive"]');
    await page.keyboard.press('Space');
    await expect(anuncio).toContainText('Agarraste E2E Con teclado', CARGA);
    await page.keyboard.press('ArrowRight');
    await expect(anuncio).toContainText('sobre el');

    await page.keyboard.press('Escape');
    await expect(anuncio).toContainText('Lo dejaste donde estaba');
    await expect(chip).toBeFocused();
    expect(
      (await anotacionesDelTaller(sesion)).find((a) => a.texto === 'E2E Con teclado')?.fecha,
    ).toBe(desde);

    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(anuncio).toContainText('Moviste E2E Con teclado', CARGA);
    await expect(
      page.locator(`[data-fecha="${diaDelMes(11)}"] button[title="E2E Con teclado"]`),
    ).toBeVisible(CARGA);

    await page.screenshot({ path: testInfo.outputPath('agenda-arrastre-teclado.png') });
  });

  test('el camino sin arrastrar sigue estando: Enter abre el día', async ({ page }) => {
    const dia = diaDelMes(14);
    await crearAnotacionPorRest(sesion, { fecha: dia, texto: 'E2E Sin arrastrar' });

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
    const chip = page.locator(`[data-fecha="${dia}"] button[title="E2E Sin arrastrar"]`);
    await chip.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary')).toBeVisible(CARGA);
  });
});

async function arrastrarConElMouse(page: Page, chip: Locator, hasta: string): Promise<void> {
  const origen = await chip.boundingBox();
  const destino = await page.locator(`[data-fecha="${hasta}"]`).boundingBox();
  if (origen === null || destino === null) throw new Error('no se pudo medir el arrastre');

  await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
  await page.mouse.down();
  await page.mouse.move(origen.x + origen.width / 2 + 12, origen.y + origen.height / 2, {
    steps: 3,
  });
  await page.mouse.move(destino.x + destino.width / 2, destino.y + 40, { steps: 8 });
  await page.mouse.up();
}

// El arrastre con el dedo solo tiene sentido donde hay grilla: en una tablet o en un celular dado
// vuelta. Se prueba con toques de verdad del protocolo de DevTools, no con eventos sintéticos: el
// gesto usa setPointerCapture, que necesita un puntero que el navegador tenga activo.
test.describe('arrastrar con el dedo', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test('la presión sostenida agarra y el dedo lo lleva a otro día', async ({ page }) => {
    const desde = diaDelMes(10);
    const hasta = diaDelMes(17);
    await crearAnotacionPorRest(sesion, { fecha: desde, texto: 'E2E Con el dedo' });

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
    const chip = page.locator(`[data-fecha="${desde}"] button[title="E2E Con el dedo"]`);
    await expect(chip).toBeVisible(CARGA);

    const origen = await chip.boundingBox();
    const destino = await page.locator(`[data-fecha="${hasta}"]`).boundingBox();
    if (origen === null || destino === null) throw new Error('no se pudo medir el arrastre');

    const cdp = await page.context().newCDPSession(page);
    const x0 = origen.x + origen.width / 2;
    const y0 = origen.y + origen.height / 2;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: x0, y: y0 }],
    });
    // La espera del gesto es de 350 ms: antes de eso, mover es scrollear.
    await page.waitForTimeout(500);
    await expect(page.locator('[aria-live="assertive"]')).toContainText(
      'Agarraste E2E Con el dedo',
    );

    const xd = destino.x + destino.width / 2;
    const yd = destino.y + 40;
    for (let paso = 1; paso <= 6; paso += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x0 + ((xd - x0) * paso) / 6, y: y0 + ((yd - y0) * paso) / 6 }],
      });
    }
    await expect(page.locator(`[data-fecha="${hasta}"][data-destino]`)).toHaveCount(1, CARGA);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(
      page.locator(`[data-fecha="${hasta}"] button[title="E2E Con el dedo"]`),
    ).toBeVisible(CARGA);
    await expect
      .poll(
        async () =>
          (await anotacionesDelTaller(sesion)).find((a) => a.texto === 'E2E Con el dedo')?.fecha,
        CARGA,
      )
      .toBe(hasta);
  });

  test('un toque corto sigue abriendo el día, no arrastra', async ({ page }) => {
    const dia = diaDelMes(12);
    await crearAnotacionPorRest(sesion, { fecha: dia, texto: 'E2E Toque corto' });

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
    const chip = page.locator(`[data-fecha="${dia}"] button[title="E2E Toque corto"]`);
    const caja = await chip.boundingBox();
    if (caja === null) throw new Error('no se pudo medir el chip');

    const cdp = await page.context().newCDPSession(page);
    const punto = { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [punto] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(page.getByRole('complementary')).toBeVisible(CARGA);
    expect(
      (await anotacionesDelTaller(sesion)).find((a) => a.texto === 'E2E Toque corto')?.fecha,
    ).toBe(dia);
  });
});

test.describe('sin señal', () => {
  test('un herraje cargado en modo avión sobrevive a cerrar la app y entra como un solo cambio', async ({
    page,
    context,
  }) => {
    const id = await trabajo('E2E Sin señal', { visita: conDias(-2) });

    await page.goto(`/proyectos/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Sin señal' })).toBeVisible(CARGA);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await listoParaCortar(page);

    await context.setOffline(true);
    await agregarNecesidad(page, 'herraje', 'Bisagras sin señal', '6');

    await expect(indicadorDeSync(page)).toContainText('Sin conexión', CARGA);
    await expect(indicadorDeSync(page)).toContainText('1 cambio');
    expect(await necesidadesDe(sesion, id)).toHaveLength(0);

    await page.close();
    const reabierta = await context.newPage();
    await reabierta.goto(`/proyectos/${id}`);
    await expect(reabierta.getByRole('heading', { level: 1, name: 'E2E Sin señal' })).toBeVisible(
      CARGA,
    );
    await expect(loQueHaceFalta(reabierta).getByText('Bisagras sin señal')).toBeVisible(CARGA);
    await expect(indicadorDeSync(reabierta)).toContainText('1 cambio');

    await context.setOffline(false);
    await expect(indicadorDeSync(reabierta)).toBeHidden({ timeout: 20_000 });
    const filas = await necesidadesDe(sesion, id);
    expect(filas.map((f) => [f.nombre, f.cantidad])).toEqual([['Bisagras sin señal', 6]]);
  });

  test('arrastrar sin señal deja el cambio pendiente y se sincroniza al volver', async ({
    page,
    context,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) < 768, 'la grilla del mes existe de tablet para arriba');
    const desde = diaDelMes(10);
    const hasta = diaDelMes(18);
    await crearAnotacionPorRest(sesion, { fecha: desde, texto: 'E2E Arrastre sin señal' });

    await page.goto('/agenda');
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible(CARGA);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await listoParaCortar(page);

    await context.setOffline(true);
    const chip = page.locator(`[data-fecha="${desde}"] button[title="E2E Arrastre sin señal"]`);
    await arrastrarConElMouse(page, chip, hasta);

    await expect(
      page.locator(`[data-fecha="${hasta}"] button[title="E2E Arrastre sin señal"]`),
    ).toBeVisible(CARGA);
    await expect(indicadorDeSync(page)).toContainText('Sin conexión', CARGA);
    expect(
      (await anotacionesDelTaller(sesion)).find((a) => a.texto === 'E2E Arrastre sin señal')?.fecha,
    ).toBe(desde);

    await context.setOffline(false);
    await expect(indicadorDeSync(page)).toBeHidden({ timeout: 20_000 });
    expect(
      (await anotacionesDelTaller(sesion)).find((a) => a.texto === 'E2E Arrastre sin señal')?.fecha,
    ).toBe(hasta);
  });
});
