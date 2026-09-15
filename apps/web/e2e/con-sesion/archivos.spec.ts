import { expect, test, type Page } from '@playwright/test';

import { avisosEnPantalla, listoParaCortar } from '../apoyo/pantalla';
import {
  archivosDelTaller,
  contactoPorRpc,
  iniciarSesionDePrueba,
  objetosDelTrabajo,
  vaciarArchivos,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };

const LOS_VIDEOS_NO_ENTRAN =
  'Los videos no se pueden subir: uno del celular pesa entre 50 y 200 MB, y el espacio para los archivos de todo el taller es de 1 GB. Subí fotos o capturas del video, y los planos y presupuestos en PDF.';

const SIN_SENAL =
  'Sin señal no se pueden subir archivos: se suben en el momento y no quedan anotados para después. Probá cuando vuelva la señal.';

interface Subida {
  ruta: string;
  bytes: number;
  tipo: string;
}

let sesion: SesionDePrueba;

test.beforeEach(async ({ page }) => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
  await page.addInitScript(() => {
    const subidas: { ruta: string; bytes: number; tipo: string }[] = [];
    Reflect.set(window, '__subidasDeArchivos', subidas);
    const original = window.fetch.bind(window);
    const marca = '/storage/v1/object/archivos/';
    window.fetch = async (entrada, opciones) => {
      const url =
        typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      if (url.includes(marca) && (opciones?.method === 'POST' || opciones?.method === 'PUT')) {
        const cuerpo = opciones.body;
        const archivo =
          cuerpo instanceof FormData
            ? [...cuerpo.values()].find((valor) => valor instanceof Blob)
            : cuerpo instanceof Blob
              ? cuerpo
              : undefined;
        if (archivo instanceof Blob) {
          subidas.push({
            ruta: decodeURIComponent(url.slice(url.indexOf(marca) + marca.length)),
            bytes: archivo.size,
            tipo: archivo.type,
          });
        }
      }
      return original(entrada, opciones);
    };
  });
});

test.afterEach(async () => {
  await vaciarArchivos(sesion);
});

async function subidasHastaAhora(page: Page): Promise<Subida[]> {
  return page.evaluate(() => Reflect.get(window, '__subidasDeArchivos') as Subida[]);
}

