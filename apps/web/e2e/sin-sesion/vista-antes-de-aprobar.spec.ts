import { expect, test, type Page } from '@playwright/test';

import {
  ajustarCobroDelTaller,
  crearCliente,
  enlacePorRest,
  guardarProyectoPorRpc,
  hoyEnElTaller,
  iniciarSesionDePrueba,
  leerProyecto,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

const TITULO = 'Escritorio con cajonera';
const DIRECCION = 'Belgrano 455, Haedo';
const PRESUPUESTO = 124_800_000;
const RELEVAMIENTO = 12_000_000;
const RESTO_DE_LA_SENA = 50_400_000;

const COBRO = {
  alias: 'maun.muebles',
  cbu: '0110001312345678901233',
  titular: 'Ana Gutiérrez',
  cuit: '27-30123456-4',
};

const SIN_COBRO = { alias: '', cbu: '', titular: '', cuit: '' };

const TEMAS = ['light', 'dark'] as const;

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await ajustarCobroDelTaller(sesion, COBRO);
});

test.afterEach(async () => {
  await ajustarCobroDelTaller(sesion, SIN_COBRO);
});

function tokenDePrueba(): string {
  return `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
}

function sumarDias(fecha: string, dias: number): string {
  const dia = new Date(`${fecha}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + dias);
  return dia.toISOString().slice(0, 10);
}

type Situacion = 'con-fecha' | 'sin-fecha' | 'vencido' | 'aprobado';

async function trabajoConEnlace(situacion: Situacion): Promise<string> {
  const hoy = hoyEnElTaller();
  const id = crypto.randomUUID();
  const clienteId = await crearCliente(sesion, 'Lucía Ferreyra');
  const valeHasta =
    situacion === 'con-fecha'
      ? sumarDias(hoy, 8)
      : situacion === 'vencido'
        ? sumarDias(hoy, -1)
        : null;

  const proyecto = {
    id,
    cliente_id: clienteId,
    titulo: TITULO,
    presupuesto_centavos: PRESUPUESTO,
    comprobante: 'sin_comprobante',
    direccion_entrega: DIRECCION,
    fecha_inicio: hoy,
    entrega_estimada: sumarDias(hoy, 20),
    presupuesto_vale_hasta: valeHasta,
  };

  await guardarProyectoPorRpc(sesion, {
    proyecto: { ...proyecto, version: null, estado: 'presupuesto_enviado' },
    pagos: [
      {
        id: crypto.randomUUID(),
        fecha: hoy,
        concepto: 'Relevamiento técnico',
        monto_centavos: RELEVAMIENTO,
      },
    ],
    gastos: [],
  });

  if (situacion === 'aprobado') {
    const guardado = await leerProyecto(sesion, TITULO);
    await guardarProyectoPorRpc(sesion, {
      proyecto: { ...proyecto, version: guardado?.version ?? null, estado: 'en_curso' },
      pagos: [
        {
          id: crypto.randomUUID(),
          fecha: hoy,
          concepto: 'Seña',
          monto_centavos: RESTO_DE_LA_SENA,
        },
      ],
      gastos: [],
    });
  }

  const token = tokenDePrueba();
  await enlacePorRest(sesion, id, token);
  return token;
}

