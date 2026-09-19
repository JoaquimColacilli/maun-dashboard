import { expect, test, type Page } from '@playwright/test';

import {
  archivoPorRest,
  borrarProyectoPorRest,
  contactoPorRpc,
  enlacePorRest,
  enlacesDe,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  revocarEnlacePorRest,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

// El índice único del token es global y las bajas son lógicas: un token ya usado no se puede
// repetir ni después de vaciar el taller, así que cada corrida estrena el suyo.
function tokenDePrueba(): string {
  return `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
}

const TITULO = 'Placard con espejo';

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

async function obraConEnlace(token: string): Promise<string> {
  const { id, clienteId } = await contactoPorRpc(sesion, {
    titulo: TITULO,
    estado: 'presupuesto_enviado',
  });
  const proyecto = await leerProyecto(sesion, TITULO);
  const hoy = new Date().toISOString().slice(0, 10);

  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: proyecto?.version ?? null,
      cliente_id: clienteId,
      titulo: TITULO,
      estado: 'en_curso',
      presupuesto_centavos: 124_000_000,
      comprobante: 'sin_comprobante',
      direccion_entrega: 'Olazábal 1240, Ituzaingó',
      notas: 'OJO: no bajar de 900',
      fecha_inicio: hoy,
      entrega_estimada: hoy,
    },
    pagos: [{ id: crypto.randomUUID(), fecha: hoy, concepto: 'Seña', monto_centavos: 40_000_000 }],
    gastos: [
      {
        id: crypto.randomUUID(),
        fecha: hoy,
        descripcion: 'Maderera Suárez',
        monto_centavos: 5_555_500,
      },
    ],
  });

  await archivoPorRest(sesion, {
    proyectoId: id,
    nombre: 'Plano de frente compartido',
    visible: true,
  });
  await archivoPorRest(sesion, { proyectoId: id, nombre: 'Despiece de corte privado' });

  await enlacePorRest(sesion, id, token);
  return id;
}

function laVista(page: Page) {
  return page.getByRole('region', { name: 'Tu mueble' });
}

async function textoDeLaPagina(page: Page): Promise<string> {
  return page.getByRole('main').innerText();
}

test('el enlace abre la vista del cliente sin sesión, y solo con lo que el cliente puede ver', async ({
  page,
}, testInfo) => {
  const token = tokenDePrueba();
  await obraConEnlace(token);

  await page.goto(`/v/${token}`);
  await expect(laVista(page)).toBeVisible(CARGA);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITULO);
  await expect(laVista(page)).toContainText('$ 1.240.000');
  await expect(laVista(page)).toContainText('$ 400.000');
  await expect(laVista(page)).toContainText('$ 840.000');
  await expect(page.getByRole('region', { name: 'Fotos y planos' })).toContainText(
    'Plano de frente compartido',
  );

  const todo = (await textoDeLaPagina(page)).toLowerCase();
  for (const secreto of [
    'despiece de corte privado',
    'maderera suárez',
    'no bajar de 900',
    '55.555',
    'diezmo',
    'ganancia',
    'margen',
  ]) {
    expect(todo, `«${secreto}» no puede estar en la página del cliente`).not.toContain(secreto);
  }

  await page.screenshot({
    path: testInfo.outputPath(`vista-cliente-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test('la página del cliente no es indexable', async ({ page }) => {
  const token = tokenDePrueba();
  await obraConEnlace(token);

  await page.goto(`/v/${token}`);
  await expect(laVista(page)).toBeVisible(CARGA);

  // vite preview no aplica las cabeceras de netlify.toml: lo que se comprueba acá es la etiqueta,
  // que viaja en el HTML servido y la ve cualquier buscador antes de ejecutar nada.
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  const robots = await page.request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
});

test('un enlace inexistente, uno inválido y uno dado de baja muestran exactamente lo mismo', async ({
  page,
}) => {
  const token = tokenDePrueba();
  const id = await obraConEnlace(token);

  await page.goto('/v/e2e-token-que-nunca-existio-0001');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Este enlace ya no funciona',
    CARGA,
  );
  const inexistente = await textoDeLaPagina(page);

  await page.goto('/v/no-sirve');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Este enlace ya no funciona',
    CARGA,
  );
  const invalido = await textoDeLaPagina(page);

  const [enlace] = await enlacesDe(sesion, id);
  if (enlace === undefined) throw new Error('el trabajo tendría que tener un enlace');
  await revocarEnlacePorRest(sesion, enlace.id);

  await page.goto(`/v/${token}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Este enlace ya no funciona',
    CARGA,
  );
  const revocado = await textoDeLaPagina(page);

  expect(invalido).toBe(inexistente);
  expect(revocado).toBe(inexistente);
  expect(revocado).not.toContain('Placard');
  expect(revocado).not.toContain('Cliente de');
});

test('generar otro enlace deja muerto al anterior', async ({ page }) => {
  const token = tokenDePrueba();
  const id = await obraConEnlace(token);

  const [primero] = await enlacesDe(sesion, id);
  if (primero === undefined) throw new Error('el trabajo tendría que tener un enlace');

  await revocarEnlacePorRest(sesion, primero.id);
  const otro = tokenDePrueba();
  await enlacePorRest(sesion, id, otro);

  await page.goto(`/v/${token}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Este enlace ya no funciona',
    CARGA,
  );

  await page.goto(`/v/${otro}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITULO, CARGA);
});

test('borrar el trabajo se lleva su enlace', async ({ page }) => {
  const token = tokenDePrueba();
  const id = await obraConEnlace(token);

  await page.goto(`/v/${token}`);
  await expect(laVista(page)).toBeVisible(CARGA);

  await borrarProyectoPorRest(sesion, id);

  await page.goto(`/v/${token}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Este enlace ya no funciona',
    CARGA,
  );
});

test('la vista del cliente se ve en claro y en oscuro', async ({ page }, testInfo) => {
  const token = tokenDePrueba();
  await obraConEnlace(token);

  for (const tema of ['light', 'dark'] as const) {
    await page.addInitScript((elegido) => {
      localStorage.setItem('maun:tema', elegido);
    }, tema);
    await page.goto(`/v/${token}`);
    await expect(laVista(page)).toBeVisible(CARGA);
    await page.screenshot({
      path: testInfo.outputPath(`vista-cliente-${tema}-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }
});

test('la vista del cliente se recorre con el teclado y se anuncia sin depender del color', async ({
  page,
}, testInfo) => {
  const token = tokenDePrueba();
  await obraConEnlace(token);

  await page.goto(`/v/${token}`);
  await expect(laVista(page)).toBeVisible(CARGA);

  const arbol = await page.getByRole('main').ariaSnapshot();
  console.log(`${testInfo.project.name}, árbol de la vista del cliente:\n${arbol}`);

  const visto: string[] = [];
  for (let paso = 0; paso < 12; paso += 1) {
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const activo = document.activeElement;
      if (!activo || activo === document.body) return '';
      return `${activo.tagName.toLowerCase()}:${activo.textContent.trim().slice(0, 40)}`;
    });
    if (foco !== '') visto.push(foco);
  }
  console.log(`${testInfo.project.name}, recorrido con Tab:\n${visto.join('\n')}`);

  expect(visto.some((paso) => paso.includes('Plano de frente compartido'))).toBe(true);
});
