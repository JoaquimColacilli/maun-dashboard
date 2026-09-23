import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import {
  contactoPorRpc,
  crearCliente,
  guardarProyectoPorRpc,
  iniciarSesionDePrueba,
  leerProyecto,
  vaciarTaller,
  type SesionDePrueba,
} from '../apoyo/taller';

const CARGA = { timeout: 30_000 };
const EL_MAS_ANGOSTO = { width: 320, height: 720 };

interface Celda {
  texto: string;
  x: number;
  y: number;
  ancho: number;
  natural: number;
  lineas: number;
  desborda: boolean;
}

interface MedidaDeLaFila {
  x: number;
  ancho: number;
  minimo: number;
  celdas: Celda[];
}

let sesion: SesionDePrueba;

test.beforeEach(async () => {
  sesion = await iniciarSesionDePrueba();
  await vaciarTaller(sesion);
});

function anchosDelProyecto(page: Page, testInfo: TestInfo) {
  const propio = page.viewportSize() ?? { width: 390, height: 844 };
  return testInfo.project.name === 'celular' ? [propio, EL_MAS_ANGOSTO] : [propio];
}

async function obra(titulo: string, estado: 'en_curso' | 'entregado'): Promise<string> {
  const clienteId = await crearCliente(sesion, `Cliente de ${titulo}`);
  const id = crypto.randomUUID();
  await guardarProyectoPorRpc(sesion, {
    proyecto: {
      id,
      version: null,
      cliente_id: clienteId,
      titulo,
      estado,
      presupuesto_centavos: 120_000_000,
      comprobante: 'sin_comprobante',
    },
    pagos: [],
    gastos: [],
  });
  return id;
}

async function medir(fila: Locator): Promise<MedidaDeLaFila> {
  return fila.evaluate((elemento) => {
    const caja = elemento.getBoundingClientRect();
    const minimo = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--accion-min'),
    );
    const celdas = [...elemento.children].map((hijo) => {
      const rect = hijo.getBoundingClientRect();
      const boton = hijo instanceof HTMLButtonElement ? hijo : hijo.querySelector('button');
      if (boton === null) throw new Error('una celda de la fila sin botón');

      const copia = boton.cloneNode(true) as HTMLButtonElement;
      copia.style.position = 'absolute';
      copia.style.left = '0';
      copia.style.top = '0';
      copia.style.width = 'max-content';
      copia.style.visibility = 'hidden';
      document.body.append(copia);
      const natural = copia.getBoundingClientRect().width;
      copia.remove();

      const renglones = new Set<number>();
      const textos = document.createTreeWalker(boton, NodeFilter.SHOW_TEXT);
      for (let nodo = textos.nextNode(); nodo !== null; nodo = textos.nextNode()) {
        if ((nodo.textContent ?? '').trim() === '') continue;
        const rango = document.createRange();
        rango.selectNodeContents(nodo);
        for (const linea of rango.getClientRects()) renglones.add(Math.round(linea.top));
      }

      return {
        texto: boton.textContent.trim(),
        x: rect.left - caja.left,
        y: rect.top - caja.top,
        ancho: rect.width,
        natural,
        lineas: renglones.size,
        desborda:
          boton.scrollWidth > boton.clientWidth ||
          boton.scrollHeight > boton.clientHeight ||
          rect.left < caja.left - 0.5 ||
          rect.right > caja.right + 0.5,
      };
    });
    return { x: 0, ancho: caja.width, minimo, celdas };
  });
}

function disposicion(fila: MedidaDeLaFila): 'en una fila' | 'apiladas' {
  const [primera] = fila.celdas;
  if (primera === undefined) throw new Error('fila vacía');
  const enUnaFila = fila.celdas.every((celda) => Math.abs(celda.y - primera.y) < 1);
  if (enUnaFila) {
    const ultima = fila.celdas.at(-1) ?? primera;
    for (const celda of fila.celdas) expect(Math.abs(celda.ancho - primera.ancho)).toBeLessThan(1);
    expect(Math.abs(primera.x)).toBeLessThan(1);
    expect(Math.abs(ultima.x + ultima.ancho - fila.ancho)).toBeLessThan(1);
    return 'en una fila';
  }
  for (const celda of fila.celdas) {
    expect(Math.abs(celda.x)).toBeLessThan(1);
    expect(Math.abs(celda.ancho - fila.ancho)).toBeLessThan(1);
  }
  return 'apiladas';
}

