import { expect, test, type Page } from '@playwright/test';

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
const CBU_A_LA_VISTA = '0110 0013 1234 5678 9012 33';
const ALIAS = 'maun.muebles';
const TITULAR = 'Ana Gutiérrez';
const CUIT = '27-30123456-4';

const TITULO = 'Mesada de cocina con bajo mesada';

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
});

test.afterEach(async () => {
  await ajustarCobroDelTaller(sesion, { alias: '', cbu: '', titular: '', cuit: '' });
});

interface Escenario {
  estado: 'presupuesto_enviado' | 'en_curso' | 'entregado';
  presupuesto?: number;
  pagos?: { concepto: string; monto: number }[];
}

async function trabajoConEnlace(token: string, escenario: Escenario): Promise<string> {
  const { id, clienteId } = await contactoPorRpc(sesion, {
    titulo: TITULO,
    estado: 'presupuesto_enviado',
  });
  const hoy = hoyLocal();

  // De presupuesto_enviado a entregado no se llega de un salto: la máquina de estados obliga a
  // pasar por en_curso, que es como pasa de verdad.
  const camino =
    escenario.estado === 'entregado'
      ? (['en_curso', 'entregado'] as const)
      : escenario.estado === 'en_curso'
        ? (['en_curso'] as const)
        : ([] as const);

  for (const [paso, estado] of camino.entries()) {
    const proyecto = await leerProyecto(sesion, TITULO);
    const ultimo = paso === camino.length - 1;
    await guardarProyectoPorRpc(sesion, {
      proyecto: {
        id,
        version: proyecto?.version ?? null,
        cliente_id: clienteId,
        titulo: TITULO,
        estado,
        presupuesto_centavos: escenario.presupuesto ?? null,
        comprobante: 'sin_comprobante',
        direccion_entrega: 'Mitre 800, Castelar',
        fecha_inicio: hoy,
        entrega_estimada: hoy,
        fecha_entrega: estado === 'entregado' ? hoy : null,
      },
      pagos: ultimo
        ? (escenario.pagos ?? []).map((pago) => ({
            id: crypto.randomUUID(),
            fecha: hoy,
            concepto: pago.concepto,
            monto_centavos: pago.monto,
          }))
        : [],
      gastos: [],
    });
  }

  if (camino.length === 0 && escenario.presupuesto !== undefined) {
    const proyecto = await leerProyecto(sesion, TITULO);
    await guardarProyectoPorRpc(sesion, {
      proyecto: {
        id,
        version: proyecto?.version ?? null,
        cliente_id: clienteId,
        titulo: TITULO,
        estado: 'presupuesto_enviado',
        presupuesto_centavos: escenario.presupuesto,
        comprobante: 'sin_comprobante',
        direccion_entrega: 'Mitre 800, Castelar',
      },
      pagos: [],
      gastos: [],
    });
  }

  await enlacePorRest(sesion, id, token);
  return id;
}

function elBloque(page: Page) {
  return page.getByRole('region', { name: 'Cómo transferir' });
}

test('el cliente ve los datos para transferir, con su botón para copiar cada uno', async ({
  page,
}, testInfo) => {
  await ajustarCobroDelTaller(sesion, { alias: ALIAS, cbu: CBU, titular: TITULAR, cuit: CUIT });
  const token = tokenDePrueba();
  await trabajoConEnlace(token, {
    estado: 'en_curso',
    presupuesto: 90_000_000,
    pagos: [{ concepto: 'Seña', monto: 30_000_000 }],
  });

  await page.goto(`/v/${token}`);
  const bloque = elBloque(page);
  await expect(bloque).toBeVisible(CARGA);

  await expect(bloque).toContainText(ALIAS);
  await expect(bloque).toContainText(CBU_A_LA_VISTA);
  await expect(bloque).toContainText(TITULAR);
  await expect(bloque).toContainText(CUIT);

  await page.screenshot({
    path: testInfo.outputPath(`como-transferir-${testInfo.project.name}.png`),
    fullPage: true,
  });

  // El CBU se muestra agrupado para leerlo y se copia pelado: es lo que el cliente pega en su banco.
  await bloque.getByRole('button', { name: 'Copiar el CBU' }).click();
  await expect(bloque.getByRole('button', { name: 'Copiar el CBU' })).toContainText('Copiado');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CBU);

  await bloque.getByRole('button', { name: 'Copiar el alias' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ALIAS);

  console.log(
    `\n=== ${testInfo.project.name}: árbol del bloque para transferir ===\n${await bloque.ariaSnapshot()}`,
  );
});

