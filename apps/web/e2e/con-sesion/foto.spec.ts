import { createHash } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

interface SubidaDeFoto {
  bytes: number;
  tipo: string;
  huella: string;
}

async function fotoGrande(page: Page, tono: number): Promise<Buffer> {
  const base64 = await page.evaluate(async (matiz) => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 4032;
    lienzo.height = 3024;
    const contexto = lienzo.getContext('2d');
    if (!contexto) throw new Error('sin canvas');
    const degradado = contexto.createLinearGradient(0, 0, 4032, 3024);
    degradado.addColorStop(0, `hsl(${String(matiz)} 70% 35%)`);
    degradado.addColorStop(1, `hsl(${String((matiz + 60) % 360)} 60% 75%)`);
    contexto.fillStyle = degradado;
    contexto.fillRect(0, 0, 4032, 3024);
    for (let indice = 0; indice < 400; indice += 1) {
      contexto.fillStyle = `hsl(${String((matiz + indice * 7) % 360)} 55% ${String(30 + (indice % 50))}%)`;
      contexto.beginPath();
      contexto.arc(
        (indice * 997) % 4032,
        (indice * 613) % 3024,
        20 + (indice % 180),
        0,
        Math.PI * 2,
      );
      contexto.fill();
    }
    const pixeles = contexto.getImageData(0, 0, 4032, 3024);
    for (let posicion = 0; posicion < pixeles.data.length; posicion += 4) {
      const ruido = ((posicion * 2654435761) % 17) - 8;
      pixeles.data[posicion] = (pixeles.data[posicion] ?? 0) + ruido;
      pixeles.data[posicion + 1] = (pixeles.data[posicion + 1] ?? 0) + ruido;
      pixeles.data[posicion + 2] = (pixeles.data[posicion + 2] ?? 0) + ruido;
    }
    contexto.putImageData(pixeles, 0, 0);
    const blob = await new Promise<Blob | null>((resolver) => {
      lienzo.toBlob(resolver, 'image/jpeg', 0.97);
    });
    if (!blob) throw new Error('sin blob');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binario = '';
    for (let desde = 0; desde < bytes.length; desde += 0x8000) {
      binario += String.fromCharCode(...bytes.subarray(desde, desde + 0x8000));
    }
    return btoa(binario);
  }, tono);
  return Buffer.from(base64, 'base64');
}

function huellaDe(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function subidasHastaAhora(page: Page): Promise<SubidaDeFoto[]> {
  return page.evaluate(() => Reflect.get(window, '__subidasDeFoto') as SubidaDeFoto[]);
}

async function subirFoto(page: Page, original: Buffer): Promise<SubidaDeFoto & { url: string }> {
  const antes = (await subidasHastaAhora(page)).length;
  const respuesta = page.waitForResponse(
    (respuesta) =>
      respuesta.request().method() === 'POST' &&
      respuesta.url().includes('/storage/v1/object/fotos-de-perfil/'),
  );

  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'foto-del-celular.jpg', mimeType: 'image/jpeg', buffer: original });

  const hoja = page.getByRole('dialog', { name: 'Encuadrar la foto' });
  await expect(hoja).toBeVisible();
  const encuadre = hoja.getByRole('group', { name: 'Encuadre de la foto' });
  await encuadre.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('+');
  await expect(encuadre).toHaveAttribute('data-zoom', '1.25');

  await hoja.getByRole('button', { name: 'Guardar la foto' }).click();
  expect((await respuesta).ok()).toBe(true);
  await expect(hoja).toBeHidden({ timeout: 20_000 });

  const subidas = await subidasHastaAhora(page);
  expect(subidas).toHaveLength(antes + 1);
  const subida = subidas[subidas.length - 1];
  if (!subida) throw new Error('no se registró la subida');

  const avatar = page.getByRole('button', { name: 'Cambiar la foto' }).locator('[data-foto]');
  await expect(avatar).toHaveAttribute('data-foto', 'lista', { timeout: 20_000 });
  const url = (await avatar.locator('img').getAttribute('src')) ?? '';
  return { ...subida, url };
}