async function revisar(
  fila: Locator,
  cuantos: number,
  nombre: string,
  page: Page,
  testInfo: TestInfo,
): Promise<'en una fila' | 'apiladas'> {
  await expect(fila.locator(':scope > *')).toHaveCount(cuantos);
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animacion) => animacion.effect?.getComputedTiming().iterations !== Infinity)
        .map((animacion) => animacion.finished),
    ),
  );
  const medida = await medir(fila);
  const forma = disposicion(medida);
  const ancho = page.viewportSize()?.width ?? 0;

  console.log(
    `[${testInfo.project.name} ${String(ancho)}px] ${nombre}: ${forma}, fila de ${medida.ancho.toFixed(1)} px, mínimo ${String(medida.minimo)} px | ${medida.celdas
      .map(
        (celda) =>
          `«${celda.texto}» ${celda.ancho.toFixed(1)} px (natural ${celda.natural.toFixed(1)}, ${String(celda.lineas)} renglón${celda.lineas === 1 ? '' : 'es'})`,
      )
      .join(' · ')}`,
  );

  for (const celda of medida.celdas) {
    expect(celda.natural, `el mínimo aguanta «${celda.texto}»`).toBeLessThanOrEqual(medida.minimo);
    expect(celda.desborda, `«${celda.texto}» no se sale de su botón`).toBe(false);
    if (medida.ancho >= medida.minimo)
      expect(celda.lineas, `«${celda.texto}» en un renglón`).toBe(1);
  }
  if (cuantos === 1) expect(forma).toBe('en una fila');

  await fila.evaluate((elemento) => {
    elemento.scrollIntoView({ block: 'center' });
  });
  await fila.locator('xpath=..').screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-${String(ancho)}-${nombre}.png`),
    style: '[data-lo-que-flota-abajo] { visibility: hidden !important; }',
  });
  return forma;
}

test('la ficha de una obra: las dos acciones van juntas, y una sola ocupa todo el ancho', async ({
  page,
}, testInfo) => {
  const anchos = anchosDelProyecto(page, testInfo);
  const obras = new Map<number, string>();
  for (const ancho of anchos) {
    obras.set(ancho.width, await obra(`Placard de ${String(ancho.width)}`, 'en_curso'));
  }

  for (const ancho of anchos) {
    const id = obras.get(ancho.width) ?? '';
    await page.setViewportSize(ancho);
    await page.goto(`/proyectos/${id}`);
    const panel = page.getByRole('region', { name: 'Qué falta' });
    await expect(panel).toContainText('Falta entregarlo', CARGA);
    const fila = panel.locator('[data-fila-de-acciones]');

    const forma = await revisar(fila, 2, 'obra-en-curso', page, testInfo);
    expect(forma).toBe('apiladas');
    await page.screenshot({
      path: testInfo.outputPath(`${testInfo.project.name}-${String(ancho.width)}-ficha.png`),
    });

    await panel.getByRole('button', { name: 'Ya lo entregué' }).click();
    await expect(panel.getByRole('button', { name: 'Volvió al taller' })).toBeVisible();
    await revisar(fila, 1, 'obra-entregada', page, testInfo);
  }
});

test('la etiqueta más larga de una fila, «Reactivar y deshacer el reparto», no se corta', async ({
  page,
}, testInfo) => {
  const { id, titulo } = await contactoPorRpc(sesion, {
    titulo: 'Vajillero',
    estado: 'presupuesto_enviado',
  });
  await page.goto(`/proyectos/${id}/cerrar`);
  await page.getByRole('button', { name: /^Dar por perdido/ }).click(CARGA);
  await expect(page).toHaveURL(new RegExp(`/proyectos/${id}$`), CARGA);
  await expect
    .poll(async () => (await leerProyecto(sesion, titulo))?.estado, CARGA)
    .toBe('perdido');

  for (const ancho of anchosDelProyecto(page, testInfo)) {
    await page.setViewportSize(ancho);
    await page.goto(`/proyectos/${id}`);
    await page.getByRole('button', { name: 'Reactivar el presupuesto' }).click(CARGA);
    const seccion = page.getByRole('region', { name: 'Reactivar el presupuesto' });
    await revisar(seccion.locator('[data-fila-de-acciones]'), 2, 'reactivar', page, testInfo);
  }
});

test('las hojas: cancelar y guardar entran juntos o bajan juntos, y una sola acción ocupa el pie', async ({
  page,
}, testInfo) => {
  for (const ancho of anchosDelProyecto(page, testInfo)) {
    await page.setViewportSize(ancho);

    await page.goto('/consultas/nueva');
    const contacto = page.getByRole('dialog');
    await expect(contacto.getByRole('button', { name: 'Guardar contacto' })).toBeVisible(CARGA);
    const forma = await revisar(
      contacto.locator('footer [data-fila-de-acciones]'),
      2,
      'hoja-de-contacto',
      page,
      testInfo,
    );
    expect(forma).toBe(testInfo.project.name === 'escritorio' ? 'en una fila' : 'apiladas');

    await page.goto('/finanzas/nuevo');
    const movimiento = page.getByRole('dialog');
    await expect(movimiento.getByRole('button', { name: 'Cargar el movimiento' })).toBeVisible(
      CARGA,
    );
    await revisar(
      movimiento.locator('footer [data-fila-de-acciones]'),
      1,
      'hoja-de-movimiento',
      page,
      testInfo,
    );
  }
});