async function imagenDePrueba(page: Page, clase: 'foto' | 'render'): Promise<Buffer> {
  const base64 = await page.evaluate(async (tipo) => {
    const esFoto = tipo === 'foto';
    const lienzo = document.createElement('canvas');
    lienzo.width = esFoto ? 4032 : 1920;
    lienzo.height = esFoto ? 3024 : 1080;
    const contexto = lienzo.getContext('2d');
    if (!contexto) throw new Error('Sin canvas');
    const degradado = contexto.createLinearGradient(0, 0, lienzo.width, lienzo.height);
    degradado.addColorStop(0, '#7b5e3b');
    degradado.addColorStop(1, '#dccbb0');
    contexto.fillStyle = degradado;
    contexto.fillRect(0, 0, lienzo.width, lienzo.height);
    const circulos = esFoto ? 400 : 60;
    for (let indice = 0; indice < circulos; indice += 1) {
      contexto.fillStyle = `hsl(${String((indice * 37) % 360)} 35% ${String(30 + (indice % 40))}%)`;
      contexto.beginPath();
      contexto.arc(
        (indice * 997) % lienzo.width,
        (indice * 613) % lienzo.height,
        20 + (indice % 90),
        0,
        Math.PI * 2,
      );
      contexto.fill();
    }
    if (esFoto) {
      const datos = contexto.getImageData(0, 0, lienzo.width, lienzo.height);
      for (let pixel = 0; pixel < datos.data.length; pixel += 4) {
        const ruido = ((pixel * 7919) % 31) - 15;
        datos.data[pixel] = (datos.data[pixel] ?? 0) + ruido;
        datos.data[pixel + 1] = (datos.data[pixel + 1] ?? 0) + ruido;
        datos.data[pixel + 2] = (datos.data[pixel + 2] ?? 0) + ruido;
      }
      contexto.putImageData(datos, 0, 0);
    }
    const blob = await new Promise<Blob | null>((resolver) => {
      lienzo.toBlob(resolver, esFoto ? 'image/jpeg' : 'image/png', 0.95);
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
  }, clase);
  return Buffer.from(base64, 'base64');
}

function pdfDePrueba(): Buffer {
  const texto = 'BT /F1 24 Tf 72 720 Td (Despiece del placard) Tj ET';
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${String(texto.length)} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posiciones: number[] = [];
  objetos.forEach((objeto, indice) => {
    posiciones.push(pdf.length);
    pdf += `${String(indice + 1)} 0 obj\n${objeto}\nendobj\n`;
  });
  const tabla = pdf.length;
  pdf += `xref\n0 ${String(objetos.length + 1)}\n0000000000 65535 f \n`;
  pdf += posiciones.map((posicion) => `${String(posicion).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${String(objetos.length + 1)} /Root 1 0 R >>\nstartxref\n${String(tabla)}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function seccionDeArchivos(page: Page) {
  return page.getByRole('region', { name: 'Archivos', exact: true });
}

test('sube una foto, un render y un PDF: las imágenes se achican antes de subir, se ven, el PDF se abre en otra pestaña y se borra con deshacer', async ({
  page,
  request,
  isMobile,
}) => {
  test.skip(isMobile, 'una sola vez por corrida: escribe en Storage');
  test.setTimeout(180_000);

  const { id } = await contactoPorRpc(sesion, {
    titulo: 'Placard con fotos',
    estado: 'a_presupuestar',
    sena: 5_000_000,
  });
  await page.goto(`/proyectos/${id}`);
  const seccion = seccionDeArchivos(page);
  await expect(seccion).toBeVisible(CARGA);
  await expect(seccion).toContainText('Todavía no hay archivos de este trabajo.');

  const foto = await imagenDePrueba(page, 'foto');
  const render = await imagenDePrueba(page, 'render');
  const pdf = pdfDePrueba();

  await page.locator('input[type="file"]').setInputFiles([
    { name: 'relevamiento.jpg', mimeType: 'image/jpeg', buffer: foto },
    { name: 'render-cocina.png', mimeType: 'image/png', buffer: render },
    { name: 'despiece.pdf', mimeType: 'application/pdf', buffer: pdf },
  ]);

  await expect.poll(async () => (await archivosDelTaller(sesion)).length, CARGA).toBe(3);
  await expect(seccion.getByRole('list', { name: 'Recién subidos' })).toContainText(
    'relevamiento.jpg',
  );

  const filas = await archivosDelTaller(sesion);
  const subidas = await subidasHastaAhora(page);
  expect(subidas).toHaveLength(5);

  const deLaFila = (nombre: string) => {
    const fila = filas.find((candidata) => candidata.nombre === nombre);
    if (fila === undefined) throw new Error(`No se anotó ${nombre}`);
    return { fila, subidas: subidas.filter((subida) => subida.ruta.includes(fila.id)) };
  };

  const deLaFoto = deLaFila('relevamiento.jpg');
  const delRender = deLaFila('render-cocina.png');
  const delPdf = deLaFila('despiece.pdf');

  expect(deLaFoto.fila).toMatchObject({ tipo: 'image/webp', ancho: 2000, alto: 1500 });
  expect(delRender.fila).toMatchObject({ tipo: 'image/webp', ancho: 1920, alto: 1080 });
  expect(delPdf.fila).toMatchObject({ tipo: 'application/pdf', bytes: pdf.length, ancho: null });
  for (const imagen of [deLaFoto, delRender]) {
    expect(imagen.subidas.map((subida) => subida.tipo)).toEqual(['image/webp', 'image/webp']);
    expect(imagen.fila.bytes).toBe(imagen.subidas.reduce((suma, subida) => suma + subida.bytes, 0));
  }
  expect(deLaFoto.fila.bytes).toBeLessThan(foto.length / 3);

  console.log(
    JSON.stringify({
      foto: { original: foto.length, subidas: deLaFoto.subidas.map((subida) => subida.bytes) },
      render: { original: render.length, subidas: delRender.subidas.map((subida) => subida.bytes) },
      pdf: { original: pdf.length, subidas: delPdf.subidas.map((subida) => subida.bytes) },
    }),
  );

  await expect(seccion.getByRole('button', { name: /^Ver / })).toHaveCount(2);
  await seccion.getByRole('button', { name: 'Ver relevamiento.jpg' }).click();
  const visor = page.getByRole('dialog', { name: 'relevamiento.jpg' });
  const imagen = visor.getByRole('img', { name: 'relevamiento.jpg' });
  await expect
    .poll(() => imagen.evaluate((elemento: HTMLImageElement) => elemento.naturalWidth), CARGA)
    .toBe(2000);
  await visor.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('dialog', { name: 'render-cocina.png' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const enlace = seccion.getByRole('link', { name: 'despiece.pdf' });
  await expect(enlace).toHaveAttribute('target', '_blank');
  const respuesta = await request.get((await enlace.getAttribute('href')) ?? '');
  expect(respuesta.status()).toBe(200);
  expect(respuesta.headers()['content-type']).toContain('application/pdf');

  await seccion.getByRole('button', { name: 'Borrar «despiece.pdf»' }).click();
  await expect(seccion.getByRole('link', { name: 'despiece.pdf' })).toHaveCount(0);
  await expect(avisosEnPantalla(page)).toContainText('Borraste «despiece.pdf».');
  await avisosEnPantalla(page).getByRole('button', { name: 'Deshacer' }).click();
  await expect(seccion.getByRole('link', { name: 'despiece.pdf' })).toBeVisible();
  await expect
    .poll(
      async () => (await archivosDelTaller(sesion)).some((fila) => fila.nombre === 'despiece.pdf'),
      CARGA,
    )
    .toBe(true);

  await seccion.getByRole('button', { name: 'Borrar «despiece.pdf»' }).click();
  await expect
    .poll(
      async () => (await archivosDelTaller(sesion)).some((fila) => fila.nombre === 'despiece.pdf'),
      CARGA,
    )
    .toBe(false);
  const rutaDelPdf = `${delPdf.fila.household_id}/${delPdf.fila.proyecto_id}/${delPdf.fila.id}.pdf`;
  await expect
    .poll(
      async () =>
        (
          await objetosDelTrabajo(sesion, delPdf.fila.household_id, delPdf.fila.proyecto_id)
        ).includes(rutaDelPdf),
      { timeout: 30_000 },
    )
    .toBe(false);
});

test('un video no se sube, y la pantalla dice por qué y qué sí se puede', async ({ page }) => {
  const { id } = await contactoPorRpc(sesion, { titulo: 'Contacto con video' });
  await page.goto(`/proyectos/${id}`);
  const seccion = seccionDeArchivos(page);
  await expect(seccion).toBeVisible(CARGA);

  await page.locator('input[type="file"]').setInputFiles({
    name: 'relevamiento.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.alloc(4096),
  });

  await expect(seccion.getByRole('alert')).toHaveText(LOS_VIDEOS_NO_ENTRAN);
  expect(await subidasHastaAhora(page)).toEqual([]);
  expect(await archivosDelTaller(sesion)).toEqual([]);
});

test('sin señal no se sube: el selector no se abre y la pantalla dice por qué', async ({
  page,
  context,
}) => {
  const { id } = await contactoPorRpc(sesion, { titulo: 'Contacto sin señal' });
  await page.goto(`/proyectos/${id}`);
  const seccion = seccionDeArchivos(page);
  await expect(seccion).toBeVisible(CARGA);
  await listoParaCortar(page);
  await context.setOffline(true);

  const selector = page.waitForEvent('filechooser', { timeout: 1500 }).catch(() => null);
  await seccion.getByRole('button', { name: 'Subir fotos o PDF' }).click();
  expect(await selector).toBeNull();
  await expect(seccion.getByRole('alert')).toHaveText(SIN_SENAL);

  await context.setOffline(false);
});
