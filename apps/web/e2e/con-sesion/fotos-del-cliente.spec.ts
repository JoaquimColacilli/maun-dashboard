import { expect, test, type Page } from '@playwright/test';

import { listoParaCortar } from '../apoyo/pantalla';
import {
  ajustarCobroDelTaller,
  contactoPorRpc,
  enlacePorRest,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  vaciarArchivos,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

const TITULO = 'Vestidor con fotos del cliente';

interface PedidoDeImagen {
  ruta: string;
  estado: number;
  desdeElCache: boolean;
}

interface ImagenDibujada {
  alt: string;
  src: string;
  anchoNatural: number;
  altoNatural: number;
  completa: boolean;
}

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

test.afterEach(async () => {
  await vaciarArchivos(sesion);
});

function hoyLocal(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${String(ahora.getFullYear())}-${mes}-${dia}`;
}

function tokenDePrueba(): string {
  return `e2e-${crypto.randomUUID().replaceAll('-', '')}`;
}

async function imagenDePrueba(page: Page, tono: number): Promise<Buffer> {
  const base64 = await page.evaluate(async (matiz) => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 1600;
    lienzo.height = 1200;
    const contexto = lienzo.getContext('2d');
    if (!contexto) throw new Error('Sin canvas');
    contexto.fillStyle = `hsl(${String(matiz)} 40% 45%)`;
    contexto.fillRect(0, 0, lienzo.width, lienzo.height);
    for (let indice = 0; indice < 80; indice += 1) {
      contexto.fillStyle = `hsl(${String((matiz + indice * 11) % 360)} 45% ${String(25 + (indice % 45))}%)`;
      contexto.fillRect((indice * 197) % 1600, (indice * 131) % 1200, 120, 90);
    }
    const blob = await new Promise<Blob | null>((resolver) => {
      lienzo.toBlob(resolver, 'image/png');
    });
    if (!blob) throw new Error('Sin imagen');
    return new Promise<string>((resolver) => {
      const lector = new FileReader();
      lector.onload = () => {
        const resultado = typeof lector.result === 'string' ? lector.result : '';
        resolver(resultado.split(',')[1] ?? '');
      };
      lector.readAsDataURL(blob);
    });
  }, tono);
  return Buffer.from(base64, 'base64');
}

function laGaleria(page: Page) {
  return page.getByRole('region', { name: 'Fotos y planos' });
}

function anotarLasImagenes(page: Page): PedidoDeImagen[] {
  const pedidos: PedidoDeImagen[] = [];
  page.on('response', (respuesta) => {
    const url = new URL(respuesta.url());
    if (!url.pathname.includes('/storage/v1/object/public/archivos/')) return;
    pedidos.push({
      ruta: url.pathname.split('/archivos/')[1] ?? url.pathname,
      estado: respuesta.status(),
      desdeElCache: respuesta.fromServiceWorker(),
    });
  });
  return pedidos;
}

async function imagenesDibujadas(page: Page): Promise<ImagenDibujada[]> {
  return laGaleria(page).evaluate((seccion) =>
    [...seccion.querySelectorAll('img')].map((imagen) => ({
      alt: imagen.alt,
      src: new URL(imagen.currentSrc || imagen.src).pathname.split('/archivos/')[1] ?? '',
      anchoNatural: imagen.naturalWidth,
      altoNatural: imagen.naturalHeight,
      completa: imagen.complete,
    })),
  );
}

function contarLasImagenes(nombre: string, pedidos: PedidoDeImagen[], dibujadas: ImagenDibujada[]) {
  return [
    `\n=== ${nombre} ===`,
    '  pedidos de imagen:',
    ...pedidos.map(
      (uno) =>
        `    ${String(uno.estado)}  ${uno.ruta}${uno.desdeElCache ? '  (service worker)' : ''}`,
    ),
    '  imágenes dibujadas:',
    ...dibujadas.map(
      (una) =>
        `    ${una.anchoNatural > 0 ? 'se dibujó' : 'NO SE DIBUJÓ'}  ${String(una.anchoNatural)}×${String(una.altoNatural)}  «${una.alt}»  ${una.src}`,
    ),
  ].join('\n');
}

test('las fotos compartidas se piden y se dibujan, con sesión y sin sesión', async ({
  page,
  browser,
  isMobile,
}, testInfo) => {
  test.skip(isMobile, 'una sola vez por corrida: escribe en Storage');
  test.setTimeout(180_000);

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
      presupuesto_centavos: 120_000_000,
      comprobante: 'sin_comprobante',
      direccion_entrega: 'Güemes 450, Haedo',
      fecha_inicio: hoy,
      entrega_estimada: hoy,
    },
    pagos: [{ id: crypto.randomUUID(), fecha: hoy, concepto: 'Seña', monto_centavos: 60_000_000 }],
    gastos: [],
  });

  await page.goto(`/proyectos/${id}`);
  await listoParaCortar(page);

  const seccion = page.getByRole('region', { name: 'Archivos', exact: true });
  await seccion.locator('input[type="file"]').setInputFiles([
    { name: 'Frente terminado.png', mimeType: 'image/png', buffer: await imagenDePrueba(page, 20) },
    {
      name: 'Interior del vestidor.png',
      mimeType: 'image/png',
      buffer: await imagenDePrueba(page, 200),
    },
  ]);
  await expect(
    seccion.getByRole('list', { name: 'Fotos e imágenes' }).getByRole('listitem'),
  ).toHaveCount(2, CARGA);

  // Lo que ve el dueño con cero compartidos: el aviso y el camino para marcarlas.
  await expect(seccion).toContainText('2 archivos · el cliente ve 0');
  await expect(seccion).toContainText('El cliente no ve ninguno');
  await seccion.scrollIntoViewIfNeeded();
  await seccion.screenshot({ path: testInfo.outputPath('ficha-cero-compartidos.png') });

  await seccion.getByRole('link', { name: 'Elegir cuáles ve' }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}/compartir$`));

  const queVe = page.getByRole('region', { name: 'Qué archivos ve' });
  await expect(queVe).toContainText('0 de 2 compartidos');
  await expect(queVe.getByRole('alert')).toContainText(
    'Tenés 2 archivos y el cliente no ve ninguno.',
  );
  await queVe.scrollIntoViewIfNeeded();
  await queVe.screenshot({ path: testInfo.outputPath('compartir-cero-compartidos.png') });

  await queVe.getByRole('switch', { name: 'Compartir Frente terminado.png' }).click();
  await expect(queVe).toContainText('1 de 2 compartidos');
  await expect(queVe.getByRole('alert')).toHaveCount(0);

  const token = tokenDePrueba();
  await enlacePorRest(sesion, id, token);

  const conSesion = anotarLasImagenes(page);
  await page.goto(`/proyectos/${id}/vista-cliente`);
  await expect(laGaleria(page)).toContainText('Frente terminado.png', CARGA);
  await expect(laGaleria(page).locator('img')).toHaveCount(1, CARGA);
  await page.waitForLoadState('networkidle');
  const dibujadasConSesion = await imagenesDibujadas(page);

  const limpio = await browser.newContext();
  const otra = await limpio.newPage();
  const sinSesion = anotarLasImagenes(otra);
  await otra.goto(`/v/${token}`);
  await expect(laGaleria(otra)).toContainText('Frente terminado.png', CARGA);
  await otra.waitForLoadState('networkidle');
  const dibujadasSinSesion = await imagenesDibujadas(otra);

  console.log(
    contarLasImagenes(
      'la vista desde la app, con la sesión del dueño',
      conSesion,
      dibujadasConSesion,
    ),
  );
  console.log(
    contarLasImagenes('la vista desde el enlace, sin sesión', sinSesion, dibujadasSinSesion),
  );

  await otra.screenshot({
    path: testInfo.outputPath('vista-cliente-con-foto.png'),
    fullPage: true,
  });
  const textoDelCliente = await otra.getByRole('main').innerText();
  await limpio.close();

  for (const [nombre, pedidos, dibujadas] of [
    ['con sesión', conSesion, dibujadasConSesion],
    ['sin sesión', sinSesion, dibujadasSinSesion],
  ] as const) {
    expect(pedidos.length, `${nombre}: no se pidió ninguna imagen`).toBeGreaterThan(0);
    for (const pedido of pedidos) {
      expect(pedido.estado, `${nombre}: ${pedido.ruta} contestó ${String(pedido.estado)}`).toBe(
        200,
      );
    }
    expect(dibujadas.length, `${nombre}: no se dibujó ninguna imagen`).toBe(1);
    for (const imagen of dibujadas) {
      expect(imagen.anchoNatural, `${nombre}: «${imagen.alt}» no se dibujó`).toBeGreaterThan(0);
    }
  }

  // El archivo que no compartió no puede asomarse por ningún lado del lado del cliente: ni el
  // nombre, ni el contador, ni un hueco que lo delate.
  expect(textoDelCliente).not.toContain('Interior del vestidor');
  expect(textoDelCliente).toContain('1 archivo');
  expect(textoDelCliente).not.toContain('2 archivos');
});

