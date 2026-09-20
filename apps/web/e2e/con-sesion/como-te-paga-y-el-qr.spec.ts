import { expect, test, type Page } from '@playwright/test';

import { listoParaCortar } from '../apoyo/pantalla';
import {
  ajustarCobroDelTaller,
  contactoPorRpc,
  enlacePorRest,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

const CBU = '0110001312345678901233';
const ALIAS = 'maun.muebles';
const TITULAR = 'Ana Gutiérrez';
const CUIT = '27-30123456-4';

const TITULO = 'Placard de tres puertas corredizas';

let sesion: SesionDePrueba;

function hoyLocal(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${String(ahora.getFullYear())}-${mes}-${dia}`;
}

function tokenDePrueba(): string {
  return `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
}

test.beforeEach(async ({ context }) => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ajustarCobroDelTaller(sesion, { alias: ALIAS, cbu: CBU, titular: TITULAR, cuit: CUIT });
});

test.afterEach(async () => {
  await ajustarCobroDelTaller(sesion, { alias: '', cbu: '', titular: '', cuit: '' });
});

// $900.000 de presupuesto, la seña de siempre es la mitad y todavía no cobró nada: le tocan
// $450.000 de seña y le van a quedar $450.000 de saldo.
let clienteDelTrabajo = '';

async function trabajoConEnlace(token: string): Promise<string> {
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
    pagos: [],
    gastos: [],
  });

  await enlacePorRest(sesion, id, token);
  clienteDelTrabajo = clienteId;
  return id;
}

function laSeccion(page: Page) {
  return page.getByRole('region', { name: 'Cómo te paga' });
}

function elGrupo(page: Page, instancia: string) {
  return page.getByRole('group', { name: `${instancia}: cómo te la paga` });
}

