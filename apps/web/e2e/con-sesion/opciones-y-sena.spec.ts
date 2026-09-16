import { expect, test, type Page } from '@playwright/test';

import {
  ajustarTaller,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  opcionesDe,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

const SOLO_ALAN = 124_800_000;
const LOS_DOS = 230_000_000;
const CON_BACHA = 49_420_000;

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

interface Opcion {
  id: string;
  descripcion: string;
  monto_centavos: number;
  aprobada: boolean;
}

function opcion(descripcion: string, monto: number, aprobada = false): Opcion {
  return { id: crypto.randomUUID(), descripcion, monto_centavos: monto, aprobada };
}

async function trabajo(
  titulo: string,
  extra: {
    estado?: string;
    presupuesto?: number | null;
    sena?: number | null;
    opciones?: Opcion[];
    pago?: number;
  } = {},
): Promise<string> {
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  const hoy = new Date().toISOString().slice(0, 10);
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado: extra.estado ?? 'presupuesto_enviado',
      presupuesto_centavos: extra.presupuesto ?? null,
      sena_bp: extra.sena ?? null,
      comprobante: 'sin_comprobante',
    },
    pagos:
      extra.pago === undefined
        ? []
        : [
            {
              id: crypto.randomUUID(),
              fecha: hoy,
              concepto: 'Seña de la visita',
              monto_centavos: extra.pago,
            },
          ],
    gastos: [],
    opciones: extra.opciones,
  });
  return id;
}