test('el cliente nunca se entera de que hay archivos que no le compartieron', async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, 'una sola vez por corrida: escribe en Storage');
  test.setTimeout(180_000);

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
      presupuesto_centavos: 120_000_000,
      comprobante: 'sin_comprobante',
      direccion_entrega: 'Güemes 450, Haedo',
      fecha_inicio: hoy,
      entrega_estimada: hoy,
    },
    pagos: [],
    gastos: [],
  });

  await page.goto(`/proyectos/${id}`);
  await listoParaCortar(page);
  await page
    .getByRole('region', { name: 'Archivos', exact: true })
    .locator('input[type="file"]')
    .setInputFiles([
      {
        name: 'Despiece interno.png',
        mimeType: 'image/png',
        buffer: await imagenDePrueba(page, 90),
      },
    ]);
  await expect(page.getByRole('region', { name: 'Archivos', exact: true })).toContainText(
    '1 archivo · el cliente ve 0',
    CARGA,
  );

  const token = tokenDePrueba();
  await enlacePorRest(sesion, id, token);

  const limpio = await browser.newContext();
  const otra = await limpio.newPage();
  await otra.goto(`/v/${token}`);
  await expect(laGaleria(otra)).toBeVisible(CARGA);

  const texto = await otra.getByRole('main').innerText();
  await limpio.close();

  expect(texto).toContain('Todavía no hay fotos');
  expect(texto).not.toContain('Despiece interno');
  expect(texto).not.toContain('1 archivo');
  expect(texto).not.toMatch(/priv|oculto|no compartid/i);
});