test.describe('la foto de perfil', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'se prueba en Chromium');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const subidas: { bytes: number; tipo: string; huella: string }[] = [];
      Reflect.set(window, '__subidasDeFoto', subidas);
      const original = window.fetch.bind(window);
      window.fetch = async (entrada, opciones) => {
        const url =
          typeof entrada === 'string'
            ? entrada
            : entrada instanceof URL
              ? entrada.href
              : entrada.url;
        const cuerpo = opciones?.body;
        if (url.includes('/storage/v1/object/fotos-de-perfil/') && opciones?.method === 'POST') {
          const archivo =
            cuerpo instanceof FormData
              ? [...cuerpo.values()].find((valor) => valor instanceof Blob)
              : cuerpo instanceof Blob
                ? cuerpo
                : undefined;
          if (archivo instanceof Blob) {
            const resumen = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer());
            subidas.push({
              bytes: archivo.size,
              tipo: archivo.type,
              huella: [...new Uint8Array(resumen)]
                .map((byte) => byte.toString(16).padStart(2, '0'))
                .join(''),
            });
          }
        }
        return original(entrada, opciones);
      };
    });
  });

  test('se recorta con el teclado, sale livianita, y cambiarla dos veces con upsert muestra la nueva y no la cacheada', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'escritorio',
      'una sola vez por corrida: escribe en Storage',
    );
    test.setTimeout(120_000);

    await page.goto('/ajustes');
    await expect(page.getByRole('heading', { name: 'Tu perfil' })).toBeVisible();

    const primera = await fotoGrande(page, 20);
    const subidaUno = await subirFoto(page, primera);
    await expect(page.getByRole('status').filter({ hasText: 'Foto guardada.' })).toBeVisible();

    const segunda = await fotoGrande(page, 200);
    const subidaDos = await subirFoto(page, segunda);

    console.log(
      `original ${String(primera.length)} bytes → subida ${String(subidaUno.bytes)} bytes en ${subidaUno.tipo}; original ${String(segunda.length)} bytes → subida ${String(subidaDos.bytes)} bytes en ${subidaDos.tipo}`,
    );
    expect(primera.length).toBeGreaterThan(1_000_000);
    expect(subidaUno.tipo).toBe('image/webp');
    expect(subidaUno.bytes).toBeLessThan(200_000);
    expect(subidaDos.bytes).toBeLessThan(200_000);
    expect(subidaDos.huella).not.toBe(subidaUno.huella);

    expect(subidaDos.url).not.toBe(subidaUno.url);
    const servidaDos = await request.get(subidaDos.url);
    expect(servidaDos.ok()).toBe(true);
    const bytesDos = await servidaDos.body();
    expect(huellaDe(bytesDos)).toBe(subidaDos.huella);

    const bytesUno = await (await request.get(subidaUno.url)).body();
    console.log(
      `la URL nueva sirve la segunda foto (${String(bytesDos.length)} bytes); la URL vieja sirve la ${
        huellaDe(bytesUno) === subidaUno.huella
          ? 'primera, desde el cache'
          : huellaDe(bytesUno) === subidaDos.huella
            ? 'segunda: el objeto se reemplazó'
            : 'desconocida'
      }`,
    );

    await expect(
      page.getByRole('navigation', { name: 'Principal' }).locator('[data-foto="lista"] img'),
    ).toHaveAttribute('src', subidaDos.url);
  });

  test('sin señal no se abre el selector y el mensaje dice por qué', async ({ page, context }) => {
    await page.goto('/ajustes');
    const boton = page.getByRole('button', { name: /(Poner|Cambiar) la foto/ });
    await expect(boton).toBeVisible();

    await context.setOffline(true);
    const selector = page.waitForEvent('filechooser', { timeout: 1_500 }).catch(() => null);
    await boton.click();

    await expect(page.getByRole('alert')).toHaveText(
      'Sin señal no se puede cambiar la foto: se sube en el momento y no queda anotada para después. Probá cuando vuelva la señal.',
    );
    expect(await selector).toBeNull();
    await context.setOffline(false);
  });

  test('mientras la foto carga, y si no carga, se ven las iniciales', async ({ page }) => {
    let soltar: () => void = () => undefined;
    const demora = new Promise<void>((resolver) => {
      soltar = resolver;
    });
    await page.route('**/storage/v1/object/public/fotos-de-perfil/**', async (ruta) => {
      await demora;
      await ruta.abort();
    });

    await page.goto('/ajustes');
    const boton = page.getByRole('button', { name: /(Poner|Cambiar) la foto/ });
    await expect(boton).toBeVisible();
    const avatar = boton.locator('[data-foto]');
    const estado = await avatar.getAttribute('data-foto');
    test.skip(estado === 'sin-foto', 'la cuenta de prueba todavía no tiene foto');

    await expect(avatar).toHaveAttribute('data-foto', 'cargando');
    await expect(avatar).toHaveText(/^[A-ZÁÉÍÓÚÑ]{1,2}$/);
    soltar();
    await expect(avatar).toHaveAttribute('data-foto', 'fallo');
    await expect(avatar).toHaveText(/^[A-ZÁÉÍÓÚÑ]{1,2}$/);
    await expect(avatar.locator('img')).toHaveCount(0);
  });
});