test('con la API del portapapeles rota, copia igual por el camino de atrás', async ({ page }) => {
  await ajustarCobroDelTaller(sesion, { alias: ALIAS, cbu: CBU, titular: '', cuit: '' });
  const token = tokenDePrueba();
  await trabajoConEnlace(token, { estado: 'en_curso', presupuesto: 90_000_000 });

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => ({
        writeText: () =>
          Promise.reject(new DOMException('Document is not focused.', 'NotAllowedError')),
      }),
    });
  });

  await page.goto(`/v/${token}`);
  const bloque = elBloque(page);
  await expect(bloque).toBeVisible(CARGA);

  await bloque.getByRole('button', { name: 'Copiar el alias' }).click();
  await expect(bloque.getByRole('button', { name: 'Copiar el alias' })).toContainText('Copiado');
});

test('si fallan los dos caminos, no dice «Copiado»: deja el dato marcado y lo explica', async ({
  page,
}, testInfo) => {
  await ajustarCobroDelTaller(sesion, { alias: ALIAS, cbu: CBU, titular: '', cuit: '' });
  const token = tokenDePrueba();
  await trabajoConEnlace(token, { estado: 'en_curso', presupuesto: 90_000_000 });

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => undefined });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
  });

  await page.goto(`/v/${token}`);
  const bloque = elBloque(page);
  await expect(bloque).toBeVisible(CARGA);

  await bloque.getByRole('button', { name: 'Copiar el alias' }).click();

  await expect(bloque.getByRole('button', { name: 'Copiar el alias' })).not.toContainText(
    'Copiado',
  );
  await expect(bloque).toContainText(/mantené apretado|Marcalo con el dedo/);
  expect(await page.evaluate(() => (globalThis.getSelection()?.toString() ?? '').trim())).toBe(
    ALIAS,
  );

  await page.screenshot({
    path: testInfo.outputPath(`copiar-a-mano-${testInfo.project.name}.png`),
  });
});