test('ajustes tiene dónde cargar los datos para transferir', async ({
  page,
  isMobile,
}, testInfo) => {
  test.skip(isMobile, 'una sola vez por corrida');

  await page.goto('/ajustes');
  await listoParaCortar(page);

  const seccion = page.getByRole('region', { name: 'Cómo te transfieren' });
  await expect(seccion).toBeVisible(CARGA);
  await seccion.getByLabel('Alias').fill('plata_del_taller');
  await seccion.getByRole('button', { name: 'Guardar los datos' }).click();
  await expect(seccion).toContainText('ni guion bajo');
  await seccion.scrollIntoViewIfNeeded();
  await seccion.screenshot({ path: testInfo.outputPath('ajustes-cobro-alias-invalido.png') });

  await seccion.getByLabel('Alias').fill('maun.muebles');
  await seccion.getByLabel('CBU o CVU').fill('0110001412345678901233');
  await seccion.getByRole('button', { name: 'Guardar los datos' }).click();
  await expect(seccion).toContainText('los primeros ocho');

  await seccion.getByLabel('CBU o CVU').fill('0110001312345678901233');
  await seccion.getByLabel('Titular de la cuenta').fill('Ana Gutiérrez');
  await seccion.getByLabel('CUIT del titular').fill('27301234564');
  await seccion.getByRole('button', { name: 'Guardar los datos' }).click();
  await expect(seccion).toContainText('Guardado.', CARGA);
  await expect(seccion.getByLabel('CBU o CVU')).toHaveValue('0110 0013 1234 5678 9012 33');

  await seccion.scrollIntoViewIfNeeded();
  await seccion.screenshot({ path: testInfo.outputPath('ajustes-cobro.png') });

  console.log(`\n=== árbol de la sección de Ajustes ===\n${await seccion.ariaSnapshot()}`);

  await ajustarCobroDelTaller(sesion, { alias: '', cbu: '', titular: '', cuit: '' });
});