async function abrir(page: Page, token: string, tema: (typeof TEMAS)[number]): Promise<void> {
  await page.emulateMedia({ colorScheme: tema });
  await page.goto(`/v/${token}`);
  await expect(page.getByRole('region', { name: 'Tu mueble' })).toBeVisible(CARGA);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

function region(page: Page, nombre: string) {
  return page.getByRole('region', { name: nombre });
}

async function capturar(
  page: Page,
  situacion: Situacion,
  tema: (typeof TEMAS)[number],
  salida: (nombre: string) => string,
  proyecto: string,
): Promise<void> {
  await page.screenshot({
    path: salida(`antes-de-aprobar-${situacion}-${tema}-${proyecto}.png`),
    fullPage: true,
  });
}

async function loQueNoTieneQueEstar(page: Page): Promise<void> {
  const texto = await page.getByRole('main').innerText();
  for (const prometido of [
    'Entrega estimada',
    'Empezamos',
    DIRECCION,
    'Te falta pagar',
    'Recibimos tu seña',
    'quedó aprobado',
  ]) {
    expect(texto, `«${prometido}» no puede estar antes de aprobar`).not.toContain(prometido);
  }
  await expect(region(page, 'Datos del trabajo')).toHaveCount(0);
}

test('esperando la seña, con fecha límite: la proyección en lugar de la tarjeta, y la seña con lo que ya pagó a cuenta', async ({
  page,
}, testInfo) => {
  const token = await trabajoConEnlace('con-fecha');

  for (const tema of TEMAS) {
    await abrir(page, token, tema);

    await loQueNoTieneQueEstar(page);
    await expect(region(page, 'Para cuándo')).toContainText(
      /^Si dejás la seña antes del \S+ \d{1,2} de \S+( de \d{4})?, podríamos tenerlo listo para el \S+ \d{1,2} de \S+( de \d{4})?\./,
    );
    await expect(region(page, 'Para cuándo')).toContainText(
      'Vamos tomando los trabajos a medida que entran las señas.',
    );

    const entrada = region(page, 'Tu mueble');
    await expect(entrada).toContainText('Te pasamos el presupuesto');
    await expect(entrada).toContainText('$ 1.248.000');
    await expect(entrada).toContainText('Seña para arrancar');
    await expect(entrada).toContainText('$ 624.000');
    await expect(entrada).toContainText('te quedan $ 504.000 para completarla');
    await expect(region(page, 'Cómo pagar')).toContainText('$ 504.000');

    const historia = region(page, 'Lo que fue pasando');
    await expect(historia).toContainText('Recibimos tu pago');
    await expect(historia).not.toContainText('Aprobaste');

    await expect(page.getByText('Lo próximo es que lo apruebes y dejes la seña.')).toBeVisible();
    await expect(region(page, 'Lo que pagaste')).toContainText('Relevamiento técnico');
    await expect(region(page, 'Lo que pagaste')).toContainText('A cuenta de la seña');

    await capturar(page, 'con-fecha', tema, (n) => testInfo.outputPath(n), testInfo.project.name);
  }

  console.log(
    `\n=== ${testInfo.project.name}: árbol de lo de arriba ===\n${await region(page, 'Tu mueble').ariaSnapshot()}`,
  );
  console.log(
    `\n=== ${testInfo.project.name}: árbol de la proyección ===\n${await region(page, 'Para cuándo').ariaSnapshot()}`,
  );

  const recorrido: string[] = [];
  for (let paso = 0; paso < 8; paso += 1) {
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body) return '';
      const nombre = activo.getAttribute('aria-label') ?? activo.textContent.trim();
      const zona = activo.closest('section[aria-label]')?.getAttribute('aria-label') ?? '';
      return `${activo.tagName.toLowerCase()}: ${nombre.slice(0, 40)} (en «${zona}»)`;
    });
    if (foco !== '') recorrido.push(foco);
  }
  console.log(`\n=== ${testInfo.project.name}: recorrido con Tab ===\n${recorrido.join('\n')}`);
  expect(recorrido[0]).toBe('button: Copiar el monto (en «Cómo pagar»)');
});

test('esperando la seña, sin fecha límite: una línea que no promete ninguna fecha', async ({
  page,
}, testInfo) => {
  const token = await trabajoConEnlace('sin-fecha');

  for (const tema of TEMAS) {
    await abrir(page, token, tema);

    await loQueNoTieneQueEstar(page);
    await expect(region(page, 'Para cuándo')).toHaveText(
      'Cuando lo apruebes y dejes la seña, coordinamos la fecha de entrega.',
    );
    await capturar(page, 'sin-fecha', tema, (n) => testInfo.outputPath(n), testInfo.project.name);
  }
});

test('con el presupuesto vencido, lo dice y no promete nada', async ({ page }, testInfo) => {
  const token = await trabajoConEnlace('vencido');

  for (const tema of TEMAS) {
    await abrir(page, token, tema);

    await loQueNoTieneQueEstar(page);
    await expect(region(page, 'Para cuándo')).toContainText(
      /^Este presupuesto venció el \S+ \d{1,2} de \S+( de \d{4})?\. Hablá con el taller para actualizarlo\.$/,
    );
    await capturar(page, 'vencido', tema, (n) => testInfo.outputPath(n), testInfo.project.name);
  }
});

test('aprobado y en fabricación: vuelven la tarjeta con la dirección, el inicio, la entrega y la seña', async ({
  page,
}, testInfo) => {
  const token = await trabajoConEnlace('aprobado');

  for (const tema of TEMAS) {
    await abrir(page, token, tema);

    const tarjeta = region(page, 'Datos del trabajo');
    await expect(tarjeta).toContainText(DIRECCION);
    await expect(tarjeta).toContainText('Empezamos');
    await expect(tarjeta).toContainText('Entrega estimada');
    await expect(tarjeta).toContainText('$ 624.000 · pagada');
    await expect(region(page, 'Para cuándo')).toHaveCount(0);

    const entrada = region(page, 'Tu mueble');
    await expect(entrada).toContainText('Lo estamos fabricando');
    await expect(entrada).toContainText('Te falta pagar');
    await expect(entrada).toContainText('$ 624.000');

    const historia = region(page, 'Lo que fue pasando');
    await expect(historia).toContainText('Aprobaste el presupuesto');
    await expect(historia).toContainText('Empezamos a fabricarlo en el taller');
    await expect(historia).not.toContainText('Recibimos tu seña y quedó aprobado');

    await capturar(page, 'aprobado', tema, (n) => testInfo.outputPath(n), testInfo.project.name);
  }
});