test('el dueño configura la seña por transferencia y el saldo en efectivo, y el cliente lo ve', async ({
  page,
}, testInfo) => {
  const token = tokenDePrueba();
  const id = await trabajoConEnlace(token);

  await page.goto(`/proyectos/${id}/compartir`);
  await listoParaCortar(page);

  const seccion = laSeccion(page);
  await expect(seccion).toBeVisible(CARGA);

  // Sin configurar y con los datos cargados en Ajustes: las dos formas, en las dos filas.
  for (const instancia of ['La seña', 'El saldo']) {
    for (const forma of ['Transferencia', 'Efectivo']) {
      await expect(elGrupo(page, instancia).getByRole('checkbox', { name: forma })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    }
  }

  console.log(
    `\n=== ${testInfo.project.name}: árbol de «Cómo te paga» ===\n${await seccion.ariaSnapshot()}`,
  );

  // La seña solo por transferencia, el saldo solo en efectivo.
  await elGrupo(page, 'La seña').getByRole('checkbox', { name: 'Efectivo' }).click();
  await expect(
    elGrupo(page, 'La seña').getByRole('checkbox', { name: 'Efectivo' }),
  ).toHaveAttribute('aria-checked', 'false', CARGA);

  await elGrupo(page, 'El saldo').getByRole('checkbox', { name: 'Transferencia' }).click();
  await expect(
    elGrupo(page, 'El saldo').getByRole('checkbox', { name: 'Transferencia' }),
  ).toHaveAttribute('aria-checked', 'false', CARGA);

  await page.screenshot({
    path: testInfo.outputPath(`como-te-paga-${testInfo.project.name}.png`),
    fullPage: true,
  });

  // Con una sola forma, no se puede dejar el pago sin ninguna.
  await elGrupo(page, 'La seña').getByRole('checkbox', { name: 'Transferencia' }).click();
  await expect(seccion.getByRole('alert')).toContainText('Dejá al menos una');
  await expect(
    elGrupo(page, 'La seña').getByRole('checkbox', { name: 'Transferencia' }),
  ).toHaveAttribute('aria-checked', 'true');

  // Y el cliente ve la seña por transferencia, con su importe.
  await page.goto(`/v/${token}`);
  const bloque = page.getByRole('region', { name: 'Cómo pagar' });
  await expect(bloque).toBeVisible(CARGA);
  await expect(bloque).toContainText('Ahora, la seña');
  await expect(bloque).toContainText('$ 450.000');
  await expect(bloque).toContainText(ALIAS);
  await expect(bloque).toContainText('Después, el saldo: $ 450.000, en efectivo.');
  await expect(bloque).not.toContainText('también');

  await page.screenshot({
    path: testInfo.outputPath(`vista-cliente-transferencia-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('con la seña cubierta y el saldo en efectivo, los datos de la cuenta no llegan al navegador', async ({
  page,
}, testInfo) => {
  const token = tokenDePrueba();
  const id = await trabajoConEnlace(token);
  const hoy = hoyLocal();

  await page.goto(`/proyectos/${id}/compartir`);
  await listoParaCortar(page);
  await elGrupo(page, 'El saldo').getByRole('checkbox', { name: 'Transferencia' }).click();
  await expect(
    elGrupo(page, 'El saldo').getByRole('checkbox', { name: 'Transferencia' }),
  ).toHaveAttribute('aria-checked', 'false', CARGA);

  // Ahora se cobra la seña entera: lo que toca pasa a ser el saldo, que es en efectivo.
  const proyecto = await leerProyecto(sesion, TITULO);
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: proyecto?.version ?? null,
      cliente_id: clienteDelTrabajo,
      titulo: TITULO,
      estado: 'en_curso',
      presupuesto_centavos: 90_000_000,
      comprobante: 'sin_comprobante',
      direccion_entrega: 'Sarmiento 2310, Morón',
      fecha_inicio: hoy,
      entrega_estimada: hoy,
    },
    pagos: [{ id: crypto.randomUUID(), fecha: hoy, concepto: 'Seña', monto_centavos: 45_000_000 }],
    gastos: [],
  });

  const respuestas: string[] = [];
  page.on('response', (respuesta) => {
    if (respuesta.url().includes('vista_compartida')) {
      void respuesta
        .text()
        .then((cuerpo) => respuestas.push(cuerpo))
        .catch(() => undefined);
    }
  });

  await page.goto(`/v/${token}`);
  const bloque = page.getByRole('region', { name: 'Cómo pagar' });
  await expect(bloque).toBeVisible(CARGA);
  await expect(bloque).toContainText('Ahora, el saldo');
  await expect(bloque).toContainText('$ 450.000');
  await expect(bloque).toContainText('El saldo es en efectivo, en mano.');
  await expect(bloque).not.toContainText(ALIAS);
  await expect(bloque).not.toContainText('Después');

  // Lo que no se muestra, no se manda: el alias no está ni en el cuerpo crudo de la respuesta.
  await expect.poll(() => respuestas.length, CARGA).toBeGreaterThan(0);
  for (const cuerpo of respuestas) {
    expect(cuerpo, 'el alias del taller viajó en la respuesta de la función pública').not.toContain(
      ALIAS,
    );
    expect(cuerpo).not.toContain(CBU);
    expect(cuerpo).not.toContain(TITULAR);
  }
  console.log(`\n=== ${testInfo.project.name}: respuesta cruda con el saldo en efectivo ===`);
  console.log(respuestas[0] ?? '(sin respuesta)');

  await page.screenshot({
    path: testInfo.outputPath(`vista-cliente-efectivo-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('sin datos en Ajustes, por defecto solo efectivo y una línea que lleva a cargarlos', async ({
  page,
}, testInfo) => {
  await ajustarCobroDelTaller(sesion, { alias: '', cbu: '', titular: '', cuit: '' });
  const token = tokenDePrueba();
  const id = await trabajoConEnlace(token);

  await page.goto(`/proyectos/${id}/compartir`);
  await listoParaCortar(page);

  const seccion = laSeccion(page);
  await expect(seccion).toBeVisible(CARGA);
  await expect(
    elGrupo(page, 'La seña').getByRole('checkbox', { name: 'Transferencia' }),
  ).toHaveAttribute('aria-checked', 'false');
  await expect(
    elGrupo(page, 'La seña').getByRole('checkbox', { name: 'Efectivo' }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(seccion).toContainText('solo podés cobrar en efectivo');

  await seccion.getByRole('link', { name: 'Cargalos en Ajustes' }).click();
  await expect(page).toHaveURL(/\/ajustes$/);
  await expect(page.getByRole('region', { name: 'Cómo te transfieren' })).toContainText(
    'no te cuesta comisión',
  );

  await page.screenshot({
    path: testInfo.outputPath(`ajustes-como-te-transfieren-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('el código QR lleva al mismo enlace, se recorre con el teclado y muere con él', async ({
  page,
}, testInfo) => {
  const token = tokenDePrueba();
  const id = await trabajoConEnlace(token);

  await page.goto(`/proyectos/${id}/compartir`);
  await listoParaCortar(page);

  const enlace = page.getByRole('region', { name: 'El enlace' });
  const url = (await enlace.locator('.font-mono').innerText()).trim();

  await page.getByRole('button', { name: 'Mostrarle el código QR' }).click();

  const hoja = page.getByRole('dialog');
  await expect(hoja).toBeVisible(CARGA);
  await expect(hoja.getByRole('img', { name: /Código QR del enlace/ })).toBeVisible(CARGA);
  await expect(hoja).toContainText('Escaneá con la cámara del celular');
  await expect(hoja).toContainText(TITULO);
  await expect(hoja).toContainText(url);
  await expect(hoja).toContainText('deja de andar');

  // El dibujo va negro sobre blanco, gane el tema que gane.
  const dibujo = hoja.getByRole('img', { name: /Código QR del enlace/ });
  const colores = await dibujo.evaluate((svg) => {
    const camino = svg.querySelector('path');
    return {
      fondo: getComputedStyle(svg).backgroundColor,
      tinta: camino === null ? '' : getComputedStyle(camino).fill,
    };
  });
  expect(colores).toEqual({ fondo: 'rgb(255, 255, 255)', tinta: 'rgb(20, 20, 20)' });

  console.log(
    `\n=== ${testInfo.project.name}: árbol de la pantalla del QR ===\n${await hoja.ariaSnapshot()}`,
  );

  await page.screenshot({
    path: testInfo.outputPath(`qr-${testInfo.project.name}.png`),
    fullPage: true,
  });

  // El enlace se copia desde la misma pantalla.
  await hoja.getByRole('button', { name: 'Copiar el enlace' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);

  const recorrido: string[] = [];
  for (let paso = 0; paso < 3; paso += 1) {
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body) return '';
      return `${activo.tagName.toLowerCase()}: ${(activo.getAttribute('aria-label') ?? activo.textContent).trim().slice(0, 40)}`;
    });
    if (foco !== '') recorrido.push(foco);
  }
  console.log(
    `\n=== ${testInfo.project.name}: recorrido con Tab en la pantalla del QR ===\n${recorrido.join('\n')}`,
  );

  await page.keyboard.press('Escape');
  await expect(hoja).toBeHidden(CARGA);

  // Dar de baja el enlace se lleva el QR con él.
  await page.getByRole('button', { name: 'Dar de baja' }).click();
  await page.getByRole('button', { name: 'Darlo de baja' }).click();
  await expect(page.getByText('El enlace está dado de baja')).toBeVisible(CARGA);
  await expect(page.getByRole('button', { name: 'Mostrarle el código QR' })).toHaveCount(0);
});

test('sin conexión el código se dibuja igual: la dirección ya está en el aparato', async ({
  page,
  context,
}) => {
  const token = tokenDePrueba();
  const id = await trabajoConEnlace(token);

  await page.goto(`/proyectos/${id}/compartir`);
  await listoParaCortar(page);
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await expect(page.getByRole('button', { name: 'Mostrarle el código QR' })).toBeVisible(CARGA);

  await context.setOffline(true);
  await page.evaluate(() => {
    globalThis.dispatchEvent(new Event('offline'));
  });

  await page.getByRole('button', { name: 'Mostrarle el código QR' }).click();
  const hoja = page.getByRole('dialog');
  await expect(hoja.getByRole('img', { name: /Código QR del enlace/ })).toBeVisible(CARGA);

  await context.setOffline(false);
});

test.describe('en oscuro', () => {
  test.use({ colorScheme: 'dark' });

  test('las tres pantallas en tema oscuro, y el código sigue negro sobre blanco', async ({
    page,
  }, testInfo) => {
    const token = tokenDePrueba();
    const id = await trabajoConEnlace(token);

    await page.goto(`/proyectos/${id}/compartir`);
    await listoParaCortar(page);
    await expect(laSeccion(page)).toBeVisible(CARGA);
    await page.screenshot({
      path: testInfo.outputPath(`oscuro-como-te-paga-${testInfo.project.name}.png`),
      fullPage: true,
    });

    await page.getByRole('button', { name: 'Mostrarle el código QR' }).click();
    const hoja = page.getByRole('dialog');
    const dibujo = hoja.getByRole('img', { name: /Código QR del enlace/ });
    await expect(dibujo).toBeVisible(CARGA);

    const colores = await dibujo.evaluate((svg) => {
      const camino = svg.querySelector('path');
      return {
        fondo: getComputedStyle(svg).backgroundColor,
        tinta: camino === null ? '' : getComputedStyle(camino).fill,
      };
    });
    expect(colores, 'el código cambió de color con el tema').toEqual({
      fondo: 'rgb(255, 255, 255)',
      tinta: 'rgb(20, 20, 20)',
    });

    await page.screenshot({
      path: testInfo.outputPath(`oscuro-qr-${testInfo.project.name}.png`),
      fullPage: true,
    });
    await page.keyboard.press('Escape');

    await page.goto(`/v/${token}`);
    await expect(page.getByRole('region', { name: 'Cómo pagar' })).toBeVisible(CARGA);
    await page.screenshot({
      path: testInfo.outputPath(`oscuro-vista-cliente-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });
});