test('sin datos cargados no hay bloque, y el saldo se coordina con el taller', async ({ page }) => {
  const token = tokenDePrueba();
  await trabajoConEnlace(token, { estado: 'en_curso', presupuesto: 90_000_000 });

  await page.goto(`/v/${token}`);
  await expect(page.getByRole('region', { name: 'Tu mueble' })).toBeVisible(CARGA);

  await expect(elBloque(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Lo que pagaste' })).toContainText(
    'El saldo lo arreglás directamente con el taller',
  );
});

test('el bloque aparece antes de aprobar y desaparece cuando está todo pagado', async ({
  page,
}) => {
  await ajustarCobroDelTaller(sesion, { alias: ALIAS, cbu: '', titular: '', cuit: '' });

  const sinPresupuesto = tokenDePrueba();
  await trabajoConEnlace(sinPresupuesto, { estado: 'presupuesto_enviado' });
  await page.goto(`/v/${sinPresupuesto}`);
  await expect(elBloque(page)).toBeVisible(CARGA);

  await vaciarTaller(sesion);
  const saldado = tokenDePrueba();
  await trabajoConEnlace(saldado, {
    estado: 'entregado',
    presupuesto: 90_000_000,
    pagos: [{ concepto: 'Total', monto: 90_000_000 }],
  });
  await page.goto(`/v/${saldado}`);
  await expect(page.getByRole('region', { name: 'Tu mueble' })).toBeVisible(CARGA);
  await expect(elBloque(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Lo que pagaste' })).toContainText(
    'Gracias. No queda nada pendiente.',
  );
});

test('la página del cliente no le dice nunca cuánto hace que no pasa nada', async ({ page }) => {
  await ajustarCobroDelTaller(sesion, { alias: ALIAS, cbu: CBU, titular: TITULAR, cuit: CUIT });

  const escenarios: [string, Escenario][] = [
    ['sin presupuesto', { estado: 'presupuesto_enviado' }],
    ['aprobado sin pagos', { estado: 'en_curso', presupuesto: 90_000_000 }],
    [
      'en fabricación con un pago',
      {
        estado: 'en_curso',
        presupuesto: 90_000_000,
        pagos: [{ concepto: 'Seña', monto: 30_000_000 }],
      },
    ],
    [
      'entregado con saldo',
      {
        estado: 'entregado',
        presupuesto: 90_000_000,
        pagos: [{ concepto: 'Seña', monto: 30_000_000 }],
      },
    ],
    [
      'saldado',
      {
        estado: 'entregado',
        presupuesto: 90_000_000,
        pagos: [{ concepto: 'Total', monto: 90_000_000 }],
      },
    ],
  ];

  for (const [nombre, escenario] of escenarios) {
    await vaciarTaller(sesion);
    const token = tokenDePrueba();
    await trabajoConEnlace(token, escenario);

    await page.goto(`/v/${token}`);
    await expect(page.getByRole('region', { name: 'Tu mueble' })).toBeVisible(CARGA);

    const texto = await page.getByRole('main').innerText();
    expect(texto, `«${nombre}» le cuenta al cliente cuánto hace que no pasa nada`).not.toMatch(
      /[Hh]ace \d/,
    );
    expect(texto).not.toContain('no hay novedades');
    expect(texto).not.toContain('Esta página no cobra nada');
    expect(texto).not.toContain('ustedes lo arreglen');
    expect(texto).not.toContain('Cuando el mueble esté armado');
    console.log(`«${nombre}»: sección de pagos\n${await seccionDePagos(page)}\n`);
  }
});

async function seccionDePagos(page: Page): Promise<string> {
  return page.getByRole('region', { name: 'Lo que pagaste' }).innerText();
}

test('los datos para transferir se recorren con el teclado y se copian con Enter', async ({
  page,
}, testInfo) => {
  await ajustarCobroDelTaller(sesion, { alias: ALIAS, cbu: CBU, titular: TITULAR, cuit: CUIT });
  const token = tokenDePrueba();
  await trabajoConEnlace(token, { estado: 'en_curso', presupuesto: 90_000_000 });

  await page.goto(`/v/${token}`);
  const bloque = elBloque(page);
  await expect(bloque).toBeVisible(CARGA);

  console.log(
    `\n=== ${testInfo.project.name}: árbol del bloque para transferir ===\n${await bloque.ariaSnapshot()}`,
  );

  const recorrido: string[] = [];
  for (let paso = 0; paso < 4; paso += 1) {
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body) return '';
      const nombre = activo.getAttribute('aria-label') ?? activo.textContent.trim();
      return `${activo.tagName.toLowerCase()}: ${nombre.slice(0, 40)}`;
    });
    if (foco !== '') recorrido.push(foco);
  }
  console.log(`\n=== ${testInfo.project.name}: recorrido con Tab ===\n${recorrido.join('\n')}`);

  expect(recorrido).toEqual([
    'button: Copiar el alias',
    'button: Copiar el CBU',
    'button: Copiar el titular',
    'button: Copiar el CUIT',
  ]);

  // Con el foco en un botón, Enter copia: el camino del teclado es el mismo que el del dedo.
  await bloque.getByRole('button', { name: 'Copiar el alias' }).focus();
  await page.keyboard.press('Enter');
  await expect(bloque.getByRole('button', { name: 'Copiar el alias' })).toContainText('Copiado');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ALIAS);
});