async function abrirLaFicha(page: Page, id: string, titulo: string): Promise<void> {
  await page.goto(`/proyectos/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible(CARGA);
}

function laSena(page: Page) {
  return page.getByRole('region', { name: 'Seña para confirmar' });
}

function lasOpciones(page: Page) {
  return page.getByRole('region', { name: 'Opciones de presupuesto' });
}

function laOpcion(page: Page, detalle: string) {
  return lasOpciones(page).getByRole('listitem').filter({ hasText: detalle });
}

test('tres opciones se guardan, sobreviven a recargar, y mientras ninguna esté tildada el trabajo no tiene presupuesto', async ({
  page,
}) => {
  const id = await trabajo('Escritorio');

  await page.goto(`/proyectos/${id}/editar`);
  await expect(page.getByRole('button', { name: 'Agregar una opción' })).toBeVisible(CARGA);

  const detalles = ['Solo el escritorio de Alan', 'Los 2 escritorios', 'Los 2 con cajonera'];
  const montos = [SOLO_ALAN, LOS_DOS, 260_000_000];
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'Agregar una opción' }).click();
    await page.getByLabel(`Qué incluye la opción ${String(i + 1)}`).fill(detalles[i] ?? '');
    await page
      .getByLabel(`Importe de la opción ${String(i + 1)}`)
      .fill(String((montos[i] ?? 0) / 100));
  }

  await page.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Escritorio' })).toBeVisible(CARGA);

  await expect.poll(async () => (await opcionesDe(sesion, id)).length, CARGA).toBe(3);
  expect((await leerProyecto(sesion, 'Escritorio'))?.presupuesto_centavos).toBeNull();

  await abrirLaFicha(page, id, 'Escritorio');
  await expect(lasOpciones(page).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText('Todavía no hay presupuesto', { exact: false })).toBeVisible();
});

test('tildar una opción le pone el presupuesto al trabajo, cambiar de opinión lo cambia, y destildar lo deja sin presupuesto', async ({
  page,
}) => {
  const id = await trabajo('Escritorio', {
    opciones: [
      opcion('Solo el escritorio de Alan', SOLO_ALAN),
      opcion('Los 2 escritorios', LOS_DOS),
    ],
  });

  await abrirLaFicha(page, id, 'Escritorio');

  await laOpcion(page, 'Solo el escritorio de Alan')
    .getByRole('button', { name: 'La aprobó' })
    .click();
  await expect
    .poll(async () => (await leerProyecto(sesion, 'Escritorio'))?.presupuesto_centavos, CARGA)
    .toBe(SOLO_ALAN);

  await expect(
    laOpcion(page, 'Solo el escritorio de Alan').getByRole('button', { name: 'Aprobada' }),
  ).toBeVisible();

  await laOpcion(page, 'Los 2 escritorios').getByRole('button', { name: 'La aprobó' }).click();
  await expect
    .poll(async () => (await leerProyecto(sesion, 'Escritorio'))?.presupuesto_centavos, CARGA)
    .toBe(LOS_DOS);
  await expect
    .poll(async () => (await opcionesDe(sesion, id)).filter((o) => o.aprobada).length, CARGA)
    .toBe(1);

  await expect(
    laOpcion(page, 'Los 2 escritorios').getByRole('button', { name: 'Aprobada' }),
  ).toBeVisible();
  await laOpcion(page, 'Los 2 escritorios').getByRole('button', { name: 'Aprobada' }).click();
  await expect
    .poll(async () => (await leerProyecto(sesion, 'Escritorio'))?.presupuesto_centavos, CARGA)
    .toBeNull();
});

test('con opciones cargadas no hay ningún campo para escribir el presupuesto a mano', async ({
  page,
}) => {
  const id = await trabajo('Escritorio', {
    opciones: [opcion('Solo el escritorio de Alan', SOLO_ALAN, true)],
  });

  await page.goto(`/proyectos/${id}/editar`);
  await expect(page.getByRole('button', { name: 'Agregar una opción' })).toBeVisible(CARGA);

  await expect(page.getByRole('textbox', { name: 'Presupuesto', exact: true })).toHaveCount(0);
  await expect(page.getByText('Sale de la opción que tildes', { exact: false })).toBeVisible();
});

test('un trabajo sin opciones carga el presupuesto como siempre', async ({ page }) => {
  const id = await trabajo('Vanitory', { estado: 'a_presupuestar' });

  await page.goto(`/proyectos/${id}/editar`);
  const campo = page.getByLabel('Presupuesto', { exact: true });
  await expect(campo).toBeVisible(CARGA);
  await campo.fill(String(CON_BACHA / 100));
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();

  await expect
    .poll(async () => (await leerProyecto(sesion, 'Vanitory'))?.presupuesto_centavos, CARGA)
    .toBe(CON_BACHA);
});

test('la seña sale del porcentaje del taller, descuenta lo cobrado en la visita, y con uno propio cambia', async ({
  page,
}) => {
  await ajustarTaller(sesion, { sena_bp: 5000 });
  const id = await trabajo('Escritorio', { presupuesto: LOS_DOS, pago: 15_000_000 });

  await abrirLaFicha(page, id, 'Escritorio');
  const bloque = laSena(page);
  await expect(bloque).toBeVisible(CARGA);
  await expect(bloque).toContainText('50% del presupuesto');
  await expect(bloque).toContainText('1.150.000');
  await expect(bloque).toContainText('150.000');
  await expect(bloque).toContainText('1.000.000');

  await page.goto(`/proyectos/${id}/editar`);
  await page.getByLabel('Seña propia (%)').fill('30');
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Escritorio' })).toBeVisible(CARGA);

  await expect(laSena(page)).toContainText('30% del presupuesto');
  await expect(laSena(page)).toContainText('690.000');
});

test('cuando la seña ya está cubierta lo dice, y sin presupuesto dice que no hay nada que calcular', async ({
  page,
}) => {
  const cubierta = await trabajo('Escritorio', { presupuesto: LOS_DOS, pago: 150_000_000 });
  const sinPresupuesto = await trabajo('Vanitory', { estado: 'a_presupuestar' });

  await abrirLaFicha(page, cubierta, 'Escritorio');
  await expect(laSena(page)).toContainText('La seña ya está cubierta');
  await expect(laSena(page)).toContainText('de más');

  await abrirLaFicha(page, sinPresupuesto, 'Vanitory');
  await expect(laSena(page)).toContainText('Todavía no hay presupuesto');
});

test('sin señal se cargan opciones y se aprueba una: al volver la señal entra todo junto', async ({
  page,
  context,
}) => {
  const id = await trabajo('Escritorio');

  await page.goto(`/proyectos/${id}/editar`);
  await expect(page.getByRole('button', { name: 'Agregar una opción' })).toBeVisible(CARGA);
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
  });

  await page.getByRole('button', { name: 'Agregar una opción' }).click();
  await page.getByLabel('Qué incluye la opción 1').fill('Solo el escritorio de Alan');
  await page.getByLabel('Importe de la opción 1').fill(String(SOLO_ALAN / 100));
  await page.getByRole('button', { name: 'Agregar una opción' }).click();
  await page.getByLabel('Qué incluye la opción 2').fill('Los 2 escritorios');
  await page.getByLabel('Importe de la opción 2').fill(String(LOS_DOS / 100));
  await page.getByRole('button', { name: 'Guardar los cambios' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Escritorio' })).toBeVisible(CARGA);
  await laOpcion(page, 'Solo el escritorio de Alan')
    .getByRole('button', { name: 'La aprobó' })
    .click();
  await expect(
    laOpcion(page, 'Solo el escritorio de Alan').getByRole('button', { name: 'Aprobada' }),
  ).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
  });

  await expect.poll(async () => (await opcionesDe(sesion, id)).length, { timeout: 30_000 }).toBe(2);
  await expect
    .poll(async () => (await leerProyecto(sesion, 'Escritorio'))?.presupuesto_centavos, {
      timeout: 30_000,
    })
    .toBe(SOLO_ALAN);
});

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

test('la ficha con opciones y seña se ve igual en claro y en oscuro', async ({
  page,
}, testInfo) => {
  const id = await trabajo('Escritorio', {
    presupuesto: null,
    pago: 15_000_000,
    opciones: [
      opcion('Solo el escritorio de Alan', SOLO_ALAN, true),
      opcion('Los 2 escritorios', LOS_DOS),
    ],
  });

  const lugar = testInfo.project.name;

  await abrirLaFicha(page, id, 'Escritorio');
  await expect(lasOpciones(page)).toBeVisible();
  await expect(laSena(page)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`opciones-y-sena-${lugar}-claro.png`) });

  await page.addInitScript(() => {
    localStorage.setItem('maun:tema', 'dark');
  });
  await abrirLaFicha(page, id, 'Escritorio');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(lasOpciones(page)).toBeVisible();
  await expect(laSena(page)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`opciones-y-sena-${lugar}-oscuro.png`) });

  await page.goto(`/proyectos/${id}/editar`);
  await expect(page.getByRole('button', { name: 'Agregar una opción' })).toBeVisible(CARGA);
  await page.screenshot({
    path: testInfo.outputPath(`opciones-formulario-${lugar}-oscuro.png`),
    fullPage: true,
  });
});

test('las opciones y la seña se recorren con el teclado y se anuncian sin depender del color', async ({
  page,
}, testInfo) => {
  const id = await trabajo('Escritorio', {
    presupuesto: null,
    pago: 15_000_000,
    opciones: [
      opcion('Solo el escritorio de Alan', SOLO_ALAN, true),
      opcion('Los 2 escritorios', LOS_DOS),
    ],
  });

  await abrirLaFicha(page, id, 'Escritorio');

  const arbolOpciones = await lasOpciones(page).ariaSnapshot();
  console.log(`${testInfo.project.name}, árbol de las opciones:\n${arbolOpciones}`);
  expect(arbolOpciones).toContain('button "Aprobada" [pressed]');
  expect(arbolOpciones).toContain('button "La aprobó"');
  expect(arbolOpciones).toContain('Aprobada: es el presupuesto del trabajo');

  const arbolSena = await laSena(page).ariaSnapshot();
  console.log(`${testInfo.project.name}, árbol de la seña:\n${arbolSena}`);
  expect(arbolSena).toContain('Seña');
  expect(arbolSena).toContain('Cobrado');
  expect(arbolSena).toContain('Falta');

  await page.getByRole('main').focus();
  const recorrido = await recorrerConTab(page, 40);
  console.log(`${testInfo.project.name}, recorrido con Tab:\n${recorrido.join('\n')}`);
  expect(recorrido.some((foco) => foco.includes('La aprobó'))).toBe(true);
  expect(recorrido.some((foco) => foco.includes('Aprobada') && foco.includes('presionado'))).toBe(
    true,
  );
});
